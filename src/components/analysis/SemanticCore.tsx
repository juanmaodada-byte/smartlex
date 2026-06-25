import React from 'react';
import { SemanticAnalysis } from '../../types';

interface SemanticCoreProps {
    analysis: SemanticAnalysis;
}

const cleanString = (str: string) => str.replace(/[*_~`]/g, '');

const SemanticCore: React.FC<SemanticCoreProps> = ({ analysis }) => {
    return (
        <div className="md:col-span-7 card depth-2">
            {/* Header badge */}
            <div className="flex items-center gap-3 mb-8">
                <div className="badge badge-amber">
                    <span className="material-symbols-outlined text-sm">token</span>
                    语义核心
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">Semantic Core</span>
            </div>

            <div className="space-y-8">
                {/* 1. Original Definition */}
                <div className="group">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">原始释义</span>
                    </div>
                    <blockquote className="text-xl font-semibold leading-relaxed border-l-[3px] border-primary pl-5 py-1 text-foreground">
                        &ldquo;{cleanString(analysis.semanticCore.en)}&rdquo;
                    </blockquote>
                    {analysis.semanticCore.cn_definition && (
                        <p className="text-sm text-muted-foreground mt-2 ml-6 italic">
                            &mdash; {cleanString(analysis.semanticCore.cn_definition)}
                        </p>
                    )}
                </div>

                {/* 2. Contextual Meaning */}
                <div className="relative">
                    <div className="absolute -left-1 top-1 w-2 h-2 bg-info rounded-full ring-2 ring-info/20" />
                    <div className="ml-6 pl-5 border-l-[3px] border-info/20">
                        <div className="badge badge-blue mb-3">
                            <span className="material-symbols-outlined text-xs">layers</span>
                            语境含义
                        </div>
                        {analysis.semanticCore.contextualMeaning ? (
                            <div className="bg-info/5 rounded-xl p-5 border border-info/10">
                                <p className="text-lg font-semibold text-foreground leading-relaxed mb-2">
                                    {cleanString(analysis.semanticCore.contextualMeaning.en)}
                                </p>
                                <p className="text-sm text-info font-medium italic">
                                    {cleanString(analysis.semanticCore.contextualMeaning.cn)}
                                </p>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground/60 italic py-2">
                                未检测到特定语境变体
                            </p>
                        )}
                    </div>
                </div>

                {/* 3. Direct Translation */}
                <div>
                    <div className="badge badge-green mb-3">
                        <span className="material-symbols-outlined text-xs">translate</span>
                        通用对应词
                    </div>
                    <p className="text-2xl font-bold text-foreground leading-relaxed tracking-tight">
                        {cleanString(analysis.semanticCore.cn)}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SemanticCore;
