import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    encryptData, decryptData
} from '../../utils/crypto'; 
import { TeleponanView } from '../teleponan/TeleponanView';
import { activatePrivacyShield } from '../../utils/privacyShield';
import { 
    Send, Zap, ScanLine, Server,
    Mic, Square, Menu, PhoneCall, 
    QrCode, Lock, Flame, 
    ShieldAlert, ArrowLeft, BrainCircuit, Sparkles,
    Wifi, WifiOff, Paperclip
} from 'lucide-react';

// --- HOOKS & SERVICES ---
import useLocalStorage from '../../hooks/useLocalStorage';
import { OMNI_KERNEL } from '../../services/omniRace'; 
import { SidebarIStokContact, IStokSession } from './components/SidebarIStokContact';
import { ShareConnection } from './components/ShareConnection'; 
import { ConnectionNotification } from './components/ConnectionNotification';
import { CallNotification } from './components/CallNotification';
import { AudioMessagePlayer } from './components/vn';
import { compressImage, ImageMessage } from './components/gambar';

// --- CONSTANTS ---
const CHUNK_SIZE = 16384; 
const HEARTBEAT_MS = 5000;

// --- TYPES ---
interface IStokProfile {
    id: string;        
    username: string;  
    created: number;
}

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
}

type AppMode = 'SELECT' | 'HOST' | 'JOIN' | 'CHAT';
type ConnectionStage = 'IDLE' | 'LOCATING_PEER' | 'FETCHING_RELAYS' | 'VERIFYING_KEYS' | 'ESTABLISHING_TUNNEL' | 'AWAITING_APPROVAL' | 'SECURE' | 'RECONNECTING';

// --- UTILS ---
const generateAnomalyIdentity = () => `ANOMALY-${Math.floor(Math.random() * 9000) + 1000}`;
const generateStableId = () => `ISTOK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

const triggerHaptic = (ms: number | number[]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms);
};

const playSound = (type: 'MSG_IN' | 'MSG_OUT' | 'CONNECT' | 'CALL_RING' | 'BUZZ' | 'AI_THINK') => {
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

const getIceServers = async (): Promise<any[]> => {
    const publicIce = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
    ];
    try {
        const apiKey = import.meta.env.VITE_METERED_API_KEY;
        if (!apiKey) return publicIce;
        const response = await fetch(`https://istoic.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`);
        if (!response.ok) return publicIce;
        const turnServers = await response.json();
        return [...publicIce, ...turnServers];
    } catch (e) {
        return publicIce;
    }
};

// --- SUB-COMPONENTS ---

const BurnerTimer = ({ ttl, onBurn }: { ttl: number, onBurn: () => void }) => {
    const [timeLeft, setTimeLeft] = useState(ttl);
    useEffect(() => {
        if (timeLeft <= 0) { onBurn(); return; }
        const timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft, onBurn]);
    return (
        <div className="flex items-center gap-2 mt-1 select-none">
            <Flame size={10} className="text-red-500 animate-pulse" />
            <div className="w-full h-0.5 bg-red-900/50 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 transition-all duration-1000 ease-linear" style={{width: `${(timeLeft/ttl)*100}%`}}></div>
            </div>
        </div>
    );
};

const MessageBubble = React.memo(({ msg, setViewImage, onBurn }: { msg: Message, setViewImage: (img: string) => void, onBurn: (id: string) => void }) => {
    const [burnStarted, setBurnStarted] = useState(msg.type !== 'IMAGE'); 

    return (
        <div className={`flex ${msg.sender === 'ME' ? 'justify-end' : 'justify-start'} animate-fade-in mb-3`}>
            <div className={`max-w-[85%] flex flex-col ${msg.sender === 'ME' ? 'items-end' : 'items-start'}`}>
                <div className={`rounded-2xl text-sm border shadow-sm relative overflow-hidden ${msg.sender === 'ME' ? 'bg-emerald-900/40 border-emerald-500/30 text-emerald-100 rounded-tr-none' : 'bg-[#1a1a1a] text-neutral-200 border-white/10 rounded-tl-none'} ${msg.type === 'TEXT' ? 'px-4 py-2' : 'p-1'}`}>
                    {msg.type === 'IMAGE' ? 
                        <ImageMessage content={msg.content} size={msg.size} onClick={() => setViewImage(msg.content)} onReveal={() => setBurnStarted(true)} /> : 
                     msg.type === 'AUDIO' ? <AudioMessagePlayer src={msg.content} duration={msg.duration} /> :
                     msg.type === 'FILE' ? (
                        <a href={`data:${msg.mimeType};base64,${msg.content}`} download={msg.fileName} className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors rounded-xl">
                            <div className="p-2 bg-white/10 rounded-lg"><ScanLine size={16}/></div>
                            <div className="overflow-hidden"><p className="text-xs font-bold truncate max-w-[150px]">{msg.fileName}</p><p className="text-[9px] text-neutral-400">{(msg.size ? msg.size/1024 : 0).toFixed(1)} KB</p></div>
                        </a>
                     ) : <span className="whitespace-pre-wrap leading-relaxed">{msg.content}</span>}
                    
                    {msg.ttl && burnStarted && <BurnerTimer ttl={msg.ttl} onBurn={() => onBurn(msg.id)} />}
                </div>
                <div className="flex items-center gap-1 mt-1 px-1 opacity-60">
                    {msg.ttl && <ShieldAlert size={8} className="text-red-500" />}
                    <span className="text-[9px] font-mono">{new Date(msg.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                </div>
            </div>
        </div>
    );
});

const IStokInput = React.memo(({ onSend, onTyping, disabled, isRecording, recordingTime, isVoiceMasked, onToggleMask, onStartRecord, onStopRecord, onAttach, ttlMode, onToggleTtl, onAiAssist, isAiThinking }: any) => {
    const [text, setText] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const insertText = (newText: string) => setText(newText);

    return (
        <div className="bg-[#09090b] border-t border-white/10 p-3 z-20 pb-[max(env(safe-area-inset-bottom),1rem)]">
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
                        {isAiThinking ? 'RACING...' : 'AI ASSIST'}
                     </button>
                 </div>
                 <span className="text-[8px] font-mono text-emerald-500/50 flex items-center gap-1"><Lock size={8}/> E2EE_ON</span>
            </div>

            <div className="flex gap-2 items-end">
                <button onClick={onAttach} className="p-3 bg-white/5 rounded-full text-neutral-400 hover:text-white transition-colors"><Paperclip size={20}/></button>
                <div className="flex-1 bg-white/5 rounded-2xl px-4 py-3 border border-white/5 focus-within:border-emerald-500/30 transition-colors relative">
                    <input 
                        ref={inputRef}
                        value={text} 
                        onChange={e=>{setText(e.target.value); onTyping();}} 
                        onKeyDown={e=>e.key==='Enter'&&text.trim()&&(onSend(text),setText(''))} 
                        placeholder={isRecording ? "Recording encrypted audio..." : "Message..."} 
                        className="w-full bg-transparent outline-none text-white text-sm placeholder:text-neutral-600" 
                        disabled={disabled||isRecording}
                    />
                </div>
                {text.trim() ? (
                    <button onClick={()=>{onSend(text);setText('');}} className="p-3 bg-emerald-600 rounded-full text-white shadow-lg hover:bg-emerald-500 active:scale-95 transition-all"><Send size={20}/></button>
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
    
    // CHAT & MEDIA
    const [messages, setMessages] = useState<Message[]>([]);
    const [isPeerOnline, setIsPeerOnline] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isVoiceMasked, setIsVoiceMasked] = useState(false);
    const [ttlMode, setTtlMode] = useState(0); 
    const [isAiThinking, setIsAiThinking] = useState(false); 

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

    // DEEP LINKING (QR Scan / Link Auto Join)
    useEffect(() => {
        activatePrivacyShield();
        try {
            const url = new URL(window.location.href);
            const connect = url.searchParams.get('connect');
            const key = url.searchParams.get('key');
            if (connect && key) {
                console.log("[ISTOK_AUTO] Found Deep Link Credentials");
                setTargetPeerId(connect);
                setAccessPin(key);
                setMode('JOIN');
                setPendingJoin({ id: connect, pin: key });
                window.history.replaceState({}, '', window.location.pathname);
            }
        } catch(e) {}
    }, []);

    // --- LOGIC: HELPER FUNCTIONS (DEFINED BEFORE USEEFFECT) ---
    
    const startHeartbeat = useCallback(() => {
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
            if (!connRef.current?.open) setIsPeerOnline(false);
            else {
                connRef.current.send({ type: 'PING' });
                setIsPeerOnline(true);
            }
        }, HEARTBEAT_MS);
    }, []);

    const handleDisconnect = useCallback(() => {
        setIsPeerOnline(false);
        setStage('RECONNECTING');
    }, []);

    const handleData = useCallback(async (data: any, incomingConn?: any) => {
        // CHUNK REASSEMBLY
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

        // PROTOCOL
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
                    
                    // Save Session
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
    }, [startHeartbeat, setSessions]);

    // --- PEER INIT (POWERFUL VERSION) ---
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
                    debug: 1,
                    secure: true,
                    config: { iceServers, sdpSemantics: 'unified-plan' },
                    retry_timer: 1000
                });

                peer.on('open', () => {
                    console.log("[ISTOK_NET] Peer Ready:", myProfile.id);
                    setStage('IDLE');
                    if (pendingJoin) {
                        // Delay sedikit untuk memastikan Peer stabil
                        setTimeout(() => joinSession(pendingJoin.id, pendingJoin.pin), 1000);
                        setPendingJoin(null);
                    }
                });

                peer.on('connection', c => {
                    c.on('data', d => handleData(d, c));
                    c.on('close', handleDisconnect);
                });

                peer.on('call', call => {
                    if (showCall) { call.close(); return; }
                    setIncomingCall(call);
                    playSound('CALL_RING');
                });

                peer.on('error', err => {
                    console.warn("Peer Error:", err);
                    if (err.type === 'peer-unavailable') { setErrorMsg("Target Offline"); setStage('IDLE'); }
                    else if (err.type === 'disconnected') { peer.reconnect(); }
                });

                peerRef.current = peer;
            } catch (e) {
                console.error("Init Failed", e);
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

    // --- LOGIC: CONNECTION ---

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
        const conn = peerRef.current.connect(target, { reliable: true });
        
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

    // --- LOGIC: OMNI RACE AI ---
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
            console.error("AI Race Failed", e);
            setErrorMsg("AI Offline");
        } finally {
            setIsAiThinking(false);
        }
    };

    // --- LOGIC: SENDING ---
    const sendMessage = async (type: string, content: string, extras = {}) => {
        if (!connRef.current) return;
        const msgId = crypto.randomUUID();
        const timestamp = Date.now();
        const payloadObj = { id: msgId, type, content, timestamp, ttl: ttlMode, ...extras };
        
        const encrypted = await encryptData(JSON.stringify(payloadObj), pinRef.current);
        if (!encrypted) return;

        // Smart Chunking
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
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[9px] font-bold rounded border border-emerald-500/20">V3.0 HYBRID</span>
                        <span className="px-2 py-0.5 bg-purple-500/10 text-purple-500 text-[9px] font-bold rounded border border-purple-500/20">OMNI-AI</span>
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
                            <p className="text-[10px] text-neutral-500">Scan QR Code / Enter ID</p>
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
                            <ScanLine className="text-blue-500 mx-auto mb-4" size={40}/>
                            <h2 className="text-xl font-bold text-white">ESTABLISH UPLINK</h2>
                            <p className="text-xs text-neutral-500">{stage === 'IDLE' ? 'Scan QR Code via Camera' : stage}</p>
                        </div>
                        {stage === 'IDLE' ? (
                            <>
                                <input value={targetPeerId} onChange={e=>setTargetPeerId(e.target.value)} placeholder="TARGET ID" className="w-full bg-[#09090b] p-4 rounded-xl text-white border border-white/10 outline-none text-center font-mono focus:border-blue-500 transition-colors"/>
                                <input value={accessPin} onChange={e=>setAccessPin(e.target.value)} placeholder="PIN" className="w-full bg-[#09090b] p-4 rounded-xl text-white border border-white/10 outline-none text-center font-mono tracking-widest focus:border-blue-500 transition-colors"/>
                                <button onClick={()=>joinSession()} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20">CONNECT</button>
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
                    <MessageBubble key={m.id} msg={m} setViewImage={setViewImage} onBurn={(id)=>setMessages(p=>p.filter(x=>x.id!==id))} />
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