/**
 * SmartLex Content Script — T1.1 + T1.2
 * 监听用户划词行为，计算坐标，注入 Shadow DOM 弹窗容器
 * 集成上下文提取算法
 */

import {
  MIN_SELECTION_LENGTH,
  MAX_SELECTION_LENGTH,
  SELECTION_DEBOUNCE_MS,
  POPUP_WIDTH,
  POPUP_MAX_HEIGHT,
  POPUP_ANIMATION_MS,
} from '../../shared/constants';
import type { ExtractedContext } from '../utils/context-extractor';
import { extractContext } from '../utils/context-extractor';
import { instantLookup } from '../services/instantLookup';
import type { LookupResult } from '../services/instantLookup';

// ============================================================
// 工具函数
// ============================================================

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** 简单的 UUID v4 生成 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** URL 智能截断：短 URL 完整显示，长 URL 省略中间路径 */
function formatDisplayUrl(url: string): string {
  let display = url.replace(/^https?:\/\//, '');
  display = display.replace(/[#?].*$/, ''); // 去掉 hash 和 query

  // 短 URL（≤ 40 字符）完整显示
  if (display.length <= 40) return display;

  // 长 URL：保留 域名/首段/…/末段
  const parts = display.split('/');
  if (parts.length <= 3) return display; // 域名 + 1-2 段，不截

  return `${parts[0]}/${parts[1]}/…/${parts[parts.length - 1]}`;
}

// ============================================================
// MiniPopup — Shadow DOM 弹窗容器
// ============================================================

class MiniPopup {
  private host: HTMLDivElement | null = null;
  private shadow: ShadowRoot | null = null;
  private visible = false;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  /** 创建 Shadow DOM 宿主并挂载到 document.body */
  mount(): Promise<void> {
    if (this.host) return;

    this.host = document.createElement('div');
    this.host.id = 'smartlex-popup-host';
    // 宿主本身不占位、不拦截事件
    this.host.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;';
    this.shadow = this.host.attachShadow({ mode: 'closed' });

    // Shadow 内根容器
    const root = document.createElement('div');
    root.id = 'smartlex-popup-root';
    root.style.cssText = 'pointer-events:auto;display:none;';
    this.shadow.appendChild(root);

    document.body.appendChild(this.host);
  }

  /** 在指定坐标显示弹窗 */
  show(x: number, y: number, selectedText: string, ctx: ExtractedContext): Promise<void> {
    console.log('[SmartLex] show() called — x:', x, 'y:', y, 'term:', selectedText);
    if (!this.shadow || !this.host) {
      console.log('[SmartLex] show() aborted — missing shadow or host');
      return;
    }

    const root = this.shadow.getElementById('smartlex-popup-root');
    if (!root) {
      console.log('[SmartLex] show() aborted — root not found in shadow');
      return;
    }

    // 确保上一次弹窗的状态彻底清理（取消残留动画 timer）
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    root.innerHTML = '';
    root.style.display = 'none';

    // --- 位置计算 ---
    let left = x - POPUP_WIDTH / 2;
    const viewportW = window.innerWidth;

    // 水平边界修正
    if (left < 8) left = 8;
    else if (left + POPUP_WIDTH > viewportW - 8) left = viewportW - POPUP_WIDTH - 8;

    // 垂直：弹窗在选中文本上方
    let top = y - 16; // 12px gap + 4px tolerance

    // 如果上方空间不够，放到下方
    if (top < 60) {
      top = y + 16;
    }

    // --- 来源信息 ---
    const sourceUrl = window.location.href;
    const sourceTitle = document.title;
    const displayUrl = formatDisplayUrl(sourceUrl);

    // --- 完整 UI（T1.3） ---
    root.innerHTML = `
      <style>
        :host {
          all: initial;
        }
        .sl-popup {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #fff;
          color: #1e293b;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
          width: ${POPUP_WIDTH}px;
          max-height: ${POPUP_MAX_HEIGHT}px;
          overflow-y: auto;
          box-sizing: border-box;
          opacity: 0;
          transform: translateY(4px);
          transition: opacity ${POPUP_ANIMATION_MS}ms ease, transform ${POPUP_ANIMATION_MS}ms ease;
        }
        .sl-popup.visible {
          opacity: 1;
          transform: translateY(0);
        }
        .sl-popup::-webkit-scrollbar { width: 4px; }
        .sl-popup::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

        /* ── 目标词 ── */
        .sl-term-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 16px 0;
        }
        .sl-term {
          font-size: 18px;
          font-weight: 700;
          flex: 1;
        }
        .sl-term-edit {
          font-size: 13px;
          color: #6366f1;
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
          opacity: 0.6;
          transition: opacity 0.15s;
        }
        .sl-term-edit:hover { opacity: 1; }

        /* ── 分隔线 ── */
        .sl-divider {
          height: 1px;
          background: #e2e8f0;
          margin: 10px 16px;
        }

        /* ── 基本释义 ── */
        .sl-def-section {
          padding: 0 16px 10px;
        }
        .sl-def-label {
          font-size: 11px;
          font-weight: 500;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .sl-def-loading {
          font-size: 14px;
          color: #94a3b8;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .sl-def-loading-dot {
          width: 4px; height: 4px;
          background: #6366f1;
          border-radius: 50%;
          animation: sl-bounce 1.4s infinite ease-in-out both;
        }
        .sl-def-loading-dot:nth-child(1) { animation-delay: -0.32s; }
        .sl-def-loading-dot:nth-child(2) { animation-delay: -0.16s; }
        @keyframes sl-bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
        .sl-def-text {
          font-size: 14px;
          line-height: 1.5;
        }
        .sl-def-text-cn {
          font-weight: 600;
          color: #1e293b;
        }
        .sl-def-text-en {
          color: #64748b;
          margin-top: 2px;
        }

        /* ── 语境释义 ── */
        .sl-ctx-meaning {
          padding: 0 16px 10px;
        }

        /* ── 上下文预览 ── */
        .sl-ctx-section {
          margin: 0 16px 10px;
          padding: 8px 10px;
          background: #f8fafc;
          border-radius: 8px;
          border-left: 3px solid #6366f1;
          font-size: 13px;
          line-height: 1.6;
          color: #475569;
        }
        .sl-ctx-section mark {
          background: #e0e7ff;
          color: #4338ca;
          font-weight: 600;
          padding: 0 2px;
          border-radius: 2px;
        }
        .sl-ctx-ellipsis { color: #94a3b8; }

        /* ── 来源 URL ── */
        .sl-source {
          padding: 8px 16px;
          font-size: 11px;
          color: #94a3b8;
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sl-source-icon {
          font-size: 14px;
          flex-shrink: 0;
        }

        /* ── 操作栏 ── */
        .sl-actions {
          display: flex;
          gap: 8px;
          padding: 10px 16px 14px;
          border-top: 1px solid #f1f5f9;
        }
        .sl-btn {
          flex: 1;
          padding: 8px 12px;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }
        .sl-btn:active { transform: scale(0.97); }
        .sl-btn-primary {
          background: #6366f1;
          color: #fff;
        }
        .sl-btn-primary:hover { background: #4f46e5; }
        .sl-btn-secondary {
          background: #f1f5f9;
          color: #475569;
        }
        .sl-btn-secondary:hover { background: #e2e8f0; }
        .sl-btn-icon {
          font-size: 16px;
        }

        /* ── 暗色模式 ── */
        @media (prefers-color-scheme: dark) {
          .sl-popup {
            background: #1e1b1b;
            color: #e7e5e4;
            border-color: #292524;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          }
          .sl-divider { background: #292524; }
          .sl-def-text-cn { color: #e7e5e4; }
          .sl-def-text-en { color: #a8a29e; }
          .sl-def-loading { color: #78716c; }
          .sl-ctx-section {
            background: #1c1917;
            border-left-color: #818cf8;
            color: #a8a29e;
          }
          .sl-ctx-section mark {
            background: #312e81;
            color: #c7d2fe;
          }
          .sl-source { color: #78716c; }
          .sl-actions { border-top-color: #292524; }
          .sl-btn-secondary { background: #292524; color: #a8a29e; }
          .sl-btn-secondary:hover { background: #44403c; }
          .sl-btn-primary { background: #6366f1; }
          .sl-btn-primary:hover { background: #818cf8; }
        }
      </style>
      <div class="sl-popup">
        <!-- 目标词 -->
        <div class="sl-term-row">
          <span class="sl-term">${escapeHtml(selectedText)}</span>
          <span class="sl-term-edit" title="编辑">✎</span>
        </div>
        <div class="sl-divider"></div>

        <!-- 基本释义 (T1.4 连接 AI) -->
        <div class="sl-def-section">
          <div class="sl-def-label">💡 释义</div>
          <div class="sl-def-loading">
            <span class="sl-def-loading-dot"></span>
            <span class="sl-def-loading-dot"></span>
            <span class="sl-def-loading-dot"></span>
          </div>
        </div>
        <div class="sl-divider"></div>

        <!-- 语境释义 (T1.4 连接 AI) -->
        <div class="sl-ctx-meaning">
          <div class="sl-def-label">📖 在此语境中</div>
          <div class="sl-def-loading">
            <span class="sl-def-loading-dot"></span>
            <span class="sl-def-loading-dot"></span>
            <span class="sl-def-loading-dot"></span>
          </div>
        </div>
        <div class="sl-divider"></div>

        <!-- 上下文预览（默认隐藏，点击展开更多后可见） -->
        <div class="sl-ctx-section" style="display:none;">
          <span class="sl-ctx-ellipsis">${ctx.before ? '…' : ''}</span>${escapeHtml(ctx.before)}<mark>${escapeHtml(ctx.target)}</mark>${escapeHtml(ctx.after)}<span class="sl-ctx-ellipsis">${ctx.after ? '…' : ''}</span>
        </div>

        <!-- 来源 URL -->
        <div class="sl-source">
          <span class="sl-source-icon">🔗</span>
          <span>${escapeHtml(displayUrl)}</span>
        </div>

        <!-- 操作栏 (T1.4 连线) -->
        <div class="sl-actions">
          <button class="sl-btn sl-btn-primary" id="sl-btn-save">
            <span class="sl-btn-icon">✓</span> 收藏
          </button>
          <button class="sl-btn sl-btn-secondary" id="sl-btn-expand">
            展开更多 <span style="font-size:12px">▼</span>
          </button>
        </div>
      </div>
    `;

    // 定位宿主 — getBoundingClientRect 返回视口坐标 = fixed 定位坐标系
    this.host.style.left = `${left}px`;
    this.host.style.top = `${top}px`;

    root.style.display = 'block';
    this.visible = true;

    // 触发入场动画
    requestAnimationFrame(() => {
      const popupEl = root.querySelector('.sl-popup') as HTMLElement;
      if (popupEl) popupEl.classList.add('visible');
    });

    // 位置自校正：某些页面（如 archive.ph）CSS 的 contain/transform 会偏移 fixed 元素
    // getBoundingClientRect 始终返回视口坐标，与目标对比后修正
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const hostRect = this.host!.getBoundingClientRect();
        const deltaX = left - hostRect.left;
        const deltaY = top - hostRect.top;

        if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
          console.log('[SmartLex] Position correction — delta:', deltaX, deltaY);
          this.host!.style.left = `${left + deltaX}px`;
          this.host!.style.top = `${top + deltaY}px`;
        }
      });
    });

    // 绑定按钮事件
    this.bindEvents(root, selectedText, ctx, sourceUrl, sourceTitle);

    // F0：异步请求 AI 即时释义（不阻塞弹窗显示）
    this.requestDefinition(selectedText, ctx);
  }

  /** 绑定交互事件（T1.4） */
  private bindEvents(
    root: HTMLElement,
    selectedText: string,
    ctx: ExtractedContext,
    sourceUrl: string,
    sourceTitle: string,
  ): Promise<void> {
    const saveBtn = root.querySelector('#sl-btn-save');
    const expandBtn = root.querySelector('#sl-btn-expand');
    const editBtn = root.querySelector('.sl-term-edit') as HTMLElement;
    const termEl = root.querySelector('.sl-term') as HTMLElement;

    // ── 收藏 ──
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.doSave(selectedText, ctx, sourceUrl, sourceTitle);
      });
    }

    // ── 展开更多 ──
    let expanded = false;
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        expanded = !expanded;
        const defSection = root.querySelector('.sl-def-section') as HTMLElement;
        const ctxMeaning = root.querySelector('.sl-ctx-meaning') as HTMLElement;
        const ctxSection = root.querySelector('.sl-ctx-section') as HTMLElement;
        const source = root.querySelector('.sl-source') as HTMLElement;

        if (expanded) {
          if (defSection) defSection.style.display = 'block';
          if (ctxMeaning) ctxMeaning.style.display = 'block';
          if (ctxSection) ctxSection.style.display = 'block';
          if (source) source.style.display = 'flex';
          expandBtn.innerHTML = '收起 <span style="font-size:12px">▲</span>';
        } else {
          if (defSection) defSection.style.display = 'none';
          if (ctxMeaning) ctxMeaning.style.display = 'none';
          if (ctxSection) ctxSection.style.display = 'none';
          if (source) source.style.display = 'none';
          expandBtn.innerHTML = '展开更多 <span style="font-size:12px">▼</span>';
        }
      });
    }

    // ── 编辑目标词 ──
    let editing = false;
    if (editBtn && termEl) {
      editBtn.addEventListener('click', () => {
        if (editing) return;
        editing = true;

        const originalText = termEl.textContent || '';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalText;
        input.style.cssText = `
          font-size: 18px; font-weight: 700; border: none; outline: none;
          background: transparent; color: inherit; width: 100%;
          border-bottom: 2px solid #6366f1; padding: 2px 0;
        `;
        termEl.replaceWith(input);
        input.focus();
        input.select();

        const finishEdit = () => {
          const newText = input.value.trim() || originalText;
          input.replaceWith(termEl);
          termEl.textContent = newText;
          editing = false;
        };

        input.addEventListener('blur', finishEdit);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { input.blur(); }
          if (e.key === 'Escape') {
            input.value = originalText;
            input.blur();
          }
        });
      });
    }

    // ── 键盘快捷键 ──
    // 先移除上一次可能残留的 handler
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler);
    }
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !editing) {
        e.preventDefault();
        this.doSave(
          termEl?.textContent || selectedText,
          ctx,
          sourceUrl,
          sourceTitle,
        );
      }
    };
    document.addEventListener('keydown', this.keyHandler);
  }

  /** 执行收藏操作 */
  private async doSave(
    term: string,
    ctx: ExtractedContext,
    sourceUrl: string,
    sourceTitle: string,
  ): Promise<void> {
    const entry = {
      id: generateUUID(),
      term,
      context: {
        before: ctx.before,
        target: ctx.target || term,
        after: ctx.after,
      },
      source: {
        url: sourceUrl,
        title: sourceTitle,
        favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(sourceUrl)}&sz=32`,
      },
      tags: [] as string[],
      capturedAt: new Date().toISOString(),
      status: 'pending' as const,
    };

    // 重置去重状态，允许收藏后立即再次选择同一词汇
    lastSelectionText = '';

    // 发送到 Service Worker 存储
    try {
      await chrome.runtime.sendMessage({
        type: 'CAPTURE_ENTRY',
        payload: entry,
      });
      this.showToast('✓ 已收藏');
      setTimeout(() => this.hide(), 600);
    } catch (err: any) {
      this.showToast('⚠ 收藏失败，请重试');
      console.error('[SmartLex] Save failed:', err?.message || err);
      console.error('[SmartLex] Error stack:', err?.stack);
    }
  }

  /** Shadow DOM 内 Toast */
  private showToast(message: string): Promise<void> {
    if (!this.shadow) return;

    // 移除已有 toast
    const existing = this.shadow.getElementById('sl-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'sl-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
      background: #1e293b; color: #fff; padding: 8px 20px; border-radius: 20px;
      font-size: 13px; font-weight: 500; font-family: -apple-system, sans-serif;
      z-index: 2147483647; pointer-events: none; opacity: 0;
      transition: opacity 0.2s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    this.shadow.appendChild(toast);

    requestAnimationFrame(() => { toast.style.opacity = '1'; });
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    }, 1500);
  }

  /**
   * 直接调用 AI API 获取即时释义（F0）。
   *
   * 架构：直接从 content script 调用 instantLookup()，不走 Service Worker。
   * 原因：SW 被 Chrome 回收/重载后，content script → SW 的消息通道会断开
   * （Extension context invalidated），且重试不一定恢复。
   * Content script 有 fetch 权限和 chrome.storage.local 访问权限，直接调 API 更可靠。
   */
  private async requestDefinition(term: string, ctx: ExtractedContext): Promise<void> {
    if (!this.shadow) return;

    const root = this.shadow.getElementById('smartlex-popup-root');
    if (!root) return;

    const contextText = [ctx.before, ctx.target, ctx.after]
      .filter(Boolean)
      .join(' ')
      .trim();

    let result: LookupResult | null = null;

    try {
      result = await instantLookup({ term, context: contextText });
    } catch (err) {
      console.warn('[SmartLex] Instant lookup error:', err);
    }

    this.updateDefinitionDOM(root, result);
  }

  /** 将释义结果渲染到 DOM（替换 loading 动画） */
  private updateDefinitionDOM(root: HTMLElement, result: LookupResult | null): void {
    // ── 基本释义区域 ──
    const defSection = root.querySelector('.sl-def-section');
    if (defSection) {
      const loading = defSection.querySelector('.sl-def-loading');
      if (loading) {
        if (result) {
          loading.outerHTML = `
            <div class="sl-def-text">
              <div class="sl-def-text-cn">${escapeHtml(result.definitionCn)}</div>
              <div class="sl-def-text-en">${escapeHtml(result.definitionEn)}</div>
            </div>
          `;
        } else {
          loading.outerHTML = `
            <div class="sl-def-text" style="color:#94a3b8;font-size:13px;">
              未配置 API Key — 请点击扩展图标配置
            </div>
          `;
        }
      }
    }

    // ── 语境释义区域 ──
    const ctxMeaning = root.querySelector('.sl-ctx-meaning');
    if (ctxMeaning) {
      const loading = ctxMeaning.querySelector('.sl-def-loading');
      if (loading) {
        if (result?.contextualMeaning) {
          loading.outerHTML = `
            <div class="sl-def-text" style="color:#475569;">
              ${escapeHtml(result.contextualMeaning)}
            </div>
          `;
        } else {
          loading.outerHTML = `
            <div class="sl-def-text" style="color:#94a3b8;font-size:13px;font-style:italic;">
              需要 API Key 才能获取语境分析
            </div>
          `;
        }
      }
    }
  }

  /** 隐藏弹窗 */
  hide(): void {
    // 清理键盘事件
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }

    if (!this.shadow || !this.host) return;

    const root = this.shadow.getElementById('smartlex-popup-root');
    if (!root) return;

    const popup = root.querySelector('.sl-popup') as HTMLElement;
    if (popup) {
      popup.classList.remove('visible');
      // 等待动画完成后移除（保存 timer 以便 show() 取消）
      this.hideTimer = setTimeout(() => {
        root.style.display = 'none';
        root.innerHTML = '';
        this.hideTimer = null;
      }, POPUP_ANIMATION_MS);
    } else {
      root.style.display = 'none';
      root.innerHTML = '';
    }
    this.visible = false;
  }

  /** 弹窗是否可见 */
  isVisible(): boolean {
    return this.visible;
  }

  /** 完全移除宿主 */
  destroy(): Promise<void> {
    this.hide();
    if (this.host && this.host.parentNode) {
      this.host.parentNode.removeChild(this.host);
    }
    this.host = null;
    this.shadow = null;
  }
}

// ============================================================
// 划词监听
// ============================================================

const popup = new MiniPopup();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastSelectionText = '';

/** 判断当前焦点是否在输入框内 */
function isEditableTarget(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

/** 判断是否在 SmartLex 自身页面中 */
function isSmartLexPage(): boolean {
  try {
    // 开发服务器
    if (window.location.hostname === 'localhost') return true;
    if (window.location.hostname === '127.0.0.1') return true;
    // Tauri WebView
    if (window.location.protocol === 'tauri:') return true;
  } catch {
    // 跨域情况下忽略
  }
  return false;
}

/** 获取选中文本的屏幕坐标 */
function getSelectionCoords(): { x: number; y: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;

  const range = sel.getRangeAt(0);
  if (range.collapsed) return null;

  const rect = range.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top,
  };
}

function handleMouseUp(): Promise<void> {
  // 不清除上一次的 timer：debounce 延迟 200ms
  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    debounceTimer = null;

    // 如果弹窗已可见，不重新触发（等用户操作完）
    if (popup.isVisible()) return;

    // 环境检查
    if (isSmartLexPage()) return;

    const sel = window.getSelection();
    const text = sel?.toString().trim();

    if (!text) return;

    // ---- 诊断日志 ----
    console.log('[SmartLex] Selected:', JSON.stringify(text));
    // ------------------

    // 长度过滤
    if (text.length < MIN_SELECTION_LENGTH || text.length > MAX_SELECTION_LENGTH) {
      console.log('[SmartLex] Rejected — length', text.length, '(range:', MIN_SELECTION_LENGTH, '-', MAX_SELECTION_LENGTH, ')');
      return;
    }

    // 去重：与上次选中文本相同则跳过
    if (text === lastSelectionText) {
      console.log('[SmartLex] Skipped — same as last selection');
      return;
    }
    lastSelectionText = text;

    // 坐标计算
    const coords = getSelectionCoords();
    if (!coords) {
      console.log('[SmartLex] No coords — range may be collapsed');
      return;
    }
    console.log('[SmartLex] Coords:', coords.x, coords.y);

    // 上下文提取（带保护，避免 extractContext 内部异常阻断弹窗显示）
    let ctx: ExtractedContext;
    try {
      console.log('[SmartLex] Extracting context...');
      ctx = extractContext(sel);
      console.log('[SmartLex] Context:', 'before:', ctx.before.length, 'chars, after:', ctx.after.length, 'chars');
    } catch (err: any) {
      console.warn('[SmartLex] Context extraction failed:', err);
      ctx = { before: '', target: text, after: '' };
    }

    // 挂载并显示弹窗
    console.log('[SmartLex] Mounting popup... host:', !!popup['host'], 'shadow:', !!popup['shadow']);
    popup.mount();
    console.log('[SmartLex] After mount — host:', !!popup['host'], 'shadow:', !!popup['shadow']);
    popup.show(coords.x, coords.y, text, ctx);
    console.log('[SmartLex] After show — visible:', popup.isVisible());
  }, SELECTION_DEBOUNCE_MS);
}

function handleKeyDown(e: KeyboardEvent): Promise<void> {
  if (e.key === 'Escape' && popup.isVisible()) {
    popup.hide();
    lastSelectionText = '';
  }
}

function handleMouseDown(e: MouseEvent): Promise<void> {
  // 点击弹窗外部 → 关闭
  if (!popup.isVisible()) return;

  const host = document.getElementById('smartlex-popup-host');
  if (host && !host.contains(e.target as Node)) {
    popup.hide();
    lastSelectionText = '';
  }
}

// ============================================================
// 初始化
// ============================================================

function init(): Promise<void> {
  console.log('[SmartLex] Content script v0.2.0 initialized');
  document.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('mousedown', handleMouseDown);

  // 监听 Service Worker 发来的消息
  chrome.runtime.onMessage.addListener((message) => {
    // ── 快捷键触发捕获 ──
    if (message.type === 'TRIGGER_CAPTURE') {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (!text || text.length < MIN_SELECTION_LENGTH || text.length > MAX_SELECTION_LENGTH) return;
      if (isSmartLexPage()) return;

      lastSelectionText = text;
      const coords = getSelectionCoords();
      if (!coords) return;

      const ctx = extractContext(sel!);
      popup.mount();
      popup.show(coords.x, coords.y, text, ctx);
    }

    // ── Popup 同步触发：向 Web App 页面派发自定义事件 ──
    if (message.type === 'TRIGGER_SYNC') {
      window.dispatchEvent(new CustomEvent('smartlex:extension-sync-requested'));
    }
  });

  console.log('[SmartLex] Event listeners attached — ready to capture');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
