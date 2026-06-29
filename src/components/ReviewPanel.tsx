import React, { useState, useMemo, useCallback } from 'react';
import { useStore } from '../contexts/StoreContext';
import { useToast } from '../contexts/ToastContext';
import type { ReviewCard, SemanticAnalysis, ReviewRating } from '../types';
import { sm2, getDueCards, getStudyStats, createReviewCard } from '../services/spacedRepetition';
import StudyStats from './StudyStats';

const RATING_LABELS = ['完全忘了', '记得但错', '犹豫正确', '正确但难', '基本正确', '秒答'];
const RATING_COLORS = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500', 'bg-emerald-500'];

type TabId = 'review' | 'stats';

const ReviewPanel: React.FC = () => {
  const { library, reviewQueue, updateReviewCard, addToReviewQueue, removeFromReviewQueue } = useStore();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>('review');
  const [flipped, setFlipped] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);

  // 今日到期卡片
  const dueCards = useMemo(() => getDueCards(reviewQueue), [reviewQueue]);

  // 用 analysisId 查找对应的分析结果
  const dueWithData = useMemo(() => {
    return dueCards.map(card => ({
      card,
      analysis: library.find(a => a.id === card.analysisId),
    })).filter(d => d.analysis) as { card: ReviewCard; analysis: SemanticAnalysis }[];
  }, [dueCards, library]);

  const total = dueWithData.length;
  const current = dueWithData[currentIdx];

  // 统计
  const stats = useMemo(() => getStudyStats(reviewQueue), [reviewQueue]);

  const handleRate = useCallback((rating: ReviewRating) => {
    if (!current) return;

    const updated = sm2(current.card, rating);
    updateReviewCard(updated);

    showToast(`评分: ${rating}/5`, 'info');

    // 下一张
    if (currentIdx + 1 < total) {
      setFlipped(false);
      setTimeout(() => setCurrentIdx(currentIdx + 1), 200);
    } else {
      showToast('🎉 今日复习完成！', 'success');
    }
  }, [current, currentIdx, total, updateReviewCard, showToast]);

  const handleSkip = () => {
    if (!current) return;
    removeFromReviewQueue(current.card.id);
    if (currentIdx + 1 < total) {
      setFlipped(false);
      setCurrentIdx(currentIdx + 1);
    }
  };

  // ═══ Tab 切换条 ═══
  const tabBar = (
    <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 self-center mb-2">
      {([
        ['review', '复习'],
        ['stats', '统计'],
      ] as [TabId, string][]).map(([id, label]) => (
        <button
          key={id}
          onClick={() => setActiveTab(id)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
            activeTab === id
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  // ═══ 统计 Tab ═══
  if (activeTab === 'stats') {
    return (
      <div className="flex flex-col items-center h-full pt-4">
        {tabBar}
        <div className="flex-1 w-full overflow-y-auto">
          <StudyStats />
        </div>
      </div>
    );
  }

  // ═══ 复习 Tab — 完成状态 ═══
  if (!current) {
    return (
      <div className="flex flex-col items-center h-full pt-4">
        {tabBar}
        <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center px-6">
          <span className="text-6xl">🎉</span>
          <h3 className="text-lg font-bold text-foreground">今日复习完成</h3>
          <p className="text-sm text-muted-foreground">没有待复习的词条</p>

          {/* 统计 */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <StatBox value={stats.total} label="总卡片" />
            <StatBox value={stats.totalReviews} label="总复习" />
            <StatBox value={stats.mastered} label="已掌握" />
          </div>

          <button
            onClick={() => {
              let added = 0;
              library.forEach(item => {
                if (!reviewQueue.some(c => c.analysisId === item.id)) {
                  addToReviewQueue(createReviewCard(item));
                  added++;
                }
              });
              showToast(`已添加 ${added} 个词条到复习队列`, 'success');
            }}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors mt-2"
          >
            从知识库导入词条
          </button>
        </div>
      </div>
    );
  }

  const { analysis, card } = current;

  // ═══ 复习 Tab — 答题中 ═══
  return (
    <div className="flex flex-col items-center h-full pt-4">
      {tabBar}
      <div className="flex flex-col items-center justify-center flex-1 gap-4 px-6 py-4 w-full">
        {/* 进度 */}
        <div className="text-xs text-muted-foreground">
          复习 · 第 {currentIdx + 1}/{total} 个
          {card.repetitions > 0 && ` · 已复习 ${card.repetitions} 次`}
        </div>

        {/* 进度条 */}
        <div className="w-full max-w-sm h-1 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all duration-500"
            style={{ width: `${(currentIdx / Math.max(total, 1)) * 100}%` }} />
        </div>

        {/* 卡片 */}
        <div
          onClick={() => setFlipped(!flipped)}
          className="w-full max-w-md cursor-pointer perspective-1000"
        >
          <div
            className={`relative w-full transition-transform duration-500 transform-style-3d ${flipped ? 'rotate-y-180' : ''}`}
            style={{ minHeight: '280px' }}
          >
            {/* 正面：单词 */}
            <div className={`absolute inset-0 backface-hidden bg-card border border-border rounded-2xl shadow-lg flex flex-col items-center justify-center p-8 gap-4`}>
              <h2 className="text-3xl font-bold text-foreground">{analysis.term}</h2>
              {analysis.context && (
                <p className="text-sm text-muted-foreground text-center italic max-w-xs">
                  &ldquo;{analysis.context}&rdquo;
                </p>
              )}
              <span className="text-xs text-muted-foreground/50 mt-4">点击翻转查看释义</span>
            </div>

            {/* 反面：释义 */}
            <div className={`absolute inset-0 backface-hidden bg-card border border-border rounded-2xl shadow-lg flex flex-col items-center justify-center p-8 gap-3 rotate-y-180`}>
              <h3 className="text-lg font-bold text-foreground">{analysis.term}</h3>
              <p className="text-base text-foreground font-semibold">{analysis.semanticCore.cn}</p>
              <p className="text-sm text-muted-foreground italic">{analysis.semanticCore.en}</p>
              {analysis.usageExamples.slice(0, 2).map((ex, i) => (
                <p key={i} className="text-xs text-muted-foreground text-center">
                  {ex.en}<br /><span className="text-muted-foreground/60">{ex.cn}</span>
                </p>
              ))}
              <span className="text-xs text-muted-foreground/50 mt-2">点击空白处翻回</span>
            </div>
          </div>
        </div>

        {/* 评分按钮 */}
        <div className="flex flex-wrap gap-2 mt-4 justify-center max-w-md">
          {([0, 1, 2, 3, 4, 5] as ReviewRating[]).map(rating => (
            <button
              key={rating}
              onClick={(e) => { e.stopPropagation(); handleRate(rating); }}
              className={`px-3 py-2 rounded-lg text-xs font-medium text-white ${RATING_COLORS[rating]} hover:opacity-80 transition-opacity`}
              title={RATING_LABELS[rating]}
            >
              {rating}
            </button>
          ))}
          <button
            onClick={handleSkip}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-500 hover:bg-slate-300 transition-colors"
          >
            跳过
          </button>
        </div>
        <div className="flex gap-2 text-[10px] text-muted-foreground/50">
          {RATING_LABELS.map((label, i) => (
            <span key={i}>{i}:{label}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

const StatBox: React.FC<{ value: number; label: string }> = ({ value, label }) => (
  <div className="bg-card border border-border rounded-xl p-3">
    <div className="text-xl font-bold text-foreground">{value}</div>
    <div className="text-[10px] text-muted-foreground">{label}</div>
  </div>
);

export default ReviewPanel;
