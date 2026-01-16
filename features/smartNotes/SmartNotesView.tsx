import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { type Note } from '../../types';
import { NotesListView } from './NotesListView';
import { NoteEditor } from './NoteEditor';
import { NoteAgentConsole } from './NoteAgentConsole';
import { UI_REGISTRY, FN_REGISTRY } from '../../constants/registry';
import { debugService } from '../../services/debugService';
import { cn } from '../../utils/cn';
import { Button } from '../../components/ui/Button';

interface SmartNotesViewProps {
  notes: Note[];
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
}

export const SmartNotesView: React.FC<SmartNotesViewProps> = ({ notes, setNotes }) => {
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isAgentConsoleOpen, setIsAgentConsoleOpen] = useState(false);

  // Safety check: if active note is deleted externally
  useEffect(() => {
    if (activeNoteId && !notes.find(n => n.id === activeNoteId)) {
      setActiveNoteId(null);
    }
  }, [notes, activeNoteId]);

  const activeNote = useMemo(() => notes.find(n => n.id === activeNoteId), [notes, activeNoteId]);

  // Handle note selection from list
  const handleNoteSelect = useCallback((note: Note) => {
    setActiveNoteId(note.id);
  }, []);

  // Handle saving note
  const handleSaveNote = useCallback((title: string, content: string, tasks?: any[], tags?: string[]) => {
    if (!activeNoteId) return;
    setNotes(prevNotes =>
      prevNotes.map(n =>
        n.id === activeNoteId
          ? {
              ...n,
              content,
              title: title.trim() || 'Untitled Note',
              tasks: tasks || n.tasks,
              tags: tags || n.tags,
              updated: new Date().toISOString()
            }
          : n
      )
    );
  }, [activeNoteId, setNotes]);

  // Handle back from editor
  const handleBackFromEditor = useCallback(() => {
    if (activeNoteId) {
      const current = notes.find(n => n.id === activeNoteId);
      if (current) {
        const isEmpty =
          !current.title.trim() &&
          (!current.content || current.content === '<div><br></div>') &&
          (!current.tasks || current.tasks.length === 0);
        if (isEmpty) {
          setNotes(prev => prev.filter(n => n.id !== activeNoteId));
        }
      }
    }
    setActiveNoteId(null);
  }, [activeNoteId, notes, setNotes]);

  // Handle delete note
  const handleDeleteNote = useCallback(() => {
    if (!activeNoteId) return;
    debugService.logAction(UI_REGISTRY.NOTES_BTN_DELETE_ITEM, FN_REGISTRY.NOTE_DELETE, activeNoteId);
    setNotes(prevNotes => prevNotes.filter(n => n.id !== activeNoteId));
    setActiveNoteId(null);
  }, [activeNoteId, setNotes]);

  // Handle toggle archive
  const handleToggleArchive = useCallback(() => {
    if (!activeNoteId) return;
    setNotes(prevNotes =>
      prevNotes.map(n =>
        n.id === activeNoteId ? { ...n, is_archived: !n.is_archived } : n
      )
    );
  }, [activeNoteId, setNotes]);

  // Handle toggle pin
  const handleTogglePin = useCallback(() => {
    if (!activeNoteId) return;
    setNotes(prevNotes =>
      prevNotes.map(n =>
        n.id === activeNoteId ? { ...n, is_pinned: !n.is_pinned } : n
      )
    );
  }, [activeNoteId, setNotes]);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden relative">
      {!activeNoteId ? (
        <>
          <NotesListView
            notes={notes}
            setNotes={setNotes}
            onNoteSelect={handleNoteSelect}
          />
          {/* Agent Console Button - Floating */}
          <div className="fixed bottom-24 right-6 safe-b z-40">
            <Button
              onClick={() => setIsAgentConsoleOpen(true)}
              className={cn(
                'h-12 w-12 rounded-full shadow-lg',
                'flex items-center justify-center',
                'bg-gradient-to-br from-[#8b5cf6] to-[#6366f1] text-white',
                'hover:shadow-xl hover:scale-105',
                'active:scale-95 transition-all duration-200',
                'backdrop-blur-sm border border-purple-500/30'
              )}
              aria-label="Open AI Agent Console"
            >
              <Sparkles size={20} strokeWidth={2.5} />
            </Button>
          </div>
        </>
      ) : activeNote ? (
        <NoteEditor
          noteId={activeNote.id}
          title={activeNote.title}
          content={activeNote.content}
          tasks={activeNote.tasks}
          tags={activeNote.tags}
          isArchived={activeNote.is_archived}
          isPinned={activeNote.is_pinned}
          onSave={handleSaveNote}
          onBack={handleBackFromEditor}
          onDelete={handleDeleteNote}
          onToggleArchive={handleToggleArchive}
          onTogglePin={handleTogglePin}
        />
      ) : null}

      {/* Agent Console Dialog */}
      <NoteAgentConsole
        notes={notes}
        setNotes={setNotes}
        isOpen={isAgentConsoleOpen}
        onClose={() => setIsAgentConsoleOpen(false)}
        personaMode="stoic"
      />
    </div>
  );
};
