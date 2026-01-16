
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, Loader2, Ghost, AlertCircle, Lock, FastForward } from 'lucide-react';

// --- UTILS: HELPER ---

// Detect iOS/Safari for fallback
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

export const getSupportedMimeType = (): string => {
    if (isIOS()) return 'audio/mp4'; // Safari mobile prefers mp4/aac
    const types = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4'
    ];
    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
};

const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

// --- COMPONENT: VISUALIZER BAR ---
// Render statis bars yang terlihat seperti waveform
const WaveformBar: React.FC<{ active: boolean, height: number }> = ({ active, height }) => (
    <div 
        className={`w-1 rounded-full transition-all duration-150 ${active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-white/10'}`}
        style={{ height: `${height}%` }}
    />
);

// --- MAIN COMPONENT ---

interface AudioMessagePlayerProps {
    src: string; // Base64 or Blob URL
    duration?: number;
    isMasked?: boolean;
    mimeType?: string;
}

export const AudioMessagePlayer = React.memo(({ src, duration = 0, isMasked, mimeType = 'audio/webm' }: AudioMessagePlayerProps) => {
    // State
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [error, setError] = useState(false);
    const [blobReady, setBlobReady] = useState(false);

    // Refs
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | null>(null);
    const blobUrlRef = useRef<string | null>(null);

    // Generate random waveform heights (Stable per instance)
    const waveformData = useMemo(() => Array.from({ length: 24 }, () => Math.random() * 60 + 20), []);

    // 1. Initialize Audio Object
    useEffect(() => {
        let url = src;
        setIsLoading(true);

        const initAudio = async () => {
            try {
                // Fix Base64 without header
                if (!src.startsWith('blob:') && !src.startsWith('data:')) {
                    url = `data:${mimeType};base64,${src.trim()}`;
                }

                // Convert Data URI to Blob for performance
                if (url.startsWith('data:')) {
                    const res = await fetch(url);
                    const blob = await res.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    blobUrlRef.current = blobUrl;
                    if (audioRef.current) {
                        audioRef.current.src = blobUrl;
                        audioRef.current.load(); // Force load meta
                    }
                } else {
                    if (audioRef.current) audioRef.current.src = url;
                }
                setBlobReady(true);
                setIsLoading(false);
            } catch (e) {
                console.error("Audio Init Error", e);
                setError(true);
                setIsLoading(false);
            }
        };

        initAudio();

        return () => {
            if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, [src, mimeType]);

    // 2. Playback Control
    const togglePlay = async () => {
        if (error || !blobReady || !audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        } else {
            try {
                // Handle speed persistency
                audioRef.current.playbackRate = playbackRate;
                await audioRef.current.play();
                setIsPlaying(true);
            } catch (e) {
                console.error("Playback Failed", e);
                setError(true);
            }
        }
    };

    // 3. Animation Loop (Sync UI with Audio)
    useEffect(() => {
        if (isPlaying) {
            const animate = () => {
                if (audioRef.current) {
                    setCurrentTime(audioRef.current.currentTime);
                    if (audioRef.current.ended) {
                        setIsPlaying(false);
                        setCurrentTime(0);
                        return;
                    }
                }
                rafRef.current = requestAnimationFrame(animate);
            };
            rafRef.current = requestAnimationFrame(animate);
        } else {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        }
    }, [isPlaying]);

    // 4. Seek Handling
    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current || !blobReady) return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const pct = Math.max(0, Math.min(1, x / width));
        
        const targetTime = (audioRef.current.duration || duration || 10) * pct;
        
        audioRef.current.currentTime = targetTime;
        setCurrentTime(targetTime);
    };

    // 5. Speed Toggle
    const cycleSpeed = (e: React.MouseEvent) => {
        e.stopPropagation();
        const speeds = [1.0, 1.5, 2.0];
        const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
        const newRate = speeds[nextIdx];
        
        setPlaybackRate(newRate);
        if (audioRef.current) {
            audioRef.current.playbackRate = newRate;
        }
    };

    // Calculate progress percentage for rendering
    const progressPct = audioRef.current?.duration 
        ? (currentTime / audioRef.current.duration) * 100 
        : (duration ? (currentTime / duration) * 100 : 0);

    return (
        <div className={`
            flex items-center gap-3 p-3 rounded-2xl min-w-[240px] max-w-[300px] transition-all select-none relative overflow-hidden
            ${error ? 'bg-red-900/10 border border-red-500/30' : 
              isMasked ? 'bg-purple-900/10 border border-purple-500/20' : 
              'bg-[#121212] border border-white/10 hover:border-emerald-500/30'}
        `}>
            {/* Audio Element Hidden */}
            <audio ref={audioRef} preload="metadata" onError={() => setError(true)} />

            {/* Play/Pause Button */}
            <button 
                onClick={togglePlay} 
                disabled={isLoading || error}
                className={`
                    w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95 shadow-lg z-10
                    ${error ? 'bg-red-500 text-white' : 
                      isMasked ? 'bg-purple-600 text-white shadow-purple-500/20' : 
                      'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'}
                `}
            >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : 
                 error ? <AlertCircle size={18} /> :
                 isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
            </button>
            
            {/* Waveform & Info */}
            <div className="flex flex-col flex-1 min-w-0 z-10 gap-1">
                
                {/* Waveform Visualizer (Clickable) */}
                <div 
                    className="h-8 w-full flex items-center gap-[2px] cursor-pointer group"
                    onClick={handleSeek}
                    ref={containerRef}
                    title="Click to seek"
                >
                    {waveformData.map((height, i) => {
                        const barPos = (i / waveformData.length) * 100;
                        const isActive = barPos <= progressPct;
                        return (
                            <WaveformBar 
                                key={i} 
                                active={isActive} 
                                height={isPlaying ? Math.max(20, height + (Math.sin(Date.now() / 100 + i) * 20)) : height} 
                            />
                        );
                    })}
                </div>

                {/* Meta Data Row */}
                <div className="flex items-center justify-between w-full px-1">
                     <div className="flex items-center gap-2">
                        {isMasked ? <Ghost size={10} className="text-purple-400" /> : <Lock size={10} className="text-emerald-500" />}
                        <span className="text-[10px] font-mono font-bold text-neutral-400">
                            {formatTime(currentTime)} <span className="text-neutral-600">/</span> {formatTime(duration)}
                        </span>
                    </div>

                    {/* Speed Toggle */}
                    <button 
                        onClick={cycleSpeed}
                        className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/10 transition text-[9px] font-bold text-emerald-400"
                    >
                        <FastForward size={8} /> {playbackRate}x
                    </button>
                </div>
            </div>

            {/* Background Decoration */}
            {isPlaying && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/5 to-transparent animate-pulse pointer-events-none"></div>
            )}
        </div>
    );
});
