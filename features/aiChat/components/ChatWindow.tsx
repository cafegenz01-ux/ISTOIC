import React, { memo, useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Markdown from 'react-markdown';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { Flame, Brain, Copy, Check, AlertTriangle, CheckCheck, Clock, ChevronDown } from 'lucide-react';
import type { ChatMessage } from '../../../types';
import { AIProviderInfo } from './AIProviderInfo';
import { generateImage } from '../../../services/geminiService';

type RetryContext = {
  prompt: string;
  attachment?: { data: string; mimeType: string };
  persona?: 'hanisah' | 'stoic';
  modelId?: string;
  threadId?: string;
};

const TypingIndicator = ({ personaMode }: { personaMode: 'hanisah' | 'stoic' }) => (
  <div className="flex justify-start mb-5 px-3 md:px-6 animate-fade-in w-full gap-3">
    <div className="flex flex-col gap-2 shrink-0 mt-1">
      <div className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center shadow-[var(--shadow-soft)] border border-[color:var(--border)]/50 bg-[var(--surface-2)] text-[var(--accent)]">
        {personaMode === 'hanisah' ? <Flame size={18} strokeWidth={2.2} /> : <Brain size={18} strokeWidth={2.2} />}
      </div>
    </div>
    <div className="bg-[var(--surface)] border border-[color:var(--border)]/50 rounded-[var(--bento-radius)] px-5 py-4 flex items-center gap-2 shadow-[var(--shadow-soft)] h-[46px]">
      <div className="w-2 h-2 bg-[var(--accent)] rounded-full animate-bounce [animation-delay:-0.3s]" style={{opacity: 0.8}}></div>
      <div className="w-2 h-2 bg-[var(--accent)] rounded-full animate-bounce [animation-delay:-0.15s]" style={{opacity: 0.6}}></div>
      <div className="w-2 h-2 bg-[var(--accent)] rounded-full animate-bounce" style={{opacity: 0.4}}></div>
    </div>
  </div>
);

const ImageGenerationCard = ({ prompt }: { prompt: string }) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    setStatus('loading');
    try {
      const result = await generateImage(prompt);
      if (result) {
        setImageUrl(result);
        setStatus('done');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="mt-4 p-4 rounded-2xl border border-[color:var(--border)]/50 bg-gradient-to-br from-[var(--surface)] to-[var(--surface-2)] hover:border-[color:var(--border)] transition-all duration-300 shadow-sm hover:shadow-md">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-semibold text-[var(--accent)] bg-[var(--accent)]/10 px-3 py-1 rounded-lg">Generate Image</span>
        <button
          onClick={handleGenerate}
          disabled={status === 'loading'}
          className="text-[13px] px-4 py-2 rounded-xl border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/15 transition-all duration-200 active:scale-95 disabled:opacity-50 font-medium"
        >
          {status === 'loading' ? '⏳ Processing...' : status === 'done' ? '🔄 Regenerate' : '✨ Generate'}
        </button>
      </div>
      <p className="text-[13px] text-[var(--text)] opacity-85 mb-3 italic">"{prompt}"</p>
      {imageUrl && <img src={imageUrl} alt={prompt} className="w-full rounded-xl border border-[color:var(--border)] shadow-md hover:shadow-lg transition-all duration-300 max-h-80 object-cover" />}
      {status === 'error' && <p className="text-[13px] text-[var(--danger)] mt-2 font-medium">❌ Image generation failed. Try again.</p>}
    </div>
  );
};

const MessageBubble = memo(
  ({
    msg,
    personaMode,
    isStreaming,
    onRetry
  }: {
    msg: ChatMessage;
    personaMode: 'hanisah' | 'stoic';
    isStreaming: boolean;
    onRetry?: (messageId: string, retryContext: RetryContext) => void;
  }) => {
    const [copied, setCopied] = useState(false);
    const [showThought, setShowThought] = useState(false);

    const isModel = msg.role === 'model' || (msg.role as string) === 'assistant';
    const isError = msg.metadata?.status === 'error';
    const retryContext = msg.metadata?.retryContext as RetryContext | undefined;

    const textContent: string = useMemo(() => {
      if (typeof msg.text === 'string') return msg.text;
      return '';
    }, [msg.text]);

    const { thought, content, imagePrompt } = useMemo(() => {
      let text = textContent;
      let thoughtContent: string | null = null;
      if (text.includes('<think>')) {
        const hasClosing = text.includes('</think>');
        if (hasClosing) {
          const parts = text.split('</think>');
          thoughtContent = parts[0].replace('<think>', '').trim();
          text = parts[1]?.trim() || '';
        } else {
          thoughtContent = text.replace('<think>', '').trim();
          text = '';
        }
      }

      let imagePrompt: string | null = null;
      const imgMatch = text.match(/!!IMG:(.*?)!!/);
      if (imgMatch) {
        imagePrompt = imgMatch[1]?.trim() || null;
        text = text.replace(imgMatch[0], '').trim();
      }

      return { thought: thoughtContent, content: text, imagePrompt };
    }, [textContent]);

    const timestamp = useMemo(() => {
      if (msg.metadata?.createdAt) {
        return new Date(msg.metadata.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, [msg.metadata?.createdAt]);

    const inlineCodeClass = isModel
      ? 'bg-[var(--surface-2)] text-[var(--accent)] border border-[color:var(--border)]/30'
      : 'bg-white/20 text-[var(--text-invert)] border border-white/10';
    const proseTextClass = isModel ? 'text-[var(--text)]' : 'text-white prose-invert';

    // Memoize markdown components to prevent re-renders
    const markdownComponents = useMemo(() => ({
      a: ({ children, href }: any) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={
            isModel
              ? 'text-[var(--accent)] underline decoration-[var(--accent)]/60 hover:decoration-[var(--accent)] transition-all duration-200 font-medium'
              : 'text-[var(--text-invert)] underline decoration-white/60 hover:decoration-white transition-all duration-200 font-medium'
          }
        >
          {children}
        </a>
      ),
      blockquote: ({ children }: any) => (
        <blockquote className={`border-l-4 pl-4 py-1 my-3 ${isModel ? 'border-[var(--accent)]/40 text-[var(--text-muted)]' : 'border-white/40 text-white/80'} italic`}>
          {children}
        </blockquote>
      ),
      code: ({ inline, className, children, ...props }: any) => {
        if (inline) {
          return (
            <code 
              className={`px-2 py-1 rounded-lg text-[12px] font-semibold ${inlineCodeClass}`} 
              {...props}
            >
              {children}
            </code>
          );
        }
        const lang = /language-(\w+)/.exec(className || '');
        return (
          <pre className="bg-[var(--surface-2)] border border-[color:var(--border)]/50 rounded-[var(--radius-md)] p-4 overflow-x-auto text-[13px] my-3 shadow-[var(--shadow-soft)] max-w-full">
            <code className={lang ? `language-${lang[1]}` : ''}>
              {children}
            </code>
          </pre>
        );
      },
      ul: ({ children }: any) => (
        <ul className="list-disc pl-5 my-2 space-y-1">
          {children}
        </ul>
      ),
      ol: ({ children }: any) => (
        <ol className="list-decimal pl-5 my-2 space-y-1">
          {children}
        </ol>
      ),
      li: ({ children }: any) => (
        <li className="my-1">
          {children}
        </li>
      ),
      h1: ({ children }: any) => <h1 className="text-xl font-bold my-3">{children}</h1>,
      h2: ({ children }: any) => <h2 className="text-lg font-bold my-3">{children}</h2>,
      h3: ({ children }: any) => <h3 className="text-base font-bold my-2">{children}</h3>,
      p: ({ children }: any) => <p className="my-2">{children}</p>
    }), [isModel, inlineCodeClass]);

    const handleCopy = () => {
      if (content) {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    };

    if (isModel && !content && !isStreaming && !thought && !isError) return null;

    const bubbleClasses = isModel
      ? 'bg-[var(--surface)] text-[var(--text)] border border-[color:var(--border)]/50 shadow-[var(--shadow-soft)] rounded-[var(--bento-radius)]'
      : 'bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-[var(--text-invert)] border border-[color:var(--accent)]/30 shadow-[var(--shadow-bento)] rounded-[var(--bento-radius)]';

    return (
      <div className={`flex w-full mb-6 ${isModel ? 'justify-start' : 'justify-end'} px-3 md:px-6 animate-fade-in gap-3`}>
        {isModel && (
          <div className="flex flex-col gap-2 shrink-0 mt-1">
            <div className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center shadow-[var(--shadow-soft)] border border-[color:var(--border)]/50 bg-[var(--surface-2)] text-[var(--accent)]">
              {isError ? <AlertTriangle size={18} strokeWidth={2.2} /> : personaMode === 'hanisah' ? <Flame size={18} strokeWidth={2.2} /> : <Brain size={18} strokeWidth={2.2} />}
            </div>
          </div>
        )}

        <div className={`flex flex-col max-w-[92%] sm:max-w-[82%] lg:max-w-[72%] min-w-0 flex-1 ${isModel ? 'items-start' : 'items-end'}`}>
          <div className={`flex items-start gap-3 ${isModel ? 'flex-row' : 'flex-row-reverse'}`}>
            <div className={`relative px-5 py-4 md:px-6 md:py-5 text-[15px] leading-relaxed ${bubbleClasses}`}>
              {thought && (
                <button
                  className="flex items-center gap-2 text-[13px] font-semibold text-[var(--accent)] mb-3 px-3 py-2 bg-[var(--accent)]/10 rounded-lg w-full hover:bg-[var(--accent)]/20 transition-all duration-200"
                  onClick={() => setShowThought((prev) => !prev)}
                  aria-expanded={showThought}
                >
                  <ChevronDown size={16} className={`transition-transform duration-300 ${showThought ? 'rotate-180' : ''}`} />
                  <span>Reasoning Process</span>
                </button>
              )}
              {thought && showThought && (
                <div className="mb-4 p-4 rounded-xl bg-[var(--surface-2)]/50 border border-[color:var(--border)]/30 text-[13px] text-[var(--text-muted)] whitespace-pre-wrap font-mono opacity-90">
                  {thought}
                </div>
              )}

              {content && (
                <div className={`prose prose-sm max-w-none break-words ${proseTextClass} prose-p:leading-relaxed prose-li:leading-relaxed prose-headings:mt-3 prose-headings:mb-2 prose-p:my-2`}>
                  <Markdown components={markdownComponents}>
                    {content}
                  </Markdown>
                  {isStreaming && isModel && <span className="inline-block w-2.5 h-5 bg-[var(--accent)] align-middle ml-1.5 animate-pulse rounded-sm"></span>}
                </div>
              )}

              {imagePrompt && <ImageGenerationCard prompt={imagePrompt} />}

              {isError && retryContext && onRetry && (
                <div className="mt-4">
                  <button
                    onClick={() => onRetry(msg.id, retryContext)}
                    className="px-4 py-2 rounded-xl border border-[color:var(--danger)] text-[var(--danger)] text-[13px] font-semibold hover:bg-[var(--danger)]/10 transition-all duration-200 active:scale-95"
                  >
                    🔄 Retry
                  </button>
                </div>
              )}
            </div>

            {isModel && content && (
              <button
                onClick={handleCopy}
                className="p-2.5 rounded-[var(--radius-md)] hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-all duration-200 shrink-0 self-start hover:shadow-[var(--shadow-soft)] border border-transparent hover:border-[color:var(--border)]/30"
                title="Copy text"
              >
                {copied ? <Check size={16} className="text-[var(--success)]" /> : <Copy size={16} />}
              </button>
            )}
          </div>

          <div className={`flex items-center gap-3 mt-2.5 px-2 select-none ${isModel ? 'justify-start' : 'justify-end'}`}>
            {isModel && (
              <AIProviderInfo
                metadata={msg.metadata}
                isHydra={!!(msg.metadata?.model === 'auto-best' || msg.metadata?.model?.toString().toUpperCase().includes('HYDRA'))}
                className="mt-0"
              />
            )}

            <div className="flex items-center gap-2 opacity-75 text-[12px] text-[var(--text-muted)] font-medium">
              <span>{timestamp}</span>
              {!isModel && (
                <>
                  {(msg.metadata?.status === 'success' || !msg.metadata?.status) && <CheckCheck size={14} className="text-[var(--success)]" />}
                  {msg.metadata?.status === 'loading' && <Clock size={14} className="animate-spin text-[var(--accent)]" />}
                  {msg.metadata?.status === 'error' && <AlertTriangle size={14} className="text-[var(--danger)]" />}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  },
  (prev, next) => {
    const getVal = (m: ChatMessage): string => {
      const textVal = m.text;
      if (typeof textVal === 'string') return textVal;
      return '';
    };
    const prevText = getVal(prev.msg);
    const nextText = getVal(next.msg);

    const prevMeta = JSON.stringify(prev.msg.metadata);
    const nextMeta = JSON.stringify(next.msg.metadata);

    return prevText === nextText && prev.isStreaming === next.isStreaming && prevMeta === nextMeta;
  }
);

const itemKey = (index: number, item: any) => item.id || index;

interface ChatWindowProps {
  messages: ChatMessage[];
  personaMode: 'hanisah' | 'stoic';
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onRetry?: (messageId: string, retryContext: RetryContext) => void;
  onAtBottomChange?: (atBottom: boolean) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = memo(
  ({ messages, personaMode, isLoading, messagesEndRef, onRetry, onAtBottomChange }) => {
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const isAutoScrolling = useRef(true);
    const lastMessageCountRef = useRef(messages.length);

    // Auto-scroll logic: smooth scroll when near bottom and new message arrives
    useEffect(() => {
      if (isAtBottom && messages.length > lastMessageCountRef.current) {
        requestAnimationFrame(() => {
          virtuosoRef.current?.scrollToIndex({
            index: messages.length - 1,
            behavior: 'smooth',
            align: 'end'
          });
        });
      }
      lastMessageCountRef.current = messages.length;
    }, [messages.length, isAtBottom]);

    const allItems = useMemo(() => {
      if (isLoading) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === 'user') {
          return [...messages, { id: 'loading-indicator', role: 'model', text: '', isLoader: true } as any];
        }
      }
      return messages;
    }, [messages, isLoading]);

    const contextValue = useMemo(
      () => ({
        personaMode,
        isLoading,
        onRetry
      }),
      [personaMode, isLoading, onRetry]
    );

    const Footer = useMemo(() => {
      return () => <div className="h-4" ref={messagesEndRef} />;
    }, [messagesEndRef]);

    const handleAtBottomChange = useCallback(
      (atBottom: boolean) => {
        setIsAtBottom(atBottom);
        isAutoScrolling.current = atBottom;
        onAtBottomChange?.(atBottom);
      },
      [onAtBottomChange]
    );

    return (
      <div className="h-full w-full min-h-0 flex-1 flex flex-col relative bg-[var(--bg)]" style={{ overscrollBehavior: 'contain' }}>
        <Virtuoso
          ref={virtuosoRef}
          style={{ height: '100%', width: '100%' }}
          data={allItems}
          context={contextValue}
          followOutput={isAtBottom ? 'smooth' : false}
          atBottomStateChange={handleAtBottomChange}
          alignToBottom
          atBottomThreshold={120}
          components={{
            Footer: Footer
          }}
          increaseViewportBy={{ top: 200, bottom: 400 }}
          computeItemKey={itemKey}
          itemContent={(index, msg, ctx) => {
            if ((msg as any).isLoader) {
              return (
                <div className="pb-2">
                  <TypingIndicator personaMode={ctx.personaMode} />
                </div>
              );
            }
            const isLast = index === allItems.length - 1;

            return (
              <div className="py-2 px-2 md:px-4 w-full">
                <MessageBubble
                  key={msg.id || index}
                  msg={msg}
                  personaMode={ctx.personaMode}
                  isStreaming={ctx.isLoading && isLast}
                  onRetry={ctx.onRetry}
                />
              </div>
            );
          }}
        />
      </div>
    );
  }
);





