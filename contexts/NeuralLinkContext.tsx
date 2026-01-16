import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { NeuralLinkService, type NeuralLinkStatus, type TranscriptionEvent } from '../services/neuralLink';
import { HANISAH_BRAIN } from '../services/melsaBrain';
import { executeNeuralTool } from '../features/aiChat/services/toolHandler';
import { type Note } from '../types';

interface NeuralLinkContextType {
    isLiveMode: boolean;
    liveStatus: NeuralLinkStatus;
    transcriptHistory: Array<{role: 'user' | 'model', text: string}>;
    interimTranscript: {role: 'user' | 'model', text: string} | null;
    activeTask: string | null;
    isMinimized: boolean;
    analyser: AnalyserNode | null;
    toggleLiveMode: (personaMode: 'hanisah' | 'stoic', notes: Note[], setNotes: (notes: Note[]) => void) => Promise<void>;
    setMinimized: (min: boolean) => void;
    setActiveTask: (task: string | null) => void;
    terminateSession: () => void;
}

const NeuralLinkContext = createContext<NeuralLinkContextType | undefined>(undefined);

export const NeuralLinkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isLiveMode, setIsLiveMode] = useState(false);
    const [liveStatus, setLiveStatus] = useState<NeuralLinkStatus>('IDLE');
    const [isMinimized, setIsMinimized] = useState(false);
    const [activeTask, setActiveTask] = useState<string | null>(null);
    const [transcriptHistory, setTranscriptHistory] = useState<Array<{role: 'user' | 'model', text: string}>>([]);
    const [interimTranscript, setInterimTranscript] = useState<{role: 'user' | 'model', text: string} | null>(null);
    
    const neuralLink = useRef<NeuralLinkService>(new NeuralLinkService());

    const terminateSession = useCallback(() => {
        neuralLink.current.disconnect();
        setIsLiveMode(false);
        setIsMinimized(false);
        setLiveStatus('IDLE');
        setActiveTask(null);
        setTranscriptHistory([]);
        setInterimTranscript(null);
    }, []);

    const toggleLiveMode = useCallback(async (personaMode: 'hanisah' | 'stoic', notes: Note[], setNotes: (notes: Note[]) => void) => {
        if (isLiveMode) {
            terminateSession();
        } else {
            setTranscriptHistory([]);
            setInterimTranscript(null);
            setIsMinimized(false);
            
            const noteContext = notes.map(n => `- ${n.title}`).join('\n');
            // Fix: Await async getSystemInstruction and pass Note[] correctly
            const systemInstruction = await HANISAH_BRAIN.getSystemInstruction(personaMode, noteContext, notes);
            
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
                    onStatusChange: (status) => {
                        setLiveStatus(status);
                        if (status === 'ERROR') setIsLiveMode(false);
                    },
                    onTranscription: (event) => {
                        if (event.isFinal) {
                            setTranscriptHistory(prev => [...prev, { role: event.source, text: event.text }]);
                            setInterimTranscript(null);
                        } else {
                            setInterimTranscript({ role: event.source, text: event.text });
                        }
                    },
                    onToolCall: async (call) => {
                        const taskName = call.name.replace(/_/g, ' ').toUpperCase();
                        setActiveTask(`EXECUTING: ${taskName}...`);
                        try {
                            const result = await executeNeuralTool(call, notes, setNotes);
                            setActiveTask(`COMPLETED: ${taskName}`);
                            setTimeout(() => setActiveTask(null), 3000);
                            return result;
                        } catch (e) {
                            setActiveTask(`FAILED: ${taskName}`);
                            setTimeout(() => setActiveTask(null), 3000);
                            throw e;
                        }
                    }
                });
            } catch (e) {
                setIsLiveMode(false);
                setLiveStatus('ERROR');
            }
        }
    }, [isLiveMode, terminateSession]);

    return (
        <NeuralLinkContext.Provider value={{
            isLiveMode,
            liveStatus,
            transcriptHistory,
            interimTranscript,
            activeTask,
            isMinimized,
            analyser: neuralLink.current.analyser,
            toggleLiveMode,
            setMinimized: setIsMinimized,
            setActiveTask,
            terminateSession
        }}>
            {children}
        </NeuralLinkContext.Provider>
    );
};

export const useNeuralLink = () => {
    const context = useContext(NeuralLinkContext);
    if (!context) throw new Error('useNeuralLink must be used within a NeuralLinkProvider');
    return context;
};