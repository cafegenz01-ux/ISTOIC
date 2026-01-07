
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
 * Generates background soundscapes using Web Audio API nodes (Oscillators/Noise)
 * No external files required. Zero latency.
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
            // Low droning oscillator for Cyberpunk vibe
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(50, t);
            
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(200, t);
            
            const lfo = this.ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.2; // Slow modulation
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
            // White noise generation for Rain
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
        if (this.isConnecting || this.isConnected) {
            console.warn("Neural Link already active or connecting.");
            return;
        }
        
        this.isConnecting = true;
        this.config = config;
        
        // Reset state
        this.disconnect(true); 
        config.onStatusChange('CONNECTING');

        try {
            // 1. Initialize Audio Contexts
            const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
            
            // Input: 16kHz for Gemini (Lower sample rate = less bandwidth/processing)
            this.inputCtx = new AudioContextClass({ sampleRate: 16000 });
            
            // Output: 24kHz for High Quality Response
            this.outputCtx = new AudioContextClass({ sampleRate: 24000 });
            
            // Analyser for visualizer
            this._analyser = this.outputCtx.createAnalyser();
            this._analyser.fftSize = 512; // Higher res for smoother visuals
            this._analyser.smoothingTimeConstant = 0.7;

            // Ambient Mixer
            this.ambientMixer = new AmbientMixer(this.outputCtx);

            // CRITICAL: Resume contexts immediately
            if (this.inputCtx.state === 'suspended') await this.inputCtx.resume();
            if (this.outputCtx.state === 'suspended') await this.outputCtx.resume();

            // 2. Initialize Mic with Standard Mode
            await this.setupMicrophone('STANDARD');

            // 3. Get API Key
            const apiKey = KEY_MANAGER.getKey('GEMINI');
            if (!apiKey) throw new Error("No healthy GEMINI API key available.");

            const ai = new GoogleGenAI({ apiKey });
            
            // 4. Voice Selection (Validating)
            if (!GOOGLE_VALID_VOICES.includes(config.voiceName)) {
                config.voiceName = config.persona === 'hanisah' ? 'Kore' : 'Fenrir';
            }

            // 5. Prepare Tools
            const liveTools = [
                { 
                    functionDeclarations: [
                        ...(noteTools.functionDeclarations || []),
                        ...(visualTools?.functionDeclarations || [])
                    ] 
                }
            ];

            // 6. Connect to Gemini Live
            const sessionPromise = ai.live.connect({
                model: config.modelId || 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        this.isConnecting = false;
                        this.isConnected = true;
                        config.onStatusChange('ACTIVE');
                        
                        // Start streaming data
                        this.startAudioInputStream(sessionPromise);
                        
                        // Keep-alive Logic
                        this.audioCheckInterval = setInterval(() => {
                            if (this.outputCtx?.state === 'suspended') this.outputCtx.resume();
                            if (this.inputCtx?.state === 'suspended') this.inputCtx.resume();
                        }, 2000);

                        // Initial Handshake (Wait for ready)
                        sessionPromise.then(session => {
                            // Only send greeting if this is a fresh start, strictly text to prime context
                            try {
                                const greeting = config.persona === 'hanisah' 
                                ? "System online. Hai, aku siap."
                                : "Logic core active. Ready.";
                                session.sendRealtimeInput({ text: greeting });
                            } catch(err) {
                                console.error("Handshake failed:", err);
                            }
                        });
                    },
                    onmessage: async (msg: LiveServerMessage) => {
                        await this.handleServerMessage(msg, sessionPromise);
                    },
                    onerror: (e) => {
                        console.error("Neural Link Error:", e);
                        if (this.isConnected || this.isConnecting) {
                            config.onStatusChange('ERROR', "Neural Connection Unstable");
                            this.disconnect();
                        }
                    },
                    onclose: () => {
                        console.log("Neural Link Closed");
                        this.disconnect();
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    tools: liveTools,
                    speechConfig: { 
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voiceName } } 
                    },
                    systemInstruction: config.systemInstruction,
                    inputAudioTranscription: {}, 
                    outputAudioTranscription: {},
                }
            });

            this.session = await sessionPromise;

        } catch (e: any) {
            console.error("Setup Failed:", e);
            config.onStatusChange('ERROR', e.name === 'NotAllowedError' ? "Mic Access Denied" : e.message);
            this.disconnect();
        }
    }

    async setMicMode(mode: MicMode) {
        if (!this.isConnected || this.currentMicMode === mode) return;
        this.currentMicMode = mode;
        debugService.log('INFO', 'NEURAL_LINK', 'MIC_UPDATE', `Switching to ${mode} mode`);
        await this.setupMicrophone(mode);
        // Restart stream processor with new stream
        // Note: scriptProcessor usually stays connected, we just change the source
        if (this.session && this.inputCtx) {
             // Re-route audio graph
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
            // Sometimes disabling processed audio is better for music/singing
            constraints.echoCancellation = false;
            constraints.noiseSuppression = false;
            constraints.autoGainControl = false;
        } else {
            // Standard: Always default to echo cancellation ON
            constraints.echoCancellation = true;
            constraints.noiseSuppression = true;
            constraints.autoGainControl = true;
        }

        this.activeStream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
    }

    private startAudioInputStream(sessionPromise: Promise<any>) {
        if (!this.inputCtx || !this.activeStream) return;
        
        try {
            // Clean up old processor/source if existing to prevent double streams
            if (this.scriptProcessor) {
                this.scriptProcessor.disconnect();
                this.scriptProcessor = null;
            }

            const source = this.inputCtx.createMediaStreamSource(this.activeStream);
            // Increased buffer size to 4096 to reduce main thread load and audio glitches
            this.scriptProcessor = this.inputCtx.createScriptProcessor(4096, 1, 1);
            
            this.scriptProcessor.onaudioprocess = (e) => {
                // Guideline compliance: Removed redundant connection checks inside audio processing callback to avoid stale closures
                const inputData = e.inputBuffer.getChannelData(0);
                
                // VAD (Simple Volume Gate) - Skip silence to save bandwidth
                let sum = 0;
                for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
                const rms = Math.sqrt(sum / inputData.length);
                
                // Tuned threshold: catch whispers/breaths (0.001) for prosody awareness
                // But don't send absolute noise floor
                if (rms < 0.001) return; 

                // Convert Float32 to Int16 PCM
                const int16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    int16[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
                }
                
                const pcmBlob = { 
                    data: encodeAudio(new Uint8Array(int16.buffer)), 
                    mimeType: 'audio/pcm;rate=16000' 
                };
                
                // Guideline compliance: Rely exclusively on sessionPromise for data streaming
                sessionPromise.then(s => { 
                    try { 
                        s.sendRealtimeInput({ media: pcmBlob }); 
                    } catch (err) {} 
                });
            };
            
            source.connect(this.scriptProcessor);
            this.scriptProcessor.connect(this.inputCtx.destination);
        } catch (err) {
            console.error("Input Stream Error:", err);
        }
    }

    private async handleServerMessage(msg: LiveServerMessage, sessionPromise: Promise<any>) {
        if (!this.isConnected) return;

        // 1. Transcriptions
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

        // 2. Tool Calls
        if (msg.toolCall) {
            for (const fc of msg.toolCall.functionCalls) {
                if (this.config?.onToolCall) {
                    try {
                        const result = await this.config.onToolCall(fc);
                        // Guideline compliance: Execute tool response through the active session from the promise
                        sessionPromise.then(s => s.sendToolResponse({ 
                            functionResponses: [{ id: fc.id, name: fc.name, response: { result: String(result) } }] 
                        }));
                    } catch (err) {
                        sessionPromise.then(s => s.sendToolResponse({
                            functionResponses: [{ id: fc.id, name: fc.name, response: { result: "Error executing tool" } }]
                        }));
                    }
                }
            }
        }

        // 3. Audio Output (Enhanced Queuing)
        const base64Audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (base64Audio && this.outputCtx) {
            try {
                // Gapless Playback Logic
                const currentTime = this.outputCtx.currentTime;
                // If the stream lagged behind, jump forward. 
                // If it's ahead (buffering), preserve it.
                if (this.nextStartTime < currentTime) {
                    this.nextStartTime = currentTime + 0.05; // 50ms min buffer to prevent glitch
                }

                const audioBuffer = await decodeAudioData(decodeAudio(base64Audio), this.outputCtx, 24000, 1);
                const source = this.outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                
                // Connect to Analyser AND Destination (Ambient mixer is already connected to dest)
                if (this._analyser) { 
                    source.connect(this._analyser); 
                    this._analyser.connect(this.outputCtx.destination); 
                } else {
                    source.connect(this.outputCtx.destination);
                }
                
                source.start(this.nextStartTime);
                this.nextStartTime += audioBuffer.duration;
                this.sources.add(source);
                
                source.onended = () => {
                    this.sources.delete(source);
                };
            } catch (e) {
                console.warn("Audio processing glitch (non-fatal):", e);
            }
        }

        // 4. Interruption (Instant Cut)
        if (msg.serverContent?.interrupted) {
            // Immediate Stop
            this.sources.forEach(s => { 
                try { s.stop(); } catch(e){} 
            });
            this.sources.clear();
            
            // Reset Time Anchor to Now (Prevent skipping or catching up)
            if (this.outputCtx) {
                this.nextStartTime = this.outputCtx.currentTime;
            }
            debugService.log('INFO', 'NEURAL_LINK', 'INTERRUPT', 'Turn-taking enforced. Audio queue cleared.');
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

        if (this.inputCtx) { try { this.inputCtx.close(); } catch(e){} this.inputCtx = null; }
        if (this.outputCtx) { try { this.outputCtx.close(); } catch(e){} this.outputCtx = null; }

        this.sources.forEach(s => { try { s.stop(); } catch(e){} });
        this.sources.clear();
        this.nextStartTime = 0;
        
        if (!silent && this.config) {
            this.config.onStatusChange('IDLE');
        }
    }
}
