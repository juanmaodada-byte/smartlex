import React, { useState } from 'react';
import { SemanticAnalysis } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { generateMoreExamples } from '../../aiService';

interface UsageExamplesProps {
    analysis: SemanticAnalysis;
    onUpdate: (updated: SemanticAnalysis) => void;
}

const cleanString = (str: string) => str.replace(/[*_~`]/g, '');

const CATEGORIES = [
    { value: 'General', label: '通用' },
    { value: 'Business', label: '商务' },
    { value: 'Literary', label: '文学' },
    { value: 'Slang', label: '俚语' },
    { value: 'Academic', label: '学术' },
] as const;

const UsageExamples: React.FC<UsageExamplesProps> = ({ analysis, onUpdate }) => {
    const { showToast } = useToast();
    const [isGenerating, setIsGenerating] = useState(false);
    const [isAddingExample, setIsAddingExample] = useState(false);
    const [newEx, setNewEx] = useState({ en: '', cn: '', category: 'General' });

    const handleGenerateMore = async () => {
        setIsGenerating(true);
        try {
            const more = await generateMoreExamples(analysis.term, analysis.context);
            const updated = {
                ...analysis,
                usageExamples: [...analysis.usageExamples, ...more]
            };
            onUpdate(updated);
            showToast('AI 已成功生成更多例句', 'success');
        } catch (err) {
            console.error(err);
            showToast('AI 生成失败，请重试', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAddCustomExample = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEx.en || !newEx.cn) return;
        const updated = {
            ...analysis,
            usageExamples: [...analysis.usageExamples, { ...newEx }]
        };
        onUpdate(updated);
        setNewEx({ en: '', cn: '', category: 'General' });
        setIsAddingExample(false);
        showToast('自定义例句已添加', 'success');
    };

    const handleRemoveExample = (index: number) => {
        const updated = {
            ...analysis,
            usageExamples: analysis.usageExamples.filter((_, i) => i !== index)
        };
        onUpdate(updated);
    };

    return (
        <section className="space-y-6">
            {/* Section Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-3">
                    <div className="badge badge-amber">
                        <span className="material-symbols-outlined text-sm">explore</span>
                        用法探索
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">Examples</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleGenerateMore}
                        disabled={isGenerating}
                        className="btn btn-ghost text-xs gap-1.5"
                    >
                        <span className={`material-symbols-outlined text-sm ${isGenerating ? 'animate-spin' : ''}`}>
                            auto_awesome
                        </span>
                        {isGenerating ? '生成中...' : 'AI 扩展'}
                    </button>
                    <button
                        onClick={() => setIsAddingExample(!isAddingExample)}
                        className="btn btn-secondary text-xs gap-1.5"
                    >
                        <span className="material-symbols-outlined text-sm">add_circle</span>
                        自定义
                    </button>
                </div>
            </div>

            {/* Add Example Form */}
            {isAddingExample && (
                <form onSubmit={handleAddCustomExample} className="card depth-2 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em] ml-1">
                                English Example
                            </label>
                            <input
                                placeholder="输入英文例句..."
                                className="input text-sm"
                                value={newEx.en}
                                onChange={(e) => setNewEx({ ...newEx, en: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em] ml-1">
                                Chinese Translation
                            </label>
                            <input
                                placeholder="输入中文翻译..."
                                className="input text-sm"
                                value={newEx.cn}
                                onChange={(e) => setNewEx({ ...newEx, cn: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                        <select
                            value={newEx.category}
                            onChange={(e) => setNewEx({ ...newEx, category: e.target.value })}
                            className="input text-xs w-auto"
                        >
                            {CATEGORIES.map((cat) => (
                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                            ))}
                        </select>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setIsAddingExample(false)}
                                className="btn btn-ghost text-xs"
                            >
                                取消
                            </button>
                            <button type="submit" className="btn btn-primary text-xs">
                                添加例句
                            </button>
                        </div>
                    </div>
                </form>
            )}

            {/* Examples Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysis.usageExamples.map((ex, i) => (
                    <div
                        key={i}
                        className="card depth-1 group hover:depth-2 transition-all duration-200 relative"
                    >
                        {/* Category badge & remove */}
                        <div className="flex items-center justify-between mb-4">
                            <span className="chip chip-sm">
                                {ex.category}
                            </span>
                            <button
                                onClick={() => handleRemoveExample(i)}
                                className="opacity-0 group-hover:opacity-100 material-symbols-outlined text-base text-muted-foreground hover:text-destructive transition-all font-bold"
                            >
                                delete
                            </button>
                        </div>

                        {/* English example */}
                        <blockquote className="text-base font-medium text-foreground leading-relaxed mb-4 border-l-[3px] border-primary/30 pl-4">
                            &ldquo;{cleanString(ex.en)}&rdquo;
                        </blockquote>

                        {/* Chinese translation */}
                        <p className="text-sm text-muted-foreground leading-relaxed pt-3 border-t border-border italic">
                            {cleanString(ex.cn)}
                        </p>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default UsageExamples;
