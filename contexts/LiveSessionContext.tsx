
import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { NeuralLinkService } from '../services/neuralLink';
import type { NeuralLinkStatus, MicMode, AmbientMode, EngineType } from '../services/neuralLink';
import { executeNeuralTool } from '../features/aiChat/services/toolHandler';
import type { Note } from '../types';
import { debugService } from '../services/debugService';
import { HANISAH_BRAIN } from '../services/melsaBrain';

interface LiveSessionContextType {
    isLive: boolean;
    isMinimized: boolean;
    status: NeuralLinkStatus;
    transcript: Array<{ role: 'user' | 'model', text: string }>;
    interimTranscript: { role: 'user' | 'model', text: string } | null;
    activeTool: string | null;
    analyser: AnalyserNode | null;
    micMode: MicMode;
    ambientMode: AmbientMode;
    currentVoice: string;
    engine: EngineType; // ADDED
    startSession: (persona: 'hanisah' | 'stoic') => void;
    stopSession: () => void;
    toggleMinimize: () => void;
    setMicMode: (mode: MicMode) => void;
    setAmbientMode: (mode: AmbientMode) => void;
    setEngine: (engine: EngineType) => void; // ADDED
    changeVoice: (voice: string) => void;
}

const LiveSessionContext = createContext<LiveSessionContextType | undefined>(undefined);

interface LiveSessionProviderProps {
    children: React.ReactNode;
    notes: Note[];
    setNotes: (notes: Note[]) => void;
}

export const LiveSessionProvider: React.FC<LiveSessionProviderProps> = ({ children, notes, setNotes }) => {
    const notesRef = useRef(notes);
    
    useEffect(() => {
        notesRef.current = notes;
    }, [notes]);

    // Session State
    const [isLive, setIsLive] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [status, setStatus] = useState<NeuralLinkStatus>('IDLE');
    
    // Transcript with Throttling Refs
    const [transcript, setTranscript] = useState<Array<{ role: 'user' | 'model', text: string }>>([]);
    const [interimTranscript, setInterimTranscript] = useState<{ role: 'user' | 'model', text: string } | null>(null);
    const transcriptUpdateBuffer = useRef<{ role: 'user' | 'model', text: string, isFinal: boolean } | null>(null);

    const [activeTool, setActiveTool] = useState<string | null>(null);
    const [currentVoice, setCurrentVoice] = useState('Puck');
    const [micMode, setMicModeState] = useState<MicMode>('STANDARD');
    const [ambientMode, setAmbientModeState] = useState<AmbientMode>('OFF');
    
    // Default to HYDRA_HYBRID for maximum free stability, user can switch to GEMINI_REALTIME
    const [engine, setEngine] = useState<EngineType>('HYDRA_HYBRID');

    const neuralLink = useRef<NeuralLinkService>(new NeuralLinkService());

    useEffect(() => {
        return () => {
            neuralLink.current.disconnect(true);
        };
    }, []);

    // THROTTLED TRANSCRIPT UPDATER
    useEffect(() => {
        const interval = setInterval(() => {
            if (transcriptUpdateBuffer.current) {
                const update = transcriptUpdateBuffer.current;
                
                if (update.isFinal) {
                    setTranscript(prev => [...prev, { role: update.role, text: update.text }]);
                    setInterimTranscript(null);
                } else {
                    setInterimTranscript({ role: update.role, text: update.text });
                }
                
                transcriptUpdateBuffer.current = null;
            }
        }, 60);

        return () => clearInterval(interval);
    }, []);

    const startSession = useCallback(async (persona: 'hanisah' | 'stoic') => {
        if (isLive) return;

        setTranscript([]);
        setInterimTranscript(null);
        transcriptUpdateBuffer.current = null;
        
        setIsMinimized(false);
        setIsLive(true);
        setStatus('CONNECTING');

        try {
            const liveInstruction = await HANISAH_BRAIN.getSystemInstruction(persona, '', notesRef.current);
            const storedVoice = localStorage.getItem(`${persona}_voice`);
            const voice = storedVoice ? JSON.parse(storedVoice) : (persona === 'hanisah' ? 'Zephyr' : 'Fenrir');
            setCurrentVoice(voice);

            await neuralLink.current.connect({
                modelId: 'gemini-2.5-flash-native-audio-preview-12-2025',
                persona,
                systemInstruction: liveInstruction,
                voiceName: voice,
                engine: engine, // Pass active engine
                onStatusChange: (newStatus, err) => {
                    setStatus(newStatus);
                    if (newStatus === 'ERROR') {
                        // Don't auto-close immediately on error, allow user to see it or retry
                        debugService.log('ERROR', 'LIVE_CTX', 'CONNECT_FAIL', err || 'Unknown');
                    } else if (newStatus === 'ACTIVE') {
                        neuralLink.current.setMicMode(micMode);
                    }
                },
                onTranscription: (event) => {
                    // Push to buffer
                    transcriptUpdateBuffer.current = {
                        role: event.source,
                        text: event.text,
                        isFinal: event.isFinal
                    };
                },
                onToolCall: async (call) => {
                    const toolName = call.name;
                    setActiveTool(toolName);
                    debugService.log('INFO', 'LIVE_CTX', 'TOOL_EXEC', toolName);
                    try {
                        const currentNotes = notesRef.current;
                        const result = await executeNeuralTool(call, currentNotes, (newNotes) => {
                            setNotes(newNotes);
                        });
                        return result;
                    } catch (e: any) {
                        console.error("Tool execution failed", e);
                        return `Error executing ${toolName}: ${e.message}`;
                    } finally {
                        setActiveTool(null);
                    }
                }
            });
        } catch (e) {
            console.error(e);
            setIsLive(false);
            setStatus('ERROR');
        }
    }, [isLive, micMode, ambientMode, setNotes, engine]); 

    const stopSession = useCallback(() => {
        neuralLink.current.disconnect();
        setIsLive(false);
        setIsMinimized(false);
        setStatus('IDLE');
        setActiveTool(null);
    }, []);

    const toggleMinimize = useCallback(() => {
        setIsMinimized(prev => !prev);
    }, []);

    const setMicMode = useCallback((mode: MicMode) => {
        setMicModeState(mode);
        if (isLive) neuralLink.current.setMicMode(mode);
    }, [isLive]);

    const setAmbientMode = useCallback((mode: AmbientMode) => {
        setAmbientModeState(mode);
        // Implement ambient mode in neuralLink if needed later
    }, [isLive]);

    const changeVoice = useCallback((voice: string) => {
        setCurrentVoice(voice);
        if (isLive) neuralLink.current.switchVoice(voice);
    }, [isLive]);

    const contextValue = useMemo(() => ({
        isLive,
        isMinimized,
        status,
        transcript,
        interimTranscript,
        activeTool,
        analyser: neuralLink.current.analyser,
        micMode,
        ambientMode,
        currentVoice,
        engine,
        startSession,
        stopSession,
        toggleMinimize,
        setMicMode,
        setAmbientMode,
        setEngine,
        changeVoice
    }), [
        isLive, isMinimized, status, transcript, interimTranscript, activeTool, micMode, ambientMode, currentVoice, engine,
        startSession, stopSession, toggleMinimize, setMicMode, setAmbientMode, setEngine, changeVoice
    ]);

    return (
        <LiveSessionContext.Provider value={contextValue}>
            {children}
        </LiveSessionContext.Provider>
    );
};

export const useLiveSession = () => {
    const context = useContext(LiveSessionContext);
    if (!context) {
        throw new Error('useLiveSession must be used within a LiveSessionProvider');
    }
    return context;
};
