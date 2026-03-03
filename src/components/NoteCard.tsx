import { useState, useRef, useEffect } from 'react';
import { AppTag, getAllTags } from '@/utils/tagStorage';
import { useTranslation } from 'react-i18next';
import { Note } from '@/types/note';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Edit, Mic, FileText, Pen, Pin, FileCode, GitBranch, AlignLeft, Archive, Star, Check, Copy, EyeOff, Shield, Lock, FolderInput, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { getNoteProtection, NoteProtection } from '@/utils/noteProtection';
import { getSetting } from '@/utils/settingsStorage';
import { logActivity } from '@/utils/activityLogger';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NoteCardProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
  onArchive?: (id: string) => void;
  onTogglePin?: (noteId: string, e: React.MouseEvent) => void;
  onToggleFavorite?: (noteId: string) => void;
  onMoveToFolder?: (noteId: string) => void;
  onDragStart?: (e: React.DragEvent, noteId: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, targetNoteId: string) => void;
  onDragEnd?: () => void;
  // Selection mode props
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (noteId: string) => void;
  // Duplicate
  onDuplicate?: (noteId: string) => void;
  // Hide/Protect
  onHide?: (noteId: string) => void;
  onProtect?: (noteId: string) => void;
}

const STICKY_COLORS = {
  yellow: 'hsl(var(--sticky-yellow))',
  blue: 'hsl(var(--sticky-blue))',
  green: 'hsl(var(--sticky-green))',
  pink: 'hsl(var(--sticky-pink))',
  orange: 'hsl(var(--sticky-orange))',
};

const RANDOM_COLORS = [
  'hsl(330, 100%, 75%)',
  'hsl(160, 70%, 70%)',
  'hsl(280, 70%, 75%)',
  'hsl(20, 95%, 75%)',
  'hsl(140, 65%, 70%)',
  'hsl(350, 80%, 75%)',
  'hsl(45, 90%, 75%)',
  'hsl(270, 65%, 75%)',
  'hsl(200, 80%, 70%)',
  'hsl(60, 90%, 75%)',
];

export const NoteCard = ({ note, onEdit, onDelete, onArchive, onTogglePin, onToggleFavorite, onMoveToFolder, onDragStart, onDragOver, onDrop, onDragEnd, isSelectionMode = false, isSelected = false, onToggleSelection, onDuplicate, onHide, onProtect }: NoteCardProps) => {
  const { t } = useTranslation();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [noteProtection, setNoteProtection] = useState<NoteProtection>({ hasPassword: false, useBiometric: false });
  const [noteTags, setNoteTags] = useState<AppTag[]>([]);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const swipeStartX = useRef<number | null>(null);

  // Load protection status async
  useEffect(() => {
    getNoteProtection(note.id).then(setNoteProtection);
  }, [note.id]);

  // Load tags for this note
  useEffect(() => {
    if (note.tagIds && note.tagIds.length > 0) {
      getAllTags().then(allTags => {
        setNoteTags(allTags.filter(t => note.tagIds!.includes(t.id)));
      });
    } else {
      setNoteTags([]);
    }
  }, [note.tagIds]);

  const isSticky = note.type === 'sticky';
  const isLined = note.type === 'lined';
  
  const SWIPE_THRESHOLD = 60;
  const SWIPE_ACTION_WIDTH = 70; // Width per action button

  const getHapticStyle = () => {
    // Default intensity, actual value is loaded from IndexedDB on app init
    const intensity: string = 'medium';
    switch (intensity) {
      case 'off': return null;
      case 'light': return ImpactStyle.Light;
      case 'heavy': return ImpactStyle.Heavy;
      default: return ImpactStyle.Medium;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    isLongPress.current = false;
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    touchStartPos.current = { x: touchX, y: touchY };
    swipeStartX.current = touchX;
    
    longPressTimerRef.current = setTimeout(async () => {
      if (!isSwiping) {
        isLongPress.current = true;
        const hapticStyle = getHapticStyle();
        if (hapticStyle) {
          try {
            await Haptics.impact({ style: hapticStyle });
          } catch (error) {
            console.log('Haptics not available');
          }
        }
        setShowContextMenu(true);
      }
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current || !swipeStartX.current) return;
    
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - swipeStartX.current;
    const deltaY = Math.abs(currentY - touchStartPos.current.y);
    
    // If vertical movement is greater, don't swipe (user is scrolling)
    if (deltaY > 30 && !isSwiping) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      return;
    }
    
      // Start swiping if horizontal movement exceeds threshold
      if (Math.abs(deltaX) > 15) {
        setIsSwiping(true);
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        // Limit swipe distance - allow 2 actions on left (140px), 3 on right (210px)
        const maxSwipeRight = SWIPE_ACTION_WIDTH * 2; // Favorite + Pin
        const maxSwipeLeft = SWIPE_ACTION_WIDTH * 3; // Archive + Delete + Move
        setSwipeOffset(Math.max(-maxSwipeLeft, Math.min(maxSwipeRight, deltaX)));
      }
  };

  const handleTouchEnd = async () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    
    // Don't auto-trigger actions - let user tap the revealed buttons
    // Just snap back or stay revealed based on swipe distance
    if (isSwiping) {
      const hapticStyle = getHapticStyle();
      const maxSwipeRight = SWIPE_ACTION_WIDTH * 2;
      const maxSwipeLeft = SWIPE_ACTION_WIDTH * 3;
      
      if (swipeOffset > SWIPE_THRESHOLD) {
        // Snap to reveal left actions (Favorite + Pin)
        if (hapticStyle) {
          try { await Haptics.impact({ style: hapticStyle }); } catch (error) {}
        }
        setSwipeOffset(maxSwipeRight);
        setIsSwiping(false);
        touchStartPos.current = null;
        swipeStartX.current = null;
        return;
      } else if (swipeOffset < -SWIPE_THRESHOLD) {
        // Snap to reveal right actions (Archive + Delete + Move)
        if (hapticStyle) {
          try { await Haptics.impact({ style: hapticStyle }); } catch (error) {}
        }
        setSwipeOffset(-maxSwipeLeft);
        setIsSwiping(false);
        touchStartPos.current = null;
        swipeStartX.current = null;
        return;
      }
    }
    
    setSwipeOffset(0);
    setIsSwiping(false);
    touchStartPos.current = null;
    swipeStartX.current = null;
  };
  
  // Action handlers that reset swipe after action
  const handleSwipeAction = async (action: () => void) => {
    const hapticStyle = getHapticStyle();
    if (hapticStyle) {
      try { await Haptics.impact({ style: hapticStyle }); } catch (error) {}
    }
    action();
    setSwipeOffset(0);
  };

  const handleClick = () => {
    if (isSelectionMode && onToggleSelection) {
      onToggleSelection(note.id);
      return;
    }
    if (!isLongPress.current && !showContextMenu && !isSwiping) {
      onEdit(note);
    }
  };

  const getCardColor = () => {
    if (isSticky && note.color) {
      return STICKY_COLORS[note.color];
    }
    // Use custom color if set for non-sticky notes
    if (note.customColor) {
      return note.customColor;
    }
    const index = note.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return RANDOM_COLORS[index % RANDOM_COLORS.length];
  };

  const cardStyle = { backgroundColor: getCardColor() };

  const getTypeBadge = () => {
    // Check for voice note type first
    if (note.type === 'voice') {
      return { icon: Mic, label: 'Voice' };
    }
    // Also show mic badge if any voice recordings exist
    if (note.voiceRecordings && note.voiceRecordings.length > 0) {
      return { icon: Mic, label: 'Audio File' };
    }
    switch (note.type) {
      case 'sketch':
        return { icon: Pen, label: 'Sketch' };
      case 'sticky':
        return { icon: StickyNote, label: 'Sticky' };
      case 'lined':
        return { icon: AlignLeft, label: 'Lined' };
      case 'code':
        return { icon: FileCode, label: 'Code' };
      case 'linkedin':
        return { icon: FileText, label: 'LinkedIn' };
      case 'textformat':
        return { icon: FileText, label: 'Text Format' };
      case 'regular':
      default:
        return { icon: FileText, label: 'Regular' };
    }
  };

  const badge = getTypeBadge();
  const BadgeIcon = badge.icon;

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Swipe action backgrounds */}
      <div className="absolute inset-0 flex">
        {/* Left side actions - Favorite + Pin (swipe right reveals) */}
        <div 
          className="flex items-center justify-start w-1/2"
          style={{ opacity: swipeOffset > 0 ? 1 : 0 }}
        >
          <button
            onClick={() => onToggleFavorite && handleSwipeAction(() => onToggleFavorite(note.id))}
            className="flex flex-col items-center justify-center w-[70px] h-full bg-warning text-warning-foreground"
          >
            <Star className={cn("h-5 w-5", note.isFavorite && "fill-current")} />
            <span className="text-[10px] font-medium mt-1">Favorite</span>
          </button>
          <button
            onClick={(e) => onTogglePin && handleSwipeAction(() => onTogglePin(note.id, e))}
            className="flex flex-col items-center justify-center w-[70px] h-full bg-info text-info-foreground"
          >
            <Pin className={cn("h-5 w-5", note.isPinned && "fill-current")} />
            <span className="text-[10px] font-medium mt-1">Pin</span>
          </button>
        </div>
        {/* Right side actions - Archive + Delete + Move (swipe left reveals) */}
        <div 
          className="flex items-center justify-end w-1/2 ml-auto"
          style={{ opacity: swipeOffset < 0 ? 1 : 0 }}
        >
          <button
            onClick={() => onMoveToFolder && handleSwipeAction(() => onMoveToFolder(note.id))}
            className="flex flex-col items-center justify-center w-[70px] h-full bg-primary text-primary-foreground"
          >
            <FolderInput className="h-5 w-5" />
            <span className="text-[10px] font-medium mt-1">Move</span>
          </button>
          <button
            onClick={() => handleSwipeAction(() => onDelete(note.id))}
            className="flex flex-col items-center justify-center w-[70px] h-full bg-destructive text-destructive-foreground"
          >
            <Trash2 className="h-5 w-5" />
            <span className="text-[10px] font-medium mt-1">Delete</span>
          </button>
          {onArchive && (
            <button
              onClick={() => handleSwipeAction(() => onArchive(note.id))}
              className="flex flex-col items-center justify-center w-[70px] h-full bg-muted-foreground text-background"
            >
              <Archive className="h-5 w-5" />
              <span className="text-[10px] font-medium mt-1">Archive</span>
            </button>
          )}
        </div>
      </div>

      <Card
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        draggable={!!onDragStart}
        onDragStart={onDragStart ? (e) => onDragStart(e, note.id) : undefined}
        onDragOver={onDragOver}
        onDrop={onDrop ? (e) => onDrop(e, note.id) : undefined}
        onDragEnd={onDragEnd}
        className={cn(
          'group relative overflow-hidden cursor-pointer',
          'w-full hover:shadow-md border border-border/50',
          isSwiping ? '' : 'transition-transform duration-200',
          isSelected && 'ring-2 ring-primary ring-offset-2'
        )}
        style={{ 
          ...cardStyle,
          transform: `translateX(${swipeOffset}px)`,
        }}
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            {/* Selection checkbox */}
            {isSelectionMode && (
              <div 
                className={cn(
                  "h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 mr-2",
                  isSelected ? "bg-primary border-primary" : "border-black/40 bg-white/50"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelection?.(note.id);
                }}
              >
                {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
              </div>
            )}
          {note.title && (
              <h3 className="font-semibold text-base line-clamp-1 text-black flex-1">{note.title}</h3>
            )}
            {note.isPinned && (
              <Pin className="h-4 w-4 text-warning fill-warning shrink-0" />
            )}
            {note.isFavorite && (
              <Star className="h-4 w-4 text-warning fill-warning shrink-0" />
            )}
            {(noteProtection.hasPassword || noteProtection.useBiometric) && (
              <Lock className="h-4 w-4 text-primary shrink-0" />
            )}
          </div>

          {/* Show metaDescription if available, otherwise show content preview */}
          {note.type === 'sketch' ? (
            <div className="flex items-center gap-2 text-sm text-black/50 mb-3 italic">
              <Pen className="h-4 w-4" />
              <span>Sketch drawing</span>
            </div>
          ) : (note.metaDescription || note.content) && (
            <p className="text-sm text-black/70 mb-3 line-clamp-2 transition-all duration-300">
              {note.metaDescription || note.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()}
            </p>
          )}

          {/* Tags display */}
          {noteTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {noteTags.slice(0, 3).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full font-medium text-white"
                  style={{ backgroundColor: `hsl(${tag.color})` }}
                >
                  {tag.icon && <span className="text-[9px]">{tag.icon}</span>}
                  {tag.name}
                </span>
              ))}
              {noteTags.length > 3 && (
                <span className="text-[10px] text-black/50">+{noteTags.length - 3}</span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 text-xs text-black/60">
            <span>
              {new Date(note.updatedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              })} • {new Date(note.updatedAt).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              })}
            </span>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white text-xs font-medium text-black">
              <BadgeIcon className="h-3 w-3" />
              <span>{badge.label}</span>
            </div>
          </div>
        </div>
      </Card>

      <DropdownMenu open={showContextMenu} onOpenChange={setShowContextMenu}>
        <DropdownMenuTrigger asChild>
          <span className="sr-only">Open menu</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48 z-50 bg-background border border-border shadow-lg">
          <DropdownMenuItem onClick={() => { setShowContextMenu(false); onEdit(note); }} className="gap-2">
            <Edit className="h-4 w-4" />
            {t('common.edit')}
          </DropdownMenuItem>
          {onTogglePin && (
            <DropdownMenuItem onClick={(e) => { setShowContextMenu(false); onTogglePin(note.id, e as any); }} className="gap-2">
              <Pin className={cn("h-4 w-4", note.isPinned && "fill-current")} />
              {note.isPinned ? t('notes.unpin') : t('notes.pin')}
            </DropdownMenuItem>
          )}
          {onToggleFavorite && (
            <DropdownMenuItem onClick={() => { setShowContextMenu(false); onToggleFavorite(note.id); }} className="gap-2">
              <Star className={cn("h-4 w-4", note.isFavorite && "fill-warning text-warning")} />
              {note.isFavorite ? t('notes.removeFromFavorites', 'Remove from Favorites') : t('notes.addToFavorites', 'Add to Favorites')}
            </DropdownMenuItem>
          )}
          {onArchive && (
            <DropdownMenuItem onClick={() => { setShowContextMenu(false); onArchive(note.id); }} className="gap-2">
              <Archive className="h-4 w-4" />
              {t('notes.archive')}
            </DropdownMenuItem>
          )}
          {onDuplicate && (
            <DropdownMenuItem onClick={() => { setShowContextMenu(false); onDuplicate(note.id); }} className="gap-2">
              <Copy className="h-4 w-4" />
              {t('common.duplicate')}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {onHide && (
            <DropdownMenuItem onClick={() => { setShowContextMenu(false); onHide(note.id); }} className="gap-2">
              <EyeOff className="h-4 w-4" />
              {t('notes.hideNote', 'Hide Note')}
            </DropdownMenuItem>
          )}
          {onProtect && (
            <DropdownMenuItem onClick={() => { setShowContextMenu(false); onProtect(note.id); }} className="gap-2">
              <Shield className="h-4 w-4" />
              {noteProtection.hasPassword || noteProtection.useBiometric ? t('notes.changeProtection', 'Change Protection') : t('notes.protectNote', 'Protect Note')}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => { setShowContextMenu(false); onDelete(note.id); }} className="gap-2 text-destructive">
            <Trash2 className="h-4 w-4" />
            {t('notes.moveToTrash')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
