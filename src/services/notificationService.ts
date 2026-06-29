/**
 * SmartLex NotificationService — T4.5
 * 浏览器通知 + 每日复习提醒
 */

import { getDueCards } from './spacedRepetition';
import type { ReviewCard } from '../types';

export const notificationService = {
  /** 请求浏览器通知权限 */
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  },

  /** 发送复习提醒通知 */
  sendReviewReminder(dueCards: ReviewCard[]): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const count = getDueCards(dueCards).length;
    if (count === 0) return;

    new Notification('SmartLex - 复习提醒', {
      body: `今日有 ${count} 个词条待复习`,
      icon: '/favicon.ico',
      tag: 'smartlex-review',
      requireInteraction: false,
    });
  },

  /** 批量分析完成通知 */
  notifyBatchComplete(count: number): void {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    new Notification('SmartLex - 分析完成', {
      body: `${count} 个词条已分析完成，快去知识库看看吧`,
      tag: 'smartlex-batch',
    });
  },

  /** Tauri 桌面通知（如果可用） */
  async sendTauriNotification(title: string, body: string): Promise<void> {
    try {
      if (window.__TAURI__) {
        const { sendNotification } = await import('@tauri-apps/plugin-notification');
        sendNotification({ title, body });
      }
    } catch {
      // Tauri 不可用时静默
    }
  },
};
