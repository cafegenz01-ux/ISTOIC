import React from 'react';
import { Archive, Trash2, Pin, PinOff, X, Check } from 'lucide-react';
import { type Note } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { cn } from '../../utils/cn';
import { debugService } from '../../services/debugService';
import { UI_REGISTRY, FN_REGISTRY } from '../../constants/registry';

interface NoteBatchActionsProps {
  selectedIds: Set<string>;
  notes: Note[];
  onDeselectAll: () => void;
  onBatchArchive: (ids: string[]) => void;
  onBatchDelete: (ids: string[]) => void;
  onBatchPin: (ids: string[]) => void;
  onBatchUnpin: (ids: string[]) => void;
}

export const NoteBatchActions: React.FC<NoteBatchActionsProps> = ({
  selectedIds,
  notes,
  onDeselectAll,
  onBatchArchive,
  onBatchDelete,
  onBatchPin,
  onBatchUnpin,
}) => {
  const selectedCount = selectedIds.size;
  const selectedNotes = notes.filter(n => selectedIds.has(n.id));
  const allPinned = selectedNotes.every(n => n.is_pinned);
  const allArchived = selectedNotes.every(n => n.is_archived);

  if (selectedCount === 0) return null;

  const handleArchive = () => {
    debugService.logAction(UI_REGISTRY.NOTES_BTN_ARCHIVE_ITEM, FN_REGISTRY.NOTE_BATCH_ACTION, `ARCHIVE_${selectedCount}`);
    onBatchArchive(Array.from(selectedIds));
    onDeselectAll();
  };

  const handleDelete = () => {
    if (window.confirm(`Delete ${selectedCount} note${selectedCount > 1 ? 's' : ''}? This cannot be undone.`)) {
      debugService.logAction(UI_REGISTRY.NOTES_BTN_DELETE_ITEM, FN_REGISTRY.NOTE_BATCH_ACTION, `DELETE_${selectedCount}`);
      onBatchDelete(Array.from(selectedIds));
      onDeselectAll();
    }
  };

  const handlePin = () => {
    debugService.logAction(UI_REGISTRY.NOTES_BTN_PIN_ITEM, FN_REGISTRY.NOTE_BATCH_ACTION, `PIN_${selectedCount}`);
    onBatchPin(Array.from(selectedIds));
    onDeselectAll();
  };

  const handleUnpin = () => {
    debugService.logAction(UI_REGISTRY.NOTES_BTN_PIN_ITEM, FN_REGISTRY.NOTE_BATCH_ACTION, `UNPIN_${selectedCount}`);
    onBatchUnpin(Array.from(selectedIds));
    onDeselectAll();
  };

  return (
    <Card
      padding="md"
      bento
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'animate-slide-up shadow-[var(--shadow-strong)]',
        'border-border/60 bg-surface/95 backdrop-blur-xl',
        'max-w-md w-[calc(100%-2rem)]',
        'safe-b'
      )}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Selection Count */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Check size={16} className="text-accent" />
          </div>
          <span className="section-title text-text">
            {selectedCount} selected
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {allPinned ? (
            <Button
              onClick={handleUnpin}
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-text-muted hover:bg-surface-2 hover:text-text"
              aria-label="Unpin selected"
            >
              <PinOff size={16} strokeWidth={1.8} />
            </Button>
          ) : (
            <Button
              onClick={handlePin}
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-text-muted hover:bg-surface-2 hover:text-text"
              aria-label="Pin selected"
            >
              <Pin size={16} strokeWidth={1.8} />
            </Button>
          )}

          <Button
            onClick={handleArchive}
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-text-muted hover:bg-surface-2 hover:text-text"
            aria-label={allArchived ? 'Unarchive selected' : 'Archive selected'}
          >
            <Archive size={16} strokeWidth={1.8} />
          </Button>

          <Button
            onClick={handleDelete}
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-text-muted hover:bg-danger/10 hover:text-danger"
            aria-label="Delete selected"
          >
            <Trash2 size={16} strokeWidth={1.8} />
          </Button>

          <Button
            onClick={onDeselectAll}
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-text-muted hover:bg-surface-2 hover:text-text"
            aria-label="Deselect all"
          >
            <X size={16} strokeWidth={1.8} />
          </Button>
        </div>
      </div>
    </Card>
  );
};
