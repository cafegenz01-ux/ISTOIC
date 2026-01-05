
import React, { useEffect, useState } from 'react';
import { MessageSquare, X } from 'lucide-react';

interface MessageNotificationProps {
    senderName: string;
    messagePreview: string;
    onDismiss: () => void;
    onClick: () => void;
}

export const MessageNotification: React.FC<MessageNotificationProps> = ({ senderName, messagePreview, onDismiss, onClick }) => {
    const [progress, setProgress] = useState(100);
    const DURATION = 5000;

    useEffect(() => {
        if (navigator.vibrate) navigator.vibrate(50);
        const startTime = Date.now();
        const timer = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 100 - (elapsed / DURATION) * 100);
            setProgress(remaining);

            if (remaining === 0) {
                clearInterval(timer);
                onDismiss();
            }
        }, 16);
        return () => clearInterval(timer);
    }, [onDismiss]);

    return (
        <div 
            className="fixed top-[calc(env(safe-area-inset-top)+12px)] left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-sm z-[12000] animate-slide-down cursor-pointer pointer-events-auto"
            onClick={onClick}
        >
            <div className="relative overflow-hidden bg-[#09090b]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] ring-1 ring-white/5">
                <div className="p-3.5 flex items-start gap-3.5">
                    <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-900/10 flex items-center justify-center text-emerald-500 shrink-0 border border-emerald-500/20 shadow-inner">
                        <MessageSquare size={16} fill="currentColor" className="opacity-90" />
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#09090b] rounded-full flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                        </div>
                    </div>
                    
                    <div className="flex-1 min-w-0 py-0.5">
                        <div className="flex justify-between items-start mb-0.5">
                            <h4 className="text-xs font-bold text-white leading-none truncate pr-4">
                                {senderName}
                            </h4>
                            <span className="text-[9px] text-neutral-500 font-mono shrink-0">NOW</span>
                        </div>
                        <p className="text-[11px] text-neutral-300 leading-snug line-clamp-2">
                            {messagePreview}
                        </p>
                    </div>

                    <button onClick={(e) => { e.stopPropagation(); onDismiss(); }} className="absolute top-0 right-0 p-3 text-neutral-500 hover:text-white active:scale-90 transition-transform">
                        <X size={14} />
                    </button>
                </div>

                <div className="absolute bottom-0 left-0 h-[2px] bg-emerald-900/30 w-full">
                    <div className="h-full bg-emerald-500 shadow-[0_0_10px_#10b981]" style={{ width: `${progress}%` }} />
                </div>
            </div>
        </div>
    );
};
