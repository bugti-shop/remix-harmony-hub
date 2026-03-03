import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TodoItem, Priority, Folder, Note, RepeatType, ColoredTag, TimeTracking, TaskStatus, LocationReminder, TaskAttachment, EscalationTiming } from '@/types/note';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { usePriorities } from '@/hooks/usePriorities';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import { logActivity } from '@/utils/activityLogger';
import { TaskStatusBadge, TASK_STATUS_OPTIONS, getStatusConfig } from './TaskStatusBadge';
import {
  FolderIcon,
  ChevronDown,
  MoreVertical,
  Check,
  Flag,
  Copy,
  Pin,
  Trash2,
  Plus,
  Calendar as CalendarIcon,
  FileText,
  Tag,
  X,
  MapPin,
  Link,
  Clock,
  GripVertical,
  Circle,
  Hourglass,
  AlertTriangle,
  Paperclip,
  File,
  Download,
  Crown
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';

import { escalationTimingLabel } from '@/utils/deadlineEscalation';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { WaveformProgressBar } from './WaveformProgressBar';
import { Play, Pause } from 'lucide-react';
import { TaskDateTimePage, RepeatSettings } from './TaskDateTimePage';
import { TaskTimeTracker } from './TaskTimeTracker';
import { TaskDependencySheet, canCompleteTask } from './TaskDependencySheet';

import { ResolvedTaskImage } from './ResolvedTaskImage';
import { resolveTaskMediaUrl } from '@/utils/todoItemsStorage';
import { TaskInputSheet } from './TaskInputSheet';
import { SubtaskDetailSheet } from './SubtaskDetailSheet';
import { TaskCommentsSection } from './TaskCommentsSection';
import { TaskComment } from '@/types/note';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface TaskDetailPageProps {
  isOpen: boolean;
  task: TodoItem | null;
  folders: Folder[];
  allTasks?: TodoItem[];
  onClose: () => void;
  onUpdate: (task: TodoItem) => void;
  onDelete: (taskId: string) => void;
  onDuplicate: (task: TodoItem) => void;
  onConvertToNote: (task: TodoItem) => void;
  onMoveToFolder: (taskId: string, folderId: string | null) => void;
}

const TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', 
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
];


export const TaskDetailPage = ({
  isOpen,
  task,
  folders,
  allTasks = [],
  onClose,
  onUpdate,
  onDelete,
  onDuplicate,
  onConvertToNote,
  onMoveToFolder
}: TaskDetailPageProps) => {
  const { t } = useTranslation();
  const { getPriorityColor: getPriorityHex, getPriorityName } = usePriorities();
  const { requireFeature, isPro, isRecurringSubscriber } = useSubscription();
  const [title, setTitle] = useState('');
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [isSubtaskInputSheetOpen, setIsSubtaskInputSheetOpen] = useState(false);
  const [showDateTimePage, setShowDateTimePage] = useState(false);
  const [showDependencySheet, setShowDependencySheet] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [voiceProgress, setVoiceProgress] = useState(0);
  const [voiceCurrentTime, setVoiceCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [voicePlaybackSpeed, setVoicePlaybackSpeed] = useState(1);
  const [resolvedAudioUrl, setResolvedAudioUrl] = useState<string | null>(null);
  const VOICE_PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2];
  const [reminderOffset, setReminderOffset] = useState<string>('');
  const [repeatSettings, setRepeatSettings] = useState<RepeatSettings | undefined>();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const subtaskInputRef = useRef<HTMLInputElement>(null);
  
  // Subtask detail sheet state
  const [selectedSubtask, setSelectedSubtask] = useState<TodoItem | null>(null);
  const [showSubtaskDetailSheet, setShowSubtaskDetailSheet] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewAttachment, setPreviewAttachment] = useState<{ url: string; name: string; type: string } | null>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.text);
      // Resolve audio URL
      if (task.voiceRecording?.audioUrl) {
        resolveTaskMediaUrl(task.voiceRecording.audioUrl).then(url => {
          if (url) setResolvedAudioUrl(url);
        });
      } else {
        setResolvedAudioUrl(null);
      }
      
      // Initialize repeat settings from task's repeatType and advancedRepeat
      if (task.repeatType && task.repeatType !== 'none') {
        const frequencyMap: Record<string, RepeatSettings['frequency']> = {
          'hourly': 'hour',
          'daily': 'daily',
          'weekly': 'weekly',
          'weekdays': 'weekly',
          'weekends': 'weekly',
          'monthly': 'monthly',
          'yearly': 'yearly',
          'custom': 'weekly',
        };
        
        const frequency = task.advancedRepeat?.frequency 
          ? (frequencyMap[task.advancedRepeat.frequency] || 'daily')
          : (frequencyMap[task.repeatType] || 'daily');
        
        setRepeatSettings({
          frequency,
          interval: task.advancedRepeat?.interval || 1,
          endsType: 'never',
          weeklyDays: task.repeatDays || task.advancedRepeat?.weeklyDays,
          monthlyDay: task.advancedRepeat?.monthlyDay,
        });
      } else {
        setRepeatSettings(undefined);
      }
    }
  }, [task]);

  useEffect(() => {
    if (showSubtaskInput && subtaskInputRef.current) {
      subtaskInputRef.current.focus();
    }
  }, [showSubtaskInput]);

  // Handle hardware back button on Android
  const handleBack = useCallback(() => {
    onClose();
  }, [onClose]);

  useHardwareBackButton({
    onBack: handleBack,
    enabled: isOpen && !showDateTimePage && !showDependencySheet,
    priority: 'sheet',
  });

  if (!isOpen || !task) return null;

  const currentFolder = folders.find(f => f.id === task.folderId);

  const handleTitleBlur = () => {
    if (title.trim() !== task.text) {
      onUpdate({ ...task, text: title.trim() });
    }
  };

  const handleMarkAsDone = async () => {
    try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
    onUpdate({ ...task, completed: !task.completed });
    toast.success(task.completed ? t('taskDetail.markAsIncomplete') : t('taskDetail.markAsDone'));
  };

  const handleSetPriority = async (priority: Priority) => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    onUpdate({ ...task, priority });
    toast.success(t('toasts.saved'));
  };

  const handleDuplicate = async () => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    onDuplicate(task);
    onClose();
    toast.success(t('toasts.taskDuplicated'));
  };

  const handlePin = async () => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    toast.success(t('notes.pinned'));
  };

  const handleDelete = async () => {
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
    onDelete(task.id);
    onClose();
    toast.success(t('toasts.taskDeleted'));
  };

  const handleAddSubtask = async () => {
    if (!newSubtaskText.trim()) return;
    
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    
    const newSubtask: TodoItem = {
      id: Date.now().toString(),
      text: newSubtaskText.trim(),
      completed: false,
    };

    onUpdate({
      ...task,
      subtasks: [...(task.subtasks || []), newSubtask]
    });

    setNewSubtaskText('');
    // Keep input open for next subtask
  };

  const handleAddSubtaskFromSheet = async (subtask: Omit<TodoItem, 'id' | 'completed'>) => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    
    const newSubtask: TodoItem = {
      id: Date.now().toString(),
      completed: false,
      ...subtask,
    };

    onUpdate({
      ...task,
      subtasks: [...(task.subtasks || []), newSubtask]
    });
    
    setIsSubtaskInputSheetOpen(false);
    toast.success(t('taskDetail.subtaskAdded'));
  };

  const handleSubtaskKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSubtask();
    }
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    const updatedSubtasks = (task.subtasks || []).map(st =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    onUpdate({ ...task, subtasks: updatedSubtasks });
  };

  const handleDeleteSubtask = (subtaskId: string) => {
    onUpdate({
      ...task,
      subtasks: (task.subtasks || []).filter(st => st.id !== subtaskId)
    });
  };

  const handleOpenSubtaskDetail = (subtask: TodoItem) => {
    setSelectedSubtask(subtask);
    setShowSubtaskDetailSheet(true);
  };

  const handleUpdateSubtask = (parentId: string, subtaskId: string, updates: Partial<TodoItem>) => {
    const updatedSubtasks = (task.subtasks || []).map(st =>
      st.id === subtaskId ? { ...st, ...updates } : st
    );
    onUpdate({ ...task, subtasks: updatedSubtasks });
  };

  const handleDeleteSubtaskFromSheet = (parentId: string, subtaskId: string) => {
    onUpdate({
      ...task,
      subtasks: (task.subtasks || []).filter(st => st.id !== subtaskId)
    });
  };

  const handleConvertSubtaskToTask = (parentId: string, subtask: TodoItem) => {
    // Remove from subtasks
    onUpdate({
      ...task,
      subtasks: (task.subtasks || []).filter(st => st.id !== subtask.id)
    });
    // Create as main task (handled by parent component via onDuplicate with modifications)
    const newTask: TodoItem = {
      ...subtask,
      id: Date.now().toString(),
      folderId: task.folderId,
    };
    onDuplicate(newTask);
  };

  const handleSubtaskDragEnd = async (result: DropResult) => {
    if (!result.destination || !task.subtasks) return;
    
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    
    if (sourceIndex === destIndex) return;
    
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
    
    const reordered = Array.from(task.subtasks);
    const [removed] = reordered.splice(sourceIndex, 1);
    reordered.splice(destIndex, 0, removed);
    
    onUpdate({ ...task, subtasks: reordered });
  };

  const handleDateTimeSave = async (data: {
    selectedDate?: Date;
    selectedTime?: { hour: number; minute: number; period: 'AM' | 'PM' };
    reminder?: string;
    repeatSettings?: RepeatSettings;
  }) => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    
    let reminderTime: Date | undefined;
    
    if (data.selectedDate && data.selectedTime) {
      reminderTime = new Date(data.selectedDate);
      let hours = data.selectedTime.hour;
      if (data.selectedTime.period === 'PM' && hours !== 12) hours += 12;
      if (data.selectedTime.period === 'AM' && hours === 12) hours = 0;
      reminderTime.setHours(hours, data.selectedTime.minute, 0, 0);
    }

    const updatedTask: TodoItem = {
      ...task,
      dueDate: data.selectedDate,
      reminderTime,
      repeatType: data.repeatSettings?.frequency as any || 'none',
    };

    onUpdate(updatedTask);
    
    // Store reminder offset and repeat settings
    setReminderOffset(data.reminder || '');
    setRepeatSettings(data.repeatSettings);

    // Schedule reminder in background (non-blocking)
    if (updatedTask.reminderTime) {
      import('@/utils/reminderScheduler').then(({ scheduleTaskReminder }) => {
        scheduleTaskReminder(updatedTask.id, updatedTask.text, new Date(updatedTask.reminderTime!)).catch(console.warn);
      });
    } else {
      import('@/utils/reminderScheduler').then(({ cancelTaskReminder }) => {
        cancelTaskReminder(updatedTask.id).catch(console.warn);
      });
    }

    // CLOSE SHEET FIRST — never block UI on native plugin calls
    setShowDateTimePage(false);
    toast.success(data.selectedDate ? t('taskDetailToasts.dateTimeReminderSaved') : t('taskDetailToasts.dateSaved'));

    // Notification scheduling removed
  };

  const handleConvertToNote = () => {
    onConvertToNote(task);
    onClose();
  };

  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    
    const newTag: ColoredTag = {
      name: newTagName.trim(),
      color: newTagColor
    };

    onUpdate({
      ...task,
      coloredTags: [...(task.coloredTags || []), newTag]
    });

    // Save to suggestions in IndexedDB
    getSetting<ColoredTag[]>('coloredTagSuggestions', []).then(savedTags => {
      const exists = savedTags.some((t: ColoredTag) => t.name === newTag.name);
      if (!exists) {
        setSetting('coloredTagSuggestions', [newTag, ...savedTags].slice(0, 20));
      }
    });

    setNewTagName('');
    setShowTagInput(false);
    toast.success(t('toasts.tagAdded'));
  };

  const handleRemoveTag = (tagName: string) => {
    onUpdate({
      ...task,
      coloredTags: (task.coloredTags || []).filter(t => t.name !== tagName)
    });
  };

  const handleVoicePlay = async () => {
    if (!task.voiceRecording) return;

    if (playingVoiceId === task.id && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingVoiceId(null);
      setVoiceProgress(0);
      setVoiceCurrentTime(0);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Resolve media ref if needed
    const audioUrl = await resolveTaskMediaUrl(task.voiceRecording.audioUrl);
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audio.playbackRate = voicePlaybackSpeed;
    audioRef.current = audio;
    
    audio.ontimeupdate = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setVoiceProgress((audio.currentTime / audio.duration) * 100);
        setVoiceCurrentTime(audio.currentTime);
      }
    };
    
    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setAudioDuration(Math.round(audio.duration));
      }
    };
    
    audio.onended = () => {
      setPlayingVoiceId(null);
      setVoiceProgress(0);
      setVoiceCurrentTime(0);
      audioRef.current = null;
    };
    audio.play();
    setPlayingVoiceId(task.id);
  };

  const cycleVoicePlaybackSpeed = () => {
    const currentIndex = VOICE_PLAYBACK_SPEEDS.indexOf(voicePlaybackSpeed);
    const nextIndex = (currentIndex + 1) % VOICE_PLAYBACK_SPEEDS.length;
    const newSpeed = VOICE_PLAYBACK_SPEEDS[nextIndex];
    setVoicePlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  const handleVoiceSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !task?.voiceRecording) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const duration = audioRef.current.duration || audioDuration || task.voiceRecording.duration;
    if (duration && !isNaN(duration)) {
      audioRef.current.currentTime = percentage * duration;
      setVoiceProgress(percentage * 100);
      setVoiceCurrentTime(percentage * duration);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // File attachment handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !task) return;

    const { saveTaskMedia, makeTaskMediaRef } = await import('@/utils/taskMediaStorage');
    const newAttachments: TaskAttachment[] = [];
    
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      
      const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await saveTaskMedia('file', id, dataUrl);
      
      newAttachments.push({
        id,
        name: file.name,
        size: file.size,
        type: file.type,
        ref: makeTaskMediaRef('file', id),
      });
    }

    onUpdate({
      ...task,
      attachments: [...(task.attachments || []), ...newAttachments],
    });
    
    toast.success(t('taskDetailToasts.filesAttached', { count: newAttachments.length }));
    if (e.target) e.target.value = '';
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    if (!task) return;
    const { deleteTaskMedia, parseTaskMediaRef } = await import('@/utils/taskMediaStorage');
    const attachment = task.attachments?.find(a => a.id === attachmentId);
    if (attachment) {
      const parsed = parseTaskMediaRef(attachment.ref);
      if (parsed) {
        await deleteTaskMedia(parsed.kind, parsed.id);
      }
    }
    onUpdate({
      ...task,
      attachments: task.attachments?.filter(a => a.id !== attachmentId),
    });
    toast.success(t('taskDetailToasts.fileRemoved'));
  };


  const handleOpenAttachment = async (attachment: TaskAttachment) => {
    const { resolveTaskMediaUrl } = await import('@/utils/taskMediaStorage');
    const dataUrl = await resolveTaskMediaUrl(attachment.ref);
    if (!dataUrl) return;

    const isImage = attachment.type?.startsWith('image/');
    const isPdf = attachment.type === 'application/pdf';
    const isViewable = isImage || isPdf || attachment.type?.startsWith('text/') || attachment.type?.startsWith('video/') || attachment.type?.startsWith('audio/');
    
    if (isViewable) {
      // Show in-app preview (images, PDFs, text, video, audio)
      setPreviewAttachment({ url: dataUrl, name: attachment.name, type: attachment.type });
    } else {
      // Non-viewable files: save to filesystem and share via native share sheet
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        
        const base64Data = dataUrl.split(',')[1];
        const result = await Filesystem.writeFile({
          path: attachment.name || `file_${Date.now()}`,
          data: base64Data,
          directory: Directory.Cache,
        });
        
        await Share.share({ title: attachment.name, url: result.uri });
      } catch {
        // Fallback for web
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = attachment.name;
        link.target = '_blank';
        link.click();
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };


  return (
    <div 
      className={cn(
        "fixed inset-0 bg-background z-50 flex flex-col transition-transform duration-300",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        {/* Left: Folders Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <FolderIcon className="h-4 w-4" />
              <span>{currentFolder?.name || t('smartLists.allTasks')}</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48 bg-popover border shadow-lg z-[60]">
            <DropdownMenuItem 
              onClick={() => onMoveToFolder(task.id, null)}
              className={cn("cursor-pointer", !task.folderId && "bg-accent")}
            >
              <FolderIcon className="h-4 w-4 mr-2" />
              {t('taskDetail.allTasksNoFolder')}
              {!task.folderId && <Check className="h-4 w-4 ml-auto" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {folders.map((folder) => (
              <DropdownMenuItem 
                key={folder.id}
                onClick={() => onMoveToFolder(task.id, folder.id)}
                className={cn("cursor-pointer", task.folderId === folder.id && "bg-accent")}
              >
                <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: folder.color }} />
                {folder.name}
                {task.folderId === folder.id && <Check className="h-4 w-4 ml-auto" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Right: Options Menu */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-popover border shadow-lg z-[60]">
              <DropdownMenuItem onClick={handleMarkAsDone} className="cursor-pointer">
                <Check className="h-4 w-4 mr-2" />
                {task.completed ? t('taskDetail.markAsIncomplete') : t('taskDetail.markAsDone')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleSetPriority('high')} className="cursor-pointer">
                <Flag className="h-4 w-4 mr-2 text-red-500" />{t('taskDetail.highPriority')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSetPriority('medium')} className="cursor-pointer">
                <Flag className="h-4 w-4 mr-2 text-orange-500" />{t('taskDetail.mediumPriority')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSetPriority('low')} className="cursor-pointer">
                <Flag className="h-4 w-4 mr-2 text-green-500" />{t('taskDetail.lowPriority')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSetPriority('none')} className="cursor-pointer">
                <Flag className="h-4 w-4 mr-2 text-muted-foreground" />{t('taskDetail.noPriority')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDuplicate} className="cursor-pointer">
                <Copy className="h-4 w-4 mr-2" />{t('taskDetail.duplicateTask')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { if (!requireFeature('pin_feature')) return; handlePin(); }} className="cursor-pointer">
                <Pin className="h-4 w-4 mr-2" />{t('taskDetail.pinTask')}
                {!isPro && <Crown className="h-3.5 w-3.5 ml-auto" style={{ color: '#3c78f0' }} />}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="cursor-pointer text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />{t('taskDetail.deleteTask')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Task Title */}
        <div className="space-y-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder={t('taskDetail.taskTitle')}
            className={cn(
              "text-xl font-semibold border-none shadow-none px-0 h-auto focus-visible:ring-0",
              task.completed && "line-through opacity-60"
            )}
          />
          <div className="flex items-center gap-3 flex-wrap">
            {task.priority && task.priority !== 'none' && (
              <div className="flex items-center gap-1.5">
                <Flag className="h-4 w-4" style={{ color: getPriorityHex(task.priority) }} />
                <span className="text-sm capitalize" style={{ color: getPriorityHex(task.priority) }}>
                  {getPriorityName(task.priority)}
                </span>
              </div>
            )}
            {/* Task Status Badge */}
            <TaskStatusBadge status={task.status} size="md" />
          </div>
        </div>

        {/* Task Status Selection - Premium */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Circle className="h-4 w-4" />
            {t('taskDetail.taskStatus')}
            {!isPro && <Crown className="h-3.5 w-3.5" style={{ color: '#3c78f0' }} />}
          </div>
          <Select 
            value={task.status || 'not_started'} 
            onValueChange={(value) => {
              if (!requireFeature('task_status')) return;
              onUpdate({ ...task, status: value as TaskStatus });
              toast.success(t('toasts.saved'));
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('taskDetail.selectStatus')}>
                <div className="flex items-center gap-2">
                  <TaskStatusBadge status={task.status || 'not_started'} showLabel={true} />
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TASK_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    <TaskStatusBadge status={option.value} showLabel={true} />
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Voice Recording Display */}
        {task.voiceRecording && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
            <button
              onClick={handleVoicePlay}
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0 hover:opacity-90 transition-opacity"
            >
              {playingVoiceId === task.id ? (
                <Pause className="h-5 w-5 text-primary-foreground" />
              ) : (
                <Play className="h-5 w-5 text-primary-foreground ml-0.5" />
              )}
            </button>
            <div className="flex-1 flex flex-col gap-1">
              {/* Waveform progress bar */}
              {resolvedAudioUrl ? (
                <WaveformProgressBar
                  audioUrl={resolvedAudioUrl}
                  progress={voiceProgress}
                  duration={audioDuration || task.voiceRecording.duration}
                  isPlaying={playingVoiceId === task.id}
                  onSeek={(percent) => {
                    if (audioRef.current) {
                      const duration = audioRef.current.duration || audioDuration || task.voiceRecording!.duration;
                      if (duration && !isNaN(duration)) {
                        audioRef.current.currentTime = (percent / 100) * duration;
                        setVoiceProgress(percent);
                        setVoiceCurrentTime((percent / 100) * duration);
                      }
                    }
                  }}
                  height={20}
                />
              ) : (
                <div 
                  className="relative h-2 bg-primary/20 rounded-full overflow-hidden cursor-pointer"
                  onClick={handleVoiceSeek}
                >
                  <div 
                    className="absolute h-full bg-primary rounded-full transition-all duration-100"
                    style={{ width: `${voiceProgress}%` }}
                  />
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-primary font-medium">
                  {playingVoiceId === task.id ? formatDuration(Math.round(voiceCurrentTime)) : '0:00'}
                </span>
                <span className="text-primary/70">
                  {formatDuration(audioDuration || task.voiceRecording.duration)}
                </span>
              </div>
            </div>
            <button
              onClick={cycleVoicePlaybackSpeed}
              className="px-2 py-1 text-xs font-semibold rounded-md bg-muted hover:bg-muted/80 transition-colors min-w-[40px]"
            >
              {voicePlaybackSpeed}x
            </button>
          </div>
        )}

        {/* Image Display */}
        {task.imageUrl && (
          <div className="rounded-xl overflow-hidden border border-border">
            <ResolvedTaskImage srcRef={task.imageUrl} alt={t('taskDetail.taskAttachment')} className="w-full max-h-48 object-cover" />
          </div>
        )}


        {/* Subtasks - Bullet Point Structure */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span className="text-lg">•</span>
              {t('taskDetail.subtasks')}
            </div>
            <button
              onClick={() => setIsSubtaskInputSheetOpen(true)}
              className="flex items-center gap-1 text-primary text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              {t('taskDetail.addSubtask')}
            </button>
          </div>

          {task.subtasks && task.subtasks.length > 0 && (
            <DragDropContext onDragEnd={handleSubtaskDragEnd}>
              <Droppable droppableId="subtasks-list">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-2"
                  >
                    {task.subtasks.map((subtask, index) => (
                      <Draggable key={subtask.id} draggableId={subtask.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={cn(
                              "flex items-start gap-2 py-3 px-3 bg-card rounded-lg border border-border group cursor-pointer hover:bg-muted/50 transition-colors",
                              snapshot.isDragging && "shadow-lg ring-2 ring-primary/20"
                            )}
                            onClick={() => handleOpenSubtaskDetail(subtask)}
                          >
                            <div
                              {...provided.dragHandleProps}
                              onClick={(e) => e.stopPropagation()}
                              className="cursor-grab active:cursor-grabbing touch-none mt-1"
                            >
                              <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                            </div>
                            {/* Bullet Point Style */}
                            <span className="text-muted-foreground mt-0.5 text-lg leading-none">•</span>
                            <Checkbox
                              checked={subtask.completed}
                              onCheckedChange={() => handleToggleSubtask(subtask.id)}
                              onClick={(e) => e.stopPropagation()}
                              className={cn(
                                "h-5 w-5 transition-all flex-shrink-0 mt-0.5",
                                subtask.completed 
                                  ? "rounded-sm bg-muted-foreground/30 border-0" 
                                  : cn("rounded-full border-2", 
                                      subtask.priority === 'high' ? 'border-red-500' :
                                      subtask.priority === 'medium' ? 'border-orange-500' :
                                      subtask.priority === 'low' ? 'border-green-500' :
                                      'border-muted-foreground/40'
                                    )
                              )}
                            />
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-sm font-medium",
                                subtask.completed && "line-through text-muted-foreground"
                              )}>
                                {subtask.text}
                              </p>
                              {/* Subtask metadata */}
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {subtask.status && subtask.status !== 'not_started' && (
                                  <TaskStatusBadge status={subtask.status} size="sm" />
                                )}
                                {subtask.dueDate && (
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(subtask.dueDate), 'MMM d')}
                                  </span>
                                )}
                                {subtask.coloredTags && subtask.coloredTags.length > 0 && (
                                  <div className="flex items-center gap-1">
                                    {subtask.coloredTags.slice(0, 2).map((tag) => (
                                      <span 
                                        key={tag.name}
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full"
                                        style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                                      >
                                        <Tag className="h-2.5 w-2.5" />
                                        {tag.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {/* Nested subtasks count */}
                                {subtask.subtasks && subtask.subtasks.length > 0 && (
                                  <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded-full">
                                    {t('taskDetail.nested', { completed: subtask.subtasks.filter(st => st.completed).length, total: subtask.subtasks.length })}
                                  </span>
                                )}
                              </div>
                            </div>
                            {subtask.imageUrl && (
                              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-border flex-shrink-0">
                                <ResolvedTaskImage srcRef={subtask.imageUrl} alt="Subtask" className="w-full h-full object-cover" />
                              </div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSubtask(subtask.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity p-1"
                            >
                              <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    <p className="text-xs text-muted-foreground px-3 py-1">
                      {t('taskDetail.subtasksCompleted', { completed: task.subtasks.filter(st => st.completed).length, total: task.subtasks.length })}
                    </p>
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </div>

        {/* Time Tracking - Premium */}
        <div className="space-y-2" onClick={() => { if (!requireFeature('time_tracking')) return; }}>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="h-4 w-4" />
            {t('taskDetail.timeTracking')}
            {!isPro && <Crown className="h-3.5 w-3.5" style={{ color: '#3c78f0' }} />}
          </div>
          <TaskTimeTracker
            timeTracking={task.timeTracking}
            onUpdate={(tracking) => { if (!requireFeature('time_tracking')) return; onUpdate({ ...task, timeTracking: tracking }); }}
          />
        </div>

        {/* Effort Estimation */}
        <div className="bg-muted/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Hourglass className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">{t('taskDetail.effortEstimation')}</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5 flex-wrap">
              {[0.5, 1, 2, 4, 8].map(h => (
                <button
                  key={h}
                  onClick={() => onUpdate({ ...task, estimatedHours: task.estimatedHours === h ? undefined : h })}
                  className={cn(
                    "px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all",
                    task.estimatedHours === h
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {h}h
                </button>
              ))}
            </div>
            <input
              type="number"
              min="0.25"
              step="0.25"
              max="999"
              value={task.estimatedHours || ''}
              onChange={(e) => onUpdate({ ...task, estimatedHours: e.target.value ? Number(e.target.value) : undefined })}
              placeholder={t('taskDetail.custom')}
              className="w-20 px-2 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {task.estimatedHours && task.timeTracking && task.timeTracking.totalSeconds > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{t('taskDetail.estimated', { hours: task.estimatedHours })}</span>
                <span className="text-muted-foreground">
                  {t('taskDetail.actual', { hours: (task.timeTracking.totalSeconds / 3600).toFixed(1) })}
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    (task.timeTracking.totalSeconds / 3600) > task.estimatedHours
                      ? "bg-destructive"
                      : "bg-primary"
                  )}
                  style={{
                    width: `${Math.min(100, ((task.timeTracking.totalSeconds / 3600) / task.estimatedHours) * 100)}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Deadline Escalation Rules */}
        {task.dueDate && (
          <div className="bg-muted/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <h3 className="text-sm font-medium">{t('taskDetail.deadlineEscalation')}</h3>
                {!isPro && <Crown className="h-3.5 w-3.5" style={{ color: '#3c78f0' }} />}
              </div>
              <Switch
                checked={task.escalationRule?.enabled || false}
                onCheckedChange={(checked) => {
                  if (!requireFeature('deadline_escalation')) return;
                  onUpdate({
                    ...task,
                    escalationRule: {
                      ...task.escalationRule,
                      enabled: checked,
                      timing: task.escalationRule?.timing || '2hours',
                    },
                  });
                }}
              />
            </div>
            {task.escalationRule?.enabled && (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">{t('taskDetail.alertBeforeDeadline')}</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {(['30min', '1hour', '2hours', '4hours', '1day'] as EscalationTiming[]).map(timing => (
                      <button
                        key={timing}
                        onClick={() => onUpdate({
                          ...task,
                          escalationRule: { ...task.escalationRule!, timing },
                        })}
                        className={cn(
                          "px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all",
                          task.escalationRule?.timing === timing
                            ? "bg-warning text-warning-foreground border-warning"
                            : "border-border text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {escalationTimingLabel(timing)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium">{t('taskDetail.repeatAlert')}</p>
                    <p className="text-xs text-muted-foreground">{t('taskDetail.repeatAlertDesc')}</p>
                  </div>
                  <Switch
                    checked={task.escalationRule?.repeat || false}
                    onCheckedChange={(checked) => {
                      onUpdate({
                        ...task,
                        escalationRule: {
                          ...task.escalationRule!,
                          repeat: checked,
                          repeatIntervalMinutes: 30,
                        },
                      });
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}


        {/* File Attachments Section */}
        <div className="bg-muted/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">{t('tasks.attachments.title', 'Attachments')}</h3>
            </div>
            <Button
              onClick={() => { if (!requireFeature('file_attachments')) return; fileInputRef.current?.click(); }}
              size="sm"
              variant="outline"
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              {t('tasks.attachments.add', 'Add')}
              {!isPro && <Crown className="h-3.5 w-3.5 ml-1" style={{ color: '#3c78f0' }} />}
            </Button>
          </div>

          {task.attachments && task.attachments.length > 0 ? (
            <div className="space-y-2">
              {task.attachments.map((attachment) => (
                <div 
                  key={attachment.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group"
                >
                  <File className="h-5 w-5 text-sky-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{attachment.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenAttachment(attachment)}
                      className="p-2 hover:bg-muted rounded-lg"
                    >
                      <Download className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleRemoveAttachment(attachment.id)}
                      className="p-2 hover:bg-destructive/10 rounded-lg"
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('tasks.attachments.empty', 'No files attached')}
            </p>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>


        <div className="space-y-1 border-t border-border pt-4">
          {/* Date - Opens TaskDateTimePage */}
          <button 
            onClick={() => setShowDateTimePage(true)}
            className="w-full flex items-center gap-3 py-3 hover:bg-muted/50 rounded-lg px-2 transition-colors"
          >
            <CalendarIcon className="h-5 w-5 text-cyan-500" />
            <span className="flex-1 text-left">{t('taskDetail.dateTimeReminder')}</span>
            <span className="text-sm text-muted-foreground">
              {task.dueDate 
                ? `${format(new Date(task.dueDate), 'MMM d')}${task.reminderTime ? ` • ${format(new Date(task.reminderTime), 'h:mm a')}` : ''}`
                : t('taskDetail.notSet')}
            </span>
          </button>

          {/* Convert to Notes */}
          <button 
            onClick={handleConvertToNote}
            className="w-full flex items-center gap-3 py-3 hover:bg-muted/50 rounded-lg px-2 transition-colors"
          >
            <FileText className="h-5 w-5 text-info" />
            <span className="flex-1 text-left">{t('taskDetail.convertToNotes')}</span>
          </button>



          <div className="space-y-2">
            <Popover open={showTagInput} onOpenChange={setShowTagInput}>
              <PopoverTrigger asChild>
                <button className="w-full flex items-center gap-3 py-3 hover:bg-muted/50 rounded-lg px-2 transition-colors">
                  <Tag className="h-5 w-5 text-warning" />
                  <span className="flex-1 text-left">{t('taskDetail.tag')}</span>
                  <span className="text-sm text-muted-foreground">
                    {t('taskDetail.tagsCount', { count: task.coloredTags?.length || 0 })}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 z-[60]" align="start">
                <div className="space-y-3">
                  <Input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder={t('taskDetail.tagName')}
                    className="h-9"
                  />
                  <div className="flex gap-1 flex-wrap">
                    {TAG_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewTagColor(color)}
                        className={cn(
                          "w-6 h-6 rounded-full transition-transform",
                          newTagColor === color && "ring-2 ring-offset-2 ring-primary scale-110"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <Button onClick={handleAddTag} size="sm" className="w-full">
                    {t('taskDetail.addTag')}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Display existing tags */}
            {task.coloredTags && task.coloredTags.length > 0 && (
              <div className="flex flex-wrap gap-2 pl-10">
                {task.coloredTags.map((tag) => (
                  <span
                    key={tag.name}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full"
                    style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                  >
                    {tag.name}
                    <button onClick={() => handleRemoveTag(tag.name)}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Description Section */}
          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileText className="h-4 w-4" />
              {t('taskDetail.description')}
            </div>
            <textarea
              value={task.description || ''}
              onChange={(e) => onUpdate({ ...task, description: e.target.value })}
              placeholder={t('taskDetail.descriptionPlaceholder')}
              className="w-full min-h-[120px] p-3 rounded-xl bg-muted/30 border border-border/50 resize-none text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Comments & Activity Thread */}
          <TaskCommentsSection
            comments={task.comments || []}
            onAddComment={(comment: TaskComment) => {
              onUpdate({
                ...task,
                comments: [...(task.comments || []), comment],
              });
            }}
            onDeleteComment={(commentId: string) => {
              onUpdate({
                ...task,
                comments: (task.comments || []).filter(c => c.id !== commentId),
              });
            }}
          />

          {/* Task Timestamps Section - Premium */}
          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-3">
              <Clock className="h-4 w-4" />
              {t('taskDetail.taskHistory')}
              {!isPro && <Crown className="h-3.5 w-3.5" style={{ color: '#3c78f0' }} />}
            </div>
            <div 
              className={cn("space-y-2 text-sm", !isPro && "select-none cursor-pointer")}
              onClick={() => { if (!isPro) requireFeature('time_tracking'); }}
            >
              <div className="flex items-center justify-between py-2 px-3 bg-muted/20 rounded-lg">
                <span className="text-muted-foreground">{t('taskDetail.created')}</span>
                {isPro ? (
                  <span className="font-medium">
                    {task.createdAt ? format(new Date(task.createdAt), 'MMM d, yyyy • h:mm a') : '—'}
                  </span>
                ) : (
                  <span className="font-medium blur-[6px] select-none">Jan 1, 2025 • 12:00 PM</span>
                )}
              </div>
              <div className="flex items-center justify-between py-2 px-3 bg-muted/20 rounded-lg">
                <span className="text-muted-foreground">{t('taskDetail.lastModified')}</span>
                {isPro ? (
                  <span className="font-medium">
                    {task.modifiedAt ? format(new Date(task.modifiedAt), 'MMM d, yyyy • h:mm a') : '—'}
                  </span>
                ) : (
                  <span className="font-medium blur-[6px] select-none">Jan 5, 2025 • 3:45 PM</span>
                )}
              </div>
              {isPro && task.completed && task.completedAt && (
                <div className="flex items-center justify-between py-2 px-3 bg-success/10 rounded-lg">
                  <span className="text-success">{t('taskDetail.completed')}</span>
                  <span className="font-medium text-success">{format(new Date(task.completedAt), 'MMM d, yyyy • h:mm a')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Safe area padding for bottom */}
      <div style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }} />

      {/* TaskDateTimePage */}
      <TaskDateTimePage
        isOpen={showDateTimePage}
        onClose={() => setShowDateTimePage(false)}
        onSave={handleDateTimeSave}
        initialDate={task.dueDate ? new Date(task.dueDate) : undefined}
        initialTime={task.reminderTime ? {
          hour: new Date(task.reminderTime).getHours() % 12 || 12,
          minute: new Date(task.reminderTime).getMinutes(),
          period: new Date(task.reminderTime).getHours() >= 12 ? 'PM' : 'AM'
        } : undefined}
        initialReminder={reminderOffset}
        initialRepeatSettings={repeatSettings}
      />

      {/* TaskDependencySheet */}
      <TaskDependencySheet
        isOpen={showDependencySheet}
        onClose={() => setShowDependencySheet(false)}
        task={task}
        allTasks={allTasks}
        onSave={(dependsOn) => onUpdate({ ...task, dependsOn })}
      />

      {/* Subtask Input Sheet - full featured like main task */}
      <TaskInputSheet
        isOpen={isSubtaskInputSheetOpen}
        onClose={() => setIsSubtaskInputSheetOpen(false)}
        onAddTask={handleAddSubtaskFromSheet}
        folders={folders}
        selectedFolderId={task.folderId}
        onCreateFolder={() => {}}
      />

      {/* Subtask Detail Sheet */}
      <SubtaskDetailSheet
        isOpen={showSubtaskDetailSheet}
        subtask={selectedSubtask}
        parentId={task.id}
        onClose={() => {
          setShowSubtaskDetailSheet(false);
          setSelectedSubtask(null);
        }}
        onUpdate={handleUpdateSubtask}
        onDelete={handleDeleteSubtaskFromSheet}
        onConvertToTask={handleConvertSubtaskToTask}
      />


      {/* In-App Attachment Preview */}
      {previewAttachment && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col" onClick={() => setPreviewAttachment(null)}>
          <div className="flex items-center justify-between px-4 py-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
            <p className="text-white text-sm font-medium truncate flex-1">{previewAttachment.name}</p>
            <button onClick={() => setPreviewAttachment(null)} className="p-2 text-white">
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 overflow-auto" onClick={(e) => e.stopPropagation()}>
            {previewAttachment.type?.startsWith('image/') ? (
              <img src={previewAttachment.url} alt={previewAttachment.name} className="max-w-full max-h-full object-contain rounded-lg" />
            ) : previewAttachment.type === 'application/pdf' ? (
              <iframe src={previewAttachment.url} className="w-full h-full rounded-lg bg-white" title={previewAttachment.name} />
            ) : previewAttachment.type?.startsWith('video/') ? (
              <video src={previewAttachment.url} controls className="max-w-full max-h-full rounded-lg" />
            ) : previewAttachment.type?.startsWith('audio/') ? (
              <audio src={previewAttachment.url} controls className="w-full max-w-md" />
            ) : (
              <iframe src={previewAttachment.url} className="w-full h-full rounded-lg bg-white" title={previewAttachment.name} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
