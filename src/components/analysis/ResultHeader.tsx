import React, { useState } from 'react';
import { SemanticAnalysis } from '../../types';
import { useToast } from '../../contexts/ToastContext';

interface ResultHeaderProps {
    analysis: SemanticAnalysis;
    onUpdate: (updated: SemanticAnalysis) => void;
}

const cleanString = (str: string) => str.replace(/[*_~`]/g, '');

const ResultHeader: React.FC<ResultHeaderProps> = ({ analysis, onUpdate }) => {
    const { showToast } = useToast();
    const [newTag, setNewTag] = useState('');

    const handleAddTag = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTag.trim()) return;
        const updated = {
            ...analysis,
            tags: [...new Set([...analysis.tags, newTag.trim()])]
        };
        onUpdate(updated);
        setNewTag('');
        showToast('标签已添加', 'success');
    };

    const handleRemoveTag = (tagToRemove: string) => {
        const updated = {
            ...analysis,
            tags: analysis.tags.filter(t => t !== tagToRemove)
        };
        onUpdate(updated);
    };

    return (
        <section className="space-y-6 animate-fade-in">
            {/* 类型标签 */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="badge-accent">{analysis.type}</span>
                <span className="badge inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-200 dark:bg-accent-900/40 text-accent-700 dark:text-accent-300">
                    {analysis.partOfSpeech}
                </span>
            </div>

            {/* 术语主标题 */}
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
                <h1 className="text-5xl lg:text-7xl font-bold text-warm-800 dark:text-warm-100 tracking-tight break-words">
                    {analysis.term.toUpperCase()}
                </h1>
                {analysis.rootForm && analysis.rootForm.toLowerCase() !== analysis.term.toLowerCase() && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400 border border-accent-200 dark:border-accent-900/40">
                        <span className="material-symbols-outlined text-base">conversion_path</span>
                        <span className="text-xs font-semibold">
                            词根: <span className="underline decoration-2 underline-offset-4 decoration-accent-300">{analysis.rootForm}</span>
                        </span>
                    </div>
                )}
            </div>

            {/* 标签管理 */}
            <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-warm-200/60 dark:border-warm-800/60 print:hidden">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-warm-500 dark:text-warm-400 uppercase tracking-wide">
                    <span className="material-symbols-outlined text-sm">sell</span> 标签
                </span>
                {analysis.tags.map((tag, i) => (
                    <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-100 dark:bg-accent-900/20 text-accent-700 dark:text-accent-300 text-[10px] font-semibold group">
                        #{tag}
                        <button onClick={() => handleRemoveTag(tag)} className="material-symbols-outlined text-[12px] opacity-50 group-hover:opacity-100 hover:text-error-500 transition-all">cancel</button>
                    </span>
                ))}
                <form onSubmit={handleAddTag} className="flex items-center gap-1.5">
                    <input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="添加标签..."
                        className="w-28 bg-bg-surface border border-warm-200 dark:border-warm-700 rounded-full text-[10px] py-1.5 px-3 font-medium focus:outline-none focus:border-accent-400 focus:shadow-glow transition-all"
                    />
                    <button type="submit" className="size-6 rounded-full bg-accent-100 dark:bg-accent-900/20 text-accent-600 dark:text-accent-400 flex items-center justify-center hover:bg-accent-200 dark:hover:bg-accent-900/40 transition-colors">
                        <span className="material-symbols-outlined text-sm font-bold">add</span>
                    </button>
                </form>
            </div>

            {/* 语境信息 */}
            <div className="p-5 rounded-xl bg-accent-50/50 dark:bg-accent-900/10 border border-accent-100 dark:border-accent-900/20">
                <p className="text-[10px] font-semibold text-accent-500 dark:text-accent-400 uppercase tracking-wide mb-2">原始语境</p>
                <p className="text-sm text-warm-700 dark:text-warm-300 leading-relaxed font-medium italic">
                    "{cleanString(analysis.context)}"
                </p>
            </div>
        </section>
    );
};

export default ResultHeader;
