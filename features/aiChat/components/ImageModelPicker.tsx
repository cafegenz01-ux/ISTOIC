
import React from 'react';
import { 
    X, Sparkles, Zap, Image as ImageIcon, CheckCircle2,
    Aperture, Wand2, Palette, Box, Ghost
} from 'lucide-react';

export const IMAGE_MODELS = [
    { id: 'hydra', name: 'Hydra Auto', provider: 'HYDRA', desc: 'Smart routing. Best for generic requests.', icon: <Wand2 size={16}/>, quality: 'ULTRA', speed: 'FAST' },
    { id: 'flux', name: 'Flux Standard', provider: 'HYDRA', desc: 'Balanced detail and prompt adherence.', icon: <Aperture size={16}/>, quality: 'HD', speed: 'FAST' },
    { id: 'flux-realism', name: 'Flux Realism', provider: 'HYDRA', desc: 'Specialized for photorealistic outputs.', icon: <Box size={16}/>, quality: 'ULTRA', speed: 'FAST' },
    { id: 'flux-anime', name: 'Flux Anime', provider: 'HYDRA', desc: 'Optimized for 2D/Anime style.', icon: <Palette size={16}/>, quality: 'HD', speed: 'FAST' },
    { id: 'flux-3d', name: 'Flux 3D', provider: 'HYDRA', desc: 'For 3D renders and CGI style.', icon: <Box size={16}/>, quality: 'HD', speed: 'FAST' },
    { id: 'midjourney', name: 'Midjourney Style', provider: 'HYDRA', desc: 'Artistic composition emulation.', icon: <Palette size={16}/>, quality: 'ART', speed: 'SLOW' },
    { id: 'any-dark', name: 'Dark Mode', provider: 'HYDRA', desc: 'Moody, high contrast aesthetics.', icon: <Ghost size={16}/>, quality: 'HD', speed: 'FAST' },
    { id: 'turbo', name: 'SDXL Turbo', provider: 'HYDRA', desc: 'Extreme speed. Draft quality.', icon: <Zap size={16}/>, quality: 'STD', speed: 'INSTANT' },
    { id: 'gemini-2.5-flash-image', name: 'Imagen 3 Fast', provider: 'GOOGLE', desc: 'Native Google generation.', icon: <Sparkles size={16}/>, quality: 'HD', speed: 'FAST' },
    { id: 'gemini-3-pro-image-preview', name: 'Imagen 3 Pro', provider: 'GOOGLE', desc: 'Paid API. Highest coherence.', icon: <Sparkles size={16}/>, quality: 'ULTRA', speed: 'SLOW' },
];

interface ImageModelPickerProps {
  isOpen: boolean;
  onClose: () => void;
  activeModelId: string;
  onSelectModel: (id: string) => void;
}

export const ImageModelPicker: React.FC<ImageModelPickerProps> = ({ isOpen, onClose, activeModelId, onSelectModel }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in font-sans">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity" onClick={onClose} />
            
            <div className="relative z-10 w-full md:max-w-xl bg-[#09090b] rounded-t-[32px] md:rounded-[32px] border border-white/10 shadow-2xl overflow-hidden ring-1 ring-white/5 animate-slide-up">
                <div className="h-16 border-b border-white/5 bg-white/[0.02] flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center border border-pink-500/20 shadow-inner text-pink-500">
                            <ImageIcon size={16} />
                        </div>
                        <div>
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white leading-none">
                                VISUAL_ENGINE
                            </h3>
                            <p className="text-[8px] text-neutral-500 font-mono uppercase tracking-widest mt-1">
                                Image Synthesis Module
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-all border border-white/5 active:scale-95">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-4 space-y-2 max-h-[70vh] overflow-y-auto custom-scroll">
                    {IMAGE_MODELS.map((model) => {
                        const isActive = activeModelId === model.id;
                        return (
                            <button
                                key={model.id}
                                onClick={() => { onSelectModel(model.id); onClose(); }}
                                className={`w-full flex items-center gap-4 p-3.5 rounded-2xl border transition-all text-left group ${
                                    isActive 
                                    ? 'bg-pink-500/10 border-pink-500/30 ring-1 ring-pink-500/20' 
                                    : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/[0.07]'
                                }`}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                    isActive ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20' : 'bg-black/20 text-neutral-500 group-hover:text-pink-400'
                                }`}>
                                    {model.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className={`text-sm font-black uppercase tracking-tight ${isActive ? 'text-white' : 'text-neutral-300 group-hover:text-white'}`}>
                                            {model.name}
                                        </span>
                                        {isActive && <CheckCircle2 size={16} className="text-pink-500" />}
                                    </div>
                                    <p className="text-[9px] text-neutral-500 font-medium truncate">{model.desc}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1 opacity-60 shrink-0">
                                    <span className="text-[7px] font-black bg-white/5 px-2 py-0.5 rounded text-neutral-400 border border-white/5">{model.provider}</span>
                                    <span className="text-[7px] font-mono text-neutral-600">{model.quality}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
