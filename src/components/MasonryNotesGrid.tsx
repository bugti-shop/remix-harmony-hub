import React, { useState, useRef } from 'react';
import { Note } from '@/types/note';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Trash2, Archive } from 'lucide-react';

interface MasonryNotesGridProps {
  notes: Note[];
  onEdit: (note: Note) => void;
  onDelete?: (noteId: string) => void;
  onArchive?: (noteId: string) => void;
  isSelectionMode?: boolean;
  selectedNoteIds?: string[];
  onToggleSelection?: (noteId: string) => void;
}

// Get background color based on note type or custom color
const getNoteColor = (note: Note): string => {
  // If note has a custom color, use it
  if (note.color) return note.color;
  
  // Default colors by type
  const typeColors: Record<string, string> = {
    sticky: 'hsl(48, 100%, 67%)', // Yellow
    lined: 'hsl(210, 100%, 80%)', // Light blue
    regular: 'hsl(145, 80%, 75%)', // Light green
    
    code: 'hsl(35, 100%, 75%)', // Light orange
    voice: 'hsl(0, 80%, 75%)', // Light red
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

interface SwipeableNoteCardProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete?: (noteId: string) => void;
  onArchive?: (noteId: string) => void;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelection?: (noteId: string) => void;
}

const SwipeableNoteCard: React.FC<SwipeableNoteCardProps> = ({
  note,
  onEdit,
  onDelete,
  onArchive,
  isSelectionMode,
  isSelected,
  onToggleSelection,
}) => {
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const bgColor = getNoteColor(note);
  const plainContent = getPlainText(note.content);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isSelectionMode) return;
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = e.touches[0].clientX;
    setIsSwiping(true);
    
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isSelectionMode) return;
    currentXRef.current = e.touches[0].clientX;
    const diff = currentXRef.current - startXRef.current;
    
    // Cancel long press if movement detected
    if (Math.abs(diff) > 10 && longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    if (!isSwiping) return;
    // Limit swipe distance
    const clampedDiff = Math.max(-100, Math.min(100, diff));
    setSwipeX(clampedDiff);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    if (!isSwiping) return;
    setIsSwiping(false);
    
    // If swiped more than 60px, trigger action
    if (swipeX < -60 && onDelete) {
      onDelete(note.id);
    } else if (swipeX > 60 && onArchive) {
      onArchive(note.id);
    }
    
    setSwipeX(0);
  };

  const handleClick = () => {
    if (Math.abs(swipeX) > 10) return; // Don't trigger click during swipe
    if (isSelectionMode && onToggleSelection) {
      onToggleSelection(note.id);
    } else {
      onEdit(note);
    }
  };

  return (
    <div className="relative overflow-hidden mb-2">
      {/* Delete action (swipe left) */}
      <div 
        className={cn(
          "absolute inset-y-0 right-0 flex items-center justify-end px-4 bg-destructive",
          swipeX < -30 ? "opacity-100" : "opacity-0"
        )}
        style={{ width: Math.abs(Math.min(swipeX, 0)) }}
      >
        <Trash2 className="h-5 w-5 text-destructive-foreground" />
      </div>
      
      {/* Archive action (swipe right) */}
      <div 
        className={cn(
          "absolute inset-y-0 left-0 flex items-center justify-start px-4 bg-primary",
          swipeX > 30 ? "opacity-100" : "opacity-0"
        )}
        style={{ width: Math.max(swipeX, 0) }}
      >
        <Archive className="h-5 w-5 text-primary-foreground" />
      </div>
      
      {/* Card content */}
      <div
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={cn(
          "p-3 cursor-pointer relative",
          isSelected && "ring-2 ring-primary"
        )}
        style={{ 
          backgroundColor: bgColor,
          transform: `translateX(${swipeX}px)`,
        }}
      >
        
        {/* Title */}
        {note.title && (
          <h3 className="font-bold text-foreground text-sm leading-tight mb-1.5 line-clamp-2">
            {note.title}
          </h3>
        )}
        
        {plainContent && (
          <p className="text-foreground/80 text-xs leading-relaxed mb-2 line-clamp-4 transition-all duration-300">
            {truncateText(plainContent, 150)}
          </p>
        )}
        
        {/* Date badge */}
        <div className="inline-block">
          <span className="text-xs font-medium text-foreground/70 bg-background/30 px-2 py-0.5">
            {format(new Date(note.updatedAt), 'MM/dd/yy h:mm a')}
          </span>
        </div>
      </div>
    </div>
  );
};

export const MasonryNotesGrid: React.FC<MasonryNotesGridProps> = ({
  notes,
  onEdit,
  onDelete,
  onArchive,
  isSelectionMode = false,
  selectedNoteIds = [],
  onToggleSelection,
}) => {
  // Split notes into two columns for masonry effect
  const leftColumn: Note[] = [];
  const rightColumn: Note[] = [];
  
  notes.forEach((note, index) => {
    if (index % 2 === 0) {
      leftColumn.push(note);
    } else {
      rightColumn.push(note);
    }
  });

  const renderNoteCard = (note: Note) => (
    <SwipeableNoteCard
      key={note.id}
      note={note}
      onEdit={onEdit}
      onDelete={onDelete}
      onArchive={onArchive}
      isSelectionMode={isSelectionMode}
      isSelected={selectedNoteIds.includes(note.id)}
      onToggleSelection={onToggleSelection}
    />
  );

  if (notes.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-2">
      {/* Left column */}
      <div className="flex-1 flex flex-col">
        {leftColumn.map(renderNoteCard)}
      </div>
      
      {/* Right column */}
      <div className="flex-1 flex flex-col">
        {rightColumn.map(renderNoteCard)}
      </div>
    </div>
  );
};

export default MasonryNotesGrid;
