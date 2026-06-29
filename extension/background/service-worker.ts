/**
 * SmartLex Service Worker — T1.5
 * 存储管理 + 消息路由 + Badge 更新 + 同步控制
 */

import { STORAGE_KEYS, DEFAULT_EXTENSION_SETTINGS, TAURI_BRIDGE_PORT } from '../../shared/constants';
import type { CapturedEntry, ExtensionSettings } from '../../shared/types';
import { instantLookup } from '../services/instantLookup';

// ============================================================
// 初始化
// ============================================================

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[SmartLex SW] Extension installed v0.2.0');

  // 初始化存储
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.INBOX,
    STORAGE_KEYS.SETTINGS,
    'smartlex_daily_date',
    'smartlex_daily_count',
  ]);
  if (!data[STORAGE_KEYS.INBOX]) {
    await chrome.storage.local.set({ [STORAGE_KEYS.INBOX]: [] });
  }
  if (!data[STORAGE_KEYS.SETTINGS]) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: DEFAULT_EXTENSION_SETTINGS,
    });
  }
  // 初始化每日计数
  if (data['smartlex_daily_date'] !== new Date().toDateString()) {
    await chrome.storage.local.set({
      smartlex_daily_date: new Date().toDateString(),
      smartlex_daily_count: 0,
    });
  }

  // 创建定时复习提醒闹钟（每天 9:00）
  await chrome.alarms.create('daily-review', {
    periodInMinutes: 1440, // 24h
  });
  console.log('[SmartLex SW] Daily review alarm created');

  // 创建右键菜单
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'capture-selection',
      title: '📖 Capture to SmartLex',
      contexts: ['selection'],
    });
  });
});

// 确保右键菜单在每次 SW 启动时都存在（onInstalled 不在 reload 时触发）
chrome.contextMenus.removeAll(() => {
  chrome.contextMenus.create({
    id: 'capture-selection',
    title: '📖 Capture to SmartLex',
    contexts: ['selection'],
  });
});

// 确保每日复习闹钟在每次 SW 启动时都活跃
// （SW 可被 Chrome 回收后重启，此时 onInstalled 不触发）
(async () => {
  const existing = await chrome.alarms.get('daily-review');
  if (!existing) {
    await chrome.alarms.create('daily-review', {
      periodInMinutes: 1440, // 24h
    });
    console.log('[SmartLex SW] Daily review alarm re-created on SW start');
  }
})();

// ============================================================
// 定时复习提醒 — alarm 事件
// ============================================================

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'daily-review') return;

  console.log('[SmartLex SW] Daily review alarm fired');

  try {
    // 统计待复习数量并更新 Badge
    const reviewData = await chrome.storage.local.get('smartlex_review_queue');
    const queue: any[] = reviewData['smartlex_review_queue'] || [];
    const now = new Date();
    const due = queue.filter((card: any) => {
      if (!card.nextReviewDate) return false;
      return new Date(card.nextReviewDate) <= now;
    });

    if (due.length > 0) {
      // 显示提醒标记在 Badge 上
      chrome.action.setBadgeText({
        text: due.length > 99 ? '∞' : String(due.length),
      });
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' }); // Amber-500 — 复习提醒
      console.log(`[SmartLex SW] ${due.length} cards due for review`);
    }
  } catch (err) {
    console.warn('[SmartLex SW] Review alarm check failed:', err);
  }
});

// ============================================================
// 右键菜单：选词捕获
// ============================================================

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'capture-selection' || !info.selectionText) return;
  if (!tab?.id || !tab.url) return;

  const entry: CapturedEntry = {
    id: generateUUID(),
    term: info.selectionText.trim(),
    context: {
      before: '',
      target: info.selectionText.trim(),
      after: '',
    },
    source: {
      url: tab.url,
      title: tab.title || '',
      favicon: tab.favIconUrl,
    },
    tags: [],
    capturedAt: new Date().toISOString(),
    status: 'pending',
  };

  await handleCaptureEntry(entry);
  console.log('[SmartLex SW] Context menu capture:', entry.term);
});

// ============================================================
// 快捷键命令：Ctrl+Shift+S 触发捕获
// ============================================================

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'capture-selection') return;
  if (!tab?.id) return;

  // 向 Content Script 发送消息，触发当前选词的捕获流程
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_CAPTURE' });
  } catch {
    // Content script 未注入（如 chrome:// 页面），忽略
    console.log('[SmartLex SW] Command failed — content script not available on this page');
  }
});

// ============================================================
// 消息路由
// ============================================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    // ── 心跳检测（Web App 检测扩展是否安装） ──
    case 'PING':
      sendResponse({ status: 'OK', version: '0.2.0' });
      return false;

    // ── Content Script：捕获新词条 ──
    case 'CAPTURE_ENTRY':
      handleCaptureEntry(message.payload)
        .then(() => sendResponse({ status: 'OK' }))
        .catch((err) => {
          console.error('[SW] Capture failed:', err);
          sendResponse({ status: 'ERROR', message: String(err) });
        });
      return true; // async

    // ── Web App：拉取 Inbox ──
    case 'GET_INBOX':
      chrome.storage.local.get(STORAGE_KEYS.INBOX, (data) => {
        sendResponse({ inbox: data[STORAGE_KEYS.INBOX] || [] });
      });
      return true;

    // ── Web App：确认同步完成，清除已同步条目 ──
    case 'CONFIRM_SYNC':
      handleConfirmSync(message.payload).then(() => {
        sendResponse({ status: 'OK' });
      });
      return true;

    // ── Web App / Popup：获取设置 ──
    case 'GET_SETTINGS':
      chrome.storage.local.get(STORAGE_KEYS.SETTINGS, (data) => {
        sendResponse({
          settings: data[STORAGE_KEYS.SETTINGS] || DEFAULT_EXTENSION_SETTINGS,
        });
      });
      return true;

    // ── Content Script：即时释义查找（F0） ──
    case 'INSTANT_LOOKUP':
      instantLookup(message.payload)
        .then((result) => sendResponse({ status: 'OK', result }))
        .catch((err) => {
          console.warn('[SW] Instant lookup failed:', err);
          sendResponse({ status: 'ERROR', result: null });
        });
      return true; // async

    // ── Popup：触发同步（通知已打开的 Web App 标签页） ──
    case 'TRIGGER_SYNC':
      handleTriggerSync().then(() => sendResponse({ status: 'OK' }));
      return true;

    // ── Web App / Popup：更新 Badge ──
    case 'UPDATE_BADGE':
      updateBadge(message.payload);
      sendResponse({ status: 'OK' });
      return false;

    default:
      console.warn('[SmartLex SW] Unknown message type:', message.type);
      sendResponse({ status: 'UNKNOWN_MESSAGE_TYPE' });
      return false;
  }
});

// ============================================================
// 存储操作
// ============================================================

/** 添加词条到 Inbox，同时追踪每日捕获计数 */
async function handleCaptureEntry(entry: CapturedEntry): Promise<void> {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.INBOX,
    'smartlex_daily_date',
    'smartlex_daily_count',
  ]);
  const inbox: CapturedEntry[] = data[STORAGE_KEYS.INBOX] || [];

  // 去重：同一 term + 同一 URL
  const exists = inbox.find(
    (e) => e.term === entry.term && e.source.url === entry.source.url,
  );
  if (exists) {
    console.log('[SmartLex SW] Duplicate entry, skipping:', entry.term);
    return;
  }

  inbox.push(entry);
  await chrome.storage.local.set({ [STORAGE_KEYS.INBOX]: inbox });

  // ── 每日捕获计数 ──
  const todayStr = new Date().toDateString();
  const dailyDate = data['smartlex_daily_date'];
  let dailyCount: number;
  if (dailyDate === todayStr) {
    dailyCount = (data['smartlex_daily_count'] || 0) + 1;
  } else {
    dailyCount = 1; // 新的一天，重置计数
  }
  await chrome.storage.local.set({
    smartlex_daily_date: todayStr,
    smartlex_daily_count: dailyCount,
  });

  updateBadge(inbox.length);
  console.log(
    '[SmartLex SW] Entry saved:',
    entry.term,
    '— inbox:',
    inbox.length,
    '— today:',
    dailyCount,
  );

  // ── 尝试推送到 Tauri 桌面端（本地 HTTP 桥接，静默失败）──
  try {
    await fetch(`http://127.0.0.1:${TAURI_BRIDGE_PORT}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    console.log('[SmartLex SW] Pushed to Tauri bridge:', entry.term);
  } catch {
    // Tauri 未在运行 — 无操作，词条已存 chrome.storage 等待 Web App 同步
  }
}

/** 确认同步：删除 Web App 已接收的条目 */
async function handleConfirmSync(syncedIds: string[]): Promise<void> {
  if (!syncedIds || syncedIds.length === 0) return;

  const data = await chrome.storage.local.get(STORAGE_KEYS.INBOX);
  const inbox: CapturedEntry[] = data[STORAGE_KEYS.INBOX] || [];
  const idSet = new Set(syncedIds);
  const remaining = inbox.filter((e) => !idSet.has(e.id));

  const removed = inbox.length - remaining.length;
  console.log(
    '[SmartLex SW] Sync confirmed — removed',
    removed,
    'entries,',
    remaining.length,
    'remaining',
  );

  await chrome.storage.local.set({ [STORAGE_KEYS.INBOX]: remaining });
  updateBadge(remaining.length);
}

/** Popup 同步按钮：通知已打开的 Web App 标签页拉取 Inbox */
async function handleTriggerSync(): Promise<void> {
  const tabs = await chrome.tabs.query({ url: 'http://localhost:*/*' });
  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_SYNC' });
      console.log('[SmartLex SW] Sync triggered for tab:', tab.id);
    } catch {
      // 标签页可能未注入 content script，忽略
    }
  }
}

// ============================================================
// Badge 管理
// ============================================================

/** 更新扩展图标上的 Badge 数量 */
function updateBadge(count: number): void {
  if (count > 0) {
    chrome.action.setBadgeText({
      text: count > 999 ? '∞' : String(count),
    });
    chrome.action.setBadgeBackgroundColor({ color: '#6366f1' }); // Indigo-500
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// ============================================================
// 外部消息（Web App ↔ 扩展通信，T2.1）
// ============================================================

chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'PING':
      sendResponse({ status: 'OK', version: '0.2.0' });
      return false;

    case 'GET_INBOX':
      chrome.storage.local.get(STORAGE_KEYS.INBOX, (data) => {
        sendResponse({ inbox: data[STORAGE_KEYS.INBOX] || [] });
      });
      return true;

    case 'CONFIRM_SYNC':
      handleConfirmSync(message.payload).then(() => {
        sendResponse({ status: 'OK' });
      });
      return true;

    // ── Web App：同步 API 配置到扩展存储（F0 依赖） ──
    case 'SYNC_API_CONFIG':
      handleSyncApiConfig(message.payload).then(() => {
        sendResponse({ status: 'OK' });
      });
      return true;

    default:
      return false;
  }
});

/** 同步 API 配置：Web App → 扩展 chrome.storage.local（F0） */
async function handleSyncApiConfig(payload: {
  provider: string;
  apiKeys: Record<string, string>;
}): Promise<void> {
  const entries: Record<string, string> = {
    smartlex_active_provider: payload.provider,
  };
  for (const [providerId, key] of Object.entries(payload.apiKeys)) {
    entries[`smartlex_api_key_${providerId}`] = key;
  }
  await chrome.storage.local.set(entries);
  console.log('[SmartLex SW] API config synced — provider:', payload.provider);
}

// ============================================================
// 工具函数
// ============================================================

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
