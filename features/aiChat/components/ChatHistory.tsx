
import React, { useState, useMemo } from 'react';
import { X, History, Trash2, Plus, Search, Edit3, MessageSquare, Flame, Brain, ChevronRight, Pin, PinOff } from 'lucide-react';
import { GroupedVirtuoso } from 'react-virtuoso';
import { type ChatThread } from '../../../types';
import { debugService } from '../../../services/debugService';
import { UI_REGISTRY, FN_REGISTRY } from '../../../constants/registry';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

interface ChatHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  threads: ChatThread[];
  activeThreadId: string | null;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  onRenameThread: (id: string, newTitle: string) => void;
  onTogglePin: (id: string) => void;
  onNewChat: () => void;
}

// Helper for Relative Time
const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
};

export const ChatHistory: React.FC<ChatHistoryProps> = ({
  isOpen,
  onClose,
  threads,
  activeThreadId,
  onSelectThread,
  onDeleteThread,
  onRenameThread,
  onTogglePin,
  onNewChat
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const filteredThreads = useMemo(() => {
    return threads
      .filter(t => 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.messages.some(m => typeof m.text === 'string' && m.text.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .sort((a, b) => {
        // Sort by Pinned first, then by Date (Newest first)
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        // Fallback to creation time if update time is same (rare)
        const dateA = new Date(a.updated || 0).getTime();
        const dateB = new Date(b.updated || 0).getTime();
        return dateB - dateA;
      });
  }, [threads, searchQuery]);

  const { flatData, groupCounts, groupNames } = useMemo(() => {
    const result: Record<string, ChatThread[]> = {
      'PINNED': [],
      'TODAY': [],
      'YESTERDAY': [],
      'PREVIOUS 7 DAYS': [],
      'ARCHIVED LOGS': []
    };

    const today = new Date();
    today.setHours(0,0,0,0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    filteredThreads.forEach(t => {
      if (t.isPinned) {
        result['PINNED'].push(t);
        return;
      }

      const date = new Date(t.updated || 0);
      if (date >= today) result['TODAY'].push(t);
      else if (date >= yesterday) result['YESTERDAY'].push(t);
      else if (date >= lastWeek) result['PREVIOUS 7 DAYS'].push(t);
      else result['ARCHIVED LOGS'].push(t);
    });

    const flatData: ChatThread[] = [];
    const groupCounts: number[] = [];
    const groupNames: string[] = [];
    
    ['PINNED', 'TODAY', 'YESTERDAY', 'PREVIOUS 7 DAYS', 'ARCHIVED LOGS'].forEach(key => {
        if (result[key].length > 0) {
            flatData.push(...result[key]);
            groupCounts.push(result[key].length);
            groupNames.push(key);
        }
    });

    return { flatData, groupCounts, groupNames };
  }, [filteredThreads]);

  const handleStartRename = (e: React.MouseEvent, t: ChatThread) => {
    e.stopPropagation();
    setEditingId(t.id);
    setEditValue(t.title);
  };

  const handleCommitRename = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (editingId && editValue.trim()) {
      onRenameThread(editingId, editValue.trim().toUpperCase());
    }
    setEditingId(null);
  };

  return (
    <>
      {/* Backdrop with Blur */}
      <div 
        className={`fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[2000] transition-opacity duration-500 ease-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose} 
      />

      {/* Main Drawer Panel */}
      <div className={`
        fixed inset-y-0 right-0 w-[85%] md:w-[380px] 
        bg-surface/95 backdrop-blur-2xl 
        border-l border-border 
        z-[2010] shadow-[-20px_0_50px_rgba(0,0,0,0.08)] dark:shadow-[-20px_0_50px_rgba(0,0,0,0.4)]
        transform transition-transform duration-500 cubic-bezier(0.22, 1, 0.36, 1)
        flex flex-col
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        
        {/* HEADER SECTION */}
        <div className="p-6 border-b border-border bg-surface-2/60 shrink-0 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg text-accent border border-accent/20">
                <History size={18} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="section-title text-text leading-none">Chat history</h3>
                <p className="caption text-text-muted mt-1">Total {threads.length} sessions</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 text-text-muted hover:text-text hover:bg-surface rounded-full transition-all"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex gap-2">
             <Button
                onClick={() => { onNewChat(); onClose(); }}
                variant="primary"
                size="md"
                className="flex-1 h-12"
              >
                <Plus size={16} strokeWidth={2.5} /> New chat
              </Button>
          </div>

          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent transition-colors" size={14} />
            <Input 
              type="text"
              placeholder="Search chats"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-3 pl-10 pr-4 text-sm"
            />
          </div>
        </div>

        {/* LIST CONTENT */}
        <div className="flex-1 flex flex-col min-h-0">
          {flatData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-text-muted opacity-80 space-y-4">
                  <MessageSquare size={48} strokeWidth={1} />
                  <p className="caption">No chats yet.</p>
              </div>
          ) : (
             <GroupedVirtuoso
                style={{ height: '100%', width: '100%' }}
                groupCounts={groupCounts}
                className="custom-scroll"
                groupContent={(index) => {
                    const label = groupNames[index];
                    const displayLabel =
                        label === 'PINNED'
                            ? 'Pinned'
                            : label === 'TODAY'
                                ? 'Today'
                                : label === 'YESTERDAY'
                                    ? 'Yesterday'
                                    : label === 'PREVIOUS 7 DAYS'
                                        ? 'Previous 7 days'
                                        : 'Older';
                    return (
                        <div className="flex items-center gap-3 px-6 py-2 bg-surface/95 backdrop-blur-xl border-b border-border z-10 sticky top-0">
                            <span className={`caption font-semibold ${label === 'PINNED' ? 'text-accent flex items-center gap-1' : 'text-text-muted'}`}>
                              {label === 'PINNED' && <Pin size={10} className="inline" />}
                              {displayLabel}
                            </span>
                            <div className="h-[1px] flex-1 bg-border"></div>
                        </div>
                    );
                }}
                itemContent={(index) => {
                    const t = flatData[index];
                    const isActive = activeThreadId === t.id;
                    const isEditing = editingId === t.id;
                    const ModelIcon = t.persona === 'hanisah' ? Flame : Brain;

                    return (
                        <div className="px-4 py-1">
                          <div 
                            onClick={() => { if (!isEditing) { onSelectThread(t.id); if(window.innerWidth < 768) onClose(); } }}
                            className={`
                              group relative p-3.5 rounded-[var(--radius-md)] border transition-all duration-300 cursor-pointer overflow-hidden
                              ${isActive 
                                ? 'bg-[var(--surface)] border-[color:var(--accent)]/40 shadow-[var(--shadow-bento)] ring-1 ring-[color:var(--accent)]/20' 
                                : 'bg-transparent border-transparent hover:bg-[var(--surface-2)] hover:border-[color:var(--border)]/30'
                              }
                            `}
                          >
                            {/* Active Indicator Bar */}
                            {isActive && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent shadow-[0_0_10px_var(--accent-color)]"></div>
                            )}

                            <div className="flex items-center gap-4 relative z-10">
                              {/* Icon Container */}
                              <div className={`
                                w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center shrink-0 transition-all shadow-[var(--shadow-soft)]
                                ${isActive 
                                    ? 'bg-[var(--accent)] text-[var(--text-invert)]' 
                                    : 'bg-[var(--surface-2)] text-[var(--text-muted)] group-hover:text-[var(--text)]'
                                }
                              `}>
                                 <ModelIcon size={18} />
                              </div>

                              {/* Text Content */}
                              <div className="flex-1 min-w-0">
                                {isEditing ? (
                                  <form onSubmit={handleCommitRename} className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                    <input 
                                      autoFocus
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={handleCommitRename}
                                      className="bg-transparent border-b border-accent w-full text-sm font-semibold outline-none py-1 text-text"
                                    />
                                  </form>
                                ) : (
                                  <>
                                    <div className="flex items-center justify-between mb-1">
                                        <p className={`text-sm font-semibold truncate leading-tight flex-1 pr-2 ${isActive ? 'text-text' : 'text-text-muted group-hover:text-text transition-colors'}`}>
                                          {t.title}
                                        </p>
                                        {t.isPinned && <Pin size={10} className="text-accent shrink-0" />}
                                    </div>
                                    <p className="caption text-text-muted truncate flex items-center gap-2">
                                        <span>{getRelativeTime(t.updated)}</span>
                                        <span className="w-1 h-1 rounded-full bg-border"></span>
                                        <span>{t.messages.length} MSGS</span>
                                    </p>
                                  </>
                                )}
                              </div>

                              {/* Actions (Hover Only) */}
                              {!isEditing && (
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onTogglePin(t.id); }}
                                        className={`p-1.5 rounded-lg transition-all ${t.isPinned ? 'text-accent hover:bg-accent/10' : 'text-text-muted hover:text-accent hover:bg-accent/10'}`}
                                        title={t.isPinned ? "Unpin" : "Pin to Top"}
                                    >
                                        {t.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                                    </button>
                                    <button 
                                        onClick={(e) => handleStartRename(e, t)}
                                        className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-lg transition-all"
                                        title="Rename"
                                    >
                                        <Edit3 size={14} />
                                    </button>
                                    <button 
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            if (debugService.logAction(UI_REGISTRY.CHAT_BTN_DELETE, FN_REGISTRY.CHAT_DELETE_SESSION, t.id)) {
                                                const confirmed = window.confirm(`Delete this chat?\n\nDelete "${t.title}" permanently? This cannot be undone.`);
                                                if (confirmed) {
                                                    onDeleteThread(t.id); 
                                                }
                                            }
                                        }} 
                                        className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-all"
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                              )}
                              
                              {/* Active Chevron (if strictly active and not hovering actions) */}
                              {isActive && !isEditing && (
                                  <ChevronRight size={16} className="text-accent group-hover:opacity-0 transition-opacity absolute right-4" />
                              )}
                            </div>
                          </div>
                        </div>
                    );
                }}
             />
          )}
        </div>
        
        {/* Footer Info */}
        <div className="p-4 border-t border-black/5 dark:border-white/5 bg-zinc-50/50 dark:bg-white/[0.02] text-center shrink-0">
           <p className="caption text-text-muted opacity-60">
                Local storage: {activeThreadId ? 'Active' : 'Idle'}
           </p>
        </div>
      </div>
    </>
  );
};
