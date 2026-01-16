import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup, waitFor } from '@testing-library/react';
import { LiveSessionProvider, useLiveSession } from '../contexts/LiveSessionContext';

vi.mock('../services/neuralLink', () => {
  return {
    NeuralLinkService: class {
      connect = vi.fn(async (config: any) => {
        config.onStatusChange('ACTIVE');
      });
      disconnect = vi.fn(() => {});
      analyser = null;
      switchVoice = vi.fn();
      setMicMode = vi.fn();
    }
  };
});

vi.mock('../services/melsaBrain', () => ({
  HANISAH_BRAIN: { getSystemInstruction: vi.fn(async () => 'instruction') }
}));

vi.mock('../features/aiChat/services/toolHandler', () => ({
  executeNeuralTool: vi.fn(async () => 'ok')
}));

const Harness: React.FC<{ onReady: (api: any) => void }> = ({ onReady }) => {
  const session = useLiveSession();
  React.useEffect(() => {
    onReady(session);
  }, [session, onReady]);
  return null;
};

afterEach(() => cleanup());

describe('LiveSession state machine', () => {
  it('transitions from idle to active and back to idle', async () => {
    let api: any;
    render(
      <LiveSessionProvider notes={[]} setNotes={() => {}}>
        <Harness onReady={(ctx) => (api = ctx)} />
      </LiveSessionProvider>
    );

    await act(async () => {
      await api.startSession('hanisah');
    });

    await waitFor(() => expect(api.status).toBe('ACTIVE'));
    expect(api.isLive).toBe(true);

    act(() => {
      api.stopSession();
    });

    await waitFor(() => expect(api.status).toBe('IDLE'));
    expect(api.isLive).toBe(false);
  });
});
