
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { encodeAudio, decodeAudio, decodeAudioData, noteTools, visualTools, KEY_MANAGER } from "./geminiService";
import { debugService } from "./debugService";
import { browserSpeech } from "./browserSpeech";
import { HANISAH_KERNEL } from "./melsaKernel";

export type NeuralLinkStatus = 'IDLE' | 'CONNECTING' | 'ACTIVE' | 'ERROR' | 'RECONNECTING' | 'THINKING' | 'SPEAKING';
export type MicMode = 'STANDARD' | 'ISOLATION' | 'HIGH_FIDELITY';
export type AmbientMode = 'OFF' | 'CYBER' | 'RAIN' | 'CAFE';
export type EngineType = 'GEMINI_REALTIME' | 'HYDRA_HYBRID';

export interface TranscriptionEvent {
    text: string;
    source: 'user' | 'model';
    isFinal: boolean;
}

export interface NeuralLinkConfig {
    modelId: string;
    persona: 'hanisah' | 'stoic';
    systemInstruction: string;
    voiceName: string;
    engine: EngineType; // ADDED
    onStatusChange: (status: NeuralLinkStatus, error?: string) => void;
    onToolCall: (toolCall: any) => Promise<any>;
    onTranscription?: (event: TranscriptionEvent) => void;
}

// Allowed Gemini Live Voices
const GOOGLE_VALID_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Zephyr'];

// --- AUDIO WORKLET PROCESSOR CODE (Inline) ---
const AUDIO_WORKLET_CODE = `
class PCMWorklet extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 4096;
        this.buffer = new Float32Array(this.bufferSize);
        this.idx = 0;
    }
    process(inputs) {
        const input = inputs[0];
        if (!input || !input[0]) return true;
        const incoming = input[0];
        for (let i = 0; i < incoming.length; i++) {
            this.buffer[this.idx++] = incoming[i];
            if (this.idx >= this.bufferSize) {
                this.port.postMessage(this.buffer.slice());
                this.idx = 0;
            }
        }
        return true;
    }
}
registerProcessor('pcm-worklet', PCMWorklet);
`;

export class NeuralLinkService {
    private session: any = null;
    private inputCtx: AudioContext | null = null;
    private outputCtx: AudioContext | null = null;
    private nextStartTime: number = 0;
    private sources: Set<AudioBufferSourceNode> = new Set();
    private activeStream: MediaStream | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private config: NeuralLinkConfig | null = null;
    private _analyser: AnalyserNode | null = null;
    private isConnecting: boolean = false;
    private isConnected: boolean = false;
    private audioCheckInterval: any = null;
    private retryCount = 0;
    private maxRetries = 3;
    private isWorkletLoaded: boolean = false;
    private lifecycleCleanup: (() => void) | null = null;
    
    // Modules
    private currentMicMode: MicMode = 'STANDARD';

    constructor() {}

    private attachLifecycleHandlers() {
        if (this.lifecycleCleanup) return;

        const handleVisibility = () => {
            if (document.visibilityState === 'hidden') {
                this.pauseContexts();
            } else {
                this.resumeContexts();
            }
        };

        const handlePageHide = () => this.disconnect(true);
        const handleAppPause = () => this.pauseContexts();
        const handleAppResume = () => this.resumeContexts();

        document.addEventListener('visibilitychange', handleVisibility);
        document.addEventListener('pagehide', handlePageHide);
        document.addEventListener('pause', handleAppPause);
        document.addEventListener('resume', handleAppResume);

        this.lifecycleCleanup = () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            document.removeEventListener('pagehide', handlePageHide);
            document.removeEventListener('pause', handleAppPause);
            document.removeEventListener('resume', handleAppResume);
            this.lifecycleCleanup = null;
        };
    }

    private detachLifecycleHandlers() {
        if (this.lifecycleCleanup) {
            this.lifecycleCleanup();
            this.lifecycleCleanup = null;
        }
    }

    private pauseContexts() {
        try { this.inputCtx?.suspend(); } catch (_) {}
        try { this.outputCtx?.suspend(); } catch (_) {}
        if (this.activeStream) {
            this.activeStream.getAudioTracks().forEach(t => { t.enabled = false; });
        }
    }

    private resumeContexts() {
        try { if (this.inputCtx && this.inputCtx.state === 'suspended') this.inputCtx.resume(); } catch (_) {}
        try { if (this.outputCtx && this.outputCtx.state === 'suspended') this.outputCtx.resume(); } catch (_) {}
        if (this.activeStream) {
            this.activeStream.getAudioTracks().forEach(t => { t.enabled = true; });
        }
    }

    private closeContexts() {
        if (this.inputCtx) {
            try { this.inputCtx.close(); } catch (_) {}
            this.inputCtx = null;
            this.isWorkletLoaded = false;
        }
        if (this.outputCtx) {
            try { this.outputCtx.close(); } catch (_) {}
            this.outputCtx = null;
            this._analyser = null;
        }
    }

    async switchVoice(voiceName: string) {
        if (!this.config) return;
        this.config.voiceName = voiceName;
        if (this.config.engine === 'GEMINI_REALTIME' && this.isConnected) {
            await this.connect({ ...this.config, voiceName });
        }
    }

    get analyser() {
        return this._analyser;
    }

    async connect(config: NeuralLinkConfig) {
        // Prevent race condition
        if (this.isConnecting) return;
        
        this.isConnecting = true;
        this.config = config;
        this.retryCount = 0;
        this.disconnect(true); 
        this.attachLifecycleHandlers();
        config.onStatusChange('CONNECTING');

        // Choose Engine
        if (config.engine === 'GEMINI_REALTIME') {
            await this.attemptGeminiConnection(config);
        } else {
            await this.startHybridSession(config);
        }
    }

    // --- ENGINE A: GOOGLE GEMINI REALTIME (WEBSOCKET) ---
    private async attemptGeminiConnection(config: NeuralLinkConfig) {
        try {
            await this.initializeAudioContext();
            
            // 3. Initialize Mic
            if (!this.activeStream) {
                await this.setupMicrophone(this.currentMicMode);
            }

            // 4. API Client
            const apiKey = KEY_MANAGER.getKey('GEMINI');
            if (!apiKey) throw new Error("No healthy GEMINI API key available.");

            const ai = new GoogleGenAI({ apiKey });
            
            let selectedVoice = config.voiceName;
            if (!GOOGLE_VALID_VOICES.includes(selectedVoice)) {
                selectedVoice = config.persona === 'hanisah' ? 'Kore' : 'Fenrir';
            }

            const liveTools: any[] = [{ googleSearch: {} }];
            const functions = [...(noteTools.functionDeclarations || []), ...(visualTools?.functionDeclarations || [])];
            if (functions.length > 0) liveTools.push({ functionDeclarations: functions });

            debugService.log('INFO', 'NEURAL_LINK', 'CONNECTING', `Dialing Gemini Live...`);

            const sessionPromise = ai.live.connect({
                model: config.modelId,
                callbacks: {
                    onopen: () => {
                        console.log("[NeuralLink] Socket Opened");
                        this.isConnecting = false;
                        this.isConnected = true;
                        config.onStatusChange('ACTIVE');
                        
                        this.startAudioInputStream(sessionPromise);
                        this.startWatchdog();

                        // Context Init
                        sessionPromise.then(session => {
                            session.sendRealtimeInput({ text: `System initialized. Persona: ${config.persona}. Ready.` });
                        });
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        await this.handleServerMessage(msg, sessionPromise);
                    },
                    onerror: (e) => {
                        console.error("Neural Link Socket Error:", e);
                        if (this.isConnected) {
                             config.onStatusChange('RECONNECTING');
                             this.disconnect(true);
                             // Simple retry
                             setTimeout(() => this.attemptGeminiConnection(config), 2000);
                        }
                    },
                    onclose: (e) => {
                        console.log("Neural Link Socket Closed");
                        if (this.isConnected) this.disconnect();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    tools: liveTools,
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } } },
                    systemInstruction: config.systemInstruction,
                }
            });

            this.session = await sessionPromise;
        } catch (e: any) {
            console.error("Neural Link Setup Failed:", e);
            config.onStatusChange('ERROR', e.message);
            this.disconnect();
        }
    }

    // --- ENGINE B: HYDRA HYBRID (BROWSER STT + LLM + TTS) ---
    // This is the "Stable" mode that doesn't rely on WebSockets
    private async startHybridSession(config: NeuralLinkConfig) {
        try {
            await this.initializeAudioContext(); // Initialize for visualizer only
            if (!this.activeStream) await this.setupMicrophone(this.currentMicMode); // Just for visualizer

            this.isConnected = true;
            this.isConnecting = false;
            config.onStatusChange('ACTIVE');

            // Hook up Browser Speech
            browserSpeech.setLang(config.persona === 'hanisah' ? 'id-ID' : 'en-US');
            
            browserSpeech.startListening(async (text, isFinal) => {
                if (config.onTranscription) {
                    config.onTranscription({ text, source: 'user', isFinal });
                }

                if (isFinal && text.trim().length > 0) {
                    // Stop listening while thinking/speaking to avoid echo
                    browserSpeech.stopListening();
                    config.onStatusChange('THINKING');
                    
                    try {
                        // 1. Process with Kernel (Groq/Gemini Flash)
                        // Use a fast model for "Live" feel
                        const response = await HANISAH_KERNEL.execute(text, 'auto-best', []);
                        
                        if (config.onTranscription && response.text) {
                            config.onTranscription({ text: response.text, source: 'model', isFinal: true });
                        }

                        // 2. Speak Response
                        config.onStatusChange('SPEAKING');
                        
                        // Use Browser TTS for zero latency (or switch to ElevenLabs here if desired)
                        browserSpeech.speak(response.text || "...", config.persona === 'hanisah' ? 'Google Bahasa Indonesia' : undefined, () => {
                             // On finish speaking
                             config.onStatusChange('ACTIVE');
                             browserSpeech.startListening(this.onHybridResult.bind(this));
                        });

                    } catch (e) {
                        config.onStatusChange('ACTIVE'); // Recover
                        browserSpeech.startListening(this.onHybridResult.bind(this));
                    }
                }
            });

            // Start Audio Visualizer from Mic
            if (this.inputCtx && this.activeStream) {
                 const source = this.inputCtx.createMediaStreamSource(this.activeStream);
                 if (this._analyser) source.connect(this._analyser);
            }

        } catch (e: any) {
            config.onStatusChange('ERROR', e.message);
        }
    }

    // Helper for Hybrid binding
    private onHybridResult(text: string, isFinal: boolean) {
        if (!this.config) return;
        // Logic handled in closure above, this is placeholder for type safety if needed
    }

    // --- SHARED AUDIO INFRASTRUCTURE ---

    private async initializeAudioContext() {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        
        if (!this.inputCtx || this.inputCtx.state === 'closed') {
            this.inputCtx = new AudioContextClass({ sampleRate: 16000 });
            this.isWorkletLoaded = false;
        }
        
        if (!this.outputCtx || this.outputCtx.state === 'closed') {
            this.outputCtx = new AudioContextClass({ sampleRate: 24000 });
            this._analyser = this.outputCtx.createAnalyser();
            this._analyser.fftSize = 512;
            this._analyser.smoothingTimeConstant = 0.5;
        }

        // Resume contexts (Critical for iOS)
        try {
            if (this.inputCtx.state === 'suspended') await this.inputCtx.resume();
            if (this.outputCtx.state === 'suspended') await this.outputCtx.resume();
        } catch (e) {}

        // Audio Worklet (Only needed for Gemini Realtime)
        if (this.config?.engine === 'GEMINI_REALTIME' && !this.isWorkletLoaded && this.inputCtx.audioWorklet) {
            try {
                const blob = new Blob([AUDIO_WORKLET_CODE], { type: 'application/javascript' });
                const workletUrl = URL.createObjectURL(blob);
                await this.inputCtx.audioWorklet.addModule(workletUrl);
                this.isWorkletLoaded = true;
            } catch (e) { console.warn("Worklet Load Warn", e); }
        }
    }

    private startWatchdog() {
        this.audioCheckInterval = setInterval(() => {
            try { if (this.outputCtx?.state === 'suspended') this.outputCtx.resume(); } catch (_) {}
            try { if (this.inputCtx?.state === 'suspended') this.inputCtx.resume(); } catch (_) {}
        }, 2000);
    }

    async setMicMode(mode: MicMode) {
        if (!this.isConnected || this.currentMicMode === mode) return;
        this.currentMicMode = mode;
        await this.setupMicrophone(mode);
        if (this.session && this.inputCtx && this.config?.engine === 'GEMINI_REALTIME') {
             const sessionPromise = Promise.resolve(this.session);
             this.startAudioInputStream(sessionPromise);
        }
    }

    private async setupMicrophone(mode: MicMode) {
        if (this.activeStream) {
            this.activeStream.getTracks().forEach(t => t.stop());
        }

        const constraints: MediaTrackConstraints = {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            autoGainControl: true,
            noiseSuppression: mode !== 'HIGH_FIDELITY'
        };

        try {
            this.activeStream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
        } catch (e: any) {
            this.config?.onStatusChange('ERROR', 'Microphone permission denied or unavailable.');
            throw e;
        }
    }

    private startAudioInputStream(sessionPromise: Promise<any>) {
        if (!this.inputCtx || !this.activeStream) return;
        
        try {
            if (this.workletNode) {
                this.workletNode.disconnect();
                this.workletNode = null;
            }

            const source = this.inputCtx.createMediaStreamSource(this.activeStream);
            
            // For Visualizer
            if (this._analyser) source.connect(this._analyser);

            this.workletNode = new AudioWorkletNode(this.inputCtx, 'pcm-worklet');
            
            this.workletNode.port.onmessage = (event) => {
                if (!this.isConnected) return;
                const inputData = event.data as Float32Array;
                
                // VAD Gate
                let sum = 0;
                for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
                const rms = Math.sqrt(sum / inputData.length);
                if (rms < 0.002) return; 

                const int16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    int16[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
                }
                
                const pcmBlob = { 
                    data: encodeAudio(new Uint8Array(int16.buffer)), 
                    mimeType: 'audio/pcm;rate=16000' 
                };
                
                sessionPromise.then(s => { 
                    try { s.sendRealtimeInput({ media: pcmBlob }); } catch (err) {} 
                });
            };
            
            source.connect(this.workletNode);
            this.workletNode.connect(this.inputCtx.destination);
            
        } catch (err) {
            console.error("Input Stream Error:", err);
        }
    }

    private async handleServerMessage(msg: LiveServerMessage, sessionPromise: Promise<any>) {
        // Transcription handling...
        if (this.config?.onTranscription) {
            if (msg.serverContent?.inputTranscription) {
                this.config.onTranscription({ text: msg.serverContent.inputTranscription.text, source: 'user', isFinal: !!msg.serverContent.turnComplete });
            }
            if (msg.serverContent?.outputTranscription) {
                this.config.onTranscription({ text: msg.serverContent.outputTranscription.text, source: 'model', isFinal: !!msg.serverContent.turnComplete });
            }
        }

        // Audio Playback
        const base64Audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (base64Audio && this.outputCtx) {
            try {
                if (this.outputCtx.state === 'suspended') await this.outputCtx.resume();
                const currentTime = this.outputCtx.currentTime;
                if (this.nextStartTime < currentTime) this.nextStartTime = currentTime + 0.05;

                const audioBuffer = await decodeAudioData(decodeAudio(base64Audio), this.outputCtx, 24000, 1);
                const source = this.outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                if (this._analyser) source.connect(this._analyser);
                source.connect(this.outputCtx.destination);
                
                source.start(this.nextStartTime);
                this.nextStartTime += audioBuffer.duration;
                this.sources.add(source);
                source.onended = () => this.sources.delete(source);
            } catch (e) { }
        }
    }

    disconnect(silent: boolean = false) {
        this.isConnected = false;
        this.isConnecting = false;
        this.detachLifecycleHandlers();

        if (this.audioCheckInterval) {
            clearInterval(this.audioCheckInterval);
            this.audioCheckInterval = null;
        }
        
        // Cleanup Hybrid
        browserSpeech.stopListening();
        browserSpeech.cancelSpeak();
        
        // Cleanup Gemini
        if (this.session) { 
            try { if(typeof this.session.close === 'function') this.session.close(); } catch(e){} 
            this.session = null; 
        }

        if (this.activeStream) { 
            this.activeStream.getTracks().forEach(t => t.stop()); 
            this.activeStream = null; 
        }

        if (this.workletNode) {
            try { this.workletNode.disconnect(); } catch(e) {}
            this.workletNode = null;
        }

        if (this.inputCtx && this.inputCtx.state === 'running') { try { this.inputCtx.suspend(); } catch(e){} }
        if (this.outputCtx && this.outputCtx.state === 'running') { try { this.outputCtx.suspend(); } catch(e){} }
        
        this.sources.forEach(s => { try { s.stop(); } catch(e){} });
        this.sources.clear();
        this.nextStartTime = 0;
        this.closeContexts();
        
        if (!silent && this.config) {
            this.config.onStatusChange('IDLE');
        }
    }
}
