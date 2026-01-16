import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAIStream } from '../features/aiChat/hooks/useAIStream';

const mockStreamExecute = vi.fn();

vi.mock('../services/stoicKernel', () => ({
  STOIC_KERNEL: {
    streamExecute: (...args: any[]) => mockStreamExecute(...args)
  }
}));

vi.mock('../services/melsaKernel', () => ({
  HANISAH_KERNEL: {
    streamExecute: (...args: any[]) => mockStreamExecute(...args)
  },
  MODEL_CATALOG: [{ id: 'model-1', name: 'Model One', provider: 'TEST' }]
}));

vi.mock('../features/aiChat/services/toolHandler', () => ({
  executeNeuralTool: vi.fn()
}));

vi.mock('../services/elevenLabsService', () => ({
  speakWithHanisah: vi.fn()
}));

describe('useAIStream', () => {
  const storage = {
    addMessage: vi.fn(),
    updateMessage: vi.fn()
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockStreamExecute.mockReset();
    storage.addMessage.mockReset();
    storage.updateMessage.mockReset();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('deduplicates identical chunks', async () => {
    mockStreamExecute.mockImplementation(async function* () {
      yield { text: 'hello' };
      yield { text: 'hello' };
    });

    const { result } = renderHook(() =>
      useAIStream({ notes: [], setNotes: vi.fn(), storage, isAutoSpeak: false, imageModelId: 'hydra' })
    );

    await act(async () => {
      await result.current.streamMessage({
        prompt: 'hi',
        activeModel: { id: 'model-1', name: 'Model One', provider: 'TEST' } as any,
        threadId: 't1',
        persona: 'hanisah'
      });
      await vi.runAllTimersAsync();
    });

    const textUpdates = storage.updateMessage.mock.calls.map((call) => call[2]?.text).filter(Boolean);
    expect(textUpdates[textUpdates.length - 1]).toBe('hello');
  });

  it('marks aborted streams with errorType abort', async () => {
    mockStreamExecute.mockImplementation(async function* (_msg: string, _modelId: string, _notes: any, _att: any, opts: any) {
      if (opts?.signal?.aborted) throw new DOMException('ABORTED_BY_USER', 'AbortError');
      yield { text: 'chunk' };
      while (!opts?.signal?.aborted) {
        await new Promise((res) => setTimeout(res, 20));
      }
      throw new DOMException('ABORTED_BY_USER', 'AbortError');
    });

    const { result } = renderHook(() =>
      useAIStream({ notes: [], setNotes: vi.fn(), storage, isAutoSpeak: false, imageModelId: 'hydra' })
    );

    const streamPromise = result.current.streamMessage({
      prompt: 'stop soon',
      activeModel: { id: 'model-1', name: 'Model One', provider: 'TEST' } as any,
      threadId: 't1',
      persona: 'stoic'
    });

    act(() => {
      result.current.stopGeneration();
    });

    await vi.runAllTimersAsync();
    await act(async () => {
      await streamPromise;
    });

    const metaUpdate = storage.updateMessage.mock.calls
      .map((call) => call[2]?.metadata as any)
      .find((m) => m?.errorType);
    expect(metaUpdate?.errorType).toBe('abort');
    expect(result.current.isLoading).toBe(false);
  });
});
