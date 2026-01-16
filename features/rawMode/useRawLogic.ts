import { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { HANISAH_KERNEL, MODEL_CATALOG } from '../../services/melsaKernel';
import { useLiveSession } from '../../contexts/LiveSessionContext';
import { debugService } from '../../services/debugService';
import { executeNeuralTool } from '../aiChat/services/toolHandler';
import type { Note } from '../../types';

export interface RawMessage {
    id: string;
    role: 'USER' | 'HANISAH' | 'SYSTEM';
    content: string;
    timestamp: string;
    model?: string;
}

export const useRawLogic = (notes: Note[], setNotes: (notes: Note[]) => void) => {
    const [messages, setMessages] = useState<RawMessage[]>([
        { 
            id: 'init', 
            role: 'HANISAH', 
            content: "RAW_KERNEL::CONNECTED\nVAULT_ACCESS::GRANTED\nVISUAL_MODULE::ONLINE\n\nReady for input...", 
            timestamp: new Date().toLocaleTimeString() 
        }
    ]);
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedModelId, setSelectedModelId] = useState('auto-best');
    const [autoScroll, setAutoScroll] = useState(true);

    const { 
        isLive, 
        startSession, 
        stopSession, 
        transcript 
    } = useLiveSession();

    useEffect(() => {
        if (transcript.length > 0) {
            const lastEntry = transcript[transcript.length - 1];
            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg.content !== lastEntry.text) {
                    return [...prev, {
                        id: uuidv4(),
                        role: lastEntry.role === 'user' ? 'USER' : 'HANISAH',
                        content: `[VOICE] ${lastEntry.text}`,
                        timestamp: new Date().toLocaleTimeString()
                    }];
                }
                return prev;
            });
        }
    }, [transcript]);

    const sendMessage = useCallback(async () => {
        if (!input.trim() || isProcessing) return;

        const userMsg: RawMessage = {
            id: uuidv4(),
            role: 'USER',
            content: input,
            timestamp: new Date().toLocaleTimeString()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsProcessing(true);

        const modelMsgId = uuidv4();
        
        setMessages(prev => [...prev, {
            id: modelMsgId,
            role: 'HANISAH',
            content: "...",
            timestamp: new Date().toLocaleTimeString(),
            model: selectedModelId
        }]);

        try {
            // Fix: Pass actual Note[] array to streamExecute for internal RAG processing
            const stream = HANISAH_KERNEL.streamExecute(userMsg.content, selectedModelId, notes);
            
            let fullResponse = "";
            
            for await (const chunk of stream) {
                if (chunk.text) {
                    fullResponse += chunk.text;
                    setMessages(prev => prev.map(m => 
                        m.id === modelMsgId 
                        ? { ...m, content: fullResponse } 
                        : m
                    ));
                }

                if (chunk.functionCall) {
                    const toolName = chunk.functionCall.name;
                    fullResponse += `\n> [EXEC] ${toolName}...\n`;
                    
                    setMessages(prev => prev.map(m => m.id === modelMsgId ? { ...m, content: fullResponse } : m));

                    try {
                        const result = await executeNeuralTool(chunk.functionCall, notes, setNotes);
                        fullResponse += `> [RESULT] ${result}\n`;
                        
                        setMessages(prev => prev.map(m => m.id === modelMsgId ? { ...m, content: fullResponse } : m));
                    } catch (e: any) {
                        fullResponse += `> [FAIL] ${e.message}\n`;
                        setMessages(prev => prev.map(m => m.id === modelMsgId ? { ...m, content: fullResponse } : m));
                    }
                }
            }
        } catch (error: any) {
            setMessages(prev => prev.map(m => 
                m.id === modelMsgId 
                ? { ...m, content: `CRITICAL_ERROR: ${error.message}` } 
                : m
            ));
        } finally {
            setIsProcessing(false);
        }
    }, [input, isProcessing, selectedModelId, notes, setNotes]);

    const toggleLive = () => {
        if (isLive) stopSession();
        else startSession('hanisah');
    };

    const clearTerminal = () => {
        setMessages([{ 
            id: uuidv4(), 
            role: 'SYSTEM', 
            content: "TERMINAL_FLUSHED", 
            timestamp: new Date().toLocaleTimeString() 
        }]);
    };

    return {
        messages,
        input,
        setInput,
        isProcessing,
        sendMessage,
        models: MODEL_CATALOG,
        selectedModelId,
        setSelectedModelId,
        isLive,
        toggleLive,
        clearTerminal,
        autoScroll,
        setAutoScroll
    };
};