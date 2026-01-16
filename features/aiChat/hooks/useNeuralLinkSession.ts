import { useState, useRef, useCallback } from 'react';
import { NeuralLinkService, type NeuralLinkStatus } from '../../../services/neuralLink';
import { HANISAH_BRAIN } from '../../../services/melsaBrain';
import { executeNeuralTool } from '../services/toolHandler';
import { type Note } from '../../../types';

export const useNeuralLinkSession = (personaMode: 'hanisah' | 'stoic', notes: Note[], setNotes: (notes: Note[]) => void) => {
    const [isLiveMode, setIsLiveMode] = useState(false);
    const [liveStatus, setLiveStatus] = useState<NeuralLinkStatus>('IDLE');
    
    // UPDATED: Split transcript state for stable rendering
    const [transcriptHistory, setTranscriptHistory] = useState<Array<{role: 'user' | 'model', text: string}>>([]);
    const [interimTranscript, setInterimTranscript] = useState<{role: 'user' | 'model', text: string} | null>(null);
    
    const neuralLink = useRef<NeuralLinkService>(new NeuralLinkService());

    const toggleLiveMode = useCallback(async () => {
        if (isLiveMode) {
            neuralLink.current.disconnect();
            setIsLiveMode(false);
            setLiveStatus('IDLE');
        } else {
            // Reset States
            setTranscriptHistory([]);
            setInterimTranscript(null);
            
            // Fix: Await getSystemInstruction and pass correct Note[] arg
            const systemInstruction = await HANISAH_BRAIN.getSystemInstruction(personaMode, '', notes);
            
            setIsLiveMode(true);
            try {
                const storedVoice = localStorage.getItem(`${personaMode}_voice`);
                const voice = storedVoice ? JSON.parse(storedVoice) : (personaMode === 'hanisah' ? 'Zephyr' : 'Fenrir');

                await neuralLink.current.connect({
                    modelId: 'gemini-2.5-flash-native-audio-preview-09-2025',
                    persona: personaMode,
                    systemInstruction,
                    voiceName: voice,
                    engine: 'GEMINI_REALTIME',
                    onStatusChange: (status, error) => {
                        setLiveStatus(status);
                        if (status === 'ERROR') setIsLiveMode(false);
                    },
                    onTranscription: (event) => {
                        // LOGIC FIX: Handle partial vs final chunks
                        if (event.isFinal) {
                            setTranscriptHistory(prev => [...prev, { role: event.source, text: event.text }]);
                            setInterimTranscript(null); // Clear interim
                        } else {
                            setInterimTranscript({ role: event.source, text: event.text });
                        }
                    },
                    onToolCall: async (call) => await executeNeuralTool(call, notes, setNotes)
                });
            } catch (e) {
                setIsLiveMode(false);
                setLiveStatus('ERROR');
            }
        }
    }, [isLiveMode, personaMode, notes, setNotes]);

    return {
        isLiveMode,
        liveStatus,
        transcriptHistory,
        interimTranscript,
        toggleLiveMode,
        analyser: neuralLink.current.analyser
    };
};