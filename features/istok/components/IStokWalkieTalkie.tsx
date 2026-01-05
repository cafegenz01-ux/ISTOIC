
import React, { useState, useEffect, useRef } from 'react';
import { Mic, Radio, X, Volume2, Activity, Wifi, Zap } from 'lucide-react';
import { debugService } from '../../../services/debugService';

interface IStokWalkieTalkieProps {
    onClose: () => void;
    onSendAudio: (base64: string, duration: number, size: number) => void;
    latestMessage: any | null; // Trigger for incoming audio
}

// --- SOUND FX SYNTHESIZER ---
const playTone = (ctx: AudioContext, type: 'ROGER_BEEP' | 'RX_START' | 'TX_START') => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'ROGER_BEEP') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(2000, ctx.currentTime);
        osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'TX_START') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'RX_START') {
        // Static burst simulation
        const bufferSize = ctx.sampleRate * 0.1; // 100ms
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = ctx.createGain();
        noiseGain.gain.value = 0.05;
        noise.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start();
    }
};

export const IStokWalkieTalkie: React.FC<IStokWalkieTalkieProps> = ({ onClose, onSendAudio, latestMessage }) => {
    const [status, setStatus] = useState<'IDLE' | 'TX' | 'RX'>('IDLE');
    const [duration, setDuration] = useState(0);
    const [audioQueue, setAudioQueue] = useState<string[]>([]);
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<any>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const processedMessageIds = useRef<Set<string>>(new Set());

    // Initialize Audio Context
    useEffect(() => {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioContext();
        
        // iOS Fix: Resume context on user interaction if needed
        const unlock = () => {
            if (audioCtxRef.current?.state === 'suspended') {
                audioCtxRef.current.resume();
            }
            window.removeEventListener('touchstart', unlock);
            window.removeEventListener('click', unlock);
        };
        window.addEventListener('touchstart', unlock);
        window.addEventListener('click', unlock);

        return () => { audioCtxRef.current?.close(); };
    }, []);

    // INCOMING MESSAGE HANDLER
    useEffect(() => {
        if (!latestMessage || latestMessage.type !== 'AUDIO' || latestMessage.sender === 'ME') return;
        
        if (!processedMessageIds.current.has(latestMessage.id)) {
            processedMessageIds.current.add(latestMessage.id);
            // Add to playback queue
            setAudioQueue(prev => [...prev, latestMessage.content]);
        }
    }, [latestMessage]);

    // QUEUE PROCESSOR
    useEffect(() => {
        if (status === 'IDLE' && audioQueue.length > 0) {
            playIncomingAudio(audioQueue[0]);
            setAudioQueue(prev => prev.slice(1));
        }
    }, [status, audioQueue]);

    const playIncomingAudio = async (base64: string) => {
        if (!audioCtxRef.current) return;
        setStatus('RX');
        playTone(audioCtxRef.current, 'RX_START');

        try {
            const binaryString = atob(base64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

            const audioBuffer = await audioCtxRef.current.decodeAudioData(bytes.buffer);
            const source = audioCtxRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioCtxRef.current.destination);
            
            activeSourceRef.current = source;
            source.start();

            source.onended = () => {
                if (audioCtxRef.current) playTone(audioCtxRef.current, 'ROGER_BEEP');
                setStatus('IDLE');
                activeSourceRef.current = null;
            };
        } catch (e) {
            console.error("PTT Playback Error", e);
            setStatus('IDLE');
        }
    };

    const startTx = async () => {
        if (status !== 'IDLE' || !audioCtxRef.current) return;
        
        // Resume context if suspended (browser policy)
        if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            playTone(audioCtxRef.current, 'TX_START');
            
            // Ultra-low bitrate for PTT efficiency over 4G
            // Fallback for browsers that don't support configuring bitrate
            let options = {};
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 12000 };
            } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                options = { mimeType: 'audio/mp4', audioBitsPerSecond: 16000 }; // iOS
            }
            
            mediaRecorderRef.current = new MediaRecorder(stream, options);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = (reader.result as string).split(',')[1]; // Strip header
                    onSendAudio(base64, duration, blob.size);
                    if (audioCtxRef.current) playTone(audioCtxRef.current, 'ROGER_BEEP');
                };
                reader.readAsDataURL(blob);
                
                // Cleanup tracks
                stream.getTracks().forEach(t => t.stop());
            };

            mediaRecorderRef.current.start();
            setStatus('TX');
            setDuration(0);
            timerRef.current = setInterval(() => setDuration(prev => prev + 1), 1000);

            // Haptic Feedback
            if (navigator.vibrate) navigator.vibrate(50);

        } catch (e) {
            console.error("Mic Error", e);
            alert("Mic Access Denied");
        }
    };

    const stopTx = () => {
        if (status === 'TX' && mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setStatus('IDLE');
            clearInterval(timerRef.current);
            if (navigator.vibrate) navigator.vibrate([30, 30]);
        }
    };

    // Toggle handler for Tap-to-Talk
    const toggleTx = () => {
        if (status === 'IDLE') {
            startTx();
        } else if (status === 'TX') {
            stopTx();
        }
    };

    return (
        <div className="fixed inset-0 z-[8000] bg-black text-emerald-500 font-mono flex flex-col">
            {/* GRID BACKGROUND */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.05)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>
            
            {/* HEADER */}
            <div className="relative z-10 px-6 py-4 flex justify-between items-center border-b border-emerald-900/50 bg-black/80 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${status !== 'IDLE' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">WALKIE_TALKIE</span>
                </div>
                <button onClick={onClose} className="p-2 bg-emerald-900/20 rounded-full hover:bg-emerald-900/40 text-emerald-500 transition-all">
                    <X size={20} />
                </button>
            </div>

            {/* MAIN DISPLAY */}
            <div className="flex-1 relative flex flex-col items-center justify-center p-6 gap-8">
                
                {/* STATUS VISUALIZER */}
                <div className="relative">
                    <div className={`
                        w-64 h-64 rounded-full border-4 flex items-center justify-center transition-all duration-300
                        ${status === 'TX' ? 'border-red-500 bg-red-900/20 shadow-[0_0_50px_rgba(239,68,68,0.4)]' : 
                          status === 'RX' ? 'border-emerald-500 bg-emerald-900/20 shadow-[0_0_50px_rgba(16,185,129,0.4)]' : 
                          'border-neutral-800 bg-black'}
                    `}>
                        {status === 'TX' && (
                            <div className="flex flex-col items-center animate-pulse">
                                <Mic size={48} className="text-red-500 mb-2" />
                                <span className="text-2xl font-black text-red-500 tracking-widest">TRANSMITTING</span>
                                <span className="text-sm text-red-400 font-mono mt-2">{duration}s</span>
                            </div>
                        )}
                        {status === 'RX' && (
                            <div className="flex flex-col items-center animate-bounce">
                                <Volume2 size={48} className="text-emerald-500 mb-2" />
                                <span className="text-2xl font-black text-emerald-500 tracking-widest">RECEIVING</span>
                                <span className="text-[10px] text-emerald-400 font-mono mt-2">INCOMING SIGNAL...</span>
                            </div>
                        )}
                        {status === 'IDLE' && (
                            <div className="flex flex-col items-center opacity-30">
                                <Radio size={48} className="text-neutral-500 mb-2" />
                                <span className="text-xl font-black text-neutral-500 tracking-widest">STANDBY</span>
                                {audioQueue.length > 0 && <span className="text-[10px] text-amber-500 mt-2">{audioQueue.length} MSGS QUEUED</span>}
                            </div>
                        )}
                    </div>
                    
                    {/* Ring Animations */}
                    {status !== 'IDLE' && (
                        <div className={`absolute inset-0 rounded-full border border-current animate-ping opacity-20 ${status === 'TX' ? 'text-red-500' : 'text-emerald-500'}`}></div>
                    )}
                </div>

                {/* TOGGLE BUTTON (TAP TO TALK) */}
                <button
                    className={`
                        w-full max-w-xs h-24 rounded-2xl font-black text-xl tracking-[0.2em] uppercase transition-all shadow-2xl relative overflow-hidden group
                        ${status === 'TX' 
                            ? 'bg-red-600 text-white scale-95 ring-4 ring-red-900 shadow-[0_0_30px_rgba(220,38,38,0.5)]' 
                            : 'bg-emerald-600 hover:bg-emerald-500 text-black ring-4 ring-emerald-900/50 hover:scale-105 active:scale-95'}
                        ${status === 'RX' ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    onClick={toggleTx}
                    onTouchStart={(e) => { e.preventDefault(); startTx(); }}
                    onTouchEnd={(e) => { e.preventDefault(); stopTx(); }}
                    onMouseDown={startTx}
                    onMouseUp={stopTx}
                    disabled={status === 'RX'}
                >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
                    <span className="relative z-10 flex items-center justify-center gap-3">
                        {status === 'TX' ? 'TRANSMITTING...' : 'HOLD TO TALK'}
                        <Activity size={24} className={status === 'TX' ? 'animate-pulse' : ''} />
                    </span>
                </button>

                <p className="text-[10px] text-neutral-500 font-mono text-center max-w-xs">
                    MODE: 12KBPS_OPUS // ENCRYPTION: AES-256-GCM <br/>
                    LATENCY OPTIMIZED FOR WEAK SIGNALS
                </p>
            </div>
        </div>
    );
};
