import { useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { STOIC_KERNEL as SK } from '../../../services/stoicKernel';
import { MODEL_CATALOG, HANISAH_KERNEL as HK } from '../../../services/melsaKernel';
import { executeNeuralTool } from '../services/toolHandler';
import { speakWithHanisah } from '../../../services/elevenLabsService';
import type { Note } from '../../../types';

type StreamErrorType = 'abort' | 'network' | 'rate_limit' | 'unknown';
type AbortReason = 'user' | 'replace' | 'cleanup';

interface StreamRequest {
  prompt: string;
  activeModel: (typeof MODEL_CATALOG)[number];
  threadId: string;
  persona: 'hanisah' | 'stoic';
  attachment?: { data: string; mimeType: string };
  retryMessageId?: string;
}

interface StreamResult {
  messageId: string;
  errorType?: StreamErrorType;
}

export const useAIStream = ({
  notes,
  setNotes,
  addMessage,
  updateMessage,
  isAutoSpeak,
  imageModelId
}: {
  notes: Note[];
  setNotes: (notes: Note[]) => void;
  addMessage: (threadId: string, message: any) => void;
  updateMessage: (threadId: string, messageId: string, updates: any) => void;
  isAutoSpeak: boolean;
  imageModelId: string;
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const abortReasonRef = useRef<AbortReason | null>(null);
  const flushTimeoutRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef<{
    threadId: string;
    messageId: string;
    text: string;
    metadata?: Record<string, unknown>;
  } | null>(null);

  const flushPending = useCallback(() => {
    if (pendingUpdateRef.current) {
      const pending = pendingUpdateRef.current;
      updateMessage(pending.threadId, pending.messageId, {
        text: pending.text,
        metadata: pending.metadata
      });
      pendingUpdateRef.current = null;
    }
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
  }, [updateMessage]);

  const scheduleUpdate = useCallback(
    (threadId: string, messageId: string, text: string, metadata?: Record<string, unknown>) => {
      pendingUpdateRef.current = { threadId, messageId, text, metadata };
      if (flushTimeoutRef.current !== null) return;

      flushTimeoutRef.current = window.setTimeout(() => {
        flushTimeoutRef.current = null;
        flushPending();
      }, 45);
    },
    [flushPending]
  );

  const stopGeneration = useCallback(
    (reason: AbortReason = 'user') => {
      if (abortControllerRef.current) {
        abortReasonRef.current = reason;
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      flushPending();
      setIsLoading(false);
    },
    [flushPending]
  );

  useEffect(() => {
    return () => stopGeneration('cleanup');
  }, [stopGeneration]);

  const resolveErrorType = (err: unknown): StreamErrorType => {
    if (!err) return 'unknown';
    const message = typeof err === 'string' ? err : (err as any)?.message || '';
    if ((err as any)?.name === 'AbortError' || message === 'ABORTED_BY_USER') return 'abort';
    if (String(message).includes('429')) return 'rate_limit';
    if (String(message).toLowerCase().includes('network') || String(message).includes('Failed to fetch')) return 'network';
    return 'unknown';
  };

  const appendToolResult = useCallback(
    async (chunk: any, accumulatedText: string, threadId: string, messageId: string) => {
      const toolName = chunk.functionCall?.name || 'tool';
      let nextText = `${accumulatedText}\n\n> Executing: ${toolName.replace(/_/g, ' ')}`;
      scheduleUpdate(threadId, messageId, nextText, { status: 'success' });

      try {
        const result = await executeNeuralTool(chunk.functionCall, notes, setNotes, imageModelId);
        const formatted = result.trim().startsWith('![') ? `\n\n${result}` : `\n\n${result}`;
        nextText = `${nextText}${formatted}`;
      } catch (toolError: any) {
        nextText = `${nextText}\n\n> Tool failed: ${toolError?.message || 'Unknown issue.'}`;
      }

      return nextText;
    },
    [imageModelId, notes, scheduleUpdate, setNotes]
  );

  const streamMessage = useCallback(
    async ({ prompt, activeModel, threadId, persona, attachment, retryMessageId }: StreamRequest): Promise<StreamResult> => {
      stopGeneration('replace');
      const modelMessageId = retryMessageId || uuidv4();
      const baseMetadata = {
        status: 'loading',
        model: activeModel.id,
        provider: activeModel.provider
      };

      if (retryMessageId) {
        updateMessage(threadId, retryMessageId, { text: '', metadata: baseMetadata });
      } else {
        addMessage(threadId, {
          id: modelMessageId,
          role: 'model',
          text: '',
          metadata: baseMetadata
        });
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      abortReasonRef.current = null;
      const signal = controller.signal;
      setIsLoading(true);

      let accumulatedText = '';
      let errorType: StreamErrorType | undefined;

      try {
        const kernel = persona === 'hanisah' ? HK : SK;
        const stream = kernel.streamExecute(
          prompt || 'Proceed with attachment analysis.',
          activeModel.id,
          notes,
          attachment,
          { signal }
        );

        for await (const chunk of stream) {
          if (signal.aborted) {
            throw new DOMException('ABORTED_BY_USER', 'AbortError');
          }

          if (chunk.text) {
            const nextText = String(chunk.text);
            const appendText = nextText.startsWith(accumulatedText) ? nextText.slice(accumulatedText.length) : nextText;
            accumulatedText += appendText;
          }

          if (chunk.functionCall) {
            accumulatedText = await appendToolResult(chunk, accumulatedText, threadId, modelMessageId);
          }

          const metadataPatch = {
            ...chunk.metadata,
            groundingChunks: chunk.groundingChunks,
            status: 'success',
            model: activeModel.id,
            provider: activeModel.provider
          };

          if (accumulatedText || chunk.metadata || chunk.groundingChunks) {
            scheduleUpdate(threadId, modelMessageId, accumulatedText, metadataPatch);
          }
        }

        if (!accumulatedText.trim()) {
          accumulatedText =
            persona === 'hanisah'
              ? 'Aku tidak menemukan jawaban yang jelas. Coba tanyakan lagi dengan detail berbeda.'
              : 'No response received. Refine the prompt and try again.';
          scheduleUpdate(threadId, modelMessageId, accumulatedText, {
            status: 'success',
            model: activeModel.id,
            provider: activeModel.provider
          });
        }

        if (isAutoSpeak && accumulatedText) {
          speakWithHanisah(accumulatedText.replace(/[*#_`]/g, ''), persona === 'hanisah' ? 'Hanisah' : 'Fenrir');
        }

        return { messageId: modelMessageId };
      } catch (err) {
        errorType = resolveErrorType(err);
        const isAbort = errorType === 'abort';
        const friendlyMessage =
          errorType === 'rate_limit'
            ? 'We are hitting a temporary limit. Please wait a few seconds and retry.'
            : errorType === 'network'
              ? 'Network interrupted. Check your connection and retry.'
              : isAbort
                ? 'Response cancelled.'
                : 'Something went wrong while generating the reply.';

        const retryContext = {
          prompt,
          attachment,
          persona,
          modelId: activeModel.id,
          threadId
        };

        const showAbortMessage = isAbort && abortReasonRef.current === 'user';
        const finalText = showAbortMessage
          ? `${accumulatedText}${accumulatedText ? '\n\n' : ''}${friendlyMessage}`
          : accumulatedText;

        scheduleUpdate(threadId, modelMessageId, finalText, {
          status: isAbort ? 'success' : 'error',
          errorType,
          retryContext,
          model: activeModel.id,
          provider: activeModel.provider
        });

        return { messageId: modelMessageId, errorType };
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
        abortReasonRef.current = null;
        flushPending();
      }
    },
    [addMessage, appendToolResult, flushPending, isAutoSpeak, notes, scheduleUpdate, setNotes, stopGeneration]
  );

  return {
    isLoading,
    stopGeneration,
    streamMessage
  };
};
