
import React from 'react';
import { Mic, Check, Volume2, Sparkles } from 'lucide-react';

interface VoiceSelectorProps {
    currentVoice: string;
    onSelect: (voice: string) => void;
    onClose: () => void;
}

const VOICES = [
    { id: 'Puck', label: 'PUCK', desc: 'Clear, Sassy', gender: 'M' },
    { id: 'Charon', label: 'CHARON', desc: 'Deep, Authoritative', gender: 'M' },
    { id: 'Kore', label: 'KORE', desc: 'Balanced, Calm', gender: 'F' },
    { id: 'Fenrir', label: 'FENRIR', desc: 'Deep, Stoic', gender: 'M' },
    { id: 'Aoede', label: 'AOEDE', desc: 'High, Formal', gender: 'F' },
    { id: 'Zephyr', label: 'ZEPHYR', desc: 'Soft, Empathetic', gender: 'F' }
];

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({ currentVoice, onSelect, onClose }) => {
    return (
        <div className="absolute bottom-24 left-0 right-0 mx-6 bg-[#0a0a0b]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl animate-slide-up z-50">
            <div className="flex justify-between items-center mb-3 pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-[var(--accent-color)]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">SELECT_VOICE_MODEL</span>
                </div>
                <button onClick={onClose} className="text-neutral-500 hover:text-white text-[9px] font-bold">CLOSE</button>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
                {VOICES.map((v) => {
                    const isActive = currentVoice === v.id;
                    return (
                        <button
                            key={v.id}
                            onClick={() => { onSelect(v.id); onClose(); }}
                            className={`
                                flex items-center justify-between p-3 rounded-xl border transition-all active:scale-95
                                ${isActive 
                                    ? 'bg-[var(--accent-color)]/10 border-[var(--accent-color)]/30 shadow-[0_0_15px_rgba(var(--accent-rgb),0.1)]' 
                                    : 'bg-white/5 border-transparent hover:bg-white/10'
                                }
                            `}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${isActive ? 'bg-[var(--accent-color)] text-black' : 'bg-black text-neutral-500'}`}>
                                    {v.id[0]}
                                </div>
                                <div className="text-left">
                                    <div className={`text-[10px] font-bold uppercase ${isActive ? 'text-white' : 'text-neutral-300'}`}>{v.label}</div>
                                    <div className="text-[8px] text-neutral-500">{v.desc}</div>
                                </div>
                            </div>
                            {isActive && <Volume2 size={12} className="text-[var(--accent-color)] animate-pulse" />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
