
// ============================================================
// SmartLex Web App 类型定义
// 共享类型（CaptureSource, CapturedContext, CapturedEntry, ExtensionMessage 等）
//   请从 ../shared/types 导入
// ============================================================

import type { CapturedEntry } from '../shared/types';

// Re-export shared types for convenience — Web App 直接从 types.ts 导入即可
export type { CapturedEntry };

// ========== 视图路由 ==========

export enum View {
  HOME = 0,
  HISTORY = 1,
  LIBRARY = 2,
  SETTINGS = 3,
  ANALYSIS_RESULT = 4,
  INBOX = 5,        // 🆕 v0.2.0 — 待处理词条队列
  REVIEW = 6,       // 🆕 v0.2.0 — 间隔复习面板
  TIMELINE = 7,     // 🆕 v0.2.0 — 时间线浏览视图
}

// ========== 分析相关（现有，不变） ==========

export enum AnalysisType {
  METAPHOR = 'Metaphor',
  IDIOM = 'Idiom',
  WORD = 'Word',
  SLANG = 'Slang',
  TERM = 'Term',
  CHAT = 'Chat'
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface SemanticAnalysis {
  id: string;
  term: string;
  rootForm?: string;
  partOfSpeech: string;
  context: string;
  type: AnalysisType;
  tags: string[];
  semanticCore: {
    en: string;
    cn: string;
    cn_definition?: string;
    contextualMeaning: {
      en: string;
      cn: string;
    };
  };
  pragmatics: {
    tone: string;
    register: string;
    nuance_cn: string;
  };
  mapping?: {
    source: string;
    target: string;
    explanation_cn: string;
  };
  originStory: string;
  synonyms: string[];
  antonyms?: string[];
  collocations: string[];
  usageExamples: {
    category: string;
    en: string;
    cn: string;
  }[];
  impactScore: number;
  timestamp: string;
  groundingSources?: GroundingSource[];
  visualContext?: string;
  meta?: {
    provider: 'glm' | 'deepseek' | 'doubao';
    model: string;
    latencyMs: number;
  };
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

// ========== 批量分析（🆕 v0.2.0） ==========

/** 批量分析状态 */
export interface BatchStatus {
  total: number;
  completed: number;
  failed: number;
  inProgress: boolean;
  errors: Array<{ entryId: string; error: string }>;
}

/** 批量分析回调 */
export interface BatchCallbacks {
  onProgress?: (done: number, total: number) => void;
  onComplete?: () => void;
  onError?: (entryId: string, error: string) => void;
}

// ========== 间隔复习 SM-2（🆕 v0.2.0） ==========

/** 复习评分（SM-2 标准 0-5 评分） */
export type ReviewRating = 0 | 1 | 2 | 3 | 4 | 5;

/** 单次复习记录 */
export interface ReviewRecord {
  date: string;   // ISO 日期
  rating: ReviewRating;
}

/** 复习卡片 */
export interface ReviewCard {
  id: string;
  analysisId: string;           // 关联 SemanticAnalysis.id
  easinessFactor: number;       // EF（初始 2.5）
  interval: number;             // 当前间隔（天）
  repetitions: number;          // 连续正确次数
  nextReviewDate: string;       // ISO 日期，下次复习时间
  lastReviewDate: string;       // ISO 日期，上次复习时间
  reviewHistory: ReviewRecord[];
}

// ========== 存储扩展（🆕 v0.2.0） ==========

/** WorkspaceData 版本号 */
export type WorkspaceVersion = '1.0.0' | '1.1.0' | '1.2.0';

/** 扩展后的 WorkspaceData（v1.2.0） */
export interface WorkspaceData {
  version: WorkspaceVersion;
  library: SemanticAnalysis[];
  history: SemanticAnalysis[];
  inbox: CapturedEntry[];                                    // 🆕
  reviewQueue: ReviewCard[];                                // 🆕
  lastSynced: string;
}
