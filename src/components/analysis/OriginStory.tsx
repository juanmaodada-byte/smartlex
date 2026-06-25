import React from 'react';
import { SemanticAnalysis } from '../../types';

interface OriginStoryProps {
    analysis: SemanticAnalysis;
}

const cleanString = (str: string) => str.replace(/[*_~`]/g, '');

const OriginStory: React.FC<OriginStoryProps> = ({ analysis }) => {
    return (
        <section className="card depth-3">
            {/* Floating badge */}
            <div className="flex justify-end -mt-10 mb-4">
                <div className="badge badge-dark">
                    <span className="material-symbols-outlined text-sm">history_edu</span>
                    词源探源
                </div>
            </div>

            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em] text-right mb-5">
                Origin Story
            </p>

            <div className="bg-muted rounded-xl p-6 border-l-[3px] border-amber">
                <p className="text-base text-foreground leading-relaxed font-medium">
                    {cleanString(analysis.originStory)}
                </p>
            </div>
        </section>
    );
};

export default OriginStory;
