
import React, { useEffect } from 'react';
import { Phone, PhoneOff, Radio, Waves, Lock } from 'lucide-react';

interface CallNotificationProps {
    identity: string;
    onAnswer: () => void;
    onDecline: () => void;
}

export const CallNotification: React.FC<CallNotificationProps> = ({ identity, onAnswer, onDecline }) => {

    useEffect(() => {
        if (navigator.vibrate) {
            // Strong continuous vibration pattern
            navigator.vibrate([500, 500, 500, 500, 500, 500, 500, 500, 500]);
        }
        return () => {
            if (navigator.vibrate) navigator.vibrate(0);
        };
    }, []);

    return (
        <div className="fixed inset-0 z-[11000] bg-[#050505]/95 backdrop-blur-3xl flex flex-col font-sans overflow-hidden pointer-events-auto">
            
            {/* Top SafeArea Spacer */}
            <div className="h-[env(safe-area-inset-top)] w-full bg-black/20"></div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col items-center relative px-6 pt-12">
                
                {/* Ambient Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-emerald-500/10 blur-[80px] rounded-full animate-pulse-slow pointer-events-none"></div>

                {/* Identity Info */}
                <div className="text-center space-y-6 relative z-10 w-full mb-auto">
                    <div className="inline-flex items-center justify-center gap-2 text-emerald-500 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                        <Lock size={12} />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em]">SECURE_CHANNEL</span>
                    </div>
                    
                    <div className="space-y-3">
                        <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tight leading-none break-words line-clamp-2">
                            {identity}
                        </h1>
                        <p className="text-xs font-mono text-neutral-500 animate-pulse uppercase tracking-widest">
                            INCOMING TRANSMISSION...
                        </p>
                    </div>
                </div>

                {/* Visualizer - Centered vertically in remaining space */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 opacity-60 scale-125 md:scale-150 pointer-events-none">
                     <div className="relative">
                        <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-ping"></div>
                        <div className="bg-[#0a0a0b] p-8 rounded-full border border-emerald-500/30 shadow-[0_0_60px_rgba(16,185,129,0.2)] relative z-10">
                            <Waves size={48} className="text-emerald-500 animate-pulse" />
                        </div>
                     </div>
                </div>

                {/* Actions - Pushed up from bottom safe area */}
                <div className="w-full max-w-xs grid grid-cols-2 gap-6 relative z-10 pb-[calc(env(safe-area-inset-bottom)+40px)]">
                    <button 
                        onClick={onDecline}
                        className="flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform"
                    >
                        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all pointer-events-auto">
                            <PhoneOff size={28} />
                        </div>
                        <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">DECLINE</span>
                    </button>

                    <button 
                        onClick={onAnswer}
                        className="flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform"
                    >
                        <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.4)] animate-bounce hover:bg-emerald-400 transition-all pointer-events-auto">
                            <Phone size={28} fill="currentColor" />
                        </div>
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">ACCEPT</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
