<<<<<<< HEAD

=======
>>>>>>> cba0f26f110ed36eac3dba75de5717bb2dde361b
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    encryptData, decryptData
} from '../../utils/crypto'; 
import { TeleponanView } from '../teleponan/TeleponanView';
import { activatePrivacyShield } from '../../utils/privacyShield';
import { 
    Send, Zap, ScanLine, Server, X,
    Mic, Menu, PhoneCall, 
    QrCode, Lock, Flame, 
    ShieldAlert, ArrowLeft, BrainCircuit, Sparkles,
    Wifi, WifiOff, Paperclip, Camera, Globe, Languages, Check,
<<<<<<< HEAD
    Activity, Signal, Radio, Loader2, User
=======
    Activity, Signal, Radio
>>>>>>> cba0f26f110ed36eac3dba75de5717bb2dde361b
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
<<<<<<< HEAD
import { IStokWalkieTalkie } from './components/IStokWalkieTalkie'; 
import { MediaDrawer } from './components/MediaDrawer';
=======
// import { AudioMessagePlayer } from './components/vn'; // Uncomment jika sudah ada filenya
>>>>>>> cba0f26f110ed36eac3dba75de5717bb2dde361b

// --- HYDRA CONSTANTS ---
const CHUNK_SIZE = 65536; // 64KB Chunks for 5G/WiFi6 Optimization
const HEARTBEAT_MS = 1500; // Hyper-aggressive heartbeat
const HYDRA_RECONNECT_LIMIT = 50; // Hampir tak terbatas
const ICE_GATHERING_TIMEOUT = 4000;

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
type ConnectionStage = 'IDLE' | 'LOCATING_PEER' | 'HYDRA_RACE' | 'VERIFYING_KEYS' | 'SECURE_TUNNEL' | 'AWAITING_APPROVAL' | 'SECURE' | 'RECONNECTING' | 'NETWORK_SWITCH';

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

// --- HYDRA & OMNI NETWORK LOGIC ---
const getHydraIceServers = async (): Promise<any[]> => {
    // 1. Base Layer: Google STUN (Fastest for same-network)
    const baseStun = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
    ];

    try {
<<<<<<< HEAD
        const apiKey = (import.meta as any).env.VITE_METERED_API_KEY;
=======
        const apiKey = import.meta.env.VITE_METERED_API_KEY;
>>>>>>> cba0f26f110ed36eac3dba75de5717bb2dde361b
        if (!apiKey) {
            console.warn("[HYDRA] No Metered API Key found. Fallback to STUN only.");
            return baseStun;
        }

        // 2. Relay Layer: Metered.ca (Essential for 4G <-> WiFi)
        // Race logic: Fetch credential as fast as possible
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`https://istoic.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`, {
            signal: controller.signal,
            method: 'GET'
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error("Metered API Rejected");
        
        const turnServers = await response.json();
        
        // 3. OMNI Merge: Combine Lists for Maximum Reachability
        console.log("[HYDRA] Metered TURN Injectors Active");
        return [...baseStun, ...turnServers];
    } catch (e) {
        console.error("[HYDRA] ICE Fetch Failed, using Swarm Backup", e);
        return baseStun;
    }
};

// --- SUB-COMPONENT: INPUT ---
const IStokInput = React.memo(({ 
    onSend, onTyping, disabled, isRecording, recordingTime, 
    isVoiceMasked, onToggleMask, onStartRecord, onStopRecord, 
    onAttach, ttlMode, onToggleTtl, onAiAssist, isAiThinking,
    translateTarget, setTranslateTarget, connectionQuality, networkType
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
        <div className="bg-[#09090b] border-t border-white/10 p-3 z-20 pb-[max(env(safe-area-inset-bottom),1rem)] relative shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
            
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
                 
                 <div className="flex items-center gap-2">
                    <span className="text-[8px] font-mono text-neutral-500 uppercase flex items-center gap-1">
                        {networkType === 'wifi' ? <Wifi size={8}/> : <Radio size={8}/>} {networkType || 'NET'}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full ${connectionQuality > 80 ? 'bg-emerald-500' : 'bg-yellow-500'} animate-pulse`}></span>
                    <span className="text-[8px] font-mono text-emerald-500/50 flex items-center gap-1"><Lock size={8}/> E2EE</span>
                 </div>
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
    const [connectionQuality, setConnectionQuality] = useState(100);
    const [networkType, setNetworkType] = useState<string>('unknown');
    
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
<<<<<<< HEAD
    const [showWalkieTalkie, setShowWalkieTalkie] = useState(false);
    const [showMediaDrawer, setShowMediaDrawer] = useState(false);
=======
>>>>>>> cba0f26f110ed36eac3dba75de5717bb2dde361b
    
    // CHAT & MEDIA
    const [messages, setMessages] = useState<Message[]>([]);
    const [isPeerOnline, setIsPeerOnline] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isVoiceMasked, setIsVoiceMasked] = useState(false);
    const [ttlMode, setTtlMode] = useState(0); 
    
    // AI
    const [isAiThinking, setIsAiThinking] = useState(false); 
    const [translateTarget, setTranslateTarget] = useState<any>(null);

    // NOTIFICATIONS
    const [incomingRequest, setIncomingRequest] = useState<any>(null);
    const [incomingCall, setIncomingCall] = useState<any>(null);

    // REFS (CRITICAL FOR HYDRA)
    const peerRef = useRef<any>(null);
    const connRef = useRef<any>(null);
    const pinRef = useRef(accessPin);
    const msgEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chunkBuffer = useRef<any>({});
    const heartbeatRef = useRef<any>(null);
    const reconnectAttemptsRef = useRef(0);
<<<<<<< HEAD
=======
    const mediaRecorderRef = useRef<MediaRecorder|null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingIntervalRef = useRef<any>(null);
>>>>>>> cba0f26f110ed36eac3dba75de5717bb2dde361b
    
    // --- NETWORK LISTENER (HYDRA SENSE) ---
    useEffect(() => {
        const updateNetworkInfo = () => {
            const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
            if (conn) {
                setNetworkType(conn.effectiveType || conn.type || 'unknown');
            }
        };
        updateNetworkInfo();
        
        const handleNetworkChange = () => {
            console.log("[HYDRA] Network Topology Changed. Triggering Re-Route...");
            setNetworkType((prev) => 'switch-' + Date.now());
            if (stage === 'SECURE' && targetPeerId && accessPin) {
                setStage('NETWORK_SWITCH');
                setTimeout(() => {
                    handleDisconnect(); 
                }, 1000);
            }
        };

        window.addEventListener('online', handleNetworkChange);
        window.addEventListener('offline', handleNetworkChange);
        const conn = (navigator as any).connection;
        if (conn) conn.addEventListener('change', handleNetworkChange);

        return () => {
            window.removeEventListener('online', handleNetworkChange);
            window.removeEventListener('offline', handleNetworkChange);
            if (conn) conn.removeEventListener('change', handleNetworkChange);
        };
    }, [stage, targetPeerId, accessPin]);

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

    // --- AGGRESSIVE CONNECTION LOGIC ---
    
    const startHeartbeat = useCallback(() => {
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
            if (!connRef.current?.open) {
                if (isPeerOnline) handleDisconnect();
            } else {
                connRef.current.send({ type: 'PING' });
                reconnectAttemptsRef.current = 0;
            }
        }, HEARTBEAT_MS);
    }, [isPeerOnline]); 

    const handleDisconnect = useCallback(() => {
        setIsPeerOnline(false);
        setStage('RECONNECTING');
        
        if (reconnectAttemptsRef.current < HYDRA_RECONNECT_LIMIT && targetPeerId && accessPin) {
            reconnectAttemptsRef.current++;
            console.log(`[HYDRA] Healing Link... Attempt ${reconnectAttemptsRef.current}`);
            setTimeout(() => joinSession(targetPeerId, accessPin), 1000); 
        } else {
            setErrorMsg("Link Severed. Network Unstable.");
        }
    }, [targetPeerId, accessPin]);

    const handleData = useCallback(async (data: any, incomingConn?: any) => {
        if (data.type === 'PING') {
            setIsPeerOnline(true);
            setConnectionQuality(100);
            return;
        }

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
                delete chunkBuffer.current[id];
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
        else if (data.type === 'SIGNAL' && data.action === 'BUZZ') { triggerHaptic([100,50,100,50,100]); playSound('BUZZ'); }
    }, [startHeartbeat, setSessions, targetPeerId, accessPin]);

    // --- PEER INIT (HYDRA CONFIG) ---
    useEffect(() => {
        let mounted = true;
        if (peerRef.current) return;

        const init = async () => {
            try {
                setStage('HYDRA_RACE');
                const iceServers = await getHydraIceServers(); 
                
                const { Peer } = await import('peerjs');
                if (!mounted) return;

                const peer = new Peer(myProfile.id, {
                    debug: 0,
                    secure: true,
                    config: { 
                        iceServers, 
                        sdpSemantics: 'unified-plan', 
<<<<<<< HEAD
                        iceCandidatePoolSize: 10, 
                        iceTransportPolicy: 'all' 
                    },
                    retry_timer: 500
                } as any);
=======
                        iceCandidatePoolSize: 10,
                        iceTransportPolicy: 'all' 
                    },
                    retry_timer: 500
                });
>>>>>>> cba0f26f110ed36eac3dba75de5717bb2dde361b

                peer.on('open', () => {
                    console.log("[HYDRA] Node Active:", myProfile.id);
                    setStage('IDLE');
                    if (pendingJoin) {
                        setTimeout(() => joinSession(pendingJoin.id, pendingJoin.pin), 500); 
                        setPendingJoin(null);
                    }
                });

                peer.on('connection', c => {
                    c.on('data', d => handleData(d, c));
                    c.on('close', handleDisconnect);
                    c.on('error', (err) => console.warn("Conn Error", err));
                });

                peer.on('call', call => {
                    if (showCall) { call.close(); return; }
                    setIncomingCall(call);
                    playSound('CALL_RING');
                });

                peer.on('error', err => {
                    console.error("[PEER ERR]", err);
                    if (err.type === 'peer-unavailable') { 
                        setErrorMsg("Target Offline"); 
                        setStage('IDLE'); 
                    }
                    else if (err.type === 'disconnected') { 
                        peer.reconnect(); 
                    }
                    else if (err.type === 'network') {
                        setErrorMsg("Net Fail. Retrying...");
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
        const conn = peerRef.current.connect(target, { 
            reliable: true,
            serialization: 'json',
            metadata: {
                ua: navigator.userAgent
            }
        });
        
        const timeoutGuard = setTimeout(() => {
            if (stage === 'LOCATING_PEER') {
                conn.close();
                setStage('IDLE');
                setErrorMsg("Timeout. Retrying...");
            }
        }, 15000);

        conn.on('open', async () => {
            clearTimeout(timeoutGuard);
            setStage('VERIFYING_KEYS');
            connRef.current = conn;
            const payload = JSON.stringify({ type: 'CONNECTION_REQUEST', identity: myProfile.username });
            const encrypted = await encryptData(payload, key);
            
            if (encrypted) {
                conn.send({ type: 'REQ', payload: encrypted });
                setStage('AWAITING_APPROVAL');
            } else {
                conn.close();
                setErrorMsg("Crypto Fail");
            }
        });

        conn.on('data', (d: any) => handleData(d, conn));
        conn.on('close', handleDisconnect);
        conn.on('error', (e: any) => { 
            clearTimeout(timeoutGuard);
            setStage('IDLE'); 
            setErrorMsg("Conn Rejected"); 
        });
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

    // --- IMPROVED AI FEATURES (CONTEXT AWARE & ROBUST) ---

    const handleAiAssist = async (currentText: string, setTextCallback: (t: string) => void) => {
        setIsAiThinking(true);
        playSound('AI_THINK');
        
<<<<<<< HEAD
=======
        // Mengambil 10 Pesan Terakhir untuk konteks yang lebih dalam
>>>>>>> cba0f26f110ed36eac3dba75de5717bb2dde361b
        const context = messages.slice(-10).map(m => `[${m.sender}]: ${m.content}`).join('\n');
        
        let prompt = "";
        if (currentText) {
            prompt = `You are a sophisticated AI assistant in a secure chat app. The user is typing: "${currentText}". Based on the context below, complete this sentence or draft a better version of it. Keep it concise, professional, and tactical.\n\nContext:\n${context}`;
        } else {
            prompt = `You are a sophisticated AI assistant. Based on the conversation context below, suggest a relevant and intelligent reply for the user (ME). Format: just the text options.\n\nContext:\n${context}`;
        }

        try {
            if (OMNI_KERNEL && OMNI_KERNEL.raceStream) {
                const stream = OMNI_KERNEL.raceStream(prompt, "System AI Agent");
                let fullDraft = '';
                for await (const chunk of stream) {
                    if (chunk.text) {
                        fullDraft += chunk.text;
                        setTextCallback(fullDraft);
                    }
                }
            } else {
<<<<<<< HEAD
=======
               // Fallback cerdas jika Kernel Offline atau lambat
>>>>>>> cba0f26f110ed36eac3dba75de5717bb2dde361b
               setTimeout(() => {
                   const fallbacks = [
                       "Acknowledged. Proceeding.",
                       "Can you elaborate on that?",
                       "Data received. Analyzing.",
                       "Standby for confirmation."
                   ];
                   const randomReply = fallbacks[Math.floor(Math.random() * fallbacks.length)];
                   setTextCallback(currentText ? `${currentText}...` : randomReply);
               }, 800);
            }
        } catch (e) {
            console.error("AI Core Error:", e);
        } finally {
            setIsAiThinking(false);
        }
    };

    const performNeuralTranslation = async (text: string, langName: string): Promise<string> => {
        if (!text) return text;
        try {
            if (OMNI_KERNEL && OMNI_KERNEL.raceStream) {
                const prompt = `Translate the following text to ${langName} immediately. Only output the translation, no explanations. Text: "${text}"`;
                const stream = OMNI_KERNEL.raceStream(prompt, "Translator.");
                let fullTranslation = '';
                for await (const chunk of stream) {
                    if (chunk.text) fullTranslation += chunk.text;
                }
                return fullTranslation.trim() || text;
            }
            return text;
        } catch (e) {
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
                if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
            }
        } else {
            connRef.current.send({ type: 'MSG', payload: encrypted });
        }

        setMessages(p => [...p, { ...payloadObj, sender: 'ME', status: 'SENT' } as Message]);
        playSound('MSG_OUT');
    };

    // ==========================================
    // GLOBAL OVERLAY (NOTIFIKASI LEVEL TERATAS)
    // ==========================================
    const renderGlobalNotification = () => {
        if (!incomingRequest) return null;

        return (
            <div className="fixed inset-0 w-full h-full z-[1000000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="w-full max-w-md relative z-[1000001]">
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
                </div>
            </div>
        );
    };

    // ==========================================
    // APP CONTENT RENDERER
    // ==========================================
    const renderAppContent = () => {
        if (mode === 'SELECT') {
            return (
                <div className="h-[100dvh] bg-[#050505] flex flex-col items-center justify-center p-6 relative font-sans overflow-hidden">
                    <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none"></div>
                    
                    <div className="text-center z-10 space-y-2 mb-10">
                        <h1 className="text-5xl font-black text-white italic tracking-tighter drop-shadow-lg">IStoic <span className="text-emerald-500">HYDRA</span></h1>
                        <div className="flex items-center justify-center gap-2">
                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[9px] font-bold rounded border border-emerald-500/20 flex items-center gap-1"><Zap size={8}/> 4G/WiFi OMNI</span>
                            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-[9px] font-bold rounded border border-blue-500/20">METERED.CA ACCELERATED</span>
                        </div>
                    </div>

                    <div className="grid gap-4 w-full max-w-xs z-10">
                        <button onClick={()=>{setAccessPin(Math.floor(100000+Math.random()*900000).toString()); setMode('HOST');}} className="group relative p-5 bg-[#09090b] border border-white/10 hover:border-emerald-500/50 rounded-2xl flex items-center gap-4 transition-all overflow-hidden">
                            <div className="absolute inset-0 bg-emerald-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500 relative"><Server size={24}/></div>
                            <div className="text-left relative">
                                <h3 className="text-white font-bold tracking-wide">HOST SECURE</h3>
                                <p className="text-[10px] text-neutral-500">Master Node / Room</p>
                            </div>
                        </button>

                        <button onClick={()=>setMode('JOIN')} className="group relative p-5 bg-[#09090b] border border-white/10 hover:border-blue-500/50 rounded-2xl flex items-center gap-4 transition-all overflow-hidden">
                            <div className="absolute inset-0 bg-blue-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500 relative"><ScanLine size={24}/></div>
                            <div className="text-left relative">
                                <h3 className="text-white font-bold tracking-wide">JOIN TARGET</h3>
                                <p className="text-[10px] text-neutral-500">Universal Uplink</p>
                            </div>
                        </button>
                        
                        <button onClick={()=>setShowSidebar(true)} className="p-4 text-neutral-500 hover:text-white text-xs font-bold tracking-widest flex items-center justify-center gap-2">
                            <Menu size={14}/> CONTACTS
                        </button>
                    </div>

                    <div className="relative z-50">
                        <SidebarIStokContact 
                            isOpen={showSidebar} onClose={()=>setShowSidebar(false)} sessions={sessions} profile={myProfile}
                            onSelect={(s)=>{ setTargetPeerId(s.id); setAccessPin(s.pin); joinSession(s.id, s.pin); setShowSidebar(false); }}
                            onCallContact={()=>{}} onRenameSession={()=>{}} onDeleteSession={()=>{}} onRegenerateProfile={()=>{}} currentPeerId={null}
                        />
                    </div>
                </div>
            );
        }

        if (mode === 'HOST' || mode === 'JOIN') {
            return (
                <div className="h-[100dvh] bg-black flex flex-col items-center justify-center p-6 relative z-0">
                    {showScanner && <div className="z-10"><QRScanner onScan={handleQRScan} onClose={()=>setShowScanner(false)} /></div>}

                    <button onClick={()=>{setMode('SELECT'); setStage('IDLE');}} className="absolute top-6 left-6 text-neutral-500 hover:text-white flex items-center gap-2 text-xs font-bold z-20"><ArrowLeft size={16}/> ABORT</button>
                    
                    {mode === 'HOST' ? (
                        <div className="w-full max-w-sm bg-[#09090b] border border-white/10 p-8 rounded-[32px] text-center space-y-6 animate-slide-up relative overflow-hidden z-10">
                            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none"></div>
                            <div className="relative inline-flex">
                                <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-20 animate-pulse"></div>
                                <Server className="text-emerald-500 relative z-10" size={48} />
                            </div>
                            <div>
                                <p className="text-[10px] text-neutral-500 font-mono mb-2">SIGNAL ID</p>
                                <code className="block bg-black p-3 rounded-lg border border-white/10 text-emerald-500 text-xs font-mono break-all select-all shadow-inner">{myProfile.id}</code>
                            </div>
                            <div>
                                <p className="text-[10px] text-neutral-500 font-mono mb-2">ACCESS PIN</p>
                                <div className="text-3xl font-black text-white tracking-[0.5em]">{accessPin}</div>
                            </div>
                            <button onClick={()=>setShowShare(true)} className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-2 border border-white/5"><QrCode size={14}/> SHOW QR</button>
                        </div>
                    ) : (
                        <div className="w-full max-w-sm space-y-4 animate-slide-up z-10">
                            <div className="text-center mb-8">
                                <div onClick={()=>setShowScanner(true)} className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 cursor-pointer hover:bg-blue-500/20 transition border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                                    <ScanLine className="text-blue-500" size={32}/>
                                </div>
                                <h2 className="text-xl font-bold text-white">ESTABLISH UPLINK</h2>
                                <p className="text-xs text-neutral-500">Global Search & Connect</p>
                            </div>
                            
                            {stage === 'IDLE' ? (
                                <>
                                    <input value={targetPeerId} onChange={e=>setTargetPeerId(e.target.value)} placeholder="TARGET ID" className="w-full bg-[#09090b] p-4 rounded-xl text-white border border-white/10 outline-none text-center font-mono focus:border-blue-500 transition-colors shadow-inner"/>
                                    <input value={accessPin} onChange={e=>setAccessPin(e.target.value)} placeholder="PIN" className="w-full bg-[#09090b] p-4 rounded-xl text-white border border-white/10 outline-none text-center font-mono tracking-widest focus:border-blue-500 transition-colors shadow-inner"/>
                                    <div className="flex gap-3">
                                        <button onClick={()=>setShowScanner(true)} className="p-4 bg-white/5 hover:bg-white/10 rounded-xl text-white border border-white/5"><Camera size={20}/></button>
                                        <button onClick={()=>joinSession()} className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-95">CONNECT NOW</button>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center space-y-4">
<<<<<<< HEAD
                                    <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                                    <p className="text-blue-500 text-xs font-bold animate-pulse uppercase tracking-widest">{stage.replace('_', ' ')}...</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            );
        }

        if (mode === 'CHAT') {
            return (
                <div className="h-[100dvh] bg-[#050505] flex flex-col relative overflow-hidden">
                    {/* Background */}
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none"></div>
                    
                    {/* Header */}
                    <div className="bg-[#09090b]/90 backdrop-blur-md border-b border-white/5 p-4 pt-safe flex items-center justify-between z-30 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-900 to-emerald-700 flex items-center justify-center text-white font-bold text-sm shadow-inner border border-white/10">
                                    <User size={18}/>
                                </div>
                                {isPeerOnline && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#09090b]"></div>}
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    SECURE_PEER 
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[8px] font-black tracking-wider border border-emerald-500/20">E2EE</span>
                                </h3>
                                <p className="text-[10px] text-neutral-500 font-mono flex items-center gap-2">
                                    {isPeerOnline ? 'ONLINE' : 'CONNECTING...'} 
                                    {isPeerOnline && <span className="text-emerald-500/50">| {connectionQuality}% SIG</span>}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={()=>setShowCall(true)} className="p-2.5 bg-white/5 hover:bg-emerald-500/20 text-neutral-400 hover:text-emerald-500 rounded-xl transition-all"><PhoneCall size={18}/></button>
                            <button onClick={()=>setShowWalkieTalkie(true)} className="p-2.5 bg-white/5 hover:bg-emerald-500/20 text-neutral-400 hover:text-emerald-500 rounded-xl transition-all"><Radio size={18}/></button>
                            <button onClick={()=>setShowMediaDrawer(true)} className="p-2.5 bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white rounded-xl transition-all hidden md:block"><Server size={18}/></button>
                            <button onClick={()=>setShowSidebar(true)} className="p-2.5 bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white rounded-xl transition-all"><Menu size={18}/></button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scroll space-y-4">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full opacity-30 gap-4">
                                <ShieldAlert size={64} strokeWidth={1} className="text-emerald-500"/>
                                <p className="text-xs font-black uppercase tracking-[0.2em] text-center">ENCRYPTED CHANNEL ESTABLISHED<br/>NO LOGS PERSIST</p>
                            </div>
                        )}
                        {messages.map(msg => (
                            <MessageBubble key={msg.id} msg={msg} setViewImage={setViewImage} />
                        ))}
                        <div ref={msgEndRef}></div>
                    </div>

                    {/* Input Area */}
                    <IStokInput 
                        onSend={(txt: string)=>sendMessage('TEXT', txt)}
                        onTyping={()=>{}}
                        disabled={!isPeerOnline}
                        isRecording={isRecording}
                        recordingTime={recordingTime}
                        isVoiceMasked={isVoiceMasked}
                        onToggleMask={()=>setIsVoiceMasked(!isVoiceMasked)}
                        onStartRecord={()=>{}} // Add audio logic if needed, simplied for now or use walkie talkie
                        onStopRecord={()=>{}}
                        onAttach={()=>fileInputRef.current?.click()}
                        ttlMode={ttlMode}
                        onToggleTtl={()=>setTtlMode(prev => prev === 0 ? 30 : prev === 30 ? 60 : 0)}
                        onAiAssist={handleAiAssist}
                        isAiThinking={isAiThinking}
                        translateTarget={translateTarget}
                        setTranslateTarget={setTranslateTarget}
                        connectionQuality={connectionQuality}
                        networkType={networkType}
                    />

                    {/* Overlays */}
                    <input type="file" multiple ref={fileInputRef} className="hidden" onChange={(e) => {
                        if(e.target.files) {
                            Array.from(e.target.files).forEach(file => {
                                // Simple file handling
                                if(file.type.startsWith('image/')) {
                                    compressImage(file).then(res => {
                                        sendMessage('IMAGE', res.base64, { size: res.size, mimeType: res.mimeType });
                                    });
                                } else {
                                    // Raw file
                                    const reader = new FileReader();
                                    reader.onload = () => {
                                        const b64 = (reader.result as string).split(',')[1];
                                        sendMessage('FILE', b64, { size: file.size, mimeType: file.type, fileName: file.name });
                                    };
                                    reader.readAsDataURL(file);
                                }
                            });
                        }
                    }}/>

                    {showShare && <ShareConnection peerId={myProfile.id} pin={accessPin} onClose={()=>setShowShare(false)} />}
                    {showCall && <TeleponanView onClose={()=>setShowCall(false)} existingPeer={peerRef.current} initialTargetId={targetPeerId} incomingCall={incomingCall} secretPin={accessPin} />}
                    {/* Incoming Call Notification Overlay */}
                    {incomingCall && !showCall && (
                        <CallNotification 
                            identity={incomingCall.metadata?.identity || "Unknown"} 
                            onAnswer={() => setShowCall(true)} 
                            onDecline={() => { incomingCall.close(); setIncomingCall(null); }}
                        />
                    )}
                    
                    {showWalkieTalkie && (
                        <IStokWalkieTalkie 
                            onClose={()=>setShowWalkieTalkie(false)}
                            onSendAudio={(base64, duration, size) => sendMessage('AUDIO', base64, { duration, size, mimeType: 'audio/webm' })}
                            latestMessage={messages.length > 0 ? messages[messages.length - 1] : null}
                        />
                    )}

                    <MediaDrawer 
                        isOpen={showMediaDrawer} 
                        onClose={()=>setShowMediaDrawer(false)}
                        messages={messages}
                        onViewImage={setViewImage}
                    />
                    
                    {viewImage && (
                        <div className="fixed inset-0 z-[5000] bg-black/95 backdrop-blur flex items-center justify-center p-4" onClick={()=>setViewImage(null)}>
                            <img src={viewImage} className="max-w-full max-h-full rounded-lg shadow-2xl" />
                            <button className="absolute top-4 right-4 p-2 bg-white/10 rounded-full text-white"><X size={24}/></button>
                        </div>
                    )}

                    <SidebarIStokContact 
                        isOpen={showSidebar} 
                        onClose={()=>setShowSidebar(false)}
                        sessions={sessions}
                        profile={myProfile}
                        onSelect={(s)=>{ /* switch chat logic if needed */ }}
                        onCallContact={()=>{}}
                        onRenameSession={()=>{}}
                        onDeleteSession={(id)=>{ setSessions(prev => prev.filter(s=>s.id !== id)); }}
                        onRegenerateProfile={()=>{ setMyProfile({...myProfile, id: generateStableId()}); }}
                        currentPeerId={targetPeerId}
                    />
                </div>
            );
        }

        return null;
    };

    return (
        <>
            {renderGlobalNotification()}
            {renderAppContent()}
        </>
    );
};
=======
                                    <div className="w-12 h-12 border-4 border-blue-500/30 border-t
>>>>>>> cba0f26f110ed36eac3dba75de5717bb2dde361b
