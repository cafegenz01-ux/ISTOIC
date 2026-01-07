
import React, { useState, useEffect, useRef } from 'react';
import { 
    encryptData, decryptData
} from '../../utils/crypto'; 
import { TeleponanView } from '../teleponan/TeleponanView';
import { activatePrivacyShield } from '../../utils/privacyShield';
import { 
    Send, Zap, ScanLine, Server, X,
    Mic, PhoneCall, 
    QrCode, Lock, Flame, 
    ShieldAlert, ArrowLeft, BrainCircuit, Sparkles,
    Wifi, Radio, Paperclip, Check,
    User, Image as ImageIcon, FileText, Download, Play, Pause, Trash2, LogIn, Chrome, Loader2,
    Users, Activity, Signal, LayoutGrid, Settings, Power, ShieldCheck, ArrowRight
} from 'lucide-react';

// --- HOOKS & SERVICES ---
import useLocalStorage from '../../hooks/useLocalStorage';
import { SidebarIStokContact, IStokSession, IStokProfile } from './components/SidebarIStokContact';
import { ShareConnection } from './components/ShareConnection'; 
import { ConnectionNotification } from './components/ConnectionNotification';
import { CallNotification } from './components/CallNotification';
import { MessageBubble } from './components/MessageBubble'; 
import { QRScanner } from './components/QRScanner'; 
import { compressImage } from './components/gambar';
// FIX: Changed from IStokIdentityService to IstokIdentityService
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

interface IStokViewProps {
    onLogout: () => void;
}

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
export const IStokView: React.FC<IStokViewProps> = ({ onLogout }) => {
    // --- STATE MANAGEMENT ---
    const [stage, setStage] = useState<ConnectionStage>('IDLE');
    
    // Identity State - DIRECTLY FROM GLOBAL STORAGE (NO LOGIN UI)
    const [identity] = useLocalStorage<IStokUserIdentity | null>('istok_user_identity', null);
    
    // Profile (Mapped for UI)
    const [myProfile, setMyProfile] = useState<IStokProfile>({ id: '', username: '', created: 0 });

    const [sessions, setSessions] = useLocalStorage<IStokSession[]>('istok_sessions_v2', []);
    
    // Connection Data
    const [targetPeerId, setTargetPeerId] = useState('');
    const [accessPin, setAccessPin] = useState(''); // PIN for specific session encryption
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
        
        // CRITICAL: GLOBAL IDENTITY CHECK
        // If no identity exists from the main App login, kick user back to Auth.
        // We do NOT ask for Google Login here.
        if (!identity || !identity.istokId) {
            console.warn("IStok Access Denied: No Global Identity Found.");
            onLogout(); // Redirect to Main Auth
            return;
        }

        // Sync Identity to Profile format for UI
        setMyProfile({
            id: identity.istokId,
            username: identity.displayName,
            email: identity.email,
            photoURL: identity.photoURL,
            created: Date.now()
        });
        
        // Auto Init Peer Network using the Global ID
        initPeer(identity.istokId);

        // URL Deep Link Handler (Auto-fill connection details)
        const urlParams = new URLSearchParams(window.location.search);
        if(urlParams.get('connect') && urlParams.get('key')) {
            setTargetPeerId(urlParams.get('connect')!);
            setAccessPin(urlParams.get('key')!);
        }
    }, [identity]);

    // Scroll to bottom
    useEffect(() => {
        msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

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
                if (targetPeerId && accessPin) {
                    // Optional: Auto-connect if link provided? 
                    // For security, let user click "Connect"
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
        // For incoming data, we assume the PIN is the Access PIN for this session
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

    // 1. DASHBOARD MODE (Not Connected)
    if (!isConnected) {
        return (
            <div className="h-[100dvh] bg-[#050505] flex flex-col p-4 md:p-8 relative font-sans text-white overflow-hidden">
                 
                 {/* Top Navigation */}
                 <div className="flex justify-between items-center z-20 mb-8 pt-safe">
                     <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-emerald-900/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
                             <Radio size={20} />
                         </div>
                         <div>
                             <h1 className="font-black text-xl italic tracking-tighter uppercase">ISTOK <span className="text-emerald-500">SECURE</span></h1>
                             <div className="flex items-center gap-2 text-[9px] font-mono text-neutral-500">
                                <span className={`w-1.5 h-1.5 rounded-full ${peerRef.current?.id ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                                {peerRef.current?.id ? 'UPLINK_READY' : 'OFFLINE'}
                             </div>
                         </div>
                     </div>
                     <button onClick={onLogout} className="p-2 bg-white/5 rounded-full text-neutral-500 hover:text-white transition-all">
                         <Power size={18}/>
                     </button>
                 </div>

                 {/* Main Dashboard Grid */}
                 <div className="flex-1 overflow-y-auto custom-scroll space-y-6 z-10 max-w-4xl mx-auto w-full">
                     
                     {/* Identity Card */}
                     <div className="bg-[#09090b] border border-white/10 rounded-[32px] p-6 relative overflow-hidden group">
                         <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none group-hover:bg-emerald-500/10 transition-colors duration-500"></div>
                         
                         <div className="flex items-center gap-5 relative z-10">
                             <div className="relative">
                                <img src={identity?.photoURL} className="w-20 h-20 rounded-full border-2 border-emerald-500/50 object-cover shadow-lg shadow-emerald-900/20" alt="User" />
                                <div className="absolute -bottom-1 -right-1 bg-[#09090b] p-1.5 rounded-full border border-white/10">
                                    <ShieldCheck size={14} className="text-emerald-500"/>
                                </div>
                             </div>
                             <div className="flex-1 min-w-0">
                                 <h2 className="text-2xl font-bold truncate">{identity?.displayName}</h2>
                                 <p className="text-xs text-neutral-500 font-mono mb-3 truncate">{identity?.email}</p>
                                 <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/5 cursor-pointer hover:bg-white/10 transition-all" onClick={() => navigator.clipboard.writeText(identity?.istokId || '')}>
                                     <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">ID:</span>
                                     <code className="text-xs font-mono text-white truncate max-w-[150px]">{identity?.istokId}</code>
                                     <Sparkles size={12} className="text-emerald-500"/>
                                 </div>
                             </div>
                         </div>
                     </div>

                     {/* Quick Connect Panel */}
                     <div className="bg-[#09090b] border border-white/10 rounded-[32px] p-6 space-y-6 shadow-xl">
                         <div className="flex items-center gap-2 border-b border-white/5 pb-4">
                             <Activity size={18} className="text-blue-500" />
                             <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">ESTABLISH_CONNECTION</h3>
                         </div>

                         <div className="space-y-4">
                             <div className="relative">
                                <input 
                                    value={targetPeerId} 
                                    onChange={e=>setTargetPeerId(e.target.value)} 
                                    placeholder="ENTER TARGET ID OR LINK" 
                                    className="w-full bg-[#121214] border border-white/10 p-4 rounded-2xl text-white text-center text-sm font-mono focus:border-blue-500 outline-none uppercase placeholder:text-neutral-700 transition-all focus:shadow-[0_0_20px_rgba(59,130,246,0.2)]"
                                />
                                <button onClick={()=>setShowScanner(true)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-neutral-500 hover:text-white bg-white/5 rounded-xl transition-all hover:scale-110">
                                    <ScanLine size={18}/>
                                </button>
                             </div>
                             
                             <div className="flex gap-3">
                                 <input 
                                    value={accessPin} 
                                    onChange={e=>setAccessPin(e.target.value)} 
                                    placeholder="PIN (6)" 
                                    maxLength={6} 
                                    className="w-32 bg-[#121214] border border-white/10 p-4 rounded-2xl text-white text-center text-sm font-mono tracking-[0.3em] focus:border-blue-500 outline-none transition-all placeholder:tracking-normal placeholder:text-neutral-700"
                                />
                                <button 
                                    onClick={()=>connectToPeer(targetPeerId, accessPin)} 
                                    disabled={!targetPeerId || accessPin.length < 4}
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2 group active:scale-95"
                                >
                                    {stage === 'IDLE' ? 'CONNECT NOW' : <><Loader2 size={14} className="animate-spin"/> {stage}...</>} <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform"/>
                                </button>
                             </div>
                         </div>

                         <div className="grid grid-cols-2 gap-3">
                             <button onClick={()=>setShowShare(true)} className="py-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 text-neutral-300 hover:text-white transition-all flex flex-col items-center gap-2 group active:scale-95">
                                 <QrCode size={20} className="text-emerald-500 group-hover:scale-110 transition-transform"/>
                                 <span className="text-[10px] font-bold uppercase tracking-wider">SHARE MY ID</span>
                             </button>
                             <button onClick={()=>setShowSidebar(true)} className="py-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 text-neutral-300 hover:text-white transition-all flex flex-col items-center gap-2 group active:scale-95">
                                 <Users size={20} className="text-purple-500 group-hover:scale-110 transition-transform"/>
                                 <span className="text-[10px] font-bold uppercase tracking-wider">CONTACTS</span>
                             </button>
                         </div>
                     </div>

                     {/* Radar / Status Footer */}
                     <div className="flex items-center justify-between px-2 opacity-50">
                         <div className="flex items-center gap-4 text-[9px] font-mono">
                             <span className="flex items-center gap-1"><Signal size={10}/> P2P: {peerRef.current ? 'ACTIVE' : 'INIT'}</span>
                             <span className="flex items-center gap-1"><Server size={10}/> RELAY: {process.env.VITE_METERED_API_KEY ? 'TITANIUM' : 'STANDARD'}</span>
                         </div>
                         <div className="text-[9px] font-black uppercase tracking-[0.2em]">V25.0_SECURE</div>
                     </div>
                 </div>

                 {/* Background Grid */}
                 <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none opacity-20"></div>
                 
                 {/* Modals */}
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
                
                <SidebarIStokContact 
                    isOpen={showSidebar} 
                    onClose={()=>setShowSidebar(false)} 
                    sessions={sessions} 
                    profile={myProfile}
                    onSelect={(s)=>{setTargetPeerId(s.id); if(s.pin) setAccessPin(s.pin); setShowSidebar(false);}}
                    onDeleteSession={()=>{}} 
                    onCallContact={()=>{}} 
                    onLogout={onLogout} 
                    onRenameSession={()=>{}} 
                    currentPeerId={null}
                />
            </div>
        );
    }

    // 2. CHAT INTERFACE (Connected)
    return (
        <div className="h-[100dvh] bg-[#050505] flex flex-col relative overflow-hidden font-sans">
             <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>
             
             {/* Chat Header */}
             <div className="bg-[#09090b]/80 backdrop-blur-md border-b border-white/10 p-4 pt-safe flex justify-between items-center z-20 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-emerald-900/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500 overflow-hidden shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                            <User size={20}/>
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#09090b] animate-pulse"></div>
                    </div>
                    <div>
                        <h3 className="text-white font-black text-sm uppercase tracking-wide flex items-center gap-2">
                            SECURE_CHANNEL <Lock size={10} className="text-emerald-500"/>
                        </h3>
                        <div className="flex items-center gap-2 text-[9px] font-mono text-emerald-500/70">
                            <span>{targetPeerId.slice(0,8)}...</span>
                            <span className="w-1 h-1 rounded-full bg-emerald-500/50"></span>
                            <span>AES-256</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={()=>setShowCall(true)} className="p-2.5 hover:bg-emerald-500/10 rounded-xl text-neutral-400 hover:text-emerald-500 transition border border-transparent hover:border-emerald-500/20"><PhoneCall size={18}/></button>
                    <button onClick={handleDisconnect} className="p-2.5 hover:bg-red-500/10 rounded-xl text-neutral-400 hover:text-red-500 transition border border-transparent hover:border-red-500/20"><X size={18}/></button>
                </div>
             </div>

             {/* Messages */}
             <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scroll">
                {messages.map(msg => (
                    <MessageBubble key={msg.id} msg={msg} setViewImage={setViewImage} />
                ))}
                <div ref={msgEndRef}/>
             </div>

             {/* Input Area */}
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
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur flex items-center justify-center p-6 animate-fade-in">
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
            
            {showCall && <TeleponanView onClose={()=>setShowCall(false)} existingPeer={peerRef.current} initialTargetId={targetPeerId} incomingCall={incomingCall} secretPin={accessPin} />}
            
            {incomingCall && !showCall && <CallNotification identity="Secure Peer" onAnswer={()=>setShowCall(true)} onDecline={()=>{incomingCall.close(); setIncomingCall(null);}} />}
            
            {/* Image Viewer */}
            {viewImage && (
                <div className="fixed inset-0 z-[3000] bg-black/95 backdrop-blur flex items-center justify-center p-4 animate-fade-in" onClick={() => setViewImage(null)}>
                    <img src={viewImage} className="max-w-full max-h-full rounded-lg shadow-2xl border border-white/10" alt="Secure Content" />
                    <button className="absolute top-4 right-4 p-3 bg-white/10 rounded-full text-white hover:bg-red-500 transition-colors"><X size={24}/></button>
                </div>
            )}
        </div>
    );
};