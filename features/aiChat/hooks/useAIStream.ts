
import { useState, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { STOIC_KERNEL as SK } from '../../../services/stoicKernel';
import { MODEL_CATALOG, HANISAH_KERNEL as HK } from '../../../services/melsaKernel';
import { executeNeuralTool } from '../services/toolHandler';
import { speakWithHanisah } from '../../../services/elevenLabsService';
import { debugService } from '../../../services/debugService';
import { Note, ChatThread, ChatMessage } from '../../../types';
import { MemoryService } from '../../../services/memoryService';

interface AIStreamProps {
    notes: Note[];
    setNotes: (notes: Note[]) => void;
    activeThread: ChatThread | null;
    storage: any; // Typed as return of useChatStorage
    isVaultUnlocked: boolean;
    vaultEnabled: boolean;
    isAutoSpeak: boolean;
}

export const useAIStream = ({
    notes,
    setNotes,
    activeThread,
    storage,
    isVaultUnlocked,
    vaultEnabled,
    isAutoSpeak
}: AIStreamProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const stopGeneration = useCallback(() => {
        if (abortControllerRef.current) {
            debugService.log('WARN', 'CHAT', 'ABORT', 'User stopped generation.');
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
        }
    }, []);

    const streamMessage = useCallback(async (
        userMsg: string, 
        activeModel: any,
        attachment?: { data: string, mimeType: string }
    ) => {
        if (!activeThread) return;
        
        setIsLoading(true);
        const targetId = activeThread.id;
        const modelMessageId = uuidv4();
        const transmissionId = uuidv4().slice(0,8);
        
        console.group(`🧠 NEURAL_LINK_TRANSMISSION: ${transmissionId}`);

        // Add placeholder
        storage.addMessage(targetId, { 
            id: modelMessageId, 
            role: 'model', 
            text: '', 
            metadata: { status: 'success', model: activeModel.name, provider: activeModel.provider } 
        });

        const controller = new AbortController();
        abortControllerRef.current = controller;
        const signal = controller.signal;

        try {
            // Context Building
            let noteContext = "";
            let memoryContext = "";

            if (isVaultUnlocked && vaultEnabled) {
                if (userMsg.length > 3) {
                    memoryContext = await MemoryService.recall(userMsg, notes);
                }
                const recentNotes = notes
                    .filter(n => !n.is_archived)
                    .slice(0, 30)
                    .map(n => `${n.title} [${n.tags?.join(',') || ''}] (ID:${n.id})`);
                
                noteContext = `${memoryContext}\n\n[VAULT_INDEX_SNAPSHOT]\n${recentNotes.join(' | ')}`;
            }

            const persona = activeThread.persona || 'stoic';
            const kernel = persona === 'hanisah' ? HK : SK;
            
            const stream = kernel.streamExecute(
                userMsg || "Proceed with attachment analysis.", 
                activeModel.id, 
                noteContext, 
                attachment,
                { signal } 
            );
            
            let accumulatedText = "";
            let chunkCount = 0;

            for await (const chunk of stream) {
                if (signal.aborted) throw new Error("ABORTED_BY_USER");

                if (chunk.text) {
                    accumulatedText += chunk.text;
                    chunkCount++;
                }

                if (chunk.functionCall) {
                    const toolName = chunk.functionCall.name;
                    accumulatedText += `\n\n> ⚙️ **EXECUTING:** ${toolName.replace(/_/g, ' ').toUpperCase()}...\n`;
                    
                    // Update UI with progress
                    storage.updateMessage(targetId, modelMessageId, { text: accumulatedText });

                    try {
                        const toolResult = await executeNeuralTool(chunk.functionCall, notes, setNotes);
                         if (toolResult.includes('![Generated Visual]') || toolResult.trim().startsWith('![')) {
                             accumulatedText += `\n\n${toolResult}\n\n`;
                        } else {
                             accumulatedText += `> ✅ **RESULT:** ${toolResult}\n\n`;
                        }
                    } catch (toolError: any) {
                        accumulatedText += `> ❌ **FAIL:** ${toolError.message}\n\n`;
                    }
                    chunkCount++;
                }

                // Stream Update
                storage.updateMessage(targetId, modelMessageId, { 
                    text: accumulatedText,
                    metadata: { 
                        ...(chunk.metadata || {}),
                        groundingChunks: chunk.groundingChunks
                    }
                });
            }

            // Fallback for empty
            if (!accumulatedText.trim() && chunkCount === 0) {
                accumulatedText = persona === 'hanisah' 
                    ? "_ (tersenyum) _\n\n*Hmm, aku blank bentar. Coba tanya lagi?*" 
                    : "> **NULL OUTPUT DETECTED**\n\nThe logic stream yielded no data. Refine parameters.";
                storage.updateMessage(targetId, modelMessageId, { text: accumulatedText });
            }

            // TTS Trigger
            if (isAutoSpeak && accumulatedText) {
                speakWithHanisah(accumulatedText.replace(/[*#_`]/g, ''), persona === 'hanisah' ? 'Hanisah' : 'Fenrir');
            }

        } catch (err: any) {
             console.error(`[${transmissionId}] ERROR:`, err);
             let errorText = "";
             if (err.message === "ABORTED_BY_USER" || err.name === "AbortError") {
                errorText = `\n\n> 🛑 **INTERRUPTED**`;
             } else {
                 const persona = activeThread.persona || 'stoic';
                 errorText = persona === 'hanisah' 
                    ? `\n\n_ (Menggaruk kepala) _\n*Aduh, maaf banget sayang. Sinyalnya lagi ngajak berantem nih.*` 
                    : `\n\n> **SYSTEM ANOMALY DETECTED**\n\nProcessing stream interrupted.`;
             }
             // Append error to whatever text we got
             storage.updateMessage(targetId, modelMessageId, { 
                 text: (prev: any) => (prev.text || '') + errorText, // functional update simulation logic handled in store
                 metadata: { status: 'success' } // Mark as success so it renders, just with error text
             });
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
            console.groupEnd();
        }
    }, [activeThread, notes, isVaultUnlocked, vaultEnabled, isAutoSpeak, setNotes, storage]);

    return {
        isLoading,
        stopGeneration,
        streamMessage
    };
};
