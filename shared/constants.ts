// ============================================================
// SmartLex 共享常量定义
// 用途：Chrome 扩展 与 Web App 共享的常量
// ============================================================

// ========== chrome.storage.local 存储键名 ==========

/** chrome.storage.local 中使用的存储键 */
export const STORAGE_KEYS = {
  /** 待处理词条列表 */
  INBOX: 'smartlex_inbox',
  /** 扩展用户设置 */
  SETTINGS: 'smartlex_settings',
  /** 字典释义缓存（IndexedDB 存储键前缀，实际存储为 IndexedDB） */
  DICT_CACHE: 'smartlex_dict_cache',
} as const;

// ========== 扩展标识 ==========

/**
 * 扩展 ID（通过 key.pem 确定性生成）
 * 发布 Chrome Web Store 后需替换为商店分配的 ID
 */
export const EXTENSION_ID = 'mdefeghnbdbjglbilahmaiijidenlhek';

// ========== 扩展消息类型 ==========

/** 扩展 ↔ Web App 通信消息类型 */
export const MSG_TYPE = {
  PING: 'PING',
  GET_INBOX: 'GET_INBOX',
  SYNC_INBOX: 'SYNC_INBOX',
  CONFIRM_SYNC: 'CONFIRM_SYNC',
  GET_SETTINGS: 'GET_SETTINGS',
  UPDATE_BADGE: 'UPDATE_BADGE',
} as const;

// ========== 划词捕获约束 ==========

/** 选中文本最小长度（字符数） */
export const MIN_SELECTION_LENGTH = 2;

/** 选中文本最大长度（字符数） */
export const MAX_SELECTION_LENGTH = 200;

/** 上下文提取每部分最大字符数 */
export const MAX_CONTEXT_CHARS = 200;

// ========== 时间常量（毫秒） ==========

/** 划词 mouseup 后的防抖延迟 */
export const SELECTION_DEBOUNCE_MS = 200;

/** Mini Popup 出现动画时长 */
export const POPUP_ANIMATION_MS = 300;

/** AI 即时释义请求超时 */
export const INSTANT_LOOKUP_TIMEOUT_MS = 3000;

// ========== 弹窗尺寸 ==========

/** Mini Popup 宽度（px） */
export const POPUP_WIDTH = 340;

/** Mini Popup 最大高度（px） */
export const POPUP_MAX_HEIGHT = 360;

// ========== 默认设置值 ==========

/** 扩展默认设置 */
export const DEFAULT_EXTENSION_SETTINGS = {
  continuousMode: false,
  autoTagging: true,
} as const;

// ========== 批量分析 ==========

/** 批量分析最大并发数 */
export const BATCH_ANALYSIS_CONCURRENCY = 3;

// ========== SM-2 复习算法常量 ==========

/** SM-2 初始 E-Factor */
export const SM2_INITIAL_EF = 2.5;

/** SM-2 最小 E-Factor */
export const SM2_MIN_EF = 1.3;

// ========== Tauri ↔ Extension 直接桥接 ==========

/** Tauri 本地 HTTP 桥接端口（Chrome 扩展 POST 捕获词条到此端口） */
export const TAURI_BRIDGE_PORT = 18920;
