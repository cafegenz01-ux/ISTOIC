
import React, { useState, useEffect, useRef } from 'react';
import { 
    Phone, PhoneOff, Mic, MicOff, 
    Lock, User, Fingerprint, Loader2
} from 'lucide-react';

type CallState = 'IDLE' | 'SIGNALING' | 'RINGING' | 'CONNECTED' | 'TERMINATED';

interface TeleponanProps {
    onClose: () => void;
    existingPeer?: any;
    initialTargetId?: string;
    incomingCall?: any;
    secretPin?: string;
}

// Minimal Audio Processor (Same logic, shortened for clarity in this file update)
class VoiceProcessor {
    ctx: AudioContext;
    destination: MediaStreamAudioDestinationNode;
    micSource: MediaStreamAudioSourceNode | null = null;
    analyser: AnalyserNode;

    constructor() {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContextClass();
        this.destination = this.ctx.createMediaStreamDestination();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 256;
    }

    async initMic(stream: MediaStream) {
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        this.micSource = this.ctx.createMediaStreamSource(stream);
        this.micSource.connect(this.analyser);
        this.micSource.connect(this.destination);
    }
    
    getProcessedStream() { return this.destination.stream; }
    cleanup() {
        if(this.micSource) this.micSource.disconnect();
        if(this.ctx.state !== 'closed') this.ctx.close();
    }
}

// Waveform Component
const WaveformVisualizer: React.FC<{ analyser: AnalyserNode | null, isMuted: boolean }> = ({ analyser, isMuted }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        if (!canvasRef.current || !analyser) return;
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
            if (isMuted) {
                ctx.beginPath();
                ctx.moveTo(0, canvas.height / 2);
                ctx.lineTo(canvas.width, canvas.height / 2);
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 2;
                ctx.stroke();
                return;
            }
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * canvas.height;
                const r = barHeight + (25 * (i/bufferLength));
                const g = 250 * (i/bufferLength);
                const b = 50;
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
        };
        draw();
        return () => cancelAnimationFrame(animationId);
    }, [analyser, isMuted]);
    return <canvas ref={canvasRef} width={320} height={80} className="w-full h-20 rounded-xl bg-black/40 backdrop-blur-sm border border-white/5 shadow-inner" />;
};

export const TeleponanView: React.FC<TeleponanProps> = ({ onClose, existingPeer, initialTargetId, incomingCall }) => {
    const [state, setState] = useState<CallState>(incomingCall ? 'RINGING' : (initialTargetId ? 'SIGNALING' : 'IDLE'));
    const [targetId, setTargetId] = useState(initialTargetId || '');
    const [isMuted, setIsMuted] = useState(false);
    const [duration, setDuration] = useState(0);

    const callRef = useRef<any>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const engineRef = useRef<VoiceProcessor | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    
    // Auto-answer if incoming call provided (triggered from IStokView)
    useEffect(() => {
        if (incomingCall) handleIncomingCall(incomingCall, false); 
        else if (initialTargetId && existingPeer) makeCall();
        else if (!existingPeer) {
            alert("No Peer Connection Found. Aborting.");
            onClose();
        }
    }, []);

    // Timer
    useEffect(() => {
        let interval: any;
        if (state === 'CONNECTED') {
            interval = setInterval(() => setDuration(p => p + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [state]);

    const formatTime = (s: number) => {
        const min = Math.floor(s / 60).toString().padStart(2, '0');
        const sec = (s % 60).toString().padStart(2, '0');
        return `${min}:${sec}`;
    };

    const startAudio = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
            streamRef.current = stream;
            engineRef.current = new VoiceProcessor();
            await engineRef.current.initMic(stream);
            return stream;
        } catch (e) {
            console.error("Mic failed", e);
            alert("Mic access denied.");
            return null;
        }
    };

    const handleIncomingCall = async (call: any, autoAnswer = false) => {
        callRef.current = call;
        const answer = async () => {
            const inputStream = await startAudio();
            if (inputStream && engineRef.current) {
                const processedStream = engineRef.current.getProcessedStream();
                call.answer(processedStream);
                
                call.on('stream', (remoteStream: MediaStream) => {
                    if (audioRef.current) {
                        audioRef.current.srcObject = remoteStream;
                        audioRef.current.play().catch(() => {});
                        setState('CONNECTED');
                    }
                });
                
                call.on('close', terminateCall);
                call.on('error', terminateCall);
            }
        };
        if (autoAnswer) answer();
    };

    const answerCall = () => {
        if (callRef.current) handleIncomingCall(callRef.current, true);
    };

    const makeCall = async () => {
        if (!targetId || !existingPeer) return;
        setState('SIGNALING');
        const inputStream = await startAudio();
        
        if (inputStream && engineRef.current) {
            const processedStream = engineRef.current.getProcessedStream();
            const call = existingPeer.call(targetId, processedStream);
            callRef.current = call;
            
            call.on('stream', (remoteStream: MediaStream) => {
                 if (audioRef.current) {
                    audioRef.current.srcObject = remoteStream;
                    audioRef.current.play().catch(() => {});
                    setState('CONNECTED');
                }
            });
            
            call.on('close', terminateCall);
            call.on('error', terminateCall);
        } else {
            setState('IDLE');
        }
    };

    const terminateCall = () => {
        setState('TERMINATED');
        callRef.current?.close();
        engineRef.current?.cleanup();
        streamRef.current?.getTracks().forEach(t => t.stop());
        setTimeout(onClose, 1000);
    };

    const toggleMute = () => {
        if (streamRef.current) {
            const track = streamRef.current.getAudioTracks()[0];
            track.enabled = !track.enabled;
            setIsMuted(!track.enabled);
        }
    };

    return (
        <div className="fixed inset-0 z-[10000] bg-[#050505] flex flex-col font-mono text-emerald-500 animate-fade-in">
            <audio ref={audioRef} className="hidden" playsInline autoPlay />
            
            {/* Background FX */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#000_100%)] pointer-events-none"></div>
            <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:30px_30px] opacity-50"></div>

            {/* Header */}
            <div className="relative z-10 px-6 py-4 pt-[calc(env(safe-area-inset-top)+1rem)] flex justify-between items-center bg-black/40 backdrop-blur-md border-b border-emerald-900/30">
                <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px_#10b981] ${state === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-600'}`}></div>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">SECURE_VOICE_UPLINK</span>
                </div>
                {state === 'CONNECTED' && <div className="text-xl font-bold text-white tracking-widest">{formatTime(duration)}</div>}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center relative z-10 p-6 overflow-y-auto custom-scroll justify-center">
                
                <div className="relative mb-8 mt-4 shrink-0">
                    <div className={`w-40 h-40 rounded-full border-2 border-emerald-500/20 bg-black/60 flex items-center justify-center relative overflow-hidden ${state === 'SIGNALING' || state === 'RINGING' ? 'animate-pulse' : ''}`}>
                         <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/20 to-transparent h-1/2 w-full animate-[spin_3s_linear_infinite] origin-bottom-center opacity-30"></div>
                         {state === 'CONNECTED' ? <User size={56} className="text-emerald-500" /> : <Fingerprint size={56} className="text-neutral-600" />}
                    </div>
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-black border border-emerald-900 px-3 py-1 rounded-full flex items-center gap-2 shadow-[0_0_20px_rgba(0,0,0,0.8)] whitespace-nowrap">
                         {state === 'CONNECTED' ? <Lock size={10} className="text-emerald-500"/> : <Loader2 size={10} className="animate-spin text-amber-500"/>}
                         <span className="text-[8px] font-bold uppercase tracking-widest text-white">
                             {state === 'CONNECTED' ? 'AES-256 ENCRYPTED' : state}
                         </span>
                    </div>
                </div>

                <div className="text-center space-y-2 mb-8">
                    <h2 className="text-xl font-black text-white tracking-tight break-all px-4">
                        {targetId || incomingCall?.peer || "UNKNOWN_TARGET"}
                    </h2>
                </div>

                {state === 'RINGING' && (
                    <div className="flex gap-6">
                        <button onClick={terminateCall} className="p-6 rounded-full bg-red-500 text-white shadow-lg animate-pulse"><PhoneOff size={32}/></button>
                        <button onClick={answerCall} className="p-6 rounded-full bg-emerald-500 text-white shadow-lg animate-bounce"><Phone size={32}/></button>
                    </div>
                )}

                {state === 'CONNECTED' && (
                    <div className="w-full max-w-sm space-y-6 animate-slide-up pb-8">
                        <WaveformVisualizer analyser={engineRef.current?.analyser || null} isMuted={isMuted} />
                        <div className="flex items-center justify-center gap-6 pt-4">
                             <button onClick={toggleMute} className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${isMuted ? 'bg-amber-500 text-black animate-pulse' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                                 {isMuted ? <MicOff size={24}/> : <Mic size={24}/>}
                             </button>
                             <button onClick={terminateCall} className="w-20 h-20 rounded-full bg-red-600 text-white flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.5)] hover:scale-105 active:scale-95 transition-all border-4 border-[#050505]">
                                 <PhoneOff size={32} fill="currentColor" />
                             </button>
                        </div>
                    </div>
                )}
                
                {state === 'SIGNALING' && (
                     <button onClick={terminateCall} className="px-8 py-3 rounded-full bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500 hover:text-white transition-all">CANCEL</button>
                )}
            </div>
        </div>
    );
};
