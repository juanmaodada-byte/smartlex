/**
 * SmartLex ExtensionBridge — T2.1
 * Web App 与 Chrome 扩展通信的桥接层
 *
 * 使用前需在设置中配置扩展 ID：
 *   chrome://extensions/ → SmartLex Capture → ID（如 abcdefghijklmnop）
 *
 * 注意：仅在 Chrome/Chromium 浏览器中可用。Tauri WebView 不支持 Chrome 扩展 API。
 */

import { EXTENSION_ID } from '../../shared/constants';
import type { CapturedEntry } from '../../shared/types';

const EXT_ID_KEY = 'smartlex_extension_id';

// ============================================================
// 环境检测
// ============================================================

/** Tauri 或非 Chrome 环境下扩展 API 不可用 */
function isChromeExtensionEnv(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.runtime && !(window as any).__TAURI__;
}

// ============================================================
// 公共 API
// ============================================================

export const extensionBridge = {

  /** 扩展功能是否在该环境下可用 */
  isSupported(): boolean {
    return isChromeExtensionEnv();
  },
  /** 获取扩展 ID（优先使用用户配置，回退到编译时常量） */
  getExtensionId(): string {
    return localStorage.getItem(EXT_ID_KEY) || EXTENSION_ID;
  },

  /**
   * 尝试向扩展发送 PING，若失败则回退到编译时常量 ID 重试。
   * 用于自动修复：manifest.json 加 key 字段后扩展 ID 变更为确定性值，
   * 但 localStorage 中可能仍保留旧的随机 ID。
   */
  async resolveExtensionId(): Promise<string> {
    if (!isChromeExtensionEnv()) return EXTENSION_ID;
    const stored = localStorage.getItem(EXT_ID_KEY);

    // 1. 优先尝试用户保存的 ID
    if (stored) {
      try {
        const r = await chrome.runtime.sendMessage(stored, { type: 'PING' });
        if (r?.status === 'OK') return stored;
      } catch { /* 旧的 ID 不可达 */ }
      console.log('[ExtensionBridge] Stored ID unreachable, falling back to default');
    }

    // 2. 回退到编译时常量
    try {
      const r = await chrome.runtime.sendMessage(EXTENSION_ID, { type: 'PING' });
      if (r?.status === 'OK') {
        // 自动修正：将正确的 ID 写入 localStorage
        if (stored !== EXTENSION_ID) {
          localStorage.setItem(EXT_ID_KEY, EXTENSION_ID);
          console.log('[ExtensionBridge] Auto-corrected extension ID →', EXTENSION_ID);
        }
        return EXTENSION_ID;
      }
    } catch { /* 也未安装 */ }

    // 3. 都不行，返回存储值或默认值
    return stored || EXTENSION_ID;
  },

  /** 保存扩展 ID */
  setExtensionId(id: string): void {
    localStorage.setItem(EXT_ID_KEY, id);
  },

  /** 清除扩展 ID */
  clearExtensionId(): void {
    localStorage.removeItem(EXT_ID_KEY);
  },

  /** 检测扩展是否安装并可达 */
  async isInstalled(): Promise<boolean> {
    if (!isChromeExtensionEnv()) return false;
    const extId = this.getExtensionId();

    try {
      const response = await chrome.runtime.sendMessage(extId, { type: 'PING' });
      return response?.status === 'OK';
    } catch {
      return false;
    }
  },

  /** 从扩展拉取 Inbox 数据 */
  async fetchInbox(): Promise<CapturedEntry[]> {
    if (!isChromeExtensionEnv()) return [];
    const extId = this.getExtensionId();

    const response = await chrome.runtime.sendMessage(extId, { type: 'GET_INBOX' });
    return response?.inbox || [];
  },

  /** 确认同步完成，通知扩展清除已传输条目 */
  async confirmSync(entryIds: string[]): Promise<void> {
    if (!isChromeExtensionEnv()) return;
    if (!entryIds || entryIds.length === 0) return;
    const extId = this.getExtensionId();

    try {
      await chrome.runtime.sendMessage(extId, {
        type: 'CONFIRM_SYNC',
        payload: entryIds,
      });
    } catch (err) {
      console.warn('[ExtensionBridge] Confirm sync failed:', err);
    }
  },

  /** 将 Web App 的 API 配置推送到扩展（F0 即时释义依赖） */
  async pushApiConfig(provider: string, apiKeys: Record<string, string>): Promise<void> {
    if (!isChromeExtensionEnv()) return;
    const extId = await this.resolveExtensionId();
    const keyCount = Object.keys(apiKeys).length;
    try {
      await chrome.runtime.sendMessage(extId, {
        type: 'SYNC_API_CONFIG',
        payload: { provider, apiKeys },
      });
      console.log(
        `[ExtensionBridge] API config synced → ext:${extId} provider:${provider} keys:${keyCount}`,
      );
    } catch {
      // 扩展未安装或不可达时静默失败
      console.log('[ExtensionBridge] API sync skipped — extension not reachable');
    }
  },
};

