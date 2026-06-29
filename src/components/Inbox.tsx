import React, { useState, useMemo, useCallback } from 'react';
import { useStore } from '../contexts/StoreContext';
import { useToast } from '../contexts/ToastContext';
import { useExtensionSync } from '../hooks/useExtensionSync';
import { BatchAnalyzer } from '../services/batchAnalyzer';
import type { CapturedEntry } from '../../shared/types';
import type { BatchStatus } from '../types';

type FilterMode = 'all' | 'pending' | 'analyzing' | 'done';
type SortKey = 'newest' | 'oldest' | 'source';

const SORT_LABELS: Record<SortKey, string> = { newest: '最新', oldest: '最早', source: '来源' };
const FILTER_LABELS: Record<FilterMode, string> = { all: '全部', pending: '待处理', analyzing: '分析中', done: '已完成' };

const Inbox: React.FC = () => {
  const { inbox, removeFromInbox, updateInboxEntry, addToLibrary, setHistory } = useStore();
  const { showToast } = useToast();
  const { status: syncStatus, lastSyncCount, sync, isExtensionAvailable, isTauri } = useExtensionSync();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
  const [analyzerRef] = useState(() => new BatchAnalyzer(3));

  // ── 筛选 + 排序 ──
  const filtered = useMemo(() => {
    let list = [...inbox];
    if (filterMode !== 'all') list = list.filter(e => e.status === filterMode);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(e => e.term.toLowerCase().includes(q) || e.source.title.toLowerCase().includes(q) || e.source.url.toLowerCase().includes(q) || e.tags.some(t => t.toLowerCase().includes(q)));
    }
    list.sort((a, b) => {
      switch (sortBy) {
        case 'newest': return new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime();
        case 'oldest': return new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime();
        case 'source': return a.source.url.localeCompare(b.source.url);
        default: return 0;
      }
    });
    return list;
  }, [inbox, filterMode, searchQuery, sortBy]);

  // ── 多选 ──
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }, []);
  const selectAll = () => setSelectedIds(new Set(filtered.map(e => e.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const deleteSelected = () => { selectedIds.forEach(id => removeFromInbox(id)); setSelectedIds(new Set()); };

  // ── 标签 ──
  const addTag = useCallback((entry: CapturedEntry, tag: string) => {
    const t = tag.trim(); if (!t || entry.tags.includes(t)) return;
    updateInboxEntry({ ...entry, tags: [...entry.tags, t] });
  }, [updateInboxEntry]);
  const removeTag = useCallback((entry: CapturedEntry, tag: string) => {
    updateInboxEntry({ ...entry, tags: entry.tags.filter(t => t !== tag) });
  }, [updateInboxEntry]);

  // ── 批量分析 ──
  const startBatchAnalyze = useCallback(async (mode: 'light' | 'deep') => {
    if (selectedIds.size === 0) { showToast('请先勾选要分析的词条', 'info'); return; }
    const entries = filtered.filter(e => selectedIds.has(e.id));
    if (entries.length === 0) { showToast('所选词条中没有待处理的项目', 'info'); return; }
    entries.forEach(e => updateInboxEntry({ ...e, status: 'analyzing' }));
    await analyzerRef.analyzeBatch(entries, mode, {
      onProgress: s => setBatchStatus({ ...s }),
      onEntryComplete: (_eid, result) => { addToLibrary(result); setHistory(prev => [...prev, result]); },
      onEntryError: (eid) => {
        const entry = entries.find(e => e.id === eid);
        if (entry) updateInboxEntry({ ...entry, status: 'pending' });
        showToast(`分析失败: 第 ${entries.findIndex(e => e.id === eid) + 1} 个词条`, 'error');
      },
      onComplete: () => {
        entries.forEach(e => updateInboxEntry({ ...e, status: 'done' }));
        setBatchStatus(null); setSelectedIds(new Set());
        showToast(`分析完成：${entries.length} 个词条`, 'success');
      },
    });
  }, [filtered, selectedIds, inbox, updateInboxEntry, addToLibrary, setHistory, showToast, analyzerRef]);

  // ── 按来源分组 ──
  const groupedBySource = useMemo(() => {
    const groups: Record<string, CapturedEntry[]> = {};
    for (const e of filtered) {
      const domain = e.source.url.replace(/^https?:\/\//, '').split('/')[0];
      if (!groups[domain]) groups[domain] = [];
      groups[domain].push(e);
    }
    return groups;
  }, [filtered]);
  const sourceDomains = Object.keys(groupedBySource).sort();

  return (
    <div className="flex flex-col h-full">
      {/* 顶栏 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Inbox</h2>
          <span className="text-sm text-slate-400">{inbox.length} 个词条</span>
        </div>
        <div className="flex items-center gap-2">
          {isTauri ? (
            <span className="text-xs text-emerald-500 flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              ☁️ .lex 文件同步
            </span>
          ) : (
            <>
              {isExtensionAvailable && (
                <button onClick={sync} disabled={syncStatus === 'syncing' || syncStatus === 'checking'}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50">
                  {syncStatus === 'syncing' ? '同步中…' : '🔄 同步'}
                </button>
              )}
              {syncStatus === 'success' && lastSyncCount > 0 && <span className="text-xs text-green-600">+{lastSyncCount}</span>}
              {syncStatus === 'unavailable' && <span className="text-xs text-amber-500">⚠ 扩展未连接</span>}
            </>
          )}
        </div>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex-wrap">
        <input type="text" placeholder="搜索…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
          {(Object.keys(FILTER_LABELS) as FilterMode[]).map(key => (
            <button key={key} onClick={() => setFilterMode(key)}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${filterMode === key ? 'bg-indigo-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
              {FILTER_LABELS[key]}
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)}
          className="px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          {Object.entries(SORT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-400">已选 {selectedIds.size} 项</span>
            <button onClick={selectAll} className="px-2 py-1 text-xs rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">全选</button>
            <button onClick={clearSelection} className="px-2 py-1 text-xs rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">取消</button>
            <button onClick={() => startBatchAnalyze('light')} disabled={!!batchStatus}
              className="px-2.5 py-1 text-xs font-medium rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40 transition-colors disabled:opacity-50">轻量分析</button>
            <button onClick={deleteSelected}
              className="px-2.5 py-1 text-xs font-medium rounded bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 transition-colors">删除所选</button>
          </div>
        )}
      </div>

      {/* 进度条 */}
      {batchStatus && (
        <div className="px-6 py-2.5 bg-indigo-50/50 dark:bg-indigo-900/10 border-b border-indigo-100 dark:border-indigo-900/30">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap min-w-[120px]">
              {batchStatus.completed + batchStatus.failed >= batchStatus.total
                ? `✅ 完成 ${batchStatus.completed} 个`
                : `⏳ ${batchStatus.completed}/${batchStatus.total}`}
              {batchStatus.failed > 0 && (
                <span className="text-red-500 ml-1">（{batchStatus.failed} 失败）</span>
              )}
            </span>
            <div className="flex-1 h-2.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 overflow-hidden relative">
              {/* 已完成部分 */}
              <div
                className="absolute inset-y-0 left-0 h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-500 transition-all duration-700 ease-out z-10"
                style={{ width: `${batchStatus.total > 0 ? (batchStatus.completed / batchStatus.total * 100) : 0}%` }}
              />
              {/* 失败部分 */}
              {batchStatus.failed > 0 && (
                <div
                  className="absolute inset-y-0 h-full bg-gradient-to-r from-red-400 to-red-500 transition-all duration-700 ease-out z-10"
                  style={{
                    left: `${batchStatus.total > 0 ? (batchStatus.completed / batchStatus.total * 100) : 0}%`,
                    width: `${batchStatus.total > 0 ? (batchStatus.failed / batchStatus.total * 100) : 0}%`,
                  }}
                />
              )}
              {/* 动态条纹（未完成部分） */}
              {batchStatus.inProgress && (
                <div className="absolute inset-0 h-full rounded-full sl-progress-striped opacity-30 z-20" />
              )}
              {/* 流光扫过 */}
              {batchStatus.inProgress && (
                <div className="absolute inset-y-0 h-full w-1/3 z-20 overflow-hidden rounded-full" style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                  animation: 'sl-shimmer 1.5s ease-in-out infinite',
                }} />
              )}
            </div>
            <button onClick={() => analyzerRef.cancel()} className="text-xs text-red-500 hover:text-red-600 font-medium whitespace-nowrap">取消</button>
          </div>
        </div>
      )}

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto px-6 py-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-5xl mb-4">📥</span>
            {isTauri ? (
              <>
                <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">Inbox 是空的</h3>
                <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs mb-4">
                  在 Chrome 中安装 SmartLex 扩展划词捕获，或通过 .lex 文件从其他设备同步词条
                </p>
                <p className="text-xs text-slate-400/60 max-w-xs">
                  工作区会自动扫描 OneDrive/Dropbox 中的 .lex 文件
                </p>
              </>
            ) : !isExtensionAvailable ? (
              <>
                <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">未连接到 Chrome 扩展</h3>
                <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs mb-4">安装 SmartLex Capture 扩展并配置扩展 ID，即可在阅读时一键收集词汇</p>
              </>
            ) : inbox.length === 0 ? (
              <>
                <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">Inbox 是空的</h3>
                <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs mb-4">使用 Chrome 扩展在网页上划选词汇 → 点收藏 → 词条会出现在这里</p>
                <button onClick={sync} className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors">手动同步</button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">没有匹配的词条</h3>
                <p className="text-sm text-slate-400 dark:text-slate-500">尝试调整筛选条件</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {sourceDomains.map(domain => (
              <SourceGroup key={domain} domain={domain} entries={groupedBySource[domain]}
                selectedIds={selectedIds} editingTag={editingTag}
                onToggle={toggleSelect} onDelete={removeFromInbox}
                onStartTagEdit={setEditingTag} onAddTag={addTag} onRemoveTag={removeTag} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── SourceGroup ──
const SourceGroup: React.FC<{
  domain: string; entries: CapturedEntry[]; selectedIds: Set<string>; editingTag: string | null;
  onToggle: (id: string) => void; onDelete: (id: string) => void;
  onStartTagEdit: (id: string | null) => void; onAddTag: (e: CapturedEntry, t: string) => void; onRemoveTag: (e: CapturedEntry, t: string) => void;
}> = ({ domain, entries, selectedIds, editingTag, onToggle, onDelete, onStartTagEdit, onAddTag, onRemoveTag }) => {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div>
      <button onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
        <span className={`transform transition-transform ${collapsed ? '' : 'rotate-90'}`}>▶</span>
        <span className="text-[10px]">🔗</span>
        {domain} <span className="font-normal normal-case tracking-normal text-slate-400">({entries.length})</span>
      </button>
      {!collapsed && (
        <div className="space-y-1 ml-3">
          {entries.map(entry => (
            <div key={entry.id}
              className={`group flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors ${selectedIds.has(entry.id) ? 'bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-200 dark:ring-indigo-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
              <input type="checkbox"
                checked={selectedIds.has(entry.id)}
                disabled={entry.status !== 'pending'}
                onChange={() => onToggle(entry.id)}
                className="mt-1 rounded border-slate-300 dark:border-slate-600 text-indigo-500 focus:ring-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{entry.term}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    entry.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                    entry.status === 'analyzing' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                    {{ pending: '待处理', analyzing: '分析中', done: '已完成', archived: '已归档' }[entry.status]}
                  </span>
                </div>
                {entry.context.before && (
                  <ContextPreview before={entry.context.before} target={entry.context.target} after={entry.context.after} />
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] text-slate-400 dark:text-slate-600">{entry.source.url.replace(/^https?:\/\//, '').split('/')[0]}</span>
                  <span className="text-[11px] text-slate-300 dark:text-slate-700">·</span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-600">{formatTimeAgo(entry.capturedAt)}</span>
                </div>
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  {entry.tags.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                      {tag}<button onClick={() => onRemoveTag(entry, tag)} className="hover:text-red-500 ml-0.5">×</button>
                    </span>
                  ))}
                  {editingTag === entry.id ? (
                    <TagInput entry={entry} onAdd={onAddTag} onClose={() => onStartTagEdit(null)} />
                  ) : (
                    <button onClick={() => onStartTagEdit(entry.id)}
                      className="text-[10px] px-1.5 py-0.5 rounded border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-indigo-400 hover:text-indigo-500 transition-colors">+ 标签</button>
                  )}
                </div>
              </div>
              <button onClick={() => onDelete(entry.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-300 hover:text-red-500 transition-all" title="删除">🗑</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── TagInput ──
const TagInput: React.FC<{ entry: CapturedEntry; onAdd: (e: CapturedEntry, t: string) => void; onClose: () => void }> = ({ entry, onAdd, onClose }) => {
  const [v, setV] = useState('');
  return (
    <input autoFocus className="text-[10px] px-1.5 py-0.5 w-20 rounded border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none"
      value={v} onChange={e => setV(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') { onAdd(entry, v); setV(''); onClose(); } if (e.key === 'Escape') { onClose(); } }}
      onBlur={onClose} />
  );
};

const ContextPreview: React.FC<{ before: string; target: string; after: string }> = ({ before, target, after }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className="flex items-start gap-1 text-xs text-slate-400 dark:text-slate-500 mt-0.5 cursor-pointer hover:text-slate-500 dark:hover:text-slate-400"
      title={expanded ? '点击收起' : '点击展开全文'}
    >
      <span className={`flex-1 min-w-0 ${expanded ? '' : 'truncate'}`}>
        …{before} <span className="text-indigo-500 font-medium">{target}</span> {after}…
      </span>
      <span className="shrink-0 text-[10px] text-slate-300 dark:text-slate-600 mt-px">{expanded ? '▲' : '▼'}</span>
    </div>
  );
};

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

export default Inbox;
