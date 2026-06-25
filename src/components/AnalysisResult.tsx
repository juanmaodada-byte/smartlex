import React from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { AnalysisType } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useStore } from '../contexts/StoreContext';

import ResultHeader from './analysis/ResultHeader';
import SemanticCore from './analysis/SemanticCore';
import Pragmatics from './analysis/Pragmatics';
import LinguisticNetwork from './analysis/LinguisticNetwork';
import UsageExamples from './analysis/UsageExamples';
import OriginStory from './analysis/OriginStory';
import ChatResult from './analysis/ChatResult';

interface AnalysisResultProps {
  onOpenHistory: () => void;
  breadcrumbLabel?: string;
  onBreadcrumbClick?: () => void;
}

const AnalysisResult: React.FC<AnalysisResultProps> = ({ onOpenHistory, breadcrumbLabel = '历史记录', onBreadcrumbClick }) => {
  const { showToast } = useToast();
  const { currentAnalysis, updateAnalysis, addToLibrary, library } = useStore();

  if (!currentAnalysis) return null;

  const isSaved = library.some(i => i.id === currentAnalysis.id);

  const handleSave = () => {
    addToLibrary(currentAnalysis);
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentAnalysis, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `SmartLex_${currentAnalysis.term.replace(/\s+/g, '_')}.json`;
    a.click();
    showToast('JSON 导出成功', 'success');
  };

  const handleExportPDF = async () => {
    const exportMenu = document.querySelector('.group\\/export .absolute');
    if (exportMenu) (exportMenu as HTMLElement).style.display = 'none';

    const element = document.getElementById('analysis-report');
    if (!element) return;

    try {
      showToast('正在生成 PDF...', 'info');
      const clone = element.cloneNode(true) as HTMLElement;
      clone.style.height = 'auto';
      clone.style.overflow = 'visible';
      clone.style.width = `${element.offsetWidth}px`;
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      clone.style.background = '#ffffff';
      clone.classList.remove('flex-1', 'overflow-y-auto');

      document.body.appendChild(clone);
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: element.scrollWidth,
        windowHeight: clone.scrollHeight
      });

      document.body.removeChild(clone);
      if (exportMenu) (exportMenu as HTMLElement).style.display = '';

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`SmartLex_Report_${currentAnalysis.term}.pdf`);
      showToast('PDF 下载成功', 'success');
    } catch (error) {
      console.error('PDF generation failed', error);
      showToast('PDF 生成失败', 'error');
      if (exportMenu) (exportMenu as HTMLElement).style.display = '';
    }
  };

  if (currentAnalysis.type === AnalysisType.CHAT) {
    return (
      <ChatResult
        analysis={currentAnalysis}
        onOpenHistory={onOpenHistory}
        onSave={handleSave}
        isSaved={isSaved}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden print:overflow-visible bg-bg-app dark:bg-warm-950 print:bg-white print:text-black">
      {/* ─── Header ─── */}
      <header className="h-14 flex items-center justify-between px-5 bg-bg-surface/80 dark:bg-warm-900/80 backdrop-blur-xl border-b border-warm-200/60 dark:border-warm-800/60 shrink-0 print:hidden z-20">
        <div className="flex items-center gap-2 text-xs font-medium text-warm-500 dark:text-warm-400">
          <button onClick={onBreadcrumbClick || onOpenHistory} className="hover:text-accent-600 dark:hover:text-accent-400 transition-colors">
            {breadcrumbLabel}
          </button>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-warm-700 dark:text-warm-300 font-semibold">分析结果</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={isSaved}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 ${isSaved
                ? 'bg-warm-100 dark:bg-warm-800 text-warm-400 cursor-default'
                : 'bg-success-500 text-white hover:bg-success-600 active:scale-[0.98] shadow-sm'
              }`}
          >
            <span className="material-symbols-outlined text-sm">{isSaved ? 'check_circle' : 'bookmark_add'}</span>
            {isSaved ? '已保存' : '保存到知识库'}
          </button>
        </div>
      </header>

      {/* ─── 内容区 ─── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-12 print:p-0 print:overflow-visible" id="analysis-report">
        <div className="max-w-4xl mx-auto space-y-8 pb-24 print:space-y-6">

          <ResultHeader analysis={currentAnalysis} onUpdate={updateAnalysis} />

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            <SemanticCore analysis={currentAnalysis} />
            <Pragmatics analysis={currentAnalysis} />
          </div>

          <LinguisticNetwork analysis={currentAnalysis} onUpdate={updateAnalysis} />

          <UsageExamples analysis={currentAnalysis} onUpdate={updateAnalysis} />

          <OriginStory analysis={currentAnalysis} />

          {/* ─── 诊断 Footer ─── */}
          <div className="pt-6 border-t border-warm-200/60 dark:border-warm-800/60 flex items-center justify-between text-[10px] text-warm-400 font-mono tracking-wide opacity-60 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className={`size-1.5 rounded-full ${currentAnalysis.meta?.latencyMs && currentAnalysis.meta.latencyMs < 5000 ? 'bg-success-500' : 'bg-warning-500'}`} />
                {currentAnalysis.meta?.latencyMs ? `${(currentAnalysis.meta.latencyMs / 1000).toFixed(2)}s` : 'N/A'}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[10px]">dns</span>
                {currentAnalysis.meta?.model || 'Default'}
              </span>
            </div>
            <span className="truncate max-w-[200px]">{currentAnalysis.id}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisResult;
