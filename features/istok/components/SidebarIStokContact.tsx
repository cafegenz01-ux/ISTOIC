
import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, User, Trash2, Edit3, Activity, Clock, 
    Smartphone, Monitor, Circle, Search, ArrowRight, ShieldAlert,
    Wifi, WifiOff, Zap, Eye, EyeOff, Key, Lock, Fingerprint, RefreshCw,
    Users, UserPlus, Save, MessageSquare
} from 'lucide-react';
import useLocalStorage from '../../../hooks/useLocalStorage';

// Tipe Data Kontak Persisten (Mirip Buku Telepon)
export interface IStokContact {
    id: string;      // Peer ID (Nomor Teleponnya)
    name: string;    // Nama yang kita berikan (Misal: "Budi")
    addedAt: number;
    trustLevel: 'VERIFIED' | 'UNKNOWN';
}

// Tipe Data Sesi Aktif (Chat yang sedang berlangsung)
export interface IStokSession {
    id: string; 
    name: string; // Nama tampilan (bisa dari Kontak atau Anomaly)
    customName?: string;
    lastSeen: number;
    status: 'ONLINE' | 'BACKGROUND' | 'OFFLINE';
    pin: string;
    createdAt: number;
    isContact?: boolean; // Apakah ini ada di buku kontak?
}

export interface IStokProfile {
    id: string;
    username: string;
    created: number;
    idChangeHistory: number[];
}

interface SidebarIStokContactProps {
    isOpen: boolean;
    onClose: () => void;
    sessions: IStokSession[];
    profile: IStokProfile;
    onSelect: (session: IStokSession) => void; // Untuk Chat
    onCallContact: (contact: IStokContact) => void; // Untuk Dial Kontak Offline
    onRenameSession: (id: string, newName: string) => void;
    onDeleteSession: (id: string) => void;
    onRegenerateProfile: () => void;
    currentPeerId: string | null;
}

export const SidebarIStokContact: React.FC<SidebarIStokContactProps> = ({
    isOpen,
    onClose,
    sessions,
    profile,
    onSelect,
    onCallContact,
    onRenameSession,
    onDeleteSession,
    onRegenerateProfile,
    currentPeerId
}) => {
    // --- STATE ---
    const [activeTab, setActiveTab] = useState<'CHATS' | 'CONTACTS'>('CHATS');
    const [contacts, setContacts] = useLocalStorage<IStokContact[]>('istok_saved_contacts', []);
    const [search, setSearch] = useState('');
    
    // Add Contact State
    const [isAddingContact, setIsAddingContact] = useState(false);
    const [newContactId, setNewContactId] = useState('');
    const [newContactName, setNewContactName] = useState('');

    // --- LOGIC: CONTACT MANAGEMENT ---

    const handleAddContact = () => {
        if (!newContactId || !newContactName) return;
        
        // Prevent duplicate IDs
        if (contacts.some(c => c.id === newContactId)) {
            alert("Kontak dengan ID ini sudah ada.");
            return;
        }

        const newContact: IStokContact = {
            id: newContactId.trim(),
            name: newContactName.trim(),
            addedAt: Date.now(),
            trustLevel: 'UNKNOWN'
        };

        setContacts(prev => [...prev, newContact]);
        setIsAddingContact(false);
        setNewContactId('');
        setNewContactName('');
        setActiveTab('CONTACTS');
    };

    const handleDeleteContact = (id: string) => {
        if (confirm("Hapus kontak ini permanen?")) {
            setContacts(prev => prev.filter(c => c.id !== id));
        }
    };

    // Merge logic: Check if active sessions match any saved contacts
    const mergedSessions = useMemo(() => {
        return sessions.map(s => {
            const contact = contacts.find(c => c.id === s.id);
            return {
                ...s,
                name: contact ? contact.name : (s.customName || s.name),
                isContact: !!contact
            };
        }).sort((a, b) => b.lastSeen - a.lastSeen);
    }, [sessions, contacts]);

    const filteredSessions = mergedSessions.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
    
    const filteredContacts = contacts.filter(c => 
        c.name.toLowerCase().includes(search.toLowerCase()) || 
        c.id.includes(search)
    );

    const handleCopyId = () => {
        navigator.clipboard.writeText(profile.id);
        alert("ID Anda disalin. Bagikan ke teman agar mereka bisa 'Add Contact'.");
    };

    return (
        <>
            {/* Backdrop */}
            <div 
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />

            {/* Sidebar Container */}
            <div className={`
                fixed inset-y-0 right-0 w-full max-w-xs sm:max-w-md
                bg-[#09090b] border-l border-white/10 z-[2010] shadow-[0_0_50px_rgba(0,0,0,0.5)]
                transform transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]
                flex flex-col font-sans
                ${isOpen ? 'translate-x-0' : 'translate-x-full'}
            `}>
                
                {/* 1. HEADER & IDENTITY */}
                <div className="p-5 border-b border-white/10 bg-[#050505]">
                    <div className="flex justify-between items-start mb-4">
                        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
                            <Zap size={14} className="text-emerald-500 fill-current" /> ISTOK_MESSENGER
                        </h2>
                        <button onClick={onClose} className="p-1.5 text-neutral-500 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                            <X size={18} />
                        </button>
                    </div>

                    {/* My Profile Card (Compact) */}
                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 group relative overflow-hidden">
                        <div className="w-10 h-10 rounded-full bg-emerald-600/20 text-emerald-500 flex items-center justify-center border border-emerald-500/30 shrink-0">
                            <User size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">MY ID</p>
                            <code className="text-xs font-mono text-white truncate block cursor-pointer hover:text-emerald-400 transition-colors" onClick={handleCopyId}>
                                {profile.id}
                            </code>
                        </div>
                        <button onClick={onRegenerateProfile} className="p-2 text-neutral-500 hover:text-white" title="Reset Identity">
                            <RefreshCw size={14} />
                        </button>
                    </div>
                </div>

                {/* 2. TABS & SEARCH */}
                <div className="px-4 pt-4 pb-2 bg-[#09090b] space-y-3">
                    <div className="flex bg-white/5 p-1 rounded-xl">
                        <button 
                            onClick={() => setActiveTab('CHATS')}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'CHATS' ? 'bg-emerald-600 text-white shadow-lg' : 'text-neutral-500 hover:text-white'}`}
                        >
                            <MessageSquare size={12} /> CHATS
                        </button>
                        <button 
                            onClick={() => setActiveTab('CONTACTS')}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'CONTACTS' ? 'bg-emerald-600 text-white shadow-lg' : 'text-neutral-500 hover:text-white'}`}
                        >
                            <Users size={12} /> KONTAK
                        </button>
                    </div>

                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-emerald-500 transition-colors" size={14} />
                        <input 
                            type="text" 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={activeTab === 'CHATS' ? "Cari Chat..." : "Cari Teman..."}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-[10px] text-white focus:outline-none focus:border-emerald-500/50 uppercase tracking-wider placeholder:text-neutral-700 font-bold transition-all"
                        />
                    </div>
                </div>

                {/* 3. LIST CONTENT */}
                <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-2 bg-[#09090b]">
                    
                    {/* --- TAB: CHATS (ACTIVE SESSIONS) --- */}
                    {activeTab === 'CHATS' && (
                        <>
                            {filteredSessions.length === 0 ? (
                                <div className="text-center py-12 opacity-30 flex flex-col items-center">
                                    <MessageSquare size={32} className="mb-3 text-neutral-500" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">BELUM ADA CHAT</p>
                                </div>
                            ) : (
                                filteredSessions.map(s => {
                                    const isConnected = currentPeerId === s.id;
                                    return (
                                        <div 
                                            key={s.id}
                                            onClick={() => onSelect(s)}
                                            className={`
                                                relative p-3.5 rounded-2xl border transition-all cursor-pointer group flex items-center gap-3
                                                ${isConnected ? 'bg-emerald-950/10 border-emerald-500/30' : 'bg-white/5 border-white/5 hover:bg-white/10'}
                                            `}
                                        >
                                            <div className="relative">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${s.isContact ? 'bg-blue-600' : 'bg-neutral-700'}`}>
                                                    {s.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                {s.status === 'ONLINE' && <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#09090b]"></div>}
                                            </div>
                                            
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-center mb-0.5">
                                                    <h4 className={`text-xs font-bold truncate ${isConnected ? 'text-emerald-400' : 'text-white'}`}>
                                                        {s.name}
                                                    </h4>
                                                    <span className="text-[8px] font-mono text-neutral-600">{new Date(s.lastSeen).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                                </div>
                                                <p className="text-[9px] text-neutral-500 truncate flex items-center gap-1">
                                                    {isConnected ? <Wifi size={8} className="text-emerald-500"/> : <Activity size={8}/>}
                                                    {isConnected ? 'Terhubung' : 'Terakhir dilihat...'}
                                                </p>
                                            </div>

                                            {/* Action: Save Unknown to Contacts */}
                                            {!s.isContact && (
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setNewContactId(s.id);
                                                        setNewContactName(s.name);
                                                        setIsAddingContact(true);
                                                    }}
                                                    className="p-2 text-neutral-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                                                    title="Simpan ke Kontak"
                                                >
                                                    <UserPlus size={16} />
                                                </button>
                                            )}
                                            
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }}
                                                className="p-2 text-neutral-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </>
                    )}

                    {/* --- TAB: CONTACTS (SAVED FRIENDS) --- */}
                    {activeTab === 'CONTACTS' && (
                        <>
                            {/* Add Contact Trigger */}
                            {!isAddingContact ? (
                                <button 
                                    onClick={() => setIsAddingContact(true)}
                                    className="w-full py-3 rounded-xl border border-dashed border-white/20 text-neutral-400 hover:text-white hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest mb-4"
                                >
                                    <UserPlus size={14} /> TAMBAH KONTAK BARU
                                </button>
                            ) : (
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 mb-4 animate-slide-up">
                                    <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-3">TAMBAH TEMAN</h4>
                                    <div className="space-y-2">
                                        <input 
                                            placeholder="Nama Teman (Alias)"
                                            value={newContactName}
                                            onChange={e => setNewContactName(e.target.value)}
                                            className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                                        />
                                        <input 
                                            placeholder="ID IStok Mereka (Panjang)"
                                            value={newContactId}
                                            onChange={e => setNewContactId(e.target.value)}
                                            className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-emerald-500 outline-none"
                                        />
                                        <div className="flex gap-2 pt-2">
                                            <button onClick={() => setIsAddingContact(false)} className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[9px] font-bold text-neutral-400">BATAL</button>
                                            <button onClick={handleAddContact} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-[9px] font-bold text-white shadow-lg">SIMPAN</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {filteredContacts.length === 0 && !isAddingContact ? (
                                <div className="text-center py-12 opacity-30 flex flex-col items-center">
                                    <Users size={32} className="mb-3 text-neutral-500" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">BELUM ADA TEMAN</p>
                                </div>
                            ) : (
                                filteredContacts.map(c => (
                                    <div 
                                        key={c.id} 
                                        className="p-3.5 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/5 transition-all flex items-center gap-3 group cursor-pointer"
                                        onClick={() => onCallContact(c)}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0 font-bold text-sm">
                                            {c.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-xs font-bold text-white truncate">{c.name}</h4>
                                            <p className="text-[9px] font-mono text-neutral-500 truncate">ID: {c.id.substring(0, 8)}...</p>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onCallContact(c); }}
                                                className="p-2 bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600 hover:text-white rounded-lg transition-all"
                                                title="Chat Sekarang"
                                            >
                                                <ArrowRight size={14} />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteContact(c.id); }}
                                                className="p-2 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white rounded-lg transition-all"
                                            >
                                                <Trash2 size={14} />
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
