
import { debugService } from "./debugService";

// Types for Web Speech API
interface IWindow extends Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
}

export class BrowserSpeechService {
    private recognition: any = null;
    private synthesis: SpeechSynthesis = window.speechSynthesis;
    private isListening: boolean = false;
    private onResultCallback: ((text: string, isFinal: boolean) => void) | null = null;
    private onEndCallback: (() => void) | null = null;
    
    constructor() {
        const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
        const SpeechRecognitionClass = SpeechRecognition || webkitSpeechRecognition;
        
        if (SpeechRecognitionClass) {
            this.recognition = new SpeechRecognitionClass();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'id-ID'; // Default to Indo, dynamic later
            
            this.recognition.onresult = (event: any) => {
                let finalTranscript = '';
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                if (this.onResultCallback) {
                    if (finalTranscript) this.onResultCallback(finalTranscript, true);
                    else if (interimTranscript) this.onResultCallback(interimTranscript, false);
                }
            };

            this.recognition.onend = () => {
                if (this.isListening) {
                    try { this.recognition.start(); } catch(e) {} // Auto restart
                } else if (this.onEndCallback) {
                    this.onEndCallback();
                }
            };

            this.recognition.onerror = (event: any) => {
                console.warn("Speech Recog Error", event.error);
                if (event.error === 'not-allowed') {
                    this.isListening = false;
                    debugService.log('ERROR', 'HYBRID_VOICE', 'PERM_DENIED', 'Mic permission denied');
                }
            };
        }
    }

    startListening(onResult: (text: string, isFinal: boolean) => void) {
        if (!this.recognition) return;
        this.onResultCallback = onResult;
        this.isListening = true;
        try {
            this.recognition.start();
        } catch(e) {
            // Already started
        }
    }

    stopListening() {
        this.isListening = false;
        if (this.recognition) {
            try { this.recognition.stop(); } catch(e) {}
        }
    }

    speak(text: string, voiceName?: string, onEnd?: () => void) {
        if (this.synthesis.speaking) {
            this.synthesis.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        
        // Voice Selection Logic
        const voices = this.synthesis.getVoices();
        // Prefer Google Indonsia or requested voice
        const preferredVoice = voices.find(v => v.name.includes(voiceName || 'Google Bahasa Indonesia')) || voices.find(v => v.lang.includes('id'));
        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.onend = () => {
            if (onEnd) onEnd();
        };

        this.synthesis.speak(utterance);
    }

    cancelSpeak() {
        this.synthesis.cancel();
    }

    setLang(lang: string) {
        if (this.recognition) this.recognition.lang = lang;
    }
}

export const browserSpeech = new BrowserSpeechService();
