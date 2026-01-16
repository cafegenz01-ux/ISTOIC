import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Check,
  Trash2,
  Plus,
  Archive,
  Pin,
  MoreVertical,
  Type,
  Clock
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { type TaskItem } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Dialog } from '../../components/ui/Dialog';
import { cn } from '../../utils/cn';
import { debugService } from '../../services/debugService';
import { UI_REGISTRY, FN_REGISTRY } from '../../constants/registry';

interface NoteEditorProps {
  noteId: string;
  title: string;
  content: string;
  tasks?: TaskItem[];
  tags?: string[];
  isArchived?: boolean;
  isPinned?: boolean;
  onSave: (title: string, content: string, tasks?: TaskItem[], tags?: string[]) => void;
  onBack: () => void;
  onDelete: () => void;
  onToggleArchive: () => void;
  onTogglePin: () => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  noteId,
  title,
  content,
  tasks = [],
  tags = [],
  isArchived = false,
  isPinned = false,
  onSave,
  onBack,
  onDelete,
  onToggleArchive,
  onTogglePin
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [currentTitle, setCurrentTitle] = useState(title);
  const [currentContent, setCurrentContent] = useState(content);
  const [currentTasks, setCurrentTasks] = useState<TaskItem[]>(tasks);
  const [wordCount, setWordCount] = useState(0);
  const [readTime, setReadTime] = useState(0);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Auto-save
  const performSave = useCallback(() => {
    if (editorRef.current) {
      const htmlContent = editorRef.current.innerHTML;
      onSave(currentTitle, htmlContent, currentTasks, tags);
    }
  }, [currentTitle, currentTasks, tags, onSave]);

  const triggerAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      performSave();
    }, 1000);
  }, [performSave]);

  // Update stats and sync
  useEffect(() => {
    if (editorRef.current) {
      const text = editorRef.current.innerText || '';
      const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
      setWordCount(words);
      setReadTime(Math.ceil(words / 200));
    }
  }, [currentContent]);

  // Initialize editor
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== currentContent) {
      editorRef.current.innerHTML = currentContent || '<div><br></div>';
    }
  }, []);

  // Handle editor input
  const handleEditorInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setCurrentContent(html);
      triggerAutoSave();
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setCurrentTitle(newTitle);
    triggerAutoSave();
  };

  // Task management
  const addTask = () => {
    if (!newTaskText.trim()) return;
    const newTask: TaskItem = {
      id: uuidv4(),
      text: newTaskText.trim(),
      isCompleted: false
    };
    setCurrentTasks(prev => [...prev, newTask]);
    setNewTaskText('');
    triggerAutoSave();
  };

  const toggleTask = (taskId: string) => {
    setCurrentTasks(prev =>
      prev.map(t =>
        t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t
      )
    );
    triggerAutoSave();
  };

  const deleteTask = (taskId: string) => {
    setCurrentTasks(prev => prev.filter(t => t.id !== taskId));
    triggerAutoSave();
  };

  // Handle back
  const handleBack = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    performSave();
    onBack();
  };

  // Handle delete
  const handleDelete = () => {
    setShowDeleteConfirm(false);
    onDelete();
    onBack();
  };

  const completedTasksCount = currentTasks.filter(t => t.isCompleted).length;
  const taskProgress = currentTasks.length > 0 ? (completedTasksCount / currentTasks.length) * 100 : 0;

  return (
    <div className="h-full w-full flex flex-col bg-bg overflow-hidden animate-fade-in">
      {/* Header: Minimal, tools only when needed */}
      <header className="px-4 md:px-8 pt-safe pb-3 flex-shrink-0 border-b border-border/40 bg-gradient-to-b from-surface/40 to-transparent">
        <div className="flex items-center justify-between gap-3 mb-3">
          <Button
            onClick={handleBack}
            variant="ghost"
            size="sm"
            className="h-10 w-10 p-0 rounded-lg text-text-muted hover:bg-surface"
            aria-label="Back to notes"
          >
            <ArrowLeft size={20} strokeWidth={2} />
          </Button>

          <div className="flex-1 flex items-center gap-2 text-xs text-text-muted/60">
            <Clock size={14} />
            <span>{readTime} min read</span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              onClick={onTogglePin}
              variant={isPinned ? 'primary' : 'ghost'}
              size="sm"
              className="h-10 w-10 p-0 rounded-lg"
              aria-label={isPinned ? 'Unpin note' : 'Pin note'}
            >
              <Pin size={18} strokeWidth={1.8} fill={isPinned ? 'currentColor' : 'none'} />
            </Button>

            <Button
              onClick={onToggleArchive}
              variant="ghost"
              size="sm"
              className="h-10 w-10 p-0 rounded-lg text-text-muted hover:bg-surface"
              aria-label={isArchived ? 'Unarchive' : 'Archive'}
            >
              <Archive size={18} strokeWidth={1.8} />
            </Button>

            <div className="relative">
              <Button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                variant="ghost"
                size="sm"
                className="h-10 w-10 p-0 rounded-lg text-text-muted hover:bg-surface"
                aria-label="More options"
              >
                <MoreVertical size={18} strokeWidth={1.8} />
              </Button>

              {showMoreMenu && (
                <Card
                  padding="sm"
                  className="absolute top-full right-0 mt-1 w-40 border-border/60 shadow-lg rounded-lg z-50"
                >
                  <Button
                    onClick={() => {
                      setShowDeleteConfirm(true);
                      setShowMoreMenu(false);
                    }}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-danger hover:bg-danger/10 text-sm"
                  >
                    <Trash2 size={16} /> Delete
                  </Button>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* Title Input: Large, readable */}
        <input
          ref={titleRef}
          type="text"
          value={currentTitle}
          onChange={handleTitleChange}
          placeholder="Untitled note"
          className={cn(
            'w-full bg-transparent text-2xl md:text-3xl font-black',
            'text-text placeholder:text-text-muted/40',
            'outline-none focus:ring-0 border-none',
            'tracking-tight resize-none'
          )}
        />
      </header>

      {/* Main Content: Full-width, reading-first */}
      <div className="flex-1 overflow-y-auto">
        {/* Tasks Section (if any) */}
        {currentTasks.length > 0 && (
          <div className="px-4 md:px-8 pt-4 pb-2 border-b border-border/40">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Tasks</h3>
              <span className="text-xs text-text-muted/60">
                {completedTasksCount} of {currentTasks.length}
              </span>
            </div>

            {/* Task Progress */}
            <div className="h-1 w-full bg-surface rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${taskProgress}%` }}
              />
            </div>

            {/* Task List */}
            <div className="space-y-2">
              {currentTasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={cn(
                    'w-full flex items-start gap-3 p-2 rounded-lg',
                    'transition-colors hover:bg-surface-2/50 active:bg-surface-2',
                    'text-left focus:outline-none focus:ring-2 focus:ring-accent/50'
                  )}
                >
                  <div
                    className={cn(
                      'w-5 h-5 rounded-md border-2 flex-shrink-0 mt-0.5',
                      'flex items-center justify-center transition-colors',
                      task.isCompleted
                        ? 'bg-accent border-accent text-text-invert'
                        : 'border-border text-transparent'
                    )}
                  >
                    {task.isCompleted && <Check size={14} strokeWidth={3} />}
                  </div>
                  <span
                    className={cn(
                      'text-sm flex-1',
                      task.isCompleted
                        ? 'line-through text-text-muted/50'
                        : 'text-text'
                    )}
                  >
                    {task.text}
                  </span>
                  <Button
                    onClick={e => {
                      e.stopPropagation();
                      deleteTask(task.id);
                    }}
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-text-muted hover:text-danger hover:bg-danger/10"
                  >
                    <Trash2 size={14} />
                  </Button>
                </button>
              ))}
            </div>

            {/* Add Task Input */}
            <div className="flex gap-2 mt-3">
              <input
                type="text"
                value={newTaskText}
                onChange={e => setNewTaskText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTask();
                  }
                }}
                placeholder="Add a task..."
                className={cn(
                  'flex-1 bg-surface border border-border/60 rounded-lg px-3 py-2',
                  'text-sm text-text placeholder:text-text-muted/50',
                  'outline-none focus:ring-2 focus:ring-accent/50 focus:border-transparent'
                )}
              />
              <Button
                onClick={addTask}
                variant="secondary"
                size="sm"
                className="h-9 w-9 p-0"
              >
                <Plus size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* Editor: Large, comfortable text */}
        <div
          ref={editorRef}
          contentEditable={!isArchived}
          suppressContentEditableWarning
          onInput={handleEditorInput}
          className={cn(
            'px-4 md:px-8 py-6 text-base leading-relaxed',
            'text-text focus:outline-none',
            'prose prose-invert max-w-none',
            'min-h-full',
            isArchived ? 'pointer-events-none opacity-75' : ''
          )}
          style={{
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            whiteSpace: 'pre-wrap'
          }}
        />
      </div>

      {/* Footer: Metadata (subtle) */}
      <footer className="px-4 md:px-8 py-3 pb-safe border-t border-border/40 bg-gradient-to-t from-surface/40 to-transparent text-xs text-text-muted/60 flex justify-between">
        <span>{wordCount} words</span>
        <span>{new Date().toLocaleDateString()}</span>
      </footer>

      {/* Delete Confirmation */}
      <Dialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete note"
        size="sm"
        footer={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="font-semibold text-text">Delete "{currentTitle || 'Untitled note'}"?</p>
          <p className="text-sm text-text-muted">This cannot be undone.</p>
        </div>
      </Dialog>
    </div>
  );
};
