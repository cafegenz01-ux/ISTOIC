import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import useLocalStorage from '../../../hooks/useLocalStorage';
import { type ChatThread, type ChatMessage, type Note } from '../../../types';
import { MODEL_CATALOG } from '../../../services/melsaKernel';
import { useVault } from '../../../contexts/VaultContext';
import { PollinationsService } from '../../../services/pollinationsService';
import { MemoryService } from '../../../services/memoryService';
import { useChatStorage } from '../../../hooks/useChatStorage';
import { useAIStream } from './useAIStream';

/** Context for retrying failed messages */
interface RetryContext {
  prompt: string;
  attachment?: { data: string; mimeType: string };
  persona?: 'hanisah' | 'stoic';
  modelId?: string;
  threadId?: string;
}

/** Options for sending messages */
interface SendOptions {
  attachment?: { data: string; mimeType: string };
  promptOverride?: string;
  retryMessageId?: string;
  persona?: 'hanisah' | 'stoic';
}

/** Persona-specific welcome messages */
const PERSONA_MESSAGES = {
  HANISAH: '**Hanisah siap membantu.**\n\nApa yang ingin kamu bahas hari ini?',
  STOIC: '**Stoic siap fokus.**\n\nBerikan konteks dan kita lanjutkan.'
} as const;

// Backwards compatibility
const HANISAH_WELCOME = PERSONA_MESSAGES.HANISAH;
const STOIC_WELCOME = PERSONA_MESSAGES.STOIC;

export const useChatLogic = (notes: Note[], setNotes: (notes: Note[]) => void) => {
  // --- 1. CORE STORAGE & STATE ---
  const storage = useChatStorage();
  const {
    threads,
    setThreads,
    activeThreadId,
    setActiveThreadId,
    createThread,
    addMessage,
    renameThread,
    isThreadsLoaded,
    updateMessage
  } = storage;

  // --- 2. PREFERENCES ---
  const [globalModelId, setGlobalModelId] = useLocalStorage<string>('global_model_preference', 'llama-3.3-70b-versatile');
  const [imageModelId, setImageModelId] = useLocalStorage<string>('image_model_preference', 'hydra');
  const [isAutoSpeak, setIsAutoSpeak] = useLocalStorage<boolean>('is_auto_speak', false);

  // --- 3. CONTEXTS ---
  const { isVaultUnlocked, lockVault, unlockVault, isVaultConfigEnabled } = useVault();
  const [input, setInput] = useState('');
  const [isLiveModeActive, setIsLiveModeActive] = useState(false);

  // --- 4. REFS ---
  const activeThreadIdRef = useRef<string | null>(activeThreadId);
  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  const notesRef = useRef(notes);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  // --- 5. ACTIVE THREAD RESOLUTION ---
  const activeThread = useMemo(() => {
    return threads.find((t) => t.id === activeThreadId) || null;
  }, [threads, activeThreadId]);

  const activeModel = useMemo(() => {
    const id = activeThread?.model_id || globalModelId;
    return MODEL_CATALOG.find((m) => m.id === id) || MODEL_CATALOG[0];
  }, [activeThread, globalModelId]);

  const personaMode = activeThread?.persona || 'stoic';
  const vaultEnabled = isVaultConfigEnabled(personaMode);

  // --- 6. AI STREAM ENGINE ---
  const { isLoading, stopGeneration, streamMessage } = useAIStream({
    notes,
    setNotes,
    addMessage,
    updateMessage,
    isAutoSpeak,
    imageModelId
  });

  useEffect(() => {
    return () => stopGeneration('cleanup');
  }, [stopGeneration]);

  // --- 7. MEMORY OPERATIONS ---
  const triggerMemoryConsolidation = useCallback(() => {
    if (activeThread) {
      MemoryService.summarizeAndStore(activeThread, notesRef.current, setNotes);
    }
  }, [activeThread, setNotes]);

  const deleteThreadWrapper = useCallback(
    (id: string) => {
      if (activeThreadId === id) {
        stopGeneration('replace');
        triggerMemoryConsolidation();
        setActiveThreadId(null);
      } else {
        const target = threads.find((t) => t.id === id);
        if (target) MemoryService.summarizeAndStore(target, notesRef.current, setNotes);
      }
      storage.deleteThread(id);
    },
    [threads, activeThreadId, triggerMemoryConsolidation, setNotes, storage, setActiveThreadId, stopGeneration]
  );

  // --- 8. SESSION HANDLERS ---
  const handleNewChat = useCallback(
    async (persona: 'hanisah' | 'stoic' = 'stoic') => {
      stopGeneration('replace');
      triggerMemoryConsolidation();

      const welcome = persona === 'hanisah' ? HANISAH_WELCOME : STOIC_WELCOME;
      const newThread = createThread(persona, globalModelId, welcome);
      setActiveThreadId(newThread.id);
      return newThread;
    },
    [createThread, globalModelId, triggerMemoryConsolidation, setActiveThreadId, stopGeneration]
  );

  // --- 9. SEND MESSAGE LOGIC ---
  const handleSendMessage = useCallback(
    async (e?: React.FormEvent, options?: SendOptions) => {
      if (e) e.preventDefault();

      const { attachment, promptOverride, retryMessageId, persona: personaOverride } = options ?? {};

      const promptText = (promptOverride ?? input).trim();
      const hasContent = promptText || attachment;
      if (!hasContent || isLoading) return;

      const sendPersona = personaOverride || personaMode;
      if (!retryMessageId) setInput('');

      stopGeneration('replace');

      let currentThreadId = activeThreadId;
      const threadExists = threads.some((t) => t.id === currentThreadId);
      const userPrompt = promptText || (attachment ? 'Analyze attachment' : '');
      const userMsgId = uuidv4();
      const newUserMsg: ChatMessage = {
        id: userMsgId,
        role: 'user',
        text: userPrompt,
        metadata: {
          status: 'success',
          createdAt: new Date().toISOString(),
          hasAttachment: !!attachment
        }
      };

      // --- SCENARIO 1: NEW CHAT ---
      if (!currentThreadId || !threadExists) {
        const newId = uuidv4();
        const welcomeMsg = sendPersona === 'hanisah' ? HANISAH_WELCOME : STOIC_WELCOME;

        const newThread: ChatThread = {
          id: newId,
          title: userPrompt.slice(0, 40) || 'Chat baru',
          persona: sendPersona,
          model_id: globalModelId,
          messages: [
            { id: uuidv4(), role: 'model', text: welcomeMsg, metadata: { status: 'success', model: 'System' } },
            ...(retryMessageId ? [] : [newUserMsg])
          ],
          updated: new Date().toISOString(),
          isPinned: false
        };

        setThreads((prev) => [newThread, ...prev]);
        setActiveThreadId(newId);
        currentThreadId = newId;
      } else if (!retryMessageId) {
        addMessage(currentThreadId, newUserMsg);

        const threadRef = threads.find((t) => t.id === currentThreadId);
        if (threadRef && threadRef.messages.length <= 2 && userPrompt) {
          renameThread(currentThreadId, userPrompt.slice(0, 40));
        }
      }

      const targetThreadId = currentThreadId || activeThreadIdRef.current;
      if (!targetThreadId) return;

      try {
        await streamMessage({
          prompt: userPrompt,
          activeModel,
          threadId: targetThreadId,
          persona: sendPersona,
          attachment,
          retryMessageId
        });
      } catch (err) {
        const errorMsg: ChatMessage = {
          id: uuidv4(),
          role: 'model',
          text: 'Terjadi kesalahan saat memproses pesan. Silakan coba lagi.',
          metadata: { status: 'error' }
        };
        addMessage(targetThreadId, errorMsg);
      }
    },
    [
      input,
      isLoading,
      personaMode,
      threads,
      activeThreadId,
      addMessage,
      renameThread,
      setThreads,
      setActiveThreadId,
      globalModelId,
      activeModel,
      streamMessage,
      stopGeneration
    ]
  );

  // --- 10. RETRY HANDLER FOR STREAM FAILURES ---
  const retryMessage = useCallback(
    async (messageId: string, retryContext: RetryContext) => {
      const prompt = retryContext.prompt?.trim();
      if (!prompt) return;

      const targetThreadId = retryContext.threadId || activeThreadId || activeThreadIdRef.current;
      if (!targetThreadId) return;

      const model =
        MODEL_CATALOG.find((m) => m.id === retryContext.modelId) ||
        MODEL_CATALOG.find((m) => m.id === activeThread?.model_id) ||
        activeModel;

      setActiveThreadId(targetThreadId);
      await streamMessage({
        prompt,
        activeModel: model,
        threadId: targetThreadId,
        persona: retryContext.persona || personaMode,
        attachment: retryContext.attachment,
        retryMessageId: messageId
      });
    },
    [activeModel, activeThread, activeThreadId, personaMode, setActiveThreadId, streamMessage]
  );

  // --- 11. HYDRA / POLLINATIONS HANDLER ---
  const generateWithHydra = async () => {
    if (!input.trim()) return;
    const promptText = input.trim();
    setInput('');

    let targetId = activeThreadId;
    const threadExists = threads.some((t) => t.id === targetId);

    if (!targetId || !threadExists) {
      const newThread = await handleNewChat(personaMode);
      targetId = newThread.id;
    }

    if (personaMode === 'stoic') {
      const deniedMsg: ChatMessage = {
        id: uuidv4(),
        role: 'model',
        text: 'Akses pembuatan gambar tersedia di persona Hanisah.',
        metadata: { status: 'error', model: 'system' }
      };
      addMessage(targetId!, {
        id: uuidv4(),
        role: 'user',
        text: `Generate: ${promptText}`,
        metadata: { status: 'success' }
      });
      setTimeout(() => addMessage(targetId!, deniedMsg), 300);
      return;
    }

    const modelMsgId = uuidv4();
    addMessage(targetId!, {
      id: uuidv4(),
      role: 'user',
      text: `Generate: ${promptText}`,
      metadata: { status: 'success' }
    });

    addMessage(targetId!, {
      id: modelMsgId,
      role: 'model',
      text: 'Sedang menyiapkan visual...',
      metadata: { status: 'loading' }
    });

    try {
      const targetModel =
        imageModelId === 'gemini-2.5-flash-image' || imageModelId === 'gemini-3-pro-image-preview'
          ? 'hydra-smart-route'
          : imageModelId;

      const result = await PollinationsService.generateHydraImage(promptText, targetModel);

      updateMessage(targetId!, modelMsgId, {
        text: `Here is your creation based on "${promptText}":\n\n![Generated Image](${result.url})\n\n_Engine: ${result.model.toUpperCase()}_`,
        metadata: { status: 'success' }
      });
    } catch (e: any) {
      updateMessage(targetId!, modelMsgId, {
        text: `Gagal menghasilkan gambar: ${e.message}`,
        metadata: { status: 'error' }
      });
    }
  };

  return {
    threads,
    setThreads,
    activeThread,
    activeThreadId,
    setActiveThreadId,
    isThreadsLoaded,
    isVaultSynced: isVaultUnlocked,
    setIsVaultSynced: (val: boolean) => (val ? unlockVault() : lockVault()),
    isVaultConfigEnabled: vaultEnabled,
    isAutoSpeak,
    setIsAutoSpeak,
    isLiveModeActive,
    setIsLiveModeActive,
    isLoading,
    input,
    setInput,
    activeModel,
    setGlobalModelId,
    imageModelId,
    setImageModelId,
    personaMode,
    handleNewChat,
    sendMessage: handleSendMessage,
    retryMessage,
    stopGeneration,
    generateWithHydra,
    generateWithPollinations: generateWithHydra,
    renameThread,
    togglePinThread: storage.togglePinThread,
    deleteThread: deleteThreadWrapper
  };
};
