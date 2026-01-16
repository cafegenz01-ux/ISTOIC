
import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, PhoneOff, Maximize2, Radio, Activity, Sparkles } from 'lucide-react';
import { useLiveSession } from '../contexts/LiveSessionContext';

export const LiveMiniPlayer: React.FC = () => {
    const { isLive, isMinimized, status, stopSession, toggleMinimize, activeTool, analyser } = useLiveSession();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Visualizer Loop
    useEffect(() => {
        if (!isLive || !isMinimized || !analyser || !canvasRef.current) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationId: number;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            animationId = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * canvas.height;
                
                // Dynamic color based on height
                const r = barHeight + 25 * (i / bufferLength);
                const g = 250 * (i / bufferLength);
                const b = 50;

                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

                x += barWidth + 1;
            }
        };

        draw();
        return () => cancelAnimationFrame(animationId);
    }, [isLive, isMinimized, analyser]);

    if (!isLive || !isMinimized) return null;

    return (
        <div className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-[9999] animate-slide-up">
            <div className={`
                relative w-72 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col
                ${status === 'ACTIVE' ? 'ring-1 ring-emerald-500/50' : 'ring-1 ring-amber-500/50'}
            `}>
                
                {/* Active Tool Indicator (HUD) */}
                {activeTool && (
                    <div className="absolute top-0 left-0 right-0 bg-[var(--accent)]/90 text-[var(--text-invert)] text-[10px] font-semibold tracking-wide px-3 py-1 flex items-center gap-2 z-20 animate-pulse">
                        <Sparkles size={10} /> Executing {activeTool.replace(/_/g, ' ')}
                    </div>
                )}

                <div className="h-16 relative w-full bg-zinc-900/50">
                    <canvas ref={canvasRef} width={288} height={64} className="w-full h-full opacity-50" />
                    <div className="absolute inset-0 flex items-center justify-between px-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${status === 'ACTIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
                            <div>
                                <h4 className="text-xs font-black text-white uppercase tracking-wider">NEURAL LINK</h4>
                                <p className="text-[9px] text-neutral-400 font-mono">BACKGROUND_MODE</p>
                            </div>
                        </div>
                        <Activity size={16} className="text-emerald-500 opacity-50" />
                    </div>
                </div>

                <div className="p-3 border-t border-white/10 flex justify-between gap-2 bg-[#050505]">
                    <button 
                        onClick={toggleMinimize}
                        aria-label="Maximize"
                        className="flex-1 bg-white/10 hover:bg-white/20 text-white rounded-lg py-2 min-h-[44px] touch-target flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                        title="Maximize"
                    >
                        <Maximize2 size={16} />
                    </button>
                    <button 
                        onClick={stopSession}
                        aria-label="Terminate Connection"
                        className="flex-1 bg-red-500/20 hover:bg-red-600 text-red-500 hover:text-white rounded-lg py-2 min-h-[44px] touch-target flex items-center justify-center transition-all border border-red-500/20 hover:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
                        title="Terminate Connection"
                    >
                        <PhoneOff size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};
