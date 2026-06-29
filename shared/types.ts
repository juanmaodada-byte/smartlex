// ============================================================
// SmartLex 共享类型定义
// 用途：Chrome 扩展 与 Web App 共享的类型
// 两端直接 import 此文件，保持类型一致性
// ============================================================

// ========== 捕获来源 ==========

/** 捕获来源信息 */
export interface CaptureSource {
  url: string; // 页面完整 URL
  title: string; // 页面标题
  favicon?: string; // 网站图标 URL
}

// ========== 上下文文本 ==========

/** 上下文文本 */
export interface CapturedContext {
  before: string; // 目标词前的句子（1-2 句）
  target: string; // 目标词本身（用户选中的文本）
  after: string; // 目标词后的句子（1-2 句）
}

// ========== 待处理词条 ==========

/** 待处理词条（Inbox 中的数据） */
export interface CapturedEntry {
  id: string; // UUID
  term: string; // 目标词/短语
  context: CapturedContext; // 上下文
  source: CaptureSource; // 来源信息
  tags: string[]; // 用户手动标签
  capturedAt: string; // ISO 捕获时间
  status: 'pending' | 'analyzing' | 'done' | 'archived';
  analysisId?: string; // 分析完成后关联的 SemanticAnalysis.id
}

// ========== 扩展通信协议 ==========

/** 扩展与 Web App 的消息协议 */
export type ExtensionMessage =
  | { type: 'PING' }
  | { type: 'GET_INBOX' }
  | { type: 'SYNC_INBOX'; payload: CapturedEntry[] }
  | { type: 'CONFIRM_SYNC'; payload: string[] } // 已同步的 entry IDs
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_BADGE'; payload: number };

// ========== 扩展设置 ==========

/** 扩展本地设置 */
export interface ExtensionSettings {
  continuousMode: boolean; // 连续收集模式（收藏后弹窗不消失）
  autoTagging: boolean; // 是否启用自动标签
}

// 常量（存储 Key、扩展 ID、消息类型等）统一从 shared/constants.ts 导入
