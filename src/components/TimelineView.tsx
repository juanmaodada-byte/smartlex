import React, { useMemo } from 'react';
import type { SemanticAnalysis } from '../types';

const TYPE_MAP: Record<string, string> = {
  Metaphor: '隐喻', Idiom: '习语', Word: '单词', Slang: '俚语', Term: '术语',
};

interface Props {
  items: SemanticAnalysis[];
  onSelect: (item: SemanticAnalysis) => void;
}

/** 按周分组的时间线视图 */
const TimelineView: React.FC<Props> = ({ items, onSelect }) => {
  const grouped = useMemo(() => {
    const groups: Record<string, SemanticAnalysis[]> = {};
    for (const item of [...items].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())) {
      const d = new Date(item.timestamp);
      const monday = new Date(d);
      monday.setDate(d.getDate() - d.getDay() + 1);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const key = `${monday.toLocaleDateString('zh-CN')} — ${sunday.toLocaleDateString('zh-CN')}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [items]);

  const weeks = Object.keys(grouped);

  if (weeks.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground/25 gap-4">
        <span className="material-symbols-outlined text-8xl">timeline</span>
        <p className="text-sm font-medium">暂无词条</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {weeks.map(week => {
        const count = grouped[week].length;
        return (
          <div key={week}>
            {/* Week header */}
            <div className="flex items-center gap-3 mb-3 pl-1">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-sm text-primary">calendar_view_week</span>
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{week}</span>
              <span className="text-[10px] text-muted-foreground/50">· {count} 个词条</span>
            </div>

            {/* Timeline line + items */}
            <div className="relative ml-4 pl-6 border-l-2 border-primary/10 space-y-2">
              {grouped[week].map(item => (
                <div
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className="relative group cursor-pointer"
                >
                  {/* Dot on timeline */}
                  <div className="absolute -left-[25px] top-3 w-2.5 h-2.5 rounded-full bg-primary/30 group-hover:bg-primary transition-colors ring-2 ring-background" />

                  {/* Card */}
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                    <span className="chip chip-xs font-semibold shrink-0">
                      {TYPE_MAP[item.type] || item.type}
                    </span>
                    <span className="font-semibold text-sm text-foreground truncate flex-1">{item.term}</span>
                    <span className="text-[10px] text-muted-foreground/50 font-mono whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleDateString('zh-CN')}
                    </span>
                    {/* Tags */}
                    <div className="hidden sm:flex gap-1 shrink-0">
                      {item.tags.slice(0, 2).map(t => (
                        <span key={t} className="chip chip-xs text-[9px]">#{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TimelineView;
