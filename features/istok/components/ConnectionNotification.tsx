
import React, { useEffect } from 'react';
import { ShieldCheck, X, Check } from 'lucide-react';

interface ConnectionNotificationProps {
    identity: string;
    peerId: string;
    onAccept: () => void;
    onDecline: () => void;
}

export const ConnectionNotification: React.FC<ConnectionNotificationProps> = ({ identity, peerId, onAccept, onDecline }) => {
    
    useEffect(() => {
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    }, []);

    return (
        <div className="fixed inset-0 z-[11000] bg-black/60 backdrop-blur-[2px] flex items-end justify-center animate-fade-in font-sans pointer-events-auto">
            <div className="w-full max-w-sm mx-4 mb-[calc(env(safe-area-inset-bottom)+16px)]">
                <div className="bg-[#121214] border border-white/10 rounded-[28px] overflow-hidden shadow-2xl relative animate-slide-up ring-1 ring-emerald-500/20 pointer-events-auto">
                    <div className="h-1 w-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600 animate-pulse"></div>

                    <div className="p-6">
                        <div className="flex items-center gap-4 mb-5">
                            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 shrink-0">
                                <ShieldCheck size={24} className="text-emerald-500" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></div>
                                    INCOMING REQUEST
                                </h3>
                                <p className="text-lg font-bold text-white truncate leading-tight">
                                    {identity || 'Unknown Identity'}
                                </p>
                                <p className="text-[10px] font-mono text-neutral-500 truncate mt-0.5">
                                    ID: {peerId.slice(0, 12)}...
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={onDecline} className="h-12 flex items-center justify-center gap-2 rounded-xl bg-white/5 hover:bg-red-500/10 border border-white/5 text-neutral-400 hover:text-red-500 transition-all active:scale-95 pointer-events-auto">
                                <X size={18} />
                                <span className="text-[10px] font-black uppercase tracking-widest">DECLINE</span>
                            </button>
                            <button onClick={onAccept} className="h-12 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all active:scale-95 shadow-lg shadow-emerald-900/20 pointer-events-auto">
                                <Check size={18} strokeWidth={3} />
                                <span className="text-[10px] font-black uppercase tracking-widest">ACCEPT</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
