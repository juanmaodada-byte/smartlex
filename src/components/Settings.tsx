import React, { useState, useEffect, useCallback } from 'react';
import {
  ProviderId,
  PROVIDER_LIST,
  getActiveProvider,
  setActiveProvider,
  getApiKey,
  setApiKey,
} from '../services/apiConfig';
import { testProviderConnection, TestResult } from '../services/apiTester';
import { useToast } from '../contexts/ToastContext';
import { useStore } from '../contexts/StoreContext';

interface ProviderTestState {
  status: 'idle' | 'testing' | 'success' | 'fail';
  result?: TestResult;
}

const Settings: React.FC = () => {
  const { showToast } = useToast();
  const { clearData } = useStore();

  const [activeId, setActiveId] = useState<ProviderId>(getActiveProvider());
  const [keys, setKeys] = useState<Record<ProviderId, string>>({
    glm: getApiKey('glm'),
    deepseek: getApiKey('deepseek'),
    doubao: getApiKey('doubao'),
  });
  const [testState, setTestState] = useState<Record<ProviderId, ProviderTestState>>({
    glm: { status: 'idle' },
    deepseek: { status: 'idle' },
    doubao: { status: 'idle' },
  });
  const [reveal, setReveal] = useState(false);

  // Cross-tab sync
  useEffect(() => {
    const onProviderChanged = (e: Event) => {
      const id = (e as CustomEvent<ProviderId>).detail;
      if (id) setActiveId(id);
    };
    const onKeyChanged = () => {
      setKeys({
        glm: getApiKey('glm'),
        deepseek: getApiKey('deepseek'),
        doubao: getApiKey('doubao'),
      });
    };
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith('smartlex_api_key_')) onKeyChanged();
    };
    window.addEventListener('smartlex:provider-changed', onProviderChanged as EventListener);
    window.addEventListener('smartlex:api-key-changed', onKeyChanged as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('smartlex:provider-changed', onProviderChanged as EventListener);
      window.removeEventListener('smartlex:api-key-changed', onKeyChanged as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const handleSelectProvider = useCallback(
    (id: ProviderId) => {
      setActiveId(id);
      setActiveProvider(id);
      showToast(`已切换至 ${PROVIDER_LIST.find((p) => p.id === id)?.name}`, 'success');
    },
    [showToast]
  );

  const [savedKeys, setSavedKeys] = useState<Record<ProviderId, string>>({
    glm: getApiKey('glm'),
    deepseek: getApiKey('deepseek'),
    doubao: getApiKey('doubao'),
  });

  const handleSaveKey = useCallback(
    (id: ProviderId) => {
      const trimmed = keys[id].trim();
      setApiKey(id, trimmed);
      setSavedKeys((prev) => ({ ...prev, [id]: trimmed }));
      setTestState((prev) => ({ ...prev, [id]: { status: 'idle' } }));
      showToast('API Key 已保存', 'success');
    },
    [keys, showToast]
  );

  const handleTest = useCallback(
    async (id: ProviderId) => {
      setTestState((prev) => ({ ...prev, [id]: { status: 'testing' } }));
      const result = await testProviderConnection(id, keys[id]);
      setTestState((prev) => ({
        ...prev,
        [id]: { status: result.ok ? 'success' : 'fail', result },
      }));
      if (result.ok) {
        showToast(`${PROVIDER_LIST.find((p) => p.id === id)?.name} 连接正常`, 'success');
      } else {
        showToast(result.message, 'error');
      }
    },
    [keys, showToast]
  );

  const handleClearData = async () => {
    if (window.confirm('确定要清除所有本地数据吗？此操作无法撤销。')) {
      try {
        clearData();
        showToast('所有数据已清除', 'success');
      } catch (error) {
        console.error('Failed to clear data:', error);
        showToast('清除数据失败', 'error');
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="px-6 lg:px-8 py-5 bg-card/80 backdrop-blur-sm border-b border-border">
        <h2 className="text-xl font-bold text-foreground tracking-tight">设置</h2>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em] mt-1">
          配置与数据管理
        </p>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-8">
        <div className="max-w-3xl mx-auto space-y-8">

          {/* AI Model Config */}
          <section className="card depth-1">
            <div className="flex items-center gap-3 mb-6">
              <div className="icon-box icon-box-indigo">
                <span className="material-symbols-outlined">psychology</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">AI 模型配置</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  选择模型厂商并填入 API Key
                </p>
              </div>
            </div>

            {/* Provider selection */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PROVIDER_LIST.map((p) => {
                const selected = p.id === activeId;
                const hasKey = keys[p.id].trim().length > 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProvider(p.id)}
                    className={`text-left p-4 rounded-xl border-2 transition-all duration-150 group ${
                      selected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/30 hover:-translate-y-0.5'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-foreground">{p.name}</span>
                      {selected && (
                        <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      {p.description}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        hasKey ? 'bg-success' : 'bg-muted-foreground/30'
                      }`} />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                        {hasKey ? '已配置 Key' : '未配置 Key'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active provider config */}
            {(() => {
              const p = PROVIDER_LIST.find((prov) => prov.id === activeId)!;
              const state = testState[activeId];
              const hasChanged = keys[activeId] !== savedKeys[activeId];
              return (
                <div className="mt-5 p-5 rounded-xl bg-muted/50 border border-border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{p.name}</span>
                      <span className="badge badge-blue text-[9px]">当前使用</span>
                    </div>
                    <a
                      href={p.docUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-semibold text-primary hover:text-primary/80 flex items-center gap-1"
                    >
                      API 文档
                      <span className="material-symbols-outlined text-xs">open_in_new</span>
                    </a>
                  </div>

                  {/* Key input */}
                  <div className="relative">
                    <input
                      type={reveal ? 'text' : 'password'}
                      value={keys[activeId]}
                      onChange={(e) => {
                        setKeys((prev) => ({ ...prev, [activeId]: e.target.value }));
                        setTestState((prev) => ({ ...prev, [activeId]: { status: 'idle' } }));
                      }}
                      placeholder="请输入 API Key"
                      spellCheck={false}
                      autoComplete="off"
                      className="input text-xs font-mono pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setReveal((prev) => !prev)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 size-7 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      title={reveal ? '隐藏' : '显示'}
                    >
                      <span className="material-symbols-outlined text-base">
                        {reveal ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => handleTest(activeId)}
                      disabled={!keys[activeId].trim() || state.status === 'testing'}
                      className="btn btn-secondary text-xs gap-1.5"
                    >
                      {state.status === 'testing' ? (
                        <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                      ) : (
                        <span className="material-symbols-outlined text-sm">network_check</span>
                      )}
                      {state.status === 'testing' ? '检测中' : '测试连接'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveKey(activeId)}
                      disabled={!hasChanged || !keys[activeId].trim()}
                      className="btn btn-primary text-xs gap-1.5"
                    >
                      <span className="material-symbols-outlined text-sm">save</span>
                      保存配置
                    </button>
                  </div>

                  {/* Test result */}
                  {state.status !== 'idle' && state.status !== 'testing' && state.result && (
                    <div className={`mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg text-[11px] ${
                      state.result.ok
                        ? 'bg-success/5 text-success border border-success/10'
                        : 'bg-destructive/5 text-destructive border border-destructive/10'
                    }`}>
                      <span className="material-symbols-outlined text-sm mt-0.5">
                        {state.result.ok ? 'verified' : 'error'}
                      </span>
                      <div className="flex-1">
                        <p className="font-semibold">{state.result.message}</p>
                        <p className="text-[10px] opacity-60 mt-0.5">
                          耗时 {state.result.latencyMs} ms
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <p className="mt-4 text-[10px] text-muted-foreground/60 leading-relaxed">
              API Key 仅保存在本地（localStorage），不会上传到任何服务器。
            </p>
          </section>

          {/* Data Management */}
          <section className="card depth-1">
            <div className="flex items-center gap-3 mb-6">
              <div className="icon-box icon-box-muted">
                <span className="material-symbols-outlined">database</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">数据管理</h3>
                <p className="text-xs text-muted-foreground mt-0.5">管理您的本地知识库数据</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/10 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-destructive">危险区域：清除数据</h4>
                <p className="text-xs text-destructive/60 mt-1">永久删除本地存储的所有数据，无法恢复</p>
              </div>
              <button
                onClick={handleClearData}
                className="btn btn-danger text-xs"
              >
                清除所有数据
              </button>
            </div>
          </section>

          {/* Chrome 扩展配置 */}
          <section className="card depth-1">
            <div className="flex items-center gap-3 mb-6">
              <div className="icon-box icon-box-primary">
                <span className="material-symbols-outlined">extension</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Chrome 扩展</h3>
                <p className="text-xs text-muted-foreground mt-0.5">连接 SmartLex Capture 扩展，同步阅读中收集的词汇</p>
              </div>
            </div>

            <ExtensionConfig />
          </section>

          {/* About */}
          <section className="card depth-1">
            <div className="flex items-center gap-3 mb-6">
              <div className="icon-box icon-box-muted">
                <span className="material-symbols-outlined">info</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">关于 SmartLex</h3>
                <p className="text-xs text-muted-foreground mt-0.5">版本与版权信息</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted">
                <span className="text-sm font-medium text-foreground">当前版本</span>
                <span className="chip chip-sm font-mono">v0.2.0</span>
              </div>

              <div className="p-4 rounded-xl bg-muted text-center">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  SmartLex is designed for deep semantic analysis and personal knowledge management.
                  <br />
                  Built with React 19, Tauri v2, and Tailwind CSS v4.
                </p>
                <p className="text-[10px] text-muted-foreground/40 mt-3 uppercase tracking-[0.15em] font-semibold">
                  &copy; 2026 SmartLex Team
                </p>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

const ExtensionConfig: React.FC = () => {
  const isExtensionSupported = typeof chrome !== 'undefined' && !!chrome.runtime && !(window as any).__TAURI__;

  // Tauri 桌面端：显示不可用提示
  if (!isExtensionSupported) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800/40">
          <span className="text-sm">⚠️</span>
          <p className="text-xs text-warning-700 dark:text-warning-400">
            Chrome 扩展仅在 Chromium 浏览器中可用。<br />
            桌面端请使用浏览器访问 SmartLex 以体验划词捕获功能。
          </p>
        </div>
      </div>
    );
  }

  const [extId, setExtIdLocal] = useState(localStorage.getItem('smartlex_extension_id') || '');
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');

  const testConnection = async () => {
    if (!extId.trim()) return;
    setStatus('checking');
    try {
      const r = await chrome.runtime.sendMessage(extId.trim(), { type: 'PING' });
      setStatus(r?.status === 'OK' ? 'ok' : 'fail');
    } catch {
      setStatus('fail');
    }
  };

  const save = () => {
    if (extId.trim()) {
      localStorage.setItem('smartlex_extension_id', extId.trim());
    } else {
      localStorage.removeItem('smartlex_extension_id');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={extId}
          onChange={e => { setExtIdLocal(e.target.value); setStatus('idle'); }}
          onBlur={save}
          placeholder="输入扩展 ID（chrome://extensions/ 中查看）"
          className="input flex-1 text-sm"
        />
        <button
          onClick={testConnection}
          disabled={!extId.trim() || status === 'checking'}
          className="btn btn-secondary text-xs gap-1"
        >
          {status === 'checking' ? '检测中…' : '测试连接'}
        </button>
      </div>
      {status === 'ok' && <p className="text-xs text-green-600">✅ 扩展已连接</p>}
      {status === 'fail' && <p className="text-xs text-red-500">❌ 无法连接，请检查扩展 ID 和扩展是否已加载</p>}
      <p className="text-[10px] text-muted-foreground">
        打开 chrome://extensions/ → 找到 SmartLex Capture → 复制 ID → 粘贴到上方
      </p>
    </div>
  );
};

export default Settings;
