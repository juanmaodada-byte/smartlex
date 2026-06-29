
import type { SemanticAnalysis, CapturedEntry, ReviewCard, WorkspaceData, WorkspaceVersion } from '../types';

const STORAGE_KEY = 'smartlex_workspace';
const HANDLE_DB = 'smartlex-handles';
const HANDLE_STORE = 'file-handles';
const HANDLE_IDB_KEY = 'workspace-handle';

/** 当前数据格式版本号 */
const CURRENT_VERSION: WorkspaceVersion = '1.2.0';

// ═══ IndexedDB — FileSystemHandle persistence ═══

function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(HANDLE_DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(HANDLE_STORE); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function persistHandleToIDB(handle: FileSystemFileHandle): Promise<void> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE, 'readwrite');
      tx.objectStore(HANDLE_STORE).put(handle, HANDLE_IDB_KEY);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch { /* IndexedDB unavailable (e.g. private mode) — silent degrade */ }
}

async function restoreHandleFromIDB(): Promise<FileSystemFileHandle | null> {
  try {
    const db = await openHandleDB();
    return new Promise((resolve) => {
      const tx = db.transaction(HANDLE_STORE, 'readonly');
      const req = tx.objectStore(HANDLE_STORE).get(HANDLE_IDB_KEY);
      req.onsuccess = async () => {
        db.close();
        const handle = req.result as FileSystemFileHandle | undefined;
        if (!handle) return resolve(null);
        // Re-check permission; re-prompt if needed
        try {
          let state = await handle.queryPermission({ mode: 'readwrite' });
          if (state !== 'granted') {
            state = await handle.requestPermission({ mode: 'readwrite' });
          }
          resolve(state === 'granted' ? handle : null);
        } catch { resolve(null); }
      };
      req.onerror = () => { db.close(); resolve(null); };
    });
  } catch { return null; }
}

// File System Access API Types
interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
  isSameEntry(other: FileSystemHandle): Promise<boolean>;
}

interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  getFile(): Promise<File>;
  createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>;
  queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: string | BufferSource | Blob): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: {
    description?: string;
    accept: Record<string, string[]>;
  }[];
  excludeAcceptAllOption?: boolean;
}

// Extend Window interface locally
declare global {
  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
    __TAURI_INTERNALS__?: any;
  }
}

// Detection for environments
const isTauri = () => window.__TAURI_INTERNALS__ !== undefined;
const isFileSystemApiSupported = () => 'showSaveFilePicker' in window;

/**
 * 数据迁移：将旧版本数据补齐为新版本格式。
 * - v1.0.0 / v1.1.0 缺少 inbox 和 reviewQueue → 自动填充空数组
 */
function migrate(data: Record<string, any>): WorkspaceData {
  const version = (data.version || '1.0.0') as WorkspaceVersion;
  return {
    version: CURRENT_VERSION,
    library: Array.isArray(data.library) ? data.library : [],
    history: Array.isArray(data.history) ? data.history : [],
    inbox: Array.isArray(data.inbox) ? data.inbox : [],
    reviewQueue: Array.isArray(data.reviewQueue) ? data.reviewQueue : [],
    lastSynced: data.lastSynced || '',
  };
}

export const storageService = {
  // Store the active file handle in memory
  activeHandle: null as FileSystemFileHandle | null,

  /** Tauri cloud-sync workspace path (set by autoDetectWorkspace) */
  cloudWorkspacePath: null as string | null,

  /** Timestamp of last save — used to suppress self-triggered watch events */
  _lastSaveTime: 0,
  /** File.lastModified after our last save — used to detect external changes in Chrome */
  _lastSaveFileModified: 0,
  /** Active watcher cleanup ref (Chrome polling / Tauri event) */
  _unwatch: null as (() => void) | null,

  /**
   * Let the user pick a specific file on their computer to act as the live database.
   */
  async selectLocalWorkspace(): Promise<string | null> {
    if (!isFileSystemApiSupported()) {
      throw new Error('Your browser does not support choosing local folders. Please use a Chromium-based browser (Chrome/Edge).');
    }

    try {
      // @ts-ignore - showSaveFilePicker is not standard yet
      const handle = await window.showSaveFilePicker({
        suggestedName: 'my_smartlex_workspace.lex',
        types: [{
          description: 'SmartLex Workspace File',
          accept: { 'application/json': ['.lex'] },
        }],
      });

      this.activeHandle = handle;
      persistHandleToIDB(handle); // survive page reload
      return handle.name;
    } catch (err: any) {
      if (err.name === 'AbortError') return null;
      throw err;
    }
  },

  /**
   * Save all data.
   * Priority: 1. User Selected File, 2. Tauri AppData, 3. LocalStorage
   */
  async save(
    library: SemanticAnalysis[],
    history: SemanticAnalysis[],
    inbox: CapturedEntry[] = [],
    reviewQueue: ReviewCard[] = [],
  ) {
    const data: WorkspaceData = {
      version: CURRENT_VERSION,
      library,
      history,
      inbox,
      reviewQueue,
      lastSynced: new Date().toISOString(),
    };

    const jsonString = JSON.stringify(data, null, 2);

    // 1. Save to User Selected File (Browser API)
    if (this.activeHandle) {
      try {
        const options = { mode: 'readwrite' as const };
        if (await this.activeHandle.queryPermission(options) !== 'granted') {
          console.warn('File permission not granted');
        } else {
          const writable = await this.activeHandle.createWritable();
          await writable.write(jsonString);
          await writable.close();
          // Record lastModified so Chrome poller won't treat our own write as external
          const file = await this.activeHandle.getFile();
          this._lastSaveFileModified = file.lastModified;
          console.log('Saved to user-selected file:', this.activeHandle.name);
        }
      } catch (err) {
        console.error('Failed to write to selected file:', err);
      }
    }

    // 2. Save to LocalStorage (Always as cache)
    localStorage.setItem(STORAGE_KEY, jsonString);

    // 3. If Tauri, save to fixed AppData (fallback) or cloud workspace path (primary)
    if (isTauri()) {
      try {
        if (this.cloudWorkspacePath) {
          // Save directly to cloud-sync workspace path
          this._lastSaveTime = Date.now(); // suppress self-triggered watch
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('write_workspace_file', { path: this.cloudWorkspacePath, content: jsonString });
          console.log('[SmartLex] Saved to cloud workspace:', this.cloudWorkspacePath);
        } else {
          // Fallback: save to Tauri AppData
          const { writeTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
          await writeTextFile('workspace.lex', jsonString, {
            baseDir: BaseDirectory.AppData,
          });
        }
      } catch (err) {
        console.error('Tauri disk save failed:', err);
      }
    }
  },

  /**
   * Load data from the best available source.
   * Automatically migrates old data formats to the current version.
   */
  async load(): Promise<WorkspaceData | null> {
    let raw: any = null;

    // If we have an active handle, try to read from it
    if (this.activeHandle) {
      try {
        const file = await this.activeHandle.getFile();
        const text = await file.text();
        raw = JSON.parse(text);
      } catch (err) {
        console.error('Error reading from selected file:', err);
        throw new Error('Failed to read selected file');
      }
    } else {
      // Fallback to LocalStorage
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        raw = cached ? JSON.parse(cached) : null;
      } catch (e) {
        console.error("Failed to parse local storage data", e);
        return null;
      }
    }

    if (!raw) return null;

    // Migrate old data format to current version
    return migrate(raw);
  },

  /**
   * Reads a .lex file and returns the migrated workspace data.
   */
  async importFromFile(file: File): Promise<WorkspaceData> {
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      return migrate(raw);
    } catch (e) {
      throw new Error('Invalid file format. Please invoke a valid .lex JSON file.');
    }
  },

  /**
   * Triggers a browser download of the current workspace as a .lex file.
   */
  exportToFile(
    library: SemanticAnalysis[],
    history: SemanticAnalysis[],
    inbox: CapturedEntry[] = [],
    reviewQueue: ReviewCard[] = [],
  ) {
    const data: WorkspaceData = {
      version: CURRENT_VERSION,
      library,
      history,
      inbox,
      reviewQueue,
      lastSynced: new Date().toISOString(),
    };
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smartlex_workspace_${new Date().toISOString().split('T')[0]}.lex`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Scan common cloud-sync directories (OneDrive/Dropbox/Google Drive)
   * for an existing workspace.lex. If found, load and return it.
   * Tauri-only — returns null in browser environments.
   */
  async autoDetectWorkspace(): Promise<{ path: string; data: WorkspaceData } | null> {
    if (!isTauri()) return null;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const path: string | null = await invoke('scan_cloud_workspace');
      if (!path) return null;

      // Read the workspace file
      const content: string = await invoke('read_workspace_file', { path });
      const raw = JSON.parse(content);
      const data = migrate(raw);

      this.cloudWorkspacePath = path;
      console.log('[SmartLex] Auto-detected cloud workspace:', path);
      return { path, data };
    } catch (err) {
      console.warn('[SmartLex] Cloud workspace auto-detection failed:', err);
      return null;
    }
  },

  /**
   * Load workspace data from a specific absolute file path.
   * Tauri-only — throws in browser environments.
   */
  async loadFromPath(path: string): Promise<WorkspaceData> {
    if (!isTauri()) {
      throw new Error('Direct file path loading is only supported in Tauri desktop.');
    }

    const { invoke } = await import('@tauri-apps/api/core');
    const content: string = await invoke('read_workspace_file', { path });
    const raw = JSON.parse(content);
    return migrate(raw);
  },

  /**
   * Start watching a workspace file for external changes (cloud sync).
   * Calls `onChanged` when the file is modified by another process.
   * Returns a cleanup function to stop watching.
   * Tauri-only — returns a no-op cleanup in browser environments.
   */
  async watchWorkspaceFile(path: string, onChanged: () => void): Promise<() => void> {
    if (!isTauri()) {
      console.warn('[SmartLex] File watching is only supported in Tauri desktop.');
      return () => {};
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      // Start the native file watcher
      await invoke('start_watching', { path });

      // Listen for change events from Rust backend
      const unlisten = await listen<string>('workspace-file-changed', (event) => {
        // Suppress events triggered by our own writes (within 3s of last save)
        if (Date.now() - this._lastSaveTime < 3000) {
          console.log('[SmartLex] Ignoring self-triggered watch event');
          return;
        }
        console.log('[SmartLex] External workspace change detected:', event.payload);
        onChanged();
      });

      // Return cleanup function
      return async () => {
        unlisten();
        try {
          await invoke('stop_watching');
        } catch {
          // Watcher may already be stopped
        }
      };
    } catch (err) {
      console.error('[SmartLex] Failed to start file watcher:', err);
      return () => {};
    }
  },

  /**
   * Check if running inside Tauri desktop app.
   */
  isTauri,

  /**
   * Try to restore a previously-persisted file handle from IndexedDB.
   * If successful, the handle becomes active and data is loaded from it.
   * Returns loaded data on success, null if no handle or permission denied.
   * Chrome only — returns null in Tauri (Tauri uses autoDetectWorkspace instead).
   */
  async autoReconnectWorkspace(): Promise<WorkspaceData | null> {
    if (isTauri() || !isFileSystemApiSupported()) return null;

    try {
      const handle = await restoreHandleFromIDB();
      if (!handle) return null;

      this.activeHandle = handle;
      const file = await handle.getFile();
      const raw = JSON.parse(await file.text());
      this._lastSaveFileModified = file.lastModified;
      console.log('[SmartLex] Reconnected to persisted workspace:', handle.name);
      return migrate(raw);
    } catch (err) {
      console.warn('[SmartLex] Failed to reconnect workspace handle:', err);
      this.activeHandle = null;
      return null;
    }
  },

  /**
   * Start watching for external changes in Chrome (polling-based).
   * Uses visibilitychange + periodic polling with File.lastModified.
   * Returns a cleanup function.
   * Chrome only — returns no-op in Tauri.
   */
  watchChromeWorkspace(onChanged: () => void): () => void {
    if (isTauri() || !this.activeHandle) return () => {};
    if (this._unwatch) this._unwatch(); // replace existing

    let timer: ReturnType<typeof setInterval> | null = null;

    const checkForChanges = async () => {
      if (!this.activeHandle) return;
      try {
        const file = await this.activeHandle.getFile();
        if (file.lastModified > this._lastSaveFileModified) {
          console.log('[SmartLex] External file change detected (Chrome polling)');
          this._lastSaveFileModified = file.lastModified;
          onChanged();
        }
      } catch { /* handle lost — ignore */ }
    };

    // Poll every 30s
    timer = setInterval(checkForChanges, 30000);

    // Also check on tab focus
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkForChanges();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const cleanup = () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      this._unwatch = null;
    };
    this._unwatch = cleanup;
    return cleanup;
  },

  /**
   * Get the current workspace display label (for the sync indicator).
   */
  getWorkspaceLabel(): string {
    if (this.cloudWorkspacePath) {
      return this.cloudWorkspacePath.split(/[/\\]/).pop() || 'workspace.lex';
    }
    if (this.activeHandle) {
      return this.activeHandle.name;
    }
    return '';
  },

  /**
   * Clear all local data
   */
  async clearAllData() {
    localStorage.removeItem(STORAGE_KEY);
    this.activeHandle = null;

    if (isTauri()) {
      try {
        const emptyData: WorkspaceData = {
          version: CURRENT_VERSION,
          library: [],
          history: [],
          inbox: [],
          reviewQueue: [],
          lastSynced: '',
        };
        const jsonString = JSON.stringify(emptyData);
        const { writeTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
        await writeTextFile('workspace.lex', jsonString, {
          baseDir: BaseDirectory.AppData,
        });
      } catch (err) {
        console.error('Failed to clear Tauri data:', err);
      }
    }
  },
};
