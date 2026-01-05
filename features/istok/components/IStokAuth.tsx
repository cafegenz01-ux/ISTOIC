
import React, { useState, useEffect } from 'react';
import { 
    Shield, Radio, Server, ScanLine, RefreshCw, 
    Zap, Fingerprint, Activity, ArrowRight, ShieldCheck 
} from 'lucide-react';
import { type IStokSession } from './SidebarIStokContact';

interface IStokAuthProps {
    identity: string;
    onRegenerateIdentity: () => void;
    onHost: () => void;
    onJoin: (targetId: string, pin: string) => void;
    errorMsg?: string;
    onErrorClear: () => void;
    isRelayActive: boolean;
}

export const IStokAuth: React.FC<IStokAuthProps> = ({ 
    identity, 
    onRegenerateIdentity, 
    onHost, 
    onJoin,
    errorMsg,
    onErrorClear,
    isRelayActive
}) => {
    const [targetId, setTargetId] = useState('');
    const [pin, setPin] = useState('');
    const [isJoining, setIsJoining] = useState(false);

    // Glitch effect for identity
    const [glitchedIdentity, setGlitchedIdentity] = useState(identity);

    useEffect(() => {
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
                        if (index < iteration) {
                            return original[index];
                        }
                        return letters[Math.floor(Math.random() * 26)];
                    })
                    .join("")
                );
                
                if (iteration >= original.length) {
                    clearInterval(interval);
                }
                
                iteration += 1 / 3;
            }, 30);
        }
        return () => clearInterval(interval);
    }, [identity]);

    const handleJoinSubmit = () => {
        if (!targetId || pin.length < 4) return;
        onJoin(targetId, pin);
    };

    return (
        <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto space-y-12 z-10">
            
            {/* 1. HEADER & STATUS */}
            <div className="text-center space-y-4 animate-slide-down">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500">
                    <ShieldCheck size={12}/> TITANIUM RELAY PROTOCOL v0.52
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

            {/* 2. IDENTITY CARD */}
            <div className="w-full max-w-md relative group animate-slide-up" style={{ animationDelay: '100ms' }}>
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 blur-xl opacity-20 group-hover:opacity-40 transition-opacity rounded-[32px]"></div>
                <div className="bg-[#0a0a0b] border border-white/10 rounded-[32px] p-6 relative overflow-hidden ring-1 ring-white/5">
                    
                    {/* Scanline */}
                    <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] z-0 bg-[length:100%_2px,3px_100%] pointer-events-none opacity-50"></div>

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
                        <button 
                            onClick={onRegenerateIdentity}
                            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-all active:scale-95 border border-white/5 group/btn"
                            title="Reroll Identity"
                        >
                            <RefreshCw size={20} className="group-hover/btn:rotate-180 transition-transform duration-500" />
                        </button>
                    </div>
                </div>
            </div>

            {/* 3. ACTION DECK */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl z-10 animate-slide-up" style={{ animationDelay: '200ms' }}>
                
                {/* HOST CARD */}
                <button 
                    onClick={onHost}
                    className="group relative p-8 rounded-[32px] bg-zinc-900/50 border border-white/10 hover:border-emerald-500/50 transition-all duration-500 hover:bg-zinc-900 flex flex-col items-start gap-6 text-left ring-1 ring-transparent hover:ring-emerald-500/20 active:scale-[0.98]"
                >
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

                {/* JOIN CARD (Interactive) */}
                <div className={`relative p-8 rounded-[32px] border transition-all duration-500 flex flex-col items-start gap-6 text-left ring-1 bg-zinc-900/50 ${isJoining ? 'border-blue-500/50 ring-blue-500/20 bg-zinc-900' : 'border-white/10 hover:border-blue-500/30 ring-transparent'}`}>
                    
                    {!isJoining ? (
                        <button className="w-full h-full flex flex-col items-start gap-6 text-left group" onClick={() => setIsJoining(true)}>
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
                    ) : (
                        <div className="w-full h-full flex flex-col gap-4 animate-fade-in">
                            <div className="flex items-center justify-between w-full">
                                <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                    <Radio size={14} className="animate-pulse"/> TARGET_PARAMETERS
                                </h3>
                                <button onClick={() => setIsJoining(false)} className="text-neutral-500 hover:text-white transition-colors"><Shield size={14}/></button>
                            </div>
                            
                            <div className="space-y-3 w-full">
                                <div>
                                    <input 
                                        value={targetId}
                                        onChange={(e) => setTargetId(e.target.value)}
                                        placeholder="TARGET_ID (e.g. uuid-v4)" 
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-neutral-700"
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <input 
                                        value={pin}
                                        onChange={(e) => setPin(e.target.value)}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={6}
                                        placeholder="PIN (6-DIGIT)" 
                                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-mono text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-neutral-700 text-center tracking-[0.2em]"
                                    />
                                    <button 
                                        onClick={handleJoinSubmit}
                                        disabled={!targetId || pin.length < 4}
                                        className="px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95"
                                    >
                                        CONNECT
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Error Toast */}
            {errorMsg && (
                <div className="fixed bottom-10 px-6 py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[10px] font-mono uppercase tracking-wider flex items-center gap-3 animate-slide-up backdrop-blur-md shadow-xl z-50">
                    <Shield size={14} /> {errorMsg}
                    <button onClick={onErrorClear} className="hover:text-white transition-colors ml-2">DISMISS</button>
                </div>
            )}
        </div>
    );
};
