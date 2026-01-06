import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    encryptData, decryptData
} from '../../utils/crypto'; 
import { activatePrivacyShield } from '../../utils/privacyShield';
import { 
    Send, Zap, ScanLine, Server,
    Mic, Menu, PhoneCall, 
    QrCode, Lock, Flame, 
    ArrowLeft, BrainCircuit, Sparkles,
    Wifi, WifiOff, Paperclip, Globe, Check, X,
    Activity, Radio, Globe2, Network, Loader2, Shield, User,
    Play, Pause, FileText, Image as ImageIcon, Download
} from 'lucide-react';

// --- IMPORTS EXTERNAL (Tetap Import Utils/Services) ---
import useLocalStorage from '../../hooks/useLocalStorage';
import { OMNI_KERNEL } from '../../services/omniRace'; 
import { SidebarIStokContact, IStokSession, IStokProfile } from './components/SidebarIStokContact';
import { ShareConnection } from './components/ShareConnection'; 
import { TeleponanView } from '../teleponan/TeleponanView'; // Pastikan path ini benar atau ganti dengan komponen dummy di bawah
import { QRScanner } from './components/QRScanner'; 
import { compressImage } from './components/gambar';

// --- CONSTANTS ---
const CHUNK_SIZE = 16384; 
const HEARTBEAT_MS = 2000; 
const RECONNECT_DELAY = 1000;

const SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English (Pro)', icon: '🇺🇸' },
    { code: 'id', name: 'Indonesia (Formal)', icon: '🇮🇩' },
    { code: 'jp', name: 'Japanese (Keigo)', icon: '🇯🇵' },
    { code: 'cn', name: 'Mandarin (Biz)', icon: '🇨🇳' },
    { code: 'ru', name: 'Russian', icon: '🇷🇺' },
    { code: 'ar', name: 'Arabic (MSA)', icon: '🇸🇦' },
    { code: 'de', name: 'German', icon: '🇩🇪' },
    { code: 'fr', name: 'French', icon: '🇫🇷' },
];

// --- TYPES ---
interface Message {
    id: string;
    sender: 'ME' | 'THEM';
    type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'FILE';
    content: string; 
    timestamp: number;
    status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ';
    duration?: number;
    size?: number;
    fileName?: string; 
    isMasked?: boolean;
    mimeType?: string;
    ttl?: number; 
    isTranslated?: boolean;
    originalLang?: string;
}

type AppMode = 'SELECT' | 'HOST' | 'JOIN' | 'CHAT';
type ConnectionStage = 'IDLE' | 'LOCATING_PEER' | 'FETCHING_RELAYS' | 'VERIFYING_KEYS' | 'ESTABLISHING_TUNNEL' | 'AWAITING_APPROVAL' | 'SECURE' | 'RECONNECTING' | 'DISCONNECTED';

// --- UTILS: AUDIO & HAPTIC ---
const triggerHaptic = (ms: number | number[]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms);
};

const playSound = (type: 'MSG_IN' | 'MSG_OUT' | 'CONNECT' | 'CALL_RING' | 'BUZZ' | 'AI_THINK' | 'TRANSLATE' | 'ERROR') => {
    try {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        const now = ctx.currentTime;
        
        const presets: any = {
            'MSG_IN': () => { osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(400, now + 0.1); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.1); },
            'MSG_OUT': () => { osc.frequency.setValueAtTime(400, now); gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now + 0.05); },
            'CONNECT': () => { osc.frequency.setValueAtTime(600, now); osc.frequency.linearRampToValueAtTime(1200, now + 0.2); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.2); },
            'AI_THINK': () => { osc.frequency.setValueAtTime(300, now); osc.frequency.linearRampToValueAtTime(600, now + 0.3); gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now + 0.3); },
            'ERROR': () => { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(50, now + 0.3); gain.gain.setValueAtTime(0.2, now); gain.gain.linearRampToValueAtTime(0, now + 0.3); },
            'TRANSLATE': () => { osc.type = 'square'; osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1); gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now + 0.1); },
            'CALL_RING': () => { osc.type = 'triangle'; osc.frequency.setValueAtTime(880, now); osc.frequency.setValueAtTime(880, now + 0.5); gain.gain.setValueAtTime(0.1, now); gain.gain.setValueAtTime(0, now + 0.5); },
            'BUZZ': () => { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now); gain.gain.setValueAtTime(0.2, now); gain.gain.linearRampToValueAtTime(0, now + 0.2); }
        };
        
        if (presets[type]) { presets[type](); osc.start(now); osc.stop(now + (type === 'CALL_RING' ? 0.5 : 0.3)); }
    } catch(e) {}
};

// --- AGGRESSIVE ICE FETCH ---
const getIceServers = async (): Promise<any[]> => {
    const publicIce = [ { urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.nextcloud.com:443' } ];
    try {
        const apiKey = import.meta.env.VITE_METERED_API_KEY;
        if (!apiKey) return publicIce;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const response = await fetch(`https://istoic.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) return publicIce;
        return [...(await response.json()), ...publicIce];
    } catch (e) { return publicIce; }
};

// ============================================================================
// INTERNAL UI COMPONENTS (MERGED FOR SINGLE FILE ROBUSTNESS)
// ============================================================================

// 1. MESSAGE BUBBLE (INTERNAL DEFINITION)
const MessageBubble = React.memo(({ msg, setViewImage, onBurn }: { msg: Message, setViewImage: (s: string)=>void, onBurn: (id: string)=>void }) => {
    const isMe = msg.sender === 'ME';
    const [isPlaying, setIsPlaying] = useState(false);
    
    // Auto Burn TTL
    useEffect(() => {
        if (msg.ttl && msg.ttl > 0) {
            const timer = setTimeout(() => onBurn(msg.id), msg.ttl * 1000);
            return () => clearTimeout(timer);
        }
    }, [msg.ttl, msg.id, onBurn]);

    return (
        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-4 animate-in fade-in slide-in-from-bottom-2`}>
            <div className={`max-w-[85%] rounded-2xl p-3 relative ${isMe ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-[#18181b] text-white border border-white/10 rounded-tl-none'}`}>
                {/* Header Info */}
                <div className="flex items-center justify-between gap-4 mb-1 text-[9px] opacity-70">
                    <span className="font-bold">{isMe ? 'ME' : 'PEER'}</span>
                    <div className="flex items-center gap-1">
                        {msg.isTranslated && <span className="text-yellow-300 flex items-center gap-0.5"><Globe size={8}/> {msg.originalLang}</span>}
                        {msg.ttl && msg.ttl > 0 && <span className="text-red-400 flex items-center gap-0.5"><Flame size={8}/> {msg.ttl}s</span>}
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                </div>

                {/* Content Handlers */}
                {msg.type === 'TEXT' && (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                )}

                {msg.type === 'IMAGE' && (
                    <div className="relative group cursor-pointer" onClick={() => setViewImage(`data:image/jpeg;base64,${msg.content}`)}>
                        <img src={`data:image/jpeg;base64,${msg.content}`} className="rounded-lg max-h-60 w-full object-cover border border-white/10" alt="Encrypted Media" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg"><ImageIcon className="text-white"/></div>
                        {msg.size && <span className="absolute bottom-1 right-1 bg-black/60 px-1 rounded text-[8px] text-white">{(msg.size/1024).toFixed(1)}KB</span>}
                    </div>
                )}

                {msg.type === 'AUDIO' && (
                     <div className="flex items-center gap-3 min-w-[150px]">
                        <button onClick={async () => {
                            if(isPlaying) return;
                            setIsPlaying(true);
                            try {
                                const audio = new Audio(`data:audio/webm;base64,${msg.content}`);
                                audio.onended = () => setIsPlaying(false);
                                if(msg.isMasked) {
                                    // Simple pitch shift simulation via playbackRate (real masking needs AudioContext)
                                    audio.playbackRate = 0.85; 
                                }
                                await audio.play();
                            } catch(e) { setIsPlaying(false); }
                        }} className={`p-2 rounded-full ${isMe ? 'bg-white/20' : 'bg-emerald-500/20 text-emerald-500'}`}>
                            {isPlaying ? <Pause size={16} className="fill-current"/> : <Play size={16} className="fill-current"/>}
                        </button>
                        <div className="flex-1">
                            <div className="h-1 bg-white/20 rounded-full w-full overflow-hidden">
                                <div className={`h-full ${isMe ? 'bg-white' : 'bg-emerald-500'} ${isPlaying ? 'animate-[loading_1s_linear_infinite]' : 'w-full'}`}></div>
                            </div>
                            <div className="flex justify-between text-[9px] mt-1 opacity-70">
                                <span>{msg.isMasked ? 'MASKED VN' : 'VOICE'}</span>
                                <span>{msg.duration ? `${Math.floor(msg.duration/60)}:${(msg.duration%60).toString().padStart(2,'0')}` : '0:00'}</span>
                            </div>
                        </div>
                     </div>
                )}

                {msg.type === 'FILE' && (
                    <div className="flex items-center gap-3 p-2 bg-black/20 rounded-lg">
                        <div className="p-2 bg-white/10 rounded-lg"><FileText size={20}/></div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-xs font-bold truncate">{msg.fileName}</p>
                            <p className="text-[9px] opacity-70">{msg.size ? (msg.size/1024).toFixed(1) : 0} KB • {msg.mimeType?.split('/')[1]?.toUpperCase()}</p>
                        </div>
                        <a href={`data:${msg.mimeType};base64,${msg.content}`} download={msg.fileName} className="p-2 hover:bg-white/10 rounded-full"><Download size={16}/></a>
                    </div>
                )}

                {/* Status Ticks */}
                {isMe && (
                    <div className="flex justify-end mt-1">
                        {msg.status === 'PENDING' && <Activity size={10} className="text-neutral-400 animate-pulse"/>}
                        {msg.status === 'SENT' && <Check size={10} className="text-neutral-400"/>}
                        {msg.status === 'READ' && <div className="flex"><Check size={10} className="text-blue-400"/><Check size={10} className="text-blue-400 -ml-1"/></div>}
                    </div>
                )}
            </div>
        </div>
    );
});

// 2. CALL NOTIFICATION (INTERNAL)
const CallNotificationInternal = ({ identity, onAnswer, onDecline }: any) => (
    <div className="fixed top-4 inset-x-4 z-[90] bg-neutral-900/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl flex items-center justify-between animate-in slide-in-from-top-5">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center animate-pulse"><PhoneCall className="text-emerald-500"/></div>
            <div><h3 className="font-bold text-sm text-white">Incoming Call</h3><p className="text-xs text-neutral-400">{identity}</p></div>
        </div>
        <div className="flex gap-2">
            <button onClick={onDecline} className="p-3 bg-red-500/20 text-red-500 rounded-full"><X size={20}/></button>
            <button onClick={onAnswer} className="p-3 bg-emerald-500 text-white rounded-full shadow-[0_0_15px_#10b981] animate-pulse"><PhoneCall size={20}/></button>
        </div>
    </div>
);

// 3. CONNECTION NOTIFICATION (Z-INDEX 100000 - SUPREME LAYER)
const ConnectionNotification: React.FC<{ identity: string; peerId: string; onAccept: () => void; onDecline: () => void; isProcessing?: boolean; }> = ({ identity, peerId, onAccept, onDecline, isProcessing = false }) => {
    const [isVisible, setIsVisible] = useState(false);
    useEffect(() => { setIsVisible(true); triggerHaptic([50, 50, 200]); return () => setIsVisible(false); }, []);
    return (
        <div className={`fixed top-0 left-0 right-0 z-[100000] flex justify-center items-start pt-[max(env(safe-area-inset-top),1.5rem)] px-4 pb-4 transition-all duration-500 transform ${isVisible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-full opacity-0 scale-95'} pointer-events-none`}>
            <div className="pointer-events-auto w-full max-w-[360px] bg-[#09090b]/95 backdrop-blur-3xl border border-emerald-500/50 rounded-[28px] shadow-[0_20px_60px_-10px_rgba(16,185,129,0.5)] overflow-hidden relative ring-1 ring-white/15">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>
                <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent animate-scan-line"></div>
                <div className="p-5 relative z-10">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2.5">
                            <div className="relative flex items-center justify-center w-7 h-7 bg-emerald-500/10 rounded-full border border-emerald-500/20"><Radio size={14} className="text-emerald-500 animate-pulse"/></div>
                            <div><h3 className="text-[10px] font-black text-emerald-400 tracking-[0.2em] uppercase leading-none mb-1">INCOMING UPLINK</h3><p className="text-[9px] text-neutral-400 font-mono flex items-center gap-1"><Network size={10} /> GLOBAL_MESH_V5</p></div>
                        </div>
                        <div className="px-2 py-0.5 bg-emerald-950/50 rounded border border-emerald-500/20 text-[9px] font-bold text-emerald-500 animate-pulse flex items-center gap-1"><Zap size={8} fill="currentColor"/> LIVE</div>
                    </div>
                    <div className="flex items-center gap-3 mb-5 bg-white/5 p-3 rounded-2xl border border-white/5">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neutral-800 to-black border border-white/10 flex items-center justify-center shrink-0"><User className="text-neutral-300" size={18} /></div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-white font-bold text-sm truncate">{identity || 'Unknown Entity'}</h4>
                            <div className="flex items-center gap-2 mt-0.5"><span className="text-[9px] bg-black/50 px-1.5 py-0.5 rounded text-neutral-500 font-mono border border-white/5">{peerId.substring(0,8)}...</span><span className="text-[9px] text-emerald-500 font-bold flex items-center gap-0.5"><Lock size={8}/> E2EE</span></div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={(e)=>{e.stopPropagation(); onDecline();}} disabled={isProcessing} className="py-3.5 bg-neutral-800/50 active:bg-red-900/30 border border-white/10 active:border-red-500/50 rounded-xl text-xs font-bold text-neutral-400 active:text-red-400 transition-all flex items-center justify-center gap-2 touch-manipulation select-none"><X size={16} /> REJECT</button>
                        <button onClick={(e)=>{e.stopPropagation(); onAccept();}} disabled={isProcessing} className={`py-3.5 rounded-xl text-xs font-black tracking-wide text-white shadow-lg touch-manipulation select-none flex items-center justify-center gap-2 transition-all active:scale-95 ${isProcessing ? 'bg-neutral-800 cursor-wait opacity-80 border border-white/5' : 'bg-emerald-600 active:bg-emerald-500 border-t border-emerald-400/30 shadow-emerald-500/20'}`}>{isProcessing ? <><Loader2 size={16} className="animate-spin" /> LINKING...</> : <><Shield size={16} className="fill-current" /> ACCEPT</>}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// 4. GLOBAL STATUS PILL
const GlobalStatusOverlay = ({ stage, isOnline, ping }: { stage: ConnectionStage, isOnline: boolean, ping: number }) => {
    if (stage === 'IDLE' && !isOnline) return null;
    let bgColor = 'bg-neutral-900', icon = <Activity size={14} className="animate-pulse"/>, text = stage.replace('_', ' ');
    if (stage === 'SECURE' && isOnline) { bgColor = 'bg-emerald-950/90 border-emerald-500/30'; icon = <Globe2 size={14} className="text-emerald-500"/>; text = `SECURE • ${ping}ms`; }
    else if (stage === 'RECONNECTING') { bgColor = 'bg-yellow-950/90 border-yellow-500/30'; icon = <Radio size={14} className="text-yellow-500 animate-spin"/>; text = "SEARCHING..."; }
    else if (stage === 'DISCONNECTED') { bgColor = 'bg-red-950/90 border-red-500/30'; icon = <WifiOff size={14} className="text-red-500"/>; text = "OFFLINE"; }
    return (
        <div className="fixed top-0 inset-x-0 z-[90] pointer-events-none flex justify-center pt-[max(env(safe-area-inset-top),0.5rem)]">
            <div className={`${bgColor} backdrop-blur-md border text-white px-3 py-1 rounded-full shadow-2xl flex items-center gap-2 text-[9px] font-bold tracking-widest uppercase mt-1 animate-in slide-in-from-top-2`}>{icon} <span>{text}</span></div>
        </div>
    );
};

// 5. INPUT COMPONENT
const IStokInput = React.memo(({ 
    onSend, onTyping, disabled, isRecording, recordingTime, 
    isVoiceMasked, onToggleMask, onStartRecord, onStopRecord, 
    onAttach, ttlMode, onToggleTtl, onAiAssist, isAiThinking,
    translateTarget, setTranslateTarget
}: any) => {
    const [text, setText] = useState('');
    const [showLangMenu, setShowLangMenu] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const insertText = (newText: string) => setText(newText);

    return (
        <div className="bg-[#09090b] border-t border-white/10 p-3 z-20 pb-[max(env(safe-area-inset-bottom),1rem)] relative">
            {showLangMenu && (
                <div className="absolute bottom-full left-4 mb-2 bg-[#121214] border border-white/10 rounded-xl p-2 shadow-2xl w-48 z-50 animate-in slide-in-from-bottom-2">
                    <div className="space-y-1 max-h-48 overflow-y-auto custom-scroll">
                        <button onClick={() => { setTranslateTarget(null); setShowLangMenu(false); }} className="w-full flex items-center gap-2 p-2 rounded-lg text-xs font-bold text-neutral-400 hover:bg-white/5"><X size={12} /> OFF (Original)</button>
                        {SUPPORTED_LANGUAGES.map(lang => (
                            <button key={lang.code} onClick={() => { setTranslateTarget(lang); setShowLangMenu(false); }} className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-bold ${translateTarget?.code === lang.code ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:bg-white/5'}`}>
                                <span className="flex items-center gap-2">{lang.icon} {lang.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
            <div className="flex items-center justify-between mb-2 px-1">
                 <div className="flex gap-2">
                     <button onClick={onToggleTtl} className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-[9px] font-black uppercase ${ttlMode > 0 ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-white/5 border-white/5 text-neutral-500'}`}><Flame size={10} className={ttlMode>0?'fill-current':''} /> {ttlMode > 0 ? `${ttlMode}s` : 'OFF'}</button>
                     <button onClick={() => onAiAssist(text, insertText)} disabled={isAiThinking} className="flex items-center gap-1.5 px-2 py-1 rounded-full border bg-white/5 border-white/5 text-neutral-500 text-[9px] font-black uppercase touch-manipulation hover:border-purple-500/50 hover:text-purple-400 transition-colors">{isAiThinking ? <Sparkles size={10} className="animate-spin" /> : <BrainCircuit size={10} />} AI DRAFT</button>
                     <button onClick={() => setShowLangMenu(!showLangMenu)} className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-[9px] font-black uppercase touch-manipulation ${translateTarget ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'bg-white/5 text-neutral-500'}`}><Globe size={10} /> {translateTarget ? translateTarget.code : 'LANG'}</button>
                 </div>
                 <span className="text-[8px] font-mono text-emerald-500/50 flex items-center gap-1"><Lock size={8}/> E2EE</span>
            </div>
            <div className="flex gap-2 items-end">
                <button onClick={onAttach} className="p-3 bg-white/5 rounded-full text-neutral-400 touch-manipulation active:scale-95 transition-transform hover:bg-white/10"><Paperclip size={20}/></button>
                <div className="flex-1 bg-white/5 rounded-2xl px-4 py-3 border border-white/5 focus-within:border-emerald-500/30 transition-colors relative">
                    <input ref={inputRef} value={text} onChange={e=>{setText(e.target.value); onTyping();}} onKeyDown={e=>e.key==='Enter'&&text.trim()&&(onSend(text),setText(''))} placeholder={isRecording ? "Recording..." : (translateTarget ? `Translating to ${translateTarget.name}...` : "Message...")} className="w-full bg-transparent outline-none text-white text-sm placeholder:text-neutral-600" disabled={disabled||isRecording}/>
                </div>
                {text.trim() ? (
                    <button onClick={()=>{onSend(text); setText('');}} className="p-3 bg-emerald-600 rounded-full text-white shadow-lg touch-manipulation active:scale-95 transition-transform"><Send size={20}/></button>
                ) : (
                    <button onMouseDown={onStartRecord} onMouseUp={onStopRecord} onTouchStart={onStartRecord} onTouchEnd={onStopRecord} className={`p-3 rounded-full transition-all touch-manipulation active:scale-95 ${isRecording ? 'bg-red-500 animate-pulse shadow-[0_0_15px_red]' : 'bg-white/5 text-neutral-400 hover:bg-white/10'}`}><Mic size={20}/></button>
                )}
            </div>
        </div>
    );
});

// ============================================================================
// MAIN LOGIC CONTAINER
// ============================================================================

export const IStokView: React.FC = () => {
    // --- STATE MANAGEMENT ---
    const [mode, setMode] = useState<AppMode>('SELECT');
    const [stage, setStage] = useState<ConnectionStage>('IDLE');
    const [errorMsg, setErrorMsg] = useState<string>('');
    
    // DATA PERSISTENCE
    const [myProfile] = useLocalStorage<IStokProfile>('istok_profile_v1', {
        id: `ISTOK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        username: `ANOMALY-${Math.floor(Math.random() * 9000) + 1000}`,
        created: Date.now()
    });
    const [sessions, setSessions] = useLocalStorage<IStokSession[]>('istok_sessions', []);
    
    // CONNECTION STATE
    const [targetPeerId, setTargetPeerId] = useState<string>('');
    const [accessPin, setAccessPin] = useState<string>('');
    const [pendingJoin, setPendingJoin] = useState<{id:string, pin:string} | null>(null);
    const [pingLatency, setPingLatency] = useState(0);
    
    // UI FLAGS
    const [showSidebar, setShowSidebar] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [showCall, setShowCall] = useState(false);
    const [viewImage, setViewImage] = useState<string|null>(null);
    const [showScanner, setShowScanner] = useState(false);
    
    // CHAT & MEDIA
    const [messages, setMessages] = useState<Message[]>([]);
    const [isPeerOnline, setIsPeerOnline] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isVoiceMasked, setIsVoiceMasked] = useState(false);
    const [ttlMode, setTtlMode] = useState(0); 
    
    // AI ENGINE
    const [isAiThinking, setIsAiThinking] = useState(false); 
    const [translateTarget, setTranslateTarget] = useState<any>(null);

    // NOTIFICATIONS
    const [incomingRequest, setIncomingRequest] = useState<any>(null);
    const [incomingCall, setIncomingCall] = useState<any>(null);

    // REFS
    const peerRef = useRef<any>(null);
    const connRef = useRef<any>(null);
    const pinRef = useRef(accessPin);
    const msgEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chunkBuffer = useRef<any>({});
    const heartbeatRef = useRef<any>(null);
    const mediaRecorderRef = useRef<MediaRecorder|null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // --- EFFECTS ---
    useEffect(() => { pinRef.current = accessPin; }, [accessPin]);
    useEffect(() => { msgEndRef.current?.scrollIntoView({behavior:'smooth'}); }, [messages]);

    useEffect(() => {
        activatePrivacyShield();
        try {
            const url = new URL(window.location.href);
            const connect = url.searchParams.get('connect');
            const key = url.searchParams.get('key');
            if (connect && key) {
                setTargetPeerId(connect); setAccessPin(key); setMode('JOIN'); 
                setPendingJoin({ id: connect, pin: key });
                window.history.replaceState({}, '', window.location.pathname);
            }
        } catch(e) {}
    }, []);

    // --- NETWORK LOGIC ---
    const startHeartbeat = useCallback(() => {
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
            if (!connRef.current) return;
            const iceState = connRef.current.peerConnection?.iceConnectionState;
            if (iceState === 'disconnected' || iceState === 'failed' || !connRef.current.open) {
                setIsPeerOnline(false); setStage('RECONNECTING');
                if (targetPeerId && mode === 'CHAT') joinSession(targetPeerId, pinRef.current);
            } else {
                connRef.current.send({ type: 'PING', time: Date.now() });
            }
        }, HEARTBEAT_MS);
    }, [targetPeerId, mode]);

    const handleDisconnect = useCallback(() => {
        setIsPeerOnline(false); setStage('DISCONNECTED'); playSound('ERROR');
        setTimeout(() => { if (targetPeerId && mode === 'CHAT') { setStage('RECONNECTING'); joinSession(targetPeerId, pinRef.current); }}, RECONNECT_DELAY);
    }, [targetPeerId, mode]);

    const handleData = useCallback(async (data: any, incomingConn?: any) => {
        if (data.type === 'CHUNK') {
            const { id, idx, total, chunk } = data;
            if(!chunkBuffer.current[id]) chunkBuffer.current[id] = { chunks: new Array(total), count:0, total };
            const buf = chunkBuffer.current[id];
            if(!buf.chunks[idx]) { buf.chunks[idx] = chunk; buf.count++; }
            if(buf.count === total) {
                const full = buf.chunks.join(''); delete chunkBuffer.current[id];
                handleData({type:'MSG', payload: full}, incomingConn);
            }
            return;
        }

        const currentPin = pinRef.current;
        if (data.type === 'REQ') {
            const json = await decryptData(data.payload, currentPin);
            if (json) {
                const req = JSON.parse(json);
                if (req.type === 'CONNECTION_REQUEST') {
                    setIncomingRequest({ peerId: incomingConn.peer, identity: req.identity, conn: incomingConn });
                    playSound('MSG_IN');
                }
            }
        }
        else if (data.type === 'RESP') {
            const json = await decryptData(data.payload, currentPin);
            if (json) {
                const res = JSON.parse(json);
                if (res.type === 'CONNECTION_ACCEPT') {
                    setStage('SECURE'); setMode('CHAT'); setIsPeerOnline(true); startHeartbeat(); playSound('CONNECT');
                    setSessions(prev => {
                        const exists = prev.find(s => s.id === connRef.current.peer);
                        const newSess: IStokSession = { id: connRef.current.peer, name: res.identity, lastSeen: Date.now(), status: 'ONLINE', pin: currentPin, createdAt: Date.now() };
                        if (exists) return prev.map(s => s.id === newSess.id ? newSess : s);
                        return [...prev, newSess];
                    });
                }
            }
        }
        else if (data.type === 'MSG') {
            const json = await decryptData(data.payload, currentPin);
            if (json) {
                const msg = JSON.parse(json);
                setMessages(p => [...p, { ...msg, sender: 'THEM', status: 'READ' }]);
                playSound('MSG_IN');
            }
        }
        else if (data.type === 'PING') { 
            setIsPeerOnline(true); if(stage !== 'SECURE') setStage('SECURE');
            if (data.time) setPingLatency(Date.now() - data.time);
        }
        else if (data.type === 'SIGNAL' && data.action === 'BUZZ') { triggerHaptic([100,50,100]); playSound('BUZZ'); }
    }, [startHeartbeat, setSessions]);

    // --- PEER INIT (AGGRESSIVE) ---
    useEffect(() => {
        let mounted = true;
        if (peerRef.current) return;
        const init = async () => {
            try {
                setStage('FETCHING_RELAYS');
                const iceServers = await getIceServers();
                const { Peer } = await import('peerjs');
                if (!mounted) return;
                
                const peer = new Peer(myProfile.id, { 
                    debug: 0, 
                    secure: true, 
                    config: { iceServers, sdpSemantics: 'unified-plan', iceCandidatePoolSize: 10, bundlePolicy: 'max-bundle' },
                    retry_timer: 500
                });

                peer.on('open', () => { setStage('IDLE'); if (pendingJoin) { joinSession(pendingJoin.id, pendingJoin.pin); setPendingJoin(null); }});
                peer.on('connection', c => { c.on('data', d => handleData(d, c)); c.on('close', handleDisconnect); c.on('iceStateChanged', (s) => { if(s==='disconnected'||s==='failed') handleDisconnect(); });});
                peer.on('call', call => { if (showCall) { call.close(); return; } setIncomingCall(call); playSound('CALL_RING'); });
                peer.on('error', err => { 
                    if (err.type === 'peer-unavailable') { setErrorMsg("TARGET NOT FOUND"); setStage('IDLE'); } 
                    else if (err.type === 'disconnected' || err.type === 'network') { peer.reconnect(); setStage('RECONNECTING'); }
                });
                peerRef.current = peer;
            } catch (e) { setErrorMsg("INIT FAILED"); }
        };
        init();
        return () => { mounted = false; if(peerRef.current) peerRef.current.destroy(); clearInterval(heartbeatRef.current); };
    }, []);

    const joinSession = (id?: string, pin?: string) => {
        const target = id || targetPeerId; const key = pin || accessPin;
        if (!target || !key) return;
        if (!peerRef.current || peerRef.current.disconnected) { peerRef.current?.reconnect(); setPendingJoin({id: target, pin: key}); return; }
        setStage('LOCATING_PEER');
        const conn = peerRef.current.connect(target, { reliable: true, serialization: 'binary', metadata: { aggressive: true } });
        conn.on('open', async () => {
            setStage('VERIFYING_KEYS'); connRef.current = conn;
            const payload = JSON.stringify({ type: 'CONNECTION_REQUEST', identity: myProfile.username });
            const encrypted = await encryptData(payload, key);
            if (encrypted) { conn.send({ type: 'REQ', payload: encrypted }); setStage('AWAITING_APPROVAL'); }
        });
        conn.on('data', (d: any) => handleData(d, conn)); conn.on('close', handleDisconnect); conn.on('error', () => { handleDisconnect(); });
    };

    const handleQRScan = (data: string) => {
        setShowScanner(false);
        playSound('CONNECT');
        try { const url = new URL(data); const connect = url.searchParams.get('connect'); const key = url.searchParams.get('key'); if (connect && key) { setTargetPeerId(connect); setAccessPin(key); joinSession(connect, key); return; }} catch(e) {}
        setTargetPeerId(data);
    };

    const handleAiAssist = async (currentText: string, setTextCallback: (t: string) => void) => {
        setIsAiThinking(true); playSound('AI_THINK');
        const context = messages.slice(-5).map(m => `${m.sender}: ${m.content}`).join('\n');
        const prompt = currentText ? `Draft reply for: "${currentText}". Context:\n${context}` : `Suggest reply. Context:\n${context}`;
        try { if (OMNI_KERNEL && OMNI_KERNEL.raceStream) { const stream = OMNI_KERNEL.raceStream(prompt, "Helpful chat assistant."); let full = ''; for await (const chunk of stream) { if (chunk.text) { full += chunk.text; setTextCallback(full); }}}} catch (e) {} finally { setIsAiThinking(false); }
    };

    const sendMessage = async (type: string, content: string, extras = {}) => {
        if (!connRef.current) return;
        let finalContent = content; let isTranslated = false;
        if (type === 'TEXT' && translateTarget && content.trim()) {
            setIsAiThinking(true); playSound('TRANSLATE');
            if (OMNI_KERNEL && OMNI_KERNEL.raceStream) {
                const stream = OMNI_KERNEL.raceStream(`Translate to ${translateTarget.name}: "${content}"`, "Professional Translator.");
                let t = ''; for await (const c of stream) if(c.text) t+=c.text; finalContent = t.trim(); isTranslated = true;
            }
            setIsAiThinking(false);
        }
        const msgId = crypto.randomUUID(); const payloadObj = { id: msgId, type, content: finalContent, timestamp: Date.now(), ttl: ttlMode, isTranslated, originalLang: translateTarget?.name, ...extras };
        const encrypted = await encryptData(JSON.stringify(payloadObj), pinRef.current);
        if (!encrypted) return;
        if (encrypted.length > CHUNK_SIZE) { const total = Math.ceil(encrypted.length / CHUNK_SIZE); for(let i=0; i<total; i++) connRef.current.send({ type: 'CHUNK', id: crypto.randomUUID(), idx: i, total, chunk: encrypted.slice(i*CHUNK_SIZE, (i+1)*CHUNK_SIZE) }); } else connRef.current.send({ type: 'MSG', payload: encrypted });
        setMessages(p => [...p, { ...payloadObj, sender: 'ME', status: 'SENT' } as Message]); playSound('MSG_OUT');
    };

    // =========================================================================
    // RENDER: PWA & IOS OPTIMIZED STRUCTURE
    // =========================================================================
    return (
        <div className="h-[100dvh] w-full bg-[#050505] flex flex-col relative font-sans text-white overflow-hidden touch-none select-none overscroll-none">
            
            {/* LAYER 1: ABSOLUTE OVERLAYS */}
            {incomingRequest && <ConnectionNotification identity={incomingRequest.identity} peerId={incomingRequest.peerId} onAccept={async () => { connRef.current = incomingRequest.conn; const payload = JSON.stringify({ type: 'CONNECTION_ACCEPT', identity: myProfile.username }); const enc = await encryptData(payload, pinRef.current); if(enc) incomingRequest.conn.send({type: 'RESP', payload: enc}); setStage('SECURE'); setMode('CHAT'); setIncomingRequest(null); startHeartbeat(); }} onDecline={()=>{ setIncomingRequest(null); }} />}
            <GlobalStatusOverlay stage={stage} isOnline={isPeerOnline} ping={pingLatency} />
            {viewImage && <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 touch-manipulation" onClick={()=>setViewImage(null)}><img src={viewImage} className="max-w-full max-h-full rounded shadow-2xl"/></div>}
            {incomingCall && !showCall && <CallNotificationInternal identity={incomingCall.peer} onAnswer={()=>{setShowCall(true)}} onDecline={()=>{incomingCall.close(); setIncomingCall(null);}} />}
            {showCall && <TeleponanView onClose={()=>{setShowCall(false); setIncomingCall(null);}} existingPeer={peerRef.current} initialTargetId={targetPeerId} incomingCall={incomingCall} secretPin={pinRef.current}/>}

            {/* LAYER 2: APP SCREENS */}
            <div className="flex-1 flex flex-col h-full w-full relative z-0">
                {mode === 'SELECT' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 relative animate-in fade-in duration-500">
                        <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none"></div>
                        <div className="text-center z-10 space-y-2 mb-10"><h1 className="text-5xl font-black italic tracking-tighter drop-shadow-lg">IStoic <span className="text-emerald-500">NET</span></h1><p className="text-[10px] text-neutral-500 font-mono tracking-widest">PWA READY • IOS OPTIMIZED</p></div>
                        <div className="grid gap-4 w-full max-w-xs z-10">
                            <button onClick={()=>{setAccessPin(Math.floor(100000+Math.random()*900000).toString()); setMode('HOST');}} className="p-5 bg-[#09090b] border border-white/10 hover:border-emerald-500/50 rounded-2xl flex items-center gap-4 transition-all active:scale-95 touch-manipulation group"><Server className="text-emerald-500 group-hover:scale-110 transition-transform"/><div><h3 className="font-bold">HOST SECURE</h3><p className="text-[9px] text-neutral-500">Create Private Room</p></div></button>
                            <button onClick={()=>setMode('JOIN')} className="p-5 bg-[#09090b] border border-white/10 hover:border-blue-500/50 rounded-2xl flex items-center gap-4 transition-all active:scale-95 touch-manipulation group"><ScanLine className="text-blue-500 group-hover:scale-110 transition-transform"/><div><h3 className="font-bold">JOIN TARGET</h3><p className="text-[9px] text-neutral-500">Scan or Input ID</p></div></button>
                            <button onClick={()=>setShowSidebar(true)} className="p-4 text-neutral-500 hover:text-white text-xs font-bold tracking-widest flex items-center justify-center gap-2 touch-manipulation"><Menu size={14}/> CONTACTS</button>
                        </div>
                        <SidebarIStokContact isOpen={showSidebar} onClose={()=>setShowSidebar(false)} sessions={sessions} profile={myProfile} onSelect={(s)=>{ setTargetPeerId(s.id); setAccessPin(s.pin); joinSession(s.id, s.pin); setShowSidebar(false); }} onCallContact={()=>{}} onRenameSession={()=>{}} onDeleteSession={()=>{}} onRegenerateProfile={()=>{}} currentPeerId={null} />
                    </div>
                )}

                {(mode === 'HOST' || mode === 'JOIN') && (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-black relative">
                        {showScanner && <div className="absolute inset-0 z-40 bg-black animate-in fade-in"><QRScanner onScan={handleQRScan} onClose={()=>setShowScanner(false)} /></div>}
                        <button onClick={()=>{setMode('SELECT'); setStage('IDLE');}} className="absolute top-6 left-6 z-30 text-neutral-500 hover:text-white flex items-center gap-2 text-xs font-bold pt-[env(safe-area-inset-top)]"><ArrowLeft size={16}/> ABORT</button>
                        {mode === 'HOST' ? (
                            <div className="w-full max-w-sm bg-[#09090b] border border-white/10 p-8 rounded-[32px] text-center space-y-6 animate-slide-up">
                                <Server className="text-emerald-500 mx-auto animate-pulse" size={48} />
                                <div><p className="text-[10px] text-neutral-500 font-mono mb-2">SIGNAL ID</p><code className="block bg-black p-3 rounded-lg border border-white/10 text-emerald-500 text-xs font-mono break-all select-all">{myProfile.id}</code></div>
                                <div><p className="text-[10px] text-neutral-500 font-mono mb-2">ACCESS PIN</p><div className="text-3xl font-black tracking-[0.5em]">{accessPin}</div></div>
                                <button onClick={()=>setShowShare(true)} className="w-full py-3 bg-white/5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 touch-manipulation border border-white/5"><QrCode size={14}/> SHOW QR</button>
                            </div>
                        ) : (
                            <div className="w-full max-w-sm space-y-4 animate-slide-up">
                                <div className="text-center mb-8"><div onClick={()=>setShowScanner(true)} className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 cursor-pointer hover:bg-blue-500/20 border border-blue-500/30 touch-manipulation"><ScanLine className="text-blue-500" size={32}/></div><h2 className="text-xl font-bold">ESTABLISH UPLINK</h2></div>
                                <input value={targetPeerId} onChange={e=>setTargetPeerId(e.target.value)} placeholder="TARGET ID" className="w-full bg-[#09090b] p-4 rounded-xl border border-white/10 text-center font-mono focus:border-blue-500 transition-colors"/>
                                <input value={accessPin} onChange={e=>setAccessPin(e.target.value)} placeholder="PIN" className="w-full bg-[#09090b] p-4 rounded-xl border border-white/10 text-center font-mono tracking-widest focus:border-blue-500 transition-colors"/>
                                <button onClick={()=>joinSession()} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 active:scale-95 transition-transform touch-manipulation">CONNECT NOW</button>
                            </div>
                        )}
                        {showShare && <ShareConnection peerId={myProfile.id} pin={accessPin} onClose={()=>setShowShare(false)}/>}
                    </div>
                )}

                {mode === 'CHAT' && (
                    <>
                        <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-[#09090b] z-20 pt-[calc(env(safe-area-inset-top)+3rem)]">
                            <button onClick={()=>{connRef.current?.close(); setMode('SELECT'); setMessages([]);}} className="touch-manipulation text-neutral-400 hover:text-white"><ArrowLeft size={20}/></button>
                            <div className="flex gap-4">
                                <button onClick={()=>triggerHaptic(50)} className="touch-manipulation"><Zap size={18} className="text-yellow-500"/></button>
                                <button onClick={()=>setShowCall(true)} className="touch-manipulation"><PhoneCall size={18} className="text-emerald-500"/></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scroll bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-95 overscroll-contain">
                            {messages.map(m => ( <MessageBubble key={m.id} msg={m} setViewImage={setViewImage} onBurn={(id: string)=>setMessages(p=>p.filter(x=>x.id!==id))} /> ))}
                            <div ref={msgEndRef} />
                        </div>
                        <IStokInput 
                            onSend={(t:string)=>sendMessage('TEXT', t)} onTyping={()=>{}} disabled={!isPeerOnline}
                            isRecording={isRecording} recordingTime={recordingTime} isVoiceMasked={isVoiceMasked}
                            onToggleMask={()=>setIsVoiceMasked(!isVoiceMasked)} onAttach={()=>fileInputRef.current?.click()}
                            ttlMode={ttlMode} onToggleTtl={()=>setTtlMode(p => p===0 ? 10 : (p===10 ? 60 : 0))}
                            onStartRecord={async ()=>{ try { const stream = await navigator.mediaDevices.getUserMedia({audio:true}); const recorder = new MediaRecorder(stream); mediaRecorderRef.current = recorder; audioChunksRef.current = []; recorder.ondataavailable = e => audioChunksRef.current.push(e.data); recorder.start(); setIsRecording(true); setRecordingTime(0); } catch(e) {}}}
                            onStopRecord={()=>{ if(mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); mediaRecorderRef.current.onstop = () => { const blob = new Blob(audioChunksRef.current, {type:'audio/webm'}); const reader = new FileReader(); reader.onloadend = () => { sendMessage('AUDIO', (reader.result as string).split(',')[1], {duration:recordingTime, isMasked:isVoiceMasked}); }; reader.readAsDataURL(blob); setIsRecording(false); };}}}
                            onAiAssist={handleAiAssist} isAiThinking={isAiThinking} translateTarget={translateTarget} setTranslateTarget={setTranslateTarget}
                        />
                    </>
                )}
            </div>

            <input type="file" ref={fileInputRef} className="hidden" onChange={(e)=>{ const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload = async (ev) => { if(f.type.startsWith('image/')) { const cmp = await compressImage(f); sendMessage('IMAGE', cmp.base64.split(',')[1], {size:cmp.size}); } else { sendMessage('FILE', (ev.target?.result as string).split(',')[1], {fileName:f.name, size:f.size, mimeType:f.type}); }}; r.readAsDataURL(f); }}}/>
        </div>
    );
};