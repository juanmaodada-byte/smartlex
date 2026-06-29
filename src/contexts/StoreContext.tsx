import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import type { SemanticAnalysis, CapturedEntry, ReviewCard } from '../types';
import { storageService } from '../services/storageService';
import { useToast } from './ToastContext';
import { useDebounce } from '../hooks/useDebounce';

interface StoreContextType {
  // 现有 — 分析与知识库
  library: SemanticAnalysis[];
  history: SemanticAnalysis[];
  currentAnalysis: SemanticAnalysis | null;
  lastSaved: string | null;
  customFileName: string | null;

  // 🆕 v0.2.0 — 待处理队列 & 复习卡片
  inbox: CapturedEntry[];
  reviewQueue: ReviewCard[];

  // 现有 Actions
  setLibrary: React.Dispatch<React.SetStateAction<SemanticAnalysis[]>>;
  setHistory: React.Dispatch<React.SetStateAction<SemanticAnalysis[]>>;
  setCurrentAnalysis: (analysis: SemanticAnalysis | null) => void;

  addToLibrary: (item: SemanticAnalysis) => void;
  updateAnalysis: (updatedItem: SemanticAnalysis) => void;
  importWorkspace: (file: File) => Promise<void>;
  linkCustomFile: () => Promise<void>;
  clearData: () => void;
  deleteFromLibrary: (id: string) => void;

  // 🆕 v0.2.0 — Inbox Actions
  addToInbox: (entry: CapturedEntry) => void;
  removeFromInbox: (id: string) => void;
  updateInboxEntry: (updatedEntry: CapturedEntry) => void;
  clearInbox: () => void;

  // 🆕 v0.2.0 — Review Actions
  addToReviewQueue: (card: ReviewCard) => void;
  updateReviewCard: (updatedCard: ReviewCard) => void;
  removeFromReviewQueue: (id: string) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { showToast } = useToast();

  // -------- State --------
  const [library, setLibrary] = useState<SemanticAnalysis[]>([]);
  const [history, setHistory] = useState<SemanticAnalysis[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<SemanticAnalysis | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [customFileName, setCustomFileName] = useState<string | null>(null);

  // 🆕 v0.2.0
  const [inbox, setInbox] = useState<CapturedEntry[]>([]);
  const [reviewQueue, setReviewQueue] = useState<ReviewCard[]>([]);

  // -------- Load data on mount (cloud-sync aware) --------
  const unwatchRef = useRef<(() => void) | null>(null);

  const applyLoadedData = useCallback((data: import('../types').WorkspaceData) => {
    setLibrary(data.library || []);
    setHistory(data.history || []);
    setInbox(data.inbox || []);
    setReviewQueue(data.reviewQueue || []);
    setLastSaved(data.lastSynced);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initStorage = async () => {
      try {
        // 1. Try cloud auto-detection (Tauri desktop)
        const cloudResult = await storageService.autoDetectWorkspace();
        if (cloudResult && !cancelled) {
          applyLoadedData(cloudResult.data);
          const name = cloudResult.path.split(/[/\\]/).pop() || null;
          setCustomFileName(name);

          // Start Tauri native file watcher
          unwatchRef.current = await storageService.watchWorkspaceFile(
            cloudResult.path,
            async () => {
              try {
                const freshData = await storageService.loadFromPath(cloudResult.path);
                applyLoadedData(freshData);
                showToast('检测到云端数据更新，已自动同步', 'info');
              } catch (err) {
                console.error('[SmartLex] Failed to reload from cloud sync:', err);
              }
            },
          );
          return;
        }

        // 2. Try restore persisted file handle (Chrome — IndexedDB)
        const reconnected = await storageService.autoReconnectWorkspace();
        if (reconnected && !cancelled) {
          applyLoadedData(reconnected);
          setCustomFileName(storageService.activeHandle?.name || null);

          // Start Chrome polling watcher
          unwatchRef.current = storageService.watchChromeWorkspace(async () => {
            try {
              const freshData = await storageService.load();
              if (freshData) {
                applyLoadedData(freshData);
                showToast('检测到文件更新，已自动同步', 'info');
              }
            } catch (err) {
              console.error('[SmartLex] Failed to reload from Chrome workspace:', err);
            }
          });
          return;
        }

        // 3. Fallback: normal load (localStorage / Tauri AppData)
        const data = await storageService.load();
        if (data && !cancelled) {
          applyLoadedData(data);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load initial data", err);
          showToast("无法加载本地数据", "error");
        }
      }
    };
    initStorage();

    return () => {
      cancelled = true;
      // Cleanup file watcher (Tauri or Chrome)
      if (unwatchRef.current) {
        unwatchRef.current();
        unwatchRef.current = null;
      }
    };
  }, [showToast, applyLoadedData]);

  // -------- Debounced Autosave --------
  const debouncedLibrary = useDebounce(library, 2000);
  const debouncedHistory = useDebounce(history, 2000);
  const debouncedInbox = useDebounce(inbox, 2000);
  const debouncedReviewQueue = useDebounce(reviewQueue, 2000);

  useEffect(() => {
    // Skip initial empty state before data is loaded
    if (
      debouncedLibrary.length === 0 &&
      debouncedHistory.length === 0 &&
      debouncedInbox.length === 0 &&
      debouncedReviewQueue.length === 0 &&
      !lastSaved
    ) {
      return;
    }

    const saveData = async () => {
      try {
        await storageService.save(
          debouncedLibrary,
          debouncedHistory,
          debouncedInbox,
          debouncedReviewQueue,
        );
        setLastSaved(new Date().toISOString());
      } catch (error) {
        console.error("Autosave failed", error);
      }
    };

    saveData();
  }, [debouncedLibrary, debouncedHistory, debouncedInbox, debouncedReviewQueue]);

  // ============ 现有 Actions（不变） ============

  const addToLibrary = useCallback((item: SemanticAnalysis) => {
    const exists = library.find(i => i.id === item.id);
    if (exists) {
      showToast('该项目已在知识库中', 'info');
      return;
    }
    setLibrary(prev => [...prev, item]);
    showToast('已保存到知识库', 'success');
  }, [showToast, library]);

  const updateAnalysis = useCallback((updatedItem: SemanticAnalysis) => {
    setLibrary(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
    setHistory(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
    setCurrentAnalysis(prev => prev && prev.id === updatedItem.id ? updatedItem : prev);
  }, []);

  const linkCustomFile = async () => {
    try {
      const name = await storageService.selectLocalWorkspace();
      if (name) {
        setCustomFileName(name);
        await storageService.save(library, history, inbox, reviewQueue);
        setLastSaved(new Date().toISOString());
        showToast(`已链接到文件: ${name}`, 'success');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const importWorkspace = async (file: File) => {
    try {
      const data = await storageService.importFromFile(file);
      setLibrary(data.library);
      setHistory(data.history);
      setInbox(data.inbox || []);
      setReviewQueue(data.reviewQueue || []);
      showToast('工作区数据恢复成功', 'success');
    } catch (err) {
      showToast('导入失败: ' + (err as Error).message, 'error');
    }
  };

  const deleteFromLibrary = useCallback((id: string) => {
    setLibrary(prev => prev.filter(item => item.id !== id));
    // 延迟 toast 避免跨组件渲染更新
    setTimeout(() => showToast('资产已删除', 'success'), 0);
  }, [showToast]);

  const clearData = useCallback(() => {
    setLibrary([]);
    setHistory([]);
    setInbox([]);
    setReviewQueue([]);
    setCustomFileName(null);
    setCurrentAnalysis(null);
    storageService.clearAllData();
  }, []);

  // ============ 🆕 Inbox Actions ============

  const addToInbox = useCallback((entry: CapturedEntry) => {
    const exists = inbox.find(
      e => e.term === entry.term && e.source.url === entry.source.url
    );
    if (exists) {
      showToast('该词条已在 Inbox 中', 'info');
      return;
    }
    setInbox(prev => [...prev, entry]);
    showToast('已添加到 Inbox', 'success');
  }, [showToast, inbox]);

  const removeFromInbox = useCallback((id: string) => {
    setInbox(prev => prev.filter(e => e.id !== id));
  }, []);

  const updateInboxEntry = useCallback((updatedEntry: CapturedEntry) => {
    setInbox(prev => prev.map(e => e.id === updatedEntry.id ? updatedEntry : e));
  }, []);

  const clearInbox = useCallback(() => {
    setInbox([]);
    showToast('Inbox 已清空', 'info');
  }, [showToast]);

  // ============ 🆕 Review Actions ============

  const addToReviewQueue = useCallback((card: ReviewCard) => {
    const exists = reviewQueue.find(c => c.analysisId === card.analysisId);
    if (exists) {
      showToast('该词条已在复习队列中', 'info');
      return;
    }
    setReviewQueue(prev => [...prev, card]);
  }, [showToast, reviewQueue]);

  const updateReviewCard = useCallback((updatedCard: ReviewCard) => {
    setReviewQueue(prev => prev.map(c => c.id === updatedCard.id ? updatedCard : c));
  }, []);

  const removeFromReviewQueue = useCallback((id: string) => {
    setReviewQueue(prev => prev.filter(c => c.id !== id));
  }, []);

  // ============ Provider ============

  return (
    <StoreContext.Provider value={{
      // 现有
      library,
      history,
      currentAnalysis,
      lastSaved,
      customFileName,
      setLibrary,
      setHistory,
      setCurrentAnalysis,
      addToLibrary,
      updateAnalysis,
      linkCustomFile,
      importWorkspace,
      clearData,
      deleteFromLibrary,
      // 🆕 Inbox
      inbox,
      reviewQueue,
      addToInbox,
      removeFromInbox,
      updateInboxEntry,
      clearInbox,
      // 🆕 Review
      addToReviewQueue,
      updateReviewCard,
      removeFromReviewQueue,
    }}>
      {children}
    </StoreContext.Provider>
  );
};
