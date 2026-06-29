/**
 * SmartLex SpacedRepetition — T4.1/T4.2
 * SM-2 算法实现 + ReviewCard 管理
 */

import type { SemanticAnalysis, ReviewCard, ReviewRating } from '../types';
import { SM2_INITIAL_EF, SM2_MIN_EF } from '../../shared/constants';

/** 从 SemanticAnalysis 创建新复习卡片 */
export function createReviewCard(analysis: SemanticAnalysis): ReviewCard {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    analysisId: analysis.id,
    easinessFactor: SM2_INITIAL_EF,
    interval: 0,
    repetitions: 0,
    nextReviewDate: now.toISOString(), // 立即可复习
    lastReviewDate: '',
    reviewHistory: [],
  };
}

/**
 * SM-2 算法核心
 * @returns 更新后的卡片
 */
export function sm2(card: ReviewCard, rating: ReviewRating): ReviewCard {
  const now = new Date();

  if (rating >= 3) {
    // 正确响应
    if (card.repetitions === 0) {
      card.interval = 1;
    } else if (card.repetitions === 1) {
      card.interval = 6;
    } else {
      card.interval = Math.round(card.interval * card.easinessFactor);
    }
    card.repetitions++;
  } else {
    // 遗忘 — 重置
    card.repetitions = 0;
    card.interval = 1;
  }

  // EF 更新（最小 1.3）
  card.easinessFactor = Math.max(
    SM2_MIN_EF,
    card.easinessFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02)),
  );

  card.lastReviewDate = now.toISOString();
  const next = new Date(now);
  next.setDate(next.getDate() + card.interval);
  card.nextReviewDate = next.toISOString();

  card.reviewHistory.push({
    date: now.toISOString(),
    rating,
  });

  return card;
}

/** 按下次复习日期排序，筛选今天到期的卡片 */
export function getDueCards(allCards: ReviewCard[]): ReviewCard[] {
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return allCards
    .filter(c => new Date(c.nextReviewDate) <= todayEnd)
    .sort((a, b) => new Date(a.nextReviewDate).getTime() - new Date(b.nextReviewDate).getTime());
}

/** 统计学习数据 */
export function getStudyStats(cards: ReviewCard[]) {
  const totalReviews = cards.reduce((s, c) => s + c.reviewHistory.length, 0);
  const mastered = cards.filter(c => c.repetitions >= 3).length;
  const due = getDueCards(cards).length;
  return { total: cards.length, totalReviews, mastered, due };
}

// ═══ 统计面板辅助函数 ═══

/** 按日期聚合复习次数（最近 N 天），返回每日计数（包含零值天） */
export function getDailyReviewCounts(
  cards: ReviewCard[],
  days: number,
): { date: string; count: number; dayLabel: string }[] {
  const result: { date: string; count: number; dayLabel: string }[] = [];
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  // 构建最近 N 天的日期列表
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    result.push({ date: dateStr, count: 0, dayLabel: dayNames[d.getDay()] });
  }

  // 聚合复习事件
  for (const card of cards) {
    for (const record of card.reviewHistory) {
      const recordDate = record.date.slice(0, 10);
      const bucket = result.find(b => b.date === recordDate);
      if (bucket) bucket.count++;
    }
  }

  return result;
}

/** 评分分布统计（0-5 每档的计数） */
export function getRatingDistribution(
  cards: ReviewCard[],
): { rating: number; count: number; percentage: number }[] {
  const counts: number[] = [0, 0, 0, 0, 0, 0];
  let total = 0;

  for (const card of cards) {
    for (const record of card.reviewHistory) {
      if (record.rating >= 0 && record.rating <= 5) {
        counts[record.rating]++;
        total++;
      }
    }
  }

  return counts.map((count, rating) => ({
    rating,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
  }));
}

/** 按间隔分桶 */
export function getIntervalBuckets(
  cards: ReviewCard[],
): { bucket: string; emoji: string; range: string; count: number }[] {
  const buckets = [
    { bucket: 'new', emoji: '🆕', range: '0 天', min: -1, max: 0, count: 0 },
    { bucket: 'learning', emoji: '📖', range: '1-2 天', min: 1, max: 2, count: 0 },
    { bucket: 'consolidating', emoji: '🔁', range: '3-7 天', min: 3, max: 7, count: 0 },
    { bucket: 'long-term', emoji: '💪', range: '8-30 天', min: 8, max: 30, count: 0 },
    { bucket: 'mastered', emoji: '🧠', range: '30+ 天', min: 31, max: Infinity, count: 0 },
  ];

  for (const card of cards) {
    for (const b of buckets) {
      if (card.interval >= b.min && card.interval <= b.max) {
        b.count++;
        break;
      }
    }
  }

  return buckets;
}
