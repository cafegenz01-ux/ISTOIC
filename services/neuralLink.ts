
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { encodeAudio, decodeAudio, decodeAudioData, noteTools, visualTools, KEY_MANAGER } from "./geminiService";
import { debugService } from "./debugService";

export type NeuralLinkStatus = 'IDLE' | 'CONNECTING' | 'ACTIVE' | 'ERROR';
export type MicMode = 'STANDARD' | 'ISOLATION' | 'HIGH_FIDELITY';
export type AmbientMode = 'OFF' | 'CYBER' | 'RAIN' | 'CAFE';

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
    onStatusChange: (status: NeuralLinkStatus, error?: string) => void;
    onToolCall: (toolCall: any) => Promise<any>;
    onTranscription?: (event: TranscriptionEvent) => void;
}

// Allowed Gemini Live Voices
const GOOGLE_VALID_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Zephyr'];

/**
 * PROCEDURAL AMBIENT ENGINE
 */
class AmbientMixer {
    private ctx: AudioContext;
    private activeNodes: AudioNode[] = [];
    private gainNode: GainNode;

    constructor(ctx: AudioContext) {
        this.ctx = ctx;
        this.gainNode = ctx.createGain();
        this.gainNode.gain.value = 0.15; // Default low volume
        this.gainNode.connect(ctx.destination);
    }

    setMode(mode: AmbientMode) {
        this.stop();
        if (mode === 'OFF') return;

        const t = this.ctx.currentTime;

        if (mode === 'CYBER') {
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(50, t);
            
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(200, t);
            
            const lfo = this.ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.2; 
            const lfoGain = this.ctx.createGain();
            lfoGain.gain.value = 100;

            lfo.connect(lfoGain);
            lfoGain.connect(filter.frequency);
            
            osc.connect(filter);
            filter.connect(this.gainNode);
            
            osc.start();
            lfo.start();
            this.activeNodes.push(osc, lfo, filter, lfoGain);
        } 
        else if (mode === 'RAIN') {
            const bufferSize = 2 * this.ctx.sampleRate;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const output = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }

            const whiteNoise = this.ctx.createBufferSource();
            whiteNoise.buffer = buffer;
            whiteNoise.loop = true;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 800;

            whiteNoise.connect(filter);
            filter.connect(this.gainNode);
            
            whiteNoise.start();
            this.activeNodes.push(whiteNoise, filter);
        }
    }

    setVolume(val: number) {
        this.gainNode.gain.setTargetAtTime(val, this.ctx.currentTime, 0.1);
    }

    stop() {
        this.activeNodes.forEach(node => {
            try { (node as any).stop && (node as any).stop(); } catch(e){}
            try { node.disconnect(); } catch(e){}
        });
        this.activeNodes = [];
    }
}

export class NeuralLinkService {
    private session: any = null;
    private inputCtx: AudioContext | null = null;
    private outputCtx: AudioContext | null = null;
    private nextStartTime: number = 0;
    private sources: Set<AudioBufferSourceNode> = new Set();
    private activeStream: MediaStream | null = null;
    private scriptProcessor: ScriptProcessorNode | null = null;
    private config: NeuralLinkConfig | null = null;
    private _analyser: AnalyserNode | null = null;
    private isConnecting: boolean = false;
    private isConnected: boolean = false;
    private audioCheckInterval: any = null;
    
    // Modules
    private ambientMixer: AmbientMixer | null = null;
    private currentMicMode: MicMode = 'STANDARD';

    constructor() {}

    get analyser() {
        return this._analyser;
    }

    async connect(config: NeuralLinkConfig) {
        // Prevent overlapping connections
        if (this.isConnecting) {
            console.warn("Neural Link is already connecting.");
            return;
        }
        if (this.isConnected) {
            console.warn("Neural Link already active. Disconnect first.");
            return;
        }
        
        this.isConnecting = true;
        this.config = config;
        
        // Reset state & notify UI
        this.disconnect(true); 
        config.onStatusChange('CONNECTING');

        try {
            await this.initializeSession(config);
        } catch (e: any) {
            console.error("Neural Link Setup Failed:", e);
            config.onStatusChange('ERROR', e.name === 'NotAllowedError' ? "Mic Access Denied" : e.message);
            this.disconnect();
        }
    }

    private async initializeSession(config: NeuralLinkConfig) {
        // 1. Initialize Audio Contexts (Safe for Autoplay Policies)
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        
        if (!this.inputCtx || this.inputCtx.state === 'closed') {
            this.inputCtx = new AudioContextClass({ sampleRate: 16000 });
        }
        
        if (!this.outputCtx || this.outputCtx.state === 'closed') {
            this.outputCtx = new AudioContextClass({ sampleRate: 24000 });
            // Analyser for visualizer
            this._analyser = this.outputCtx.createAnalyser();
            this._analyser.fftSize = 512;
            this._analyser.smoothingTimeConstant = 0.7;
            this.ambientMixer = new AmbientMixer(this.outputCtx);
        }

        // CRITICAL: Resume contexts immediately. Browser requires this after user interaction.
        try {
            if (this.inputCtx.state === 'suspended') await this.inputCtx.resume();
            if (this.outputCtx.state === 'suspended') await this.outputCtx.resume();
        } catch (audioErr) {
            console.warn("AudioContext resume warning:", audioErr);
        }

        // 2. Initialize Mic (User Permission Request)
        if (!this.activeStream) {
            await this.setupMicrophone(this.currentMicMode);
        }

        // 3. Get API Key & Client
        const apiKey = KEY_MANAGER.getKey('GEMINI');
        if (!apiKey) throw new Error("No healthy GEMINI API key available.");

        const ai = new GoogleGenAI({ apiKey });
        
        // 4. Voice Selection Validation
        let selectedVoice = config.voiceName;
        if (!GOOGLE_VALID_VOICES.includes(selectedVoice)) {
            selectedVoice = config.persona === 'hanisah' ? 'Kore' : 'Fenrir';
        }

        // 5. Prepare Tools
        // Note: Gemini Live API can be strict about tool definitions.
        // We structure them carefully. googleSearch is powerful but can be unstable on some tiers.
        const liveTools: any[] = [
            { googleSearch: {} } // Attempt to enable Deep Search
        ];

        // Add function tools only if defined
        const functions = [
            ...(noteTools.functionDeclarations || []),
            ...(visualTools?.functionDeclarations || [])
        ];
        
        if (functions.length > 0) {
            liveTools.push({ functionDeclarations: functions });
        }

        // 6. Connect to Gemini Live
        debugService.log('INFO', 'NEURAL_LINK', 'CONNECTING', `Dialing Gemini Live... Model: ${config.modelId}`);

        const sessionPromise = ai.live.connect({
            model: config.modelId, // e.g., 'gemini-2.5-flash-native-audio-preview-12-2025'
            callbacks: {
                onopen: () => {
                    console.log("[NeuralLink] Socket Opened");
                    this.isConnecting = false;
                    this.isConnected = true;
                    config.onStatusChange('ACTIVE');
                    
                    // Start streaming mic data
                    this.startAudioInputStream(sessionPromise);
                    
                    // Watchdog to keep audio context alive (iOS Safari fix)
                    this.audioCheckInterval = setInterval(() => {
                        if (this.outputCtx?.state === 'suspended') this.outputCtx.resume();
                        if (this.inputCtx?.state === 'suspended') this.inputCtx.resume();
                    }, 2000);

                    // Send Prime Message (Context Initialization)
                    // We wrap this in the promise to ensure session is ready
                    sessionPromise.then(session => {
                        const greeting = config.persona === 'hanisah' 
                            ? "System online. Hai, aku siap. Lakukan deep search atau manajemen catatan jika diminta."
                            : "Logic core active. Ready for complex analysis and data retrieval.";
                        session.sendRealtimeInput({ text: greeting });
                    }).catch(err => console.error("Prime Msg Error:", err));
                },
                onmessage: async (msg: LiveServerMessage) => {
                    await this.handleServerMessage(msg, sessionPromise);
                },
                onerror: (e) => {
                    console.error("Neural Link Socket Error:", e);
                    // Only trigger error state if we were connected or connecting
                    if (this.isConnected || this.isConnecting) {
                         config.onStatusChange('ERROR', "Neural Connection Dropped");
                         this.disconnect();
                    }
                },
                onclose: (e) => {
                    console.log("Neural Link Socket Closed", e);
                    this.disconnect();
                },
            },
            config: {
                responseModalities: [Modality.AUDIO],
                tools: liveTools,
                speechConfig: { 
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } } 
                },
                systemInstruction: config.systemInstruction,
                // Enabling transcription allows us to show text history
                inputAudioTranscription: { model: "google-1.0" }, 
                outputAudioTranscription: { model: "google-1.0" },
            }
        });

        this.session = await sessionPromise;
    }

    async switchVoice(newVoice: string) {
        if (!this.config || !this.isConnected) return;
        
        debugService.log('INFO', 'NEURAL_LINK', 'VOICE_SWAP', `Switching to ${newVoice}...`);
        
        // Close current session to force reconfiguration
        try {
            if (this.session && typeof this.session.close === 'function') {
                this.session.close();
            }
        } catch (e) {}

        this.config.voiceName = newVoice;
        
        // Re-initialize with new config
        try {
            await this.initializeSession(this.config);
        } catch (e) {
            console.error("Voice Switch Failed", e);
            this.disconnect();
        }
    }

    async setMicMode(mode: MicMode) {
        if (!this.isConnected || this.currentMicMode === mode) return;
        this.currentMicMode = mode;
        debugService.log('INFO', 'NEURAL_LINK', 'MIC_UPDATE', `Switching to ${mode} mode`);
        await this.setupMicrophone(mode);
        if (this.session && this.inputCtx) {
             const sessionPromise = Promise.resolve(this.session);
             this.startAudioInputStream(sessionPromise);
        }
    }

    setAmbientMode(mode: AmbientMode) {
        if (this.ambientMixer) {
            this.ambientMixer.setMode(mode);
            debugService.log('INFO', 'NEURAL_LINK', 'AMBIENT', `Environment set to ${mode}`);
        }
    }

    private async setupMicrophone(mode: MicMode) {
        if (this.activeStream) {
            this.activeStream.getTracks().forEach(t => t.stop());
        }

        const constraints: MediaTrackConstraints = {
            sampleRate: 16000,
            channelCount: 1,
        };

        if (mode === 'ISOLATION') {
            constraints.echoCancellation = true;
            constraints.noiseSuppression = { ideal: true };
            constraints.autoGainControl = { ideal: true };
        } else if (mode === 'HIGH_FIDELITY') {
            constraints.echoCancellation = false;
            constraints.noiseSuppression = false;
            constraints.autoGainControl = false;
        } else {
            constraints.echoCancellation = true;
            constraints.noiseSuppression = true;
            constraints.autoGainControl = true;
        }

        this.activeStream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
    }

    private startAudioInputStream(sessionPromise: Promise<any>) {
        if (!this.inputCtx || !this.activeStream) return;
        
        try {
            if (this.scriptProcessor) {
                this.scriptProcessor.disconnect();
                this.scriptProcessor = null;
            }

            const source = this.inputCtx.createMediaStreamSource(this.activeStream);
            this.scriptProcessor = this.inputCtx.createScriptProcessor(4096, 1, 1);
            
            this.scriptProcessor.onaudioprocess = (e) => {
                if (!this.isConnected) return; // Stop processing if disconnected

                const inputData = e.inputBuffer.getChannelData(0);
                
                // VAD Gate (Prevent silence spam which wastes tokens)
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
            
            source.connect(this.scriptProcessor);
            this.scriptProcessor.connect(this.inputCtx.destination);
        } catch (err) {
            console.error("Input Stream Error:", err);
        }
    }

    private async handleServerMessage(msg: LiveServerMessage, sessionPromise: Promise<any>) {
        // 1. Transcription Handling
        if (this.config?.onTranscription) {
            if (msg.serverContent?.inputTranscription) {
                this.config.onTranscription({ 
                    text: msg.serverContent.inputTranscription.text, 
                    source: 'user', 
                    isFinal: !!msg.serverContent.turnComplete 
                });
            }
            if (msg.serverContent?.outputTranscription) {
                this.config.onTranscription({ 
                    text: msg.serverContent.outputTranscription.text, 
                    source: 'model', 
                    isFinal: !!msg.serverContent.turnComplete 
                });
            }
        }

        // 2. Tool Execution
        if (msg.toolCall) {
            for (const fc of msg.toolCall.functionCalls) {
                if (this.config?.onToolCall) {
                    try {
                        const result = await this.config.onToolCall(fc);
                        // CRITICAL: Send Response back to Model to Unfreeze it
                        // The Model waits for this response before continuing audio generation
                        sessionPromise.then(s => s.sendToolResponse({ 
                            functionResponses: [{ id: fc.id, name: fc.name, response: { result: String(result) } }] 
                        })).catch(e => console.error("Tool Response Error", e));
                    } catch (err) {
                        console.error("Tool Execution Failed:", err);
                        sessionPromise.then(s => s.sendToolResponse({
                            functionResponses: [{ id: fc.id, name: fc.name, response: { result: "Error executing tool" } }]
                        }));
                    }
                }
            }
        }

        // 3. Audio Playback
        const base64Audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (base64Audio && this.outputCtx) {
            try {
                // Ensure context is running for playback (iOS Safari fix)
                if (this.outputCtx.state === 'suspended') await this.outputCtx.resume();

                const currentTime = this.outputCtx.currentTime;
                if (this.nextStartTime < currentTime) {
                    this.nextStartTime = currentTime + 0.05; // Tight buffer
                }

                const audioBuffer = await decodeAudioData(decodeAudio(base64Audio), this.outputCtx, 24000, 1);
                const source = this.outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                
                if (this._analyser) { 
                    source.connect(this._analyser); 
                    this._analyser.connect(this.outputCtx.destination); 
                } else {
                    source.connect(this.outputCtx.destination);
                }
                
                source.start(this.nextStartTime);
                this.nextStartTime += audioBuffer.duration;
                this.sources.add(source);
                
                source.onended = () => this.sources.delete(source);
            } catch (e) { 
                console.error("Audio Decode/Play Error", e);
            }
        }

        // Handle Interruption
        if (msg.serverContent?.interrupted) {
            this.sources.forEach(s => { try { s.stop(); } catch(e){} });
            this.sources.clear();
            if (this.outputCtx) this.nextStartTime = this.outputCtx.currentTime;
        }
    }

    disconnect(silent: boolean = false) {
        this.isConnected = false;
        this.isConnecting = false;

        if (this.audioCheckInterval) {
            clearInterval(this.audioCheckInterval);
            this.audioCheckInterval = null;
        }
        
        if (this.session) { 
            try { if(typeof this.session.close === 'function') this.session.close(); } catch(e){} 
            this.session = null; 
        }

        if (this.activeStream) { 
            this.activeStream.getTracks().forEach(t => t.stop()); 
            this.activeStream = null; 
        }

        if (this.scriptProcessor) {
            this.scriptProcessor.disconnect();
            this.scriptProcessor = null;
        }

        if (this.ambientMixer) {
            this.ambientMixer.stop();
        }

        // We do NOT close contexts entirely, we suspend them to reuse hardware connection
        // Closing them often requires re-requesting permissions or heavy re-init on mobile
        if (this.inputCtx && this.inputCtx.state === 'running') { try { this.inputCtx.suspend(); } catch(e){} }
        if (this.outputCtx && this.outputCtx.state === 'running') { try { this.outputCtx.suspend(); } catch(e){} }

        this.sources.forEach(s => { try { s.stop(); } catch(e){} });
        this.sources.clear();
        this.nextStartTime = 0;
        
        if (!silent && this.config) {
            this.config.onStatusChange('IDLE');
        }
    }
}
