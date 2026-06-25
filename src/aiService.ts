
/**
 * SmartLex AI 服务层
 *
 * 运行时根据用户在 设置 → AI 模型 中选择的 provider 动态拼装请求。
 * 不再依赖 .env 注入的默认 Key / Endpoint，所有信息来自 localStorage + apiConfig。
 *
 * 三家 provider 的请求/响应差异：
 *  - glm / deepseek：标准 OpenAI Chat Completions 协议
 *      POST {baseUrl}/chat/completions
 *      body: { model, messages, temperature, max_tokens, ... }
 *      响应: data.choices[0].message.content
 *  - doubao：方舟 Responses API
 *      POST {baseUrl}/responses
 *      body: { model, input: string | messages[], ... }
 *      响应: data.output[last].content[0].text
 */

import { AnalysisType, SemanticAnalysis } from './types';
import {
  ProviderId,
  PROVIDER_PROFILES,
  getActiveConfig,
  getActiveProvider,
} from './services/apiConfig';

// -------------------- 通用工具 --------------------

interface ChatRequestOptions {
  systemPrompt?: string;
  messages: { role: 'system' | 'user' | 'assistant' | 'tool'; content: string }[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

const RESPONSE_OK_BUDGET_MS = 60_000;

const buildHeaders = (apiKey: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${apiKey}`,
});

/**
 * 发送一次 Chat 风格请求（glm / deepseek）。
 */
const callOpenAIChat = async (
  profile: typeof PROVIDER_PROFILES.glm,
  apiKey: string,
  opts: ChatRequestOptions
): Promise<string> => {
  const messages = opts.systemPrompt
    ? [{ role: 'system' as const, content: opts.systemPrompt }, ...opts.messages]
    : opts.messages;

  const body: Record<string, unknown> = {
    model: profile.model,
    messages,
    temperature: opts.temperature ?? 0.7,
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.jsonMode) body.response_format = { type: 'json_object' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESPONSE_OK_BUDGET_MS);
  let res: Response;
  try {
    res = await fetch(`${profile.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(apiKey),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(formatHttpError(profile, res.status, errText));
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.length === 0) {
    throw new Error(`${profile.name} 响应为空，请稍后重试。`);
  }
  return content;
};

/**
 * 发送一次方舟 Responses API 请求（doubao）。
 * Responses 端点把 messages 包到 input 字段，响应在 output[].content[].text。
 */
const callOpenAIResponses = async (
  profile: typeof PROVIDER_PROFILES.doubao,
  apiKey: string,
  opts: ChatRequestOptions
): Promise<string> => {
  const input = opts.systemPrompt
    ? [
        { role: 'system' as const, content: opts.systemPrompt },
        ...opts.messages.map((m) => ({ role: m.role, content: m.content })),
      ]
    : opts.messages.map((m) => ({ role: m.role, content: m.content }));

  const body: Record<string, unknown> = {
    model: profile.model,
    input,
    temperature: opts.temperature ?? 0.7,
  };
  if (opts.maxTokens) body.max_output_tokens = opts.maxTokens;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESPONSE_OK_BUDGET_MS);
  let res: Response;
  try {
    res = await fetch(`${profile.baseUrl}/responses`, {
      method: 'POST',
      headers: buildHeaders(apiKey),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(formatHttpError(profile, res.status, errText));
  }
  const data = await res.json();
  const output = data?.output;
  if (!Array.isArray(output) || output.length === 0) {
    throw new Error(`${profile.name} 响应为空，请稍后重试。`);
  }
  // 兼容多种 output 形态：取最后一个 message 节点的 text
  for (let i = output.length - 1; i >= 0; i -= 1) {
    const item = output[i];
    const contentArr = item?.content;
    if (Array.isArray(contentArr)) {
      for (const c of contentArr) {
        if (typeof c?.text === 'string' && c.text.length > 0) return c.text;
      }
    }
  }
  throw new Error(`${profile.name} 响应格式异常，未找到文本输出。`);
};

const formatHttpError = (
  profile: typeof PROVIDER_PROFILES.glm,
  status: number,
  raw: string
): string => {
  let detail = raw;
  try {
    const json = JSON.parse(raw);
    detail = json?.error?.message || json?.message || raw;
  } catch {
    /* keep raw */
  }
  if (status === 401) return `${profile.name} 鉴权失败 (401)：API Key 无效或已过期。`;
  if (status === 403) return `${profile.name} 权限不足 (403)：${detail || '请检查 API Key 是否拥有该模型权限。'}`;
  if (status === 404) return `${profile.name} 接口未找到 (404)：${detail || '模型或端点不存在。'}`;
  if (status === 429) return `${profile.name} 请求过于频繁 (429)：${detail || '请稍后重试。'}`;
  return `${profile.name} 请求失败 (${status})：${detail || '请稍后重试。'}`;
};

const callProviderChat = async (opts: ChatRequestOptions): Promise<string> => {
  const { provider, apiKey } = getActiveConfig();
  if (provider.apiStyle === 'openai-responses') {
    return callOpenAIResponses(provider, apiKey, opts);
  }
  return callOpenAIChat(provider, apiKey, opts);
};

const callProviderChatJson = async (opts: ChatRequestOptions): Promise<string> => {
  const { provider, apiKey } = getActiveConfig();
  if (provider.apiStyle === 'openai-responses') {
    // Responses API 没有 response_format，统一在 system 提示中要求 JSON
    return callOpenAIResponses(provider, apiKey, opts);
  }
  return callOpenAIChat(provider, apiKey, { ...opts, jsonMode: true });
};

// -------------------- 业务函数 --------------------

const detectIntent = (message: string) => {
  const isEnglishPhrase = /^[a-zA-Z\s\-']+$/.test(message.trim()) && message.split(' ').length <= 5;
  const isEnglishQuery = /[a-zA-Z]+/.test(message);
  const wantsExamples = /造句|例子|例句|example|sentence|sentences/.test(message);
  const wantsTranslation = /翻译|意思|meaning|define|解释/.test(message);
  let intent = 'general_chat';
  if (wantsExamples) intent = 'example_request';
  else if (wantsTranslation) intent = 'translation_request';
  return {
    intent,
    language: isEnglishPhrase ? 'en' : isEnglishQuery ? 'mixed' : 'zh',
    wantsExamples,
  };
};

export async function analyzeTerm(
  term: string,
  context: string = '',
  _imageBase64?: string
): Promise<SemanticAnalysis> {
  const startTime = Date.now();
  const { provider } = getActiveConfig();

  const systemPrompt = `You are an expert linguistic analyst. Analyze the term deeply.
  Return ONLY valid JSON matching:
  {
    "id": "uuid",
    "term": "term",
    "rootForm": "root",
    "partOfSpeech": "pos",
    "context": "ctx",
    "type": "Word" | "Idiom" | "Metaphor" | "Slang" | "Term",
    "tags": ["Generate 1-2 BROAD SECTOR/FIELD tags ONLY (e.g., Business, Technology, Finance, Medicine, Law). ABSOLUTELY NO descriptive phrases or specific topics (e.g., 'AI Pitfall Analysis')."],
    "semanticCore": { "en": "def", "cn": "def", "contextualMeaning": { "en": "...", "cn": "..." } },
    "pragmatics": { "tone": "...", "register": "...", "nuance_cn": "..." },
    "originStory": "...",
    "synonyms": ["..."],
    "collocations": ["..."],
    "usageExamples": [{ "category": "...", "en": "...", "cn": "..." }],
    "impactScore": 1-10
  }`;

  const userPrompt = context
    ? `Analyze "${term}" in this context: "${context}"`
    : `Analyze "${term}"`;

  let raw: string;
  try {
    raw = await callProviderChatJson({
      messages: [{ role: 'user', content: userPrompt }],
      systemPrompt,
      temperature: 0.5,
      maxTokens: 2000,
    });
  } catch (err) {
    console.error('Analysis request failed:', err);
    throw err;
  }

  const cleanContent = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    const analysis = JSON.parse(cleanContent) as SemanticAnalysis;
    analysis.timestamp = new Date().toISOString();
    analysis.meta = {
      provider: provider.id,
      model: provider.model,
      latencyMs: Date.now() - startTime,
    };
    if (!analysis.id) analysis.id = crypto.randomUUID();
    return analysis;
  } catch (jsonError) {
    console.error('JSON parsing failed:', jsonError, '\nRaw content:', raw);
    return {
      id: crypto.randomUUID(),
      term,
      rootForm: term,
      partOfSpeech: 'Unknown',
      context,
      type: AnalysisType.WORD,
      tags: [],
      semanticCore: { en: 'Analysis failed', cn: '分析失败', contextualMeaning: { en: '', cn: '' } },
      pragmatics: { tone: '', register: '', nuance_cn: '' },
      originStory: '',
      synonyms: [],
      collocations: [],
      usageExamples: [],
      impactScore: 0,
      timestamp: new Date().toISOString(),
      meta: {
        provider: provider.id,
        model: provider.model,
        latencyMs: Date.now() - startTime,
      },
    };
  }
}

export async function generateMoreExamples(
  term: string,
  context: string
): Promise<{ category: string; en: string; cn: string }[]> {
  const systemPrompt = `You are an expert linguist. Generate 3-5 diverse usage examples for the term.
    Return ONLY a valid JSON array of objects:
    [
      { "category": "Daily/Business/Academic/etc", "en": "English sentence", "cn": "Chinese translation" }
    ]`;

  const userPrompt = `Generate more examples for "${term}" in context: "${context}"`;

  const raw = await callProviderChatJson({
    messages: [{ role: 'user', content: userPrompt }],
    systemPrompt,
    temperature: 0.8,
    maxTokens: 1200,
  });

  const cleanContent = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleanContent);
}

export async function chatWithAI(
  message: string,
  currentAnalysis?: SemanticAnalysis,
  chatHistory?: { role: string; text: string }[]
): Promise<string> {
  getActiveConfig(); // 提前校验 Key
  const intentInfo = detectIntent(message);

  let systemPrompt = `你是 SmartLex AI，一位友好、专业的语言助手。

角色设定：
- 性格：热情、耐心、善于交流，像一位知识渊博的语言老师或朋友
- 专业领域：语言学、词汇学、语用学、文化背景
- 交互风格：对话式、口语化，避免生硬的学术术语堆砌

当前分析上下文：
${currentAnalysis ? `正在分析的词汇/短语：${currentAnalysis.term || '未知'}
${currentAnalysis.semanticCore?.en ? `英文含义：${currentAnalysis.semanticCore.en}` : ''}
${currentAnalysis.semanticCore?.cn ? `中文含义：${currentAnalysis.semanticCore.cn}` : ''}
${currentAnalysis.originStory ? `起源故事：${currentAnalysis.originStory}` : ''}
${currentAnalysis.pragmatics?.tone ? `语气：${currentAnalysis.pragmatics.tone}` : ''}
${currentAnalysis.pragmatics?.register ? `语域：${currentAnalysis.pragmatics.register}` : ''}` : '暂无分析上下文'}

回复规则：
1. 当用户输入英文单词或短语时，默认提供英文例句和解释
2. 当用户输入中文时，默认使用中文回复
3. 结合用户输入的语言和上下文，智能判断回复语言
4. 保持对话的连贯性，记住之前的请求和对话历史
5. 对于英文短语，优先提供英文例句和用法说明
6. 可以适当使用表情符号增加亲和力，但不要过度
7. 回答要简洁明了，避免冗长，但要足够详细和有帮助
8. 不要使用Markdown格式，保持纯文本对话
9. 回复长度控制在100-300字之间（视问题复杂程度调整）
10. 记住之前的对话内容，保持对话的连贯性`;

  if (intentInfo.wantsExamples && intentInfo.language === 'en') {
    systemPrompt += `\n\n用户请求用英文短语造句，请提供自然的英文例句和用法说明。`;
  } else if (intentInfo.wantsExamples && intentInfo.language === 'zh') {
    systemPrompt += `\n\n用户请求用中文短语造句，请提供自然的中文例句。`;
  } else if (intentInfo.language === 'en') {
    systemPrompt += `\n\n用户输入的是英文内容，请用英文回复。`;
  }

  const messages = [
    ...(chatHistory || []).map((m) => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.text,
    })),
    { role: 'user' as const, content: message },
  ];

  const text = await callProviderChat({
    systemPrompt,
    messages,
    temperature: 0.85,
    maxTokens: 500,
  });
  return text || '抱歉，我现在有点忙，请稍后再试~ 😊';
}

/** 工具：获取当前激活 provider 的展示名（用于 UI 展示） */
export const getActiveProviderName = (): string => {
  const id: ProviderId = getActiveProvider();
  return PROVIDER_PROFILES[id].name;
};

export { PROVIDER_PROFILES };
