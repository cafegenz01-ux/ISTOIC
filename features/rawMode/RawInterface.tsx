
import React, { useRef, useEffect } from 'react';
import { useRawLogic } from './useRawLogic';
import { 
    Send, Mic, MicOff, Sun, Moon, ArrowUp
} from 'lucide-react';
import useLocalStorage from '../../hooks/useLocalStorage';
import Markdown from 'react-markdown';
import type { Note } from '../../types';

interface RawInterfaceProps {
    notes: Note[];
    setNotes: (notes: Note[]) => void;
}

export const RawInterface: React.FC<RawInterfaceProps> = ({ notes, setNotes }) => {
    const { 
        messages, input, setInput, sendMessage, isProcessing,
        models, selectedModelId, setSelectedModelId,
        isLive, toggleLive,
        autoScroll, setAutoScroll
    } = useRawLogic(notes, setNotes);

    const [isDark, setIsDark] = useLocalStorage('raw_mode_theme_clean', false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages, autoScroll]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
        }
    }, [input]);

    const theme = {
        bg: isDark ? 'bg-[#0a0a0a]' : 'bg-[#ffffff]',
        text: isDark ? 'text-[#e5e5e5]' : 'text-[#1a1a1a]',
        meta: isDark ? 'text-[#525252]' : 'text-[#a3a3a3]',
        border: isDark ? 'border-[#262626]' : 'border-[#e5e5e5]',
        inputBg: isDark ? 'bg-[#0a0a0a]' : 'bg-[#ffffff]',
        placeholder: isDark ? 'placeholder-neutral-700' : 'placeholder-neutral-300',
        hover: isDark ? 'hover:bg-[#262626]' : 'hover:bg-[#f5f5f5]'
    };

    return (
        <div className={`h-full w-full flex flex-col font-mono tracking-tight ${theme.bg} ${theme.text} transition-colors duration-500`}>
            
            <header className="flex items-center justify-between px-6 py-6 pt-safe pb-6 md:px-12 md:py-8 shrink-0 z-10">
                <div className="flex items-center gap-6">
                    <div className="relative group">
                        <select 
                            value={selectedModelId}
                            onChange={(e) => setSelectedModelId(e.target.value)}
                            className={`appearance-none bg-transparent outline-none text-xs font-bold uppercase tracking-[0.15em] cursor-pointer ${theme.meta} hover:${theme.text} transition-colors pr-4`}
                        >
                            {models.map(m => (
                                <option key={m.id} value={m.id} className={isDark ? "bg-black text-white" : "bg-white text-black"}>
                                    {m.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button 
                        onClick={toggleLive}
                        className={`text-xs font-medium uppercase tracking-widest flex items-center gap-2 transition-all ${isLive ? 'text-red-500 animate-pulse' : theme.meta}`}
                    >
                        {isLive ? <Mic size={14} /> : <MicOff size={14} />}
                        <span className="hidden md:inline">{isLive ? 'LIVE' : 'MUTE'}</span>
                    </button>
                    
                    <button onClick={() => setIsDark(!isDark)} className={`${theme.meta} hover:${theme.text} transition-colors`}>
                        {isDark ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
                    </button>
                </div>
            </header>

            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-6 md:px-12 custom-scroll scroll-smooth pb-12"
                onScroll={(e) => {
                    const target = e.target as HTMLDivElement;
                    const isBottom = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 50;
                    setAutoScroll(isBottom);
                }}
            >
                <div className="max-w-3xl mx-auto space-y-12">
                    {messages.filter(m => m.id !== 'init').map((msg) => (
                        <div key={msg.id} className={`flex flex-col gap-2 animate-fade-in ${msg.role === 'USER' ? 'items-end' : 'items-start'}`}>
                            
                            <div className={`text-[10px] uppercase tracking-[0.2em] ${theme.meta} select-none`}>
                                {msg.role === 'HANISAH' ? 'AI' : 'YOU'} <span className="opacity-30">/</span> {msg.timestamp}
                            </div>

                            <div className={`
                                text-sm md:text-[15px] leading-relaxed max-w-full md:max-w-[90%] whitespace-pre-wrap
                                ${msg.role === 'USER' ? 'text-right' : 'text-left'}
                            `}>
                                <div className="prose prose-sm dark:prose-invert max-w-none font-mono">
                                    <Markdown
                                        components={{
                                            p: ({node, ...props}) => <p {...props} className={`mb-4 ${theme.text}`} />,
                                            strong: ({node, ...props}) => <strong {...props} className="font-bold opacity-100" />,
                                            img: ({node, ...props}) => (
                                                <div className="my-4">
                                                    <img {...props} className="max-w-full h-auto rounded-none border border-neutral-800 dark:border-neutral-200 grayscale hover:grayscale-0 transition-all duration-700" />
                                                </div>
                                            ),
                                            code: ({node, ...props}) => <code {...props} className={`bg-neutral-100 dark:bg-neutral-900 px-1 py-0.5 rounded text-[11px]`} />,
                                            pre: ({node, ...props}) => <pre {...props} className="bg-neutral-50 dark:bg-neutral-900 p-4 overflow-x-auto border-l-2 border-neutral-300 dark:border-neutral-700 text-xs" />
                                        }}
                                    >
                                        {msg.content}
                                    </Markdown>
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    {isProcessing && (
                        <div className="flex flex-col items-start gap-2 animate-pulse">
                            <div className={`text-[10px] uppercase tracking-[0.2em] ${theme.meta}`}>AI</div>
                            <div className="w-2 h-4 bg-current opacity-50"></div>
                        </div>
                    )}
                </div>
            </div>

            <div className="px-6 md:px-12 py-8 shrink-0">
                <div className="max-w-3xl mx-auto relative">
                    <textarea 
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                            }
                        }}
                        className={`
                            w-full ${theme.inputBg} ${theme.text} ${theme.placeholder}
                            text-sm md:text-base leading-relaxed
                            border-b ${theme.border} border-t-0 border-l-0 border-r-0
                            focus:ring-0 focus:border-neutral-500 transition-colors
                            py-4 pr-12 pl-0 resize-none overflow-hidden
                        `}
                        placeholder="Type a command..."
                        autoFocus
                        rows={1}
                    />
                    
                    <button 
                        onClick={sendMessage} 
                        disabled={!input.trim() || isProcessing}
                        className={`
                            absolute right-0 bottom-4 p-2 
                            ${theme.text} disabled:opacity-30 
                            transition-all hover:scale-110 active:scale-95
                        `}
                    >
                        {isProcessing ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <ArrowUp size={20} strokeWidth={1.5} />
                        )}
                    </button>
                </div>
                
                <div className="max-w-3xl mx-auto mt-4 flex justify-between text-[9px] uppercase tracking-[0.2em] opacity-40">
                    <span>{isProcessing ? 'COMPUTING...' : 'READY'}</span>
                    <span>RAW_MODE // {notes.length} NODES LINKED</span>
                </div>
            </div>
        </div>
    );
};
