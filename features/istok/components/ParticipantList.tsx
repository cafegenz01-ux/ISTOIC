
import React from 'react';
import { Users, Crown, Wifi, WifiOff } from 'lucide-react';

interface Participant {
    id: string;
    name: string;
    status: 'ONLINE' | 'OFFLINE';
    isHost: boolean;
}

interface ParticipantListProps {
    participants: Participant[];
    isOpen: boolean;
    onClose: () => void;
}

export const ParticipantList: React.FC<ParticipantListProps> = ({ participants, isOpen, onClose }) => {
    return (
        <div className={`
            fixed inset-y-0 right-0 w-64 bg-[#09090b]/95 backdrop-blur-xl border-l border-white/10 z-[2050]
            transform transition-transform duration-300 ease-out shadow-2xl flex flex-col
            ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}>
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-2 text-white">
                    <Users size={16} className="text-emerald-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest">ANGGOTA ROOM ({participants.length})</span>
                </div>
                <button onClick={onClose} className="text-neutral-500 hover:text-white text-xs font-bold">TUTUP</button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scroll p-2 space-y-1">
                {participants.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 group">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${p.isHost ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-500'}`}>
                                {p.name.substring(0,2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate flex items-center gap-1">
                                    {p.name}
                                    {p.isHost && <Crown size={10} className="text-amber-500 fill-current" />}
                                </p>
                                <p className="text-[9px] font-mono text-neutral-500 truncate">{p.id.slice(0,8)}...</p>
                            </div>
                        </div>
                        <div className={`p-1.5 rounded-full ${p.status === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                            {p.status === 'ONLINE' ? <Wifi size={12} /> : <WifiOff size={12} />}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
