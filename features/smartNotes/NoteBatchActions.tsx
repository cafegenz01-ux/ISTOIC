
import { Trash2, X, Archive, FileJson, Bookmark, ArchiveRestore, ShieldAlert, CheckCheck, MinusCircle } from 'lucide-react';
import React from 'react';
import { type Note } from '../../types';

interface NoteBatchActionsProps {
    isSelectionMode: boolean;
    selectedCount: number;
    totalVisibleCount: number;
    isViewingArchive: boolean;
    selectedNotes: Note[];
    onSelectAll: () => void;
    onDeselectAll: () => void;
    onDeleteSelected: () => void;
    onArchiveSelected: () => void;
    onPinSelected: () => void;
    onCancel: () => void;
}

export const NoteBatchActions: React.FC<NoteBatchActionsProps> = ({
    isSelectionMode,
    selectedCount,
    totalVisibleCount,
    isViewingArchive,
    selectedNotes,
    onSelectAll,
    onDeselectAll,
    onDeleteSelected,
    onArchiveSelected,
    onPinSelected,
    onCancel
}) => {
    const isVisible = isSelectionMode || selectedCount > 0;
    // Check if ALL visible notes are selected to determine toggle state
    const isAllSelected = selectedCount === totalVisibleCount && totalVisibleCount > 0;

    const handleExport = () => {
        if (selectedNotes.length === 0) return;
        const dataStr = JSON.stringify(selectedNotes, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = `istoic_vault_export_${new Date().toISOString().slice(0,10)}.json`;
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    return (
        <div className={`
            fixed transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) left-1/2 -translate-x-1/2
            z-[2000] 
            bottom-24 md:bottom-10 w-auto min-w-[320px] max-w-[95vw]
            ${isVisible ? 'translate-y-0 opacity-100 scale-100 pointer-events-auto' : 'translate-y-[150%] opacity-0 scale-90 pointer-events-none'}
        `}>
            <div 
                className="bg-white/95 dark:bg-[#0a0a0b]/95 backdrop-blur-2xl border border-black/5 dark:border-white/10 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)] rounded-[32px] p-2 pr-3 flex items-center gap-3 ring-1 ring-white/10 pointer-events-auto"
                onClick={(e) => e.stopPropagation()} // Prevent clicks from bubbling to background
            >
                
                {/* Select Toggle */}
                <button 
                    onClick={(e) => { e.stopPropagation(); isAllSelected ? onDeselectAll() : onSelectAll(); }}
                    type="button"
                    className={`
                        h-12 px-5 rounded-[24px] flex flex-col items-center justify-center min-w-[70px] shadow-sm transition-all active:scale-95 border
                        ${isAllSelected 
                            ? 'bg-black dark:bg-white text-white dark:text-black border-transparent' 
                            : 'bg-zinc-100 dark:bg-white/5 border-black/5 dark:border-white/5 text-neutral-500 hover:text-black dark:hover:text-white'
                        }
                    `}
                >
                    {isAllSelected ? <MinusCircle size={18} /> : <CheckCheck size={18} />}
                    <span className="text-[7px] font-black mt-0.5 uppercase tracking-widest">
                        {isAllSelected ? 'NONE' : 'ALL'}
                    </span>
                </button>

                {/* Counter */}
                <div className="flex flex-col px-1 min-w-[50px]">
                    <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">SELECTED</span>
                    <span className="text-xl font-black italic leading-none text-black dark:text-white font-sans">
                        {selectedCount}<span className="text-neutral-400 text-sm opacity-50">/{totalVisibleCount}</span>
                    </span>
                </div>

                <div className="w-[1px] h-8 bg-black/5 dark:bg-white/10 mx-1"></div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                    <ActionButton icon={<Bookmark size={18} />} label="PIN" onClick={onPinSelected} disabled={selectedCount === 0} />
                    <ActionButton icon={isViewingArchive ? <ArchiveRestore size={18} /> : <Archive size={18} />} label={isViewingArchive ? 'RESTORE' : 'ARCHIVE'} onClick={onArchiveSelected} disabled={selectedCount === 0} />
                    <ActionButton icon={<FileJson size={18} />} label="EXPORT" onClick={handleExport} disabled={selectedCount === 0} />
                    <div className="w-[1px] h-6 bg-black/5 dark:bg-white/5 mx-1"></div>
                    <ActionButton icon={<ShieldAlert size={18} />} label="PURGE" onClick={onDeleteSelected} variant="danger" disabled={selectedCount === 0} />
                </div>

                {/* Close */}
                <button 
                    onClick={(e) => { e.stopPropagation(); onCancel(); }}
                    type="button"
                    className="w-8 h-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-black dark:hover:text-white transition-all ml-1 active:scale-90"
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    );
};

const ActionButton: React.FC<{ icon: React.ReactNode, label: string, onClick: () => void, variant?: 'normal' | 'danger', disabled?: boolean }> = ({ icon, label, onClick, variant = 'normal', disabled }) => (
    <button 
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); if(!disabled) onClick(); }}
        disabled={disabled}
        type="button"
        className={`relative w-12 h-12 rounded-[20px] flex items-center justify-center transition-all duration-300 group hover:scale-105 active:scale-95 ${
            disabled 
            ? 'opacity-30 cursor-not-allowed text-neutral-500'
            : variant === 'danger' 
                ? 'text-red-500 bg-red-500/10 hover:bg-red-500 hover:text-white hover:shadow-lg hover:shadow-red-500/20' 
                : 'text-neutral-500 hover:text-accent hover:bg-accent/10 hover:shadow-lg hover:shadow-accent/10'
        }`}
        title={label}
    >
        <div className="relative z-10">{icon}</div>
    </button>
);
