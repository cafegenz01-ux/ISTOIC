
import React, { memo, useState, useMemo, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { 
    Flame, Brain, ExternalLink, ArrowRight, Copy, Check, ChevronDown,
    Image as ImageIcon, RefreshCw, Search,
    Network, BrainCircuit, Infinity, AlertTriangle, CheckCheck, Clock,
    ClipboardCopy
} from 'lucide-react';
import type { ChatMessage } from '../../../types';
import { generateImage } from '../../../services/geminiService';
import { AIProviderInfo } from './AIProviderInfo';

// --- TYPES & SUB-COMPONENTS (Keep existing helpers like ThinkingAccordion, etc.) ---
// ... (imports are same as existing, just ensuring ChatWindow has the Copy logic)

const SystemStatusBubble = ({ status }: { status: string }) => (
    <div className="flex items-center gap-2.5 my-2 px-4 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-500 w-fit animate-slide-up">
        <div className="relative">
            <Network size={14} className="relative z-10" />
            <div className="absolute inset-0 bg-amber-500 blur-md opacity-20 animate-pulse"></div>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            {status}
            <RefreshCw size={10} className="animate-spin" />
        </span>
    </div>
);

const ThinkingAccordion = ({ content, isActive }: { content: string, isActive?: boolean }) => {
    const [isExpanded, setIsExpanded] = useState(isActive);
    useEffect(() => { if (isActive) setIsExpanded(true); }, [isActive]);
    return (
        <div className={`my-3 rounded-xl overflow-hidden border transition-all duration-500 w-full group/thought ${isActive ? 'border-cyan-500/40 bg-cyan-900/10 shadow-[0_0_25px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/20' : 'border-white/5 bg-black/20'}`}>
            <button onClick={() => setIsExpanded(!isExpanded)} className="w-full flex items-center justify-between px-4 py-3 transition-colors cursor-pointer hover:bg-white/5">
                <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${isActive ? 'bg-cyan-500 text-white animate-pulse shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'bg-white/10 text-neutral-400'}`}>
                        {isActive ? <Infinity size={14} className="animate-spin-slow" /> : <BrainCircuit size={14} />}
                    </div>
                    <div className="flex flex-col items-start leading-none gap-1">
                        <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${isActive ? 'text-cyan-400' : 'text-neutral-500'}`}>{isActive ? 'QUANTUM PROCESSING' : 'COGNITIVE TRACE'}</span>
                    </div>
                </div>
                <div className={`p-1.5 rounded-lg transition-all ${isExpanded ? 'bg-cyan-500/20 text-cyan-400' : 'text-neutral-500'}`}>
                    <ChevronDown size={14} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </button>
            <div className={`transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden ${isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="relative border-t border-white/5 bg-[#050505] p-4 pl-6 overflow-x-auto custom-scroll">
                    <pre className="text-[10px] font-mono leading-[1.8] text-neutral-400 whitespace-pre-wrap font-medium tracking-tight">{content}</pre>
                </div>
            </div>
        </div>
    );
};

const GroundingSources = ({ chunks }: { chunks: any[] }) => {
    if (!chunks || chunks.length === 0) return null;
    return (
        <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5">
            <div className="flex items-center gap-2 mb-2.5">
                <div className="p-1 rounded bg-accent/10 text-accent"><Search size={10} /></div>
                <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">VERIFIED_SOURCES</span>
            </div>
            <div className="flex flex-wrap gap-2">
                {chunks.map((chunk, idx) => {
                    const url = chunk.web?.uri || chunk.maps?.uri;
                    const title = chunk.web?.title || chunk.maps?.title || "Reference";
                    if (!url) return null;
                    return (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/5 hover:border-accent/30 hover:bg-accent/5 transition-all group max-w-full sm:max-w-[240px] active:scale-95">
                            <span className="text-[9px] font-bold text-neutral-400 group-hover:text-accent transition-colors">#{idx + 1}</span>
                            <span className="text-[9px] font-medium text-neutral-600 dark:text-neutral-300 truncate group-hover:text-accent transition-colors flex-1">{title}</span>
                            <ExternalLink size={8} className="text-neutral-400 group-hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </a>
                    );
                })}
            </div>
        </div>
    );
};

const ImageGenerationCard = ({ prompt, messageId, originalText, onUpdateMessage }: { prompt: string, messageId?: string, originalText?: string, onUpdateMessage?: (id: string, text: string) => void }) => {
    const [status, setStatus] = useState<'IDLE'|'GENERATING'|'DONE'|'ERROR'>('IDLE');
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    useEffect(() => {
        if (status === 'IDLE' && onUpdateMessage && messageId && originalText) handleGenerate();
    }, []);

    const handleGenerate = async () => {
        setStatus('GENERATING');
        try {
            const result = await generateImage(prompt);
            if (result) {
                if (onUpdateMessage && messageId && originalText) {
                    const regex = /!!IMG:(.*?)!!/g;
                    const newContent = originalText.replace(regex, `\n\n![Generated Image](${result})\n\n_Visual: ${prompt.slice(0, 40)}..._`);
                    onUpdateMessage(messageId, newContent);
                } else {
                    setImageUrl(result); setStatus('DONE');
                }
            } else setStatus('ERROR');
        } catch (e) { setStatus('ERROR'); }
    };

    return (
        <div className="my-4 rounded-2xl overflow-hidden border border-accent/20 bg-black/40 max-w-sm shadow-[0_0_30px_-10px_rgba(var(--accent-rgb),0.1)] ring-1 ring-accent/10 relative">
            {status === 'GENERATING' && <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center animate-fade-in"><span className="text-[10px] font-black uppercase tracking-[0.2em] text-white animate-pulse">DREAMING...</span></div>}
            <div className="p-3 border-b border-white/5 flex items-center justify-between bg-white/5"><span className="text-[9px] font-black uppercase tracking-widest text-accent flex items-center gap-2"><ImageIcon size={12}/> VISUAL_SYNTHESIS</span></div>
            <div className="p-4">
                <p className="text-[10px] font-mono text-neutral-400 mb-4 line-clamp-3 italic">"{prompt}"</p>
                {status === 'DONE' && imageUrl ? <img src={imageUrl} alt="Generated" className="w-full rounded-xl shadow-lg border border-white/10" /> : status !== 'GENERATING' && <button onClick={handleGenerate} className="w-full py-3 bg-accent text-black font-black uppercase text-[10px] tracking-widest rounded-xl hover:scale-[1.02] active:scale-95 transition-all">{status === 'ERROR' ? 'RETRY' : 'START'}</button>}
            </div>
        </div>
    );
};

const MarkdownImage = ({ src, alt }: { src?: string, alt?: string }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    if (!src) return null;
    return (
        <div className="my-4 relative group/img w-full max-w-md">
            <div className={`relative overflow-hidden rounded-2xl border border-white/10 shadow-lg transition-all cursor-pointer bg-black/20 ${isExpanded ? 'fixed inset-4 z-[9999] m-0 bg-black/95 object-contain flex items-center justify-center' : 'active:scale-[0.98]'}`} onClick={() => setIsExpanded(!isExpanded)}>
                <img src={src} alt={alt} className={`transition-opacity duration-500 ${isExpanded ? 'max-h-full max-w-full object-contain' : 'w-full h-auto max-h-[400px] object-cover'}`} />
                {isExpanded && <button className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur z-50"><ArrowRight size={24} className="rotate-45" /></button>}
            </div>
        </div>
    );
};

const CodeBlock = ({ language, children }: { language: string, children: React.ReactNode }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => { navigator.clipboard.writeText(String(children)); setCopied(true); setTimeout(() => setCopied(false), 2000); };
    return (
        <div className="relative my-4 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-[#0e0e10]">
            <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/5 backdrop-blur-md">
                <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">{language || 'TEXT'}</span>
                <button onClick={handleCopy} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all">{copied ? <Check size={12} className="text-emerald-500"/> : <Copy size={12} className="text-neutral-400"/>}</button>
            </div>
            <div className="p-4 overflow-x-auto custom-scroll bg-[#050505]"><code className="language-text block text-[11px] font-mono text-neutral-300 whitespace-pre">{children}</code></div>
        </div>
    );
};

const TypingIndicator = ({ personaMode }: { personaMode: 'hanisah' | 'stoic' }) => {
    return (
        <div className="flex justify-start mb-6 px-1 animate-fade-in w-full">
            <div className="flex flex-col gap-2 mr-3 shrink-0 mt-1">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-lg border border-white/10 bg-white dark:bg-[#121214] ${personaMode === 'hanisah' ? 'text-orange-500' : 'text-cyan-500'}`}>
                    {personaMode === 'hanisah' ? <Flame size={16} fill="currentColor"/> : <Brain size={16} fill="currentColor"/>}
                </div>
            </div>
            <div className="bg-white dark:bg-[#0a0a0b] border border-black/5 dark:border-white/10 rounded-[24px] rounded-tl-sm px-5 py-4 flex items-center gap-1.5 shadow-sm h-[52px]">
                <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce"></div>
            </div>
        </div>
    );
};

// --- MESSAGE BUBBLE WITH COPY & ACTION CARDS ---
const MessageBubble = memo(({ msg, personaMode, isLoading, onUpdateMessage }: { msg: ChatMessage, personaMode: 'hanisah' | 'stoic', isLoading: boolean, onUpdateMessage?: (id: string, text: string) => void }) => {
    const [copied, setCopied] = useState(false);
    
    const isModel = msg.role === 'model' || (msg.role as string) === 'assistant'; 
    const isUser = !isModel;
    const isError = msg.metadata?.status === 'error';
    const isRerouting = msg.metadata?.isRerouting;
    
    const textContent: string = useMemo(() => {
        const rawText = msg.text;
        if (typeof rawText === 'string' && rawText) return rawText;
        if (rawText instanceof Blob) return ''; 
        const anyMsg = msg as any;
        if (typeof anyMsg.content === 'string') return anyMsg.content;
        if (anyMsg.parts && anyMsg.parts[0]?.text) return anyMsg.parts[0].text; 
        return '';
    }, [msg]);

    const { thought, content, imgPrompt } = useMemo(() => {
        let text = textContent;
        let thoughtContent = null;
        let imagePrompt = null;

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

        const imgMatch = text.match(/!!IMG:(.*?)!!/);
        if (imgMatch) { 
            imagePrompt = imgMatch[1]; 
            text = text.replace(imgMatch[0], ''); 
        }

        return { thought: thoughtContent, content: text, imgPrompt: imagePrompt };
    }, [textContent]);

    const timestamp = useMemo(() => {
        if (msg.metadata?.createdAt) {
            return new Date(msg.metadata.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return '';
    }, [msg.metadata?.createdAt]);

    // SMART COPY FUNCTION
    const handleCopyMessage = () => {
        if (content) {
            // Clean Markdown markers if needed, or copy raw
            navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (isModel && !content && !isLoading && !thought && !isError && !isRerouting && !imgPrompt) {
        return null;
    }

    const accentColor = personaMode === 'hanisah' ? 'text-orange-500' : 'text-cyan-500';

    return (
        <div className={`flex w-full mb-6 md:mb-8 ${isModel ? 'justify-start' : 'justify-end'} px-1 group/msg`}>
            {isModel && (
                <div className="flex flex-col gap-2 mr-3 shrink-0 mt-1">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-lg border border-white/10 bg-white dark:bg-[#121214] ${accentColor}`}>
                        {isError ? <AlertTriangle size={16} /> : (personaMode === 'hanisah' ? <Flame size={16} fill="currentColor"/> : <Brain size={16} fill="currentColor"/>)}
                    </div>
                </div>
            )}

            <div className={`relative max-w-[88%] sm:max-w-[80%] lg:max-w-[75%] flex flex-col ${isModel ? 'items-start' : 'items-end'} min-w-0`}>
                
                <div className={`relative px-5 py-4 overflow-hidden text-sm md:text-[15px] leading-7 font-sans tracking-wide shadow-sm break-words
                    ${isModel 
                        ? 'bg-white dark:bg-[#0a0a0b] text-black dark:text-neutral-200 rounded-[24px] rounded-tl-sm border border-black/5 dark:border-white/10' 
                        : 'bg-zinc-100 dark:bg-white/5 text-black dark:text-white rounded-[24px] rounded-tr-sm border border-black/5 dark:border-white/5'
                    }`}>
                    
                    {isRerouting && msg.metadata?.systemStatus && !content && <SystemStatusBubble status={msg.metadata.systemStatus} />}
                    {thought && <ThinkingAccordion content={thought} isActive={isLoading && !content} />}
                    
                    {content && (
                        <div className={`prose dark:prose-invert prose-sm max-w-none break-words min-w-0 ${isModel ? 'prose-p:text-neutral-800 dark:prose-p:text-neutral-300' : ''} 
                            /* Custom Blockquote Styling for "Action Cards" */
                            prose-blockquote:border-l-4 prose-blockquote:border-accent prose-blockquote:bg-accent/5 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:my-2
                        `}>
                            <Markdown 
                                urlTransform={(url) => url} 
                                components={{
                                    code({node, inline, className, children, ...props}: any) {
                                        const match = /language-(\w+)/.exec(className || '');
                                        return !inline 
                                            ? <CodeBlock language={match ? match[1] : 'text'} children={children} /> 
                                            : <code className="text-[12px] font-mono font-bold px-1.5 py-0.5 rounded border bg-black/5 dark:bg-white/10 border-black/5 dark:border-white/10" {...props}>{children}</code>;
                                    },
                                    a: ({children, href}) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline font-bold inline-flex items-center gap-1 bg-accent/5 px-1.5 rounded transition-colors border border-accent/10">{children} <ArrowRight size={10} className="-rotate-45"/></a>,
                                    img: ({src, alt}) => <MarkdownImage src={src} alt={alt} />,
                                    table: ({children}) => <div className="overflow-x-auto my-4 border border-white/10 rounded-xl"><table className="min-w-full divide-y divide-white/10 text-[12px]">{children}</table></div>,
                                    th: ({children}) => <th className="px-4 py-2 bg-white/5 font-black uppercase tracking-wider text-left">{children}</th>,
                                    td: ({children}) => <td className="px-4 py-2 border-t border-white/5">{children}</td>,
                                    blockquote: ({children}) => <blockquote className="border-l-4 border-l-[var(--accent-color)] bg-[var(--accent-color)]/5 pl-4 py-3 my-2 rounded-r-xl border border-transparent border-l-4 shadow-sm">{children}</blockquote>
                                }}
                            >
                                {content}
                            </Markdown>
                            {isLoading && isModel && <span className="inline-block w-2 h-4 bg-accent align-middle ml-1 animate-[pulse_0.8s_ease-in-out_infinite]"></span>}
                        </div>
                    )}

                    {imgPrompt && <ImageGenerationCard prompt={imgPrompt} messageId={msg.id} originalText={textContent} onUpdateMessage={onUpdateMessage} />}

                    {isLoading && !content && !thought && !imgPrompt && !isRerouting && (
                        <div className="flex items-center gap-2 py-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 animate-pulse">Computing</span>
                            <div className="flex gap-1">
                                <div className="w-1 h-1 bg-accent rounded-full animate-bounce"></div>
                                <div className="w-1 h-1 bg-accent rounded-full animate-bounce delay-75"></div>
                                <div className="w-1 h-1 bg-accent rounded-full animate-bounce delay-150"></div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between mt-2 pt-1 gap-4">
                        <div className="flex-1">
                             {isModel && (
                                <AIProviderInfo 
                                    metadata={msg.metadata} 
                                    isHydra={msg.metadata?.model === 'auto-best' || msg.metadata?.model?.includes('HYDRA')} 
                                    className="mt-0"
                                />
                            )}
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0 opacity-100 select-none">
                             {/* COPY BUTTON: Shows on hover or always on mobile */}
                             {isModel && (
                                 <button 
                                     onClick={handleCopyMessage}
                                     className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-neutral-400 hover:text-accent transition-all md:opacity-0 md:group-hover/msg:opacity-100 focus:opacity-100 opacity-100"
                                     title="Copy Text"
                                 >
                                     {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                 </button>
                             )}

                            <span className="text-[9px] font-mono text-neutral-400">{timestamp}</span>
                            {isUser && (
                                <>
                                    {(msg.metadata?.status === 'success' || !msg.metadata?.status) && <CheckCheck size={12} className="text-neutral-400" />}
                                    {msg.metadata?.status === 'loading' && <Clock size={12} className="animate-pulse text-neutral-400" />}
                                    {msg.metadata?.status === 'error' && <AlertTriangle size={12} className="text-red-500" />}
                                </>
                            )}
                        </div>
                    </div>

                    {isModel && msg.metadata?.groundingChunks && <GroundingSources chunks={msg.metadata.groundingChunks} />}
                </div>
            </div>
        </div>
    );
}, (prev, next) => {
    // Memo comparison
    const prevText = typeof prev.msg.text === 'string' ? prev.msg.text : ((prev.msg as any).content || '');
    const nextText = typeof next.msg.text === 'string' ? next.msg.text : ((next.msg as any).content || '');
    
    const prevMeta = JSON.stringify(prev.msg.metadata);
    const nextMeta = JSON.stringify(next.msg.metadata);

    return prevText === nextText 
        && prev.isLoading === next.isLoading 
        && prevMeta === nextMeta;
});

// --- MAIN WINDOW (Virtuoso Config) ---
const itemKey = (index: number, item: any) => item.id || index;

interface ChatWindowProps {
    messages: ChatMessage[];
    personaMode: 'hanisah' | 'stoic';
    isLoading: boolean;
    messagesEndRef: React.RefObject<HTMLDivElement>;
    onUpdateMessage?: (id: string, text: string) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = memo(({ messages, personaMode, isLoading, messagesEndRef, onUpdateMessage }) => {
    const virtuosoRef = useRef<VirtuosoHandle>(null);

    const allItems = useMemo(() => {
        if (isLoading) {
             const lastMsg = messages[messages.length - 1];
             if (lastMsg && lastMsg.role === 'user') {
                 return [...messages, { id: 'loading-indicator', role: 'model', text: '', isLoader: true } as any];
             }
        }
        return messages;
    }, [messages, isLoading]);

    return (
        <div className="h-full w-full min-h-0 flex-1 flex flex-col relative bg-transparent" style={{ overscrollBehavior: 'contain' }}>
            <Virtuoso
                ref={virtuosoRef}
                style={{ height: '100%', width: '100%' }}
                data={allItems}
                initialTopMostItemIndex={Math.max(0, allItems.length - 1)}
                followOutput="auto"
                alignToBottom
                components={{ 
                    Footer: () => <div className="h-4" /> 
                }}
                atBottomThreshold={60}
                overscan={1000} 
                computeItemKey={itemKey} 
                itemContent={(index, msg) => {
                    if ((msg as any).isLoader) {
                         return (
                            <div style={{ willChange: 'transform' }}>
                                <TypingIndicator personaMode={personaMode} />
                            </div>
                         );
                    }
                    const isLast = index === messages.length - 1;
                    const loadingState = isLoading && isLast && (msg.role === 'model' || (msg.role as string) === 'assistant');
                    return (
                        <div className="py-2 px-2 md:px-4 w-full" style={{ willChange: 'transform' }}>
                             <MessageBubble key={msg.id || index} msg={msg} personaMode={personaMode} isLoading={loadingState} onUpdateMessage={onUpdateMessage}/>
                        </div>
                    );
                }}
            />
        </div>
    );
});
