import React, { useState } from 'react';
import { SemanticAnalysis } from '../types';
import { useStore } from '../contexts/StoreContext';

interface HistoryListProps {
  onSelectItem: (item: SemanticAnalysis) => void;
  onClose: () => void;
}

const HistoryList: React.FC<HistoryListProps> = ({ onSelectItem, onClose }) => {
  const { history, setHistory } = useStore();
  const [search, setSearch] = useState('');

  const onClear = () => setHistory([]);

  const items = history;

  const filteredItems = items.filter(item => {
    return item.term.toLowerCase().includes(search.toLowerCase()) ||
      item.semanticCore.en.toLowerCase().includes(search.toLowerCase()) ||
      item.partOfSpeech.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="px-6 lg:px-8 py-5 bg-card/80 backdrop-blur-sm border-b border-border flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="btn-icon btn-icon-ghost"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h2 className="text-xl font-bold text-foreground tracking-tight">分析历史</h2>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">
              Analysis History
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative w-56">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 text-lg pointer-events-none z-10">
              search
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-11 text-sm"
              placeholder="搜索历史..."
              type="text"
            />
          </div>
          {items.length > 0 && (
            <button
              onClick={onClear}
              className="btn btn-ghost text-xs text-destructive"
            >
              清空记录
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-8">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground/30 gap-4">
            <span className="material-symbols-outlined text-7xl">history</span>
            <p className="text-sm font-medium italic">暂无分析历史</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-4xl mx-auto">
            {filteredItems.map(item => (
              <div
                key={item.id}
                onClick={() => onSelectItem(item)}
                className="card depth-1 flex items-center gap-5 cursor-pointer hover:depth-2 transition-all duration-150 active:scale-[0.99] group"
              >
                {/* Type icon */}
                <div className="icon-box icon-box-muted shrink-0 group-hover:icon-box-blue transition-colors">
                  <span className="material-symbols-outlined text-xl font-bold">
                    {item.type === 'Metaphor' ? 'schema' : item.type === 'Idiom' ? 'format_quote' : 'psychology'}
                  </span>
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">
                      {item.term}
                    </h3>
                    <span className="chip chip-sm text-[9px]">
                      {item.partOfSpeech}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1 italic">
                    &ldquo;{item.semanticCore.en}&rdquo;
                  </p>
                </div>

                {/* Timestamp */}
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-tight">
                    {new Date(item.timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 font-mono">
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                {/* Arrow */}
                <span className="material-symbols-outlined text-muted-foreground/20 group-hover:text-primary group-hover:translate-x-0.5 transition-all">
                  chevron_right
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryList;
