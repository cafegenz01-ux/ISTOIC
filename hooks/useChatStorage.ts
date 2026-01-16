
import { useCallback, useMemo } from 'react';
import { useIDB } from './useIDB';
import useLocalStorage from './useLocalStorage';
import { ChatThread, ChatMessage } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const useChatStorage = () => {
    // Capture isLoaded from useIDB to prevent writing to state before it's hydrated
    const [threads, setThreads, isThreadsLoaded] = useIDB<ChatThread[]>('chat_threads', []);
    const [activeThreadId, setActiveThreadId] = useLocalStorage<string | null>('active_thread_id', null);

    const activeThread = useMemo(() => {
        return threads.find(t => t.id === activeThreadId) || null;
    }, [threads, activeThreadId]);

    const createThread = useCallback((persona: 'hanisah' | 'stoic', modelId: string, initialMsg: string) => {
        const newId = uuidv4();
        const newThread: ChatThread = {
            id: newId,
            title: `NEW_SESSION_${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            persona,
            model_id: modelId,
            messages: [{ 
                id: uuidv4(), 
                role: 'model', 
                text: initialMsg, 
                metadata: { status: 'success', model: 'System' } 
            }],
            updated: new Date().toISOString(),
            isPinned: false
        };
        setThreads(prev => [newThread, ...prev]);
        setActiveThreadId(newId);
        return newThread;
    }, [setThreads, setActiveThreadId]);

    const addMessage = useCallback((threadId: string, message: ChatMessage) => {
        setThreads(prev => prev.map(t => t.id === threadId ? {
            ...t,
            messages: [...t.messages, message],
            updated: new Date().toISOString()
        } : t));
    }, [setThreads]);

    const updateMessage = useCallback((threadId: string, messageId: string, updates: Partial<ChatMessage>) => {
        setThreads(prev => prev.map(t => t.id === threadId ? {
            ...t,
            messages: t.messages.map(m => {
                if (m.id !== messageId) return m;
                const nextMetadata = updates.metadata ? { ...m.metadata, ...updates.metadata } : m.metadata;
                return { ...m, ...updates, metadata: nextMetadata };
            })
        } : t));
    }, [setThreads]);

    const renameThread = useCallback((id: string, newTitle: string) => {
        setThreads(prev => prev.map(t => t.id === id ? { ...t, title: newTitle, updated: new Date().toISOString() } : t));
    }, [setThreads]);

    const deleteThread = useCallback((id: string) => {
        setThreads(prev => prev.filter(t => t.id !== id));
        if (activeThreadId === id) setActiveThreadId(null);
    }, [setThreads, activeThreadId, setActiveThreadId]);

    const togglePinThread = useCallback((id: string) => {
        setThreads(prev => prev.map(t => t.id === id ? { ...t, isPinned: !t.isPinned } : t));
    }, [setThreads]);

    return {
        threads,
        setThreads,
        isThreadsLoaded,
        activeThread,
        activeThreadId,
        setActiveThreadId,
        createThread,
        addMessage,
        updateMessage,
        renameThread,
        deleteThread,
        togglePinThread
    };
};
