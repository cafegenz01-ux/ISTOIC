
import React, { useState, useRef, memo } from 'react';
import { Send, Zap, Mic, Flame, Sparkles, Languages, X, Check, BrainCircuit } from 'lucide-react';
import { TranslationService } from '../../../services/translationService'; // Correct import path

interface IStokInputProps {
    onSend: (text: string) => void;
    onSendFile: () => void;
    onSendAudio: (base64: string, duration: number) => void;
    disabled: boolean;
    ttlMode: number;
    onToggleTtl: () => void;
    onAiAssist: (text: string, mode: 'REPLY' | 'REFINE') => Promise<string>;
    onAiTranslate: (text: string, targetLang: string) => Promise<string>;
    isAiThinking: boolean;
    onTyping?: () => void;
}

const LANGUAGES = [
    'English', 
    'Indonesian', 
    'Javanese',
    'Japanese', 
    'Korean', 
    'Mandarin', 
    'Spanish',
    'French'
];

export const IStokInput = memo(({ 
    onSend, 
    onSendFile,
    onSendAudio,
    disabled, 
    ttlMode, 
    onToggleTtl,
    onAiAssist,
    onAiTranslate,
    isAiThinking,
    onTyping
}: IStokInputProps) => {
    const [text, setText] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [showAiMenu, setShowAiMenu] = useState(false);
    const [translateLang, setTranslateLang] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const startTimeRef = useRef<number>(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSend = async () => {
        if (!text.trim()) return;
        
        let finalMessage = text;

        // Auto-Translate if active (Uses Strict Translator Logic)
        if (translateLang) {
            // DIRECT CALL TO SERVICE for stronger prompt
            finalMessage = await TranslationService.translate(text, translateLang);
        }

        onSend(finalMessage);
        setText('');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setText(e.target.value);
        if (onTyping) onTyping();
    };

    const handleAiAction = async (action: 'REPLY' | 'REFINE') => {
        setShowAiMenu(false);
        const res = await onAiAssist(text, action);
        setText(res);
        inputRef.current?.focus();
    };

    const toggleTranslate = () => {
        if (!translateLang) {
            setTranslateLang(LANGUAGES[0]);
        } else {
            const idx = LANGUAGES.indexOf(translateLang);
            const nextIdx = idx + 1;
            if (nextIdx < LANGUAGES.length) {
                setTranslateLang(LANGUAGES[nextIdx]);
            } else {
                setTranslateLang(null); // Cycle back to OFF
            }
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
                    if (duration > 0) onSendAudio(base64, duration);
                };
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            startTimeRef.current = Date.now();
            setIsRecording(true);
        } catch (e) {
            console.error("Mic error", e);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    return (
        // KEY FIX: Added pb-[max(...)] for iPhone XR notch/safe area
        <div className="bg-[#09090b]/90 backdrop-blur-md border-t border-white/10 p-3 z-20 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 shrink-0 shadow-2xl">
            
            {/* AI Control Bar (When active or menu open) */}
            {(showAiMenu || translateLang) && (
                <div className="flex items-center gap-2 mb-3 animate-slide-up px-1 overflow-x-auto no-scrollbar">
                    {/* Translate Indicator */}
                    {translateLang && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 text-[10px] font-black uppercase tracking-wider shrink-0">
                            <Languages size={12} /> {translateLang} (AUTO)
                            <button onClick={()=>setTranslateLang(null)} className="ml-1 hover:text-white"><X size={10}/></button>
                        </div>
                    )}
                    
                    {/* Smart Actions */}
                    {showAiMenu && (
                        <>
                            <button onClick={()=>handleAiAction('REPLY')} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold shrink-0 transition-colors">
                                <Sparkles size={12} className="text-yellow-400"/> SMART REPLY
                            </button>
                            <button onClick={()=>handleAiAction('REFINE')} disabled={!text} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold shrink-0 transition-colors disabled:opacity-50">
                                <BrainCircuit size={12} className="text-cyan-400"/> REFINE TEXT
                            </button>
                        </>
                    )}
                </div>
            )}

            <div className="flex gap-2 items-end">
                {/* Tools Toggle */}
                <button onClick={onSendFile} className="p-3 bg-white/5 rounded-full text-neutral-400 hover:text-white transition-colors border border-transparent hover:border-white/10 active:scale-95"><Zap size={20}/></button>
                
                {/* Input Container */}
                <div className={`flex-1 bg-white/5 rounded-[24px] px-2 border border-white/5 focus-within:border-emerald-500/30 transition-all relative flex items-center ${isAiThinking ? 'animate-pulse border-purple-500/50' : ''}`}>
                    
                    {/* Magic Wand (AI Trigger) */}
                    <button 
                        onClick={() => setShowAiMenu(!showAiMenu)}
                        className={`p-2 rounded-full transition-colors ${showAiMenu ? 'text-purple-400 bg-purple-500/10' : 'text-neutral-500 hover:text-purple-400'}`}
                    >
                        <Sparkles size={16} />
                    </button>

                    <input 
                        ref={inputRef}
                        value={text} 
                        onChange={handleChange} 
                        onKeyDown={e=>e.key==='Enter' && handleSend()} 
                        placeholder={isRecording ? "Recording..." : (translateLang ? `Translating to ${translateLang}...` : "Message...")} 
                        className="flex-1 bg-transparent outline-none text-white text-sm placeholder:text-neutral-600 px-2 py-3" 
                        disabled={disabled||isRecording}
                        autoComplete="off"
                    />

                    {/* Translator Toggle */}
                    <button 
                        onClick={toggleTranslate}
                        className={`p-2 rounded-full transition-colors ${translateLang ? 'text-cyan-400 bg-cyan-500/10' : 'text-neutral-500 hover:text-cyan-400'}`}
                        title="Cycle Languages"
                    >
                        <Languages size={16} />
                    </button>
                </div>

                {/* Send / Mic */}
                {text.trim() ? (
                    <button 
                        onClick={handleSend} 
                        className="p-3 bg-emerald-600 rounded-full text-white shadow-lg shadow-emerald-900/20 active:scale-90 transition-transform hover:bg-emerald-500"
                    >
                        {isAiThinking ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Send size={20}/>}
                    </button>
                ) : (
                    <button 
                        onMouseDown={startRecording} 
                        onMouseUp={stopRecording} 
                        onTouchStart={(e) => { e.preventDefault(); startRecording(); }} 
                        onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }} 
                        className={`p-3 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white shadow-[0_0_15px_red] animate-pulse' : 'bg-white/5 text-neutral-400 hover:text-white'}`}
                    >
                        <Mic size={20}/>
                    </button>
                )}
            </div>

            {/* TTL Indicator */}
            <div className="flex justify-center mt-2 opacity-50 hover:opacity-100 transition-opacity">
                <button onClick={onToggleTtl} className={`flex items-center gap-1 px-3 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${ttlMode > 0 ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'text-neutral-600 hover:text-neutral-400'}`}>
                    <Flame size={8} className={ttlMode > 0 ? 'fill-current' : ''} />
                    {ttlMode > 0 ? `${ttlMode}S BURN` : 'PERSISTENT'}
                </button>
            </div>
        </div>
    );
});
