/**
 * SmartLex Export Service — T3.5/T3.6
 * Anki CSV 导出 + JSON 增强导出
 */

import type { SemanticAnalysis } from '../types';

/** 导出 Anki CSV 格式 */
export function exportAnkiCSV(items: SemanticAnalysis[]): void {
  const header = 'term,definition_cn,definition_en,context,examples,pos,type,tags';
  const rows = items.map(item => {
    const defCn = item.semanticCore.cn.replace(/"/g, '""');
    const defEn = item.semanticCore.en.replace(/"/g, '""');
    const ctx = (item.context || '').replace(/"/g, '""');
    const examples = item.usageExamples
      .map(ex => `${ex.en} (${ex.cn})`)
      .join(' | ')
      .replace(/"/g, '""');
    const tags = item.tags.join(' ');

    return `"${item.term}","${defCn}","${defEn}","${ctx}","${examples}","${item.partOfSpeech}","${item.type}","${tags}"`;
  });

  const csv = [header, ...rows].join('\n');
  downloadFile(csv, `smartlex_anki_${today()}.csv`, 'text/csv;charset=utf-8');
}

/** 导出增强 JSON（含完整字段） */
export function exportEnhancedJSON(items: SemanticAnalysis[]): void {
  const data = {
    exportedAt: new Date().toISOString(),
    version: '1.2.0',
    count: items.length,
    items,
  };
  const json = JSON.stringify(data, null, 2);
  downloadFile(json, `smartlex_export_${today()}.json`, 'application/json');
}

function downloadFile(content: string, filename: string, mime: string): void {
  const blob = new Blob(['﻿' + content], { type: mime }); // BOM for Excel UTF-8
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}
