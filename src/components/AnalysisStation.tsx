import React, { useState, useRef, useEffect } from 'react';

const FUN_FACTS = [
  { en: "New words are created every 98 minutes.", cn: "每98分钟就有一个新单词诞生。" },
  { en: "There are over 7,000 languages spoken worldwide.", cn: "全世界有超过7000种语言。" },
  { en: "The most common letter in English is 'e'.", cn: "英语中最常见的字母是 'e'。" },
  { en: "The oldest written language is Sumerian.", cn: "最古老的书面语言是苏美尔语。" },
  { en: "Mandarin Chinese has the most native speakers.", cn: "普通话是母语使用者最多的语言。" },
  { en: "'Set' has the most definitions in the dictionary.", cn: "单词 'Set' 是字典中释义最多的词。" },
  { en: "A 'polyglot' is someone who speaks many languages.", cn: "'Polyglot' 指通晓多种语言的人。" },
  { en: "Language shapes how we think and perceive the world.", cn: "语言塑造了我们思考和感知世界的方式。" }
];

interface AnalysisStationProps {
  onAnalyze: (term: string, context: string, imageBase64?: string) => void;
  onOpenHistory: () => void;
  isAnalyzing: boolean;
}

const AnalysisStation: React.FC<AnalysisStationProps> = ({ onAnalyze, onOpenHistory, isAnalyzing }) => {
  const [term, setTerm] = useState('');
  const [context, setContext] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [funFactIndex, setFunFactIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let interval: any;
    if (isAnalyzing) {
      interval = setInterval(() => {
        setFunFactIndex((prev) => (prev + 1) % FUN_FACTS.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const canSubmit = term.trim() && (context.trim() || image);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-bg-app dark:bg-warm-950">
      {/* ─── 页面 Header ─── */}
      <div className="flex items-center justify-between px-6 lg:px-10 h-14 border-b border-warm-200/60 dark:border-warm-800/60 shrink-0 bg-bg-surface/50 dark:bg-warm-900/30 backdrop-blur-sm">
        <h1 className="text-sm font-bold text-warm-600 dark:text-warm-400 tracking-wide">分析工作台</h1>
        <button
          onClick={onOpenHistory}
          className="flex items-center gap-1.5 text-xs font-medium text-warm-500 dark:text-warm-400 hover:text-warm-800 dark:hover:text-warm-200 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-warm-100 dark:hover:bg-warm-800/50"
        >
          <span className="material-symbols-outlined text-base">history</span>
          <span className="hidden sm:inline">历史记录</span>
        </button>
      </div>

      {/* ─── 主内容区 ─── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-full py-10 px-6">

          {/* 标题 */}
          <div className="text-center mb-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400 text-xs font-semibold tracking-wide">
              <span className="material-symbols-outlined text-sm">psychology</span>
              深度语义分析引擎
            </div>
            <h2 className="text-3xl lg:text-4xl font-bold text-warm-800 dark:text-warm-100 tracking-tight">
              探索语言的深层含义
            </h2>
            <p className="text-sm text-warm-500 dark:text-warm-400 max-w-md mx-auto">
              输入任意词汇或短语，获取其语义核心、语用分析、搭配用法和起源故事
            </p>
          </div>

          {/* 分析表单卡片 */}
          {!isAnalyzing ? (
            <div className="w-full animate-scale-in">
              <div className="card p-6 lg:p-8 space-y-6 shadow-lg border-warm-200/40 dark:border-warm-800/40">
                {/* 术语输入 */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-warm-500 dark:text-warm-400 uppercase tracking-wide">
                    <span className="material-symbols-outlined text-sm">target</span>
                    目标术语
                  </label>
                  <input
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    className="input-lg text-lg font-medium"
                    placeholder='输入要分析的词或短语，如 "Silver Lining"...'
                    type="text"
                    autoFocus
                  />
                </div>

                {/* 语境输入 */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-warm-500 dark:text-warm-400 uppercase tracking-wide">
                    <span className="material-symbols-outlined text-sm">contextual_token</span>
                    原始语境 <span className="font-normal text-warm-400">（可选，帮助 AI 理解上下文）</span>
                  </label>
                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    className="input-lg resize-none min-h-[100px]"
                    placeholder="请输入包含该术语的原始句子或段落..."
                  />
                </div>

                {/* 图片上传 */}
                {image && (
                  <div className="relative inline-block animate-scale-in">
                    <div className="rounded-lg overflow-hidden border border-warm-200 dark:border-warm-700 shadow-sm w-28">
                      <img src={image} alt="视觉语境" className="w-full h-20 object-cover" />
                    </div>
                    <button
                      onClick={removeImage}
                      className="absolute -top-2 -right-2 size-6 rounded-full bg-error-500 text-white flex items-center justify-center shadow-md hover:bg-error-600 transition-colors"
                    >
                      <span className="material-symbols-outlined text-xs font-bold">close</span>
                    </button>
                  </div>
                )}

                {/* 操作区 */}
                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-warm-400 hover:text-warm-600 dark:hover:text-warm-300 cursor-pointer transition-colors px-3 py-2 rounded-lg hover:bg-warm-50 dark:hover:bg-warm-800/50">
                    <span className="material-symbols-outlined text-base">add_photo_alternate</span>
                    添加图片
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </label>

                  <button
                    onClick={() => term && (context || image) && onAnalyze(term, context)}
                    disabled={!canSubmit}
                    className="btn-primary px-8 py-3 text-sm font-semibold rounded-xl shadow-lg shadow-accent-500/20 hover:shadow-xl hover:shadow-accent-500/25 gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">bolt</span>
                    开始分析
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* 加载状态 */
            <div className="w-full animate-scale-in">
              <div className="card p-10 flex flex-col items-center gap-8 shadow-lg border-warm-200/40 dark:border-warm-800/40">
                {/* 加载动画 */}
                <div className="relative">
                  <div className="size-20 rounded-2xl bg-accent-500 flex items-center justify-center shadow-lg shadow-accent-500/25 animate-pulse">
                    <span className="material-symbols-outlined text-4xl text-white animate-spin" style={{ animationDuration: '3s' }}>progress_activity</span>
                  </div>
                  <div className="absolute -bottom-2 -right-2 size-8 rounded-full bg-success-500 flex items-center justify-center shadow-md animate-bounce" style={{ animationDelay: '0.3s' }}>
                    <span className="material-symbols-outlined text-white text-sm">psychology</span>
                  </div>
                </div>

                {/* 状态文字 */}
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-bold text-warm-800 dark:text-warm-200">
                    正在分析语义结构...
                  </h3>
                  <p className="text-sm text-warm-400">
                    调用 AI 模型进行深度语义解析，通常需要 3-10 秒
                  </p>
                </div>

                {/* 进度条动画 */}
                <div className="w-48 h-1.5 rounded-full bg-warm-100 dark:bg-warm-800 overflow-hidden">
                  <div className="h-full rounded-full bg-accent-500 animate-pulse" style={{ width: '70%' }} />
                </div>

                {/* 趣闻卡片 */}
                <div className="w-full max-w-sm bg-accent-50/50 dark:bg-accent-900/10 rounded-xl p-5 border border-accent-100 dark:border-accent-900/20">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">💡</span>
                    <span className="text-xs font-semibold text-accent-600 dark:text-accent-400 uppercase tracking-wide">你知道吗？</span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-warm-700 dark:text-warm-300 animate-fade-in" key={funFactIndex}>
                      "{FUN_FACTS[funFactIndex].en}"
                    </p>
                    <p className="text-xs text-warm-500 dark:text-warm-400 animate-fade-in">
                      "{FUN_FACTS[funFactIndex].cn}"
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisStation;
