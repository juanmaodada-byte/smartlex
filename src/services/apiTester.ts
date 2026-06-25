
/**
 * SmartLex API Key 连接检测
 *
 * 针对每个 provider 发一条最小化请求验证 API Key 是否可用、账户是否已开通对应服务。
 * - glm / deepseek: chat/completions 端点，最小 max_tokens
 * - doubao:        responses 端点，最小 input
 */

import {
  ProviderId,
  PROVIDER_PROFILES,
  getApiKey,
} from './apiConfig';

export interface TestResult {
  ok: boolean;
  message: string;
  latencyMs: number;
  /** 失败时透出 HTTP 状态码或错误类型，便于 UI 区分 401/403/网络错误 */
  status?: number;
}

const buildHeaders = (apiKey: string): HeadersInit => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${apiKey}`,
});

const testOpenAIChat = async (
  profile: typeof PROVIDER_PROFILES.glm,
  apiKey: string
): Promise<TestResult> => {
  const start = Date.now();
  try {
    const res = await fetch(`${profile.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(apiKey),
      body: JSON.stringify({
        model: profile.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        temperature: 0,
      }),
    });
    const latencyMs = Date.now() - start;
    if (res.ok) {
      return { ok: true, message: '连接成功，API Key 可用。', latencyMs, status: res.status };
    }
    const text = await res.text().catch(() => '');
    let detail = text;
    try {
      const json = JSON.parse(text);
      detail = json.error?.message || json.message || text;
    } catch {
      /* keep raw text */
    }
    return {
      ok: false,
      message: `连接失败 (${res.status})：${detail || res.statusText}`,
      latencyMs,
      status: res.status,
    };
  } catch (err: any) {
    return {
      ok: false,
      message: `网络错误：${err?.message || '无法连接到服务'}`,
      latencyMs: Date.now() - start,
    };
  }
};

const testDoubaoResponses = async (
  profile: typeof PROVIDER_PROFILES.doubao,
  apiKey: string
): Promise<TestResult> => {
  const start = Date.now();
  try {
    const res = await fetch(`${profile.baseUrl}/responses`, {
      method: 'POST',
      headers: buildHeaders(apiKey),
      body: JSON.stringify({
        model: profile.model,
        input: 'ping',
        max_output_tokens: 1,
        temperature: 0,
      }),
    });
    const latencyMs = Date.now() - start;
    if (res.ok) {
      return { ok: true, message: '连接成功，API Key 可用。', latencyMs, status: res.status };
    }
    const text = await res.text().catch(() => '');
    let detail = text;
    try {
      const json = JSON.parse(text);
      detail = json.error?.message || json.message || text;
    } catch {
      /* keep raw text */
    }
    return {
      ok: false,
      message: `连接失败 (${res.status})：${detail || res.statusText}`,
      latencyMs,
      status: res.status,
    };
  } catch (err: any) {
    return {
      ok: false,
      message: `网络错误：${err?.message || '无法连接到服务'}`,
      latencyMs: Date.now() - start,
    };
  }
};

export const testProviderConnection = async (
  id: ProviderId,
  currentKey?: string
): Promise<TestResult> => {
  // 优先用传入的输入框当前值，否则从 localStorage 读取已保存的值
  const apiKey = (currentKey ?? getApiKey(id)).trim();
  if (!apiKey) {
    return { ok: false, message: '请先填写 API Key。', latencyMs: 0 };
  }
  const profile = PROVIDER_PROFILES[id];
  if (profile.apiStyle === 'openai-responses') {
    return testDoubaoResponses(profile, apiKey);
  }
  return testOpenAIChat(profile, apiKey);
};
