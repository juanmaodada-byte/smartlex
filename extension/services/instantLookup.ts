/**
 * SmartLex Instant Lookup — F0
 * 即时释义 API 调用（在 Service Worker 中运行）
 *
 * 架构：
 *   Content Script → INSTANT_LOOKUP 消息 → Service Worker → AI API → 返回释义
 *
 * 为保证速度（目标 < 3s），使用短 prompt + 低 max_tokens。
 */

// ============================================================
// 存储 Key（与 web app 的 localStorage key 对齐）
// ============================================================

const STORAGE_KEYS = {
  ACTIVE_PROVIDER: 'smartlex_active_provider',
  API_KEY_PREFIX: 'smartlex_api_key_',
} as const;

type ProviderId = 'glm' | 'deepseek' | 'doubao';

interface ProviderProfile {
  id: ProviderId;
  name: string;
  baseUrl: string;
  model: string;
  apiStyle: 'openai-chat' | 'openai-responses';
}

const PROVIDERS: Record<ProviderId, ProviderProfile> = {
  glm: {
    id: 'glm',
    name: '智谱清言 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-5.1',
    apiStyle: 'openai-chat',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
    apiStyle: 'openai-chat',
  },
  doubao: {
    id: 'doubao',
    name: '字节豆包',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-seed-2-0-pro-260215',
    apiStyle: 'openai-responses',
  },
};

// ============================================================
// 类型
// ============================================================

export interface LookupRequest {
  term: string;
  context: string; // 上下文前后文本
}

export interface LookupResult {
  definitionCn: string;   // 中文释义
  definitionEn: string;   // 英文释义
  contextualMeaning: string; // 在此语境中的含义
}

// ============================================================
// 配置读取
// ============================================================

async function getConfig(): Promise<{ provider: ProviderProfile; apiKey: string } | null> {
  // 1. Try Tauri bridge first (desktop app provides API config)
  try {
    const bridgeUrl = `http://127.0.0.1:${TAURI_BRIDGE_PORT}/config`;
    const res = await fetch(bridgeUrl, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const config = await res.json();
      const activeId: ProviderId = config.provider === 'deepseek' ? 'deepseek'
        : config.provider === 'doubao' ? 'doubao' : 'glm';
      const apiKey = (config.keys?.[activeId] || '').trim();
      if (apiKey) {
        // Also cache to chrome.storage so subsequent lookups are instant
        await chrome.storage.local.set({
          [STORAGE_KEYS.ACTIVE_PROVIDER]: activeId,
          [STORAGE_KEYS.API_KEY_PREFIX + activeId]: apiKey,
        });
        return { provider: PROVIDERS[activeId], apiKey };
      }
    }
  } catch { /* bridge not available — fall through */ }

  // 2. Fallback: chrome.storage.local (synced by Chrome Web App)
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.ACTIVE_PROVIDER,
    STORAGE_KEYS.API_KEY_PREFIX + 'glm',
    STORAGE_KEYS.API_KEY_PREFIX + 'deepseek',
    STORAGE_KEYS.API_KEY_PREFIX + 'doubao',
  ]);

  const activeId: ProviderId =
    data[STORAGE_KEYS.ACTIVE_PROVIDER] === 'deepseek' ? 'deepseek'
    : data[STORAGE_KEYS.ACTIVE_PROVIDER] === 'doubao' ? 'doubao'
    : 'glm';

  const provider = PROVIDERS[activeId];
  const apiKey = (data[STORAGE_KEYS.API_KEY_PREFIX + activeId] || '').trim();

  if (!apiKey) return null;
  return { provider, apiKey };
}

/** Port matching the Tauri local bridge (must match Rust BRIDGE_PORT) */
const TAURI_BRIDGE_PORT = 18920;

// ============================================================
// API 调用
// ============================================================

const TIMEOUT_MS = 8000; // 8s — 部分 provider 首次请求冷启动较慢

async function callOpenAIChat(
  provider: ProviderProfile,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('Empty response');
    }
    return content.trim();
  } finally {
    clearTimeout(timer);
  }
}

async function callDoubaoResponses(
  provider: ProviderProfile,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${provider.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_output_tokens: 200,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const output = data?.output;
    if (!Array.isArray(output)) throw new Error('Unexpected response format');

    for (let i = output.length - 1; i >= 0; i--) {
      const contentArr = output[i]?.content;
      if (Array.isArray(contentArr)) {
        for (const c of contentArr) {
          if (typeof c?.text === 'string' && c.text.trim()) return c.text.trim();
        }
      }
    }
    throw new Error('No text in response');
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
// 公开 API
// ============================================================

/**
 * 执行即时释义查找。
 * 返回 null 表示未配置 API Key 或查找失败。
 */
export async function instantLookup(req: LookupRequest): Promise<LookupResult | null> {
  const config = await getConfig();
  if (!config) {
    console.log('[SmartLex Lookup] No API key configured');
    return null;
  }

  const { provider, apiKey } = config;

  console.log(`[SmartLex Lookup] Requesting "${req.term}" via ${provider.name} (${provider.model})...`);

  const systemPrompt = `You are a concise dictionary. Return ONLY the definition in this exact format (no markdown, no extra text):

CN: <brief Chinese definition, 10-20 chars>
EN: <brief English definition, one line>
CTX: <what this term means in the given context, one short sentence in English>`;

  const userPrompt = req.context
    ? `Define: "${req.term}"\nContext: "${req.context}"`
    : `Define: "${req.term}"`;

  try {
    const raw = provider.apiStyle === 'openai-responses'
      ? await callDoubaoResponses(provider, apiKey, systemPrompt, userPrompt)
      : await callOpenAIChat(provider, apiKey, systemPrompt, userPrompt);

    return parseLookupResponse(raw, req.term);
  } catch (err) {
    console.warn('[SmartLex Lookup] API call failed:', err);
    return null;
  }
}

// ============================================================
// 响应解析
// ============================================================

function parseLookupResponse(raw: string, term: string): LookupResult {
  const cnMatch = raw.match(/CN:\s*(.+)/i);
  const enMatch = raw.match(/EN:\s*(.+)/i);
  const ctxMatch = raw.match(/CTX:\s*(.+)/i);

  return {
    definitionCn: cnMatch?.[1]?.trim() || `"${term}" 的释义`,
    definitionEn: enMatch?.[1]?.trim() || `Definition of "${term}"`,
    contextualMeaning: ctxMatch?.[1]?.trim() || `"${term}" in this context`,
  };
}
