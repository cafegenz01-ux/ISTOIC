
import React from 'react';
import { Brain, Radio, Shield, Lock } from 'lucide-react';

interface SystemLauncherProps {
    onSelectSystem: (system: 'ISTOIC' | 'ISTOK') => void;
    onLock: () => void;
}

export const SystemLauncher: React.FC<SystemLauncherProps> = ({ onSelectSystem, onLock }) => {
    return (
        <div className="fixed inset-0 bg-[var(--bg)] flex items-center justify-center p-6 z-[9000] font-sans">
            {/* Background Ambience */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--accent-rgb)/5_0%,transparent_70%)] pointer-events-none"></div>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[color:var(--border)]/40 to-transparent"></div>

            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10 animate-fade-in">
                
                {/* CHOICE 1: ISTOIC AI (MAIN) */}
                <button 
                    onClick={() => onSelectSystem('ISTOIC')}
                    className="group relative h-80 md:h-96 rounded-[32px] border border-[color:var(--accent)]/20 bg-gradient-to-br from-[var(--surface)] to-[var(--surface-2)] overflow-hidden transition-all duration-500 hover:border-[color:var(--accent)]/60 hover:shadow-[0_0_50px_var(--accent-rgb)/15] flex flex-col items-center justify-center gap-6"
                >
                    <div className="absolute inset-0 bg-[color:var(--accent)]/3 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    
                    <div className="w-24 h-24 rounded-3xl bg-[color:var(--accent)]/10 border border-[color:var(--accent)]/30 flex items-center justify-center text-[var(--accent)] group-hover:scale-110 transition-transform duration-500 shadow-[0_0_30px_var(--accent-rgb)/20]">
                        <Brain size={48} strokeWidth={1.5} />
                    </div>
                    
                    <div className="text-center space-y-2 relative z-10">
                        <h2 className="text-3xl font-black italic tracking-tighter text-[var(--text)] uppercase group-hover:text-[var(--accent)] transition-colors">ISTOIC<span className="text-[var(--accent)]">AI</span></h2>
                        <p className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-[0.3em]">Cognitive Operating System</p>
                    </div>

                    <div className="absolute bottom-8 px-4 py-1 rounded-full border border-[color:var(--border)]/40 bg-[var(--surface-2)]/60 text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest group-hover:border-[color:var(--accent)]/40 group-hover:text-[var(--accent)] transition-all">
                        SYSTEM_ONLINE
                    </div>
                </button>

                {/* CHOICE 2: ISTOK (SECURE LINE) */}
                <button 
                    onClick={() => onSelectSystem('ISTOK')}
                    className="group relative h-80 md:h-96 rounded-[32px] border border-[color:var(--accent-2)]/20 bg-gradient-to-br from-[var(--surface)] to-[var(--surface-2)] overflow-hidden transition-all duration-500 hover:border-[color:var(--accent-2)]/60 hover:shadow-[0_0_50px_var(--accent-2-rgb)/15] flex flex-col items-center justify-center gap-6"
                >
                    {/* Scanlines for IStok */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.05)_50%),linear-gradient(90deg,var(--accent-2-rgb)/0.05,var(--accent-2-rgb)/0.02,var(--accent-2-rgb)/0.05)] z-0 bg-[length:100%_4px,6px_100%] opacity-20 pointer-events-none"></div>
                    <div className="absolute inset-0 bg-[color:var(--accent-2)]/3 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                    <div className="w-24 h-24 rounded-3xl bg-[color:var(--accent-2)]/10 border border-[color:var(--accent-2)]/30 flex items-center justify-center text-[var(--accent-2)] group-hover:scale-110 transition-transform duration-500 shadow-[0_0_30px_var(--accent-2-rgb)/20] relative z-10">
                        <Radio size={48} strokeWidth={1.5} />
                    </div>

                    <div className="text-center space-y-2 relative z-10">
                        <h2 className="text-3xl font-black italic tracking-tighter text-[var(--text)] uppercase group-hover:text-[var(--accent-2)] transition-colors">IStok</h2>
                        <p className="text-[10px] font-mono text-[var(--text-muted)] group-hover:text-[var(--accent-2)]/80 uppercase tracking-[0.3em] transition-colors">Encrypted P2P Uplink</p>
                    </div>

                    <div className="absolute bottom-8 px-4 py-1 rounded-full border border-[color:var(--border)]/40 bg-[var(--surface-2)]/60 text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest group-hover:border-[color:var(--accent-2)]/40 group-hover:text-[var(--accent-2)] transition-all flex items-center gap-2">
                        <Shield size={10} /> SECURE_CHANNEL
                    </div>
                </button>
            </div>

            {/* Footer / Lock */}
            <div className="absolute bottom-10 left-0 right-0 flex justify-center">
                <button 
                    onClick={onLock}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--surface)]/80 hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-all border border-[color:var(--border)]/40 active:scale-95"
                >
                    <Lock size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">LOCK_TERMINAL</span>
                </button>
            </div>
        </div>
    );
};
