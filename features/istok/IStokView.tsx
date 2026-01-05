
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
    encryptData, decryptData
} from '../../utils/crypto'; 
import { TeleponanView } from '../teleponan/TeleponanView';
import { activatePrivacyShield } from '../../utils/privacyShield';
import { 
    Send, Zap, Radio, ScanLine, Server,
    Clock, Check, CheckCheck,
    Mic, MicOff, Square,
    Menu, Skull, Activity,
    PhoneCall, QrCode, User, Shield, AlertTriangle, History, ArrowRight,
    X, RefreshCw, Lock, Flame, ShieldAlert, Image as ImageIcon, Loader2, ArrowLeft, Wifi, WifiOff, UploadCloud, Users, Radio as RadioIcon, Globe, Phone
} from 'lucide-react';
import useLocalStorage from '../../hooks/useLocalStorage';
import { useIDB } from '../../hooks/useIDB'; 
import { SidebarIStokContact, IStokSession, IStokProfile } from './components/SidebarIStokContact';
import { ShareConnection } from './components/ShareConnection'; 
import { ConnectionNotification } from './components/ConnectionNotification';
import { CallNotification } from './components/CallNotification';
import { MessageNotification } from './components/MessageNotification';
import { AudioMessagePlayer, getSupportedMimeType } from './components/vn';
import { compressImage, ImageMessage } from './components/gambar';
import { IStokAuth } from './components/IStokAuth';
import { IStokWalkieTalkie } from './components/IStokWalkieTalkie';
import { MediaDrawer } from './components/MediaDrawer';

// --- CONSTANTS ---
const CHUNK_SIZE = 16384; 
const HEARTBEAT_INTERVAL = 2000; // Aggressive Heartbeat (2s) for Mobile Networks
const HEARTBEAT_TIMEOUT = 10000; // 10 Seconds tolerance

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
}

type AppMode = 'SELECT' | 'HOST' | 'JOIN' | 'CHAT' | 'DIALING' | 'INCOMING_CALL';
type ConnectionStage = 'IDLE' | 'FETCHING_ICE' | 'LOCATING_PEER' | 'HANDSHAKE_INIT' | 'VERIFYING_KEYS' | 'ESTABLISHING_TUNNEL' | 'AWAITING_APPROVAL' | 'SECURE' | 'RECONNECTING';

// --- UTILS ---

const generateAnomalyIdentity = () => `ANOMALY-${Math.floor(Math.random() * 9000) + 1000}`;
const generateStableId = () => `ISTOK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

const triggerHaptic = (ms: number | number[]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(ms);
    }
};

const playSound = (type: 'MSG_IN' | 'MSG_OUT' | 'CONNECT' | 'CALL_RING' | 'ERROR' | 'BUZZ') => {
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
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'CONNECT') {
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(1200, now + 0.2);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    } else if (type === 'MSG_OUT') {
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'CALL_RING') {
        // High pitch alerting ping
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.3);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    }
};

// --- AGGRESSIVE ICE CONFIGURATION ---
const getIceServers = async (): Promise<any[]> => {
    const meteredKey = process.env.VITE_METERED_API_KEY;
    const meteredDomain = process.env.VITE_METERED_DOMAIN || 'istok.metered.live';

    let iceServers = [
        // GLOBAL PUBLIC STUN LIST (Redundancy Strategy)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        { urls: 'stun:stun.stunprotocol.org:3478' }
    ];

    if (meteredKey) {
        try {
            console.log("[ISTOK_NET] Fetching Titanium Relay Credentials...");
            const response = await fetch(`https://${meteredDomain}/api/v1/turn/credentials?apiKey=${meteredKey}`);
            const turnServers = await response.json();
            iceServers = [...turnServers, ...iceServers];
        } catch (e) {
            console.warn("[ISTOK_NET] TURN Fetch Failed. Falling back to STUN Swarm.", e);
        }
    }

    return iceServers;
};

// ... Sub Components ...
const MessageBubble = React.memo(({ msg, setViewImage }: any) => (
    <div className={`flex ${msg.sender === 'ME' ? 'justify-end' : 'justify-start'} mb-4 animate-slide-up`}>
        <div className={`max-w-[85%] flex flex-col ${msg.sender === 'ME' ? 'items-end' : 'items-start'}`}>
            <div className={`p-2 rounded-2xl text-sm border shadow-sm ${msg.sender === 'ME' ? 'bg-blue-600/20 border-blue-500/30 text-blue-100' : 'bg-[#1a1a1a] text-neutral-200 border-white/10'} ${msg.type === 'TEXT' ? 'px-4 py-3' : 'p-1'}`}>
                {msg.type === 'IMAGE' ? 
                    <ImageMessage 
                        content={msg.content} 
                        size={msg.size} 
                        mimeType={msg.mimeType} 
                        onClick={() => setViewImage(msg.content)} 
                    /> : 
                 msg.type === 'AUDIO' ? 
                    <AudioMessagePlayer 
                        src={msg.content} 
                        duration={msg.duration} 
                        mimeType={msg.mimeType}
                        isMasked={msg.isMasked}
                    /> :
                 <span className="whitespace-pre-wrap leading-relaxed">{msg.content}</span>}
            </div>
            <div className="flex items-center gap-1 mt-1 opacity-50">
                 <span className="text-[8px] font-mono">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                 {msg.sender === 'ME' && (
                     msg.status === 'READ' ? <CheckCheck size={10} className="text-blue-400" /> : 
                     msg.status === 'DELIVERED' ? <CheckCheck size={10} /> : <Check size={10} />
                 )}
            </div>
        </div>
    </div>
));

const IStokInput = React.memo(({ onSend, onTyping, disabled, isRecording, recordingTime, onStartRecord, onStopRecord, onAttach, onTogglePTT }: any) => {
    const [text, setText] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="bg-[#09090b] border-t border-white/10 p-3 z-20 pb-[max(env(safe-area-inset-bottom),1rem)]">
            <div className="flex gap-2 items-end">
                <button onClick={onAttach} className="p-3 rounded-full text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"><UploadCloud size={20}/></button>
                <div className="flex-1 bg-white/5 rounded-2xl px-4 py-3 border border-white/5 focus-within:border-emerald-500/50 transition-colors">
                    <input 
                        ref={inputRef}
                        value={text} 
                        onChange={e=>{setText(e.target.value); onTyping();}} 
                        onKeyDown={e=>e.key==='Enter'&&text.trim()&&(onSend(text),setText(''))} 
                        placeholder={isRecording ? `Recording... ${recordingTime}s` : "Encrypted Message..."}
                        className="w-full bg-transparent outline-none text-white text-sm placeholder:text-neutral-600" 
                        disabled={disabled || isRecording}
                    />
                </div>
                {text.trim() ? (
                    <button onClick={()=>{onSend(text);setText(''); inputRef.current?.focus();}} className="p-3 bg-emerald-600 hover:bg-emerald-500 rounded-full text-white transition-all shadow-lg active:scale-95"><Send size={20}/></button>
                ) : (
                    <>
                        <button 
                            onClick={onTogglePTT}
                            className="p-3 rounded-full bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-black transition-all"
                            title="Walkie Talkie"
                        >
                            <RadioIcon size={20} />
                        </button>
                        <button 
                            onMouseDown={onStartRecord} 
                            onMouseUp={onStopRecord} 
                            onTouchStart={onStartRecord} 
                            onTouchEnd={onStopRecord} 
                            className={`p-3 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white shadow-[0_0_15px_red] animate-pulse scale-110' : 'bg-white/5 text-neutral-400 hover:text-white'}`}
                        >
                            {isRecording ? <Square size={20} fill="currentColor" /> : <Mic size={20} />}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
});

// --- HELPER: SYSTEM NOTIFICATION TRIGGER ---
const sendSystemNotification = (title: string, body: string, tag: string, data: any = {}) => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            payload: { title, body, tag, data }
        });
    }
};

export const IStokView: React.FC = () => {
    const [mode, setMode] = useState<AppMode>('SELECT');
    const [stage, setStage] = useState<ConnectionStage>('IDLE');
    
    const [myProfile, setMyProfile] = useLocalStorage<IStokProfile>('istok_profile_v1', {
        id: generateStableId(),
        username: generateAnomalyIdentity(),
        created: Date.now(),
        idChangeHistory: []
    });

    const [sessions, setSessions] = useLocalStorage<IStokSession[]>('istok_sessions', []);
    const [targetPeerId, setTargetPeerId] = useState<string>('');
    const [accessPin, setAccessPin] = useState<string>('');
    
    // Core Refs
    const peerRef = useRef<any>(null);
    const connRef = useRef<any>(null);
    const pinRef = useRef(accessPin); 
    const isMounted = useRef(true);
    const msgEndRef = useRef<HTMLDivElement>(null);
    const chunkBuffer = useRef<Record<string, { chunks: string[], count: number, total: number }>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const lastPongRef = useRef<number>(Date.now());
    const heartbeatRef = useRef<any>(null);
    
    // Recording Refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingIntervalRef = useRef<any>(null);
    
    // States
    const [messages, setMessages] = useState<Message[]>([]);
    const [incomingConnectionRequest, setIncomingConnectionRequest] = useState<{ peerId: string, identity: string, conn: any } | null>(null);
    const [isPeerOnline, setIsPeerOnline] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [isRelayActive, setIsRelayActive] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [showContactSidebar, setShowContactSidebar] = useState(false);
    const [showWalkieTalkie, setShowWalkieTalkie] = useState(false);
    const [showMediaDrawer, setShowMediaDrawer] = useState(false);
    const [viewImage, setViewImage] = useState<string | null>(null);
    const [latestAudioMessage, setLatestAudioMessage] = useState<Message | null>(null);
    
    // NOTIFICATION STATES
    const [latestMessageNotif, setLatestMessageNotif] = useState<{sender: string, text: string} | null>(null);

    // CALLING STATE
    const [incomingMediaCall, setIncomingMediaCall] = useState<any>(null);
    const [activeTeleponan, setActiveTeleponan] = useState(false);
    const [outgoingCallTarget, setOutgoingCallTarget] = useState<string | null>(null);

    // --- PERSISTENCE: LOAD CHAT HISTORY ---
    const [storedMessages, setStoredMessages] = useIDB<Message[]>(`istok_chat_${targetPeerId || 'draft'}`, []);

    // REQUEST NOTIFICATION PERMISSION ON MOUNT
    useEffect(() => {
        if ('Notification' in window && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    }, []);

    useEffect(() => {
        if (targetPeerId && storedMessages.length > 0 && messages.length === 0) {
            setMessages(storedMessages);
        }
    }, [targetPeerId, storedMessages]);

    useEffect(() => {
        if (messages.length > 0 && targetPeerId) {
            setStoredMessages(messages);
        }
    }, [messages, targetPeerId]);

    // --- IDENTITY MANAGEMENT ---
    const regenerateProfile = () => {
        const now = Date.now();
        const newHistory = [...(myProfile.idChangeHistory || []), now];
        const newProfile = {
            id: generateStableId(),
            username: generateAnomalyIdentity(),
            created: myProfile.created,
            idChangeHistory: newHistory
        };
        setMyProfile(newProfile);
        if (peerRef.current) {
            peerRef.current.destroy();
            setTimeout(() => window.location.reload(), 500);
        }
    };

    // --- ZOMBIE KILLER & HEARTBEAT ---
    const nukeConnection = () => {
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        if (connRef.current) {
            try { connRef.current.close(); } catch(e){}
            connRef.current = null;
        }
        setIsPeerOnline(false);
        setStage('IDLE');
    };

    const startHeartbeat = () => {
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        lastPongRef.current = Date.now();
        
        heartbeatRef.current = setInterval(() => {
            if (!connRef.current || !isPeerOnline) return;
            
            // Check lag
            if (Date.now() - lastPongRef.current > HEARTBEAT_TIMEOUT) {
                console.warn("[ISTOK_NET] Peer Timed Out - Triggering Soft Reconnect");
                connRef.current.send({ type: 'PING' }); 
            } else {
                connRef.current.send({ type: 'PING' });
            }
        }, HEARTBEAT_INTERVAL);
    };

    // --- CALL HANDLERS ---
    const initiateCall = () => {
        if (connRef.current) {
            // 1. Send Pre-Call Signal via Data Channel (Faster UI wake-up)
            connRef.current.send({ type: 'CALL_SIGNAL' });
            
            // 2. Open Teleponan Interface
            setOutgoingCallTarget(targetPeerId);
            setActiveTeleponan(true);
        }
    };

    const handleAnswerCall = () => {
        setIncomingMediaCall(null);
        setActiveTeleponan(true);
    };

    const handleDeclineCall = () => {
        if (incomingMediaCall) {
            incomingMediaCall.close();
            setIncomingMediaCall(null);
        }
    };

    // --- HANDSHAKE PROTOCOL ---
    const joinSession = (id?: string, pin?: string) => {
        const target = id || targetPeerId;
        const key = pin || accessPin;
        if (!target || !key) return;

        if (pin) pinRef.current = pin;
        setAccessPin(key);

        if (connRef.current && connRef.current.peer === target && isPeerOnline) {
             console.log("Already connected to target.");
             return;
        }

        nukeConnection();

        if (!peerRef.current || peerRef.current.destroyed) {
            setErrorMsg("NETWORK_OFFLINE");
            return;
        }

        setStage('LOCATING_PEER');
        
        try {
            const conn = peerRef.current.connect(target, { 
                reliable: true,
                serialization: 'json'
            });
            connRef.current = conn;

            conn.on('open', () => {
                console.log("[ISTOK_NET] Tunnel Open. Handshaking...");
                setStage('HANDSHAKE_INIT');
                // Immediate Ping to punch NAT
                conn.send({ type: 'PING' });
                
                setTimeout(async () => {
                    setStage('VERIFYING_KEYS');
                    const payload = JSON.stringify({ type: 'CONNECTION_REQUEST', identity: myProfile.username });
                    const encrypted = await encryptData(payload, key);
                    if (encrypted) {
                        conn.send({ type: 'REQ', payload: encrypted });
                        setStage('AWAITING_APPROVAL');
                    }
                }, 500);
            });

            conn.on('data', (data: any) => handleData(data));
            conn.on('close', () => {
                handleDisconnect();
            });
            conn.on('error', (err: any) => {
                console.error("Conn Error", err);
                setErrorMsg('CONNECTION_FAILED');
                setStage('IDLE');
            });
            
        } catch(e) {
            console.error("Join Exception", e);
            setErrorMsg('CONNECTION_ERROR');
        }
    };

    const handleData = async (data: any, incomingConn?: any) => {
        // --- CHUNK HANDLER ---
        if (data.type === 'CHUNK') {
            const { transferId, idx, total, data: chunkData } = data;
            if (!chunkBuffer.current[transferId]) {
                chunkBuffer.current[transferId] = { chunks: new Array(total), count: 0, total };
            }
            const buffer = chunkBuffer.current[transferId];
            if (!buffer.chunks[idx]) {
                buffer.chunks[idx] = chunkData;
                buffer.count++;
            }
            if (buffer.count === total) {
                const fullPayload = buffer.chunks.join('');
                delete chunkBuffer.current[transferId];
                handleData({ type: 'MSG', payload: fullPayload });
            }
            return;
        }

        // --- HEARTBEAT ---
        if (data.type === 'PING') {
            (incomingConn || connRef.current)?.send({ type: 'PONG' });
            return;
        }
        if (data.type === 'PONG') {
            lastPongRef.current = Date.now();
            if (!isPeerOnline && mode === 'CHAT') setIsPeerOnline(true);
            return;
        }

        // --- CALL SIGNALING ---
        if (data.type === 'CALL_SIGNAL') {
            // Wake up UI even before media connection arrives
            playSound('CALL_RING');
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            // Background Notification
            if (document.hidden) {
                sendSystemNotification('INCOMING CALL', 'Encrypted Voice Uplink...', 'istok_call', { peerId: (incomingConn || connRef.current)?.peer });
            }
            return;
        }

        const currentKey = pinRef.current;

        if (data.type === 'REQ') {
            const json = await decryptData(data.payload, currentKey);
            if (json) {
                const req = JSON.parse(json);
                if (req.type === 'CONNECTION_REQUEST') {
                    setShowShare(false);
                    setIncomingConnectionRequest({ 
                        peerId: incomingConn.peer, 
                        identity: req.identity, 
                        conn: incomingConn 
                    });
                    playSound('MSG_IN');
                    triggerHaptic([100, 50, 100]);
                    
                    // Background Notification for Connection Request
                    if (document.hidden) {
                        sendSystemNotification('CONNECTION REQUEST', `${req.identity} wants to connect.`, 'istok_req');
                    }
                }
            }
        } else if (data.type === 'RESP') {
            const json = await decryptData(data.payload, currentKey);
            if (json) {
                const res = JSON.parse(json);
                if (res.type === 'CONNECTION_ACCEPT') {
                    setStage('SECURE');
                    setMode('CHAT');
                    setIsPeerOnline(true);
                    startHeartbeat();
                    playSound('CONNECT');
                    triggerHaptic(200);
                    
                    const now = Date.now();
                    setSessions(prev => {
                        const existing = prev.find(s => s.id === connRef.current.peer);
                        if (existing) return prev.map(s => s.id === connRef.current.peer ? { ...s, lastSeen: now, status: 'ONLINE', name: res.identity } : s);
                        return [...prev, {
                            id: connRef.current.peer,
                            name: res.identity,
                            lastSeen: now,
                            status: 'ONLINE',
                            pin: currentKey,
                            createdAt: now
                        }];
                    });
                }
            } else {
                setErrorMsg("PIN_MISMATCH");
            }
        } else if (data.type === 'MSG') {
             const json = await decryptData(data.payload, currentKey);
             if (json) {
                 const msg = JSON.parse(json);
                 const incomingMsg = { ...msg, sender: 'THEM', status: 'READ' };
                 setMessages(prev => [...prev, incomingMsg]);
                 
                 // Handle specific message types
                 if (incomingMsg.type === 'AUDIO') {
                     setLatestAudioMessage(incomingMsg);
                 }

                 playSound('MSG_IN');
                 
                 // NOTIFICATIONS
                 const peerName = sessions.find(s => s.id === (incomingConn || connRef.current)?.peer)?.name || "Unknown";
                 const preview = incomingMsg.type === 'TEXT' ? incomingMsg.content : `[${incomingMsg.type}]`;
                 
                 if (document.hidden) {
                     sendSystemNotification(peerName, preview, 'istok_msg', { peerId: (incomingConn || connRef.current)?.peer });
                 } else {
                     setLatestMessageNotif({ sender: peerName, text: preview });
                 }

                 setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
             }
        }
    };

    const handleIncomingConnection = (conn: any) => {
        console.log("[ISTOK_NET] Incoming connection from", conn.peer);
        conn.on('data', (data: any) => handleData(data, conn));
        conn.on('close', handleDisconnect);
        conn.on('error', (err: any) => console.warn("Incoming Conn Error", err));
    };

    const handleDisconnect = () => {
        setIsPeerOnline(false);
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        if (mode === 'CHAT') {
            setStage('RECONNECTING');
            setErrorMsg("PEER_DISCONNECTED");
        }
    };

    const acceptConnection = async () => {
        if (!incomingConnectionRequest) return;
        const { conn, identity, peerId } = incomingConnectionRequest;
        connRef.current = conn;
        
        const payload = JSON.stringify({ type: 'CONNECTION_ACCEPT', identity: myProfile.username });
        const encrypted = await encryptData(payload, pinRef.current);
        
        if (encrypted) {
            conn.send({ type: 'RESP', payload: encrypted });
            setStage('SECURE');
            setMode('CHAT');
            setIncomingConnectionRequest(null);
            setIsPeerOnline(true);
            startHeartbeat();
            
            const now = Date.now();
            setSessions(prev => {
                 const existing = prev.find(s => s.id === peerId);
                 if (existing) return prev.map(s => s.id === peerId ? { ...s, lastSeen: now, status: 'ONLINE', name: identity } : s);
                 return [...prev, {
                     id: peerId,
                     name: identity,
                     lastSeen: now,
                     status: 'ONLINE',
                     pin: pinRef.current,
                     createdAt: now
                 }];
            });
        }
    };

    const sendMessage = async (type: string, content: string, extraData: any = {}) => {
        if (!connRef.current || !content) {
            if (!connRef.current) setErrorMsg("NO_CONNECTION");
            return;
        }

        const msgId = crypto.randomUUID();
        const payload = {
            id: msgId,
            sender: 'THEM',
            type,
            content,
            timestamp: Date.now(),
            ...extraData
        };

        const myMsg = { ...payload, sender: 'ME', status: 'PENDING' };
        setMessages(prev => [...prev, myMsg as any]);

        const encrypted = await encryptData(JSON.stringify(payload), pinRef.current);
        
        if (encrypted) {
            if (encrypted.length > CHUNK_SIZE) {
                 const transferId = crypto.randomUUID();
                 const total = Math.ceil(encrypted.length / CHUNK_SIZE);
                 
                 for (let i = 0; i < total; i++) {
                     const chunk = encrypted.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                     connRef.current.send({
                         type: 'CHUNK',
                         transferId,
                         idx: i,
                         total,
                         data: chunk
                     });
                     await new Promise(r => setTimeout(r, 5)); 
                 }
            } else {
                 connRef.current.send({ type: 'MSG', payload: encrypted });
            }
            
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'SENT' } : m));
            playSound('MSG_OUT');
            setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
    };

    // --- RECORDING & FILES (Same as before) ---
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = getSupportedMimeType();
            
            const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64Audio = reader.result as string;
                    const cleanBase64 = base64Audio.split(',')[1];
                    sendMessage('AUDIO', cleanBase64, { duration: recordingTime, mimeType: mediaRecorder.mimeType });
                };
                reader.readAsDataURL(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            recordingIntervalRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
            triggerHaptic(50);
        } catch (e) {
            console.error("Mic error", e);
            alert("Microphone access denied.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearInterval(recordingIntervalRef.current);
            triggerHaptic(50);
        }
    };

    const handleFileSelect = (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.type.startsWith('image/')) {
            compressImage(file).then(compressed => {
                sendMessage('IMAGE', compressed.base64, { size: compressed.size, mimeType: compressed.mimeType });
            }).catch(err => {
                alert("Image compression failed.");
            });
        }
    };

    // --- SIDEBAR HANDLERS ---
    const handleSelectSession = (s: IStokSession) => {
        setAccessPin(s.pin);
        setTargetPeerId(s.id);
        setShowContactSidebar(false);
        joinSession(s.id, s.pin);
    };

    const handleRenameSession = (id: string, newName: string) => {
        setSessions(prev => prev.map(s => s.id === id ? { ...s, customName: newName } : s));
    };

    const handleDeleteSession = (id: string) => {
        setSessions(prev => prev.filter(s => s.id !== id));
        if (targetPeerId === id) setMessages([]); 
    };

    // --- INITIALIZATION ---
    useEffect(() => {
        activatePrivacyShield();
        isMounted.current = true;
        
        const initPeer = async () => {
            try {
                setStage('FETCHING_ICE');
                const iceServers = await getIceServers();
                if (iceServers.some((s: any) => s.urls.includes('turn:'))) setIsRelayActive(true);

                if (!isMounted.current) return;
                
                const { Peer } = await import('peerjs');
                const peer = new Peer(myProfile.id, { 
                    debug: 2, 
                    config: { 
                        iceServers, 
                        sdpSemantics: 'unified-plan',
                        iceCandidatePoolSize: 10 
                    } 
                });

                peer.on('open', (id) => {
                    console.log(`[ISTOK_NET] Peer Online: ${id}`);
                    setStage('IDLE');
                    
                    const params = new URLSearchParams(window.location.search);
                    const connectId = params.get('connect');
                    const key = params.get('key');
                    if (connectId && key) {
                        setTargetPeerId(connectId);
                        setAccessPin(key);
                        setTimeout(() => joinSession(connectId, key), 500);
                        window.history.replaceState({}, '', window.location.pathname);
                    }
                });

                peer.on('connection', handleIncomingConnection);
                
                // CRITICAL: Handle Incoming Call Event from PeerJS
                peer.on('call', (call: any) => {
                    console.log("[ISTOK_NET] INCOMING CALL DETECTED");
                    setIncomingMediaCall(call);
                    playSound('CALL_RING');
                    
                    // Trigger Service Worker Notification if Hidden
                    if (document.hidden) {
                        sendSystemNotification('INCOMING SECURE CALL', 'Encrypted Voice Uplink Request...', 'istok_call', { peerId: call.peer });
                    }
                });

                peer.on('error', (err: any) => {
                    console.warn("Peer Error", err);
                    if (err.type === 'peer-unavailable') setErrorMsg('TARGET_OFFLINE');
                    else if (err.type === 'network') setErrorMsg('NETWORK_ERROR');
                });

                peerRef.current = peer;
            } catch (e) {
                console.error("Init Fail", e);
                setErrorMsg("INIT_FAIL");
            }
        };

        initPeer();

        return () => {
            isMounted.current = false;
            nukeConnection();
            if (peerRef.current) peerRef.current.destroy();
        };
    }, []);

    // --- RENDER MODES ---

    // 1. Full Screen Overlay for Calls (Titanium Integration)
    if (activeTeleponan) {
        return (
            <TeleponanView 
                onClose={() => { setActiveTeleponan(false); setOutgoingCallTarget(null); }}
                existingPeer={peerRef.current}
                initialTargetId={outgoingCallTarget || undefined}
                incomingCall={incomingMediaCall}
            />
        );
    }

    // 2. Incoming Call Notification Overlay
    if (incomingMediaCall) {
        return (
            <CallNotification 
                identity={sessions.find(s => s.id === incomingMediaCall.peer)?.name || incomingMediaCall.peer}
                onAnswer={handleAnswerCall}
                onDecline={handleDeclineCall}
            />
        );
    }

    // 3. Image Viewer Overlay
    if (viewImage) {
        return (
            <div className="fixed inset-0 z-[10000] bg-black flex flex-col items-center justify-center p-4">
                <button onClick={() => setViewImage(null)} className="absolute top-6 right-6 p-3 bg-black/50 rounded-full text-white"><X size={24}/></button>
                <img src={viewImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
            </div>
        );
    }

    // 4. Initial Mode
    if (mode === 'SELECT') {
        return (
            <div className="h-[100dvh] w-full bg-[#050505] flex flex-col items-center justify-center px-6 space-y-12 relative overflow-hidden font-sans">
                 <SidebarIStokContact 
                    isOpen={showContactSidebar}
                    onClose={() => setShowContactSidebar(false)}
                    sessions={sessions}
                    profile={myProfile}
                    onSelect={handleSelectSession}
                    onRename={handleRenameSession}
                    onDelete={handleDeleteSession}
                    onRegenerateProfile={regenerateProfile}
                    currentPeerId={null}
                 />

                 {/* TOAST: Incoming Message while in menu */}
                 {latestMessageNotif && (
                     <MessageNotification 
                         senderName={latestMessageNotif.sender}
                         messagePreview={latestMessageNotif.text}
                         onDismiss={() => setLatestMessageNotif(null)}
                         onClick={() => { setLatestMessageNotif(null); /* Could navigate to specific chat if needed */ }}
                     />
                 )}

                 {incomingConnectionRequest && (
                     <ConnectionNotification 
                        identity={incomingConnectionRequest.identity}
                        peerId={incomingConnectionRequest.peerId}
                        onAccept={acceptConnection}
                        onDecline={() => setIncomingConnectionRequest(null)}
                     />
                 )}

                 <div className="text-center space-y-4 z-10 animate-fade-in">
                     <h1 className="text-5xl font-black text-white italic tracking-tighter">IStoic <span className="text-emerald-500">P2P</span></h1>
                     <p className="text-xs text-neutral-500 font-mono">SECURE RELAY PROTOCOL v25</p>
                 </div>

                 <div className="grid grid-cols-1 gap-6 w-full max-w-sm z-10 animate-slide-up">
                    <button 
                        onClick={() => { setAccessPin(Math.floor(100000 + Math.random()*900000).toString()); setMode('HOST'); }} 
                        className="p-6 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-4 hover:bg-white/10 transition-all group"
                    >
                        <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500 group-hover:scale-110 transition-transform"><Server size={24} /></div>
                        <div className="text-left"><h3 className="font-bold text-white">HOST SESSION</h3><p className="text-[10px] text-neutral-500">Generate Secure Room</p></div>
                    </button>
                    <button 
                        onClick={() => setMode('JOIN')} 
                        className="p-6 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-4 hover:bg-white/10 transition-all group"
                    >
                        <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500 group-hover:scale-110 transition-transform"><ScanLine size={24} /></div>
                        <div className="text-left"><h3 className="font-bold text-white">JOIN SESSION</h3><p className="text-[10px] text-neutral-500">Scan QR / Enter ID</p></div>
                    </button>
                    <button 
                        onClick={() => setShowContactSidebar(true)} 
                        className="p-6 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-4 hover:bg-white/10 transition-all group"
                    >
                        <div className="p-3 bg-purple-500/10 rounded-xl text-purple-500 group-hover:scale-110 transition-transform"><Users size={24} /></div>
                        <div className="text-left"><h3 className="font-bold text-white">CONTACTS</h3><p className="text-[10px] text-neutral-500">Recent Connections</p></div>
                    </button>
                </div>
            </div>
        );
    }

    // 5. Setup Mode (Host/Join)
    if (mode === 'HOST' || mode === 'JOIN') {
        return (
            <div className="h-[100dvh] w-full bg-[#050505] flex flex-col items-center justify-center px-6 relative font-sans">
                 {incomingConnectionRequest && <ConnectionNotification identity={incomingConnectionRequest.identity} peerId={incomingConnectionRequest.peerId} onAccept={acceptConnection} onDecline={() => setIncomingConnectionRequest(null)} />}
                 {showShare && <ShareConnection peerId={myProfile.id} pin={accessPin} onClose={() => setShowShare(false)} />}

                 <button onClick={() => { setMode('SELECT'); setStage('IDLE'); }} className="absolute top-[calc(env(safe-area-inset-top)+1rem)] left-6 text-neutral-500 hover:text-white flex items-center gap-2 text-xs font-bold z-20">ABORT</button>
                 
                 {mode === 'HOST' ? (
                     <div className="w-full max-w-md bg-[#09090b] border border-white/10 p-8 rounded-[32px] text-center space-y-6 animate-fade-in">
                         <div className="relative inline-block">
                             <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse"></div>
                             <Server className="text-emerald-500 mx-auto relative z-10" size={48} />
                         </div>
                         <h2 className="text-xl font-black text-white uppercase tracking-wider">BROADCASTING_SIGNAL</h2>
                         <div className="p-4 bg-black rounded-xl border border-white/5 space-y-4">
                            <div>
                                <p className="text-[9px] text-neutral-500 mb-1 font-mono">YOUR ID</p>
                                <code className="text-emerald-500 text-xs select-all block break-all font-mono bg-emerald-500/10 p-2 rounded border border-emerald-500/20">{myProfile.id}</code>
                            </div>
                            <div>
                                <p className="text-[9px] text-neutral-500 mb-1 font-mono">ACCESS PIN</p>
                                <p className="text-2xl font-black text-white tracking-[0.5em] font-mono">{accessPin}</p>
                            </div>
                         </div>
                         <button onClick={() => setShowShare(true)} className="w-full py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all"><QrCode size={14} /> SHARE CONNECTION</button>
                     </div>
                 ) : (
                     <IStokAuth 
                        identity={myProfile.username}
                        onRegenerateIdentity={regenerateProfile}
                        onHost={() => {}} 
                        onJoin={(id, pin) => joinSession(id, pin)}
                        errorMsg={errorMsg}
                        onErrorClear={() => setErrorMsg('')}
                        isRelayActive={isRelayActive}
                        forcedMode="JOIN"
                        connectionStage={stage}
                     />
                 )}
            </div>
        );
    }

    // 6. CHAT MODE (Main)
    return (
        <div className="h-[100dvh] w-full bg-[#050505] flex flex-col font-sans relative overflow-hidden">
             
             {/* TOAST: Incoming Message from other tab/context */}
             {latestMessageNotif && (
                 <MessageNotification 
                     senderName={latestMessageNotif.sender}
                     messagePreview={latestMessageNotif.text}
                     onDismiss={() => setLatestMessageNotif(null)}
                     onClick={() => setLatestMessageNotif(null)}
                 />
             )}

             {showWalkieTalkie && (
                 <IStokWalkieTalkie 
                    onClose={() => setShowWalkieTalkie(false)} 
                    onSendAudio={(b64, dur, size) => sendMessage('AUDIO', b64, { duration: dur, size, mimeType: 'audio/webm' })}
                    latestMessage={latestAudioMessage}
                 />
             )}

             <MediaDrawer 
                isOpen={showMediaDrawer} 
                onClose={() => setShowMediaDrawer(false)} 
                messages={messages} 
                onViewImage={setViewImage} 
             />

             {/* Top Bar */}
             <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-[#09090b]/80 backdrop-blur-md z-10 pt-[calc(env(safe-area-inset-top)+1rem)]">
                 <div className="flex items-center gap-4">
                     <button onClick={() => { nukeConnection(); setMode('SELECT'); }} className="p-2 -ml-2 text-neutral-400 hover:text-white rounded-full hover:bg-white/5"><ArrowLeft size={20} /></button>
                     <div>
                         <div className="flex items-center gap-2">
                             <div className={`w-2 h-2 rounded-full shadow-[0_0_10px_#10b981] ${isPeerOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                             <span className="text-xs font-bold text-white uppercase tracking-wider truncate max-w-[120px]">
                                 {sessions.find(s=>s.id === targetPeerId)?.customName || sessions.find(s=>s.id === targetPeerId)?.name || 'UNKNOWN'}
                             </span>
                         </div>
                         <p className="text-[8px] text-neutral-500 font-mono mt-0.5">{isPeerOnline ? 'ENCRYPTED_LINK_ACTIVE' : 'OFFLINE'}</p>
                     </div>
                 </div>
                 <div className="flex gap-2">
                     {isPeerOnline && (
                         <button 
                             onClick={initiateCall}
                             className="p-2 text-emerald-500 hover:text-white bg-emerald-500/10 hover:bg-emerald-500 rounded-full transition-all active:scale-95"
                         >
                             <Phone size={18} fill="currentColor" />
                         </button>
                     )}
                     <button onClick={() => setShowMediaDrawer(true)} className="p-2 text-neutral-400 hover:text-white rounded-full hover:bg-white/5"><UploadCloud size={18}/></button>
                     <button onClick={() => { if(confirm("Clear Chat?")) { setMessages([]); setStoredMessages([]); } }} className="p-2 text-neutral-400 hover:text-red-500 rounded-full hover:bg-red-500/10"><Skull size={18} /></button>
                 </div>
             </div>

             {/* Message List */}
             <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scroll bg-noise pb-4">
                 {messages.length === 0 && (
                     <div className="h-full flex flex-col items-center justify-center opacity-30 gap-4">
                         <Shield size={48} className="text-neutral-500" strokeWidth={1} />
                         <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">NO_HISTORY</p>
                     </div>
                 )}
                 {messages.map((msg) => (
                    <MessageBubble 
                        key={msg.id} 
                        msg={msg} 
                        setViewImage={setViewImage} 
                    />
                 ))}
                 <div ref={msgEndRef} />
             </div>

             {/* Status Overlay if disconnected */}
             {!isPeerOnline && stage !== 'IDLE' && (
                 <div className="absolute bottom-20 left-0 right-0 flex justify-center pointer-events-none">
                     <div className="bg-red-500/90 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 animate-pulse">
                         <WifiOff size={12} /> CONNECTION_LOST
                     </div>
                 </div>
             )}

             <IStokInput 
                onSend={(t: string) => sendMessage('TEXT', t)} 
                onTyping={() => {}} 
                disabled={!isPeerOnline}
                isRecording={isRecording}
                recordingTime={recordingTime}
                onStartRecord={startRecording}
                onStopRecord={stopRecording}
                onAttach={() => fileInputRef.current?.click()}
                onTogglePTT={() => setShowWalkieTalkie(true)}
             />
             <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*" />
        </div>
    );
};
