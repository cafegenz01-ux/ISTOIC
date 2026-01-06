
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
    Wifi, Radio, Paperclip, Check,
    User, Image as ImageIcon, FileText, Download, Play, Pause, Trash2, LogIn, Chrome
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
import { IStokWalkieTalkie } from './components/IStokWalkieTalkie'; 
import { MediaDrawer } from './components/MediaDrawer';
import { IstokIdentityService, IStokUserIdentity } from './services/istokIdentity';
import { IStokInput } from './components/IStokInput'; 

// --- HYDRA CONSTANTS ---
const CHUNK_SIZE = 1024 * 64; // 64KB
const HEARTBEAT_MS = 2000;

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
    mimeType?: string;
    ttl?: number; 
}

type ConnectionStage = 'IDLE' | 'LOCATING' | 'HANDSHAKE' | 'SECURE' | 'RECONNECTING';

// --- UTILS ---
const playSound = (type: 'MSG_IN' | 'MSG_OUT' | 'CONNECT' | 'ERROR') => {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        const now = ctx.currentTime;
        if(type === 'MSG_IN') {
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
        } else if (type === 'MSG_OUT') {
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
        } else if (type === 'CONNECT') {
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(800, now + 0.2);
        }
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    } catch(e) {}
};

// --- MAIN VIEW CONTROLLER ---
export const IStokView: React.FC = () => {
    // --- STATE MANAGEMENT ---
    const [stage, setStage] = useState<ConnectionStage>('IDLE');
    
    // Identity State
    const [identity, setIdentity] = useLocalStorage<IStokUserIdentity | null>('istok_google_identity', null);
    
    // Profile (Mapped for UI)
    const [myProfile, setMyProfile] = useState<IStokProfile>({ id: '', username: '', created: 0 });

    const [sessions, setSessions] = useLocalStorage<IStokSession[]>('istok_sessions_v2', []);
    
    // Connection Data
    const [targetPeerId, setTargetPeerId] = useState('');
    const [accessPin, setAccessPin] = useState(''); // PIN still needed for encryption
    const [isConnected, setIsConnected] = useState(false);
    
    // Chat Data
    const [messages, setMessages] = useState<Message[]>([]);
    const [ttlMode, setTtlMode] = useState(0);
    const [isAiThinking, setIsAiThinking] = useState(false);

    // UI Toggles
    const [showSidebar, setShowSidebar] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [showCall, setShowCall] = useState(false);
    const [viewImage, setViewImage] = useState<string | null>(null);

    // Notifications
    const [incomingRequest, setIncomingRequest] = useState<any>(null);
    const [incomingCall, setIncomingCall] = useState<any>(null);

    // REFS
    const peerRef = useRef<any>(null);
    const connRef = useRef<any>(null);
    const heartbeatRef = useRef<any>(null);
    const msgEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chunkBuffer = useRef<{[key:string]: {chunks:string[], count:number, total:number}}>({});

    // --- INITIALIZATION ---
    useEffect(() => {
        activatePrivacyShield();
        
        // Sync Identity to Profile format
        if (identity) {
            setMyProfile({
                id: identity.istokId,
                username: identity.displayName,
                email: identity.email,
                photoURL: identity.photoURL,
                created: Date.now()
            });
            // Auto Init Peer if logged in
            initPeer(identity.istokId);
        }

        // URL Deep Link Handler
        const urlParams = new URLSearchParams(window.location.search);
        if(urlParams.get('connect') && urlParams.get('key')) {
            setTargetPeerId(urlParams.get('connect')!);
            setAccessPin(urlParams.get('key')!);
            // If logged in, auto connect logic would trigger here
        }
    }, [identity]);

    // Scroll to bottom
    useEffect(() => {
        msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // --- GOOGLE AUTH HANDLER ---
    const handleLogin = async () => {
        const user = await IstokIdentityService.loginWithGoogle();
        if (user) {
            setIdentity(user);
        }
    };

    const handleLogout = async () => {
        await IstokIdentityService.logout();
        setIdentity(null);
        setIsConnected(false);
        peerRef.current?.destroy();
        peerRef.current = null;
    };

    // --- HYDRA NETWORK LAYER (PeerJS) ---
    const initPeer = async (myId: string) => {
        if (peerRef.current) return; // Already init

        try {
            const { Peer } = await import('peerjs');
            
            // 1. Default STUN (Free)
            let iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];

            // 2. Titanium Relay (TURN) - If configured in .env
            const meteredKey = process.env.VITE_METERED_API_KEY;
            const meteredDomain = process.env.VITE_METERED_DOMAIN || 'istoic.metered.live';

            if (meteredKey) {
                try {
                    const response = await fetch(`https://${meteredDomain}/api/v1/turn/credentials?apiKey=${meteredKey}`);
                    const ice = await response.json();
                    if (Array.isArray(ice)) {
                        iceServers = ice;
                        console.log("[ISTOK] Titanium Relay (TURN) Configured.");
                    }
                } catch (e) {
                    console.warn("[ISTOK] TURN Config Failed, using STUN fallback.", e);
                }
            }
            
            const peer = new Peer(myId, {
                debug: 0,
                config: { iceServers }
            } as any);

            peer.on('open', (id) => {
                console.log('[ISTOK] Secure ID Active:', id);
                // Check if deep link pending
                if (targetPeerId && accessPin) {
                    connectToPeer(targetPeerId, accessPin);
                }
            });

            peer.on('connection', (conn) => {
                conn.on('data', (data) => handleIncomingData(data, conn));
                conn.on('open', () => { /* Wait for Handshake */ });
                conn.on('close', () => handleDisconnect());
            });

            peer.on('call', (call) => {
                setIncomingCall(call);
                playSound('MSG_IN');
            });

            peerRef.current = peer;
        } catch(e) {
            console.error("[ISTOK] Peer Init Failed", e);
        }
    };

    // --- CONNECTION LOGIC ---
    const connectToPeer = (id: string, pin: string) => {
        if(!peerRef.current || !identity) return;
        setStage('LOCATING');
        
        const conn = peerRef.current.connect(id, { reliable: true });
        
        conn.on('open', async () => {
            setStage('HANDSHAKE');
            // Send Encrypted Handshake including Display Name and Photo
            const handshake = JSON.stringify({ 
                type: 'HANDSHAKE_SYN', 
                identity: identity.displayName,
                photo: identity.photoURL,
                email: identity.email 
            });
            const encrypted = await encryptData(handshake, pin);
            if(encrypted) conn.send({ type: 'SYS', payload: encrypted });
            connRef.current = conn;
        });

        conn.on('data', (d) => handleIncomingData(d, conn));
        conn.on('close', handleDisconnect);
        conn.on('error', () => { setStage('IDLE'); alert("Connection Failed / Wrong PIN"); });
    };

    const handleDisconnect = () => {
        setIsConnected(false);
        setStage('RECONNECTING');
    };

    const handleIncomingData = async (data: any, conn: any) => {
        // CHUNK HANDLING
        if (data.type === 'CHUNK') {
            const { id, idx, total, chunk } = data;
            if (!chunkBuffer.current[id]) chunkBuffer.current[id] = { chunks: new Array(total), count: 0, total };
            const buf = chunkBuffer.current[id];
            buf.chunks[idx] = chunk;
            buf.count++;
            
            if (buf.count === total) {
                const fullPayload = buf.chunks.join('');
                delete chunkBuffer.current[id];
                handleIncomingData({ type: 'MSG', payload: fullPayload }, conn);
            }
            return;
        }

        // DECRYPTION - Need PIN
        // If Host: PIN is generated by me. If Client: Input by user.
        // For simplicity in P2P, we assume PIN is agreed OOB (Out of Band) or shared via Link.
        const pin = accessPin || prompt("Incoming secure request. Enter decryption PIN:");
        if (!pin) return;
        setAccessPin(pin);

        if (data.type === 'SYS') {
            const decrypted = await decryptData(data.payload, pin);
            if (!decrypted) { alert("Wrong PIN for Incoming Data"); return; }
            const json = JSON.parse(decrypted);

            if (json.type === 'HANDSHAKE_SYN') {
                setIncomingRequest({ 
                    peerId: conn.peer, 
                    identity: json.identity, 
                    conn 
                });
                playSound('MSG_IN');
            } else if (json.type === 'HANDSHAKE_ACK') {
                setIsConnected(true);
                setStage('SECURE');
                playSound('CONNECT');
                // Heartbeat
                heartbeatRef.current = setInterval(() => {
                    if(connRef.current?.open) connRef.current.send({ type: 'PING' });
                }, HEARTBEAT_MS);
            }
        } 
        else if (data.type === 'MSG') {
            const decrypted = await decryptData(data.payload, pin);
            if(decrypted) {
                const msg = JSON.parse(decrypted);
                setMessages(prev => [...prev, { ...msg, sender: 'THEM', status: 'READ' }]);
                playSound('MSG_IN');
            }
        }
    };

    // --- SENDING LOGIC ---
    const sendMessage = async (type: string, content: string, extraData: any = {}) => {
        if (!connRef.current || !isConnected) return;

        const msgPayload = {
            id: crypto.randomUUID(),
            type,
            content,
            timestamp: Date.now(),
            ttl: ttlMode,
            ...extraData
        };

        const strPayload = JSON.stringify(msgPayload);
        const encrypted = await encryptData(strPayload, accessPin);
        
        if (!encrypted) return;

        if (encrypted.length > CHUNK_SIZE) {
            const chunkId = crypto.randomUUID();
            const totalChunks = Math.ceil(encrypted.length / CHUNK_SIZE);
            for (let i = 0; i < totalChunks; i++) {
                connRef.current.send({
                    type: 'CHUNK', id: chunkId, idx: i, total: totalChunks,
                    chunk: encrypted.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
                });
            }
        } else {
            connRef.current.send({ type: 'MSG', payload: encrypted });
        }

        setMessages(prev => [...prev, { ...msgPayload, sender: 'ME', status: 'SENT' } as Message]);
        playSound('MSG_OUT');
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if(e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if(file.size > 5 * 1024 * 1024) { alert("Max 5MB"); return; }
            if(file.type.startsWith('image/')) {
                const compressed = await compressImage(file);
                sendMessage('IMAGE', compressed.base64, { size: compressed.size, mimeType: compressed.mimeType });
            } else {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => {
                    const b64 = (reader.result as string).split(',')[1];
                    sendMessage('FILE', b64, { fileName: file.name, mimeType: file.type, size: file.size });
                };
            }
        }
    };

    // --- RENDERERS ---

    // 1. LOGIN SCREEN
    if (!identity) {
        return (
            <div className="h-[100dvh] bg-[#050505] flex flex-col items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none"></div>

                <div className="relative z-10 text-center space-y-8 max-w-sm w-full">
                    <div>
                        <h1 className="text-4xl font-black text-white italic tracking-tighter mb-2">ISTOK <span className="text-emerald-500">ID</span></h1>
                        <p className="text-xs font-mono text-neutral-500 uppercase tracking-widest">SECURE IDENTITY HASHING PROTOCOL</p>
                    </div>

                    <div className="p-6 bg-white/5 border border-white/10 rounded-[32px] backdrop-blur-md">
                        <div className="w-16 h-16 bg-white text-black rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                            <Lock size={32} />
                        </div>
                        <h3 className="text-white font-bold text-lg mb-2">Authentication Required</h3>
                        <p className="text-neutral-400 text-xs mb-6 leading-relaxed">
                            Sign in to generate your Deterministic Hash ID. 
                            Your email is used only to derive your public key.
                        </p>
                        <button 
                            onClick={handleLogin}
                            className="w-full py-4 bg-white text-black hover:bg-neutral-200 rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95"
                        >
                            <Chrome size={18} /> Login with Google
                        </button>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-[10px] text-emerald-500/60 font-mono">
                        <ShieldAlert size={12} /> MILITARY-GRADE ENCRYPTION READY
                    </div>
                </div>
            </div>
        );
    }

    // 2. CONNECTION SETUP (HOST/JOIN merged into one flow)
    if (!isConnected) {
        return (
            <div className="h-[100dvh] bg-[#050505] flex flex-col items-center justify-center p-6 relative">
                 <div className="absolute top-6 right-6 z-20">
                     <button onClick={handleLogout} className="p-2 bg-white/5 rounded-full text-neutral-500 hover:text-white transition-all"><X size={20}/></button>
                 </div>

                 {/* Identity Card */}
                 <div className="w-full max-w-sm bg-[#09090b] border border-white/10 p-6 rounded-[32px] text-center mb-8 relative overflow-hidden animate-slide-up">
                     <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-transparent"></div>
                     <img src={identity.photoURL || ''} className="w-16 h-16 rounded-full mx-auto mb-4 border-2 border-emerald-500/50 shadow-lg object-cover" alt="Profile" />
                     <h2 className="text-white font-bold text-lg">{identity.displayName}</h2>
                     <div className="mt-4 bg-black/50 p-3 rounded-xl border border-white/5 cursor-pointer hover:bg-black/80 transition-colors group" onClick={() => navigator.clipboard.writeText(identity.istokId)}>
                         <label className="text-[9px] text-neutral-500 font-bold block mb-1 uppercase tracking-widest">YOUR SECURE ID</label>
                         <code className="text-emerald-500 font-mono text-xs break-all group-hover:text-emerald-400">{identity.istokId}</code>
                     </div>
                 </div>

                 {/* Connect Form */}
                 <div className="w-full max-w-sm space-y-4 z-10 animate-slide-up" style={{animationDelay: '100ms'}}>
                     <div className="space-y-3">
                         <div className="relative">
                            <input 
                                value={targetPeerId} 
                                onChange={e=>setTargetPeerId(e.target.value)} 
                                placeholder="Target ID / Hash" 
                                className="w-full bg-[#121214] border border-white/10 p-4 rounded-2xl text-white text-center text-sm font-mono focus:border-emerald-500 outline-none uppercase placeholder:text-neutral-700"
                            />
                            <button onClick={()=>setShowScanner(true)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-neutral-500 hover:text-white"><ScanLine size={20}/></button>
                         </div>
                         
                         <input 
                            value={accessPin} 
                            onChange={e=>setAccessPin(e.target.value)} 
                            placeholder="SESSION PIN (6 DIGIT)" 
                            maxLength={6} 
                            className="w-full bg-[#121214] border border-white/10 p-4 rounded-2xl text-white text-center text-sm font-mono tracking-[0.5em] focus:border-emerald-500 outline-none placeholder:tracking-normal placeholder:text-neutral-700"
                        />
                         
                         <div className="grid grid-cols-2 gap-3 pt-2">
                             <button onClick={()=>setShowShare(true)} className="py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-white text-xs font-bold border border-white/5">SHARE MY ID</button>
                             <button 
                                onClick={()=>connectToPeer(targetPeerId, accessPin)} 
                                disabled={!targetPeerId || accessPin.length < 4}
                                className="py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-xs shadow-lg shadow-emerald-900/20 disabled:opacity-50"
                             >
                                 {stage === 'IDLE' ? 'CONNECT' : stage + '...'}
                             </button>
                         </div>
                     </div>
                 </div>
            </div>
        );
    }

    // 3. CHAT INTERFACE (Standard)
    return (
        <div className="h-[100dvh] bg-[#050505] flex flex-col relative overflow-hidden">
             {/* ... Same Chat UI as before ... */}
             <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>
             
             {/* Header */}
             <div className="bg-[#09090b] border-b border-white/10 p-4 pt-safe flex justify-between items-center z-20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-900/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500 overflow-hidden">
                         {/* We don't have peer photo unless handshake sent it. Assuming basic UI for now */}
                        <User size={20}/>
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-sm">SECURE_LINK</h3>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-500">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"/>
                            ENCRYPTED
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={()=>setShowCall(true)} className="p-2 hover:bg-white/5 rounded-lg text-neutral-400 hover:text-white transition"><PhoneCall size={18}/></button>
                    <button onClick={()=>setShowSidebar(true)} className="p-2 hover:bg-white/5 rounded-lg text-neutral-400 hover:text-white transition"><Menu size={18}/></button>
                </div>
             </div>

             {/* Messages */}
             <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scroll">
                {messages.map(msg => (
                    <MessageBubble key={msg.id} msg={msg} setViewImage={setViewImage} />
                ))}
                <div ref={msgEndRef}/>
             </div>

             {/* Input */}
             <IStokInput 
                onSend={(txt: string) => sendMessage('TEXT', txt)}
                onSendFile={() => fileInputRef.current?.click()}
                onSendAudio={(b64: string, dur: number) => sendMessage('AUDIO', b64, { duration: dur })}
                disabled={!isConnected}
                ttlMode={ttlMode}
                onToggleTtl={() => setTtlMode(p => p === 0 ? 30 : 0)}
                onAiAssist={() => {}} 
                isAiThinking={isAiThinking}
             />
             <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />

            {/* Overlays */}
            {incomingRequest && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur flex items-center justify-center p-6">
                    <ConnectionNotification 
                        identity={incomingRequest.identity} 
                        peerId={incomingRequest.peerId}
                        onAccept={async () => {
                            const { conn } = incomingRequest;
                            connRef.current = conn;
                            const ack = JSON.stringify({ type: 'HANDSHAKE_ACK' });
                            const enc = await encryptData(ack, accessPin);
                            conn.send({ type: 'SYS', payload: enc });
                            setIsConnected(true);
                            setStage('SECURE');
                            setIncomingRequest(null);
                        }}
                        onDecline={() => {
                            incomingRequest.conn.close();
                            setIncomingRequest(null);
                        }}
                    />
                </div>
            )}
            
            {showScanner && <QRScanner onScan={(val: string) => { 
                try {
                    const url = new URL(val);
                    const c = url.searchParams.get('connect');
                    const k = url.searchParams.get('key');
                    if(c && k) { setTargetPeerId(c); setAccessPin(k); connectToPeer(c, k); }
                    else { setTargetPeerId(val); }
                } catch { setTargetPeerId(val); }
                setShowScanner(false);
            }} onClose={()=>setShowScanner(false)} />}

            {showShare && <ShareConnection peerId={identity?.istokId || ''} pin={accessPin || '000000'} onClose={()=>setShowShare(false)} />}
            
            {showCall && <TeleponanView onClose={()=>setShowCall(false)} existingPeer={peerRef.current} initialTargetId={targetPeerId} incomingCall={incomingCall} secretPin={accessPin} />}
            
            {incomingCall && !showCall && <CallNotification identity="Secure Peer" onAnswer={()=>setShowCall(true)} onDecline={()=>{incomingCall.close(); setIncomingCall(null);}} />}
            
            <SidebarIStokContact 
                isOpen={showSidebar} 
                onClose={()=>setShowSidebar(false)} 
                sessions={sessions} 
                profile={myProfile}
                onSelect={()=>{}}
                onDeleteSession={()=>{}} 
                onCallContact={()=>{}} 
                onLogout={handleLogout} 
                onRenameSession={()=>{}} 
                currentPeerId={targetPeerId}
            />
        </div>
    );
};
