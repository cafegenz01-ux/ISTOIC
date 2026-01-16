
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    Phone, PhoneOff, Mic, MicOff, Activity, 
    Volume2, Lock, Shield, Loader2, 
    RefreshCw, Waves, User
} from 'lucide-react';
import { generateSAS } from '../../utils/crypto';
import { debugService } from '../../services/debugService';

// --- TYPES ---
type CallState = 'IDLE' | 'SIGNALING' | 'RINGING' | 'CONNECTED' | 'SECURE_HANDSHAKE' | 'TERMINATED' | 'RECONNECTING';

// --- ENGINE: STABLE VOICE PROCESSOR ---
class SecureVoiceProcessor {
    ctx: AudioContext;
    micSource: MediaStreamAudioSourceNode | null = null;
    destination: MediaStreamAudioDestinationNode;
    outputGain: GainNode;
    analyser: AnalyserNode;
    filter: BiquadFilterNode;
    
    constructor() {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContextClass();
        this.destination = this.ctx.createMediaStreamDestination();
        this.outputGain = this.ctx.createGain();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 256;
        this.filter = this.ctx.createBiquadFilter();
        
        // Default processing chain
        this.outputGain.connect(this.destination);
        this.outputGain.connect(this.analyser);
    }

    async resume() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }

    setupNodes(stream: MediaStream) {
        if (this.micSource) this.micSource.disconnect();
        this.micSource = this.ctx.createMediaStreamSource(stream);
        
        // Basic noise floor cleaning
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 8000; 

        this.micSource.connect(this.filter);
        this.filter.connect(this.outputGain);
    }

    setMute(muted: boolean) {
        this.outputGain.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05);
    }

    cleanup() {
        if (this.ctx.state !== 'closed') {
            this.ctx.close();
        }
    }
}

const WaveformVisualizer: React.FC<{ analyser: AnalyserNode | null; isMuted: boolean }> = ({ analyser, isMuted }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!analyser || !canvasRef.current || isMuted) return;
        
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
                // Professional accent color visualizer
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
        };

        draw();
        return () => cancelAnimationFrame(animationId);
    }, [analyser, isMuted]);

    return (
        <canvas 
            ref={canvasRef} 
            width={300} 
            height={80} 
            className="w-full h-full opacity-60" 
        />
    );
};

// --- COMPONENT: TELEPONAN VIEW ---
interface TeleponanProps {
    onClose: () => void;
    existingPeer?: any;
    initialTargetId?: string;
    incomingCall?: any;
    secretPin?: string;
}

export const TeleponanView: React.FC<TeleponanProps> = ({ onClose, existingPeer, initialTargetId, incomingCall, secretPin }) => {
    // State
    const [state, setState] = useState<CallState>(incomingCall ? 'RINGING' : 'IDLE');
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [sasCode, setSasCode] = useState<string | null>(null);
    const [reconnectAttempts, setReconnectAttempts] = useState(0);

    // Refs
    const activeCallRef = useRef<any>(null);
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const engineRef = useRef<SecureVoiceProcessor | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const timerRef = useRef<any>(null);
    const monitorRef = useRef<any>(null);

    // Initialize SAS Code
    useEffect(() => {
        if (secretPin && existingPeer?.id && (initialTargetId || incomingCall?.peer)) {
            const partnerId = initialTargetId || incomingCall?.peer;
            generateSAS(existingPeer.id, partnerId, secretPin).then(setSasCode);
        }
    }, [secretPin, existingPeer, initialTargetId, incomingCall]);

    // Handle Call Timer
    useEffect(() => {
        if (state === 'CONNECTED') {
            timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [state]);

    // Haptic Feedback Helper
    const triggerHaptic = (type: 'light' | 'medium' | 'heavy') => {
        if (navigator.vibrate) {
            const patterns = { light: [10], medium: [30], heavy: [60] };
            navigator.vibrate(patterns[type]);
        }
    };

    // --- ACTIONS ---

    const terminateCall = useCallback(() => {
        triggerHaptic('heavy');
        setState('TERMINATED');
        
        if (activeCallRef.current) activeCallRef.current.close();
        if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
        if (engineRef.current) engineRef.current.cleanup();
        
        clearInterval(monitorRef.current);
        debugService.log('INFO', 'VOICE', 'TERMINATE', 'Call ended by user or system.');
        setTimeout(onClose, 800);
    }, [onClose]);

    const startMicAndEngine = async () => {
        try {
            // Request High-Quality Audio constraints
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { 
                    echoCancellation: true, 
                    noiseSuppression: true, 
                    autoGainControl: true,
                    sampleRate: 48000
                } 
            });
            
            localStreamRef.current = stream;
            
            if (!engineRef.current) {
                engineRef.current = new SecureVoiceProcessor();
            }
            
            await engineRef.current.resume(); // iOS Fix
            engineRef.current.setupNodes(stream);
            
            return engineRef.current.destination.stream;
        } catch (err) {
            console.error("Mic Access Denied", err);
            alert("Izin mikrofon diperlukan untuk melakukan panggilan.");
            terminateCall();
            return null;
        }
    };

    // Auto-Reconnect Logic
    const handleIceDisconnect = () => {
        if (state === 'TERMINATED') return;
        
        if (reconnectAttempts < 5) {
            console.warn("ICE Disconnected. Attempting Reconnect...");
            setState('RECONNECTING');
            setReconnectAttempts(prev => prev + 1);
            // PeerJS handles WebRTC restart internally if checks are right, otherwise we re-dial
            // For stability, we wait a moment.
        } else {
            terminateCall();
        }
    };

    const handleCallEvents = (call: any) => {
        call.on('stream', (remoteStream: MediaStream) => {
            if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = remoteStream;
                remoteAudioRef.current.play().catch(e => console.warn("Autoplay blocked:", e));
                setState('CONNECTED');
                setReconnectAttempts(0);
                triggerHaptic('medium');
                
                // Monitor stream health
                monitorRef.current = setInterval(() => {
                    if (!remoteStream.active || remoteStream.getAudioTracks()[0].readyState === 'ended') {
                         handleIceDisconnect();
                    }
                }, 2000);
            }
        });

        call.on('close', terminateCall);
        call.on('error', (err: any) => {
            console.error("PeerJS Call Error:", err);
            handleIceDisconnect();
        });
    };

    const handleMakeCall = async () => {
        if (!initialTargetId || !existingPeer) return;
        triggerHaptic('light');
        setState('SIGNALING');

        const stream = await startMicAndEngine();
        if (stream) {
            const call = existingPeer.call(initialTargetId, stream, {
                metadata: { type: 'SECURE_VOICE_v2', pin_hash: secretPin }
            });
            activeCallRef.current = call;
            handleCallEvents(call);
        }
    };

    const handleAnswerCall = async () => {
        if (!incomingCall) return;
        triggerHaptic('medium');
        setState('SECURE_HANDSHAKE');

        const stream = await startMicAndEngine();
        if (stream) {
            incomingCall.answer(stream);
            activeCallRef.current = incomingCall;
            handleCallEvents(incomingCall);
        }
    };

    const toggleMute = () => {
        const newState = !isMuted;
        setIsMuted(newState);
        engineRef.current?.setMute(newState);
        triggerHaptic('light');
    };

    // Auto-initiate if outbound
    useEffect(() => {
        if (state === 'IDLE' && initialTargetId) {
            handleMakeCall();
        }
        return () => {
            if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
            if (engineRef.current) engineRef.current.cleanup();
        };
    }, []);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 z-[10000] bg-[color:var(--bg)] flex flex-col font-sans text-[color:var(--accent)] animate-fade-in overflow-hidden select-none sheen">
            {/* Hidden Audio Element */}
            <audio ref={remoteAudioRef} playsInline autoPlay className="hidden" />

            {/* BACKGROUND DECORATION */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_var(--bg)_100%)]"></div>
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:30px_30px] opacity-40"></div>
                {state === 'CONNECTED' && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-10">
                        <Waves size={600} className="text-[color:var(--accent)] animate-[pulse_4s_ease-in-out_infinite]" strokeWidth={0.5} />
                    </div>
                )}
            </div>

            {/* 1. HEADER (Status Bar) */}
            <header className="relative z-10 p-6 pt-[calc(env(safe-area-inset-top)+1rem)] flex justify-between items-center bg-[color:var(--bg)]/40 backdrop-blur-md border-b border-[color:var(--accent)]/30">
                <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px_var(--accent-glow)] ${state === 'CONNECTED' ? 'bg-[color:var(--accent)] animate-pulse' : 'bg-[color:var(--text-muted)]'}`}></div>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[color:var(--text)]">SECURE_VOICE_TUNNEL</span>
                </div>
                {state === 'CONNECTED' && (
                    <div className="px-3 py-1 rounded-lg bg-[color:var(--accent)]/10 border border-[color:var(--accent)]/20 text-[color:var(--accent)] font-mono text-xs font-black tracking-widest">
                        {formatTime(duration)}
                    </div>
                )}
            </header>

            {/* 2. MAIN BODY */}
            <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
                
                {/* Visual Identity */}
                <div className="relative mb-10 group">
                    <div className={`w-44 h-44 rounded-full border-2 transition-all duration-700 flex items-center justify-center relative overflow-hidden
                        ${state === 'CONNECTED' ? 'border-[color:var(--accent)]/50 shadow-[0_0_50px_rgba(255,255,255,0.15)]' : 'border-white/10 animate-pulse'}
                        ${state === 'RECONNECTING' ? 'border-[color:var(--warning)] animate-bounce' : ''}
                    `}>
                         <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--accent)]/10 to-transparent animate-scan-up"></div>
                         {state === 'CONNECTED' ? <User size={64} className="text-[color:var(--accent)]" /> : <Shield size={64} className="text-[color:var(--text-muted)]" />}
                    </div>

                    {/* SAS Verification Code */}
                    {state === 'CONNECTED' && sasCode && (
                        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-[color:var(--bg)] border border-[color:var(--accent)]/30 px-4 py-1.5 rounded-full shadow-2xl backdrop-blur-xl animate-fade-in">
                            <span className="text-[9px] font-black text-[color:var(--accent)] uppercase tracking-widest block text-center mb-0.5 opacity-50">SAS_VERIFY</span>
                            <span className="text-sm font-mono font-black text-[color:var(--text)] tracking-widest whitespace-nowrap">{sasCode}</span>
                        </div>
                    )}
                </div>

                {/* Target Name */}
                <div className="text-center space-y-2 mb-12">
                    <h2 className="text-2xl font-black text-[color:var(--text)] tracking-tight uppercase break-all px-6">
                        {initialTargetId || incomingCall?.peer || "SIGNALING..."}
                    </h2>
                    <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-[color:var(--text-muted)]">
                        {state === 'CONNECTED' ? (
                            <span className="flex items-center gap-1.5 text-[color:var(--accent)]">
                                <Lock size={10} /> END_TO_END_ENCRYPTED
                            </span>
                        ) : state === 'RECONNECTING' ? (
                            <span className="text-[color:var(--warning)] flex items-center gap-2"><RefreshCw size={10} className="animate-spin" /> RESTORING UPLINK...</span>
                        ) : (
                            <span className="animate-pulse">{state.replace('_', ' ')}</span>
                        )}
                    </div>
                </div>

                {/* 3. CONTROLS GRID */}
                <div className="w-full max-w-sm space-y-8 animate-slide-up pb-[calc(env(safe-area-inset-bottom)+2rem)]">
                    
                    {/* Active Waveform */}
                    <div className="h-20 w-full">
                        <WaveformVisualizer analyser={engineRef.current?.analyser || null} isMuted={isMuted} />
                    </div>

                    {/* Action Panel */}
                    <div className="flex flex-col items-center gap-8">
                        
                        {state === 'RINGING' ? (
                            <div className="flex gap-10">
                                <button onClick={terminateCall} className="w-20 h-20 rounded-full bg-[color:var(--danger)]/20 border border-[color:var(--danger)]/50 text-[color:var(--danger)] flex items-center justify-center hover:bg-[color:var(--danger)] hover:text-[color:var(--text-invert)] transition-all active:scale-90">
                                    <PhoneOff size={32} />
                                </button>
                                <button onClick={handleAnswerCall} className="w-20 h-20 rounded-full bg-[color:var(--accent)] text-[color:var(--text-invert)] flex items-center justify-center shadow-[0_0_30px_var(--accent-glow)] animate-bounce active:scale-90">
                                    <Phone size={32} fill="currentColor" />
                                </button>
                            </div>
                        ) : state === 'CONNECTED' || state === 'RECONNECTING' ? (
                            <div className="grid grid-cols-2 gap-6 items-center w-full">
                                <button onClick={toggleMute} className={`w-16 h-16 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 mx-auto
                                    ${isMuted ? 'bg-[color:var(--danger)] border-[color:var(--danger)] text-[color:var(--text-invert)] animate-pulse' : 'bg-white/5 border-white/10 text-[color:var(--text-muted)] hover:text-[color:var(--text)]'}
                                `}>
                                    {isMuted ? <MicOff size={24}/> : <Mic size={24}/>}
                                    <span className="text-[7px] font-black uppercase">MUTE</span>
                                </button>

                                <button onClick={terminateCall} className="w-16 h-16 rounded-2xl bg-[color:var(--danger)] text-[color:var(--text-invert)] flex items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.4)] hover:brightness-110 active:scale-95 transition-all border-4 border-[color:var(--bg)] mx-auto">
                                    <PhoneOff size={32} fill="currentColor" />
                                </button>
                            </div>
                        ) : (
                            <button onClick={terminateCall} className="px-10 py-3 rounded-xl bg-white/5 border border-white/10 text-[color:var(--text-muted)] hover:text-[color:var(--danger)] hover:border-[color:var(--danger)]/50 transition-all font-black text-xs tracking-widest">
                                CANCEL_UPLINK
                            </button>
                        )}

                    </div>
                </div>
            </main>
        </div>
    );
};
