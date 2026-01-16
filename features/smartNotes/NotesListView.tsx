import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Plus, Archive, Trash2, Check } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { type Note } from '../../types';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Card } from '../../components/ui/Card';
import { cn } from '../../utils/cn';
import { debugService } from '../../services/debugService';
import { UI_REGISTRY, FN_REGISTRY } from '../../constants/registry';
import { NoteBatchActions } from './NoteBatchActions';

interface NotesListViewProps {
  notes: Note[];
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
  onNoteSelect: (note: Note) => void;
}

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else if (diffDays < 30) {
    return `${Math.floor(diffDays / 7)}w ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
};

const stripHtml = (html: string): string => {
  return html.replace(/<[^>]*>/g, ' ').trim();
};

export const NotesListView: React.FC<NotesListViewProps> = ({ notes, setNotes, onNoteSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'active' | 'archived'>('active');
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Filter and sort notes
  const filteredNotes = useMemo(() => {
    return notes
      .filter(n => {
        const matchesSearch =
          n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          stripHtml(n.content).toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesFilter = filterType === 'archived' ? n.is_archived : !n.is_archived;
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        // Pinned notes first
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        // Then by most recently updated
        return new Date(b.updated).getTime() - new Date(a.updated).getTime();
      });
  }, [notes, searchQuery, filterType]);

  const handleCreateNote = () => {
    debugService.logAction(UI_REGISTRY.NOTES_BTN_CREATE, FN_REGISTRY.NOTE_CREATE, 'NEW_NOTE');
    const newNote: Note = {
      id: uuidv4(),
      title: '',
      content: '',
      tags: [],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      tasks: [],
      is_pinned: false,
      is_archived: false
    };
    setNotes(prev => [newNote, ...prev]);
    onNoteSelect(newNote);
  };

  const handleNoteClick = (note: Note) => {
    if (isSelectionMode) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(note.id)) {
          next.delete(note.id);
        } else {
          next.add(note.id);
        }
        return next;
      });
    } else {
      debugService.logAction(UI_REGISTRY.NOTES_CARD_ITEM, FN_REGISTRY.NOTE_UPDATE, 'OPEN_EDITOR');
      onNoteSelect(note);
    }
  };

  const handleToggleSelection = (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const handleBatchArchive = (ids: string[]) => {
    setNotes(prev => prev.map(n => ids.includes(n.id) ? { ...n, is_archived: true } : n));
  };

  const handleBatchDelete = (ids: string[]) => {
    setNotes(prev => prev.filter(n => !ids.includes(n.id)));
  };

  const handleBatchPin = (ids: string[]) => {
    setNotes(prev => prev.map(n => ids.includes(n.id) ? { ...n, is_pinned: true } : n));
  };

  const handleBatchUnpin = (ids: string[]) => {
    setNotes(prev => prev.map(n => ids.includes(n.id) ? { ...n, is_pinned: false } : n));
  };

  const initiateDelete = (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    setNoteToDelete(noteId);
  };

  const confirmDelete = () => {
    if (!noteToDelete) return;
    debugService.logAction(UI_REGISTRY.NOTES_BTN_DELETE_ITEM, FN_REGISTRY.NOTE_DELETE, noteToDelete);
    setNotes(prev => prev.filter(n => n.id !== noteToDelete));
    setNoteToDelete(null);
  };

  const handleToggleArchive = (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    setNotes(prev =>
      prev.map(n =>
        n.id === noteId ? { ...n, is_archived: !n.is_archived } : n
      )
    );
  };

  const handleTogglePin = (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    setNotes(prev =>
      prev.map(n =>
        n.id === noteId ? { ...n, is_pinned: !n.is_pinned } : n
      )
    );
  };

  const noteToDeleteTitle = useMemo(() => {
    const note = notes.find(n => n.id === noteToDelete);
    return note?.title || 'Untitled note';
  }, [noteToDelete, notes]);

  const isSearching = searchQuery.trim().length > 0;
  const hasNotes = filteredNotes.length > 0;

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-bg animate-fade-in">
      {/* Header: Minimal, calm */}
      <header className="px-4 md:px-8 pt-safe pb-4 flex-shrink-0 border-b border-border/40 bg-gradient-to-b from-surface/40 to-transparent">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-text">Notes</h1>
            <p className="caption text-text-muted mt-1">
              {filterType === 'archived' ? 'Archived' : 'Active'}
              {filteredNotes.length > 0 && ` • ${filteredNotes.length}`}
              {isSelectionMode && selectedIds.size > 0 && ` • ${selectedIds.size} selected`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSelectionMode ? (
              <Button
                onClick={handleDeselectAll}
                variant="secondary"
                size="sm"
                className="h-10 px-3 rounded-full"
                aria-label="Exit selection mode"
              >
                Cancel
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => setIsSelectionMode(true)}
                  variant="secondary"
                  size="sm"
                  className="h-10 px-3 rounded-full"
                  aria-label="Select notes"
                >
                  Select
                </Button>
                <Button
                  onClick={() => setFilterType(filterType === 'active' ? 'archived' : 'active')}
                  variant={filterType === 'archived' ? 'primary' : 'secondary'}
                  size="sm"
                  className="h-10 px-3 rounded-full"
                  aria-label={filterType === 'active' ? 'Show archived notes' : 'Show active notes'}
                >
                  <Archive size={16} />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Search: Simple and focused */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
          <Input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search notes..."
            className="pl-10 h-10 rounded-xl bg-surface border border-border/60 placeholder:text-text-muted/60"
          />
        </div>
      </header>

      {/* Notes List: Vertical, minimal spacing */}
      <div className="flex-1 overflow-y-auto">
        {hasNotes ? (
          <div className="divide-y divide-border/40">
            {filteredNotes.map((note, index) => {
              const excerpt = stripHtml(note.content).slice(0, 90);
              const hasExcerpt = excerpt.length > 0;

              return (
                <button
                  key={note.id}
                  onClick={() => handleNoteClick(note)}
                  className={cn(
                    'w-full px-4 md:px-8 py-4 text-left transition-colors hover:bg-surface-2/50 active:bg-surface-2',
                    'border-none focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-inset',
                    isSelectionMode && selectedIds.has(note.id) && 'bg-accent/10 border-l-2 border-accent'
                  )}
                  aria-label={`Open note: ${note.title || 'Untitled note'}`}
                  aria-selected={isSelectionMode ? selectedIds.has(note.id) : undefined}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Selection Checkbox */}
                    {isSelectionMode && (
                      <div className="flex-shrink-0 mt-1">
                        <button
                          onClick={e => handleToggleSelection(e, note.id)}
                          className={cn(
                            'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                            selectedIds.has(note.id)
                              ? 'bg-accent border-accent'
                              : 'border-border hover:border-accent/50'
                          )}
                          aria-label={selectedIds.has(note.id) ? 'Deselect' : 'Select'}
                        >
                          {selectedIds.has(note.id) && (
                            <Check size={14} className="text-text-invert" strokeWidth={3} />
                          )}
                        </button>
                      </div>
                    )}
                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 mb-1">
                        <h3 className="text-base font-semibold tracking-tight text-text truncate">
                          {note.title || 'Untitled note'}
                        </h3>
                        {note.is_pinned && (
                          <span className="text-xs font-medium text-accent flex-shrink-0">📌</span>
                        )}
                      </div>

                      {hasExcerpt && (
                        <p className="text-sm text-text-muted/80 line-clamp-2 mb-2">
                          {excerpt}
                          {excerpt.length >= 90 ? '…' : ''}
                        </p>
                      )}

                      <p className="text-xs text-text-muted/60">
                        {formatDate(note.updated)}
                      </p>
                    </div>

                    {/* Actions: Touch-friendly, hidden on hover fallback */}
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <Button
                        onClick={e => handleToggleArchive(e, note.id)}
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 text-text-muted hover:bg-surface hover:text-text"
                        aria-label={note.is_archived ? 'Unarchive' : 'Archive'}
                      >
                        <Archive size={16} strokeWidth={1.8} />
                      </Button>
                      <Button
                        onClick={e => initiateDelete(e, note.id)}
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 text-text-muted hover:bg-danger/10 hover:text-danger"
                        aria-label="Delete"
                      >
                        <Trash2 size={16} strokeWidth={1.8} />
                      </Button>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* Empty State: Calm and encouraging */
          <div className="h-full flex flex-col items-center justify-center px-4 pb-32">
            <div className="max-w-md text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-surface border border-border flex items-center justify-center text-text-muted">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5V4h14m0 0V2M5 4v2m14 0H5" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text mb-1">
                  {isSearching ? 'No notes found' : 'No notes yet'}
                </h2>
                <p className="text-sm text-text-muted/80">
                  {isSearching
                    ? 'Try different search terms.'
                    : filterType === 'archived'
                    ? 'Your archived notes will appear here.'
                    : 'Create your first note to begin.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Button: Calm, bottom-right, safe-area aware */}
      <div className="fixed bottom-6 right-6 safe-pb">
        <Button
          onClick={handleCreateNote}
          className={cn(
            'h-14 w-14 rounded-full shadow-lg',
            'flex items-center justify-center',
            'bg-accent text-text-invert hover:shadow-xl',
            'active:scale-95 transition-all duration-200',
            'backdrop-blur-sm'
          )}
          aria-label="Create new note"
        >
          <Plus size={24} strokeWidth={2.5} />
        </Button>
      </div>

      {/* Batch Actions Bar */}
      {isSelectionMode && (
        <NoteBatchActions
          selectedIds={selectedIds}
          notes={notes}
          onDeselectAll={handleDeselectAll}
          onBatchArchive={handleBatchArchive}
          onBatchDelete={handleBatchDelete}
          onBatchPin={handleBatchPin}
          onBatchUnpin={handleBatchUnpin}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(noteToDelete)}
        onClose={() => setNoteToDelete(null)}
        title="Delete note"
        size="sm"
        footer={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setNoteToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="font-semibold text-text">Remove "{noteToDeleteTitle}"?</p>
          <p className="text-sm text-text-muted">This action cannot be undone.</p>
        </div>
      </Dialog>
    </div>
  );
};
