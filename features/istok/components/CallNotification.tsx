
import React, { useEffect, useState } from 'react';
import { Phone, PhoneOff, Video, Lock, ShieldCheck, User } from 'lucide-react';

interface CallNotificationProps {
    identity: string;
    onAnswer: () => void;
    onDecline: () => void;
}

export const CallNotification: React.FC<CallNotificationProps> = ({ identity, onAnswer, onDecline }) => {
    const [ripple, setRipple] = useState(false);

    useEffect(() => {
        // Trigger visual ripple effect loop
        const interval = setInterval(() => setRipple(r => !r), 1000);
        
        // Haptic Feedback Loop (Simulate Ringing Vibration)
        const vibratePattern = [500, 1000, 500, 1000];
        if (navigator.vibrate) {
            navigator.vibrate(vibratePattern);
            const vibInterval = setInterval(() => {
                navigator.vibrate(vibratePattern);
            }, 3000);
            return () => {
                clearInterval(interval);
                clearInterval(vibInterval);
                navigator.vibrate(0);
            };
        }

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fixed inset-0 z-[99999] flex flex-col font-sans overflow-hidden pointer-events-auto touch-none animate-in fade-in duration-300 bg-black">
            
            {/* Background Layers */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 z-0"></div>
            
            {/* Animated Ambient Background */}
            <div className="absolute inset-0 overflow-hidden z-0">
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] h-[150vw] bg-emerald-900/30 rounded-full blur-[120px] transition-transform duration-1000 ${ripple ? 'scale-110' : 'scale-100'}`}></div>
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[100vw] bg-emerald-600/10 rounded-full blur-[80px] transition-transform duration-1000 delay-100 ${ripple ? 'scale-125' : 'scale-90'}`}></div>
            </div>

            {/* Top SafeArea Spacer */}
            <div className="h-[env(safe-area-inset-top)] w-full bg-transparent z-10"></div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col items-center relative px-6 pt-12 z-10">
                
                {/* Caller Identity */}
                <div className="flex flex-col items-center space-y-6 mt-10">
                    <div className="relative">
                        {/* Profile Avatar Placeholder */}
                        <div className="w-32 h-32 rounded-full bg-[#1a1a1a] border-2 border-white/10 flex items-center justify-center shadow-2xl relative z-10 overflow-hidden">
                             <User size={64} className="text-white/50" />
                        </div>
                        
                        {/* Ringing Rings */}
                        <div className={`absolute inset-0 rounded-full border-2 border-emerald-500/50 scale-100 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]`}></div>
                        <div className={`absolute inset-0 rounded-full border-2 border-emerald-500/30 scale-100 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] delay-300`}></div>
                    </div>

                    <div className="text-center space-y-2">
                        <div className="flex items-center justify-center gap-2 text-emerald-400/80 bg-black/30 px-3 py-1 rounded-full backdrop-blur-md border border-white/5">
                            <Lock size={10} />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">SECURE_LINE</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-none drop-shadow-lg">
                            {identity}
                        </h1>
                        <p className="text-sm font-mono text-white/60 animate-pulse uppercase tracking-widest">
                            Incoming Encrypted Call...
                        </p>
                    </div>
                </div>

                {/* Encryption Badge */}
                <div className="mt-auto mb-16 flex items-center gap-2 opacity-50">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    <span className="text-[9px] font-mono text-white">E2EE • AES-256 • HYDRA_NET</span>
                </div>

                {/* Actions - Bottom Sheet Style */}
                <div className="w-full max-w-sm grid grid-cols-2 gap-8 pb-[calc(env(safe-area-inset-bottom)+40px)]">
                    
                    {/* DECLINE BUTTON */}
                    <div className="flex flex-col items-center gap-3">
                        <button 
                            onClick={onDecline}
                            className="w-20 h-20 rounded-full bg-red-500/20 text-red-500 border border-red-500/50 flex items-center justify-center hover:bg-red-600 hover:text-white hover:scale-110 active:scale-95 transition-all duration-300 backdrop-blur-md shadow-lg shadow-red-900/20"
                        >
                            <PhoneOff size={32} fill="currentColor" />
                        </button>
                        <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">Decline</span>
                    </div>

                    {/* ACCEPT BUTTON */}
                    <div className="flex flex-col items-center gap-3">
                        <button 
                            onClick={onAnswer}
                            className="relative w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-300 shadow-[0_0_40px_rgba(16,185,129,0.5)] animate-bounce"
                        >
                            <div className="absolute inset-0 rounded-full border-2 border-white/20 animate-ping"></div>
                            <Phone size={32} fill="currentColor" className="relative z-10" />
                        </button>
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Accept</span>
                    </div>

                </div>
            </div>
        </div>
    );
};
