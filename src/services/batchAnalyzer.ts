/**
 * SmartLex BatchAnalyzer — T2.5
 * 受控并发批量分析队列 + 轻量/深度双模式
 */

import type { CapturedEntry } from '../../shared/types';
import type { SemanticAnalysis, BatchStatus } from '../types';
import { analyzeTerm } from '../aiService';
import { getActiveConfig } from './apiConfig';

export type AnalysisMode = 'light' | 'deep';

export interface BatchCallbacks {
  onProgress?: (status: BatchStatus) => void;
  onEntryComplete?: (entryId: string, result: SemanticAnalysis) => void;
  onEntryError?: (entryId: string, error: string) => void;
  onComplete?: (results: Map<string, SemanticAnalysis>) => void;
}

export class BatchAnalyzer {
  private queue: CapturedEntry[] = [];
  private concurrency: number;
  private running = 0;
  private results = new Map<string, SemanticAnalysis>();
  private status: BatchStatus;
  private callbacks: BatchCallbacks = {};
  private aborted = false;

  constructor(concurrency = 3) {
    this.concurrency = concurrency;
    this.status = { total: 0, completed: 0, failed: 0, inProgress: false, errors: [] };
  }

  /** 开始批量分析 */
  async analyzeBatch(
    entries: CapturedEntry[],
    mode: AnalysisMode,
    callbacks: BatchCallbacks,
  ): Promise<Map<string, SemanticAnalysis>> {
    this.queue = [...entries];
    this.results = new Map();
    this.callbacks = callbacks;
    this.aborted = false;

    this.status = {
      total: entries.length,
      completed: 0,
      failed: 0,
      inProgress: true,
      errors: [],
    };

    this.callbacks.onProgress?.(this.status);

    // 启动并发 worker
    const workers = Array.from({ length: Math.min(this.concurrency, entries.length) }, () =>
      this.worker(mode),
    );

    await Promise.all(workers);

    this.status.inProgress = false;
    this.callbacks.onProgress?.(this.status);
    this.callbacks.onComplete?.(this.results);

    return this.results;
  }

  /** 取消所有进行中的请求 */
  cancel(): void {
    this.aborted = true;
    this.status.inProgress = false;
  }

  // ── 内部 worker ──

  private async worker(mode: AnalysisMode): Promise<void> {
    while (this.queue.length > 0 && !this.aborted) {
      const entry = this.queue.shift();
      if (!entry) break;

      this.running++;
      try {
        const result = await this.analyze(entry, mode);
        if (!this.aborted) {
          this.results.set(entry.id, result);
          this.status.completed++;
          this.callbacks.onEntryComplete?.(entry.id, result);
        }
      } catch (err: any) {
        if (!this.aborted) {
          this.status.failed++;
          const msg = err?.message || String(err);
          this.status.errors.push({ entryId: entry.id, error: msg });
          this.callbacks.onEntryError?.(entry.id, msg);
        }
      } finally {
        this.running--;
        this.callbacks.onProgress?.(this.status);
      }
    }
  }

  /** 单个词条分析 */
  private async analyze(
    entry: CapturedEntry,
    mode: AnalysisMode,
  ): Promise<SemanticAnalysis> {
    const context = entry.context.before
      ? `${entry.context.before} ${entry.context.target} ${entry.context.after}`
      : '';

    if (mode === 'deep') {
      // 复用现有深度分析
      return analyzeTerm(entry.term, context);
    }

    // 轻量分析：调用简化的 AI prompt
    return lightAnalyzeTerm(entry.term, context);
  }
}

// ============================================================
// 轻量分析
// ============================================================

const LIGHT_SYSTEM_PROMPT = `You are a linguist. Analyze the term briefly and concisely.
Return ONLY valid JSON:
{
  "term": "the term",
  "partOfSpeech": "noun/verb/adjective/etc",
  "type": "Word" | "Idiom" | "Metaphor" | "Slang" | "Term",
  "tags": ["1-2 broad tags like Business, Technology"],
  "semanticCore": {
    "en": "concise English definition (1 sentence)",
    "cn": "对应的中文释义",
    "contextualMeaning": {
      "en": "meaning in the given context",
      "cn": "语境中的意思"
    }
  },
  "usageExamples": [
    { "category": "General", "en": "example sentence", "cn": "中文翻译" }
  ],
  "originStory": "brief etymology in 1 sentence",
  "synonyms": ["1-2 synonyms"],
  "collocations": ["1-2 common collocations"],
  "pragmatics": { "tone": "neutral/formal/informal", "register": "standard/academic/literary", "nuance_cn": "简要语气说明" },
  "impactScore": 1-10
}

Return exactly 1-2 usage examples. Keep originStory under 100 chars.`;

async function lightAnalyzeTerm(term: string, context: string): Promise<SemanticAnalysis> {
  const { provider } = getActiveConfig();
  const apiKey = localStorage.getItem(`smartlex_api_key_${provider.id}`) || '';

  if (!apiKey) {
    throw new Error('未配置 API Key');
  }

  const userPrompt = context
    ? `Analyze "${term}" in this context: "${context}"`
    : `Analyze "${term}"`;

  const body: Record<string, unknown> = {
    model: provider.model,
    messages: [
      { role: 'system', content: LIGHT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 600,
  };

  const apiUrl = provider.id === 'doubao' ? `${provider.baseUrl}/responses` : `${provider.baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`AI API returned ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('AI response empty');
  }

  // 清理 markdown 代码块包装
  const json = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(json);

  // 补全必要字段
  return {
    id: crypto.randomUUID(),
    term,
    partOfSpeech: parsed.partOfSpeech || 'unknown',
    context,
    type: parsed.type || 'Word',
    tags: parsed.tags || [],
    semanticCore: parsed.semanticCore || { en: '', cn: '', contextualMeaning: { en: '', cn: '' } },
    pragmatics: parsed.pragmatics || { tone: 'neutral', register: 'standard', nuance_cn: '' },
    originStory: parsed.originStory || '',
    synonyms: parsed.synonyms || [],
    collocations: parsed.collocations || [],
    usageExamples: (parsed.usageExamples || []).slice(0, 2),
    impactScore: parsed.impactScore || 5,
    timestamp: new Date().toISOString(),
    meta: {
      provider: provider.id,
      model: provider.model,
      latencyMs: 0,
    },
  };
}
