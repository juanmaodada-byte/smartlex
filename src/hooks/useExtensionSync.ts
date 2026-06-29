/**
 * SmartLex useExtensionSync — T2.2
 * 自动从 Chrome 扩展拉取 Inbox 数据并合并到 StoreContext
 * Tauri 环境下跳过所有扩展检查 — 数据来自 .lex 文件
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from '../contexts/StoreContext';
import { useToast } from '../contexts/ToastContext';
import { extensionBridge } from '../services/extensionBridge';

export type SyncStatus = 'idle' | 'checking' | 'syncing' | 'success' | 'error' | 'unavailable' | 'tauri';

interface UseExtensionSyncReturn {
  status: SyncStatus;
  lastSyncCount: number;
  sync: () => Promise<void>;
  isExtensionAvailable: boolean;
  isTauri: boolean;
}

const isTauriEnv = () => (window as any).__TAURI_INTERNALS__ !== undefined;

export function useExtensionSync(): UseExtensionSyncReturn {
  const { inbox, addToInbox } = useStore();
  const { showToast } = useToast();

  const tauri = isTauriEnv();

  const [status, setStatus] = useState<SyncStatus>(tauri ? 'tauri' : 'idle');
  const [lastSyncCount, setLastSyncCount] = useState(0);
  const syncedIdsRef = useRef<Set<string>>(new Set());
  const syncRef = useRef<() => Promise<void>>(async () => {});

  const sync = useCallback(async () => {
    if (tauri) return; // Tauri has no extension to sync from — data is in .lex
    setStatus('syncing');

    try {
      const entries = await extensionBridge.fetchInbox();

      if (entries.length === 0) {
        setStatus('success');
        setLastSyncCount(0);
        return;
      }

      let newCount = 0;
      const confirmedIds: string[] = [];

      for (const entry of entries) {
        if (syncedIdsRef.current.has(entry.id)) continue;
        if (inbox.find(e => e.id === entry.id)) continue;

        addToInbox(entry);
        syncedIdsRef.current.add(entry.id);
        confirmedIds.push(entry.id);
        newCount++;
      }

      await extensionBridge.confirmSync(confirmedIds);

      setLastSyncCount(newCount);
      setStatus('success');

      if (newCount > 0) {
        showToast(`已同步 ${newCount} 个新词条`, 'success');
      }
    } catch (err) {
      console.error('[useExtensionSync] Sync failed:', err);
      setStatus('error');
      showToast('同步失败，请检查扩展是否已安装并配置', 'error');
    }
  }, [inbox, addToInbox, showToast, tauri]);

  syncRef.current = sync;

  // 初始化时检查扩展是否可用（Tauri 跳过）
  useEffect(() => {
    if (tauri) return;

    let cancelled = false;

    const check = async () => {
      setStatus('checking');
      const available = await extensionBridge.isInstalled();
      if (cancelled) return;
      setStatus(available ? 'idle' : 'unavailable');
    };

    check();

    const handleSyncRequested = () => {
      console.log('[useExtensionSync] Sync requested by extension popup');
      syncRef.current();
    };
    window.addEventListener('smartlex:extension-sync-requested', handleSyncRequested);

    return () => {
      cancelled = true;
      window.removeEventListener('smartlex:extension-sync-requested', handleSyncRequested);
    };
  }, [tauri]);

  return {
    status,
    lastSyncCount,
    sync,
    isExtensionAvailable: tauri ? false : status !== 'unavailable',
    isTauri: tauri,
  };
}
