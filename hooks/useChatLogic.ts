import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import useLocalStorage from './useLocalStorage';
import { useIDB } from './useIDB'; 
import { type ChatThread, type ChatMessage, type Note } from '../types';
import { MODEL_CATALOG, HANISAH_KERNEL } from '../services/melsaKernel';
import { STOIC_KERNEL } from '../services/stoicKernel';
import { executeNeuralTool } from '../features/aiChat/services/toolHandler';
import { speakWithHanisah } from '../services/elevenLabsService';
import { useVault } from '../contexts/VaultContext';
import { debugService } from '../services/debugService';
import { PollinationsService } from '../services/pollinationsService';
import { MemoryService } from '../services/memoryService';

export const useChatLogic = (notes: Note[], setNotes: (notes: Note[]) => void) => {
    const [threads, setThreads, isThreadsLoaded] = useIDB<ChatThread[]>('chat_threads', []);
    const [activeThreadId, setActiveThreadId] = useLocalStorage<string | null>('active_thread_id', null);
    const [globalModelId, setGlobalModelId] = useLocalStorage<string>('global_model_preference', 'llama-3.3-70b-versatile');
    const [imageModelId, setImageModelId] = useLocalStorage<string>('image_model_preference', 'hydra');
    const [isAutoSpeak, setIsAutoSpeak] = useLocalStorage<boolean>('is_auto_speak', false);
    
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLiveModeActive, setIsLiveModeActive] = useState(false);

    const { isVaultUnlocked, lockVault, unlockVault, isVaultConfigEnabled } = useVault();
    
    const abortControllerRef = useRef<AbortController | null>(null);
    const notesRef = useRef(notes);
    const activeThreadRef = useRef<ChatThread | null>(null);

    useEffect(() => { notesRef.current = notes; }, [notes]);

    const activeThread = useMemo(() => {
        if (!activeThreadId) return null;
        return threads.find(t => t.id === activeThreadId) || null;
    }, [threads, activeThreadId]);

    useEffect(() => { activeThreadRef.current = activeThread; }, [activeThread]);

    const activeModel = useMemo(() => {
        const id = activeThread?.model_id || globalModelId;
        return MODEL_CATALOG.find(m => m.id === id) || MODEL_CATALOG[0];
    }, [activeThread, globalModelId]);

    const personaMode = activeThread?.persona || 'stoic';

    const triggerMemoryConsolidation = useCallback(() => {
        if (activeThreadRef.current) {
            MemoryService.summarizeAndStore(activeThreadRef.current, notesRef.current, setNotes);
        }
    }, [setNotes]);

    const createNewThreadObj = useCallback((persona: 'hanisah' | 'stoic', firstUserMsg: string) => {
        const welcome = persona === 'hanisah' 
            ? "⚡ **HANISAH V20 ONLINE.**\n\n*Hai sayang, sistem udah di-upgrade nih. Mau ngomongin apa?*" 
            : "🧠 **STOIC V20 TITANIUM.**\n\n*Logic Core V20 Initialized.*";
        
        const newId = uuidv4();
        const title = firstUserMsg 
            ? firstUserMsg.slice(0, 30).toUpperCase() 
            : `SESSION_${new Date().toLocaleTimeString()}`;

        const newThread: ChatThread = {
            id: newId,
            title: title,
            persona,
            model_id: globalModelId, 
            messages: [{ id: uuidv4(), role: 'model', text: welcome, metadata: { status: 'success', model: 'System' } }],
            updated: new Date().toISOString(),
            isPinned: false
        };
        return newThread;
    }, [globalModelId]);

    const handleNewChat = useCallback(async (persona: 'hanisah' | 'stoic' = 'stoic') => {
        triggerMemoryConsolidation();
        const newThread = createNewThreadObj(persona, '');
        setActiveThreadId(newThread.id);
        setThreads(prev => [newThread, ...prev]);
        return newThread;
    }, [createNewThreadObj, setActiveThreadId, setThreads, triggerMemoryConsolidation]);

    const sendMessage = async (e?: React.FormEvent, attachment?: { data: string, mimeType: string }) => {
        if (e) e.preventDefault();
        
        const userMsg = input.trim();
        if ((!userMsg && !attachment) || isLoading) return;

        setInput(''); // Reset input immediately

        let targetId = activeThreadId;
        const exists = threads.some(t => t.id === targetId);
        
        const userMsgId = uuidv4();
        const modelMsgId = uuidv4();
        const now = new Date().toISOString();

        const newUserMsg: ChatMessage = { 
            id: userMsgId, role: 'user', text: attachment ? (userMsg || "Attachment") : userMsg, 
            metadata: { status: 'success', createdAt: now } 
        };
        const modelPlaceholder: ChatMessage = { 
            id: modelMsgId, role: 'model', text: '', 
            metadata: { status: 'loading', model: activeModel.name } 
        };

        // --- ATOMIC STATE UPDATE ---
        if (!targetId || !exists) {
            const newThread = createNewThreadObj(personaMode, userMsg);
            newThread.messages.push(newUserMsg, modelPlaceholder);
            targetId = newThread.id;
            setActiveThreadId(targetId);
            setThreads(prev => [newThread, ...prev]);
        } else {
            setThreads(prev => prev.map(t => {
                if (t.id === targetId) {
                    return { ...t, messages: [...t.messages, newUserMsg, modelPlaceholder], updated: now };
                }
                return t;
            }));
        }

        setIsLoading(true);
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const kernel = personaMode === 'hanisah' ? HANISAH_KERNEL : STOIC_KERNEL;
            const stream = kernel.streamExecute(
                userMsg || "Process attachment.", 
                activeModel.id, 
                notesRef.current, 
                attachment,
                { signal: controller.signal } 
            );
            
            let accumulatedText = "";

            for await (const chunk of stream) {
                if (controller.signal.aborted) break;
                if (chunk.text) accumulatedText += chunk.text;

                if (chunk.functionCall) {
                    try {
                        const res = await executeNeuralTool(chunk.functionCall, notesRef.current, setNotes, imageModelId);
                        accumulatedText += `\n> ⚙️ **TOOL:** ${chunk.functionCall.name}\n> ✅ ${res}\n`;
                    } catch (err: any) {
                        accumulatedText += `\n> ❌ **TOOL FAIL:** ${err.message}\n`;
                    }
                }

                // Streaming Update
                setThreads(prev => prev.map(t => {
                    if (t.id === targetId) {
                        return {
                            ...t,
                            messages: t.messages.map(m => m.id === modelMsgId ? {
                                ...m, text: accumulatedText, metadata: { ...m.metadata, status: 'streaming' }
                            } : m)
                        };
                    }
                    return t;
                }));
            }

            if (!accumulatedText.trim()) accumulatedText = "> **NO RESPONSE** (Network Error or Empty Stream)";
            
            // Final Update
            setThreads(prev => prev.map(t => t.id === targetId ? {
                ...t,
                messages: t.messages.map(m => m.id === modelMsgId ? {
                    ...m, text: accumulatedText, metadata: { ...m.metadata, status: 'success' } 
                } : m)
            } : t));

            if (isAutoSpeak && accumulatedText) speakWithHanisah(accumulatedText, personaMode === 'hanisah' ? 'Hanisah' : 'Fenrir');

        } catch (err: any) {
            console.error("Stream Error:", err);
            setThreads(prev => prev.map(t => t.id === targetId ? { 
                ...t, 
                messages: t.messages.map(m => m.id === modelMsgId ? {
                    ...m, text: `⚠️ **ERROR:** ${err.message}`, metadata: { ...m.metadata, status: 'error' }
                } : m)
            } : t));
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    const renameThread = (id: string, title: string) => setThreads(p => p.map(t => t.id === id ? { ...t, title } : t));
    const togglePinThread = (id: string) => setThreads(p => p.map(t => t.id === id ? { ...t, isPinned: !t.isPinned } : t));
    const deleteThread = (id: string) => {
        setThreads(p => p.filter(t => t.id !== id));
        if (activeThreadId === id) setActiveThreadId(null);
    };
    const stopGeneration = () => abortControllerRef.current?.abort();
    const generateWithHydra = async () => { alert("Use chat to generate images."); };

    return {
        threads, setThreads, activeThread, activeThreadId, setActiveThreadId, isThreadsLoaded,
        isVaultSynced: isVaultUnlocked, setIsVaultSynced: (val: boolean) => val ? unlockVault() : lockVault(),
        isVaultConfigEnabled: isVaultConfigEnabled(personaMode), isAutoSpeak, setIsAutoSpeak, isLiveModeActive, setIsLiveModeActive,
        input, setInput, isLoading, activeModel, setGlobalModelId, personaMode,
        handleNewChat, renameThread, togglePinThread, deleteThread, sendMessage, stopGeneration,
        generateWithPollinations: generateWithHydra, imageModelId, setImageModelId
    };
};