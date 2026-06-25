import React, { useState } from 'react';
import { SemanticAnalysis } from '../../types';
import { useToast } from '../../contexts/ToastContext';

interface LinguisticNetworkProps {
    analysis: SemanticAnalysis;
    onUpdate: (updated: SemanticAnalysis) => void;
}

const cleanString = (str: string) => str.replace(/[*_~`]/g, '');

const LinguisticNetwork: React.FC<LinguisticNetworkProps> = ({ analysis, onUpdate }) => {
    const { showToast } = useToast();
    const [newSynonym, setNewSynonym] = useState('');

    const handleAddSynonym = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSynonym.trim()) return;
        const updated = {
            ...analysis,
            synonyms: [...new Set([...analysis.synonyms, newSynonym.trim()])]
        };
        onUpdate(updated);
        setNewSynonym('');
        showToast('近义词已添加', 'success');
    };

    const handleRemoveSynonym = (syn: string) => {
        const updated = {
            ...analysis,
            synonyms: analysis.synonyms.filter(s => s !== syn)
        };
        onUpdate(updated);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Synonyms */}
            <section className="card depth-3">
                <div className="badge badge-blue -mt-10 mb-4 mx-auto">
                    <span className="material-symbols-outlined text-sm">hub</span>
                    语义网络
                </div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em] text-center mb-4">
                    Synonyms
                </p>

                {/* Synonyms list */}
                <div className="flex flex-wrap gap-2 mb-5 min-h-[48px]">
                    {analysis.synonyms.length === 0 ? (
                        <p className="text-sm text-muted-foreground/50 italic w-full text-center py-3">
                            暂无近义词
                        </p>
                    ) : (
                        analysis.synonyms.map((syn, i) => (
                            <span
                                key={i}
                                className="chip group"
                            >
                                {cleanString(syn)}
                                <button
                                    onClick={() => handleRemoveSynonym(syn)}
                                    className="material-symbols-outlined text-[14px] text-muted-foreground/40 hover:text-destructive transition-colors font-bold"
                                >
                                    close
                                </button>
                            </span>
                        ))
                    )}
                </div>

                {/* Add synonym form */}
                <form onSubmit={handleAddSynonym} className="flex gap-2 pt-4 border-t border-border">
                    <input
                        value={newSynonym}
                        onChange={(e) => setNewSynonym(e.target.value)}
                        placeholder="添加近义词..."
                        className="input flex-1 text-sm"
                    />
                    <button
                        type="submit"
                        className="btn-icon btn-icon-success"
                    >
                        <span className="material-symbols-outlined text-sm">add</span>
                    </button>
                </form>
            </section>

            {/* Collocations */}
            <section className="card depth-3">
                <div className="badge badge-rose -mt-10 mb-4 mx-auto">
                    <span className="material-symbols-outlined text-sm">link</span>
                    强搭配
                </div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em] text-center mb-4">
                    Collocations
                </p>

                <div className="flex flex-wrap gap-2">
                    {analysis.collocations.length === 0 ? (
                        <p className="text-sm text-muted-foreground/50 italic w-full text-center py-3">
                            暂无搭配数据
                        </p>
                    ) : (
                        analysis.collocations.map((coll, i) => (
                            <span
                                key={i}
                                className="chip chip-amber"
                            >
                                {cleanString(coll)}
                            </span>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
};

export default LinguisticNetwork;
