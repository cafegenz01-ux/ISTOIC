
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
    X, RefreshCw, Lock, Flame, ShieldAlert, Image as ImageIcon, Loader2, ArrowLeft, Wifi, WifiOff, UploadCloud, Users, Radio as RadioIcon, Globe, Phone, Paperclip
} from 'lucide-react';
import useLocalStorage from '../../hooks/useLocalStorage';
import { useIDB } from '../../hooks/useIDB'; 
import { SidebarIStokContact, IStokSession, IStokProfile, IStokContact } from './components/SidebarIStokContact';
import { ShareConnection } from './components/ShareConnection'; 
import { ConnectionNotification } from './components/ConnectionNotification';
import { CallNotification } from './components/CallNotification';
import { AudioMessagePlayer, getSupportedMimeType } from './components/vn';
import { compressImage, ImageMessage } from './components/gambar';
import { IStokAuth } from './components/IStokAuth';
import { IStokWalkieTalkie } from './components/IStokWalkieTalkie';
import { v4 as uuidv4 } from 'uuid';

// --- CONSTANTS ---
const CHUNK_SIZE = 12 * 1024; 
const HEARTBEAT_INTERVAL = 3000; 
const HEARTBEAT_TIMEOUT = 15000; 

// --- TYPES (Previous Types remain) ---
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

// ... (Sound & Haptic Utils kept same) ...
const triggerHaptic = (ms: number | number[]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(ms);
    }
};

const playSound = (type: 'MSG_IN' | 'MSG_OUT' | 'CONNECT' | 'CALL_RING' | 'ERROR' | 'BUZZ') => {
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
            osc.type = 'square';
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(440, now + 0.3);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        }
    } catch (e) {
        // Silent fail
    }
};

const getIceServers = async (): Promise<any[]> => {
    const meteredKey = process.env.VITE_METERED_API_KEY;
    const meteredDomain = process.env.VITE_METERED_DOMAIN || 'istok.metered.live';

    let iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
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

// ... (MessageBubble & IStokInput components kept identical) ...
const MessageBubble = React.memo(({ msg, setViewImage }: any) => {
    return (
        <div className={`flex ${msg.sender === 'ME' ? 'justify-end' : 'justify-start'} mb-2 animate-slide-up group`}>
            <div className={`max-w-[85%] flex flex-col ${msg.sender === 'ME' ? 'items-end' : 'items-start'}`}>
                <div className={`p-2 rounded-2xl text-sm border shadow-sm relative ${msg.sender === 'ME' ? 'bg-blue-600/20 border-blue-500/30 text-blue-100 rounded-tr-none' : 'bg-[#1a1a1a] text-neutral-200 border-white/10 rounded-tl-none'} ${msg.type === 'TEXT' ? 'px-4 py-2' : 'p-1'}`}>
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
                     <span className="whitespace-pre-wrap leading-relaxed break-words">{msg.content}</span>}
                </div>
                
                {/* Meta Data Footer */}
                <div className="flex items-center gap-1.5 mt-1 px-1">
                     <span className="text-[9px] font-mono text-neutral-500">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                     {msg.sender === 'ME' && (
                         <div className="flex items-center ml-1">
                             {/* STATUS ICONS LOGIC */}
                             {msg.status === 'PENDING' && <Clock size={10} className="text-neutral-500" />}
                             {msg.status === 'SENT' && <Check size={12} className="text-neutral-500" />}
                             {msg.status === 'DELIVERED' && <CheckCheck size={12} className="text-neutral-500" />}
                             {msg.status === 'READ' && <CheckCheck size={12} className="text-blue-400" />}
                         </div>
                     )}
                </div>
            </div>
        </div>
    );
});

const IStokInput = React.memo(({ onSend, onTyping, disabled, isRecording, recordingTime, onStartRecord, onStopRecord, onAttach, onTogglePTT }: any) => {
    const [text, setText] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const typingTimeoutRef = useRef<any>(null);

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        setText(e.target.value);
        
        // Typing Logic
        onTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            onTyping(false);
        }, 1500); // Stop typing status after 1.5s idle
    };

    return (
        <div className="bg-[#09090b] border-t border-white/10 p-3 z-20 pb-[max(env(safe-area-inset-bottom),1rem)]">
            <div className="flex gap-2 items-end">
                <button onClick={onAttach} className="p-3 rounded-full text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"><Paperclip size={20}/></button>
                <div className="flex-1 bg-white/5 rounded-2xl px-4 py-3 border border-white/5 focus-within:border-emerald-500/50 transition-colors">
                    <input 
                        ref={inputRef}
                        value={text} 
                        onChange={handleInput} 
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
    // Only attempt if supported, silently fail otherwise to prevent app error
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        try {
            navigator.serviceWorker.controller.postMessage({
                type: 'SHOW_NOTIFICATION',
                payload: { title, body, tag, data }
            });
        } catch (e) {
            console.warn("SW PostMessage Failed", e);
        }
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
    const [isPeerTyping, setIsPeerTyping] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [isRelayActive, setIsRelayActive] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [showContactSidebar, setShowContactSidebar] = useState(false);
    const [showWalkieTalkie, setShowWalkieTalkie] = useState(false);
    const [viewImage, setViewImage] = useState<string | null>(null);
    const [latestAudioMessage, setLatestAudioMessage] = useState<Message | null>(null);
    
    // CALLING STATE
    const [incomingMediaCall, setIncomingMediaCall] = useState<any>(null);
    const [activeTeleponan, setActiveTeleponan] = useState(false);
    const [outgoingCallTarget, setOutgoingCallTarget] = useState<string | null>(null);

    // --- REFS FOR EVENT LISTENERS ---
    const incomingMediaCallRef = useRef<any>(null);
    const incomingReqRef = useRef<any>(null);
    
    useEffect(() => { incomingMediaCallRef.current = incomingMediaCall; }, [incomingMediaCall]);
    useEffect(() => { incomingReqRef.current = incomingConnectionRequest; }, [incomingConnectionRequest]);

    // --- PERSISTENCE: LOAD CHAT HISTORY ---
    const [storedMessages, setStoredMessages] = useIDB<Message[]>(`istok_chat_${targetPeerId || 'draft'}`, []);

    // Sync Access Pin Ref
    useEffect(() => { pinRef.current = accessPin; }, [accessPin]);

    // REQUEST NOTIFICATION PERMISSION ON MOUNT
    useEffect(() => {
        if ('Notification' in window && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    }, []);

    // ... (Service Worker Bridge, Focus Listener same) ...

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
        setIsPeerTyping(false);
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
    const joinSession = async (id?: string, pin?: string, attempt = 1) => {
        const target = id || targetPeerId;
        const key = pin || accessPin;
        if (!target || !key) {
            setErrorMsg("Target ID or PIN missing.");
            return;
        }

        // Set local state before connection attempt
        setAccessPin(key);
        setTargetPeerId(target);
        pinRef.current = key;

        if (connRef.current && connRef.current.peer === target && isPeerOnline) {
             setMode('CHAT');
             return;
        }

        if (attempt === 1) nukeConnection();

        if (!peerRef.current || peerRef.current.destroyed) {
            setErrorMsg("NETWORK_OFFLINE");
            return;
        }

        setStage('LOCATING_PEER');
        
        try {
            // Force Reliable True
            const conn = peerRef.current.connect(target, { 
                reliable: true,
                serialization: 'json',
                metadata: { attempt }
            });
            connRef.current = conn;

            // Robust Connection Timeout Backup (Increases with attempts)
            const timeoutMs = 8000 + (attempt * 2000);
            
            const connectionTimeout = setTimeout(() => {
                if (stage !== 'SECURE' && stage !== 'AWAITING_APPROVAL') {
                    console.warn(`Connection attempt ${attempt} timed out`);
                    conn.close();
                    
                    if (attempt < 4) {
                         setStage('RECONNECTING');
                         setTimeout(() => joinSession(target, key, attempt + 1), 1000);
                    } else {
                         setErrorMsg("PEER_UNREACHABLE");
                         setStage('IDLE');
                    }
                }
            }, timeoutMs);

            conn.on('open', () => {
                clearTimeout(connectionTimeout);
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
                    } else {
                        setErrorMsg("ENCRYPTION_FAILED");
                    }
                }, 800);
            });

            conn.on('data', (data: any) => handleData(data));
            conn.on('close', () => {
                clearTimeout(connectionTimeout);
                handleDisconnect();
            });
            conn.on('error', (err: any) => {
                clearTimeout(connectionTimeout);
                console.error("Conn Error", err);
                
                // Retry Logic
                if (attempt < 4) {
                     setTimeout(() => joinSession(target, key, attempt + 1), 1500);
                } else {
                     setErrorMsg('CONNECTION_FAILED');
                     setStage('IDLE');
                }
            });
            
        } catch(e) {
            console.error("Join Exception", e);
            setErrorMsg('CONNECTION_ERROR');
        }
    };

    const sendAck = async (msgId: string, status: 'DELIVERED' | 'READ') => {
        if (!connRef.current) return;
        const payload = JSON.stringify({
            id: msgId,
            status: status
        });
        const encrypted = await encryptData(payload, pinRef.current);
        if (encrypted) {
            connRef.current.send({ type: 'ACK', payload: encrypted });
        }
    };

    const handleData = async (data: any, incomingConn?: any) => {
        // ... (Processing logic remains same) ...

        // Use current session key
        const currentKey = pinRef.current;

        // --- HANDSHAKE: REQUEST ---
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
                    
                    sendSystemNotification('CONNECTION REQUEST', `${req.identity} wants to connect.`, 'istok_req', { peerId: incomingConn.peer });
                }
            } else {
                console.warn("[ISTOK_SEC] Decryption Failed for REQ. PIN Mismatch or Tampering.");
            }
        } 
        
        // --- HANDSHAKE: RESPONSE ---
        else if (data.type === 'RESP') {
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
                setErrorMsg("PIN MISMATCH: Unable to decrypt handshake.");
                setStage('IDLE');
                if (connRef.current) connRef.current.close();
            }
        } 
        // ... (Other msg types) ...
    };

    const handleIncomingConnection = (conn: any) => {
        console.log("[ISTOK_NET] Incoming connection from", conn.peer);
        conn.on('data', (data: any) => handleData(data, conn));
        conn.on('close', handleDisconnect);
        conn.on('error', (err: any) => console.warn("Incoming Conn Error", err));
    };

    const handleDisconnect = () => {
        setIsPeerOnline(false);
        setIsPeerTyping(false);
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        if (mode === 'CHAT') {
            setStage('RECONNECTING');
            setErrorMsg("PEER_DISCONNECTED");
        }
    };

    // --- CONTACT DIALING ---
    const handleCallContact = (contact: IStokContact) => {
        // Prompt for PIN if not saved in session? 
        // For simplicity in this P2P model, we assume a "Contact" implies we know the shared PIN 
        // or we use a default if previously connected.
        
        // Find if we have a session for this contact to get the PIN
        const session = sessions.find(s => s.id === contact.id);
        const pinToUse = session?.pin || accessPin; // Fallback to current pin if none found

        if (!pinToUse) {
             // If no pin, maybe prompt user? For now, we just rely on last used.
             alert("PIN Keamanan tidak ditemukan untuk kontak ini. Silakan masukkan PIN manual di menu Join.");
             setTargetPeerId(contact.id);
             setMode('JOIN');
             return;
        }

        setAccessPin(pinToUse);
        setTargetPeerId(contact.id);
        setShowContactSidebar(false);
        joinSession(contact.id, pinToUse);
    };

    // ... (Sidebar Handlers Updated) ...
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

    // MISSING HELPER FUNCTIONS IMPLEMENTATION

    const acceptConnection = async () => {
        const req = incomingConnectionRequest;
        if (!req) return;

        const currentKey = pinRef.current;
        const responsePayload = JSON.stringify({
            type: 'CONNECTION_ACCEPT',
            identity: myProfile.username
        });

        const encrypted = await encryptData(responsePayload, currentKey);

        if (encrypted && req.conn) {
            req.conn.send({ type: 'RESP', payload: encrypted });

            connRef.current = req.conn;
            setTargetPeerId(req.peerId);
            setAccessPin(currentKey);
            setMode('CHAT');
            setStage('SECURE');
            setIsPeerOnline(true);

            const now = Date.now();
            setSessions(prev => {
                const existing = prev.find(s => s.id === req.peerId);
                const newSession: IStokSession = {
                    id: req.peerId,
                    name: req.identity,
                    lastSeen: now,
                    status: 'ONLINE',
                    pin: currentKey,
                    createdAt: existing ? existing.createdAt : now
                };

                if (existing) {
                    return prev.map(s => s.id === req.peerId ? newSession : s);
                }
                return [...prev, newSession];
            });

            startHeartbeat();
            setIncomingConnectionRequest(null);
        } else {
            console.error("Failed to encrypt Accept response");
        }
    };

    const sendMessage = async (type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'FILE', content: string, extra: any = {}) => {
        const msg: Message = {
            id: uuidv4(),
            sender: 'ME',
            type,
            content,
            timestamp: Date.now(),
            status: 'PENDING',
            ...extra
        };

        setMessages(prev => [...prev, msg]);
        setStoredMessages(prev => [...prev, msg]);

        if (connRef.current && isPeerOnline) {
            const payload = JSON.stringify(msg);
            const encrypted = await encryptData(payload, pinRef.current);

            if (encrypted) {
                connRef.current.send({ type: 'MSG', payload: encrypted });
                setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'SENT' } : m));
                playSound('MSG_OUT');
            } else {
                setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: 'ENCRYPTION_FAILED', type: 'TEXT' } : m));
            }
        }
    };

    const handleTyping = (isTyping: boolean) => {
        if (connRef.current) {
            connRef.current.send({ type: isTyping ? 'TYPING_START' : 'TYPING_STOP' });
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = getSupportedMimeType() || 'audio/webm';
            const recorder = new MediaRecorder(stream, { mimeType });

            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.start();
            setIsRecording(true);
            setRecordingTime(0);

            recordingIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (e) {
            console.error("Mic error", e);
            alert("Mic Access Denied");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType });
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    const mimeType = mediaRecorderRef.current?.mimeType;
                    sendMessage('AUDIO', base64, { duration: recordingTime, size: blob.size, mimeType });
                };
                reader.readAsDataURL(blob);

                const tracks = mediaRecorderRef.current?.stream.getTracks();
                tracks?.forEach(track => track.stop());
            };

            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type.startsWith('image/')) {
            try {
                const { base64, size, width, height, mimeType } = await compressImage(file);
                sendMessage('IMAGE', base64, { size, width, height, mimeType });
            } catch (err) {
                alert("Gagal memproses gambar.");
            }
        } else {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1];
                sendMessage('FILE', base64, {
                    fileName: file.name,
                    size: file.size,
                    mimeType: file.type
                });
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

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

    // 2. Incoming Call Notification Overlay (Global Priority)
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
                    onCallContact={handleCallContact} // New Handler
                    onRenameSession={handleRenameSession}
                    onDeleteSession={handleDeleteSession}
                    onRegenerateProfile={regenerateProfile}
                    currentPeerId={null}
                 />

                 {/* Global Connection Request Overlay */}
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
                        <div className="text-left"><h3 className="font-bold text-white">CONTACTS</h3><p className="text-[10px] text-neutral-500">Saved Friends</p></div>
                    </button>
                </div>
            </div>
        );
    }

    // 5. Setup Mode (Host/Join)
    if (mode === 'HOST' || mode === 'JOIN') {
        return (
            <div className="h-[100dvh] w-full bg-[#050505] flex flex-col items-center justify-center px-6 relative font-sans">
                 {/* Global Connection Request Overlay */}
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
             
             {/* Global Connection Request Overlay (Even in chat, for multi-peer future proofing) */}
             {incomingConnectionRequest && <ConnectionNotification identity={incomingConnectionRequest.identity} peerId={incomingConnectionRequest.peerId} onAccept={acceptConnection} onDecline={() => setIncomingConnectionRequest(null)} />}

             {showWalkieTalkie && (
                 <IStokWalkieTalkie 
                    onClose={() => setShowWalkieTalkie(false)} 
                    onSendAudio={(b64, dur, size) => sendMessage('AUDIO', b64, { duration: dur, size, mimeType: 'audio/webm' })}
                    latestMessage={latestAudioMessage}
                 />
             )}

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
                         <p className="text-[8px] text-neutral-500 font-mono mt-0.5 animate-fade-in">
                            {isPeerTyping ? 'MENGETIK...' : (isPeerOnline ? 'ONLINE' : 'OFFLINE')}
                         </p>
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
                onTyping={(isTyping: boolean) => handleTyping(isTyping)} 
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
