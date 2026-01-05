
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Loader2, Ghost, AlertCircle, Lock } from 'lucide-react';

// --- UTILS: AUDIO RECORDING ---
export const getSupportedMimeType = () => {
    const types = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4', // Safari / iOS priority
        'audio/ogg;codecs=opus',
        'audio/aac'
    ];
    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return ''; // Browser default
};

// --- COMPONENT: 60FPS AUDIO PLAYER (ROBUST VER.) ---
export const AudioMessagePlayer = React.memo(({ src, duration, isMasked, mimeType }: { src: string, duration?: number, isMasked?: boolean, mimeType?: string }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(false);
    
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const progressRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | null>(null);
    const blobUrlRef = useRef<string | null>(null);

    // Cleanup memory strict
    useEffect(() => {
        return () => {
            if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = "";
                audioRef.current = null;
            }
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    const togglePlay = async () => {
        if (error) return;

        if (!audioRef.current) {
            setIsLoading(true);
            try {
                let url = src;
                
                // 1. Handle Base64 Data URI efficiently
                if (src.startsWith('data:')) {
                    // Convert Data URI to Blob for better browser compatibility
                    const res = await fetch(src);
                    const blob = await res.blob();
                    url = URL.createObjectURL(blob);
                    blobUrlRef.current = url;
                }

                const audio = new Audio();
                audioRef.current = audio;
                audio.src = url;
                
                // Critical for iOS/Safari playback
                audio.preload = 'auto'; 

                // Event Listeners
                audio.onended = () => {
                    setIsPlaying(false);
                    if (progressRef.current) progressRef.current.style.width = '0%';
                    if (rafRef.current) cancelAnimationFrame(rafRef.current);
                };
                
                audio.oncanplaythrough = () => setIsLoading(false);
                
                audio.onerror = (e) => { 
                    console.error("Audio Error:", e);
                    setIsLoading(false);
                    setError(true);
                };
                
                await audio.play();
                setIsPlaying(true);
            } catch (e) {
                console.error("Playback Exception:", e);
                setIsLoading(false);
                setError(true);
            }
        } else {
            if (isPlaying) {
                audioRef.current.pause();
                setIsPlaying(false);
                if (rafRef.current) cancelAnimationFrame(rafRef.current);
            } else {
                try {
                    await audioRef.current.play();
                    setIsPlaying(true);
                } catch(e) {
                    setIsPlaying(false);
                }
            }
        }
    };

    // 60FPS Animation Loop (Bypasses React Render Cycle)
    useEffect(() => {
        if (isPlaying) {
            const animate = () => {
                if (audioRef.current && progressRef.current) {
                    const currentTime = audioRef.current.currentTime;
                    const duration = audioRef.current.duration || 1; // Prevent div by zero
                    const pct = (currentTime / duration) * 100;
                    progressRef.current.style.width = `${pct}%`;
                }
                rafRef.current = requestAnimationFrame(animate);
            };
            rafRef.current = requestAnimationFrame(animate);
        } else {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        }
    }, [isPlaying]);

    return (
        <div className={`
            flex items-center gap-3 p-3 pr-4 rounded-[18px] min-w-[180px] transition-all
            ${error ? 'bg-red-500/10 border-red-500/30' : (isMasked ? 'bg-purple-900/20 border-purple-500/30' : 'bg-[#1a1a1a] border-white/10')}
            border select-none
        `}>
            <button 
                onClick={togglePlay} 
                disabled={isLoading || error}
                className={`
                    w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-90
                    ${error ? 'bg-red-500 text-white' : (isMasked ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]' : 'bg-white text-black shadow-lg')}
                    ${isLoading ? 'opacity-80 cursor-wait' : 'cursor-pointer hover:scale-105'}
                `}
            >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : 
                 error ? <AlertCircle size={16} /> :
                 isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
            </button>
            
            <div className="flex flex-col flex-1 gap-1.5 min-w-0">
                {/* Visualizer Track */}
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden relative">
                    <div 
                        ref={progressRef}
                        className={`h-full w-0 transition-[width] duration-75 ease-linear ${error ? 'bg-red-500' : (isMasked ? 'bg-purple-400' : 'bg-emerald-500')}`} 
                    ></div>
                </div>
                
                <div className="flex items-center justify-between w-full">
                     <div className="flex items-center gap-1.5">
                        {isMasked ? <Ghost size={10} className="text-purple-400 animate-pulse" /> : <Lock size={10} className="text-emerald-500" />}
                        <span className={`text-[9px] font-mono font-bold uppercase tracking-wider ${error ? 'text-red-400' : (isMasked ? 'text-purple-300' : 'text-neutral-400')}`}>
                            {error ? 'CORRUPTED' : (isMasked ? 'ENCRYPTED_VOICE' : 'SECURE_AUDIO')}
                        </span>
                    </div>
                    {duration ? <span className="text-[9px] font-mono text-neutral-500">{duration}s</span> : null}
                </div>
            </div>
        </div>
    );
});
