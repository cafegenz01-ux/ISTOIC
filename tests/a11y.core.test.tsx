import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MobileNav } from '../components/MobileNav';
import { LiveMiniPlayer } from '../components/LiveMiniPlayer';
import { ChatWindow } from '../features/aiChat/components/ChatWindow';

expect.extend(toHaveNoViolations);

// Mock react-virtuoso similar to other tests
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

// Mock LiveSessionContext hook
vi.mock('../contexts/LiveSessionContext', async () => {
  const original = await vi.importActual('../contexts/LiveSessionContext');
  return {
    ...original,
    useLiveSession: () => ({
      isLive: true,
      isMinimized: true,
      status: 'ACTIVE',
      stopSession: vi.fn(),
      toggleMinimize: vi.fn(),
      activeTool: 'TEST_TOOL',
      analyser: null
    })
  };
});

describe('Core accessibility smoke tests', () => {
  afterEach(() => cleanup());

  it('MobileNav has no detectable a11y violations', async () => {
    const { container } = render(<MobileNav activeFeature={"dashboard" as any} setActiveFeature={() => {}} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('LiveMiniPlayer has no detectable a11y violations', async () => {
    const { container } = render(<LiveMiniPlayer />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('ChatWindow has no detectable a11y violations', async () => {
    const messages = [
      { id: '1', role: 'user', text: 'Hello', metadata: { createdAt: new Date().toISOString(), status: 'success' } },
      { id: '2', role: 'model', text: 'World', metadata: { createdAt: new Date().toISOString(), status: 'success' } }
    ];

    const { container } = render(
      <ChatWindow messages={messages as any} personaMode="hanisah" isLoading={false} messagesEndRef={React.createRef()} onRetry={() => {}} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
