import React from 'react';
import { SemanticAnalysis } from '../../types';

interface ChatResultProps {
    analysis: SemanticAnalysis;
    onOpenHistory: () => void;
    onSave: () => void;
    isSaved: boolean;
}

const cleanString = (str: string) => str.replace(/[*_~`]/g, '');

const ChatResult: React.FC<ChatResultProps> = ({ analysis, onOpenHistory, onSave, isSaved }) => {
    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-background relative">
            {/* Top Bar */}
            <header className="h-14 flex items-center justify-between px-5 border-b border-border shrink-0 bg-card/80 backdrop-blur-sm z-20">
                <button
                    onClick={onOpenHistory}
                    className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                    <span className="material-symbols-outlined text-lg">history</span>
                    <span>历史记录</span>
                    <span className="material-symbols-outlined text-sm text-muted-foreground/40">chevron_right</span>
                    <span className="text-foreground">对话</span>
                </button>
                <button
                    onClick={onSave}
                    disabled={isSaved}
                    className={`btn text-xs gap-1.5 ${
                        isSaved
                            ? 'btn-ghost text-success cursor-default'
                            : 'btn-success'
                    }`}
                >
                    <span className="material-symbols-outlined text-sm">
                        {isSaved ? 'check_circle' : 'bookmark_add'}
                    </span>
                    {isSaved ? '已保存' : '保存'}
                </button>
            </header>

            {/* Chat Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-3xl mx-auto p-6 lg:p-10 space-y-8">
                    {/* User Message */}
                    <div className="flex gap-4 items-start flex-row-reverse">
                        <div className="avatar avatar-blue shrink-0">
                            <span className="material-symbols-outlined text-white text-xl">person</span>
                        </div>
                        <div className="card depth-2 rounded-2xl rounded-tr-sm flex-1">
                            <p className="text-[10px] font-semibold text-primary uppercase tracking-[0.15em] mb-2 pb-2 border-b border-border">
                                User Query
                            </p>
                            <p className="text-lg font-semibold text-foreground leading-relaxed">
                                &ldquo;{analysis.term}&rdquo;
                            </p>
                            {analysis.context && analysis.context !== 'General Context' && (
                                <p className="mt-3 text-xs text-muted-foreground bg-muted rounded-lg p-2.5 font-medium">
                                    Context: {analysis.context}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* AI Response */}
                    <div className="flex gap-4 items-start">
                        <div className="avatar avatar-amber shrink-0">
                            <span className="material-symbols-outlined text-foreground text-xl">smart_toy</span>
                        </div>
                        <div className="card depth-3 rounded-2xl rounded-tl-sm flex-1">
                            <div className="badge badge-rose mb-4">
                                <span className="material-symbols-outlined text-xs">history_edu</span>
                                Origin Story
                            </div>
                            <div className="prose prose-sm max-w-none">
                                <p className="text-base text-foreground leading-8 whitespace-pre-wrap font-medium">
                                    {cleanString(analysis.originStory)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatResult;
