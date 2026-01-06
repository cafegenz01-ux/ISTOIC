import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    encryptData, decryptData
} from '../../utils/crypto'; 
import { TeleponanView } from '../teleponan/TeleponanView';
import { activatePrivacyShield } from '../../utils/privacyShield';
import { 
    Send, Zap, ScanLine, Server,
    Mic, Menu, PhoneCall, 
    QrCode, Lock, Flame, 
    ShieldAlert, ArrowLeft, BrainCircuit, Sparkles,
    Wifi, WifiOff, Paperclip, Camera, Globe, Languages, Check, X
} from 'lucide-react';

// --- HOOKS & SERVICES ---
import useLocalStorage from '../../hooks/useLocalStorage';
import { OMNI_KERNEL } from '../../services/omniRace'; 
import { SidebarIStokContact, IStokSession, IStokProfile } from './components/SidebarIStokContact';
import { ShareConnection } from './components/ShareConnection'; 
import { ConnectionNotification } from './components/ConnectionNotification';
import { CallNotification } from './components/CallNotification';
import { MessageBubble } from './components/MessageBubble'; 
import { QRScanner } from './components/QRScanner'; 
import { compressImage } from './components/gambar';
import { AudioMessagePlayer } from './components/vn'; 

// --- CONSTANTS ---
const CHUNK_SIZE = 16384; 
const HEARTBEAT_MS = 3000; // Lebih agresif (3s)
const CONN_TIMEOUT_MS = 15000;

// Daftar Bahasa Professional
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
type ConnectionStage = 'IDLE' | 'LOCATING_PEER' | 'FETCHING_RELAYS' | 'VERIFYING_KEYS' | 'ESTABLISHING_TUNNEL' | 'AWAITING_APPROVAL' | 'SECURE' | 'RECONNECTING';

// --- UTILS ---
const generateAnomalyIdentity = () => `ANOMALY-${Math.floor(Math.random() * 9000) + 1000}`;
const generateStableId = () => `ISTOK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

const triggerHaptic = (ms: number | number[]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms);
};

const playSound = (type: 'MSG_IN' | 'MSG_OUT' | 'CONNECT' | 'CALL_RING' | 'BUZZ' | 'AI_THINK' | 'TRANSLATE') => {
    try {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        const now = ctx.currentTime;
        
        if (type === 'MSG_IN') {
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
        } else if (type === 'TRANSLATE') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(800, now + 0.1);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
        } else if (type === 'MSG_OUT') {
            osc.frequency.setValueAtTime(400, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.05);
            osc.start(now); osc.stop(now + 0.05);
        } else if (type === 'CONNECT') {
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.linearRampToValueAtTime(1200, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.2);
            osc.start(now); osc.stop(now + 0.2);
        } else if (type === 'CALL_RING') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.setValueAtTime(880, now + 0.5);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.setValueAtTime(0, now + 0.5);
            osc.start(now); osc.stop(now + 0.5);
        }
    } catch(e) {}
};

// --- AGGRESSIVE ICE CONFIGURATION ---
const getIceServers = async (): Promise<any[]> => {
    // Redundant Public STUNs for Cross-Country Fallback
    const publicIce = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ];

    try {
        const apiKey = import.meta.env.VITE_METERED_API_KEY;
        if (!apiKey) return publicIce;

        // Timeout 2 detik agar tidak blocking UI jika API lambat
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const response = await fetch(`https://istoic.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) return publicIce;
        const turnServers = await response.json();
        
        // Prioritaskan TURN, lalu STUN publik
        return [...turnServers, ...publicIce];
    } catch (e) {
        // Fail-safe return public servers immediately
        return publicIce;
    }
};

// --- SUB-COMPONENT: INPUT WITH AI TRANSLATE ---
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

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (showLangMenu && !(e.target as Element).closest('.lang-menu')) {
                setShowLangMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showLangMenu]);

    return (
        <div className="bg-[#09090b] border-t border-white/10 p-3 z-20 pb-[max(env(safe-area-inset-bottom),1rem)] relative">
            
            {showLangMenu && (
                <div className="lang-menu absolute bottom-full left-4 mb-2 bg-[#121214] border border-white/10 rounded-xl p-2 shadow-2xl w-48 animate-slide-up z-50">
                    <div className="text-[9px] font-bold text-neutral-500 mb-2 px-2 uppercase tracking-widest">AI CORE TRANSLATE</div>
                    <div className="space-y-1 max-h-48 overflow-y-auto custom-scroll">
                        <button 
                            onClick={() => { setTranslateTarget(null); setShowLangMenu(false); }}
                            className={`w-full flex items-center gap-2 p-2 rounded-lg text-xs font-bold transition-all ${!translateTarget ? 'bg-emerald-600 text-white' : 'text-neutral-400 hover:bg-white/5'}`}
                        >
                            <X size={12} /> OFF (Original)
                        </button>
                        {SUPPORTED_LANGUAGES.map(lang => (
                            <button 
                                key={lang.code}
                                onClick={() => { setTranslateTarget(lang); setShowLangMenu(false); }}
                                className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-bold transition-all ${translateTarget?.code === lang.code ? 'bg-blue-600 text-white' : 'text-neutral-300 hover:bg-white/5'}`}
                            >
                                <span className="flex items-center gap-2">{lang.icon} {lang.name}</span>
                                {translateTarget?.code === lang.code && <Check size={12}/>}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mb-2 px-1">
                 <div className="flex gap-2">
                     <button onClick={onToggleTtl} className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-wider transition-all ${ttlMode > 0 ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-white/5 border-white/5 text-neutral-500'}`}>
                        <Flame size={10} className={ttlMode > 0 ? 'fill-current' : ''} />
                        {ttlMode > 0 ? `${ttlMode}s` : 'OFF'}
                     </button>
                     
                     <button 
                        onClick={() => onAiAssist(text, insertText)} 
                        disabled={isAiThinking}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-wider transition-all ${isAiThinking ? 'bg-purple-500/20 border-purple-500 text-purple-400 animate-pulse' : 'bg-white/5 border-white/5 text-neutral-500 hover:text-purple-400 hover:border-purple-500/30'}`}
                     >
                        {isAiThinking ? <Sparkles size={10} className="animate-spin" /> : <BrainCircuit size={10} />}
                        {isAiThinking ? 'RACING...' : 'AI DRAFT'}
                     </button>

                     <button 
                        onClick={() => setShowLangMenu(!showLangMenu)}
                        className={`lang-menu flex items-center gap-1.5 px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-wider transition-all ${translateTarget ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-white/5 border-white/5 text-neutral-500 hover:text-white'}`}
                     >
                        <Globe size={10} />
                        {translateTarget ? translateTarget.code.toUpperCase() : 'LANG'}
                     </button>
                 </div>
                 
                 <span className="text-[8px] font-mono text-emerald-500/50 flex items-center gap-1"><Lock size={8}/> E2EE</span>
            </div>

            <div className="flex gap-2 items-end">
                <button onClick={onAttach} className="p-3 bg-white/5 rounded-full text-neutral-400 hover:text-white transition-colors"><Paperclip size={20}/></button>
                <div className="flex-1 bg-white/5 rounded-2xl px-4 py-3 border border-white/5 focus-within:border-emerald-500/30 transition-colors relative">
                    <input 
                        ref={inputRef}
                        value={text} 
                        onChange={e=>{setText(e.target.value); onTyping();}} 
                        onKeyDown={e=>e.key==='Enter'&&text.trim()&&(onSend(text),setText(''))} 
                        placeholder={isRecording ? "Recording..." : (translateTarget ? `Translating to ${translateTarget.name}...` : "Message...")} 
                        className="w-full bg-transparent outline-none text-white text-sm placeholder:text-neutral-600" 
                        disabled={disabled||isRecording || isAiThinking}
                    />
                </div>
                {text.trim() ? (
                    <button 
                        onClick={()=>{onSend(text); setText('');}} 
                        disabled={isAiThinking}
                        className={`p-3 rounded-full text-white shadow-lg transition-all active:scale-95 ${isAiThinking ? 'bg-neutral-700 cursor-wait' : (translateTarget ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500')}`}
                    >
                        {isAiThinking ? <Languages size={20} className="animate-pulse"/> : <Send size={20}/>}
                    </button>
                ) : (
                    <button 
                        onMouseDown={onStartRecord} onMouseUp={onStopRecord} 
                        onTouchStart={onStartRecord} onTouchEnd={onStopRecord} 
                        className={`p-3 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white shadow-[0_0_15px_red] animate-pulse' : 'bg-white/5 text-neutral-400'}`}
                    >
                        <Mic size={20}/>
                    </button>
                )}
            </div>
        </div>
    );
});

// --- MAIN COMPONENT ---

export const IStokView: React.FC = () => {
    // STATE
    const [mode, setMode] = useState<AppMode>('SELECT');
    const [stage, setStage] = useState<ConnectionStage>('IDLE');
    const [errorMsg, setErrorMsg] = useState<string>('');
    
    // DATA
    const [myProfile, setMyProfile] = useLocalStorage<IStokProfile>('istok_profile_v1', {
        id: generateStableId(),
        username: generateAnomalyIdentity(),
        created: Date.now()
    });
    const [sessions, setSessions] = useLocalStorage<IStokSession[]>('istok_sessions', []);
    
    // CONNECTION
    const [targetPeerId, setTargetPeerId] = useState<string>('');
    const [accessPin, setAccessPin] = useState<string>('');
    const [pendingJoin, setPendingJoin] = useState<{id:string, pin:string} | null>(null);
    
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
    
    // AI & TRANSLATION
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
    const recordingIntervalRef = useRef<any>(null);

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
                setTargetPeerId(connect);
                setAccessPin(key);
                setMode('JOIN');
                setPendingJoin({ id: connect, pin: key });
                window.history.replaceState({}, '', window.location.pathname);
            }
        } catch(e) {}
    }, []);

    // --- LOGIC: HELPER FUNCTIONS ---
    
    const startHeartbeat = useCallback(() => {
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
            if (!connRef.current?.open) {
                setIsPeerOnline(false);
                // Aggressive check: if not open, try to close cleanly to trigger reconnect
            } else {
                connRef.current.send({ type: 'PING' });
                setIsPeerOnline(true);
            }
        }, HEARTBEAT_MS);
    }, []);

    const handleDisconnect = useCallback(() => {
        setIsPeerOnline(false);
        setStage('RECONNECTING');
        // Auto-attempt reconnect logic could go here
    }, []);

    const handleData = useCallback(async (data: any, incomingConn?: any) => {
        if (data.type === 'CHUNK') {
            const { id, idx, total, chunk } = data;
            if(!chunkBuffer.current[id]) chunkBuffer.current[id] = { chunks: new Array(total), count:0, total };
            const buf = chunkBuffer.current[id];
            if(!buf.chunks[idx]) {
                buf.chunks[idx] = chunk;
                buf.count++;
            }
            if(buf.count === total) {
                const full = buf.chunks.join('');
                delete chunkBuffer.current[id]; // Cleanup memory immediately
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
                    setStage('SECURE');
                    setMode('CHAT');
                    setIsPeerOnline(true);
                    startHeartbeat();
                    playSound('CONNECT');
                    setSessions(prev => {
                        const exists = prev.find(s => s.id === connRef.current.peer);
                        const newSess: IStokSession = {
                            id: connRef.current.peer,
                            name: res.identity,
                            lastSeen: Date.now(),
                            status: 'ONLINE',
                            pin: currentPin,
                            createdAt: Date.now()
                        };
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
        else if (data.type === 'SIGNAL' && data.action === 'BUZZ') { triggerHaptic([100,50,100]); playSound('BUZZ'); }
        else if (data.type === 'PING') { setIsPeerOnline(true); } // Handle Keep-Alive
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
                    debug: 1, // Keep low for prod speed
                    secure: true,
                    config: { 
                        iceServers, 
                        sdpSemantics: 'unified-plan',
                        iceCandidatePoolSize: 10 // Pre-fetch candidates for speed
                    },
                    retry_timer: 500, // Faster retry
                });

                peer.on('open', () => {
                    console.log("[ISTOK_NET] Peer Ready (Aggressive Mode):", myProfile.id);
                    setStage('IDLE');
                    if (pendingJoin) {
                        setTimeout(() => joinSession(pendingJoin.id, pendingJoin.pin), 500);
                        setPendingJoin(null);
                    }
                });

                peer.on('connection', c => {
                    c.on('data', d => handleData(d, c));
                    c.on('close', handleDisconnect);
                    c.on('error', (e) => { console.warn("Conn Error", e); handleDisconnect(); });
                });

                peer.on('call', call => {
                    if (showCall) { call.close(); return; }
                    setIncomingCall(call);
                    playSound('CALL_RING');
                });

                peer.on('error', err => {
                    if (err.type === 'peer-unavailable') { 
                        setErrorMsg("Target Offline"); 
                        setStage('IDLE'); 
                    } else if (err.type === 'disconnected') { 
                        peer.reconnect(); // Aggressive Reconnect
                    } else if (err.type === 'network') {
                        // Network changed, force aggressive reconnect
                         setTimeout(() => peer.reconnect(), 1000);
                    }
                });

                peerRef.current = peer;
            } catch (e) {
                setErrorMsg("Net Init Fail");
            }
        };
        init();
        return () => { 
            mounted = false; 
            if(peerRef.current) peerRef.current.destroy(); 
            clearInterval(heartbeatRef.current);
        };
    }, []);

    // --- FUNCTIONS ---

    const joinSession = (id?: string, pin?: string) => {
        const target = id || targetPeerId;
        const key = pin || accessPin;
        if (!target || !key) return;

        if (!peerRef.current || peerRef.current.disconnected) {
            peerRef.current?.reconnect();
            setPendingJoin({id: target, pin: key});
            return;
        }

        setStage('LOCATING_PEER');
        
        // Aggressive Connection Config
        const conn = peerRef.current.connect(target, { 
            reliable: true,
            serialization: 'binary', // Faster than json
            metadata: { aggressive: true }
        });
        
        conn.on('open', async () => {
            setStage('VERIFYING_KEYS');
            connRef.current = conn;
            const payload = JSON.stringify({ type: 'CONNECTION_REQUEST', identity: myProfile.username });
            const encrypted = await encryptData(payload, key);
            
            if (encrypted) {
                conn.send({ type: 'REQ', payload: encrypted });
                setStage('AWAITING_APPROVAL');
            } else {
                conn.close();
                setErrorMsg("Encryption Failed");
            }
        });

        conn.on('data', (d: any) => handleData(d, conn));
        conn.on('close', handleDisconnect);
        conn.on('error', () => { setStage('IDLE'); setErrorMsg("Conn Error"); });
    };

    const handleQRScan = (data: string) => {
        setShowScanner(false);
        playSound('CONNECT');
        try {
            const url = new URL(data);
            const connect = url.searchParams.get('connect');
            const key = url.searchParams.get('key');
            if (connect && key) {
                joinSession(connect, key);
                return;
            }
        } catch(e) {}
        setTargetPeerId(data);
    };

    // --- POWERFUL AI FEATURES ---

    const handleAiAssist = async (currentText: string, setTextCallback: (t: string) => void) => {
        setIsAiThinking(true);
        playSound('AI_THINK');
        
        const context = messages.slice(-5).map(m => `${m.sender}: ${m.content}`).join('\n');
        const prompt = currentText ? 
            `Draft a continuation or reply for: "${currentText}". Context:\n${context}` : 
            `Suggest a reply to the last message. Context:\n${context}`;

        try {
            if (OMNI_KERNEL && OMNI_KERNEL.raceStream) {
                const stream = OMNI_KERNEL.raceStream(prompt, "You are a helpful, brief chat assistant. Respond in Indonesian.");
                let fullDraft = '';
                for await (const chunk of stream) {
                    if (chunk.text) {
                        fullDraft += chunk.text;
                        setTextCallback(fullDraft);
                    }
                }
            } else {
               setTimeout(() => setTextCallback("AI Engine not ready."), 1000);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsAiThinking(false);
        }
    };

    // --- CORE TRANSLATE LOGIC ---
    const performNeuralTranslation = async (text: string, langName: string): Promise<string> => {
        if (!text) return text;
        try {
            if (OMNI_KERNEL && OMNI_KERNEL.raceStream) {
                const prompt = `Translate the following text to ${langName}. 
                IMPORTANT: Maintain a professional, accurate, and culturally appropriate tone. 
                Do not add explanations, just return the translated text.
                Text: "${text}"`;
                
                const stream = OMNI_KERNEL.raceStream(prompt, "You are a professional translator engine.");
                let fullTranslation = '';
                for await (const chunk of stream) {
                    if (chunk.text) fullTranslation += chunk.text;
                }
                return fullTranslation.trim() || text;
            }
            return text + " [AI Offline]";
        } catch (e) {
            console.error("Translation Failed", e);
            return text;
        }
    };

    // --- SEND LOGIC ---
    const sendMessage = async (type: string, content: string, extras = {}) => {
        if (!connRef.current) return;
        
        let finalContent = content;
        let isTranslated = false;

        if (type === 'TEXT' && translateTarget && content.trim().length > 0) {
            setIsAiThinking(true);
            playSound('TRANSLATE');
            finalContent = await performNeuralTranslation(content, translateTarget.name);
            isTranslated = true;
            setIsAiThinking(false);
        }

        const msgId = crypto.randomUUID();
        const timestamp = Date.now();
        const payloadObj = { 
            id: msgId, 
            type, 
            content: finalContent, 
            timestamp, 
            ttl: ttlMode,
            isTranslated,
            originalLang: translateTarget ? translateTarget.name : undefined,
            ...extras 
        };
        
        const encrypted = await encryptData(JSON.stringify(payloadObj), pinRef.current);
        if (!encrypted) return;

        if (encrypted.length > CHUNK_SIZE) {
            const id = crypto.randomUUID();
            const total = Math.ceil(encrypted.length / CHUNK_SIZE);
            for(let i=0; i<total; i++) {
                connRef.current.send({
                    type: 'CHUNK', id, idx: i, total, 
                    chunk: encrypted.slice(i*CHUNK_SIZE, (i+1)*CHUNK_SIZE)
                });
            }
        } else {
            connRef.current.send({ type: 'MSG', payload: encrypted });
        }

        setMessages(p => [...p, { ...payloadObj, sender: 'ME', status: 'SENT' } as Message]);
        playSound('MSG_OUT');
    };

    // --- RENDER ---
    
    if (mode === 'SELECT') {
        return (
            <div className="h-[100dvh] bg-[#050505] flex flex-col items-center justify-center p-6 relative font-sans overflow-hidden">
                <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none"></div>
                
                {incomingRequest && (
                    <ConnectionNotification 
                        identity={incomingRequest.identity} 
                        peerId={incomingRequest.peerId} 
                        onAccept={async () => {
                            const { conn } = incomingRequest;
                            connRef.current = conn;
                            const payload = JSON.stringify({ type: 'CONNECTION_ACCEPT', identity: myProfile.username });
                            const enc = await encryptData(payload, pinRef.current);
                            if(enc) conn.send({type: 'RESP', payload: enc});
                            setStage('SECURE'); setMode('CHAT'); setIncomingRequest(null);
                            startHeartbeat();
                        }} 
                        onDecline={()=>{ setIncomingRequest(null); }} 
                    />
                )}

                <div className="text-center z-10 space-y-2 mb-10">
                    <h1 className="text-5xl font-black text-white italic tracking-tighter drop-shadow-lg">IStoic <span className="text-emerald-500">P2P</span></h1>
                    <div className="flex items-center justify-center gap-2">
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[9px] font-bold rounded border border-emerald-500/20">V5.0 HYPER-LINK</span>
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-[9px] font-bold rounded border border-blue-500/20">GLOBAL MESH</span>
                    </div>
                </div>

                <div className="grid gap-4 w-full max-w-xs z-10">
                    <button onClick={()=>{setAccessPin(Math.floor(100000+Math.random()*900000).toString()); setMode('HOST');}} className="group relative p-5 bg-[#09090b] border border-white/10 hover:border-emerald-500/50 rounded-2xl flex items-center gap-4 transition-all overflow-hidden">
                        <div className="absolute inset-0 bg-emerald-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                        <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500 relative"><Server size={24}/></div>
                        <div className="text-left relative">
                            <h3 className="text-white font-bold tracking-wide">HOST SECURE</h3>
                            <p className="text-[10px] text-neutral-500">Create Encrypted Room</p>
                        </div>
                    </button>

                    <button onClick={()=>setMode('JOIN')} className="group relative p-5 bg-[#09090b] border border-white/10 hover:border-blue-500/50 rounded-2xl flex items-center gap-4 transition-all overflow-hidden">
                        <div className="absolute inset-0 bg-blue-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                        <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500 relative"><ScanLine size={24}/></div>
                        <div className="text-left relative">
                            <h3 className="text-white font-bold tracking-wide">JOIN TARGET</h3>
                            <p className="text-[10px] text-neutral-500">Scan QR / Enter ID</p>
                        </div>
                    </button>
                    
                    <button onClick={()=>setShowSidebar(true)} className="p-4 text-neutral-500 hover:text-white text-xs font-bold tracking-widest flex items-center justify-center gap-2">
                        <Menu size={14}/> CONTACTS
                    </button>
                </div>

                <SidebarIStokContact 
                    isOpen={showSidebar} onClose={()=>setShowSidebar(false)} sessions={sessions} profile={myProfile}
                    onSelect={(s)=>{ setTargetPeerId(s.id); setAccessPin(s.pin); joinSession(s.id, s.pin); setShowSidebar(false); }}
                    onCallContact={()=>{}} onRenameSession={()=>{}} onDeleteSession={()=>{}} onRegenerateProfile={()=>{}} currentPeerId={null}
                />
            </div>
        );
    }

    if (mode === 'HOST' || mode === 'JOIN') {
        return (
            <div className="h-[100dvh] bg-black flex flex-col items-center justify-center p-6 relative">
                {showScanner && <QRScanner onScan={handleQRScan} onClose={()=>setShowScanner(false)} />}

                <button onClick={()=>{setMode('SELECT'); setStage('IDLE');}} className="absolute top-6 left-6 text-neutral-500 hover:text-white flex items-center gap-2 text-xs font-bold"><ArrowLeft size={16}/> ABORT</button>
                
                {mode === 'HOST' ? (
                    <div className="w-full max-w-sm bg-[#09090b] border border-white/10 p-8 rounded-[32px] text-center space-y-6 animate-slide-up">
                        <div className="relative inline-flex">
                            <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-20 animate-pulse"></div>
                            <Server className="text-emerald-500 relative z-10" size={48} />
                        </div>
                        <div>
                            <p className="text-[10px] text-neutral-500 font-mono mb-2">SIGNAL ID</p>
                            <code className="block bg-black p-3 rounded-lg border border-white/10 text-emerald-500 text-xs font-mono break-all select-all">{myProfile.id}</code>
                        </div>
                        <div>
                            <p className="text-[10px] text-neutral-500 font-mono mb-2">ACCESS PIN</p>
                            <div className="text-3xl font-black text-white tracking-[0.5em]">{accessPin}</div>
                        </div>
                        <button onClick={()=>setShowShare(true)} className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-2 border border-white/5"><QrCode size={14}/> SHOW QR</button>
                    </div>
                ) : (
                    <div className="w-full max-w-sm space-y-4 animate-slide-up">
                        <div className="text-center mb-8">
                            <div onClick={()=>setShowScanner(true)} className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 cursor-pointer hover:bg-blue-500/20 transition border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                                <ScanLine className="text-blue-500" size={32}/>
                            </div>
                            <h2 className="text-xl font-bold text-white">ESTABLISH UPLINK</h2>
                            <p className="text-xs text-neutral-500">Tap icon to scan Neural Code</p>
                        </div>
                        
                        {stage === 'IDLE' ? (
                            <>
                                <input value={targetPeerId} onChange={e=>setTargetPeerId(e.target.value)} placeholder="TARGET ID" className="w-full bg-[#09090b] p-4 rounded-xl text-white border border-white/10 outline-none text-center font-mono focus:border-blue-500 transition-colors"/>
                                <input value={accessPin} onChange={e=>setAccessPin(e.target.value)} placeholder="PIN" className="w-full bg-[#09090b] p-4 rounded-xl text-white border border-white/10 outline-none text-center font-mono tracking-widest focus:border-blue-500 transition-colors"/>
                                <div className="flex gap-3">
                                    <button onClick={()=>setShowScanner(true)} className="p-4 bg-white/5 hover:bg-white/10 rounded-xl text-white border border-white/5"><Camera size={20}/></button>
                                    <button onClick={()=>joinSession()} className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20">CONNECT</button>
                                </div>
                            </>
                        ) : (
                            <div className="flex justify-center"><div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div></div>
                        )}
                        {errorMsg && <div className="text-red-500 text-xs text-center font-mono bg-red-500/10 p-2 rounded">{errorMsg}</div>}
                    </div>
                )}
                {showShare && <ShareConnection peerId={myProfile.id} pin={accessPin} onClose={()=>setShowShare(false)}/>}
            </div>
        );
    }

    // CHAT MODE
    return (
        <div className="h-[100dvh] bg-[#050505] flex flex-col font-sans relative">
            {/* OVERLAYS */}
            {viewImage && <div className="fixed inset-0 z-[50] bg-black/95 flex items-center justify-center p-4" onClick={()=>setViewImage(null)}><img src={viewImage} className="max-w-full max-h-full rounded shadow-2xl"/></div>}
            
            {incomingCall && !showCall && <CallNotification identity={incomingCall.peer} onAnswer={()=>{setShowCall(true)}} onDecline={()=>{incomingCall.close(); setIncomingCall(null);}} />}
            
            {showCall && <TeleponanView onClose={()=>{setShowCall(false); setIncomingCall(null);}} existingPeer={peerRef.current} initialTargetId={targetPeerId} incomingCall={incomingCall} secretPin={pinRef.current}/>}

            {/* HEADER */}
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-[#09090b] z-20 pt-[calc(env(safe-area-inset-top)+1rem)]">
                <div className="flex items-center gap-3">
                    <button onClick={()=>{connRef.current?.close(); setMode('SELECT'); setMessages([]);}} className="text-neutral-400 hover:text-white"><ArrowLeft size={20}/></button>
                    <div className={`w-2.5 h-2.5 rounded-full ${isPeerOnline ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-red-500'}`}></div>
                    <div>
                        <h1 className="text-xs font-black text-white tracking-widest">SECURE_LINK</h1>
                        <span className="text-[8px] text-neutral-500 font-mono uppercase">{stage}</span>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={()=>{connRef.current?.send({type:'SIGNAL', action:'BUZZ'}); triggerHaptic(50);}} className="text-yellow-500 hover:text-yellow-400"><Zap size={18}/></button>
                    <button onClick={()=>setShowCall(true)} className="text-emerald-500 hover:text-emerald-400"><PhoneCall size={18}/></button>
                </div>
            </div>

            {/* MESSAGES */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scroll bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-95">
                {messages.map(m => (
                    <MessageBubble key={m.id} msg={m} setViewImage={setViewImage} onBurn={(id: string)=>setMessages(p=>p.filter(x=>x.id!==id))} />
                ))}
                {!isPeerOnline && <div className="flex justify-center mt-4"><span className="bg-red-500/20 text-red-500 text-[10px] px-3 py-1 rounded-full flex items-center gap-2"><WifiOff size={10}/> RECONNECTING...</span></div>}
                <div ref={msgEndRef} />
            </div>

            {/* INPUT */}
            <IStokInput 
                onSend={(t:string)=>sendMessage('TEXT', t)}
                onTyping={()=>{}}
                disabled={!isPeerOnline}
                isRecording={isRecording}
                recordingTime={recordingTime}
                isVoiceMasked={isVoiceMasked}
                onToggleMask={()=>setIsVoiceMasked(!isVoiceMasked)}
                onStartRecord={async ()=>{
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({audio:true});
                        const recorder = new MediaRecorder(stream);
                        mediaRecorderRef.current = recorder;
                        audioChunksRef.current = [];
                        recorder.ondataavailable = e => audioChunksRef.current.push(e.data);
                        recorder.start();
                        setIsRecording(true);
                        setRecordingTime(0);
                        recordingIntervalRef.current = setInterval(()=>setRecordingTime(p=>p+1),1000);
                    } catch(e) { alert("Mic Error"); }
                }}
                onStopRecord={()=>{
                    if(mediaRecorderRef.current && isRecording) {
                        mediaRecorderRef.current.stop();
                        mediaRecorderRef.current.onstop = () => {
                            const blob = new Blob(audioChunksRef.current, {type:'audio/webm'});
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                const b64 = (reader.result as string).split(',')[1];
                                sendMessage('AUDIO', b64, {duration:recordingTime, isMasked:isVoiceMasked});
                            };
                            reader.readAsDataURL(blob);
                            setIsRecording(false);
                            clearInterval(recordingIntervalRef.current);
                        };
                    }
                }}
                onAttach={()=>fileInputRef.current?.click()}
                ttlMode={ttlMode}
                onToggleTtl={()=>setTtlMode(p => p===0 ? 10 : (p===10 ? 60 : 0))}
                onAiAssist={handleAiAssist}
                isAiThinking={isAiThinking}
                translateTarget={translateTarget}
                setTranslateTarget={setTranslateTarget}
            />
            <input type="file" ref={fileInputRef} className="hidden" onChange={(e)=>{
                const f = e.target.files?.[0];
                if(!f) return;
                const r = new FileReader();
                r.onload = async (ev) => {
                    const res = ev.target?.result as string;
                    if(f.type.startsWith('image/')) {
                        const cmp = await compressImage(f);
                        sendMessage('IMAGE', cmp.base64.split(',')[1], {size:cmp.size});
                    } else {
                        sendMessage('FILE', res.split(',')[1], {fileName:f.name, size:f.size, mimeType:f.type});
                    }
                };
                r.readAsDataURL(f);
            }}/>
        </div>
    );
};
