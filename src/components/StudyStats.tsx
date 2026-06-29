/**
 * StudyStats — 学习统计面板（嵌入 ReviewPanel 的统计 Tab）
 * 纯 CSS 图表，零依赖，Modern Scholar 风格
 */
import React, { useMemo } from 'react';
import { useStore } from '../contexts/StoreContext';
import {
  getDueCards,
  getStudyStats,
  getDailyReviewCounts,
  getRatingDistribution,
  getIntervalBuckets,
} from '../services/spacedRepetition';

// ═══ 子组件 ═══

const StatBox: React.FC<{ value: number; label: string; icon: string }> = ({
  value,
  label,
  icon,
}) => (
  <div className="bg-card border border-border rounded-xl p-4 flex items-start justify-between">
    <div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
    <span className="text-xl opacity-40">{icon}</span>
  </div>
);

// ═══ 7 日柱状图 ═══

const DailyBarChart: React.FC<{ data: { date: string; count: number; dayLabel: string }[] }> = ({
  data,
}) => {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">
        📊 7 日复习趋势
      </h3>
      <div className="flex items-end justify-between gap-2 h-32">
        {data.map((d) => {
          const heightPct = (d.count / maxCount) * 100;
          const isToday =
            d.date === new Date().toISOString().slice(0, 10);

          return (
            <div
              key={d.date}
              className="flex flex-col items-center gap-1 flex-1 h-full justify-end"
            >
              {d.count > 0 && (
                <span className="text-xs font-bold text-foreground tabular-nums">
                  {d.count}
                </span>
              )}
              <div
                className={`w-full max-w-[40px] rounded-t-md transition-all duration-500 ${
                  isToday
                    ? 'bg-accent-500 shadow-sm'
                    : d.count > 0
                      ? 'bg-accent-400/60'
                      : 'bg-muted'
                }`}
                style={{ height: `${Math.max(heightPct, d.count > 0 ? 4 : 1)}%` }}
              />
              <span
                className={`text-[10px] mt-1 tabular-nums ${
                  isToday
                    ? 'text-accent-600 dark:text-accent-400 font-semibold'
                    : 'text-muted-foreground'
                }`}
              >
                {d.dayLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ═══ 评分分布横向条形图 ═══

const RATING_BAR_COLORS = [
  'bg-red-400',
  'bg-orange-400',
  'bg-yellow-400',
  'bg-lime-400',
  'bg-green-400',
  'bg-emerald-400',
];

const RATING_LABELS = ['完全忘了', '记得但错', '犹豫正确', '正确但难', '基本正确', '秒答'];

const RatingDistribution: React.FC<{
  data: { rating: number; count: number; percentage: number }[];
}> = ({ data }) => {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">
        📈 评分分布
      </h3>
      <div className="flex flex-col gap-2">
        {data.map((d) => (
          <div key={d.rating} className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-14 text-right shrink-0">
              {d.rating}分
            </span>
            <div className="flex-1 h-5 bg-muted rounded-md overflow-hidden">
              <div
                className={`h-full rounded-md transition-all duration-500 ${RATING_BAR_COLORS[d.rating]}`}
                style={{ width: `${(d.count / maxCount) * 100}%` }}
              />
            </div>
            <span className="text-xs text-foreground font-mono tabular-nums w-16 text-right shrink-0">
              {d.count}
              <span className="text-muted-foreground ml-0.5 text-[10px]">
                {d.percentage}%
              </span>
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-3 pt-2 border-t border-border">
        {RATING_LABELS.map((label, i) => (
          <span key={i} className="text-[10px] text-muted-foreground/60">
            {i}:{label}
          </span>
        ))}
      </div>
    </div>
  );
};

// ═══ 间隔分布分段条形图 ═══

const BUCKET_COLORS = [
  'bg-slate-300 dark:bg-slate-600',
  'bg-amber-300 dark:bg-amber-600',
  'bg-orange-400 dark:bg-orange-500',
  'bg-indigo-400 dark:bg-indigo-500',
  'bg-emerald-400 dark:bg-emerald-500',
];

const IntervalBuckets: React.FC<{
  data: { bucket: string; emoji: string; range: string; count: number }[];
}> = ({ data }) => {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">
        ⏱ 间隔分布
      </h3>

      <div className="flex h-5 rounded-md overflow-hidden mb-3">
        {data.map((d, i) => {
          const w = (d.count / total) * 100;
          return w > 0 ? (
            <div
              key={d.bucket}
              className={`${BUCKET_COLORS[i]} transition-all duration-500`}
              style={{ width: `${w}%` }}
              title={`${d.emoji} ${d.range}: ${d.count} 张卡片`}
            />
          ) : null;
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        {data.map((d, i) => (
          <div key={d.bucket} className="flex items-center gap-1.5">
            <span
              className={`size-2.5 rounded-sm shrink-0 ${BUCKET_COLORS[i]}`}
            />
            <span className="text-[10px] text-muted-foreground">
              {d.emoji} {d.range}
            </span>
            <span className="text-xs font-mono font-bold text-foreground tabular-nums">
              {d.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══ 分析类型分布 Donut ═══

const TYPE_COLORS: Record<string, string> = {
  Metaphor: '#6366f1',
  Idiom: '#8b5cf6',
  Word: '#06b6d4',
  Slang: '#f59e0b',
  Term: '#10b981',
  Chat: '#ef4444',
};

const TYPE_LABELS_CN: Record<string, string> = {
  Metaphor: '隐喻',
  Idiom: '习语',
  Word: '单词',
  Slang: '俚语',
  Term: '术语',
  Chat: '对话',
};

const TypeDonut: React.FC<{ segments: { type: string; count: number }[] }> = ({
  segments,
}) => {
  const total = segments.reduce((s, seg) => s + seg.count, 0) || 1;

  const gradientParts: string[] = [];
  let accumulated = 0;

  for (const seg of segments) {
    const startPct = (accumulated / total) * 100;
    accumulated += seg.count;
    const endPct = (accumulated / total) * 100;
    const color = TYPE_COLORS[seg.type] || '#94a3b8';
    gradientParts.push(`${color} ${startPct}% ${endPct}%`);
  }

  const gradientStr = gradientParts.length > 0
    ? `conic-gradient(${gradientParts.join(', ')})`
    : 'conic-gradient(#e2e8f0 0% 100%)';

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">
        🏷 分析类型分布
      </h3>

      <div className="flex items-center gap-5">
        <div className="relative shrink-0">
          <div
            className="size-24 rounded-full"
            style={{ background: gradientStr }}
          />
          <div className="absolute inset-2 rounded-full bg-card flex items-center justify-center">
            <span className="text-sm font-bold text-foreground tabular-nums">
              {total}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          {segments.map((seg) => (
            <div key={seg.type} className="flex items-center gap-2">
              <span
                className="size-2.5 rounded-full shrink-0"
                style={{ backgroundColor: TYPE_COLORS[seg.type] || '#94a3b8' }}
              />
              <span className="text-xs text-muted-foreground">
                {TYPE_LABELS_CN[seg.type] || seg.type}
              </span>
              <span className="text-xs font-mono font-bold text-foreground tabular-nums ml-auto">
                {seg.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ═══ 主组件 ═══

const StudyStats: React.FC = () => {
  const { library, reviewQueue } = useStore();

  const stats = useMemo(() => getStudyStats(reviewQueue), [reviewQueue]);
  const dueCount = useMemo(
    () => getDueCards(reviewQueue).length,
    [reviewQueue],
  );

  const dailyData = useMemo(
    () => getDailyReviewCounts(reviewQueue, 7),
    [reviewQueue],
  );

  const ratingData = useMemo(
    () => getRatingDistribution(reviewQueue),
    [reviewQueue],
  );

  const bucketData = useMemo(
    () => getIntervalBuckets(reviewQueue),
    [reviewQueue],
  );

  const typeData = useMemo(() => {
    const map = new Map<string, number>();
    for (const card of reviewQueue) {
      const analysis = library.find((a) => a.id === card.analysisId);
      if (analysis) {
        const t = analysis.type;
        map.set(t, (map.get(t) || 0) + 1);
      }
    }
    const order = ['Metaphor', 'Idiom', 'Word', 'Slang', 'Term', 'Chat'];
    return order
      .filter((t) => map.has(t))
      .map((t) => ({ type: t, count: map.get(t)! }));
  }, [reviewQueue, library]);

  // ─── 空状态 ───
  if (library.length === 0 && reviewQueue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
        <span className="text-6xl">📊</span>
        <h3 className="text-lg font-bold text-foreground">暂无学习数据</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          分析词条或导入复习卡片后，统计面板将在这里显示你的学习进度和复习表现
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-5">
      {/* ═══ 第一行：概览指标卡 ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatBox value={library.length} label="知识库词条" icon="📚" />
        <StatBox value={stats.totalReviews} label="总复习次数" icon="🔄" />
        <StatBox value={stats.mastered} label="已掌握" icon="✅" />
        <StatBox value={dueCount} label="今日待复习" icon="📅" />
      </div>

      {/* ═══ 第二行：趋势 + 评分分布 ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DailyBarChart data={dailyData} />
        <RatingDistribution data={ratingData} />
      </div>

      {/* ═══ 第三行：间隔分布 + 类型分布 ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <IntervalBuckets data={bucketData} />
        <TypeDonut segments={typeData} />
      </div>
    </div>
  );
};

export default StudyStats;
