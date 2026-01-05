
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Loader2, Ghost, AlertCircle, Lock } from 'lucide-react';

// --- UTILS: ROBUST MIME TYPE DETECTION ---
export const getSupportedMimeType = (): string => {
    const types = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4', // Critical for iOS/Safari
        'audio/ogg;codecs=opus',
        'audio/aac'
    ];
    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return ''; // Browser default
};

// --- COMPONENT: SECURE AUDIO BUBBLE ---

interface AudioMessagePlayerProps {
    src: string; // Base64 or Blob URL
    duration?: number;
    isMasked?: boolean;
    mimeType?: string;
}

export const AudioMessagePlayer = React.memo(({ src, duration, isMasked, mimeType = 'audio/webm' }: AudioMessagePlayerProps) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(false);
    
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const progressRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | null>(null);
    const blobUrlRef = useRef<string | null>(null);

    // Initialize Audio Object safely
    useEffect(() => {
        let url = src;

        try {
            // Check if it's base64 but missing header
            if (!src.startsWith('blob:') && !src.startsWith('data:')) {
                // Remove whitespace just in case
                const cleanSrc = src.trim();
                url = `data:${mimeType};base64,${cleanSrc}`;
            }
            
            // Convert to Blob for stability if it's a data URI
            if (url.startsWith('data:')) {
                 fetch(url)
                    .then(res => res.blob())
                    .then(blob => {
                        const blobUrl = URL.createObjectURL(blob);
                        blobUrlRef.current = blobUrl;
                        if (audioRef.current) audioRef.current.src = blobUrl;
                    })
                    .catch((e) => {
                        console.error("Audio Blob conversion failed", e);
                        setError(true);
                    });
            } else {
                 if (audioRef.current) audioRef.current.src = url;
            }
        } catch(e) {
            console.error("Audio Init Error", e);
            setError(true);
        }

        return () => {
            if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [src, mimeType]);

    const togglePlay = async () => {
        if (error || !audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        } else {
            setIsLoading(true);
            try {
                await audioRef.current.play();
                setIsPlaying(true);
                setIsLoading(false);
            } catch (e) {
                console.error("Playback Failed", e);
                setIsLoading(false);
                setError(true);
            }
        }
    };

    // Visualization Loop
    useEffect(() => {
        if (isPlaying) {
            const animate = () => {
                if (audioRef.current && progressRef.current) {
                    const currentTime = audioRef.current.currentTime;
                    const totalDuration = audioRef.current.duration || duration || 1;
                    const pct = Math.min((currentTime / totalDuration) * 100, 100);
                    progressRef.current.style.width = `${pct}%`;
                    
                    if (audioRef.current.ended) {
                        setIsPlaying(false);
                        progressRef.current.style.width = '100%';
                        return; // Stop loop
                    }
                }
                rafRef.current = requestAnimationFrame(animate);
            };
            rafRef.current = requestAnimationFrame(animate);
        } else {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        }
    }, [isPlaying, duration]);

    return (
        <div className={`
            flex items-center gap-3 p-3 pr-4 rounded-[18px] min-w-[180px] transition-all select-none
            ${error ? 'bg-red-500/10 border-red-500/30' : (isMasked ? 'bg-purple-900/20 border-purple-500/30' : 'bg-[#1a1a1a] border-white/10')}
            border
        `}>
            {/* Audio Element Hidden */}
            <audio ref={audioRef} onEnded={() => setIsPlaying(false)} onError={() => setError(true)} preload="metadata" />

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
                {/* Progress Bar */}
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
                            {error ? 'DATA_ERR' : (mimeType.includes('mp4') ? 'M4A_AUDIO' : 'OPUS_AUDIO')}
                        </span>
                    </div>
                    {duration ? <span className="text-[9px] font-mono text-neutral-500">{duration}s</span> : null}
                </div>
            </div>
        </div>
    );
});
