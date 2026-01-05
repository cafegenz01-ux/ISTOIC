
import React, { useState, useEffect, useRef } from 'react';
import { 
    Server, ScanLine, RefreshCw, 
    Fingerprint, Activity, ArrowRight, ShieldCheck,
    QrCode, Clipboard, Camera, X, Check, Loader2, Lock, Upload
} from 'lucide-react';

interface IStokAuthProps {
    identity: string;
    onRegenerateIdentity: () => void;
    onHost: () => void;
    onJoin: (targetId: string, pin: string) => void;
    errorMsg?: string;
    onErrorClear: () => void;
    isRelayActive: boolean;
    forcedMode?: 'DEFAULT' | 'JOIN';
    connectionStage?: string; 
}

export const IStokAuth: React.FC<IStokAuthProps> = ({ 
    identity, 
    onRegenerateIdentity, 
    onHost, 
    onJoin,
    errorMsg,
    onErrorClear,
    isRelayActive,
    forcedMode = 'DEFAULT',
    connectionStage = 'IDLE'
}) => {
    const [targetId, setTargetId] = useState('');
    const [pin, setPin] = useState('');
    const [isJoining, setIsJoining] = useState(forcedMode === 'JOIN');
    const [isScanning, setIsScanning] = useState(false);
    const [isNativeScanSupported, setIsNativeScanSupported] = useState(true);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanIntervalRef = useRef<any>(null);

    // Glitch effect
    const [glitchedIdentity, setGlitchedIdentity] = useState(identity);

    const isConnecting = connectionStage !== 'IDLE' && connectionStage !== 'SECURE';

    // --- CHECK CAPABILITIES ---
    useEffect(() => {
        // BarcodeDetector is Chrome/Android only usually. 
        // If missing, we fallback to Manual/System Camera logic.
        if (!('BarcodeDetector' in window)) {
            setIsNativeScanSupported(false);
        }
    }, []);

    useEffect(() => {
        if (forcedMode === 'DEFAULT') {
            let interval: any;
            if (identity) {
                let iteration = 0;
                const original = identity;
                const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                
                interval = setInterval(() => {
                    setGlitchedIdentity(
                        original
                        .split("")
                        .map((letter, index) => {
                            if (index < iteration) return original[index];
                            return letters[Math.floor(Math.random() * 26)];
                        })
                        .join("")
                    );
                    if (iteration >= original.length) clearInterval(interval);
                    iteration += 1 / 3;
                }, 30);
            }
            return () => clearInterval(interval);
        } else {
            setGlitchedIdentity(identity);
        }
    }, [identity, forcedMode]);

    useEffect(() => {
        if (forcedMode === 'JOIN') setIsJoining(true);
        
        // Auto-Check URL params if we just opened in JOIN mode
        const params = new URLSearchParams(window.location.search);
        const connect = params.get('connect');
        const key = params.get('key');
        if (connect && key) {
             setTargetId(connect);
             setPin(key);
             // Auto join after short delay for visual confirmation
             setTimeout(() => onJoin(connect, key), 800);
        }
    }, [forcedMode]);

    // --- PASTE & PARSE HANDLER ---
    const processRawInput = (text: string) => {
        if (!text) return;
        
        let foundId = '';
        let foundKey = '';

        try {
            // Case 1: Full URL (http://.../?connect=ID&key=PIN or .../#connect=ID&key=PIN)
            if (text.includes('connect=') && text.includes('key=')) {
                // Hacky parse for any URL structure
                const connectMatch = text.match(/connect=([^&]+)/);
                const keyMatch = text.match(/key=([^&]+)/);
                if (connectMatch) foundId = connectMatch[1];
                if (keyMatch) foundKey = keyMatch[1];
            } 
            // Case 2: ID:PIN format
            else if (text.includes(':')) {
                const parts = text.split(':');
                if (parts.length === 2 && parts[1].length >= 4) {
                    foundId = parts[0];
                    foundKey = parts[1];
                }
            }
            // Case 3: Just ID (assume user will type PIN)
            else {
                foundId = text.trim();
            }
        } catch (e) {}

        if (foundId) {
            setTargetId(foundId);
            if (navigator.vibrate) navigator.vibrate(50);
            if (foundKey) {
                setPin(foundKey);
                // If we found both, auto trigger join
                setTimeout(() => onJoin(foundId, foundKey), 500);
            }
        }
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            processRawInput(text);
        } catch (err) {
            const input = document.getElementById('target-id-input') as HTMLInputElement;
            input?.focus();
            document.execCommand('paste');
        }
    };

    // --- QR SCANNER LOGIC ---
    const startScanner = async () => {
        if (!isNativeScanSupported) {
            alert("Browser ini tidak mendukung in-app scanning. Gunakan kamera bawaan HP untuk scan QR Code, atau tempel link.");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            streamRef.current = stream;
            setIsScanning(true);
            
            const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
            scanIntervalRef.current = setInterval(async () => {
                if (videoRef.current) {
                    try {
                        const barcodes = await detector.detect(videoRef.current);
                        if (barcodes.length > 0) {
                            const rawValue = barcodes[0].rawValue;
                            processRawInput(rawValue);
                            stopScanner();
                        }
                    } catch (e) {}
                }
            }, 500);
        } catch (err) {
            console.error("Camera error", err);
            alert("Tidak dapat mengakses kamera. Pastikan izin diberikan.");
        }
    };

    const stopScanner = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
        setIsScanning(false);
    };

    useEffect(() => {
        if (isScanning && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [isScanning]);

    useEffect(() => {
        return () => stopScanner();
    }, []);

    // --- VIEW: SCANNER OVERLAY ---
    if (isScanning) {
        return (
            <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
                <div className="flex-1 relative overflow-hidden">
                    <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-emerald-500/50 rounded-3xl animate-pulse flex items-center justify-center">
                        <div className="w-60 h-60 border border-emerald-500/20 rounded-2xl relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 shadow-[0_0_20px_#10b981] animate-[scan_2s_linear_infinite]"></div>
                        </div>
                    </div>
                </div>
                <div className="p-8 bg-black flex justify-center pb-safe">
                    <button onClick={stopScanner} className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-white border border-white/20 active:scale-95 transition-all">
                        <X size={24} />
                    </button>
                </div>
                <style>{`@keyframes scan { 0% { top: 0%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }`}</style>
            </div>
        );
    }

    // --- VIEW: JOIN FORM ---
    if (forcedMode === 'JOIN') {
        return (
            <div className="w-full max-w-md mx-auto p-6 animate-slide-up flex flex-col gap-6 relative">
                
                {/* Connecting Overlay */}
                {isConnecting && (
                    <div className="absolute inset-0 z-50 bg-[#09090b]/95 backdrop-blur-md rounded-[32px] flex flex-col items-center justify-center text-center p-6 animate-fade-in border border-emerald-500/20">
                        <div className="relative mb-6">
                            {/* Radar Effect */}
                            <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping"></div>
                            <div className="w-24 h-24 rounded-full border-4 border-emerald-500/30 border-t-emerald-500 animate-spin relative z-10 flex items-center justify-center bg-[#09090b]">
                                <Activity size={32} className="text-emerald-500" />
                            </div>
                        </div>
                        <h3 className="text-lg font-black text-white uppercase tracking-widest mb-1 animate-pulse">
                            {connectionStage.replace('_', ' ')}
                        </h3>
                        <p className="text-xs font-mono text-emerald-600/70">ESTABLISHING SECURE TUNNEL...</p>
                    </div>
                )}

                <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-blue-600/20 text-blue-500 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-blue-500/30 shadow-[0_0_30px_rgba(37,99,235,0.2)]">
                        <ScanLine size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">Gabung Sesi</h2>
                    <p className="text-neutral-400 text-xs font-medium">Masukkan ID Target atau Link untuk terhubung.</p>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Target ID / Link</label>
                        <div className="relative flex items-center">
                            <input 
                                id="target-id-input"
                                value={targetId}
                                onChange={(e) => processRawInput(e.target.value)}
                                placeholder="Paste ID or Link..." 
                                className="w-full bg-[#121214] border border-white/10 rounded-2xl px-5 py-4 text-sm font-medium text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-neutral-600 pr-12"
                                autoFocus
                            />
                            <button 
                                onClick={handlePaste}
                                className="absolute right-3 p-2 text-neutral-500 hover:text-white bg-white/5 rounded-xl hover:bg-white/10 transition-all"
                                title="Smart Paste"
                            >
                                <Clipboard size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest ml-1">Akses PIN</label>
                        <div className="relative">
                            <input 
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                placeholder="******" 
                                className="w-full bg-[#121214] border border-white/10 rounded-2xl px-5 py-4 text-sm font-mono text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-neutral-600 text-center tracking-[0.5em]"
                            />
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none" size={16} />
                        </div>
                    </div>

                    <div className="grid grid-cols-5 gap-3 pt-2">
                        {isNativeScanSupported ? (
                            <button 
                                onClick={startScanner}
                                className="col-span-2 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                                <Camera size={18} /> SCAN
                            </button>
                        ) : (
                            <button 
                                className="col-span-2 py-4 bg-white/5 border border-white/10 text-neutral-500 rounded-2xl font-bold text-[10px] uppercase tracking-wider flex flex-col items-center justify-center gap-1 cursor-not-allowed opacity-50"
                                disabled
                            >
                                <span className="line-through">SCANNER</span>
                                <span className="text-[8px]">USE CAM APP</span>
                            </button>
                        )}
                        <button 
                            onClick={() => onJoin(targetId, pin)}
                            disabled={!targetId || pin.length < 4}
                            className="col-span-3 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            CONNECT <ArrowRight size={16} strokeWidth={3} />
                        </button>
                    </div>
                </div>

                {errorMsg && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3 text-red-500 text-xs font-medium animate-shake">
                        <ShieldCheck size={16} />
                        <span>{errorMsg}</span>
                        <button onClick={onErrorClear} className="ml-auto"><X size={14}/></button>
                    </div>
                )}
            </div>
        );
    }

    // --- VIEW: DEFAULT DASHBOARD ---
    return (
        <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto space-y-12 z-10">
            <div className="text-center space-y-4 animate-slide-down">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500">
                    <ShieldCheck size={12}/> TITANIUM RELAY PROTOCOL v0.55
                </div>
                <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-white uppercase drop-shadow-2xl">
                    SECURE <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500 animate-gradient-text">UPLINK</span>
                </h1>
                <p className="text-neutral-500 font-mono text-xs max-w-md mx-auto leading-relaxed">
                    AES-256 + FORCE TURN (TCP/443) + HYDRA-LINK HANDOVER. <br/>
                    {isRelayActive ? (
                        <span className="text-purple-400 flex items-center justify-center gap-2 mt-1">
                            <Activity size={10} className="animate-pulse"/> RELAY NODE ACTIVE
                        </span>
                    ) : (
                        <span className="text-neutral-600">RELAY OFFLINE (P2P ONLY)</span>
                    )}
                </p>
            </div>

            <div className="w-full max-w-md relative group animate-slide-up" style={{ animationDelay: '100ms' }}>
                <div className="bg-[#0a0a0b] border border-white/10 rounded-[32px] p-6 relative overflow-hidden ring-1 ring-white/5">
                    <div className="flex items-center justify-between relative z-10 mb-4">
                        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-neutral-500">
                            <Fingerprint size={12} /> CURRENT_IDENTITY
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            <span className="text-[9px] font-bold text-emerald-500 tracking-wider">MASKED</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex flex-col">
                            <h2 className="text-3xl md:text-4xl font-black text-white font-mono tracking-tight tabular-nums">
                                {glitchedIdentity}
                            </h2>
                            <p className="text-[8px] text-neutral-600 font-mono mt-1">
                                HASH: {Math.random().toString(36).substring(7).toUpperCase()}
                            </p>
                        </div>
                        <button onClick={onRegenerateIdentity} className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-all active:scale-95 border border-white/5 group/btn">
                            <RefreshCw size={20} className="group-hover/btn:rotate-180 transition-transform duration-500" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="w-full max-w-4xl z-10 animate-slide-up grid grid-cols-1 md:grid-cols-2 gap-6" style={{ animationDelay: '200ms' }}>
                <button onClick={onHost} className="group relative p-8 rounded-[32px] bg-zinc-900/50 border border-white/10 hover:border-emerald-500/50 transition-all duration-500 hover:bg-zinc-900 flex flex-col items-start gap-6 text-left ring-1 ring-transparent hover:ring-emerald-500/20 active:scale-[0.98]">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                        <Server size={28} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-white uppercase italic tracking-tight mb-2 group-hover:text-emerald-400 transition-colors">HOST FREQUENCY</h3>
                        <p className="text-xs text-neutral-400 font-medium leading-relaxed font-mono">Create a secure, encrypted room. You become the relay anchor.</p>
                    </div>
                    <div className="mt-auto flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">
                        INITIALIZE <ArrowRight size={12} />
                    </div>
                </button>

                <button onClick={() => setIsJoining(true)} className="group relative p-8 rounded-[32px] bg-zinc-900/50 border border-white/10 hover:border-blue-500/50 transition-all duration-500 hover:bg-zinc-900 flex flex-col items-start gap-6 text-left ring-1 ring-transparent hover:ring-blue-500/20 active:scale-[0.98]">
                    <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform border border-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                        <ScanLine size={28} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-white uppercase italic tracking-tight mb-2 group-hover:text-blue-400 transition-colors">JOIN FREQUENCY</h3>
                        <p className="text-xs text-neutral-400 font-medium leading-relaxed font-mono">Connect to an existing anomaly. Requires ID & Access Key.</p>
                    </div>
                    <div className="mt-auto flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">
                        CONFIGURE <ArrowRight size={12} />
                    </div>
                </button>
            </div>
            
            {isJoining && forcedMode === 'DEFAULT' && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in">
                    <div className="relative w-full max-w-md bg-[#09090b] border border-white/10 rounded-[32px] p-6 shadow-2xl">
                        <button onClick={() => setIsJoining(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white z-20"><X size={20}/></button>
                        <IStokAuth 
                            identity={identity} 
                            onRegenerateIdentity={onRegenerateIdentity} 
                            onHost={onHost} 
                            onJoin={onJoin} 
                            errorMsg={errorMsg} 
                            onErrorClear={onErrorClear} 
                            isRelayActive={isRelayActive} 
                            forcedMode="JOIN" 
                            connectionStage={connectionStage}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
