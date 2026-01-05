
import React, { useState, useEffect, useRef } from 'react';
import { 
    Phone, PhoneOff, Mic, MicOff, Activity, 
    Volume2, CloudRain, Lock, Zap, 
    Fingerprint, User, Signal, WifiOff, X,
    Shield, Disc, Radio, Loader2, Server, Globe
} from 'lucide-react';
import { generateSAS } from '../../utils/crypto';

// Types
type CallState = 'IDLE' | 'SIGNALING' | 'RINGING' | 'CONNECTED' | 'SECURE_HANDSHAKE' | 'TERMINATED' | 'RECONNECTING';
type VoiceEffect = 'NORMAL' | 'DEEP_COVER' | 'CYBER_MASK' | 'RADIO_BURST';
type AmbientMode = 'OFF' | 'RAIN' | 'DATA_CENTER' | 'CAFE';

interface TeleponanProps {
    onClose: () => void;
    existingPeer?: any;
    initialTargetId?: string;
    incomingCall?: any;
    secretPin?: string;
}

// --- AUDIO ENGINE V2 (Effects Processor) ---
class VoiceProcessor {
    ctx: AudioContext;
    micSource: MediaStreamAudioSourceNode | null = null;
    destination: MediaStreamAudioDestinationNode;
    outputNode: GainNode;
    analyser: AnalyserNode;
    
    // Effects
    filterNode: BiquadFilterNode;
    shaperNode: WaveShaperNode;
    ambientGain: GainNode;
    ambientSource: AudioBufferSourceNode | OscillatorNode | null = null;

    constructor() {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioContextClass();
        this.destination = this.ctx.createMediaStreamDestination();
        this.outputNode = this.ctx.createGain();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 256;

        this.filterNode = this.ctx.createBiquadFilter();
        this.shaperNode = this.ctx.createWaveShaper();
        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.value = 0.15; // Low volume for ambient

        // Chain: Output -> Destination
        this.outputNode.connect(this.destination);
        this.outputNode.connect(this.analyser);
        this.ambientGain.connect(this.outputNode); // Inject ambient into output
    }

    async initMic(stream: MediaStream) {
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        this.micSource = this.ctx.createMediaStreamSource(stream);
        
        // Default Chain: Mic -> Filter -> Shaper -> Output
        this.micSource.connect(this.filterNode);
        this.filterNode.connect(this.shaperNode);
        this.shaperNode.connect(this.outputNode);
        
        this.setEffect('NORMAL'); // Init default
    }

    setEffect(effect: VoiceEffect) {
        // Reset curves
        this.shaperNode.curve = null;
        
        const t = this.ctx.currentTime;
        if (effect === 'NORMAL') {
            this.filterNode.type = 'allpass';
            this.filterNode.frequency.setValueAtTime(0, t);
        } else if (effect === 'DEEP_COVER') {
            this.filterNode.type = 'lowpass';
            this.filterNode.frequency.setTargetAtTime(600, t, 0.1);
            // Simple saturation for "heavy" feel
            this.makeDistortionCurve(50); 
        } else if (effect === 'CYBER_MASK') {
             this.filterNode.type = 'highpass';
             this.filterNode.frequency.setTargetAtTime(1000, t, 0.1);
             this.makeDistortionCurve(400); // Heavy crush
        } else if (effect === 'RADIO_BURST') {
             this.filterNode.type = 'bandpass';
             this.filterNode.frequency.setTargetAtTime(2000, t, 0.1);
             this.filterNode.Q.value = 1;
             this.makeDistortionCurve(100);
        }
    }

    setAmbient(mode: AmbientMode) {
        if (this.ambientSource) {
            try { (this.ambientSource as any).stop(); } catch(e){}
            this.ambientSource.disconnect();
            this.ambientSource = null;
        }

        if (mode === 'OFF') return;

        if (mode === 'RAIN') {
            // White Noise Gen
            const bufferSize = 2 * this.ctx.sampleRate;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const output = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            noise.loop = true;
            
            // Filter noise for rain sound
            const noiseFilter = this.ctx.createBiquadFilter();
            noiseFilter.type = 'lowpass';
            noiseFilter.frequency.value = 800;
            
            noise.connect(noiseFilter);
            noiseFilter.connect(this.ambientGain);
            noise.start();
            this.ambientSource = noise;
        } else if (mode === 'DATA_CENTER') {
            // Low drone
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = 60;
            const lpf = this.ctx.createBiquadFilter();
            lpf.type = 'lowpass';
            lpf.frequency.value = 120;
            
            osc.connect(lpf);
            lpf.connect(this.ambientGain);
            osc.start();
            this.ambientSource = osc;
        }
    }

    makeDistortionCurve(amount: number) {
        const k = typeof amount === 'number' ? amount : 50;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        for (let i = 0; i < n_samples; ++i) {
            const x = (i * 2) / n_samples - 1;
            curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
        }
        this.shaperNode.curve = curve;
    }

    getProcessedStream() {
        return this.destination.stream;
    }

    cleanup() {
        if(this.micSource) this.micSource.disconnect();
        if(this.ambientSource) {
            try { (this.ambientSource as any).stop(); } catch(e){}
            this.ambientSource.disconnect();
        }
        this.ctx.close();
    }
}

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


export const TeleponanView: React.FC<TeleponanProps> = ({ onClose, existingPeer, initialTargetId, incomingCall, secretPin }) => {
    // STATE
    const [state, setState] = useState<CallState>(incomingCall ? 'RINGING' : (initialTargetId ? 'SIGNALING' : 'IDLE'));
    
    const [targetId, setTargetId] = useState(initialTargetId || '');
    const [isMuted, setIsMuted] = useState(false);
    const [duration, setDuration] = useState(0);
    
    // Effects State
    const [effectMode, setEffectMode] = useState<VoiceEffect>('NORMAL');
    const [ambientMode, setAmbientMode] = useState<AmbientMode>('OFF');
    const [isolationMode, setIsolationMode] = useState(false);

    const callRef = useRef<any>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const engineRef = useRef<VoiceProcessor | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    
    // Auto-Answer Logic for "Seamless" transition from Notification
    useEffect(() => {
        if (incomingCall) {
            handleIncomingCall(incomingCall, true); // True = Auto Answer
        } else if (initialTargetId) {
             // Outgoing call initiation
             makeCall();
        }
    }, []); // Run once on mount

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
            const constraints = { 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: isolationMode, // Use toggle state
                    autoGainControl: true
                }
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            
            // Initialize FX Engine
            engineRef.current = new VoiceProcessor();
            await engineRef.current.initMic(stream);
            
            return stream; // Return original stream reference, BUT... we usually use processed stream for call
        } catch (e) {
            console.error("Mic failed", e);
            alert("Mic access denied.");
            return null;
        }
    };

    const handleIncomingCall = async (call: any, autoAnswer = false) => {
        callRef.current = call;
        
        const answer = async () => {
            const inputStream = await startAudio(); // Init Mic
            
            if (inputStream && engineRef.current) {
                // Answer with the PROCESSED stream from our engine
                const processedStream = engineRef.current.getProcessedStream();
                call.answer(processedStream);
                
                call.on('stream', (remoteStream: MediaStream) => {
                    if (audioRef.current) {
                        audioRef.current.srcObject = remoteStream;
                        // iOS Fix: Must call play() inside user interaction context usually, 
                        // but since we are inside a button click handler context (via answer call), this might work.
                        // If auto-answer, it might be blocked on iOS if no prior interaction.
                        audioRef.current.play().catch(e => console.warn("Auto-play blocked:", e));
                        setState('CONNECTED');
                    }
                });
                
                call.on('close', terminateCall);
                call.on('error', terminateCall);
            }
        };

        if (autoAnswer) {
            answer();
        } else {
            setState('RINGING'); // Show accept button (fallback)
        }
    };

    const makeCall = async () => {
        if (!targetId || !existingPeer) return;
        setState('SIGNALING');
        
        const inputStream = await startAudio();
        
        if (inputStream && engineRef.current) {
            // Call with PROCESSED stream
            const processedStream = engineRef.current.getProcessedStream();
            const call = existingPeer.call(targetId, processedStream);
            callRef.current = call;
            
            call.on('stream', (remoteStream: MediaStream) => {
                 if (audioRef.current) {
                    audioRef.current.srcObject = remoteStream;
                    audioRef.current.play().catch(e => console.warn("Auto-play blocked:", e));
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
        setTimeout(onClose, 1500);
    };

    const toggleMute = () => {
        if (streamRef.current) {
            const track = streamRef.current.getAudioTracks()[0];
            track.enabled = !track.enabled;
            setIsMuted(!track.enabled);
        }
    };

    const changeEffect = (effect: VoiceEffect) => {
        setEffectMode(effect);
        engineRef.current?.setEffect(effect);
    };

    const changeAmbient = (amb: AmbientMode) => {
        setAmbientMode(amb);
        engineRef.current?.setAmbient(amb);
    };

    return (
        <div className="fixed inset-0 z-[10000] bg-[#050505] flex flex-col font-mono text-emerald-500 animate-fade-in">
            {/* Hidden audio element with playsInline for iOS */}
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
            <div className="flex-1 flex flex-col items-center relative z-10 p-6 overflow-y-auto custom-scroll">
                
                {/* Visualizer / Avatar */}
                <div className="relative mb-8 mt-4 shrink-0">
                    <div className={`w-40 h-40 rounded-full border-2 border-emerald-500/20 bg-black/60 flex items-center justify-center relative overflow-hidden ${state === 'SIGNALING' || state === 'RINGING' ? 'animate-pulse' : ''}`}>
                         {/* Radar Sweep */}
                         <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/20 to-transparent h-1/2 w-full animate-[spin_3s_linear_infinite] origin-bottom-center opacity-30"></div>
                         
                         {state === 'CONNECTED' ? (
                             <User size={56} className="text-emerald-500" />
                         ) : (
                             <Fingerprint size={56} className="text-neutral-600" />
                         )}
                    </div>
                    
                    {/* Status Pill */}
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-black border border-emerald-900 px-3 py-1 rounded-full flex items-center gap-2 shadow-[0_0_20px_rgba(0,0,0,0.8)] whitespace-nowrap">
                         {state === 'CONNECTED' ? <Lock size={10} className="text-emerald-500"/> : <Loader2 size={10} className="animate-spin text-amber-500"/>}
                         <span className="text-[8px] font-bold uppercase tracking-widest text-white">
                             {state === 'CONNECTED' ? 'AES-256 ENCRYPTED' : state}
                         </span>
                    </div>
                </div>

                {/* Target Info */}
                <div className="text-center space-y-2 mb-8">
                    <h2 className="text-xl font-black text-white tracking-tight break-all px-4">
                        {targetId || incomingCall?.peer || "UNKNOWN_TARGET"}
                    </h2>
                    <p className="text-[9px] text-emerald-600 font-mono uppercase tracking-widest">
                        P2P_DIRECT_LINK // LOW_LATENCY
                    </p>
                </div>

                {/* ACTIVE CALL CONTROLS */}
                {state === 'CONNECTED' && (
                    <div className="w-full max-w-sm space-y-6 animate-slide-up pb-8">
                        <WaveformVisualizer analyser={engineRef.current?.analyser || null} isMuted={isMuted} />
                        
                        {/* CONTROL DECK */}
                        <div className="bg-[#0f0f11] rounded-3xl border border-white/5 p-4 space-y-4 shadow-xl">
                            
                            {/* Row 1: Voice Effects */}
                            <div className="space-y-2">
                                <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest pl-1">VOICE_MASKING_PROTOCOL</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {['NORMAL', 'DEEP_COVER', 'CYBER_MASK', 'RADIO_BURST'].map((eff) => (
                                        <button 
                                            key={eff}
                                            onClick={() => changeEffect(eff as VoiceEffect)}
                                            className={`h-10 rounded-xl flex items-center justify-center border transition-all ${effectMode === eff ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-white/5 border-transparent text-neutral-600 hover:text-white'}`}
                                            title={eff}
                                        >
                                            {eff === 'NORMAL' && <User size={14}/>}
                                            {eff === 'DEEP_COVER' && <Shield size={14}/>}
                                            {eff === 'CYBER_MASK' && <Zap size={14}/>}
                                            {eff === 'RADIO_BURST' && <Radio size={14}/>}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Row 2: Ambience & Isolation */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest pl-1">AMBIENT_INJECTION</label>
                                    <div className="flex bg-white/5 rounded-xl p-1">
                                        <button onClick={() => changeAmbient('OFF')} className={`flex-1 h-8 rounded-lg flex items-center justify-center transition-all ${ambientMode === 'OFF' ? 'bg-black text-white' : 'text-neutral-500'}`}><Volume2 size={12}/></button>
                                        <button onClick={() => changeAmbient('RAIN')} className={`flex-1 h-8 rounded-lg flex items-center justify-center transition-all ${ambientMode === 'RAIN' ? 'bg-blue-500/20 text-blue-400' : 'text-neutral-500'}`}><CloudRain size={12}/></button>
                                        <button onClick={() => changeAmbient('DATA_CENTER')} className={`flex-1 h-8 rounded-lg flex items-center justify-center transition-all ${ambientMode === 'DATA_CENTER' ? 'bg-purple-500/20 text-purple-400' : 'text-neutral-500'}`}><Server size={12}/></button>
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest pl-1">NOISE_GATE</label>
                                    <button 
                                        onClick={() => setIsolationMode(!isolationMode)}
                                        className={`w-full h-10 rounded-xl flex items-center justify-center gap-2 text-[9px] font-bold uppercase transition-all ${isolationMode ? 'bg-emerald-500 text-black shadow-lg' : 'bg-white/5 text-neutral-500'}`}
                                    >
                                        {isolationMode ? <Shield size={12} fill="currentColor"/> : <Disc size={12}/>}
                                        {isolationMode ? 'ISOLATION_ACTIVE' : 'STANDARD_MIC'}
                                    </button>
                                </div>
                            </div>

                        </div>

                        {/* Main Actions */}
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

                {/* Manual Connect (Idle) */}
                {state === 'IDLE' && (
                    <div className="w-full max-w-xs space-y-4 animate-fade-in">
                        <input 
                            value={targetId}
                            onChange={e => setTargetId(e.target.value)}
                            placeholder="TARGET ID..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500 transition-all"
                        />
                        <button onClick={makeCall} disabled={!targetId} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-black font-black uppercase text-xs tracking-widest rounded-xl transition-all disabled:opacity-50 shadow-lg">
                            INITIATE UPLINK
                        </button>
                         <button onClick={onClose} className="w-full py-3 text-neutral-500 hover:text-white text-xs font-bold tracking-widest uppercase">
                            CANCEL
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
