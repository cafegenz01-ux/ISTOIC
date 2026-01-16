
import React, { useEffect, useState } from 'react';
import { 
    X, Shield, Radio, User, Lock, Loader2, Network, Zap
} from 'lucide-react';

interface ConnectionNotificationProps {
    identity: string;
    peerId: string;
    onAccept: () => void;
    onDecline: () => void;
    isProcessing?: boolean; 
}

// --- HAPTIC ENGINE (iOS Friendly) ---
const triggerHaptic = (pattern: number[]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(pattern);
    }
};

export const ConnectionNotification: React.FC<ConnectionNotificationProps> = ({ 
    identity, 
    peerId, 
    onAccept, 
    onDecline,
    isProcessing = false
}) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Delay slightly for animation enter
        setTimeout(() => setIsVisible(true), 50);
        triggerHaptic([50, 50, 200]); // Alert Pattern
        
        // Auto-sound if available
        try {
            const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YXIGAACEhIQ..."); // Short beep placeholder
            audio.volume = 0.5;
            audio.play().catch(() => {});
        } catch(e) {}
        
        return () => setIsVisible(false);
    }, []);

    const handleAccept = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation(); // Mencegah click tembus ke elemen bawah
        if(isProcessing) return;
        triggerHaptic([50]);
        onAccept();
    };

    const handleDecline = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        if(isProcessing) return;
        triggerHaptic([50, 50]);
        setIsVisible(false);
        setTimeout(onDecline, 300); 
    };

    return (
        // WRAPPER UTAMA: Z-INDEX TERTINGGI (999999) - ABSOLUTE TOP PRIORITY
        // Uses fixed position to escape any overflow containers
        // Added top padding to respect Notch/Dynamic Island
        <div 
            className={`
                fixed top-0 left-0 right-0 z-[999999] 
                flex justify-center items-start 
                pt-[max(env(safe-area-inset-top)+0.5rem,1rem)] px-4 pb-4
                transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) transform
                ${isVisible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-full opacity-0 scale-95'}
                pointer-events-none 
            `}
            style={{ isolation: 'isolate' }} // Creates new stacking context
        >
            {/* Card Content - Pointer Events Auto agar bisa diklik */}
            <div className="
                pointer-events-auto
                w-full max-w-[360px]
                bg-[#09090b] backdrop-blur-3xl 
                border border-emerald-500/50 
                rounded-[28px] shadow-[0_25px_80px_-15px_rgba(16,185,129,0.5)] 
                overflow-hidden relative
                ring-1 ring-white/15
                shadow-emerald-900/40
            ">
                
                {/* Visual Effects */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>
                <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent animate-scan-line"></div>

                <div className="p-5 relative z-10">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2.5">
                            <div className="relative flex items-center justify-center w-7 h-7 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                                <Radio size={14} className="text-emerald-500 animate-pulse"/>
                            </div>
                            <div>
                                <h3 className="text-[10px] font-black text-emerald-400 tracking-[0.2em] uppercase leading-none mb-1">INCOMING UPLINK</h3>
                                <p className="text-[9px] text-neutral-400 font-mono flex items-center gap-1">
                                    <Network size={10} /> HYDRA_MESH_V20
                                </p>
                            </div>
                        </div>
                        <div className="px-2 py-0.5 bg-emerald-950/50 rounded border border-emerald-500/20 text-[9px] font-bold text-emerald-500 animate-pulse flex items-center gap-1">
                            <Zap size={8} fill="currentColor"/> LIVE
                        </div>
                    </div>

                    {/* Identity Info */}
                    <div className="flex items-center gap-3 mb-5 bg-white/5 p-3 rounded-2xl border border-white/5">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neutral-800 to-black border border-white/10 flex items-center justify-center shrink-0">
                            <User className="text-neutral-300" size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-white font-bold text-sm truncate">{identity || 'Unknown Entity'}</h4>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] bg-black/50 px-1.5 py-0.5 rounded text-neutral-500 font-mono border border-white/5">
                                    {peerId.substring(0,8)}...
                                </span>
                                <span className="text-[9px] text-emerald-500 font-bold flex items-center gap-0.5">
                                    <Lock size={8}/> E2EE
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons (Touch Optimized) */}
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={handleDecline}
                            disabled={isProcessing}
                            className="py-3.5 bg-neutral-800/50 active:bg-red-900/30 border border-white/10 active:border-red-500/50 rounded-xl text-xs font-bold text-neutral-400 active:text-red-400 transition-all flex items-center justify-center gap-2 touch-manipulation select-none"
                        >
                            <X size={16} /> REJECT
                        </button>
                        
                        <button 
                            onClick={handleAccept}
                            disabled={isProcessing}
                            className={`
                                py-3.5 rounded-xl text-xs font-black tracking-wide text-white shadow-lg touch-manipulation select-none
                                flex items-center justify-center gap-2 transition-all active:scale-95
                                ${isProcessing 
                                    ? 'bg-neutral-800 cursor-wait opacity-80 border border-white/5' 
                                    : 'bg-emerald-600 active:bg-emerald-500 border-t border-emerald-400/30 shadow-emerald-500/20'
                                }
                            `}
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" /> LINKING...
                                </>
                            ) : (
                                <>
                                    <Shield size={16} className="fill-current" /> ACCEPT
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
