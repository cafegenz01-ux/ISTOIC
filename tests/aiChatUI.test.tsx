import React, { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ChatWindow } from '../features/aiChat/components/ChatWindow';
import { ChatInput } from '../features/aiChat/components/ChatInput';

vi.mock('react-virtuoso', () => {
  const React = require('react');
  const Virtuoso = React.forwardRef(({ data, itemContent, context }: any, ref: any) => (
    <div data-testid="virtuoso" ref={ref}>
      {data.map((item: any, index: number) => (
        <div key={item.id || index}>{itemContent(index, item, context)}</div>
      ))}
    </div>
  ));
  Virtuoso.displayName = 'VirtuosoMock';
  return {
    Virtuoso,
    VirtuosoHandle: class {}
  };
});

afterEach(() => cleanup());

describe('ChatWindow', () => {
  it('renders messages and triggers retry', () => {
    const retry = vi.fn();
    const messages = [
      { id: '1', role: 'user', text: 'Hi', metadata: { createdAt: new Date().toISOString(), status: 'success' } },
      {
        id: '2',
        role: 'model',
        text: 'Failed response',
        metadata: { status: 'error', retryContext: { prompt: 'Hi again', threadId: 't1' } }
      }
    ];

    render(<ChatWindow messages={messages as any} personaMode="hanisah" isLoading={false} messagesEndRef={React.createRef()} onRetry={retry} />);

    expect(screen.getByText('Hi')).toBeInTheDocument();
    expect(screen.getByText('Failed response')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Retry'));
    expect(retry).toHaveBeenCalledWith('2', expect.objectContaining({ prompt: 'Hi again' }));
  });
});

describe('ChatInput', () => {
  const baseProps = {
    isLoading: false,
    onSubmit: vi.fn(),
    onStop: vi.fn(),
    onNewChat: vi.fn(),
    onFocusChange: vi.fn(),
    aiName: 'TEST',
    isVaultSynced: true,
    onToggleVaultSync: vi.fn(),
    personaMode: 'hanisah' as const,
    isVaultEnabled: true,
    onPollinations: vi.fn(),
    disableVisuals: false
  };

  const Harness: React.FC<{ onSubmit?: any }> = ({ onSubmit = baseProps.onSubmit }) => {
    const [input, setInput] = useState('');
    return <ChatInput {...baseProps} onSubmit={onSubmit} input={input} setInput={setInput} />;
  };

  it('submits text input', () => {
    const submit = vi.fn();
    render(<Harness onSubmit={submit} />);

    const textarea = screen.getByLabelText(/chat input/i);
    fireEvent.change(textarea, { target: { value: 'Hello world' } });
    fireEvent.click(screen.getByLabelText(/send message/i));

    expect(submit).toHaveBeenCalled();
  });
});
