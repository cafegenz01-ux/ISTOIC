
import React, { useState, useMemo } from 'react';
import { 
    X, User, Trash2, Activity, Search, ArrowRight,
    Wifi, RefreshCw, Users, UserPlus, MessageSquare,
    Save, Copy, Check, ShieldCheck, Zap, LogOut, Clock, Link as LinkIcon
} from 'lucide-react';
import useLocalStorage from '../../../hooks/useLocalStorage';
import { IstokIdentityService } from '../services/istokIdentity';

// --- TYPES ---
export interface IStokContact {
    id: string;      // ID Peer (ISTOIC-...)
    name: string;    // Nama Alias
    email?: string;  // Optional
    photoURL?: string; 
    addedAt: number;
    trustLevel: 'VERIFIED' | 'UNKNOWN';
}

export interface IStokSession {
    id: string; 
    name: string; 
    customName?: string;
    photoURL?: string;
    lastSeen: number;
    status: 'ONLINE' | 'BACKGROUND' | 'OFFLINE';
    pin: string;
    createdAt: number;
    isContact?: boolean;
}

export interface IStokProfile {
    id: string;           
    username: string;     
    email?: string;       
    photoURL?: string;    
    created: number;
}

interface SidebarIStokContactProps {
    isOpen: boolean;
    onClose: () => void;
    sessions: IStokSession[];
    profile: IStokProfile;
    onSelect: (session: IStokSession) => void;
    onCallContact: (contact: IStokContact) => void;
    onRenameSession: (id: string, newName: string) => void;
    onDeleteSession: (id: string) => void;
    onLogout: () => void;
    currentPeerId: string | null;
}

// --- UTILS ---
const formatRelativeTime = (timestamp: number) => {
    if (!timestamp) return '';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Baru saja';
    if (minutes < 60) return `${minutes}m lalu`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}j lalu`;
    return new Date(timestamp).toLocaleDateString();
};

export const SidebarIStokContact: React.FC<SidebarIStokContactProps> = ({
    isOpen,
    onClose,
    sessions = [], 
    profile,
    onSelect,
    onCallContact,
    onDeleteSession,
    onLogout,
    currentPeerId
}) => {
    // --- STATE ---
    const [activeTab, setActiveTab] = useState<'CHATS' | 'CONTACTS'>('CHATS');
    const [contacts, setContacts] = useLocalStorage<IStokContact[]>('istok_saved_contacts_v2', []);
    const [search, setSearch] = useState('');
    
    // Add Contact Form
    const [isAddingContact, setIsAddingContact] = useState(false);
    const [contactName, setContactName] = useState(''); // Nama Tampilan
    const [targetId, setTargetId] = useState(''); // User Input (e.g. BARISTA)
    
    const [copied, setCopied] = useState(false);

    // --- LOGIC ---

    const handleAddContact = async () => {
        if (!targetId || !contactName) return;
        
        // AUTO-FORMAT: ISTOIC-[INPUT]
        const finalId = IstokIdentityService.resolveId(targetId);

        // Cek duplikat
        if (contacts && contacts.some(c => c && c.id === finalId)) {
            alert("Kontak sudah ada!"); 
            return;
        }
        
        const newContact: IStokContact = {
            id: finalId,
            name: contactName.trim(),
            addedAt: Date.now(),
            trustLevel: 'VERIFIED'
        };
        
        setContacts(prev => [...(prev || []), newContact]);
        setIsAddingContact(false);
        setTargetId(''); setContactName('');
        setActiveTab('CONTACTS');
    };

    const handleDeleteContact = (id: string) => {
        if (confirm("Hapus kontak ini secara permanen?")) {
            setContacts(prev => prev.filter(c => c.id !== id));
        }
    };

    const handleCopyId = () => {
        if (profile?.id) {
            navigator.clipboard.writeText(profile.id);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // Filter & Merge Data for SEARCH
    const mergedSessions = useMemo(() => {
        if (!Array.isArray(sessions)) return [];
        
        return sessions
            .filter(s => s && s.id)
            .map(s => {
                const contact = Array.isArray(contacts) ? contacts.find(c => c && c.id === s.id) : undefined;
                return { 
                    ...s, 
                    displayName: contact ? contact.name : (s.customName || s.name || 'Unknown Agent'),
                    photoURL: contact?.photoURL || s.photoURL,
                    isContact: !!contact 
                };
            })
            .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
    }, [sessions, contacts]);

    const filteredSessions = mergedSessions.filter(s => 
        (s.displayName || '').toLowerCase().includes(search.toLowerCase()) || 
        (s.id || '').toLowerCase().includes(search.toLowerCase())
    );
    
    const filteredContacts = Array.isArray(contacts) ? contacts.filter(c => 
        c && ((c.name || '').toLowerCase().includes(search.toLowerCase()) || (c.id || '').toLowerCase().includes(search.toLowerCase()))
    ) : [];

    // --- RENDER ---
    return (
        <>
            {/* Backdrop */}
            <div 
                className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-[2000] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
                onClick={onClose} 
            />

            {/* Sidebar Panel */}
            <div className={`
                fixed inset-y-0 right-0 w-full max-w-xs bg-[#09090b] border-l border-white/10 z-[2010] 
                flex flex-col transform transition-transform duration-300 shadow-2xl font-sans
                ${isOpen ? 'translate-x-0' : 'translate-x-full'}
            `}>
                
                {/* 1. Header Profile (Safe Area Top) */}
                <div className="pt-safe px-6 pb-6 border-b border-white/10 bg-[#050505] relative overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[50px] rounded-full pointer-events-none"></div>
                    
                    <div className="flex justify-between items-start mb-6 relative z-10 pt-4">
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
                            <Zap size={14} className="text-emerald-500 fill-current"/> ISTOK_SECURE
                        </h2>
                        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition"><X size={18} className="text-neutral-500 hover:text-white" /></button>
                    </div>

                    <div className="flex items-center gap-4 mb-4 relative z-10">
                        {profile.photoURL ? (
                            <img src={profile.photoURL} alt="Profile" className="w-12 h-12 rounded-full border border-white/20 shadow-lg object-cover"/>
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-lg border border-white/10">
                                {profile.username.substring(0,1)}
                            </div>
                        )}
                        <div className="flex-1 overflow-hidden">
                            <h3 className="text-white font-bold text-sm truncate">{profile.username}</h3>
                            <p className="text-neutral-500 text-[10px] truncate">{profile.email || "No Email Linked"}</p>
                        </div>
                    </div>

                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 backdrop-blur-md relative group">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">YOUR ISTOIC ID</p>
                            <button onClick={handleCopyId} className="text-neutral-500 hover:text-emerald-400 transition">
                                {copied ? <Check size={12}/> : <Copy size={12}/>}
                            </button>
                        </div>
                        <code 
                            onClick={handleCopyId}
                            className="text-xs font-mono text-emerald-400 block cursor-pointer select-all truncate hover:opacity-80 transition"
                        >
                            {profile?.id || '...'}
                        </code>
                        
                        <div className="absolute -bottom-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={onLogout} className="p-1.5 bg-red-900/50 rounded-tl-lg text-red-200 hover:text-white" title="Sign Out"><LogOut size={10}/></button>
                        </div>
                    </div>
                </div>

                {/* 2. Controls & Search */}
                <div className="px-4 py-3 space-y-3 bg-[#09090b] shrink-0">
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                        <button 
                            onClick={() => setActiveTab('CHATS')} 
                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'CHATS' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-neutral-500 hover:text-white'}`}
                        >
                            <Clock size={12}/> RIWAYAT
                        </button>
                        <button 
                            onClick={() => setActiveTab('CONTACTS')} 
                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'CONTACTS' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-neutral-500 hover:text-white'}`}
                        >
                            <Users size={12}/> KONTAK
                        </button>
                    </div>
                    
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-emerald-500 transition-colors" size={14} />
                        <input 
                            type="text" 
                            value={search} 
                            onChange={(e)=>setSearch(e.target.value)} 
                            placeholder={activeTab === 'CHATS' ? "Cari riwayat..." : "Cari teman..."}
                            className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white placeholder:text-neutral-700 outline-none focus:border-emerald-500/50 transition-all font-mono"
                        />
                    </div>
                </div>

                {/* 3. Main List (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scroll pb-safe">
                    
                    {/* --- CHATS TAB --- */}
                    {activeTab === 'CHATS' && (
                        <>
                            {filteredSessions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 opacity-30 text-neutral-500 space-y-2">
                                    <MessageSquare size={32} strokeWidth={1}/>
                                    <p className="text-[10px] font-bold tracking-widest">TIADA AKTIVITAS</p>
                                </div>
                            ) : (
                                filteredSessions.map(s => {
                                    const isConnected = currentPeerId === s.id;
                                    return (
                                        <div 
                                            key={s.id} 
                                            onClick={() => onSelect(s)} 
                                            className={`
                                                group relative p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3
                                                ${isConnected 
                                                    ? 'bg-emerald-900/10 border-emerald-500/30' 
                                                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'}
                                            `}
                                        >
                                            <div className="relative">
                                                {s.photoURL ? (
                                                     <img src={s.photoURL} alt="User" className="w-10 h-10 rounded-full object-cover shadow-sm border border-white/10"/>
                                                ) : (
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-inner ${s.isContact ? 'bg-indigo-600' : 'bg-neutral-700'}`}>
                                                        {(s.displayName || '?').substring(0, 2).toUpperCase()}
                                                    </div>
                                                )}
                                                {s.status === 'ONLINE' && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#09090b]"></div>}
                                            </div>
                                            
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <h4 className={`text-xs font-bold truncate ${isConnected ? 'text-emerald-400' : 'text-white'}`}>
                                                        {s.displayName}
                                                    </h4>
                                                    <span className="text-[8px] font-mono text-neutral-600">{formatRelativeTime(s.lastSeen)}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {s.isContact && <ShieldCheck size={10} className="text-indigo-400"/>}
                                                    <p className="text-[9px] text-neutral-500 truncate font-mono">
                                                        {isConnected ? 'LIVE_UPLINK' : s.id.slice(0, 8) + '...'}
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            {/* Delete Action (Optional, hidden by default unless swiped/hovered) */}
                                            {/* Keeping UI simple for now, relying on click to select */}
                                        </div>
                                    );
                                })
                            )}
                        </>
                    )}

                    {/* --- CONTACTS TAB --- */}
                    {activeTab === 'CONTACTS' && (
                        <>
                            {!isAddingContact ? (
                                <button 
                                    onClick={()=>setIsAddingContact(true)} 
                                    className="w-full py-3 border border-dashed border-white/10 bg-white/5 rounded-xl text-neutral-400 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 mb-4 active:scale-95"
                                >
                                    <UserPlus size={14}/> TAMBAH TEMAN
                                </button>
                            ) : (
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 mb-4 animate-slide-up">
                                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-3 flex items-center gap-2"><UserPlus size={12}/> KONEKSI BARU</h4>
                                    
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <label className="text-[8px] text-neutral-500 font-bold ml-1">NAMA ALIAS</label>
                                            <input 
                                                value={contactName} 
                                                onChange={e=>setContactName(e.target.value)} 
                                                className="w-full bg-black border border-white/10 p-2.5 rounded-lg text-xs text-white focus:border-emerald-500 outline-none"
                                                placeholder="Contoh: Bos Besar"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] text-neutral-500 font-bold ml-1">ISTOIC ID (e.g. BARISTA)</label>
                                            <div className="flex items-center bg-black border border-white/10 rounded-lg focus-within:border-emerald-500 transition-all px-2.5">
                                                <span className="text-[10px] font-black text-emerald-500 mr-1">ISTOIC-</span>
                                                <input 
                                                    value={targetId} 
                                                    onChange={e=>setTargetId(e.target.value.toUpperCase())} 
                                                    className="w-full bg-transparent border-none p-2 text-xs text-white outline-none font-mono uppercase"
                                                    placeholder="KODENAME"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            <button onClick={()=>setIsAddingContact(false)} className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-neutral-400">BATAL</button>
                                            <button onClick={handleAddContact} disabled={!contactName || !targetId} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-[10px] font-bold text-white shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
                                                <Save size={12}/> SIMPAN
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {filteredContacts.length === 0 && !isAddingContact ? (
                                <div className="flex flex-col items-center justify-center h-40 opacity-30 text-neutral-500 space-y-2">
                                    <Users size={32} strokeWidth={1}/>
                                    <p className="text-[10px] font-bold tracking-widest">BELUM ADA TEMAN</p>
                                </div>
                            ) : (
                                filteredContacts.map(c => (
                                    <div 
                                        key={c.id} 
                                        className="group p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-all flex items-center gap-3 cursor-pointer active:scale-98"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-900 to-indigo-700 text-white flex items-center justify-center font-bold text-sm shadow-lg border border-white/10">
                                            {c.photoURL ? <img src={c.photoURL} className="w-full h-full rounded-full object-cover"/> : (c.name || '?').substring(0,2).toUpperCase()}
                                        </div>
                                        <div className="flex-1 overflow-hidden" onClick={() => onCallContact(c)}>
                                            <h4 className="text-xs font-bold text-white truncate">{c.name}</h4>
                                            <p className="text-[9px] text-neutral-500 truncate font-mono">{c.id}</p>
                                        </div>
                                        <div className="flex gap-1">
                                            {/* Explicit Connect Button for Clarity */}
                                            <button 
                                                onClick={(e)=>{e.stopPropagation(); onCallContact(c);}} 
                                                className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500 hover:text-white transition-colors"
                                                title="Hubungkan"
                                            >
                                                <LinkIcon size={14}/>
                                            </button>
                                            <button 
                                                onClick={(e)=>{e.stopPropagation(); handleDeleteContact(c.id);}} 
                                                className="p-2 bg-white/5 text-neutral-400 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                                                title="Hapus Kontak"
                                            >
                                                <Trash2 size={14}/>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
};
