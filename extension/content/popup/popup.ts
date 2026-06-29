/**
 * SmartLex Toolbar Popup — 引导页 + 快速状态概览
 *
 * 显示：待处理数 / 今日捕获数 / 待复习数 + 打开 App / 同步
 */

// ============================================================
// 初始化：读取存储并填充 UI
// ============================================================

async function init(): Promise<void> {
  const data = await chrome.storage.local.get([
    'smartlex_inbox',
    'smartlex_settings',
    'smartlex_daily_count',
    'smartlex_daily_date',
  ]);

  const inbox: any[] = data['smartlex_inbox'] || [];

  // ── Inbox Badge ──
  const badge = document.getElementById('inbox-badge');
  if (badge) {
    const count = inbox.length;
    badge.textContent = String(count);
    if (count === 0) {
      badge.dataset.count = '0';
    }
    badge.title = count > 0 ? `${count} 个待处理词条` : '暂无待处理词条';
  }

  // ── 待处理 ──
  const statInbox = document.getElementById('stat-inbox');
  if (statInbox) {
    statInbox.textContent = String(inbox.length);
  }

  // ── 今日捕获 ──
  const todayStr = new Date().toDateString();
  const dailyDate = data['smartlex_daily_date'];
  const statToday = document.getElementById('stat-today');
  if (statToday) {
    if (dailyDate === todayStr) {
      statToday.textContent = String(data['smartlex_daily_count'] || 0);
    } else {
      statToday.textContent = '0';
    }
  }

  // ── 待复习 ──
  const statReview = document.getElementById('stat-review');
  if (statReview) {
    try {
      const reviewData = await chrome.storage.local.get('smartlex_review_queue');
      const queue: any[] = reviewData['smartlex_review_queue'] || [];
      const now = new Date();
      const due = queue.filter((card: any) => {
        if (!card.nextReviewDate) return false;
        return new Date(card.nextReviewDate) <= now;
      });
      statReview.textContent = String(due.length);
    } catch {
      statReview.textContent = '0';
    }
  }
}

// ============================================================
// 按钮事件
// ============================================================

// ── 打开 SmartLex ──
document.getElementById('btn-open-app')?.addEventListener('click', async () => {
  const appUrl = 'http://localhost:3000';

  // 优先聚焦已打开的标签页，避免重复打开导致渲染异常
  try {
    const existing = await chrome.tabs.query({ url: appUrl + '/*' });
    if (existing.length > 0 && existing[0].id) {
      await chrome.tabs.update(existing[0].id, { active: true });
      // 如果标签页所在窗口不是当前窗口，也聚焦窗口
      if (existing[0].windowId) {
        await chrome.windows.update(existing[0].windowId, { focused: true });
      }
      return; // 已有标签页，聚焦即可
    }
  } catch {
    // query 失败（如无 tabs 权限），回退到新建
  }

  // 没有已打开的标签页 → 新建
  await chrome.tabs.create({ url: appUrl });
});

// ── 同步按钮 ──
document.getElementById('btn-sync')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-sync');
  if (!btn) return;

  const originalText = btn.textContent;
  btn.textContent = '⏳ 同步中…';
  btn.setAttribute('disabled', 'true');

  try {
    // 通过 Service Worker 转发同步请求到已打开的 Web App 标签页
    // Popup → SW (TRIGGER_SYNC) → Content Script on localhost → custom event → Web App
    await chrome.runtime.sendMessage({ type: 'TRIGGER_SYNC' });
    btn.textContent = '✅ 已发送';
  } catch {
    btn.textContent = '⚠️ 失败';
  }

  setTimeout(() => {
    btn.textContent = originalText;
    btn.removeAttribute('disabled');
  }, 2000);
});

// ============================================================
// 启动
// ============================================================

init();
