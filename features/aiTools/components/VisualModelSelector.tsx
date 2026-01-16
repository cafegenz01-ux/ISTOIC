
import React, { useState, useRef, useEffect } from 'react';
import { 
    ChevronDown, Check, Sparkles, Zap, Cpu, Box, Globe, 
    Layers, Info, ShieldCheck, Gauge, Brain
} from 'lucide-react';
import { HYDRA_MODELS } from '../../../services/pollinationsService';

export interface ModelSpec {
    id: string;
    name: string;
    description?: string;
    tags?: string[];
    specs?: {
        speed: 'INSTANT' | 'FAST' | 'SLOW';
        quality: 'STD' | 'HD' | 'ULTRA';
    };
}

export interface ProviderGroup {
    id: string;
    name: string;
    models: ModelSpec[];
}

interface VisualModelSelectorProps {
    label: string;
    selectedProviderId: string;
    selectedModelId: string;
    providers: ProviderGroup[];
    onSelect: (providerId: string, modelId: string) => void;
    disabled?: boolean;
}

const getProviderIcon = (id: string, className?: string) => {
    switch(id.toUpperCase()) {
        case 'GEMINI': return <Sparkles size={18} className={className || "text-blue-500"} />;
        case 'OPENAI': return <Cpu size={18} className={className || "text-green-500"} />;
        case 'GROQ': return <Zap size={18} className={className || "text-orange-500"} />;
        case 'HYDRA': return <Layers size={18} className={className || "text-pink-500"} />;
        default: return <Box size={18} className={className || "text-neutral-500"} />;
    }
};

const SpeedIndicator = ({ speed }: { speed?: string }) => {
    const color = speed === 'INSTANT' ? 'bg-yellow-400' : speed === 'FAST' ? 'bg-emerald-400' : 'bg-blue-400';
    return (
        <div className="flex items-center gap-1.5">
            <Gauge size={10} className="text-text-muted" />
            <div className="flex gap-0.5">
                <div className={`w-1 h-2 rounded-sm ${color}`}></div>
                <div className={`w-1 h-2 rounded-sm ${speed !== 'SLOW' ? color : 'bg-border'}`}></div>
                <div className={`w-1 h-2 rounded-sm ${speed === 'INSTANT' ? color : 'bg-border'}`}></div>
            </div>
        </div>
    );
};

export const VisualModelSelector: React.FC<VisualModelSelectorProps> = ({
    label,
    selectedProviderId,
    selectedModelId,
    providers = [],
    onSelect,
    disabled
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Build Default Providers if not passed
    const defaultProviders: ProviderGroup[] = [
        {
            id: 'HYDRA',
            name: 'Hydra Image Engine',
            models: [
                { id: 'hydra-smart-route', name: 'Hydra Auto', description: 'Smart routing. Best for generic requests.', tags: ['SMART', 'AUTO'], specs: { speed: 'FAST', quality: 'ULTRA' } },
                { id: 'flux', name: 'Flux Standard', description: 'Balanced detail and prompt adherence.', tags: ['FREE', 'TEXT'], specs: { speed: 'FAST', quality: 'HD' } },
                { id: 'flux-realism', name: 'Flux Realism', description: 'Photorealistic output.', tags: ['FREE', 'REAL'], specs: { speed: 'FAST', quality: 'ULTRA' } },
                { id: 'flux-anime', name: 'Flux Anime', description: 'Anime/Manga style.', tags: ['FREE', '2D'], specs: { speed: 'FAST', quality: 'HD' } },
                { id: 'flux-3d', name: 'Flux 3D', description: '3D Render style.', tags: ['FREE', '3D'], specs: { speed: 'FAST', quality: 'HD' } },
                { id: 'midjourney', name: 'Midjourney Style', description: 'Artistic composition.', tags: ['FREE', 'ART'], specs: { speed: 'SLOW', quality: 'ULTRA' } },
                { id: 'turbo', name: 'SDXL Turbo', description: 'Fastest generation.', tags: ['FREE', 'SPEED'], specs: { speed: 'INSTANT', quality: 'STD' } }
            ]
        },
        { 
            id: 'GEMINI', 
            name: 'Google Gemini', 
            models: [
                { id: 'gemini-2.5-flash-image', name: 'Imagen 3 Fast', description: 'Native Google generation.', tags: ['FREE', 'FAST'], specs: { speed: 'INSTANT', quality: 'STD' } },
                { id: 'gemini-3-pro-image-preview', name: 'Imagen 3 Pro', description: 'High coherence (Paid).', tags: ['PRO', 'ULTRA'], specs: { speed: 'FAST', quality: 'ULTRA' } }
            ]
        }
    ];

    const activeProviders = providers.length > 0 ? providers : defaultProviders;

    const selectedProvider = activeProviders.find(p => p.id === selectedProviderId) || activeProviders[0];
    const selectedModel = selectedProvider?.models.find(m => m.id === selectedModelId) || selectedProvider?.models[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="space-y-2 relative" ref={containerRef}>
            <label className="caption text-text-muted pl-1 flex items-center gap-2">
                <Layers size={12} /> {label}
            </label>
            
            <button 
                onClick={(e) => { e.stopPropagation(); !disabled && setIsOpen(!isOpen); }}
                className={`w-full bg-surface hover:bg-surface-2 border transition-all p-3 rounded-2xl flex items-center justify-between group ${
                    isOpen 
                    ? 'border-accent/50 shadow-[0_0_20px_rgba(var(--accent-rgb),0.1)]' 
                    : 'border-border hover:border-accent/40'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center border border-border group-hover:border-accent/40 transition-colors">
                        {getProviderIcon(selectedProviderId)}
                    </div>
                    <div className="text-left">
                        <div className="flex items-center gap-2">
                            <span className="caption text-text-muted">{selectedProvider?.name}</span>
                            <div className="w-1 h-1 rounded-full bg-neutral-500"></div>
                            {selectedModel?.specs && <SpeedIndicator speed={selectedModel.specs.speed} />}
                        </div>
                        <div className="text-sm font-semibold text-text truncate max-w-[180px] md:max-w-xs">
                            {selectedModel?.name}
                        </div>
                    </div>
                </div>
                <div className={`w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center transition-transform duration-300 ${isOpen ? 'rotate-180 bg-accent/10 text-accent' : 'text-text-muted'}`}>
                    <ChevronDown size={16} />
                </div>
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-surface/95 backdrop-blur-xl border border-border rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-2 z-[100] animate-slide-down origin-top overflow-hidden ring-1 ring-white/10">
                    <div className="max-h-[300px] overflow-y-auto custom-scroll p-1 space-y-4">
                        {activeProviders.map(provider => (
                            <div key={provider.id} className="space-y-2">
                                <div className="px-3 py-1 flex items-center gap-2 caption text-text-muted bg-surface-2 rounded-lg w-fit border border-border">
                                    {getProviderIcon(provider.id, "w-3 h-3")} {provider.name}
                                </div>
                                <div className="grid grid-cols-1 gap-1">
                                    {provider.models.map(model => {
                                        const isSelected = selectedProviderId === provider.id && selectedModelId === model.id;
                                        return (
                                            <button
                                                key={model.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelect(provider.id, model.id);
                                                    setIsOpen(false);
                                                }}
                                                className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-left group ${
                                                    isSelected
                                                    ? 'bg-accent/10 border-accent/30 shadow-[inset_0_0_20px_rgba(var(--accent-rgb),0.05)]'
                                                    : 'bg-transparent border-transparent hover:bg-surface-2 hover:border-border'
                                                }`}
                                            >
                                                <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                                                    isSelected ? 'border-accent bg-accent text-text-invert' : 'border-border bg-transparent group-hover:border-accent'
                                                }`}>
                                                    {isSelected && <Check size={10} strokeWidth={4} />}
                                                </div>
                                                
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-0.5">
                                                        <span className={`text-sm font-semibold ${isSelected ? 'text-text' : 'text-text-muted group-hover:text-text'}`}>
                                                            {model.name}
                                                        </span>
                                                        {model.tags && (
                                                            <div className="flex gap-1">
                                                                {model.tags.map(tag => (
                                                                    <span key={tag} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface-2 text-text-muted border border-border">
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    {model.description && (
                                                        <p className="caption text-text-muted line-clamp-1 group-hover:text-text transition-colors">
                                                            {model.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

