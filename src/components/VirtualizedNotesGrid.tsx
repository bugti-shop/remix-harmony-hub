// Virtualized Notes Grid for handling 10k+ notes efficiently
// Uses @tanstack/react-virtual for windowed rendering

import { useRef, useCallback, useMemo, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Note } from '@/types/note';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Trash2, Archive, Star } from 'lucide-react';

interface VirtualizedNotesGridProps {
  notes: Note[];
  onEdit: (note: Note) => void;
  onDelete?: (noteId: string) => void;
  onArchive?: (noteId: string) => void;
  isSelectionMode?: boolean;
  selectedNoteIds?: string[];
  onToggleSelection?: (noteId: string) => void;
  className?: string;
}

// Get background color based on note type or custom color
const getNoteColor = (note: Note): string => {
  if (note.color) return note.color;
  
  const typeColors: Record<string, string> = {
    sticky: 'hsl(48, 100%, 67%)',
    lined: 'hsl(210, 100%, 80%)',
    regular: 'hsl(145, 80%, 75%)',
    
    code: 'hsl(35, 100%, 75%)',
  };
  
  return typeColors[note.type] || 'hsl(0, 0%, 90%)';
};

// Extract plain text from HTML content
const getPlainText = (html: string): string => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

// Truncate text with ellipsis
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
};

// Memoized note card component for better performance
const VirtualNoteCard = memo(({ 
  note, 
  onEdit, 
  onDelete, 
  onArchive,
  isSelectionMode,
  isSelected,
  onToggleSelection,
}: {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete?: (noteId: string) => void;
  onArchive?: (noteId: string) => void;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelection?: (noteId: string) => void;
}) => {
  const bgColor = getNoteColor(note);
  const plainContent = useMemo(() => getPlainText(note.content), [note.content]);

  const handleClick = useCallback(() => {
    if (isSelectionMode && onToggleSelection) {
      onToggleSelection(note.id);
    } else {
      onEdit(note);
    }
  }, [isSelectionMode, onToggleSelection, onEdit, note]);

  return (
    <div
      onClick={handleClick}
      className={cn(
        "p-3 cursor-pointer relative rounded-lg",
        isSelected && "ring-2 ring-primary"
      )}
      style={{ backgroundColor: bgColor }}
    >
      {/* Favorite indicator */}
      {note.isFavorite && (
        <Star className="absolute top-2 right-2 h-4 w-4 text-yellow-500 fill-yellow-500" />
      )}
      
      {/* Title */}
      {note.title && (
        <h3 className="font-bold text-foreground text-sm leading-tight mb-1.5 line-clamp-2 pr-6">
          {note.title}
        </h3>
      )}
      
      {/* Content preview */}
      {plainContent && (
        <p className="text-foreground/80 text-xs leading-relaxed mb-2 line-clamp-3">
          {truncateText(plainContent, 100)}
        </p>
      )}
      
      {/* Date badge */}
      <div className="inline-block">
        <span className="text-xs font-medium text-foreground/70 bg-background/30 px-2 py-0.5 rounded">
          {format(new Date(note.updatedAt), 'MM/dd/yy')}
        </span>
      </div>
    </div>
  );
});

VirtualNoteCard.displayName = 'VirtualNoteCard';

// Row component for virtualized list - renders 2 notes per row (masonry style)
const VirtualRow = memo(({
  leftNote,
  rightNote,
  onEdit,
  onDelete,
  onArchive,
  isSelectionMode,
  selectedNoteIds,
  onToggleSelection,
}: {
  leftNote: Note | undefined;
  rightNote: Note | undefined;
  onEdit: (note: Note) => void;
  onDelete?: (noteId: string) => void;
  onArchive?: (noteId: string) => void;
  isSelectionMode: boolean;
  selectedNoteIds: string[];
  onToggleSelection?: (noteId: string) => void;
}) => {
  return (
    <div className="flex gap-2 px-1">
      <div className="flex-1">
        {leftNote && (
          <VirtualNoteCard
            note={leftNote}
            onEdit={onEdit}
            onDelete={onDelete}
            onArchive={onArchive}
            isSelectionMode={isSelectionMode}
            isSelected={selectedNoteIds.includes(leftNote.id)}
            onToggleSelection={onToggleSelection}
          />
        )}
      </div>
      <div className="flex-1">
        {rightNote && (
          <VirtualNoteCard
            note={rightNote}
            onEdit={onEdit}
            onDelete={onDelete}
            onArchive={onArchive}
            isSelectionMode={isSelectionMode}
            isSelected={selectedNoteIds.includes(rightNote.id)}
            onToggleSelection={onToggleSelection}
          />
        )}
      </div>
    </div>
  );
});

VirtualRow.displayName = 'VirtualRow';

export const VirtualizedNotesGrid = ({
  notes,
  onEdit,
  onDelete,
  onArchive,
  isSelectionMode = false,
  selectedNoteIds = [],
  onToggleSelection,
  className,
}: VirtualizedNotesGridProps) => {
  const parentRef = useRef<HTMLDivElement>(null);

  // Create pairs of notes for 2-column layout
  const notePairs = useMemo(() => {
    const pairs: { left: Note | undefined; right: Note | undefined }[] = [];
    for (let i = 0; i < notes.length; i += 2) {
      pairs.push({
        left: notes[i],
        right: notes[i + 1],
      });
    }
    return pairs;
  }, [notes]);

  const virtualizer = useVirtualizer({
    count: notePairs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // Estimated row height
    overscan: 5,
    getItemKey: (index) => notePairs[index]?.left?.id || index.toString(),
  });

  if (notes.length === 0) {
    return null;
  }

  return (
    <div
      ref={parentRef}
      className={cn("h-full overflow-auto", className)}
      style={{ contain: 'strict' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const pair = notePairs[virtualRow.index];
          if (!pair) return null;

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: '8px',
              }}
            >
              <VirtualRow
                leftNote={pair.left}
                rightNote={pair.right}
                onEdit={onEdit}
                onDelete={onDelete}
                onArchive={onArchive}
                isSelectionMode={isSelectionMode}
                selectedNoteIds={selectedNoteIds}
                onToggleSelection={onToggleSelection}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// List view virtualized component
export const VirtualizedNotesList = ({
  notes,
  onEdit,
  onDelete,
  onArchive,
  isSelectionMode = false,
  selectedNoteIds = [],
  onToggleSelection,
  className,
}: VirtualizedNotesGridProps) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: notes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimated row height for list view
    overscan: 10,
    getItemKey: (index) => notes[index]?.id || index.toString(),
  });

  if (notes.length === 0) {
    return null;
  }

  return (
    <div
      ref={parentRef}
      className={cn("h-full overflow-auto", className)}
      style={{ contain: 'strict' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const note = notes[virtualRow.index];
          if (!note) return null;

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: '4px',
              }}
            >
              <VirtualNoteCard
                note={note}
                onEdit={onEdit}
                onDelete={onDelete}
                onArchive={onArchive}
                isSelectionMode={isSelectionMode}
                isSelected={selectedNoteIds.includes(note.id)}
                onToggleSelection={onToggleSelection}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Utility to determine if virtualization should be used
export const shouldVirtualizeNotes = (noteCount: number): boolean => {
  return noteCount > 30;
};

export default VirtualizedNotesGrid;
