
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import useLocalStorage from '../../../hooks/useLocalStorage';
import { useIDB } from '../../../hooks/useIDB'; 
import { type ChatThread, type ChatMessage, type Note } from '../../../types';
import { MODEL_CATALOG, HANISAH_KERNEL } from '../../../services/melsaKernel';
import { STOIC_KERNEL } from '../../../services/stoicKernel';
import { executeNeuralTool } from '../services/toolHandler';
import { speakWithHanisah } from '../../../services/elevenLabsService';
import { useVault } from '../../../contexts/VaultContext';
import { debugService } from '../../../services/debugService';
import { PollinationsService } from '../../../services/pollinationsService';
import { MemoryService } from '../../../services/memoryService';
import { useChatStorage } from '../../../hooks/useChatStorage'; 
import { useAIStream } from './useAIStream';

export const useChatLogic = (notes: Note[], setNotes: (notes: Note[]) => void) => {
    // 1. Storage Logic
    const storage = useChatStorage();
    const { 
        threads, setThreads, activeThread, activeThreadId, setActiveThreadId,
        createThread, addMessage, renameThread 
    } = storage;

    // 2. Settings & Context
    const [globalModelId, setGlobalModelId] = useLocalStorage<string>('global_model_preference', 'llama-3.3-70b-versatile');
    const [imageModelId, setImageModelId] = useLocalStorage<string>('image_model_preference', 'hydra');
    
    const { isVaultUnlocked, lockVault, unlockVault, isVaultConfigEnabled } = useVault();
    const [isAutoSpeak, setIsAutoSpeak] = useLocalStorage<boolean>('is_auto_speak', false);
    
    const [input, setInput] = useState('');
    const [isLiveModeActive, setIsLiveModeActive] = useState(false);

    const pendingThreadId = useRef<string | null>(null);
    
    // Refs for background processes (Memory Core)
    const notesRef = useRef(notes);
    const activeThreadRef = useRef<ChatThread | null>(null);

    useEffect(() => { notesRef.current = notes; }, [notes]);
    useEffect(() => { activeThreadRef.current = activeThread; }, [activeThread]);

    const activeModel = useMemo(() => {
        const id = activeThread?.model_id || globalModelId;
        return MODEL_CATALOG.find(m => m.id === id) || MODEL_CATALOG[0];
    }, [activeThread, globalModelId]);

    const personaMode = activeThread?.persona || 'stoic';
    const vaultEnabled = isVaultConfigEnabled(personaMode);

    // 4. AI Logic
    const { isLoading, stopGeneration, streamMessage } = useAIStream({
        notes,
        setNotes,
        activeThread,
        storage,
        isVaultUnlocked,
        vaultEnabled,
        isAutoSpeak,
        imageModelId
    });

    // --- MEMORY CORE INTEGRATION ---
    const triggerMemoryConsolidation = useCallback(() => {
        if (activeThreadRef.current) {
            const threadToMemorize = activeThreadRef.current;
            // Run in background, don't await
            MemoryService.summarizeAndStore(threadToMemorize, notesRef.current, setNotes);
        }
    }, [setNotes]);

    const handleNewChat = useCallback(async (persona: 'hanisah' | 'stoic' = 'stoic') => {
        // Memorize previous thread before switching
        triggerMemoryConsolidation();

        const welcome = persona === 'hanisah' 
            ? "⚡ **HANISAH V20 ONLINE.**\n\n*Hai sayang, sistem udah di-upgrade nih. Mau ngomongin apa? Atau mau pantun?*" 
            : "🧠 **STOIC V20 TITANIUM.**\n\n*Logic Core V20 Initialized.*\nSistem stabil. Rotasi kunci aktif. Mari bedah realitas dengan logika.";
        
        // Use storage to create thread which handles IDB sync
        const newThread = createThread(persona, globalModelId, welcome);
        pendingThreadId.current = newThread.id;
        
        return newThread;
    }, [createThread, globalModelId, triggerMemoryConsolidation]);

    const deleteThreadWrapper = useCallback((id: string) => {
        // If deleting active thread, memorize it first.
        if (activeThreadRef.current?.id === id) {
            triggerMemoryConsolidation();
        } else {
            const target = threads.find(t => t.id === id);
            if (target) MemoryService.summarizeAndStore(target, notesRef.current, setNotes);
        }
        storage.deleteThread(id);
    }, [threads, triggerMemoryConsolidation, setNotes, storage]);

    const handleSendMessage = async (e?: React.FormEvent, attachment?: { data: string, mimeType: string }) => {
        const userMsg = input.trim();
        if ((!userMsg && !attachment) || isLoading) return;

        let currentThreadId = activeThreadId;

        // Ensure thread exists
        if (!currentThreadId) {
            const newThread = await handleNewChat(personaMode);
            currentThreadId = newThread.id;
        }

        const newUserMsg: ChatMessage = {
            id: uuidv4(),
            role: 'user',
            text: attachment ? (userMsg || "Analyze attachment") : userMsg,
            metadata: { status: 'success' }
        };

        // 1. UPDATE STATE & DB (Single Source of Truth)
        // Note: addMessage updates the local state immediately via useIDB's setter, 
        // preventing UI lag, while also persisting to IndexedDB.
        addMessage(currentThreadId!, newUserMsg);
        
        // Auto rename check
        const thread = threads.find(t => t.id === currentThreadId);
        if (thread && thread.messages.length <= 2 && userMsg) {
            renameThread(currentThreadId!, userMsg.slice(0, 30).toUpperCase());
        }

        setInput('');
        
        // 2. Trigger Stream
        await streamMessage(userMsg, activeModel, attachment);
    };

    const generateWithHydra = async () => {
        if (!input.trim()) { alert("Masukkan deskripsi gambar."); return; }
        const promptText = input.trim();
        setInput(''); 
        
        let targetId = activeThreadId;
        if (!targetId) {
            const newThread = await handleNewChat(personaMode);
            targetId = newThread.id;
        }

        if (personaMode === 'stoic') {
            const deniedMsg: ChatMessage = { 
                id: uuidv4(), 
                role: 'model', 
                text: "> 🚫 **ACCESS DENIED: VISUAL MODULE**\n\n_\"The Stoic mind focuses on internal reason, not external illusions.\"_\n\nMy architecture is strictly bound to Logic Processing. I cannot engage the Hydra Visual Engine. Switch to **HANISAH** for creative synthesis.", 
                metadata: { status: 'error', model: 'SYSTEM_GATEKEEPER', systemStatus: 'PROTOCOL_VIOLATION' } 
            };
            addMessage(targetId!, { id: uuidv4(), role: 'user', text: `Generate Visual: ${promptText}`, metadata: { status: 'success' } });
            addMessage(targetId!, deniedMsg);
            return;
        }

        const userMsgId = uuidv4();
        const modelMsgId = uuidv4();
        
        addMessage(targetId!, { id: userMsgId, role: 'user', text: `🎨 Generate: ${promptText}`, metadata: { status: 'success' } });
        addMessage(targetId!, { id: modelMsgId, role: 'model', text: "Initializing Visual Engine...", metadata: { status: 'success' } });

        try {
            const targetModel = (imageModelId === 'gemini-2.5-flash-image' || imageModelId === 'gemini-3-pro-image-preview') 
                ? 'hydra-smart-route' 
                : imageModelId;

            const result = await PollinationsService.generateHydraImage(promptText, targetModel);
            
            storage.updateMessage(targetId!, modelMsgId, {
                text: `Here is your creation based on "${promptText}":\n\n![Generated Image](${result.url})\n\n_Engine: ${result.model.toUpperCase()}_`
            });
        } catch (e: any) {
            storage.updateMessage(targetId!, modelMsgId, {
                text: `⚠️ **GENERATION FAILED**: ${e.message}`
            });
        }
    };

    return {
        threads, setThreads, activeThread, activeThreadId, setActiveThreadId,
        isVaultSynced: isVaultUnlocked, setIsVaultSynced: (val: boolean) => val ? unlockVault() : lockVault(),
        isVaultConfigEnabled: vaultEnabled, isAutoSpeak, setIsAutoSpeak, isLiveModeActive, setIsLiveModeActive,
        input, setInput, isLoading, activeModel, setGlobalModelId, personaMode,
        handleNewChat, 
        sendMessage: handleSendMessage, 
        stopGeneration,
        generateWithHydra, 
        generateWithPollinations: generateWithHydra, 
        imageModelId, setImageModelId,
        
        // Storage Actions
        renameThread: storage.renameThread,
        togglePinThread: storage.togglePinThread,
        deleteThread: deleteThreadWrapper
    };
};
