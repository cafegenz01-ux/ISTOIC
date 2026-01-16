
import React, { useState, memo, useCallback } from 'react';
import { ImagePlus, Aperture, Activity } from 'lucide-react';
import { GenerativeStudio } from './components/GenerativeStudio';
import { NeuralVision } from './components/NeuralVision';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

const AIToolsView: React.FC = memo(() => {
    const [activeSection, setActiveSection] = useState<'GENERATIVE' | 'ANALYTIC' | null>('GENERATIVE');

    const toggleSection = useCallback((section: 'GENERATIVE' | 'ANALYTIC') => {
        setActiveSection(prev => prev === section ? null : section);
    }, []);

    return (
        <div className="h-full w-full overflow-y-auto custom-scroll flex flex-col px-4 pb-32 pt-[calc(env(safe-area-inset-top)+1.5rem)] md:px-8 md:pt-12 md:pb-40 lg:px-12 animate-fade-in bg-bg relative z-10 overscroll-none">
            <div className="max-w-6xl mx-auto w-full space-y-[var(--bento-gap)] relative z-10">
                <Card tone="bento-orange" padding="bento" bento className="bento-card animate-slide-up shadow-[var(--shadow-bento)]">
                    <div className="bento-card-content">
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                            <div className="space-y-3">
                                <p className="caption opacity-80">AI Tools</p>
                                <div className="flex items-center gap-3">
                                    <div className="bento-card-icon">
                                        <ImagePlus size={24} />
                                    </div>
                                    <div>
                                        <h1 className="bento-card-title text-3xl">Create and analyze</h1>
                                        <p className="bento-card-description">Studio untuk generasi visual dan inspeksi dalam satu panel.</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    <Badge variant="success">Ready</Badge>
                                    <Badge variant="neutral">Gen & Vision</Badge>
                                </div>
                            </div>

                            <Card tone="bento-solid-green" padding="sm" bento className="flex items-center gap-3 shadow-[var(--shadow-soft)]">
                                <Badge variant="success">Online</Badge>
                                <div className="flex items-center gap-2 opacity-90">
                                    <Activity size={14} />
                                    <span className="caption">Engines stable</span>
                                </div>
                            </Card>
                        </div>
                    </div>
                </Card>

                <div className="bento-grid grid grid-cols-1 gap-[var(--bento-gap)] transform-gpu pb-20">
                    <GenerativeStudio 
                        isOpen={activeSection === 'GENERATIVE'} 
                        onToggle={() => toggleSection('GENERATIVE')}
                        icon={<ImagePlus />}
                    />

                    <NeuralVision 
                        isOpen={activeSection === 'ANALYTIC'} 
                        onToggle={() => toggleSection('ANALYTIC')}
                        icon={<Aperture />}
                    />
                </div>
                
                <div className="flex justify-center pt-8 pb-4 opacity-60">
                    <span className="caption text-text-muted">Optimized for fast generation.</span>
                </div>
            </div>
        </div>
    );
});

export default AIToolsView;
