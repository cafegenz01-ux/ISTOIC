
import { useState, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import useLocalStorage from '../../../hooks/useLocalStorage';
import { type Note } from '../../../types';
import { MODEL_CATALOG } from '../../../services/melsaKernel';
import { useVault } from '../../../contexts/VaultContext';
import { PollinationsService } from '../../../services/pollinationsService';
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
    
    // 3. UI State
    const [input, setInput] = useState('');
    const [isLiveModeActive, setIsLiveModeActive] = useState(false);

    // Derived
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
        isAutoSpeak
    });

    // --- HANDLERS ---

    const handleNewChat = useCallback(async (persona: 'hanisah' | 'stoic' = 'stoic') => {
        const welcome = persona === 'hanisah' 
            ? "⚡ **HANISAH V20 ONLINE.**\n\n*Hai sayang, sistem udah di-upgrade nih. Mau ngomongin apa?*" 
            : "🧠 **STOIC V20 TITANIUM.**\n\n*Logic Core V20 Initialized.*\nSistem stabil. Mari bedah realitas.";
        
        return createThread(persona, globalModelId, welcome);
    }, [createThread, globalModelId]);

    const handleSendMessage = async (e?: React.FormEvent, attachment?: { data: string, mimeType: string }) => {
        const userMsg = input.trim();
        if ((!userMsg && !attachment) || isLoading) return;

        let currentThreadId = activeThreadId;

        if (!currentThreadId) {
            const newThread = await handleNewChat(personaMode);
            currentThreadId = newThread.id;
        }

        const newUserMsg = {
            id: uuidv4(),
            role: 'user' as const,
            text: attachment ? (userMsg || "Analyze attachment") : userMsg,
            metadata: { status: 'success' as const }
        };

        addMessage(currentThreadId!, newUserMsg);
        
        // Auto rename
        const thread = threads.find(t => t.id === currentThreadId);
        if (thread && thread.messages.length <= 2 && userMsg) {
            renameThread(currentThreadId!, userMsg.slice(0, 30).toUpperCase());
        }

        setInput('');
        
        // Trigger Stream
        await streamMessage(userMsg, activeModel, attachment);
    };

    const generateWithHydra = async () => {
        if (!input.trim()) { alert("Masukkan deskripsi."); return; }
        const promptText = input.trim();
        setInput(''); 
        
        let targetId = activeThreadId;
        if (!targetId) {
            const newThread = await handleNewChat(personaMode);
            targetId = newThread.id;
        }

        if (personaMode === 'stoic') {
            addMessage(targetId!, { 
                id: uuidv4(), 
                role: 'user', 
                text: `Generate: ${promptText}`, 
                metadata: { status: 'success' } 
            });
            addMessage(targetId!, { 
                id: uuidv4(), 
                role: 'model', 
                text: "> 🚫 **VISUAL MODULE BLOCKED**\n\nStoic logic strictly prohibits distraction.", 
                metadata: { status: 'error' } 
            });
            return;
        }

        const userMsgId = uuidv4();
        addMessage(targetId!, { id: userMsgId, role: 'user', text: `🎨 Generate: ${promptText}`, metadata: { status: 'success' } });
        
        const modelMsgId = uuidv4();
        addMessage(targetId!, { id: modelMsgId, role: 'model', text: "Initializing Visual Engine...", metadata: { status: 'success' } });

        try {
            const targetModel = (imageModelId === 'gemini-2.5-flash-image' || imageModelId === 'gemini-3-pro-image-preview') ? 'hydra-smart-route' : imageModelId;
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
        // Data & State
        threads, setThreads, activeThread, activeThreadId, setActiveThreadId,
        input, setInput, isLoading, 
        
        // Settings
        isVaultSynced: isVaultUnlocked, setIsVaultSynced: (val: boolean) => val ? unlockVault() : lockVault(),
        isVaultConfigEnabled: vaultEnabled, 
        isAutoSpeak, setIsAutoSpeak, 
        isLiveModeActive, setIsLiveModeActive,
        activeModel, setGlobalModelId, personaMode, 
        imageModelId, setImageModelId,

        // Actions
        handleNewChat, 
        sendMessage: handleSendMessage, 
        stopGeneration, 
        generateWithPollinations: generateWithHydra,
        
        // Pass-through Storage Actions
        renameThread: storage.renameThread,
        togglePinThread: storage.togglePinThread,
        deleteThread: storage.deleteThread
    };
};
