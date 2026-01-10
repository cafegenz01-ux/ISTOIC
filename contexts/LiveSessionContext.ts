
import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { NeuralLinkService } from '../services/neuralLink';
import type { NeuralLinkStatus, TranscriptionEvent, MicMode, AmbientMode } from '../services/neuralLink';
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
    startSession: (persona: 'hanisah' | 'stoic') => void;
    stopSession: () => void;
    toggleMinimize: () => void;
    setMicMode: (mode: MicMode) => void;
    setAmbientMode: (mode: AmbientMode) => void;
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
    const [transcript, setTranscript] = useState<Array<{ role: 'user' | 'model', text: string }>>([]);
    const [interimTranscript, setInterimTranscript] = useState<{ role: 'user' | 'model', text: string } | null>(null);
    const [activeTool, setActiveTool] = useState<string | null>(null);
    
    // Audio Settings
    const [micMode, setMicModeState] = useState<MicMode>('STANDARD');
    const [ambientMode, setAmbientModeState] = useState<AmbientMode>('OFF');
    const [currentVoice, setCurrentVoice] = useState('Puck');

    const neuralLink = useRef<NeuralLinkService>(new NeuralLinkService());
    const watchdogRef = useRef<any>(null);

    useEffect(() => {
        return () => {
            neuralLink.current.disconnect(true);
            if(watchdogRef.current) clearTimeout(watchdogRef.current);
        };
    }, []);

    const startSession = useCallback(async (persona: 'hanisah' | 'stoic') => {
        if (isLive) return;

        // UI Reset
        setTranscript([]);
        setInterimTranscript(null);
        setIsMinimized(false);
        setIsLive(true);
        setStatus('CONNECTING'); // Force UI to connecting state immediately

        // Watchdog: If still connecting after 15s, reset.
        if (watchdogRef.current) clearTimeout(watchdogRef.current);
        watchdogRef.current = setTimeout(() => {
            if (status === 'CONNECTING') {
                console.warn("[NeuralLink] Connection timed out.");
                stopSession();
                setStatus('ERROR');
            }
        }, 15000);

        try {
            const baseInstruction = await HANISAH_BRAIN.getSystemInstruction(persona, '', notesRef.current);
            const liveInstruction = `
            ${baseInstruction}
            
            [LIVE_MODE_ACTIVATED]
            You are currently operating in a real-time voice environment.
            1. **GENIUS MODE**: You have access to 'googleSearch'. USE IT for any question about current events, news, or complex topics.
            2. **PERFORMER MODE**: You are capable of singing. If asked to sing, generate the audio with rhythmic cadence, melody, and emotion. Do not just read lyrics. Perform them.
            3. **FULL CONTROL**: You can manage notes (create, read, update) using 'manage_note'.
            4. **CONCISENESS**: Keep spoken responses natural and relatively concise unless explaining a complex topic.
            `;

            const storedVoice = localStorage.getItem(`${persona}_voice`);
            const voice = storedVoice ? JSON.parse(storedVoice) : (persona === 'hanisah' ? 'Zephyr' : 'Fenrir');
            setCurrentVoice(voice);

            await neuralLink.current.connect({
                modelId: 'gemini-2.5-flash-native-audio-preview-12-2025',
                persona,
                systemInstruction: liveInstruction,
                voiceName: voice,
                onStatusChange: (newStatus, err) => {
                    // Clear watchdog if active or error
                    if (newStatus === 'ACTIVE' || newStatus === 'ERROR') {
                        if (watchdogRef.current) clearTimeout(watchdogRef.current);
                    }

                    setStatus(newStatus);
                    if (newStatus === 'ERROR') {
                        setIsLive(false);
                        debugService.log('ERROR', 'LIVE_CTX', 'CONNECT_FAIL', err || 'Unknown');
                    } else if (newStatus === 'ACTIVE') {
                        // Apply settings once active
                        neuralLink.current.setMicMode(micMode);
                        neuralLink.current.setAmbientMode(ambientMode);
                    }
                },
                onTranscription: (event) => {
                    if (event.isFinal) {
                        setTranscript(prev => [...prev, { role: event.source, text: event.text }]);
                        setInterimTranscript(null);
                    } else {
                        setInterimTranscript({ role: event.source, text: event.text });
                    }
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
            if (watchdogRef.current) clearTimeout(watchdogRef.current);
            setIsLive(false);
            setStatus('ERROR');
        }
    }, [isLive, micMode, ambientMode, setNotes, status]);

    const stopSession = useCallback(() => {
        if (watchdogRef.current) clearTimeout(watchdogRef.current);
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
        if (isLive) neuralLink.current.setAmbientMode(mode);
    }, [isLive]);

    const changeVoice = useCallback((voice: string) => {
        setCurrentVoice(voice);
        if (isLive) neuralLink.current.switchVoice(voice);
    }, [isLive]);

    const value = useMemo(() => ({
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
        startSession,
        stopSession,
        toggleMinimize,
        setMicMode,
        setAmbientMode,
        changeVoice
    }), [
        isLive, isMinimized, status, transcript, interimTranscript, activeTool, micMode, ambientMode, currentVoice,
        startSession, stopSession, toggleMinimize, setMicMode, setAmbientMode, changeVoice
    ]);

    return React.createElement(LiveSessionContext.Provider, { value }, children);
};

export const useLiveSession = () => {
    const context = useContext(LiveSessionContext);
    if (!context) {
        throw new Error('useLiveSession must be used within a LiveSessionProvider');
    }
    return context;
};
