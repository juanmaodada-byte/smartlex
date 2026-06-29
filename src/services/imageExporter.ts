/**
 * SmartLex ImageExporter — T5.4
 * 词汇卡片图片生成 (Canvas via html2canvas)
 */

import html2canvas from 'html2canvas';
import type { SemanticAnalysis } from '../types';

/** 导出单张词汇卡片为 PNG */
export async function exportCardImage(item: SemanticAnalysis): Promise<void> {
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
  container.innerHTML = buildCardHTML(item);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container.firstElementChild as HTMLElement, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob(b => resolve(b!), 'image/png')
    );

    downloadBlob(blob, `smartlex_${item.term.replace(/\s+/g, '_')}.png`);
  } finally {
    document.body.removeChild(container);
  }
}

/** 导出多张卡片拼接为长图 */
export async function exportCardGrid(items: SemanticAnalysis[]): Promise<void> {
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;display:flex;flex-direction:column;gap:16px;padding:16px;background:#f8fafc;';
  container.innerHTML = items.map(item => buildCardHTML(item)).join('');
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: '#f8fafc',
      logging: false,
    });

    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob(b => resolve(b!), 'image/png')
    );

    downloadBlob(blob, `smartlex_export_${items.length}cards.png`);
  } finally {
    document.body.removeChild(container);
  }
}

function buildCardHTML(item: SemanticAnalysis): string {
  const examples = item.usageExamples
    .slice(0, 2)
    .map(ex => `<p style="margin:2px 0;font-size:12px;color:#475569;">📝 ${ex.en}<br/><span style="color:#94a3b8;">${ex.cn}</span></p>`)
    .join('');

  const tags = item.tags
    .map(t => `<span style="display:inline-block;padding:2px 8px;margin:2px;border-radius:8px;background:#e0e7ff;color:#4338ca;font-size:10px;font-weight:600;">#${t}</span>`)
    .join('');

  return `
    <div style="
      width:400px;padding:24px;border-radius:16px;background:#fff;
      box-shadow:0 4px 24px rgba(0,0,0,0.08);font-family:-apple-system,BlinkMacSystemFont,sans-serif;
      border-left:4px solid #6366f1;
    ">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;">
        <h2 style="font-size:24px;font-weight:800;color:#1e293b;margin:0;">${escapeHtml(item.term)}</h2>
        <span style="font-size:11px;color:#94a3b8;padding:4px 8px;background:#f1f5f9;border-radius:6px;">${item.partOfSpeech}</span>
      </div>
      <p style="font-size:15px;color:#1e293b;font-weight:600;margin:8px 0 4px;">${escapeHtml(item.semanticCore.cn)}</p>
      <p style="font-size:13px;color:#64748b;margin:0 0 8px;font-style:italic;">${escapeHtml(item.semanticCore.en)}</p>
      ${item.context ? `<p style="font-size:12px;color:#94a3b8;margin:8px 0;padding:8px 12px;background:#f8fafc;border-radius:8px;line-height:1.5;">📖 ${escapeHtml(item.context)}</p>` : ''}
      ${examples}
      <div style="margin-top:12px;">${tags}</div>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:10px;color:#cbd5e1;">SmartLex</span>
        <span style="font-size:10px;color:#cbd5e1;">${new Date(item.timestamp).toLocaleDateString('zh-CN')}</span>
      </div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
