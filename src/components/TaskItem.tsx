import { useState, useRef, useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { TodoItem, Priority } from '@/types/note';
import { useGlobalTags } from '@/hooks/useGlobalTags';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronRight, Repeat, Tag, Play, Pause, Link, Lock, Pin, Trash2, FolderInput, Calendar, Check as CheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { WaveformProgressBar } from './WaveformProgressBar';
import { canCompleteTask } from './TaskDependencySheet';
import { getRepeatLabel } from '@/utils/recurringTasks';
import { TASK_CIRCLE, TASK_CHECK_ICON, TASK_COMPLETION_DELAY, TASK_HAPTIC_DOUBLE_TAP_DELAY } from '@/utils/taskItemStyles';
import { ResolvedTaskImage } from './ResolvedTaskImage';
import { resolveTaskMediaUrl } from '@/utils/todoItemsStorage';
import { TaskStatusBadge } from './TaskStatusBadge';
import { usePriorities } from '@/hooks/usePriorities';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TaskItemProps {
  item: TodoItem;
  level?: number;
  onUpdate: (itemId: string, updates: Partial<TodoItem>) => void;
  onDelete: (itemId: string) => void;
  onTaskClick: (item: TodoItem) => void;
  onImageClick: (imageUrl: string) => void;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onSelect?: (itemId: string) => void;
  expandedTasks?: Set<string>;
  onToggleSubtasks?: (taskId: string) => void;
  onUpdateSubtask?: (parentId: string, subtaskId: string, updates: Partial<TodoItem>) => void;
  hideDetails?: boolean;
  hidePriorityBorder?: boolean;
  showStatusBadge?: boolean;
  allTasks?: TodoItem[];
  // Swipe action callbacks
  onMoveTask?: (taskId: string) => void;
  onSetDate?: (taskId: string) => void;
  onTogglePin?: (taskId: string) => void;
}

const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2];

// Subtask component with nested subtask collapse support
interface SubtaskWithNestedProps {
  subtask: TodoItem;
  parentId: string;
  onUpdateSubtask?: (parentId: string, subtaskId: string, updates: Partial<TodoItem>) => void;
  hasNestedSubtasks: boolean;
  getPriorityColor: (id: string) => string;
}

const SubtaskWithNested = ({ subtask, parentId, onUpdateSubtask, hasNestedSubtasks, getPriorityColor }: SubtaskWithNestedProps) => {
  const [isNestedOpen, setIsNestedOpen] = useState(false);
  const { tags: globalTags } = useGlobalTags();
  
  return (
    <Collapsible open={isNestedOpen} onOpenChange={setIsNestedOpen}>
      <div
        className="flex items-center gap-3 py-2 px-2 border-l-4 hover:bg-muted/30 transition-colors"
        style={{ borderLeftColor: getPriorityColor(subtask.priority || 'none') }}
      >
        <Checkbox
          checked={subtask.completed}
          onCheckedChange={async (checked) => {
            if (onUpdateSubtask) {
              onUpdateSubtask(parentId, subtask.id, { completed: !!checked });
            }
            if (checked && !subtask.completed) {
              try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
            }
          }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "h-5 w-5 transition-all rounded-full border-2",
            subtask.completed && "rounded-sm border-0 bg-muted-foreground/30 data-[state=checked]:bg-muted-foreground/30 data-[state=checked]:text-white"
          )}
          style={{ 
            borderColor: subtask.completed ? undefined : getPriorityColor(subtask.priority || 'none') 
          }}
        />
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-sm font-medium truncate",
            subtask.completed && "text-muted-foreground line-through"
          )}>
            {subtask.text}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {subtask.dueDate && (
              <span className="text-xs text-muted-foreground">
                {new Date(subtask.dueDate).toLocaleDateString()}
              </span>
            )}
            {subtask.tagIds && subtask.tagIds.length > 0 && (
              <div className="flex items-center gap-1">
                {subtask.tagIds.slice(0, 2).map((tagId) => {
                  const tag = globalTags.find(t => t.id === tagId);
                  if (!tag) return null;
                  return (
                    <span 
                      key={tagId}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full text-white"
                      style={{ backgroundColor: `hsl(${tag.color})` }}
                    >
                      <Tag className="h-2.5 w-2.5" />
                      {tag.name}
                    </span>
                  );
                })}
              </div>
            )}
            {subtask.repeatType && subtask.repeatType !== 'none' && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-accent-purple/20 text-accent-purple">
                <Repeat className="h-2.5 w-2.5" />
              </span>
            )}
          </div>
        </div>
        {subtask.imageUrl && (
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-border flex-shrink-0">
            <ResolvedTaskImage srcRef={subtask.imageUrl} alt="Subtask attachment" className="w-full h-full object-cover" />
          </div>
        )}
        {hasNestedSubtasks && (
          <CollapsibleTrigger asChild>
            <button
              onClick={(e) => { e.stopPropagation(); setIsNestedOpen(!isNestedOpen); }}
              className="p-1 rounded hover:bg-muted transition-colors flex-shrink-0"
            >
              {isNestedOpen ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
        )}
      </div>
      
      {/* Nested subtasks (sub-subtasks) */}
      {hasNestedSubtasks && (
        <CollapsibleContent>
          <div className="ml-6 space-y-1 pt-1 border-l-2 border-muted-foreground/20">
            {subtask.subtasks!.map((nested) => (
              <div
                key={nested.id}
                className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted/20 transition-colors border-l-2"
                style={{ borderLeftColor: getPriorityColor(nested.priority || 'none') }}
              >
                <Checkbox
                  checked={nested.completed}
                  className={cn(
                    "h-4 w-4 transition-all rounded-full border-2",
                    nested.completed && "rounded-sm border-0 bg-muted-foreground/30"
                  )}
                  style={{
                    borderColor: nested.completed ? undefined : getPriorityColor(nested.priority || 'none')
                  }}
                  disabled
                />
                <span className={cn(
                  "text-xs flex-1 truncate",
                  nested.completed && "text-muted-foreground line-through"
                )}>
                  {nested.text}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
};

export const TaskItem = memo(({
  item,
  level = 0,
  onUpdate,
  onDelete,
  onTaskClick,
  onImageClick,
  isSelected = false,
  isSelectionMode = false,
  onSelect,
  expandedTasks,
  onToggleSubtasks,
  onUpdateSubtask,
  hideDetails = false,
  hidePriorityBorder = false,
  showStatusBadge = true,
  allTasks = [],
  onMoveTask,
  onSetDate,
  onTogglePin,
}: TaskItemProps) => {
  const { t } = useTranslation();
  const { getPriorityColor } = usePriorities();
  const { tags: globalTags } = useGlobalTags();
  const [localIsOpen, setLocalIsOpen] = useState(false);
  const isOpen = expandedTasks ? expandedTasks.has(item.id) : localIsOpen;
  const setIsOpen = (open: boolean) => {
    if (onToggleSubtasks) {
      onToggleSubtasks(item.id);
    } else {
      setLocalIsOpen(open);
    }
  };
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(item.voiceRecording?.duration || 0);
  const [resolvedAudioUrl, setResolvedAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasSubtasks = item.subtasks && item.subtasks.length > 0;
  const indentPx = level * 16;
  
  // Swipe state
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [pendingComplete, setPendingComplete] = useState(false);
  const pendingCompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const swipeStartX = useRef<number | null>(null);
  const didSwipeRef = useRef(false);
  const SWIPE_THRESHOLD = 60;
  const SWIPE_ACTION_WIDTH = 70;
  
  useEffect(() => {
    if (item.voiceRecording?.audioUrl) {
      resolveTaskMediaUrl(item.voiceRecording.audioUrl).then(url => {
        if (url) setResolvedAudioUrl(url);
      });
    }
  }, [item.voiceRecording?.audioUrl]);
  
  const { canComplete, blockedBy } = canCompleteTask(item, allTasks);
  const hasDependencies = item.dependsOn && item.dependsOn.length > 0;
  const isBlocked = hasDependencies && !canComplete;
  
  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    touchStartPos.current = { x: touchX, y: touchY };
    swipeStartX.current = touchX;
    didSwipeRef.current = false;
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current || !swipeStartX.current) return;
    
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - swipeStartX.current;
    const deltaY = Math.abs(currentY - touchStartPos.current.y);
    
    // If vertical movement is greater, don't swipe (user is scrolling)
    if (deltaY > 30 && !isSwiping) {
      return;
    }
    
    // Only start swiping with significant horizontal movement
    if (Math.abs(deltaX) > 25) {
      setIsSwiping(true);
      didSwipeRef.current = true;
      // Limit swipe distance - allow 2 actions on left (140px), 3 on right (210px)
      const maxSwipeRight = SWIPE_ACTION_WIDTH * 2; // Done + Pin
      const maxSwipeLeft = SWIPE_ACTION_WIDTH * 3; // Move + Delete + Date
      setSwipeOffset(Math.max(-maxSwipeLeft, Math.min(maxSwipeRight, deltaX)));
    }
  };
  
  const handleTouchEnd = async () => {
    if (isSwiping) {
      const maxSwipeRight = SWIPE_ACTION_WIDTH * 2;
      const maxSwipeLeft = SWIPE_ACTION_WIDTH * 3;
      
      if (swipeOffset > SWIPE_THRESHOLD) {
        try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
        setSwipeOffset(maxSwipeRight);
        setIsSwiping(false);
        touchStartPos.current = null;
        swipeStartX.current = null;
        return;
      } else if (swipeOffset < -SWIPE_THRESHOLD) {
        try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
        setSwipeOffset(-maxSwipeLeft);
        setIsSwiping(false);
        touchStartPos.current = null;
        swipeStartX.current = null;
        return;
      }
    }
    
    // If it was just a tap (no significant swipe), open the task
    const wasTap = !didSwipeRef.current;
    
    setSwipeOffset(0);
    setIsSwiping(false);
    touchStartPos.current = null;
    swipeStartX.current = null;
    
    if (wasTap && swipeOffset === 0 && !isSelectionMode) {
      onTaskClick(item);
    }
  };
  
  const handleSwipeAction = async (action: () => void) => {
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
    action();
    setSwipeOffset(0);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayVoice = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.voiceRecording) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlayingVoice(false);
      setPlaybackProgress(0);
      setCurrentTime(0);
      return;
    }

    const audioUrl = await resolveTaskMediaUrl(item.voiceRecording.audioUrl);
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audio.playbackRate = playbackSpeed;
    audioRef.current = audio;
    
    audio.ontimeupdate = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setPlaybackProgress((audio.currentTime / audio.duration) * 100);
        setCurrentTime(audio.currentTime);
      }
    };
    
    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setAudioDuration(Math.round(audio.duration));
      }
    };
    
    audio.onended = () => {
      setIsPlayingVoice(false);
      setPlaybackProgress(0);
      setCurrentTime(0);
      audioRef.current = null;
    };
    
    audio.play();
    setIsPlayingVoice(true);
  };

  const cyclePlaybackSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    const newSpeed = PLAYBACK_SPEEDS[nextIndex];
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!audioRef.current || !item.voiceRecording) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const duration = audioRef.current.duration || audioDuration || item.voiceRecording.duration;
    if (duration && !isNaN(duration)) {
      audioRef.current.currentTime = percentage * duration;
      setPlaybackProgress(percentage * 100);
      setCurrentTime(percentage * duration);
    }
  };

  return (
    <div className="space-y-1" style={{ paddingLeft: indentPx > 0 ? `${indentPx}px` : undefined }}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* Swipeable container */}
        <div className="relative overflow-hidden">
          {/* Swipe action backgrounds */}
          {/* Left side actions - Done + Pin (swipe right reveals) */}
          <div 
            className="absolute left-0 top-0 bottom-0 flex items-center"
            style={{ opacity: swipeOffset > 0 ? 1 : 0 }}
          >
            <button
              onClick={() => handleSwipeAction(() => {
                if (!item.completed) {
                  setPendingComplete(true);
                  Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
                  pendingCompleteTimer.current = setTimeout(() => {
                    setPendingComplete(false);
                    pendingCompleteTimer.current = null;
                    onUpdate(item.id, { completed: true });
                  }, 760);
                } else {
                  onUpdate(item.id, { completed: false });
                }
              })}
              className="flex flex-col items-center justify-center w-[70px] h-full bg-emerald-500 text-white"
            >
              <CheckIcon className="h-5 w-5" />
              <span className="text-[10px] font-medium mt-1">{t('swipe.done', 'Done')}</span>
            </button>
            <button
              onClick={() => onTogglePin && handleSwipeAction(() => onTogglePin(item.id))}
              className="flex flex-col items-center justify-center w-[70px] h-full bg-amber-400 text-white"
            >
              <Pin className={cn("h-5 w-5", item.isPinned && "fill-current")} />
              <span className="text-[10px] font-medium mt-1">{t('swipe.pin', 'Pin')}</span>
            </button>
          </div>
          {/* Right side actions - Move + Delete + Date (swipe left reveals) */}
          <div 
            className="absolute right-0 top-0 bottom-0 flex items-center"
            style={{ opacity: swipeOffset < 0 ? 1 : 0 }}
          >
            <button
              onClick={() => onMoveTask && handleSwipeAction(() => onMoveTask(item.id))}
              className="flex flex-col items-center justify-center w-[70px] h-full bg-blue-500 text-white"
            >
              <FolderInput className="h-5 w-5" />
              <span className="text-[10px] font-medium mt-1">{t('swipe.move', 'Move')}</span>
            </button>
            <button
              onClick={() => handleSwipeAction(() => onDelete(item.id))}
              className="flex flex-col items-center justify-center w-[70px] h-full bg-red-500 text-white"
            >
              <Trash2 className="h-5 w-5" />
              <span className="text-[10px] font-medium mt-1">{t('swipe.delete', 'Delete')}</span>
            </button>
            <button
              onClick={() => onSetDate && handleSwipeAction(() => onSetDate(item.id))}
              className="flex flex-col items-center justify-center w-[70px] h-full bg-amber-500 text-white"
            >
              <Calendar className="h-5 w-5" />
              <span className="text-[10px] font-medium mt-1">{t('swipe.date', 'Date')}</span>
            </button>
          </div>
          
          {/* Main task - flat layout */}
          <div
            className={cn(
              "flex items-start gap-3 py-2.5 px-2 cursor-pointer select-none bg-background",
              !hidePriorityBorder && "border-l-4",
              isSelected && "bg-primary/5",
              level > 0 && "mr-2",
              isSwiping ? '' : 'transition-transform duration-200'
            )}
            style={{ 
              ...(hidePriorityBorder ? {} : { borderLeftColor: getPriorityColor(item.priority || 'none') }),
              WebkitUserSelect: 'none',
              userSelect: 'none',
              transform: `translateX(${swipeOffset}px)`,
            }}
            onClick={() => !isSelectionMode && !didSwipeRef.current && swipeOffset === 0 && onTaskClick(item)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            {isSelectionMode && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect?.(item.id)}
                onClick={(e) => e.stopPropagation()}
                className="h-5 w-5 flex-shrink-0"
              />
            )}
          
          <div className={cn("relative flex items-center flex-shrink-0", TASK_CIRCLE.marginTop)}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative">
                    <button
                      disabled={isBlocked}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchMove={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isBlocked) return;
                        if (item.completed || pendingComplete) {
                          // Cancel pending completion or uncomplete
                          if (pendingCompleteTimer.current) {
                            clearTimeout(pendingCompleteTimer.current);
                            pendingCompleteTimer.current = null;
                          }
                          setPendingComplete(false);
                          if (item.completed) {
                            onUpdate(item.id, { completed: false });
                          }
                          return;
                        }
                        // Show tick first, then complete after delay
                        setPendingComplete(true);
                        Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
                        setTimeout(() => {
                          Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
                        }, 100);
                        pendingCompleteTimer.current = setTimeout(() => {
                          setPendingComplete(false);
                          pendingCompleteTimer.current = null;
                          onUpdate(item.id, { completed: true });
                        }, 400);
                      }}
                      className={cn(
                        TASK_CIRCLE.base,
                        TASK_CIRCLE.size,
                        item.completed && TASK_CIRCLE.completed,
                        pendingComplete && TASK_CIRCLE.pending,
                        isBlocked && TASK_CIRCLE.blocked
                      )}
                      style={{
                        borderColor: (item.completed || pendingComplete) ? undefined : getPriorityColor(item.priority || 'none'),
                        backgroundColor: pendingComplete ? getPriorityColor(item.priority || 'none') : undefined,
                      }}
                    >
                      {(item.completed || pendingComplete) && (
                        <CheckIcon 
                          className={cn(
                            TASK_CHECK_ICON.base,
                            TASK_CHECK_ICON.size,
                            pendingComplete && TASK_CHECK_ICON.pendingAnimation
                          )} 
                          style={{ 
                            color: pendingComplete 
                              ? TASK_CHECK_ICON.pendingColor
                              : TASK_CHECK_ICON.completedColor
                          }}
                          strokeWidth={TASK_CHECK_ICON.strokeWidth}
                        />
                      )}
                    </button>
                    {isBlocked && (
                      <Lock className="absolute -top-1 -right-1 h-3 w-3 text-warning" />
                    )}
                  </div>
                </TooltipTrigger>
                {isBlocked && (
                  <TooltipContent>
                    <p className="text-xs">{t('tasks.blockedBy', 'Blocked by')}: {blockedBy.map(task => task.text).slice(0, 2).join(', ')}{blockedBy.length > 2 ? ` +${blockedBy.length - 2}` : ''}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex-1 min-w-0 overflow-hidden">
            {item.voiceRecording ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePlayVoice}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors min-w-0 flex-1"
                >
                  {isPlayingVoice ? (
                    <Pause className="h-4 w-4 text-primary flex-shrink-0" />
                  ) : (
                    <Play className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                  <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                    {resolvedAudioUrl ? (
                      <WaveformProgressBar
                        audioUrl={resolvedAudioUrl}
                        progress={playbackProgress}
                        duration={audioDuration || item.voiceRecording.duration}
                        isPlaying={isPlayingVoice}
                        onSeek={(percent) => {
                          if (audioRef.current) {
                            const duration = audioRef.current.duration || audioDuration || item.voiceRecording!.duration;
                            if (duration && !isNaN(duration)) {
                              audioRef.current.currentTime = (percent / 100) * duration;
                              setPlaybackProgress(percent);
                              setCurrentTime((percent / 100) * duration);
                            }
                          }
                        }}
                        height={12}
                      />
                    ) : (
                      <div 
                        className="relative h-1.5 bg-primary/20 rounded-full overflow-hidden cursor-pointer"
                        onClick={handleSeek}
                      >
                        <div 
                          className="absolute h-full bg-primary rounded-full transition-all duration-100"
                          style={{ width: `${playbackProgress}%` }}
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-primary font-medium">
                        {isPlayingVoice ? formatDuration(Math.round(currentTime)) : '0:00'}
                      </span>
                      <span className="text-primary/70">
                        {formatDuration(audioDuration || item.voiceRecording.duration)}
                      </span>
                    </div>
                  </div>
                </button>
                <button
                  onClick={cyclePlaybackSpeed}
                  className="px-2 py-1 text-xs font-semibold rounded-md bg-muted hover:bg-muted/80 transition-colors min-w-[40px]"
                >
                  {playbackSpeed}x
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className={cn("text-sm font-medium truncate transition-all duration-300", (item.completed || pendingComplete) && "text-muted-foreground line-through")}>{item.text}</p>
              </div>
            )}
            
            {/* Tags display */}
            {!hideDetails && item.tagIds && item.tagIds.length > 0 && !item.voiceRecording && (
              <div className="flex items-center gap-1 mt-1 overflow-hidden">
                {item.tagIds.slice(0, 3).map((tagId) => {
                  const tag = globalTags.find(t => t.id === tagId);
                  if (!tag) return null;
                  return (
                    <span 
                      key={tagId}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full truncate max-w-[60px] text-white"
                      style={{ backgroundColor: `hsl(${tag.color})` }}
                    >
                      {tag.icon && <span className="flex-shrink-0">{tag.icon}</span>}
                      <Tag className="h-2.5 w-2.5 flex-shrink-0" />
                      <span className="truncate">{tag.name}</span>
                    </span>
                  );
                })}
                {item.tagIds.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{item.tagIds.length - 3}</span>
                )}
              </div>
            )}
            
            {/* Date display */}
            {!hideDetails && item.dueDate && !item.voiceRecording && (
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(item.dueDate).toLocaleDateString()}
              </p>
            )}
            
            {/* Status Badge */}
            {!hideDetails && showStatusBadge && item.status && item.status !== 'not_started' && !item.voiceRecording && (
              <div className="mt-1">
                <TaskStatusBadge status={item.status} size="sm" />
              </div>
            )}
            
            {/* Indicators */}
            {((item.repeatType && item.repeatType !== 'none') || hasDependencies || (hasSubtasks && !isOpen)) && <div className="flex items-center gap-2 mt-1 flex-wrap">
              {item.repeatType && item.repeatType !== 'none' && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-accent-purple/20 text-accent-purple">
                  <Repeat className="h-2.5 w-2.5" />
                  {getRepeatLabel(item.repeatType, item.repeatDays, item.advancedRepeat)}
                </span>
              )}
              {hasDependencies && (
                <span className={cn(
                  "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full",
                  isBlocked ? "bg-warning/20 text-warning" : "bg-success/20 text-success"
                )}>
                  <Link className="h-2.5 w-2.5" />
                  {isBlocked ? `${blockedBy.length} ${t('tasks.blocking', 'blocking')}` : t('tasks.ready', 'Ready')}
                </span>
              )}
              {hasSubtasks && !isOpen && (
                <p className="text-xs text-muted-foreground">{item.subtasks!.filter(st => st.completed).length}/{item.subtasks!.length} {t('tasks.subtasks', 'subtasks')}</p>
              )}
            </div>}
          </div>

          {item.imageUrl && (
            <div
              className="w-14 h-14 rounded-full overflow-hidden border-2 border-border flex-shrink-0 ml-1 cursor-pointer hover:border-primary transition-colors"
              onClick={(e) => { e.stopPropagation(); onImageClick(item.imageUrl!); }}
            >
              <ResolvedTaskImage srcRef={item.imageUrl} alt="Task attachment" className="w-full h-full object-cover" />
            </div>
          )}

          {hasSubtasks && (
            <button
              onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
              className="p-1 rounded hover:bg-muted transition-colors flex-shrink-0"
            >
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          )}
          </div>
        </div>

        {/* Subtasks */}
        <CollapsibleContent>
          {hasSubtasks && (
            <div className="ml-4 space-y-1 pt-1">
              {item.subtasks!.map((subtask) => {
                const hasNestedSubtasks = subtask.subtasks && subtask.subtasks.length > 0;
                return (
                  <SubtaskWithNested
                    key={subtask.id}
                    subtask={subtask}
                    parentId={item.id}
                    onUpdateSubtask={onUpdateSubtask}
                    hasNestedSubtasks={hasNestedSubtasks}
                    getPriorityColor={getPriorityColor}
                  />
                );
              })}
              <p className="text-xs text-muted-foreground px-2 py-1">
                {item.subtasks!.filter(st => st.completed).length}/{item.subtasks!.length} {t('tasks.completed', 'completed')}
              </p>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
});