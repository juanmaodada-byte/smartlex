import React, { useState, useCallback, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import AnalysisStation from './components/AnalysisStation';
import AnalysisResult from './components/AnalysisResult';
import KnowledgeLibrary from './components/Library';
import HistoryList from './components/History';
import ChatSidebar from './components/ChatSidebar';
import Settings from './components/Settings';
import Inbox from './components/Inbox';
import ReviewPanel from './components/ReviewPanel';
import { analyzeTerm, getActiveProviderName } from './aiService';
import { useToast } from './contexts/ToastContext';
import { useStore } from './contexts/StoreContext';
import { getActiveProvider, hasActiveApiKey, getApiKey } from './services/apiConfig';
import { extensionBridge } from './services/extensionBridge';
import { storageService } from './services/storageService';
import { View } from './types';

const App: React.FC = () => {
  const { showToast } = useToast();
  const {
    setHistory,
    setCurrentAnalysis,
    customFileName,
    linkCustomFile,
    currentAnalysis,
    history,
    addToInbox,
  } = useStore();

  const [currentView, setCurrentView] = useState<View>(View.HOME);
  const [previousView, setPreviousView] = useState<View>(View.HOME);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [activeProviderName, setActiveProviderName] = useState(getActiveProviderName());
  const [hasKey, setHasKey] = useState(hasActiveApiKey());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [workspaceLabel, setWorkspaceLabel] = useState(storageService.getWorkspaceLabel());
  const isTauri = !!(window as any).__TAURI_INTERNALS__;

  const handleSyncClick = useCallback(async () => {
    if (isTauri) {
      // Tauri: create cloud workspace in OneDrive (no file picker needed)
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const path: string = await invoke('create_cloud_workspace');
        storageService.cloudWorkspacePath = path;
        setWorkspaceLabel('workspace.lex');
        showToast('☁️ 云同步工作区已就绪', 'success');
        // Trigger save to new cloud path
        linkCustomFile();
      } catch (err) {
        console.error('Failed to create cloud workspace:', err);
        showToast('创建云工作区失败，请检查 OneDrive 是否已安装', 'error');
      }
    } else {
      // Browser: use File System Access API
      linkCustomFile();
    }
  }, [isTauri, linkCustomFile, showToast]);

  const [breadcrumbInfo, setBreadcrumbInfo] = useState({ label: '历史记录', view: View.HISTORY });

  // Initial setup
  useEffect(() => {
    const initNotification = async () => {
      try {
        if (window.__TAURI__) {
          const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
          let permissionGranted = await isPermissionGranted();
          if (!permissionGranted) {
            const permission = await requestPermission();
            permissionGranted = permission === 'granted';
          }
        }
      } catch (error) {
        console.log('Notification not available in browser environment');
      }
    };
    initNotification();

    if (window.innerWidth < 1024) {
      setIsCompactMode(true);
      setSidebarCollapsed(true);
    }
  }, []);

  // Keep workspace label in sync (updates when StoreContext sets customFileName)
  useEffect(() => {
    const label = customFileName || storageService.getWorkspaceLabel();
    setWorkspaceLabel(label);
  }, [customFileName]);

  // 监听 Tauri 本地桥接：Chrome 扩展直接推送捕获词条
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const seenIds = new Set<string>(); // dedup in-memory

    const setup = async () => {
      if (!(window as any).__TAURI_INTERNALS__) return;
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<string>('inbox-captured', (event) => {
          try {
            const entry = JSON.parse(event.payload);
            // Dedup: skip if already received (race condition guard)
            if (seenIds.has(entry.id)) return;
            seenIds.add(entry.id);
            addToInbox(entry);
            showToast(`📥 ${entry.term} 已捕获`, 'success');
          } catch (err) {
            console.error('[SmartLex] Failed to parse bridge capture:', err);
          }
        });
        console.log('[SmartLex] Bridge listener active');
      } catch (err) {
        console.warn('[SmartLex] Bridge listener setup failed:', err);
      }
    };

    setup();
    return () => { if (unlisten) unlisten(); };
  }, [addToInbox, showToast]);

  // Push API config to Tauri bridge so extension can fetch it
  useEffect(() => {
    if (!isTauri) return;
    const push = async () => {
      const provider = getActiveProvider();
      const apiKeys: Record<string, string> = {};
      for (const pid of ['glm', 'deepseek', 'doubao'] as const) {
        const key = getApiKey(pid);
        if (key) apiKeys[pid] = key;
      }
      const config = JSON.stringify({ provider, keys: apiKeys });
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('push_api_config', { json: config });
      } catch (err) {
        console.warn('[SmartLex] Failed to push API config to bridge:', err);
      }
    };
    push();
    window.addEventListener('smartlex:provider-changed', push);
    window.addEventListener('smartlex:api-key-changed', push);
    return () => {
      window.removeEventListener('smartlex:provider-changed', push);
      window.removeEventListener('smartlex:api-key-changed', push);
    };
  }, [isTauri]);

  // 监听 provider / key 变化
  useEffect(() => {
    const refresh = () => {
      setActiveProviderName(getActiveProviderName());
      setHasKey(hasActiveApiKey());
    };
    window.addEventListener('smartlex:provider-changed', refresh);
    window.addEventListener('smartlex:api-key-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('smartlex:provider-changed', refresh);
      window.removeEventListener('smartlex:api-key-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // F0：将 Web App 的 API 配置同步到 Chrome 扩展（即时释义依赖）
  useEffect(() => {
    const syncApiConfig = () => {
      const provider = getActiveProvider();
      const apiKeys: Record<string, string> = {};
      for (const pid of ['glm', 'deepseek', 'doubao'] as const) {
        const key = getApiKey(pid);
        if (key) apiKeys[pid] = key;
      }
      extensionBridge.pushApiConfig(provider, apiKeys);
    };

    // 启动时同步一次
    syncApiConfig();

    // 配置变更时实时同步
    window.addEventListener('smartlex:provider-changed', syncApiConfig);
    window.addEventListener('smartlex:api-key-changed', syncApiConfig);
    return () => {
      window.removeEventListener('smartlex:provider-changed', syncApiConfig);
      window.removeEventListener('smartlex:api-key-changed', syncApiConfig);
    };
  }, []);

  // 首次进入若未配置 API Key，引导去设置页
  useEffect(() => {
    if (!hasKey) {
      setCurrentView(View.SETTINGS);
      showToast('请先在设置中配置当前模型的 API Key', 'info');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureKeyOrRedirect = useCallback((): boolean => {
    if (hasActiveApiKey()) return true;
    showToast('请先在设置中配置 API Key', 'error');
    setCurrentView(View.SETTINGS);
    return false;
  }, [showToast]);

  const handleStartAnalysis = useCallback(async (term: string, context: string, imageBase64?: string) => {
    if (!hasActiveApiKey()) {
      ensureKeyOrRedirect();
      return;
    }
    setIsAnalyzing(true);
    try {
      const result = await analyzeTerm(term, context, imageBase64);
      setHistory(prev => [result, ...prev].slice(0, 100));
      setCurrentAnalysis(result);
      setBreadcrumbInfo({ label: '首页', view: View.HOME });
      setCurrentView(View.ANALYSIS_RESULT);

      try {
        if (window.__TAURI__) {
          const { sendNotification } = await import('@tauri-apps/plugin-notification');
          sendNotification({
            title: '分析完成',
            body: `"${term}" 的深度分析已就绪。`,
          });
        }
      } catch {
        // 浏览器环境无通知能力，忽略
      }
      showToast('深度分析已完成', 'success');
    } catch (error: any) {
      console.error("Analysis failed:", error);
      showToast(error.message || "分析失败，请检查网络连接。", 'error');
    } finally {
      setIsAnalyzing(false);
    }
  }, [ensureKeyOrRedirect, showToast, setHistory, setCurrentAnalysis]);

  const navigateToAnalysis = useCallback((item: any, source: View) => {
    setCurrentAnalysis(item);
    let label = '历史记录';
    if (source === View.HOME) label = '首页';
    else if (source === View.LIBRARY) label = '知识库';
    setBreadcrumbInfo({ label, view: source });
    setCurrentView(View.ANALYSIS_RESULT);
  }, [setCurrentAnalysis]);

  const togglePin = () => {
    setIsPinned(!isPinned);
    showToast(isPinned ? '窗口置顶已取消' : '窗口已置顶', 'info');
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-bg-app dark:bg-warm-950 transition-colors duration-300">

      {/* ═══ 左侧导航栏 ═══ */}
      {!isCompactMode && (
        <Sidebar
          currentView={currentView}
          setView={setCurrentView}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      )}

      {/* ═══ 主内容区 ═══ */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative bg-bg-app dark:bg-warm-950">

        {/* ─── 顶部状态栏 ─── */}
        <header className="h-12 flex items-center justify-between px-5 bg-bg-surface/80 dark:bg-warm-900/80 backdrop-blur-xl border-b border-warm-200/60 dark:border-warm-800/60 shrink-0 z-40">
          <div className="flex items-center gap-3">
            {/* Logo 徽标 */}
            <button
              onClick={() => setCurrentView(View.HOME)}
              className="flex items-center gap-2.5 group"
              title="返回首页"
            >
              <div className="size-8 rounded-lg bg-accent-500 flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200">
                <span className="material-symbols-outlined text-white text-lg">lens_blur</span>
              </div>
              <span className="text-sm font-bold text-warm-800 dark:text-warm-200 tracking-tight hidden sm:block">
                SmartLex
              </span>
            </button>

            {/* 分隔线 */}
            <div className="w-px h-5 bg-warm-200 dark:bg-warm-700 hidden sm:block" />

            {/* AI 状态指示器 */}
            <button
              onClick={() => setCurrentView(View.SETTINGS)}
              className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg hover:bg-warm-100 dark:hover:bg-warm-800 transition-colors group"
              title="点击进入设置"
            >
              <span className={`size-2 rounded-full ring-2 ring-offset-1 transition-colors ${hasKey ? 'bg-success-500 ring-success-500/20' : 'bg-error-500 ring-error-500/20 animate-pulse'}`} />
              <span className="text-xs font-medium text-warm-500 dark:text-warm-400 group-hover:text-warm-700 dark:group-hover:text-warm-200 transition-colors">
                {hasKey ? activeProviderName : '未配置 AI'}
              </span>
            </button>

            {/* 文件同步指示器 */}
            <div
              className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg hover:bg-warm-100 dark:hover:bg-warm-800 transition-colors cursor-pointer group"
              onClick={handleSyncClick}
              title={
                workspaceLabel
                  ? `同步状态: ${workspaceLabel}${storageService.cloudWorkspacePath ? ' (云同步)' : ''}`
                  : isTauri
                    ? '点击在 OneDrive 创建 SmartLex 工作区，实现跨设备同步'
                    : '点击选择 .lex 工作区文件（可放 OneDrive 实现跨端同步）'
              }
            >
              {/* 状态圆点 */}
              {workspaceLabel ? (
                <span className="size-2 rounded-full bg-success-500 ring-2 ring-success-500/20 shrink-0" />
              ) : (
                <span className="size-2 rounded-full bg-amber-400 ring-2 ring-amber-400/20 animate-pulse shrink-0" />
              )}
              {/* 标签 */}
              <span className="text-xs font-medium text-warm-500 dark:text-warm-400 truncate max-w-[160px]">
                {workspaceLabel
                  ? (storageService.cloudWorkspacePath ? '☁️ ' : '📁 ') + workspaceLabel
                  : isTauri
                    ? '☁️ 开启云同步'
                    : '点击同步...'}
              </span>
              {/* 箭头提示 */}
              <span className="material-symbols-outlined text-[14px] text-warm-300 dark:text-warm-600 group-hover:text-warm-500 transition-colors">
                chevron_right
              </span>
            </div>
          </div>

          {/* 右侧操作 */}
          <div className="flex items-center gap-1">
            <button
              onClick={togglePin}
              className={`size-8 flex items-center justify-center rounded-lg transition-all duration-200 ${isPinned ? 'bg-accent-100 dark:bg-accent-900/40 text-accent-600 dark:text-accent-400' : 'text-warm-400 hover:text-warm-700 dark:hover:text-warm-200 hover:bg-warm-100 dark:hover:bg-warm-800'}`}
              title={isPinned ? "取消置顶" : "窗口置顶"}
            >
              <span className="material-symbols-outlined text-lg">{isPinned ? 'push_pin' : 'keep_public'}</span>
            </button>
            <button
              onClick={() => {
                setIsCompactMode(!isCompactMode);
                if (!isCompactMode) setSidebarCollapsed(true);
                else setSidebarCollapsed(false);
              }}
              className="size-8 flex items-center justify-center rounded-lg text-warm-400 hover:text-warm-700 dark:hover:text-warm-200 hover:bg-warm-100 dark:hover:bg-warm-800 transition-all duration-200"
              title={isCompactMode ? "切换标准模式" : "切换紧凑模式"}
            >
              <span className="material-symbols-outlined text-lg">{isCompactMode ? 'fullscreen' : 'fullscreen_exit'}</span>
            </button>
          </div>
        </header>

        {/* ─── 内容区域 ─── */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {currentView === View.HOME && (
            <AnalysisStation onAnalyze={handleStartAnalysis} onOpenHistory={() => setCurrentView(View.HISTORY)} isAnalyzing={isAnalyzing} />
          )}
          {currentView === View.HISTORY && (
            <HistoryList onSelectItem={(item) => navigateToAnalysis(item, View.HISTORY)} onClose={() => setCurrentView(previousView)} />
          )}
          {currentView === View.ANALYSIS_RESULT && (
            <AnalysisResult
              onOpenHistory={() => setCurrentView(View.HISTORY)}
              breadcrumbLabel={breadcrumbInfo.label}
              onBreadcrumbClick={() => setCurrentView(breadcrumbInfo.view)}
            />
          )}
          {currentView === View.LIBRARY && (
            <KnowledgeLibrary
              onSelectItem={(item) => navigateToAnalysis(item, View.LIBRARY)}
              onOpenHistory={() => setCurrentView(View.HISTORY)}
            />
          )}
          {currentView === View.INBOX && (
            <Inbox />
          )}
          {currentView === View.REVIEW && (
            <ReviewPanel />
          )}
          {currentView === View.SETTINGS && (
            <Settings />
          )}
        </div>
      </main>

      {/* ═══ AI 助手面板 ═══ */}
      {!isCompactMode && <ChatSidebar />}
    </div>
  );
};

export default App;
