
import { debugService } from "./debugService";

// Singleton instance
let globalAudioContext: AudioContext | null = null;

export const getGlobalAudioContext = (): AudioContext => {
    if (!globalAudioContext) {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        globalAudioContext = new AudioContextClass();
        debugService.log('INFO', 'AUDIO_SYS', 'INIT', 'Global AudioContext initialized.');
    }
    return globalAudioContext;
};

export const suspendGlobalAudio = async () => {
    if (globalAudioContext && globalAudioContext.state === 'running') {
        await globalAudioContext.suspend();
    }
};

export const resumeGlobalAudio = async () => {
    if (globalAudioContext && globalAudioContext.state === 'suspended') {
        await globalAudioContext.resume();
        debugService.log('INFO', 'AUDIO_SYS', 'RESUME', 'AudioContext resumed.');
    }
    return globalAudioContext;
};
