
/**
 * SmartLex API 配置中心
 *
 * 三家 provider：
 *  - glm      (智谱清言) → https://open.bigmodel.cn/api/paas/v4/chat/completions
 *  - deepseek (深度求索) → https://api.deepseek.com/chat/completions
 *  - doubao   (字节豆包) → https://ark.cn-beijing.volces.com/api/v3/responses
 *
 * 用户只需填入自己的 API Key；端点 / 模型名 / 调用格式由本服务内部硬编码处理。
 * API Key 通过 localStorage 单独持久化，不写入 .env，不再走 Vite 环境变量。
 */

export type ProviderId = 'glm' | 'deepseek' | 'doubao';

export interface ProviderProfile {
  id: ProviderId;
  name: string;
  baseUrl: string;
  model: string;
  apiStyle: 'openai-chat' | 'openai-responses';
  docUrl: string;
  description: string;
}

export const PROVIDER_PROFILES: Record<ProviderId, ProviderProfile> = {
  glm: {
    id: 'glm',
    name: '智谱清言 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-5.1',
    apiStyle: 'openai-chat',
    docUrl: 'https://docs.bigmodel.cn/cn/api/introduction',
    description: '智谱清言 GLM-5.1，长上下文与中文能力均衡。',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
    apiStyle: 'openai-chat',
    docUrl: 'https://api-docs.deepseek.com/zh-cn/',
    description: 'DeepSeek V4 Flash，速度快、性价比高。',
  },
  doubao: {
    id: 'doubao',
    name: '字节豆包',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-seed-2-0-pro-260215',
    apiStyle: 'openai-responses',
    docUrl: 'https://www.volcengine.com/docs/82379/1494384?lang=zh',
    description: '豆包大模型 2.0 Pro，通过方舟 Responses API 调用。',
  },
};

const ACTIVE_PROVIDER_KEY = 'smartlex_active_provider';
const API_KEY_PREFIX = 'smartlex_api_key_';

const isProviderId = (v: string | null): v is ProviderId =>
  v === 'glm' || v === 'deepseek' || v === 'doubao';

export const getActiveProvider = (): ProviderId => {
  try {
    const raw = localStorage.getItem(ACTIVE_PROVIDER_KEY);
    if (isProviderId(raw)) return raw;
  } catch {
    // 忽略 localStorage 不可用的环境
  }
  return 'glm';
};

export const setActiveProvider = (id: ProviderId): void => {
  localStorage.setItem(ACTIVE_PROVIDER_KEY, id);
  // 通知同窗口订阅者（设置 / 主面板 / 聊天侧栏）
  window.dispatchEvent(new CustomEvent<ProviderId>('smartlex:provider-changed', { detail: id }));
};

export const getApiKey = (id: ProviderId): string => {
  try {
    return localStorage.getItem(API_KEY_PREFIX + id) || '';
  } catch {
    return '';
  }
};

export const setApiKey = (id: ProviderId, key: string): void => {
  const trimmed = key.trim();
  if (trimmed) {
    localStorage.setItem(API_KEY_PREFIX + id, trimmed);
  } else {
    localStorage.removeItem(API_KEY_PREFIX + id);
  }
  window.dispatchEvent(new CustomEvent<ProviderId>('smartlex:api-key-changed', { detail: id }));
};

export const getActiveApiKey = (): string => {
  const id = getActiveProvider();
  return getApiKey(id);
};

export const hasActiveApiKey = (): boolean => getActiveApiKey().trim().length > 0;

export interface ActiveConfig {
  provider: ProviderProfile;
  apiKey: string;
}

/**
 * 返回当前激活的完整调用配置。若未配置 API Key 则抛错，由调用方决定如何提示用户。
 */
export const getActiveConfig = (): ActiveConfig => {
  const id = getActiveProvider();
  const apiKey = getApiKey(id);
  if (!apiKey) {
    throw new Error('尚未配置当前模型的 API Key，请前往 设置 → AI 模型 配置。');
  }
  return {
    provider: PROVIDER_PROFILES[id],
    apiKey,
  };
};

export const PROVIDER_LIST: ProviderProfile[] = [
  PROVIDER_PROFILES.glm,
  PROVIDER_PROFILES.deepseek,
  PROVIDER_PROFILES.doubao,
];
