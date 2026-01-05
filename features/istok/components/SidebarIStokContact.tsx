
import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, User, Trash2, Edit3, Activity, Clock, 
    Smartphone, Monitor, Circle, Search, ArrowRight, ShieldAlert,
    Wifi, WifiOff, Zap, Eye, EyeOff, Key, Lock, Fingerprint, RefreshCw
} from 'lucide-react';

export interface IStokSession {
    id: string; // Peer ID
    name: string; // Alias / Anomaly Name
    customName?: string; // User renamed
    lastSeen: number;
    status: 'ONLINE' | 'BACKGROUND' | 'OFFLINE';
    pin: string; // Saved Access Key
    createdAt: number;
}

export interface IStokProfile {
    id: string;
    username: string;
    created: number;
    idChangeHistory: number[]; // Array of timestamps when ID was changed
}

interface SidebarIStokContactProps {
    isOpen: boolean;
    onClose: () => void;
    sessions: IStokSession[];
    profile: IStokProfile;
    onSelect: (session: IStokSession) => void;
    onRename: (id: string, newName: string) => void;
    onDelete: (id: string) => void;
    onRegenerateProfile: () => void;
    currentPeerId: string | null;
}

export const SidebarIStokContact: React.FC<SidebarIStokContactProps> = ({
    isOpen,
    onClose,
    sessions,
    profile,
    onSelect,
    onRename,
    onDelete,
    onRegenerateProfile,
    currentPeerId
}) => {
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    
    // Identity Management State
    const [remainingChanges, setRemainingChanges] = useState(2);
    const [nextChangeDate, setNextChangeDate] = useState<string | null>(null);
    
    // State to toggle PIN visibility per session ID
    const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});

    // --- LOGIC: RATE LIMITING (2x per Month) ---
    useEffect(() => {
        if (profile && profile.idChangeHistory) {
            const now = Date.now();
            const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
            
            // Filter changes within last 30 days
            const recentChanges = profile.idChangeHistory.filter(ts => ts > thirtyDaysAgo);
            const left = Math.max(0, 2 - recentChanges.length);
            
            setRemainingChanges(left);

            if (left === 0 && recentChanges.length > 0) {
                // Calculate when the oldest of the recent changes "expires"
                const oldestChange = Math.min(...recentChanges);
                const availableAt = oldestChange + (30 * 24 * 60 * 60 * 1000);
                setNextChangeDate(new Date(availableAt).toLocaleDateString());
            } else {
                setNextChangeDate(null);
            }
        }
    }, [profile]);

    const handleRegenerateClick = () => {
        if (remainingChanges > 0) {
            if (confirm(`Ganti Identitas (ID & Nama)?\n\nSisa kuota bulan ini: ${remainingChanges} kali.\nID lama tidak akan bisa dihubungi lagi.`)) {
                onRegenerateProfile();
            }
        } else {
            alert(`Kuota ganti identitas habis.\nCoba lagi setelah: ${nextChangeDate}`);
        }
    };

    const filtered = useMemo(() => {
        return sessions.filter(s => 
            (s.customName || s.name || s.id).toLowerCase().includes(search.toLowerCase())
        ).sort((a, b) => {
            // Sort by Status (Online first), then Last Seen
            if (a.status === 'ONLINE' && b.status !== 'ONLINE') return -1;
            if (a.status !== 'ONLINE' && b.status === 'ONLINE') return 1;
            return b.lastSeen - a.lastSeen;
        });
    }, [sessions, search]);

    const handleStartRename = (s: IStokSession, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(s.id);
        setEditName(s.customName || s.name);
    };

    const handleSaveRename = () => {
        if (editingId && editName.trim()) {
            onRename(editingId, editName.trim());
        }
        setEditingId(null);
    };

    const togglePinVisibility = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setRevealedPins(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleCopyId = () => {
        navigator.clipboard.writeText(profile.id);
        alert("ID Copied to Clipboard");
    };

    return (
        <>
            {/* Backdrop */}
            <div 
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />

            {/* Sidebar */}
            <div className={`
                fixed inset-y-0 right-0 w-full max-w-xs sm:max-w-md
                bg-[#09090b] border-l border-white/10 z-[2010] shadow-[0_0_50px_rgba(0,0,0,0.5)]
                transform transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]
                flex flex-col font-sans
                ${isOpen ? 'translate-x-0' : 'translate-x-full'}
            `}>
                <div className="p-6 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.02]">
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
                            <Zap size={16} className="text-emerald-500 fill-current" /> CONTACT_MATRIX
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-neutral-500 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                        <X size={18} />
                    </button>
                </div>

                {/* USER IDENTITY CARD (Improved) */}
                <div className="p-4 bg-[#050505] border-b border-white/5">
                    <div className="flex flex-col gap-4 p-5 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 relative overflow-hidden">
                        {/* Background Pulse */}
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 blur-xl rounded-full animate-pulse"></div>

                        <div className="flex justify-between items-start z-10">
                            <div>
                                <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1">MY_IDENTITY</p>
                                <h3 className="text-lg font-black text-white tracking-tight">{profile.username}</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-[8px] font-mono px-2 py-1 rounded border ${remainingChanges > 0 ? 'border-emerald-500/30 text-emerald-500' : 'border-red-500/30 text-red-500'}`}>
                                    CHANGES: {remainingChanges}/2
                                </span>
                                <button 
                                    onClick={handleRegenerateClick}
                                    className={`p-2 rounded-lg transition-all ${remainingChanges > 0 ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-white/5 text-neutral-600 cursor-not-allowed'}`}
                                    title={remainingChanges > 0 ? "Generate New Identity" : `Cooldown until ${nextChangeDate}`}
                                >
                                    <RefreshCw size={14} />
                                </button>
                            </div>
                        </div>

                        <button 
                            onClick={handleCopyId}
                            className="flex flex-col gap-1 p-3 bg-black/40 rounded-xl border border-emerald-500/10 hover:border-emerald-500/40 transition-all text-left group z-10"
                        >
                            <span className="text-[8px] text-neutral-500 font-mono">UNIQUE_ID (TAP TO COPY)</span>
                            <code className="text-[10px] text-emerald-400 font-mono break-all group-hover:text-emerald-300">
                                {profile.id}
                            </code>
                        </button>
                    </div>
                </div>

                <div className="p-4 border-b border-white/5 bg-[#050505]">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-emerald-500 transition-colors" size={14} />
                        <input 
                            type="text" 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="SEARCH FREQUENCY..." 
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-[10px] text-white focus:outline-none focus:border-emerald-500/50 uppercase tracking-wider placeholder:text-neutral-700 font-bold transition-all"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-3 bg-[#050505]">
                    {filtered.length === 0 ? (
                        <div className="text-center py-20 opacity-30 flex flex-col items-center">
                            <Activity size={32} className="mb-3 text-neutral-500" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">NO_SIGNALS_FOUND</p>
                        </div>
                    ) : (
                        filtered.map(s => {
                            const isConnected = currentPeerId === s.id;
                            const isPinRevealed = revealedPins[s.id];

                            return (
                                <div 
                                    key={s.id} 
                                    className={`
                                        relative p-4 rounded-2xl border transition-all group overflow-hidden cursor-pointer
                                        ${isConnected 
                                            ? 'bg-emerald-950/10 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]' 
                                            : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                                        }
                                    `}
                                    onClick={() => !deleteConfirmId && onSelect(s)}
                                >
                                    {/* Delete Confirmation Overlay */}
                                    {deleteConfirmId === s.id ? (
                                        <div className="absolute inset-0 bg-[#09090b]/95 flex flex-col items-center justify-center z-20 animate-fade-in text-center p-4 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
                                            <ShieldAlert size={24} className="text-red-500 mb-2" />
                                            <p className="text-[9px] font-black text-white uppercase mb-3 tracking-widest">WIPE SECURE LINK?</p>
                                            <div className="flex gap-2">
                                                <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-1.5 rounded-lg bg-white/10 text-[9px] font-bold text-neutral-400 hover:text-white hover:bg-white/20 transition-all">CANCEL</button>
                                                <button onClick={() => { onDelete(s.id); setDeleteConfirmId(null); }} className="px-4 py-1.5 rounded-lg bg-red-600/20 text-red-500 border border-red-500/50 text-[9px] font-bold hover:bg-red-600 hover:text-white transition-all">CONFIRM</button>
                                            </div>
                                        </div>
                                    ) : null}

                                    {/* Header Row: Status & Actions */}
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            {s.status === 'ONLINE' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse"></div>}
                                            {s.status === 'BACKGROUND' && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]"></div>}
                                            {s.status === 'OFFLINE' && <div className="w-1.5 h-1.5 rounded-full bg-neutral-700 border border-white/10"></div>}
                                            
                                            <span className={`text-[8px] font-black uppercase tracking-widest ${s.status === 'ONLINE' ? 'text-emerald-500' : s.status === 'BACKGROUND' ? 'text-amber-500' : 'text-neutral-600'}`}>
                                                {s.status === 'ONLINE' ? 'ACTIVE UPLINK' : s.status}
                                            </span>
                                        </div>
                                        
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                            <button onClick={(e) => handleStartRename(s, e)} className="p-1.5 text-neutral-500 hover:text-white hover:bg-white/10 rounded transition-colors"><Edit3 size={12}/></button>
                                            <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(s.id); }} className="p-1.5 text-neutral-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"><Trash2 size={12}/></button>
                                        </div>
                                    </div>

                                    {/* Name & ID */}
                                    {editingId === s.id ? (
                                        <div className="flex items-center gap-2 mb-3" onClick={(e) => e.stopPropagation()}>
                                            <input 
                                                autoFocus
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                onBlur={handleSaveRename}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()}
                                                className="w-full bg-black border-b border-emerald-500 text-sm font-bold text-white outline-none py-1 uppercase tracking-tight"
                                            />
                                        </div>
                                    ) : (
                                        <div className="mb-4">
                                            <h4 className={`text-sm font-black uppercase tracking-tight truncate ${isConnected ? 'text-emerald-400' : 'text-white'}`}>
                                                {s.customName || s.name || 'UNKNOWN_ANOMALY'}
                                            </h4>
                                            <p className="text-[9px] font-mono text-neutral-500 truncate flex items-center gap-1 mt-0.5">
                                                ID: <span className="select-all hover:text-white transition-colors">{s.id}</span>
                                            </p>
                                        </div>
                                    )}

                                    {/* Secure Key Display (Read Only) */}
                                    <div className="mb-4 p-2 bg-black/40 rounded-lg border border-white/5 flex items-center justify-between group/pin" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <Lock size={10} className="text-neutral-600" />
                                            <span className="text-[10px] font-mono text-neutral-400 tracking-widest truncate">
                                                {isPinRevealed ? s.pin : '••••••'}
                                            </span>
                                        </div>
                                        <button 
                                            onClick={(e) => togglePinVisibility(s.id, e)}
                                            className="p-1 text-neutral-600 hover:text-white transition-colors"
                                        >
                                            {isPinRevealed ? <EyeOff size={10} /> : <Eye size={10} />}
                                        </button>
                                    </div>

                                    {/* Footer */}
                                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                        <span className="text-[8px] text-neutral-600 font-mono flex items-center gap-1">
                                            <Clock size={10} /> {new Date(s.lastSeen).toLocaleDateString()}
                                        </span>
                                        
                                        {isConnected ? (
                                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1">
                                                <Wifi size={10} /> CONNECTED
                                            </span>
                                        ) : (
                                            <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-neutral-500 group-hover:text-emerald-500 transition-colors">
                                                CALL <ArrowRight size={10} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </>
    );
};
