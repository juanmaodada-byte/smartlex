import React, { useState, useMemo } from 'react';
import { SemanticAnalysis } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useStore } from '../contexts/StoreContext';
import { storageService } from '../services/storageService';

interface KnowledgeLibraryProps {
  onSelectItem: (item: SemanticAnalysis) => void;
  onOpenHistory: () => void;
}

const TYPE_MAPPING: Record<string, string> = {
  'All': '全部',
  'Metaphor': '隐喻',
  'Idiom': '习语',
  'Word': '单词',
  'Slang': '俚语',
  'Term': '术语'
};

const TYPE_LIST = ['All', 'Metaphor', 'Idiom', 'Word', 'Slang', 'Term'] as const;

const KnowledgeLibrary: React.FC<KnowledgeLibraryProps> = ({
  onSelectItem, onOpenHistory
}) => {
  const { library, history, updateAnalysis, customFileName, linkCustomFile, deleteFromLibrary } = useStore();
  const { showToast } = useToast();

  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isManagingTags, setIsManagingTags] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState('');

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    library.forEach(item => item.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [library]);

  const filteredItems = library.filter(item => {
    const matchesSearch = item.term.toLowerCase().includes(search.toLowerCase()) ||
      item.semanticCore.en.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'All' || item.type === filter;
    const matchesTag = !selectedTag || item.tags.includes(selectedTag);
    return matchesSearch && matchesFilter && matchesTag;
  });

  const handleDeleteItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('确定要删除这个知识资产吗？')) {
      deleteFromLibrary(id);
    }
  };

  const handleAddTag = (item: SemanticAnalysis) => {
    if (!newTagInput.trim()) return;
    const updated = {
      ...item,
      tags: [...new Set([...item.tags, newTagInput.trim()])]
    };
    updateAnalysis(updated);
    setNewTagInput('');
    showToast('标签已添加', 'success');
  };

  const handleRemoveTag = (item: SemanticAnalysis, tagToRemove: string) => {
    const updated = {
      ...item,
      tags: item.tags.filter(t => t !== tagToRemove)
    };
    updateAnalysis(updated);
  };

  const handleCardTagClick = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    setSelectedTag(tag);
    const content = document.getElementById('library-content');
    if (content) content.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onExport = () => {
    storageService.exportToFile(library, history);
    showToast('备份文件已下载', 'success');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="px-6 lg:px-8 py-6 bg-card border-b border-border">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">知识库</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] px-2.5 py-1 rounded-md ${
                customFileName
                  ? 'bg-success/10 text-success border border-success/20'
                  : 'bg-muted text-muted-foreground border border-border'
              }`}>
                <span className="material-symbols-outlined text-xs">
                  {customFileName ? 'cloud_done' : 'folder'}
                </span>
                {customFileName ? customFileName : '本地工作区'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onExport} className="btn btn-ghost text-xs gap-1.5">
              <span className="material-symbols-outlined text-sm">download</span>
              导出备份
            </button>
            <button
              onClick={linkCustomFile}
              className={`btn text-xs gap-1.5 ${
                customFileName ? 'btn-success' : 'btn-secondary'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {customFileName ? 'cloud_done' : 'link'}
              </span>
              {customFileName ? '已链接' : '选择路径'}
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-col gap-4">
          {/* Search + Type filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 text-xl pointer-events-none z-10">
                search
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10 pr-4 text-sm"
                placeholder="搜索知识库..."
                type="text"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {TYPE_LIST.map(t => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap transition-all duration-150 ${
                    filter === t
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {TYPE_MAPPING[t] || t}
                </button>
              ))}
            </div>
          </div>

          {/* Tag filter bar */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center pt-3 border-t border-border">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em] mr-1">
                标签筛选
              </span>
              <button
                onClick={() => setSelectedTag(null)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                  !selectedTag
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                全部
              </button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                    tag === selectedTag
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-8 bg-dot-pattern"
        id="library-content"
      >
        {filteredItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground/25 gap-4">
            <span className="material-symbols-outlined text-8xl">inventory_2</span>
            <div className="text-center">
              <p className="text-sm font-medium">未找到匹配项</p>
              {selectedTag && (
                <button
                  onClick={() => setSelectedTag(null)}
                  className="mt-3 text-xs font-semibold text-primary hover:underline"
                >
                  清除标签筛选
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 space-y-5">
            {filteredItems.map(item => (
              <div key={item.id} className="break-inside-avoid group relative">
                {/* Card */}
                <div
                  className="card depth-1 hover:depth-2 transition-all duration-200 flex flex-col cursor-pointer"
                  onClick={() => onSelectItem(item)}
                >
                  {/* Top row: type badge + actions */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="chip chip-sm font-semibold">
                      {TYPE_MAPPING[item.type] || item.type}
                    </span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsManagingTags(isManagingTags === item.id ? null : item.id);
                        }}
                        className="btn-icon btn-icon-ghost size-7"
                        title="管理标签"
                      >
                        <span className="material-symbols-outlined text-sm">label</span>
                      </button>
                      <button
                        onClick={(e) => handleDeleteItem(e, item.id)}
                        className="btn-icon btn-icon-ghost size-7 text-muted-foreground hover:text-destructive"
                        title="删除"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-bold text-foreground mb-2 tracking-tight truncate">
                    {item.term}
                  </h3>

                  {/* Definition preview */}
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed italic mb-4 border-l-[3px] border-primary/20 pl-3">
                    &ldquo;{item.semanticCore.en}&rdquo;
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mt-auto mb-3">
                    {item.tags.slice(0, 4).map(tag => (
                      <span
                        key={tag}
                        onClick={(e) => handleCardTagClick(e, tag)}
                        className="chip chip-xs cursor-pointer hover:chip-amber transition-colors"
                      >
                        #{tag}
                      </span>
                    ))}
                    {item.tags.length > 4 && (
                      <span className="chip chip-xs text-muted-foreground/50">
                        +{item.tags.length - 4}
                      </span>
                    )}
                  </div>

                  {/* Footer: timestamp */}
                  <div className="pt-3 border-t border-border flex items-center gap-1.5 text-[10px] text-muted-foreground/50 font-mono">
                    <span className="material-symbols-outlined text-[10px]">schedule</span>
                    <span>{new Date(item.timestamp).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>

                {/* Tag Management Overlay */}
                {isManagingTags === item.id && (
                  <div className="absolute inset-x-0 bottom-0 bg-card rounded-b-xl border-t border-border p-4 z-10 animate-in slide-in-from-bottom-2 duration-200 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">
                        管理标签
                      </span>
                      <button
                        onClick={() => setIsManagingTags(null)}
                        className="material-symbols-outlined text-sm text-muted-foreground hover:text-destructive transition-colors"
                      >
                        close
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-4 max-h-24 overflow-y-auto">
                      {item.tags.map(t => (
                        <span
                          key={t}
                          className="chip group/tag gap-1"
                        >
                          {t}
                          <button
                            onClick={() => handleRemoveTag(item, t)}
                            className="material-symbols-outlined text-[12px] text-muted-foreground/40 hover:text-destructive"
                          >
                            cancel
                          </button>
                        </span>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTag(item)}
                        placeholder="添加新标签..."
                        className="input flex-1 text-xs"
                      />
                      <button
                        onClick={() => handleAddTag(item)}
                        className="btn-icon btn-icon-primary"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeLibrary;
