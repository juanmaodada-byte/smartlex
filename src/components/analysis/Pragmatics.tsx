import React from 'react';
import { SemanticAnalysis } from '../../types';

interface PragmaticsProps {
    analysis: SemanticAnalysis;
}

const cleanString = (str: string) => str.replace(/[*_~`]/g, '');

const PRAGMATIC_ITEMS = [
    {
        key: 'tone' as const,
        label: '语气',
        labelEn: 'Tone',
        icon: 'settings_voice',
        color: 'blue' as const,
    },
    {
        key: 'register' as const,
        label: '语域',
        labelEn: 'Register',
        icon: 'stairs',
        color: 'rose' as const,
    },
] as const;

const Pragmatics: React.FC<PragmaticsProps> = ({ analysis }) => {
    return (
        <div className="md:col-span-5 card depth-2 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="badge badge-purple">
                    <span className="material-symbols-outlined text-sm">psychology</span>
                    语用分析
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">Pragmatics</span>
            </div>

            {/* Pragmatic Items */}
            <div className="space-y-5 flex-1">
                {PRAGMATIC_ITEMS.map((item) => (
                    <div key={item.key} className="flex items-center gap-4 group">
                        <div className={`icon-box icon-box-${item.color} group-hover:translate-x-0.5 transition-transform`}>
                            <span className="material-symbols-outlined text-xl">{item.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em] mb-1">
                                {item.label} <span className="opacity-50 font-normal">({item.labelEn})</span>
                            </p>
                            <p className="text-base font-semibold text-foreground truncate">
                                {cleanString(analysis.pragmatics[item.key])}
                            </p>
                        </div>
                    </div>
                ))}

                {/* Nuance section */}
                <div className="pt-5 mt-auto border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.12em] mb-2">
                        语用细节 <span className="opacity-50 font-normal">(Nuance)</span>
                    </p>
                    <p className="text-sm text-foreground leading-relaxed bg-muted rounded-lg p-4 font-medium">
                        {cleanString(analysis.pragmatics.nuance_cn)}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Pragmatics;
