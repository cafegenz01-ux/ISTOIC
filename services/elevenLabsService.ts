
import { debugService } from './debugService';
import { AudioCache } from './db';

// --- VOICE MAPPING SYSTEM ---
export const VOICE_MAPPING: Record<string, string> = {
    'Hanisah': 'JBFqnCBsd6RMkjVDRZzb', 
    'Zephyr': '21m00Tcm4TlvDq8ikWAM',
    'Kore': 'EXAVITQu4vr4xnSDxMaL',  
    'Fenrir': 'TxGEqnHWrfWFTfGW9XjX',
    'Puck': 'IKne3meq5aSn9XLyUdCD',   
    'default': 'JBFqnCBsd6RMkjVDRZzb'
};

async function generateHash(text: string, voiceId: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(`${voiceId}:${text}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Production-ready TTS Service (Secure Proxy Version)
 */
export async function speakWithHanisah(text: string, voiceNameOverride?: string): Promise<void> {
    try {
        let selectedName = voiceNameOverride;
        if (!selectedName) {
            const storedVoice = localStorage.getItem('hanisah_voice');
            selectedName = storedVoice ? JSON.parse(storedVoice) : 'Hanisah';
        }

        const voiceId = VOICE_MAPPING[selectedName || 'Hanisah'] || VOICE_MAPPING['Hanisah'];
        const cacheKey = await generateHash(text, voiceId);

        // 1. CHECK CACHE
        const cachedBlob = await AudioCache.get(cacheKey);
        if (cachedBlob) {
            debugService.log('INFO', 'HANISAH_VOICE', 'CACHE_HIT', 'Playing from IndexedDB');
            const url = URL.createObjectURL(cachedBlob);
            const audio = new Audio(url);
            await audio.play();
            return;
        }
        
        debugService.log('INFO', 'HANISAH_VOICE', 'INIT', `Synthesizing via Secure Proxy: ${selectedName}`);

        // 2. FETCH FROM SECURE PROXY (No API Key on Client)
        const response = await fetch(`/api/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voiceId })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(`TTS Error: ${err.error || response.statusText}`);
        }

        const audioBlob = await response.blob();
        
        // 3. SAVE TO CACHE
        await AudioCache.set(cacheKey, audioBlob);

        const url = URL.createObjectURL(audioBlob);
        const audio = new Audio(url);
        
        debugService.log('INFO', 'HANISAH_VOICE', 'PLAY', 'Audio stream synchronized.');
        await audio.play();

    } catch (error: any) {
        debugService.log('ERROR', 'HANISAH_VOICE', 'FAIL', error.message);
        console.error("ElevenLabs Proxy Fail:", error);
    }
}
