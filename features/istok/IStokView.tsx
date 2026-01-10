
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    encryptData, decryptData
} from '../../utils/crypto'; 
import { TeleponanView } from '../teleponan/TeleponanView';
import { activatePrivacyShield } from '../../utils/privacyShield';
import { 
    Radio, X, PhoneCall, 
    Lock, ShieldCheck, ArrowRight, Loader2,
    User, Sparkles, ScanLine, QrCode, Users, Signal, RefreshCw, CloudOff, MessageSquare
} from 'lucide-react';

// --- HOOKS & SERVICES ---
import useLocalStorage from '../../hooks/useLocalStorage';
import { SidebarIStokContact, IStokSession, IStokProfile, IStokContact } from './components/SidebarIStokContact';
import { ShareConnection } from './components/ShareConnection'; 
import { ConnectionNotification } from './components/ConnectionNotification';
import { CallNotification } from './components/CallNotification';
import { MessageBubble } from './components/MessageBubble'; 
import { QRScanner } from './components/QRScanner'; 
import { compressImage } from './components/gambar';
import { IStokUserIdentity } from './services/istokIdentity';
import { IStokInput } from './components/IStokInput'; 
import { OMNI_KERNEL } from '../../services/omniRace'; 

// --- CONSTANTS ---
const CHUNK_SIZE = 1024 * 64; // 64KB
const HEARTBEAT_INTERVAL = 2000; // Kirim detak jantung tiap 2 detik
const CONNECTION_TIMEOUT = 10000; // Anggap mati jika hening 10 detik
const HANDSHAKE_TIMEOUT = 30000; // Batas waktu notifikasi

// --- TYPES ---
interface Message {
    id: string;
    sender: 'ME' | 'THEM' | 'AI';
    type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'FILE' | 'AI_RESPONSE';
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
    globalPeer?: any; 
    initialAcceptedConnection?: any;
}

// --- MAIN CONTROLLER ---
export const IStokView: React.FC<IStokViewProps> = ({ onLogout, globalPeer, initialAcceptedConnection }) => {
    // --- STATE MANAGEMENT ---
    const [stage, setStage] = useState<ConnectionStage>('IDLE');
    const [identity] = useLocalStorage<IStokUserIdentity | null>('istok_user_identity', null);
    
    // Profile & Sessions
    const [myProfile, setMyProfile] = useState<IStokProfile>({ id: '', username: '', created: 0 });
    const [sessions, setSessions] = useLocalStorage<IStokSession[]>('istok_sessions_v2', []);
    
    // Connection Data
    const [targetPeerId, setTargetPeerId] = useState('');
    const [accessPin, setAccessPin] = useState('');
    const [isConnected, setIsConnected] = useState(false); 
    const [isPeerAlive, setIsPeerAlive] = useState(false); 
    const [isDataConnectionAlive, setIsDataConnectionAlive] = useState(false); 
    const [isNetworkOnline, setIsNetworkOnline] = useState(navigator.onLine);
    const [lastHeartbeat, setLastHeartbeat] = useState<number>(Date.now());
    
    // Chat Data
    const [messages, setMessages] = useState<Message[]>([]);
    const [ttlMode, setTtlMode] = useState(0);
    const [isAiThinking, setIsAiThinking] = useState(false);
    const [isPeerTyping, setIsPeerTyping] = useState(false); // New: Typing Indicator

    // UI Toggles
    const [showSidebar, setShowSidebar] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [showCall, setShowCall] = useState(false);
    const [viewImage, setViewImage] = useState<string | null>(null);

    // Notifications & Handshake
    const [incomingRequest, setIncomingRequest] = useState<any>(null);
    const [isHandshakeProcessing, setIsHandshakeProcessing] = useState(false);
    const [incomingCall, setIncomingCall] = useState<any>(null);

    // REFS
    const connRef = useRef<any>(null);
    const heartbeatIntervalRef = useRef<any>(null);
    const deathCheckIntervalRef = useRef<any>(null);
    const msgEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chunkBuffer = useRef<{[key:string]: {chunks:string[], count:number, total:number, lastUpdate: number}}>({});
    const reconnectTimeoutRef = useRef<any>(null);
    const requestTimeoutRef = useRef<any>(null);
    const audioCtxRef = useRef<AudioContext | null>(null); // Audio Singleton
    const typingTimeoutRef = useRef<any>(null);

    // --- SOUND ENGINE V2 (STABLE) ---
    const playSound = useCallback((type: 'MSG_IN' | 'MSG_OUT' | 'CONNECT' | 'ERROR' | 'RING') => {
        try {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            if (audioCtxRef.current.state === 'suspended') {
                audioCtxRef.current.resume();
            }

            const ctx = audioCtxRef.current;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            const now = ctx.currentTime;

            switch (type) {
                case 'MSG_IN':
                    osc.frequency.setValueAtTime(800, now);
                    osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.linearRampToValueAtTime(0, now + 0.2);
                    break;
                case 'MSG_OUT':
                    osc.frequency.setValueAtTime(400, now);
                    osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
                    gain.gain.setValueAtTime(0.05, now);
                    gain.gain.linearRampToValueAtTime(0, now + 0.2);
                    break;
                case 'CONNECT':
                    osc.frequency.setValueAtTime(400, now);
                    osc.frequency.linearRampToValueAtTime(800, now + 0.2);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.linearRampToValueAtTime(0, now + 0.4);
                    break;
                case 'RING':
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(600, now);
                    osc.frequency.setValueAtTime(800, now + 0.15);
                    gain.gain.setValueAtTime(0.05, now);
                    gain.gain.linearRampToValueAtTime(0, now + 0.3);
                    break;
            }
            osc.start(now); 
            osc.stop(now + 0.5);
        } catch(e) { /* Ignore audio errors */ }
    }, []);

    // --- LIFECYCLE ---
    useEffect(() => {
        activatePrivacyShield();
        
        const handleOnline = () => setIsNetworkOnline(true);
        const handleOffline = () => setIsNetworkOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        if (!identity || !identity.istokId) {
            onLogout();
            return;
        }

        setMyProfile({
            id: identity.istokId,
            username: identity.displayName,
            email: identity.email,
            photoURL: identity.photoURL,
            created: Date.now()
        });

        // Global Peer Monitor
        const checkPeerStatus = () => {
            if (globalPeer && !globalPeer.destroyed && !globalPeer.disconnected) {
                setIsPeerAlive(true);
                if (globalPeer.id && globalPeer.id !== myProfile.id) {
                     setMyProfile(prev => ({ ...prev, id: globalPeer.id }));
                }
            } else {
                setIsPeerAlive(false);
            }
        };

        const interval = setInterval(checkPeerStatus, 1000);
        
        // Garbage Collector (Cleanup stuck chunks)
        const gcInterval = setInterval(() => {
            const now = Date.now();
            Object.keys(chunkBuffer.current).forEach(key => {
                if (now - chunkBuffer.current[key].lastUpdate > 120000) {
                    delete chunkBuffer.current[key];
                }
            });
        }, 60000);

        checkPeerStatus(); 
        
        if (globalPeer) {
            setupPeerListeners(globalPeer);
        }

        if (initialAcceptedConnection) {
            handleAcceptedConnection(initialAcceptedConnection);
        }

        // URL Params Logic
        const urlParams = new URLSearchParams(window.location.search);
        if(urlParams.get('connect')) {
            setTargetPeerId(urlParams.get('connect')!);
            if (urlParams.get('key')) setAccessPin(urlParams.get('key')!);
        }

        return () => {
            clearInterval(interval);
            clearInterval(gcInterval);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            cleanupConnectionRefs();
        };
    }, [identity, globalPeer]);

    // Cleanup Helpers
    const cleanupConnectionRefs = () => {
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        if (deathCheckIntervalRef.current) clearInterval(deathCheckIntervalRef.current);
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        if (requestTimeoutRef.current) clearTimeout(requestTimeoutRef.current);
    };

    // Auto-Dismiss Incoming Request
    useEffect(() => {
        if (incomingRequest) {
            if (requestTimeoutRef.current) clearTimeout(requestTimeoutRef.current);
            requestTimeoutRef.current = setTimeout(() => {
                setIncomingRequest(null);
            }, HANDSHAKE_TIMEOUT);
        }
    }, [incomingRequest]);

    // Auto Scroll
    useEffect(() => {
        msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isAiThinking, isPeerTyping]);

    // --- HEARTBEAT & ZOMBIE KILLER ---
    useEffect(() => {
        if (isConnected) {
            // 1. Sender: Send PING regularly
            heartbeatIntervalRef.current = setInterval(() => {
                if(connRef.current?.open) {
                    connRef.current.send({ type: 'PING' });
                }
            }, HEARTBEAT_INTERVAL);

            // 2. Watcher: Check if peer is dead
            deathCheckIntervalRef.current = setInterval(() => {
                const now = Date.now();
                if (now - lastHeartbeat > CONNECTION_TIMEOUT) {
                    if (isDataConnectionAlive) {
                        console.warn("⚠️ Zombie Connection Detected (No Heartbeat)");
                        setIsDataConnectionAlive(false); // Trigger UI Reconnect
                    }
                }
            }, 5000);
        } else {
            cleanupConnectionRefs();
        }

        return () => cleanupConnectionRefs();
    }, [isConnected, lastHeartbeat, isDataConnectionAlive]);

    // Auto Reconnect Logic
    useEffect(() => {
        if (isConnected && !isDataConnectionAlive && isPeerAlive && targetPeerId) {
            console.log("♻️ Auto-Reconnecting...");
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = setTimeout(() => {
                connectToPeer(targetPeerId, accessPin, true); 
            }, 3000); 
        }
    }, [isConnected, isDataConnectionAlive, isPeerAlive, targetPeerId]);

    // --- CONNECTION HANDLERS ---

    const onAcceptRequest = async () => {
        if (!incomingRequest || !incomingRequest.conn) return;
        setIsHandshakeProcessing(true);

        try {
            const { conn } = incomingRequest;
            const ack = JSON.stringify({ type: 'HANDSHAKE_ACK' });
            const enc = await encryptData(ack, '000000'); // Initial channel is always default
            
            if (enc) conn.send({ type: 'SYS', payload: enc });
            
            connRef.current = conn;
            setTargetPeerId(conn.peer);
            setupDataConnection(conn);
            
            setIsConnected(true);
            setIsDataConnectionAlive(true);
            setLastHeartbeat(Date.now()); // Reset timer
            setStage('SECURE');
            playSound('CONNECT');

            // Save Session
            const newSession: IStokSession = {
                id: conn.peer,
                name: incomingRequest.identity,
                lastSeen: Date.now(),
                pin: '000000',
                status: 'ONLINE',
                createdAt: Date.now()
            };
            setSessions(prev => [newSession, ...prev.filter(s => s.id !== conn.peer)]);

        } catch (error) {
            console.error("Accept Error:", error);
        } finally {
            setIsHandshakeProcessing(false);
            setIncomingRequest(null);
        }
    };

    const onDeclineRequest = () => {
        if (incomingRequest?.conn) incomingRequest.conn.close();
        setIncomingRequest(null);
    };

    const handleAcceptedConnection = async (data: any) => {
        const { conn } = data;
        connRef.current = conn;
        setTargetPeerId(conn.peer);
        setupDataConnection(conn);

        const ack = JSON.stringify({ type: 'HANDSHAKE_ACK' });
        const enc = await encryptData(ack, '000000'); 
        if (enc) conn.send({ type: 'SYS', payload: enc });
        
        setIsConnected(true);
        setIsDataConnectionAlive(true);
        setStage('SECURE');
        playSound('CONNECT');
    };

    // --- PEER & DATA LISTENERS ---
    const setupPeerListeners = (peer: any) => {
        peer.off('call'); 
        peer.on('call', (call: any) => {
             setIncomingCall(call);
             playSound('RING');
        });
        
        peer.off('connection');
        peer.on('connection', (conn: any) => {
            conn.on('data', (d: any) => handleIncomingData(d, conn));
            conn.on('close', () => console.log("Conn closed"));
            conn.on('error', (err: any) => console.error("Conn error", err));
        });
    };
    
    const setupDataConnection = (conn: any) => {
        conn.off('data'); 
        conn.on('data', (d: any) => handleIncomingData(d, conn));

        conn.off('close');
        conn.on('close', () => {
            console.warn("⚠️ Data connection closed event");
            setIsDataConnectionAlive(false);
        });

        conn.off('error');
        conn.on('error', (e: any) => {
            console.error("⚠️ Data connection error", e);
            setIsDataConnectionAlive(false);
        });
    };

    // --- CORE DATA HANDLING ---
    const handleIncomingData = async (data: any, conn: any) => {
        // 0. HANDLE PING (Heartbeat) - Tanpa Enkripsi untuk Performa
        if (data.type === 'PING') {
            setLastHeartbeat(Date.now());
            if (!isDataConnectionAlive) setIsDataConnectionAlive(true); // Revive UI
            return;
        }

        // 0. HANDLE TYPING
        if (data.type === 'TYPING') {
            setIsPeerTyping(data.isTyping);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setIsPeerTyping(false), 3000);
            return;
        }

        // 1. HANDLE CHUNKS
        if (data.type === 'CHUNK') {
            const { id, idx, total, chunk } = data;
            if (!chunkBuffer.current[id]) {
                chunkBuffer.current[id] = { chunks: new Array(total), count: 0, total, lastUpdate: Date.now() };
            }
            const buf = chunkBuffer.current[id];
            buf.chunks[idx] = chunk;
            buf.count++;
            buf.lastUpdate = Date.now();

            if (buf.count === total) {
                const fullPayload = buf.chunks.join('');
                delete chunkBuffer.current[id];
                handleIncomingData({ type: 'MSG', payload: fullPayload }, conn);
            }
            return;
        }

        // 2. DECRYPTION & LOGIC
        const pin = accessPin || '000000';
        
        if (data.type === 'SYS') {
            // [SECURITY] Strict Mode: Jika sudah SECURE dan punya PIN, tolak PIN '000000'
            let decrypted = null;
            
            if (stage === 'SECURE' && pin !== '000000') {
                 // Hanya coba PIN private
                 decrypted = await decryptData(data.payload, pin);
            } else {
                 // Coba PIN user, fallback ke public
                 decrypted = await decryptData(data.payload, pin);
                 if (!decrypted) decrypted = await decryptData(data.payload, '000000');
            }

            if (!decrypted) return;
            const json = JSON.parse(decrypted);

            if (json.type === 'HANDSHAKE_SYN') {
                if (isConnected) return; // Busy
                setIncomingRequest((prev: any) => {
                    if (prev) return prev; 
                    playSound('MSG_IN');
                    return {
                        identity: json.identity || 'Unknown',
                        peerId: conn.peer,
                        photo: json.photo,
                        conn: conn
                    };
                });
            } 
            else if (json.type === 'HANDSHAKE_ACK') {
                connRef.current = conn;
                setIsConnected(true);
                setIsDataConnectionAlive(true);
                setStage('SECURE');
                setLastHeartbeat(Date.now());
                playSound('CONNECT');
            }
        } 
        else if (data.type === 'MSG') {
            const decrypted = await decryptData(data.payload, pin);
            if(decrypted) {
                const msg = JSON.parse(decrypted);
                setMessages(prev => {
                    if (prev.some(m => m.id === msg.id)) return prev;
                    return [...prev, { ...msg, sender: 'THEM', status: 'READ' }];
                });
                playSound('MSG_IN');
                setIsPeerTyping(false); // Stop typing anim immediately on msg received
            }
        }
    };

    // --- OUTGOING ACTIONS ---
    const sendTypingSignal = (isTyping: boolean) => {
        if (connRef.current?.open) {
            connRef.current.send({ type: 'TYPING', isTyping });
        }
    };

    const connectToPeer = (id: string, pin: string, isReconnect: boolean = false) => {
        if(!globalPeer || !isPeerAlive || !identity) {
            if(!isReconnect) alert("Sistem Hydra offline.");
            return;
        }
        
        if (!isReconnect) setStage('LOCATING');
        
        try {
            const conn = globalPeer.connect(id, { 
                reliable: true,
                serialization: 'json',
            });
            
            if (!conn) {
                if(!isReconnect) {
                    setStage('IDLE');
                    alert("Gagal inisialisasi.");
                }
                return;
            }
            
            conn.on('open', async () => {
                if (!isReconnect) setStage('HANDSHAKE');
                
                const handshake = JSON.stringify({ 
                    type: 'HANDSHAKE_SYN', 
                    identity: identity.displayName,
                    photo: identity.photoURL,
                    email: identity.email 
                });

                const effectivePin = pin.length >= 4 ? pin : '000000';
                
                const encrypted = await encryptData(handshake, effectivePin);
                if(encrypted) conn.send({ type: 'SYS', payload: encrypted });
                
                connRef.current = conn;
                setupDataConnection(conn);
                setIsDataConnectionAlive(true);
                
                if (isReconnect) console.log("Reconnected.");
            });

            conn.on('error', (err: any) => {
                console.error("Connection Error:", err);
                if (!isReconnect) setStage('IDLE');
            });

        } catch (e) {
            console.error("Connect Exception", e);
            setStage('IDLE');
        }
    };

    const sendMessage = async (type: string, content: string, extraData: any = {}) => {
        if (!isNetworkOnline) {
             const pendingMsg = { 
                 id: crypto.randomUUID(), type, content, timestamp: Date.now(), ttl: ttlMode, ...extraData, sender: 'ME', status: 'PENDING' 
             };
             setMessages(prev => [...prev, pendingMsg as Message]);
             return;
        }

        if (!connRef.current || !isDataConnectionAlive) {
            alert("Koneksi terputus. Mencoba reconnect...");
            return;
        }

        const msgPayload = { id: crypto.randomUUID(), type, content, timestamp: Date.now(), ttl: ttlMode, ...extraData };
        const strPayload = JSON.stringify(msgPayload);
        const encrypted = await encryptData(strPayload, accessPin || '000000');
        
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
            if(file.size > 20 * 1024 * 1024) { alert("Max File 20MB"); return; }
            
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

    const handleDisconnectChat = () => {
        if (connRef.current) connRef.current.close();
        setIsConnected(false);
        setIsDataConnectionAlive(false);
        setStage('IDLE');
        setMessages([]);
        setTargetPeerId('');
    };

    const handleForceReconnect = () => window.location.reload(); 

    // --- AI UTILS ---
    const handleAiSmartCompose = async (userDraft: string, mode: 'REPLY' | 'REFINE' = 'REPLY'): Promise<string> => {
        setIsAiThinking(true);
        const contextMessages = messages.slice(-5).map(m => `${m.sender === 'ME' ? 'Me' : 'Partner'}: ${m.content}`).join('\n');
        const systemInstruction = `[ROLE: SECURE_COMM_AI] [CONTEXT] ${contextMessages} [TASK] ${mode === 'REPLY' ? `Suggest reply.` : `Refine: "${userDraft}".`} OUTPUT ONLY TEXT.`;
        try {
            const stream = OMNI_KERNEL.raceStream(userDraft || "Suggest reply", systemInstruction);
            let resultText = "";
            for await (const chunk of stream) if (chunk.text) resultText += chunk.text;
            return resultText.trim();
        } catch (e) { return userDraft; } finally { setIsAiThinking(false); }
    };

    const handleTranslation = async (text: string, targetLang: string): Promise<string> => {
        setIsAiThinking(true);
        try {
            // PROFESSIONAL LINGUIST PROMPT
            const systemPrompt = `[ROLE: PROFESSIONAL_LINGUIST_CHAT_TRANSLATOR]
Anda adalah ahli bahasa dan penerjemah pesan chat profesional.
Tugas Anda: Menerjemahkan pesan dengan sangat natural, modern, dan sesuai konteks (slang jika perlu).

ATURAN UTAMA:
1. JANGAN kaku. Gunakan bahasa gaul/slang jika pesan aslinya santai.
2. JANGAN gunakan bahasa kamus/formal jika konteksnya adalah chat antar teman.
3. PAHAMI IDIOM: Cari padanan yang tepat di bahasa target.
4. INDONESIA: Gunakan 'aku/kamu', 'kok', 'sih', 'nih' agar luwes.
5. ENGLISH: Gunakan phrasal verbs dan ekspresi native.
6. PERTAHANKAN EMOJI: Jangan hapus atau ubah posisi emoji.
7. JANGAN MENJAWAB SEBAGAI AI. Jadilah "tangan" user yang mengetik.
8. OUTPUT ONLY THE TRANSLATED TEXT. NO EXPLANATION.

Target Language: ${targetLang}
INPUT TEXT: "${text}"`;

            const stream = OMNI_KERNEL.raceStream(text, systemPrompt);
            let result = "";
            for await (const chunk of stream) if (chunk.text) result += chunk.text;
            return result.trim();
        } catch (e) { return text; } finally { setIsAiThinking(false); }
    };

    // ================= VIEW 1: DASHBOARD =================
    if (!isConnected) {
        return (
            <div className="h-[100dvh] bg-[#050505] flex flex-col p-4 md:p-8 relative font-sans text-white overflow-hidden">
                 
                 {/* Top Navigation */}
                 <div className="flex justify-between items-center z-20 mb-8 pt-safe">
                     <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-emerald-900/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                             <Radio size={20} className={isPeerAlive ? "animate-pulse" : ""}/>
                         </div>
                         <div>
                             <h1 className="font-black text-xl italic tracking-tighter uppercase">ISTOK <span className="text-emerald-500">SECURE</span></h1>
                             <div className="flex items-center gap-2 text-[9px] font-mono text-neutral-500">
                                <span className={`w-1.5 h-1.5 rounded-full ${isPeerAlive ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-red-500'}`}></span>
                                {isPeerAlive ? 'HYDRA_NET_V2' : <span className="text-red-500 animate-pulse cursor-pointer" onClick={handleForceReconnect}>RECONNECTING...</span>}
                             </div>
                         </div>
                     </div>
                     <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[10px] font-mono text-neutral-400 max-w-[80px] truncate">{myProfile.id || '...'}</span>
                     </div>
                 </div>

                 {/* Main Dashboard Grid */}
                 <div className="flex-1 overflow-y-auto custom-scroll space-y-6 z-10 max-w-4xl mx-auto w-full pb-safe">
                     
                     {/* Identity Card */}
                     <div className="bg-[#09090b] border border-white/10 rounded-[32px] p-6 relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-500">
                         <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none group-hover:bg-emerald-500/10 transition-colors duration-500"></div>
                         
                         <div className="flex items-center gap-5 relative z-10">
                             <div className="relative">
                                <img src={identity?.photoURL} className="w-20 h-20 rounded-full border-2 border-emerald-500/50 object-cover shadow-lg shadow-emerald-900/20" alt="User" />
                                <div className="absolute -bottom-1 -right-1 bg-[#09090b] p-1.5 rounded-full border border-white/10">
                                    <ShieldCheck size={14} className="text-emerald-500"/>
                                </div>
                             </div>
                             <div className="flex-1 min-w-0">
                                 <h2 className="text-2xl font-bold truncate tracking-tight">{identity?.displayName}</h2>
                                 <p className="text-xs text-neutral-500 font-mono mb-3 truncate">{identity?.email}</p>
                                 <div 
                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/5 cursor-pointer hover:bg-white/10 transition-all active:scale-95" 
                                    onClick={() => {
                                        navigator.clipboard.writeText(myProfile.id || '');
                                        alert("ID Disalin!");
                                    }}
                                 >
                                     <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">ID:</span>
                                     <code className="text-xs font-mono text-white truncate max-w-[150px]">{myProfile.id || 'INITIALIZING...'}</code>
                                     <Sparkles size={12} className="text-emerald-500"/>
                                 </div>
                             </div>
                         </div>
                     </div>

                     {/* Quick Connect Panel */}
                     <div className="bg-[#09090b] border border-white/10 rounded-[32px] p-6 space-y-6 shadow-xl relative overflow-hidden">
                         <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500/0 via-blue-500/50 to-blue-500/0 opacity-20"></div>
                         
                         <div className="space-y-4">
                             <div className="relative group">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl opacity-0 group-hover:opacity-20 transition duration-500 blur"></div>
                                <input 
                                    value={targetPeerId} 
                                    onChange={e=>setTargetPeerId(e.target.value.toUpperCase())} 
                                    placeholder="MASUKKAN ID TARGET / LINK" 
                                    className="relative w-full bg-[#121214] border border-white/10 p-4 rounded-2xl text-white text-center text-sm font-mono focus:border-blue-500 outline-none uppercase placeholder:text-neutral-700 transition-all focus:shadow-[0_0_30px_rgba(59,130,246,0.15)]"
                                />
                                <button onClick={()=>setShowScanner(true)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-neutral-500 hover:text-white bg-white/5 rounded-xl transition-all hover:scale-110 z-10">
                                    <ScanLine size={18}/>
                                </button>
                             </div>
                             
                             <div className="flex gap-3">
                                 <input 
                                    value={accessPin} 
                                    onChange={e=>setAccessPin(e.target.value)} 
                                    placeholder="PIN (6)" 
                                    maxLength={6} 
                                    className="w-32 bg-[#121214] border border-white/10 p-4 rounded-2xl text-white text-center text-sm font-mono tracking-[0.3em] focus:border-blue-500 outline-none transition-all placeholder:tracking-normal placeholder:text-neutral-700 focus:shadow-[0_0_20px_rgba(59,130,246,0.15)]"
                                />
                                <button 
                                    onClick={()=>connectToPeer(targetPeerId, accessPin)} 
                                    disabled={!targetPeerId || !isPeerAlive}
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2 group active:scale-95 relative overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                                    <span className="relative flex items-center gap-2">
                                        {stage === 'IDLE' ? 'SAMBUNGKAN' : <><Loader2 size={14} className="animate-spin"/> {stage}...</>} <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform"/>
                                    </span>
                                </button>
                             </div>
                         </div>

                         <div className="grid grid-cols-2 gap-3">
                             <button onClick={()=>setShowShare(true)} className="py-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 text-neutral-300 hover:text-white transition-all flex flex-col items-center gap-2 group active:scale-95">
                                 <QrCode size={20} className="text-emerald-500 group-hover:scale-110 transition-transform"/>
                                 <span className="text-[10px] font-bold uppercase tracking-wider">BAGIKAN ID</span>
                             </button>
                             <button onClick={()=>setShowSidebar(true)} className="py-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 text-neutral-300 hover:text-white transition-all flex flex-col items-center gap-2 group active:scale-95">
                                 <Users size={20} className="text-purple-500 group-hover:scale-110 transition-transform"/>
                                 <span className="text-[10px] font-bold uppercase tracking-wider">KONTAK</span>
                             </button>
                         </div>
                     </div>

                     <div className="flex items-center justify-between px-2 opacity-50">
                         <div className="flex items-center gap-4 text-[9px] font-mono">
                             <span className="flex items-center gap-1">
                                <Signal size={10} className={isPeerAlive ? 'text-emerald-500' : 'text-red-500'} /> 
                                NODE: {isPeerAlive ? 'ONLINE' : 'OFFLINE'}
                             </span>
                         </div>
                         <div className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-600">V2.0_STABLE</div>
                     </div>
                 </div>

                 {/* Background */}
                 <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none opacity-20"></div>
                 
                 {/* Modals */}
                 {showScanner && <QRScanner onScan={(val: string) => { 
                    try {
                        const urlStr = val.startsWith('http') ? val : `https://dummy.com?${val}`;
                        const url = new URL(urlStr);
                        const c = url.searchParams.get('connect');
                        const k = url.searchParams.get('key');
                        if(c && k) { setTargetPeerId(c); setAccessPin(k); } else { setTargetPeerId(val); }
                    } catch { setTargetPeerId(val); }
                    setShowScanner(false);
                }} onClose={()=>setShowScanner(false)} />}

                {showShare && <ShareConnection peerId={myProfile.id || ''} pin={accessPin || '000000'} onClose={()=>setShowShare(false)} />}
                
                <SidebarIStokContact 
                    isOpen={showSidebar} 
                    onClose={()=>setShowSidebar(false)} 
                    sessions={sessions} 
                    profile={myProfile}
                    onSelect={(s) => { setTargetPeerId(s.id); if('pin' in s && s.pin) setAccessPin(s.pin); setShowSidebar(false); setTimeout(() => (document.querySelector('input[placeholder="PIN (6)"]') as HTMLElement)?.focus(), 300); }}
                    onDeleteSession={(id) => setSessions(prev => prev.filter(s => s.id !== id))} 
                    onCallContact={(c) => { setTargetPeerId(c.id); setShowSidebar(false); setTimeout(() => (document.querySelector('input[placeholder="PIN (6)"]') as HTMLElement)?.focus(), 300); }} 
                    onLogout={onLogout} 
                    onRenameSession={()=>{}} 
                    currentPeerId={null}
                />

                {/* --- NOTIFICATION PORTAL --- */}
                {incomingRequest && (
                    <ConnectionNotification 
                        identity={incomingRequest.identity}
                        peerId={incomingRequest.peerId}
                        onAccept={onAcceptRequest}
                        onDecline={onDeclineRequest}
                        isProcessing={isHandshakeProcessing}
                    />
                )}
            </div>
        );
    }

    // ================= VIEW 2: CHAT INTERFACE =================
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
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#09090b] ${isDataConnectionAlive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500 animate-pulse'}`}></div>
                    </div>
                    <div>
                        <h3 className="text-white font-black text-sm uppercase tracking-wide flex items-center gap-2">
                            SECURE <Lock size={10} className="text-emerald-500"/>
                        </h3>
                        <div className="flex items-center gap-2 text-[9px] font-mono text-emerald-500/70">
                            {isDataConnectionAlive ? (
                                <>
                                    <span>{targetPeerId.slice(0,8)}...</span>
                                    {isPeerTyping ? (
                                        <span className="text-emerald-300 animate-pulse flex items-center gap-1"><MessageSquare size={8}/> TYPING...</span>
                                    ) : (
                                        <>
                                            <span className="w-1 h-1 rounded-full bg-emerald-500/50"></span>
                                            <span>AES-256</span>
                                        </>
                                    )}
                                </>
                            ) : (
                                <span className="text-red-400 flex items-center gap-1"><CloudOff size={10}/> UPLINK LOST</span>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="flex gap-2">
                    <button onClick={()=>setShowCall(true)} className="p-2.5 hover:bg-emerald-500/10 rounded-xl text-neutral-400 hover:text-emerald-500 transition border border-transparent hover:border-emerald-500/20"><PhoneCall size={18}/></button>
                    <button onClick={handleDisconnectChat} className="p-2.5 hover:bg-red-500/10 rounded-xl text-neutral-400 hover:text-red-500 transition border border-transparent hover:border-red-500/20"><X size={18}/></button>
                </div>
             </div>

             {/* Auto-Reconnect Overlay */}
             {!isDataConnectionAlive && (
                 <div className="absolute top-20 left-0 right-0 z-30 flex justify-center pointer-events-none">
                     <div className="bg-red-500/10 backdrop-blur-md border border-red-500/20 px-4 py-2 rounded-full flex items-center gap-2 text-red-400 text-xs font-bold shadow-lg animate-pulse">
                         <RefreshCw size={12} className="animate-spin"/>
                         ATTEMPTING RE-UPLINK...
                     </div>
                 </div>
             )}
             
             {/* Offline Overlay */}
             {!isNetworkOnline && (
                 <div className="absolute top-20 left-0 right-0 z-30 flex justify-center pointer-events-none">
                     <div className="bg-amber-500/10 backdrop-blur-md border border-amber-500/20 px-4 py-2 rounded-full flex items-center gap-2 text-amber-500 text-xs font-bold shadow-lg animate-pulse">
                         <CloudOff size={12} />
                         OFFLINE MODE
                     </div>
                 </div>
             )}

             {/* Messages Area */}
             <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scroll">
                {messages.map(msg => (
                    <MessageBubble key={msg.id} msg={msg} setViewImage={setViewImage} />
                ))}
                
                {isAiThinking && (
                    <div className="flex items-center gap-2 text-purple-500 text-xs px-4 animate-pulse">
                        <Loader2 size={12} className="animate-spin"/> AI Processing...
                    </div>
                )}

                {isPeerTyping && (
                     <div className="flex items-center gap-2 px-4 opacity-50">
                        <div className="flex space-x-1">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce delay-0"></div>
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce delay-150"></div>
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce delay-300"></div>
                        </div>
                     </div>
                )}
                <div ref={msgEndRef}/>
             </div>

             {/* Input Area */}
             <IStokInput 
                onSend={(txt: string) => sendMessage('TEXT', txt)}
                onSendFile={() => fileInputRef.current?.click()}
                onSendAudio={(b64: string, dur: number) => sendMessage('AUDIO', b64, { duration: dur })}
                disabled={!isDataConnectionAlive && isNetworkOnline} 
                ttlMode={ttlMode}
                onToggleTtl={() => setTtlMode(p => p === 0 ? 30 : 0)}
                onAiAssist={handleAiSmartCompose} 
                onAiTranslate={handleTranslation}
                isAiThinking={isAiThinking}
                // Notify Typing
                onTyping={() => sendTypingSignal(true)} 
             />
             <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />

            {/* CALL MODALS */}
            {showCall && <TeleponanView onClose={()=>setShowCall(false)} existingPeer={globalPeer} initialTargetId={targetPeerId} incomingCall={incomingCall} secretPin={accessPin} />}
            
            {incomingCall && !showCall && <CallNotification identity="Secure Peer" onAnswer={()=>setShowCall(true)} onDecline={()=>{incomingCall.close(); setIncomingCall(null);}} />}
            
            {/* IMAGE PREVIEW */}
            {viewImage && (
                <div className="fixed inset-0 z-[3000] bg-black/95 backdrop-blur flex items-center justify-center p-4 animate-fade-in" onClick={() => setViewImage(null)}>
                    <img src={viewImage} className="max-w-full max-h-full rounded-lg shadow-2xl border border-white/10" alt="Secure Content" />
                    <button className="absolute top-4 right-4 p-3 bg-white/10 rounded-full text-white hover:bg-red-500 transition-colors"><X size={24}/></button>
                </div>
            )}
        </div>
    );
};
