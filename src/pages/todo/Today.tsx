import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { recordCompletion, TASK_STREAK_KEY } from '@/utils/streakStorage';

import { useTranslation } from 'react-i18next';
import { TodoItem, Folder, Priority, Note, TaskSection, TaskStatus } from '@/types/note';
import { useGlobalTags } from '@/hooks/useGlobalTags';
import { WaveformProgressBar } from '@/components/WaveformProgressBar';
import { Play, Pause, Repeat, Check, Trash2 as TrashIcon, Edit, Plus as PlusIcon, ArrowUpCircle, ArrowDownCircle, Move, History, TrendingUp, Flag, MapPin, ChevronsUpDown, Circle, Loader2, Clock as ClockIcon, Pin } from 'lucide-react';
import { Plus, FolderIcon, ChevronRight, ChevronDown, MoreVertical, Eye, EyeOff, Filter, Copy, MousePointer2, FolderPlus, Settings, LayoutList, LayoutGrid, Trash2, ListPlus, Tag, ArrowDownAZ, ArrowUpDown, Sun, Columns3, GitBranch, X, Search, ListChecks, Star, Crown } from 'lucide-react';
import { LocationRemindersMap } from '@/components/LocationRemindersMap';
import { TaskWidgets } from '@/components/TaskWidgets';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TaskInputSheet } from '@/components/TaskInputSheet';
import { TaskDetailPage } from '@/components/TaskDetailPage';
import { TaskItem } from '@/components/TaskItem';
import { TaskFilterSheet, DateFilter, PriorityFilter, StatusFilter } from '@/components/TaskFilterSheet';
import { DuplicateOptionsSheet, DuplicateOption } from '@/components/DuplicateOptionsSheet';
import { FolderManageSheet } from '@/components/FolderManageSheet';
import { MoveToFolderSheet } from '@/components/MoveToFolderSheet';
import { TaskMoveSheet } from '@/components/TaskMoveSheet';
import { SelectActionsSheet, SelectAction } from '@/components/SelectActionsSheet';
import { PrioritySelectSheet } from '@/components/PrioritySelectSheet';
import { BatchTaskSheet } from '@/components/BatchTaskSheet';
import { SectionEditSheet } from '@/components/SectionEditSheet';
import { SectionMoveSheet } from '@/components/SectionMoveSheet';
import { TaskOptionsSheet } from '@/components/TaskOptionsSheet';
import { BulkDateSheet } from '@/components/BulkDateSheet';
import { BulkReminderSheet } from '@/components/BulkReminderSheet';
import { BulkRepeatSheet } from '@/components/BulkRepeatSheet';
import { BulkSectionMoveSheet } from '@/components/BulkSectionMoveSheet';
import { BulkStatusSheet } from '@/components/BulkStatusSheet';

import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { SubtaskDetailSheet } from '@/components/SubtaskDetailSheet';
import { SmartListType, getSmartListFilter, useSmartLists } from '@/components/SmartListsDropdown';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

import { createNextRecurringTask } from '@/utils/recurringTasks';
import { archiveCompletedTasks } from '@/utils/taskCleanup';
import { startGeofenceWatching, hasLocationReminders } from '@/utils/geofencing';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Sparkles, AlertCircle, CalendarX, Flame, Clock, CheckCircle2, Calendar as CalendarIcon2, Timer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { TodoLayout } from './TodoLayout';
import { toast } from 'sonner';
import { isToday, isTomorrow, isThisWeek, isBefore, startOfDay, format, isYesterday, subDays } from 'date-fns';
import { loadTodoItems, saveTodoItems, resolveTaskMediaUrl } from '@/utils/todoItemsStorage';
import { updateSectionOrder, applyTaskOrder, removeTaskFromOrders } from '@/utils/taskOrderStorage';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import { ResolvedTaskImage } from '@/components/ResolvedTaskImage';
import { useResolvedTaskMedia } from '@/hooks/useResolvedTaskMedia';
import { ResolvedImageDialog } from '@/components/ResolvedImageDialog';
import { playCompletionSound } from '@/utils/taskSounds';
import { HideDetailsOptions } from '@/components/TaskOptionsSheet';
import { logActivity } from '@/utils/activityLogger';
import { useTasksSettings } from '@/components/TasksSettingsSheet';
import { usePriorities } from '@/hooks/usePriorities';
import { CustomSmartView, loadCustomSmartViews } from '@/utils/customSmartViews';
import { SaveSmartViewSheet } from '@/components/SaveSmartViewSheet';

import { AutoScheduleSheet } from '@/components/AutoScheduleSheet';
import { useSubscription, FREE_LIMITS } from '@/contexts/SubscriptionContext';
import { TASK_CIRCLE, TASK_CHECK_ICON } from '@/utils/taskItemStyles';
import { StreakChallengeDialog, useStreakChallengeDialog } from '@/components/StreakChallengeDialog';
import { useStreak } from '@/hooks/useStreak';

type ViewMode = 'flat' | 'kanban' | 'kanban-status' | 'timeline' | 'progress' | 'priority' | 'history';
type SortBy = 'date' | 'priority' | 'name' | 'created';

const getDefaultSections = (t: (key: string) => string): TaskSection[] => [
  { id: 'default', name: t('grouping.tasks'), color: '#3b82f6', isCollapsed: false, order: 0 }
];

const Today = () => {
  const { t } = useTranslation();
  const tasksSettings = useTasksSettings();
  const { getPriorityColor, getPriorityName } = usePriorities();
  const { requireFeature, isPro } = useSubscription();
  const { tags: allGlobalTags } = useGlobalTags();
  const [items, setItems] = useState<TodoItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [sections, setSections] = useState<TaskSection[]>(getDefaultSections(t));
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [inputSectionId, setInputSectionId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TodoItem | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(tasksSettings.showCompletedTasks);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isDuplicateSheetOpen, setIsDuplicateSheetOpen] = useState(false);
  const [isFolderManageOpen, setIsFolderManageOpen] = useState(false);
  const [isMoveToFolderOpen, setIsMoveToFolderOpen] = useState(false);
  const [isSelectActionsOpen, setIsSelectActionsOpen] = useState(false);
  const [isPrioritySheetOpen, setIsPrioritySheetOpen] = useState(false);
  const [isBatchTaskOpen, setIsBatchTaskOpen] = useState(false);
  const [isSectionEditOpen, setIsSectionEditOpen] = useState(false);
  const [isSectionMoveOpen, setIsSectionMoveOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<TaskSection | null>(null);
  const [selectedSubtask, setSelectedSubtask] = useState<{ subtask: TodoItem; parentId: string } | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [smartList, setSmartList] = useState<SmartListType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('flat');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [hideDetailsOptions, setHideDetailsOptions] = useState<HideDetailsOptions>({ hideDateTime: true, hideStatus: true, hideSubtasks: true });
  const [dropdownView, setDropdownView] = useState<'main' | 'smartLists' | 'sortBy' | 'groupBy'>('main');
  const [compactMode, setCompactMode] = useState<boolean>(false);
  const [groupByOption, setGroupByOption] = useState<'none' | 'section' | 'priority' | 'date'>('none');
  const [subtaskSwipeState, setSubtaskSwipeState] = useState<{ id: string; parentId: string; x: number; isSwiping: boolean } | null>(null);
  const subtaskTouchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [pendingCompleteId, setPendingCompleteId] = useState<string | null>(null);
  const pendingCompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const smartListData = useSmartLists(items);
  const [viewModeSearch, setViewModeSearch] = useState(''); // Search within view modes
  const [isLocationMapOpen, setIsLocationMapOpen] = useState(false);
  const [isBulkDateSheetOpen, setIsBulkDateSheetOpen] = useState(false);
  const [isBulkReminderSheetOpen, setIsBulkReminderSheetOpen] = useState(false);
  const [isBulkRepeatSheetOpen, setIsBulkRepeatSheetOpen] = useState(false);
  const [isBulkSectionMoveOpen, setIsBulkSectionMoveOpen] = useState(false);
  const [isBulkStatusOpen, setIsBulkStatusOpen] = useState(false);
  const [isTaskOptionsOpen, setIsTaskOptionsOpen] = useState(false);
  // Counter to force re-render after drag-drop reordering
  const [orderVersion, setOrderVersion] = useState(0);
  // New task options state
  const [defaultSectionId, setDefaultSectionId] = useState<string | undefined>();
  const [taskAddPosition, setTaskAddPosition] = useState<'top' | 'bottom'>('top');
  const [showStatusBadge, setShowStatusBadge] = useState<boolean>(true);
  const [groupBy, setGroupBy] = useState<'custom' | 'date' | 'priority'>('custom');
  const [optionsSortBy, setOptionsSortBy] = useState<'custom' | 'date' | 'priority'>('custom');
  // Flag to prevent saving settings before they're loaded from IndexedDB
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<TodoItem | null>(null);
  const [customSmartViews, setCustomSmartViews] = useState<CustomSmartView[]>([]);
  const [activeCustomViewId, setActiveCustomViewId] = useState<string | null>(null);
  const [isSaveSmartViewOpen, setIsSaveSmartViewOpen] = useState(false);
  const { showDialog: showStreakChallenge, closeDialog: closeStreakChallenge } = useStreakChallengeDialog();
  const { data: streakData, weekData: streakWeekData } = useStreak({ autoCheck: false });
  
  const [isAutoScheduleOpen, setIsAutoScheduleOpen] = useState(false);
  
  // Single task swipe action states
  const [swipeMoveTaskId, setSwipeMoveTaskId] = useState<string | null>(null);
  const [swipeDateTaskId, setSwipeDateTaskId] = useState<string | null>(null);
  
  // Sync showCompleted with tasks settings
  useEffect(() => {
    setShowCompleted(tasksSettings.showCompletedTasks);
  }, [tasksSettings.showCompletedTasks]);

  useEffect(() => {
    const loadAll = async () => {
      let loadedItems = await loadTodoItems();
      
      // Auto-rollover repeat tasks that are overdue
      const { processTaskRollovers } = await import('@/utils/taskRollover');
      const { tasks: rolledOverItems, rolledOverCount } = processTaskRollovers(loadedItems);
      if (rolledOverCount > 0) {
        await saveTodoItems(rolledOverItems);
        loadedItems = rolledOverItems;
        toast.info(t('todayPage.autoUpdatedRecurring', { count: rolledOverCount }), { icon: '🔄' });
      }
      
      // Auto-archive completed tasks older than 3 days
      const { activeTasks, archivedCount } = await archiveCompletedTasks(loadedItems, 3);
      if (archivedCount > 0) {
        await saveTodoItems(activeTasks);
        loadedItems = activeTasks;
        toast.info(t('todayPage.archivedCompleted', { count: archivedCount }), { icon: '📦' });
      }
      
      setItems(loadedItems);
      // Notification rescheduling removed
    };
    loadAll();

    // Load settings from IndexedDB
    const loadSettings = async () => {
      const savedFolders = await getSetting<Folder[] | null>('todoFolders', null);
      if (savedFolders) {
        setFolders(savedFolders.map((f: Folder) => ({ ...f, createdAt: new Date(f.createdAt) })));
      }

      const savedSections = await getSetting<TaskSection[]>('todoSections', []);
      setSections(savedSections.length > 0 ? savedSections : getDefaultSections(t));

      const savedShowCompleted = await getSetting<boolean>('todoShowCompleted', true);
      setShowCompleted(savedShowCompleted);
      
      const savedDateFilter = await getSetting<DateFilter>('todoDateFilter', 'all');
      setDateFilter(savedDateFilter);
      
      const savedPriorityFilter = await getSetting<PriorityFilter>('todoPriorityFilter', 'all');
      setPriorityFilter(savedPriorityFilter);
      
      const savedStatusFilter = await getSetting<StatusFilter>('todoStatusFilter', 'all');
      setStatusFilter(savedStatusFilter);
      
      const savedTagFilter = await getSetting<string[]>('todoTagFilter', []);
      setTagFilter(savedTagFilter);
      
      const savedViewMode = await getSetting<ViewMode>('todoViewMode', 'flat');
      setViewMode(savedViewMode);
      
      const savedHideDetails = await getSetting<HideDetailsOptions>('todoHideDetailsOptions', { hideDateTime: true, hideStatus: true, hideSubtasks: true });
      setHideDetailsOptions(savedHideDetails);
      
      const savedSortBy = await getSetting<SortBy>('todoSortBy', 'date');
      setSortBy(savedSortBy);
      
      const savedSmartList = await getSetting<SmartListType>('todoSmartList', 'all');
      setSmartList(savedSmartList);
      
      const savedFolderId = await getSetting<string | null>('todoSelectedFolder', null);
      setSelectedFolderId(savedFolderId === 'null' ? null : savedFolderId);
      
      const savedDefaultSection = await getSetting<string>('todoDefaultSectionId', '');
      setDefaultSectionId(savedDefaultSection || undefined);
      
      const savedTaskAddPos = await getSetting<'top' | 'bottom'>('todoTaskAddPosition', 'bottom');
      setTaskAddPosition(savedTaskAddPos);
      
      const savedShowStatusBadge = await getSetting<boolean>('todoShowStatusBadge', true);
      setShowStatusBadge(savedShowStatusBadge);
      
      const savedCompactMode = await getSetting<boolean>('todoCompactMode', false);
      setCompactMode(savedCompactMode);
      
      const savedGroupByOption = await getSetting<'none' | 'section' | 'priority' | 'date'>('todoGroupByOption', 'none');
      setGroupByOption(savedGroupByOption);
      
      // Mark settings as loaded to enable saving
      setSettingsLoaded(true);
    };
    loadSettings();

    // Load custom smart views
    loadCustomSmartViews().then(setCustomSmartViews);

    // Listen for tasks restored from cloud sync
    const handleTasksRestored = async () => {
      console.log('[Today] Tasks restored from cloud, refreshing...');
      const loadedItems = await loadTodoItems();
      setItems(loadedItems);
      toast.success(t('todayPage.tasksSyncedFromCloud'), { icon: '☁️' });
    };

    // Listen for sections restored from cloud sync
    const handleSectionsRestored = async () => {
      console.log('[Today] Sections restored from cloud, refreshing...');
      const savedSections = await getSetting<TaskSection[]>('todoSections', []);
      setSections(savedSections.length > 0 ? savedSections : getDefaultSections(t));
    };

    // Listen for folders restored from cloud sync
    const handleFoldersRestored = async () => {
      console.log('[Today] Folders restored from cloud, refreshing...');
      const savedFolders = await getSetting<Folder[] | null>('todoFolders', null);
      if (savedFolders) {
        setFolders(savedFolders.map((f: Folder) => ({ ...f, createdAt: new Date(f.createdAt) })));
      }
    };

    window.addEventListener('tasksRestored', handleTasksRestored);
    window.addEventListener('sectionsRestored', handleSectionsRestored);
    window.addEventListener('foldersRestored', handleFoldersRestored);

    return () => {
      window.removeEventListener('tasksRestored', handleTasksRestored);
      window.removeEventListener('sectionsRestored', handleSectionsRestored);
      window.removeEventListener('foldersRestored', handleFoldersRestored);
    };
  }, []);

  // Debounced save - don't save on every single state change
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  
  useEffect(() => {
    if (items.length === 0) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveTodoItems(itemsRef.current).then(({ persisted }) => {
        if (!persisted) {
          toast.error(t('todayPage.storageFull'), { id: 'storage-full' });
        }
      });
      window.dispatchEvent(new Event('tasksUpdated'));
    }, 800);
    
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [items]);
  // Only save settings AFTER they have been loaded from IndexedDB to prevent race conditions
  useEffect(() => { if (settingsLoaded) setSetting('todoFolders', folders); }, [folders, settingsLoaded]);
  useEffect(() => { if (settingsLoaded) setSetting('todoSections', sections); }, [sections, settingsLoaded]);
  useEffect(() => { if (settingsLoaded) setSetting('todoShowCompleted', showCompleted); }, [showCompleted, settingsLoaded]);
  useEffect(() => { 
    if (!settingsLoaded) return;
    setSetting('todoDateFilter', dateFilter); 
    setSetting('todoPriorityFilter', priorityFilter);
    setSetting('todoStatusFilter', statusFilter);
    setSetting('todoTagFilter', tagFilter);
  }, [dateFilter, priorityFilter, statusFilter, tagFilter, settingsLoaded]);
  useEffect(() => { if (settingsLoaded) { setSetting('todoViewMode', viewMode); logActivity('view_mode_change', `View mode: ${viewMode}`); } }, [viewMode, settingsLoaded]);
  useEffect(() => { if (settingsLoaded) setSetting('todoHideDetailsOptions', hideDetailsOptions); }, [hideDetailsOptions, settingsLoaded]);
  useEffect(() => { if (settingsLoaded) { setSetting('todoSortBy', sortBy); logActivity('sort_change', `Sort by: ${sortBy}`); } }, [sortBy, settingsLoaded]);
  useEffect(() => { if (settingsLoaded) { setSetting('todoSmartList', smartList); logActivity('smart_list_change', `Smart list: ${smartList}`); } }, [smartList, settingsLoaded]);
  useEffect(() => { if (settingsLoaded) setSetting('todoSelectedFolder', selectedFolderId || 'null'); }, [selectedFolderId, settingsLoaded]);
  useEffect(() => { if (settingsLoaded) setSetting('todoDefaultSectionId', defaultSectionId || ''); }, [defaultSectionId, settingsLoaded]);
  useEffect(() => { if (settingsLoaded) setSetting('todoTaskAddPosition', taskAddPosition); }, [taskAddPosition, settingsLoaded]);
  useEffect(() => { if (settingsLoaded) setSetting('todoShowStatusBadge', showStatusBadge); }, [showStatusBadge, settingsLoaded]);
  useEffect(() => { if (settingsLoaded) { setSetting('todoCompactMode', compactMode); logActivity('compact_mode_toggle', `Compact mode: ${compactMode}`); } }, [compactMode, settingsLoaded]);
  useEffect(() => { if (settingsLoaded) { setSetting('todoGroupByOption', groupByOption); logActivity('group_by_change', `Group by: ${groupByOption}`); } }, [groupByOption, settingsLoaded]);

  // Start geofencing for location-based reminders
  useEffect(() => {
    if (hasLocationReminders(items)) {
      const stopWatching = startGeofenceWatching(() => items);
      return stopWatching;
    }
  }, [items]);

  const handleCreateFolder = (name: string, color: string) => {
    // Free users limited to 3 folders
    if (!isPro && folders.length >= FREE_LIMITS.maxTaskFolders) {
      requireFeature('extra_folders');
      return;
    }
    const newFolder: Folder = { id: Date.now().toString(), name, color, isDefault: false, createdAt: new Date() };
    setFolders([...folders, newFolder]);
  };

  const handleEditFolder = (folderId: string, name: string, color: string) => {
    setFolders(folders.map(f => f.id === folderId ? { ...f, name, color } : f));
  };

  const handleDeleteFolder = (folderId: string) => {
    setItems(items.map(item => item.folderId === folderId ? { ...item, folderId: undefined } : item));
    setFolders(folders.filter(f => f.id !== folderId));
    if (selectedFolderId === folderId) setSelectedFolderId(null);
  };

  const handleReorderFolders = (reorderedFolders: Folder[]) => {
    setFolders(reorderedFolders);
    toast.success(t('todayPage.foldersReordered'));
  };

  const handleToggleFolderFavorite = (folderId: string) => {
    setFolders(folders.map(f => f.id === folderId ? { ...f, isFavorite: !f.isFavorite } : f));
    const folder = folders.find(f => f.id === folderId);
    toast.success(folder?.isFavorite ? t('todayPage.removedFromFavorites') : t('todayPage.addedToFavorites'), { icon: '⭐' });
  };


  const handleSectionDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    
    if (sourceIndex === destIndex) return;
    
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
    
    const sortedSects = [...sections].sort((a, b) => a.order - b.order);
    const [removed] = sortedSects.splice(sourceIndex, 1);
    sortedSects.splice(destIndex, 0, removed);
    
    const reordered = sortedSects.map((s, idx) => ({ ...s, order: idx }));
    setSections(reordered);
  };

  const handleAddTask = async (task: Omit<TodoItem, 'id' | 'completed'>) => {
    const now = new Date();
    const newItem: TodoItem = { 
      id: Date.now().toString(), 
      completed: false, 
      ...task, // Spread FIRST so our overrides below take priority
      sectionId: task.sectionId || inputSectionId || defaultSectionId || sections[0]?.id,
      dueDate: task.dueDate || new Date(), // Default to current date if no date specified
      createdAt: now,
      modifiedAt: now,
      status: task.status || 'not_started', // Default status
      // Default reminder to "instant" if task has date/time but no reminder set
      reminderTime: (task.dueDate && !task.reminderTime) ? task.dueDate : task.reminderTime,
    };

    // Add task to state FIRST (non-blocking) so UI updates immediately
    if (taskAddPosition === 'bottom') {
      setItems([...items, newItem]);
    } else {
      setItems([newItem, ...items]);
    }
    setInputSectionId(null);

    // Schedule reminder in background (non-blocking)
    if (newItem.reminderTime) {
      import('@/utils/reminderScheduler').then(({ scheduleTaskReminder }) => {
        scheduleTaskReminder(newItem.id, newItem.text, new Date(newItem.reminderTime!)).catch(console.warn);
      });
    }
  };

  const handleBatchAddTasks = async (taskTexts: string[], sectionId?: string, folderId?: string, priority?: Priority, dueDate?: Date) => {
    const now = new Date();
    const newItems: TodoItem[] = taskTexts.map((text, idx) => ({
      id: `${Date.now()}-${idx}`,
      text,
      completed: false,
      folderId: folderId || selectedFolderId || undefined,
      sectionId: sectionId || inputSectionId || sections[0]?.id,
      priority: priority,
      dueDate: dueDate || new Date(), // Default to current date if no date specified
      createdAt: now,
      modifiedAt: now,
    }));
    setItems([...newItems, ...items]);
    toast.success(t('todayPage.addedTasks', { count: newItems.length }));
    setInputSectionId(null);
  };

  // Section management functions
  const handleAddSection = (position: 'above' | 'below', referenceId?: string) => {
    // Free users limited to 1 section
    if (!isPro && sections.length >= 1) {
      requireFeature('extra_sections');
      return;
    }
    const maxOrder = Math.max(...sections.map(s => s.order), 0);
    let newOrder = maxOrder + 1;
    
    if (referenceId) {
      const refSection = sections.find(s => s.id === referenceId);
      if (refSection) {
        if (position === 'above') {
          newOrder = refSection.order - 0.5;
        } else {
          newOrder = refSection.order + 0.5;
        }
      }
    }

    const newSection: TaskSection = {
      id: Date.now().toString(),
      name: t('todayPage.newSection'),
      color: '#3b82f6',
      isCollapsed: false,
      order: newOrder,
    };

    const updatedSections = [...sections, newSection]
      .sort((a, b) => a.order - b.order)
      .map((s, idx) => ({ ...s, order: idx }));

    setSections(updatedSections);
    setEditingSection(newSection);
    setIsSectionEditOpen(true);
    toast.success(t('todayPage.sectionAdded'));
  };

  const handleEditSection = (section: TaskSection) => {
    setEditingSection(section);
    setIsSectionEditOpen(true);
  };

  const handleSaveSection = (updatedSection: TaskSection) => {
    setSections(prev => {
      const exists = prev.some(s => s.id === updatedSection.id);
      if (exists) {
        return prev.map(s => s.id === updatedSection.id ? updatedSection : s);
      }
      // Section was just created, it's already in the list
      return prev.map(s => s.id === updatedSection.id ? updatedSection : s);
    });
  };

  const handleDeleteSection = (sectionId: string) => {
    if (sections.length <= 1) {
      toast.error(t('todayPage.cannotDeleteLastSection'));
      return;
    }
    // Move tasks to the first remaining section
    const remainingSections = sections.filter(s => s.id !== sectionId);
    const firstSection = remainingSections.sort((a, b) => a.order - b.order)[0];
    setItems(items.map(item => item.sectionId === sectionId ? { ...item, sectionId: firstSection.id } : item));
    setSections(remainingSections);
    toast.success(t('todayPage.sectionDeleted'));
  };

  const handleDuplicateSection = (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    const maxOrder = Math.max(...sections.map(s => s.order), 0);
    const newSection: TaskSection = {
      ...section,
      id: Date.now().toString(),
      name: `${section.name} (Copy)`,
      order: maxOrder + 1,
    };

    // Duplicate tasks in this section
    const sectionTasks = items.filter(i => i.sectionId === sectionId && !i.completed);
    const duplicatedTasks = sectionTasks.map((task, idx) => ({
      ...task,
      id: `${Date.now()}-${idx}`,
      sectionId: newSection.id,
    }));

    setSections([...sections, newSection]);
    setItems([...duplicatedTasks, ...items]);
    toast.success(t('todayPage.sectionDuplicated'));
  };

  const handleMoveSection = (sectionId: string, targetIndex: number) => {
    const sortedSections = [...sections].sort((a, b) => a.order - b.order);
    const currentIndex = sortedSections.findIndex(s => s.id === sectionId);
    if (currentIndex === targetIndex) return;

    const [movedSection] = sortedSections.splice(currentIndex, 1);
    sortedSections.splice(targetIndex, 0, movedSection);
    
    const reorderedSections = sortedSections.map((s, idx) => ({ ...s, order: idx }));
    setSections(reorderedSections);
    toast.success(t('todayPage.sectionMoved'));
  };

  const handleToggleSectionCollapse = (sectionId: string) => {
    // Use the unified collapsedViewSections for flat layout sections
    const flatSectionId = `flat-${sectionId}`;
    setCollapsedViewSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(flatSectionId)) {
        newSet.delete(flatSectionId);
      } else {
        newSet.add(flatSectionId);
      }
      return newSet;
    });
  };

  const handleAddTaskToSection = async (sectionId: string) => {
    try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
    setInputSectionId(sectionId);
    setIsInputOpen(true);
  };

  const updateItem = async (itemId: string, updates: Partial<TodoItem>) => {
    const currentItem = items.find(i => i.id === itemId);
    const now = new Date();
    
    // Add modifiedAt timestamp
    const updatesWithTimestamp: Partial<TodoItem> = {
      ...updates,
      modifiedAt: now,
    };
    
    // Add completedAt timestamp when completing a task
    if (updates.completed === true && currentItem && !currentItem.completed) {
      updatesWithTimestamp.completedAt = now;
      playCompletionSound();
      
      // Cancel reminder when task is completed
      import('@/utils/reminderScheduler').then(({ cancelTaskReminder }) => {
        cancelTaskReminder(itemId).catch(console.warn);
      });
      // Record streak completion
      try {
        const streakResult = await recordCompletion(TASK_STREAK_KEY);
        if (streakResult.newMilestone) {
          toast.success(t('todayPage.streakMilestone', { days: streakResult.newMilestone }));
          window.dispatchEvent(new CustomEvent('streakMilestone', { detail: { milestone: streakResult.newMilestone } }));
        }
        if (streakResult.earnedFreeze) {
          toast.success(t('todayPage.earnedStreakFreeze'), { description: t('todayPage.earnedStreakFreezeDesc') });
        }
        if (streakResult.streakIncremented) {
          window.dispatchEvent(new CustomEvent('streakChallengeShow', { detail: { currentStreak: streakResult.data.currentStreak } }));
        }
        window.dispatchEvent(new CustomEvent('streakUpdated'));
      } catch (e) { console.warn('Failed to record streak:', e); }
    }
    
    // Clear completedAt if uncompleting a task
    if (updates.completed === false && currentItem?.completed) {
      updatesWithTimestamp.completedAt = undefined;
    }
    
    // Check if this is a recurring task being completed
    if (currentItem && updates.completed === true && !currentItem.completed) {
      if (currentItem.repeatType && currentItem.repeatType !== 'none') {
        const nextTask = createNextRecurringTask(currentItem);
        if (nextTask) {
          // Add the next occurrence with timestamps
          const nextTaskWithTimestamps = {
            ...nextTask,
            createdAt: now,
            modifiedAt: now,
          };
          setItems(prevItems => [
            nextTaskWithTimestamps,
            ...prevItems.map(i => i.id === itemId ? { ...i, ...updatesWithTimestamp } : i)
          ]);
          toast.success(t('todayPage.recurringTaskCompleted'), {
            icon: '🔄',
          });
          return;
        }
      }
    }
    
    setItems(items.map((i) => (i.id === itemId ? { ...i, ...updatesWithTimestamp } : i)));

    // Show undo toast when completing a task
    if (updates.completed === true && currentItem && !currentItem.completed) {
      toast.success(t('todayPage.taskCompleted'), {
        action: {
          label: t('todayPage.undo'),
          onClick: () => {
            setItems(prev => prev.map(i => i.id === itemId ? { ...i, completed: false, completedAt: undefined, modifiedAt: new Date() } : i));
            toast.success(t('todayPage.taskRestored'));
          }
        },
        duration: 5000,
      });
    }
  };

  const deleteItem = async (itemId: string, _showUndo: boolean = false, skipConfirm: boolean = false) => {
    const deletedItem = items.find(item => item.id === itemId);
    if (!deletedItem) return;
    
    // Check if confirmation is required
    if (tasksSettings.confirmBeforeDelete && !skipConfirm) {
      setDeleteConfirmItem(deletedItem);
      return;
    }
    
    try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
    setItems(items.filter((item) => item.id !== itemId));
    
    toast.success(t('todayPage.taskDeleted'), {
      action: {
        label: t('todayPage.undo'),
        onClick: () => {
          setItems(prev => [deletedItem, ...prev]);
          toast.success(t('todayPage.taskRestored'));
        }
      },
      duration: 5000,
    });
  };
  
  // Confirm delete handler
  const confirmDelete = async () => {
    if (!deleteConfirmItem) return;
    try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
    const deletedItem = deleteConfirmItem;
    setItems(items.filter((item) => item.id !== deletedItem.id));
    setDeleteConfirmItem(null);
    
    toast.success(t('todayPage.taskDeleted'), {
      action: {
        label: t('todayPage.undo'),
        onClick: () => {
          setItems(prev => [deletedItem, ...prev]);
          toast.success(t('todayPage.taskRestored'));
        }
      },
      duration: 5000,
    });
  };

  // Unified reorder handler for drag-and-drop
  const handleUnifiedReorder = useCallback((updatedItems: TodoItem[]) => {
    setItems(prevItems => {
      // Keep completed items unchanged
      const completedItems = prevItems.filter(item => item.completed);
      return [...updatedItems, ...completedItems];
    });
  }, []);

  // Section reorder handler for drag-and-drop
  const handleSectionReorder = useCallback((updatedSections: TaskSection[]) => {
    setSections(updatedSections);
  }, []);

  // Handle subtask updates
  const handleUpdateSubtaskFromSheet = useCallback((parentId: string, subtaskId: string, updates: Partial<TodoItem>) => {
    const now = new Date();
    const updatesWithTimestamp: Partial<TodoItem> = {
      ...updates,
      modifiedAt: now,
    };
    
    // Add completedAt when completing a subtask
    if (updates.completed === true) {
      updatesWithTimestamp.completedAt = now;
    }
    // Clear completedAt if uncompleting
    if (updates.completed === false) {
      updatesWithTimestamp.completedAt = undefined;
    }
    
    setItems(prevItems => prevItems.map(item => {
      if (item.id === parentId && item.subtasks) {
        return {
          ...item,
          modifiedAt: now, // Also update parent's modifiedAt
          subtasks: item.subtasks.map(st => st.id === subtaskId ? { ...st, ...updatesWithTimestamp } : st)
        };
      }
      return item;
    }));
  }, []);

  // Handle subtask deletion
  const handleDeleteSubtaskFromSheet = useCallback((parentId: string, subtaskId: string) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id === parentId && item.subtasks) {
        return {
          ...item,
          subtasks: item.subtasks.filter(st => st.id !== subtaskId)
        };
      }
      return item;
    }));
  }, []);

  // Convert subtask to main task
  const handleConvertSubtaskToTask = useCallback((parentId: string, subtask: TodoItem) => {
    setItems(prevItems => {
      // Remove subtask from parent
      const updatedItems = prevItems.map(item => {
        if (item.id === parentId && item.subtasks) {
          return {
            ...item,
            subtasks: item.subtasks.filter(st => st.id !== subtask.id)
          };
        }
        return item;
      });
      
      // Add as new main task
      const newTask: TodoItem = {
        ...subtask,
        sectionId: prevItems.find(i => i.id === parentId)?.sectionId || sections[0]?.id,
      };
      
      return [newTask, ...updatedItems];
    });
  }, [sections]);

  const duplicateTask = async (task: TodoItem) => {
    try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
    const duplicatedTask: TodoItem = { ...task, id: Date.now().toString(), completed: false, text: `${task.text} (Copy)` };
    setItems([duplicatedTask, ...items]);
  };

  const handleSelectTask = (taskId: string) => {
    setSelectedTaskIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) newSet.delete(taskId);
      else newSet.add(taskId);
      return newSet;
    });
  };

  const handleDuplicate = (option: DuplicateOption) => {
    const filteredItems = selectedFolderId ? items.filter(i => i.folderId === selectedFolderId) : items;
    let toDuplicate: TodoItem[] = [];

    if (option === 'uncompleted') {
      toDuplicate = filteredItems.filter(i => !i.completed);
    } else {
      toDuplicate = filteredItems;
    }

    const duplicated = toDuplicate.map((item, idx) => ({
      ...item,
      id: `${Date.now()}-${idx}`,
      completed: option === 'all-reset' ? false : item.completed,
      text: `${item.text} (Copy)`
    }));

    setItems([...duplicated, ...items]);
    toast.success(t('todayPage.duplicatedTasks', { count: duplicated.length }));
  };

  const handleSelectAction = (action: SelectAction) => {
    const selectedItems = items.filter(i => selectedTaskIds.has(i.id));
    
    switch (action) {
      case 'selectAll':
        // Select all uncompleted tasks
        const allTaskIds = new Set(uncompletedItems.map(i => i.id));
        setSelectedTaskIds(allTaskIds);
        toast.success(t('todayPage.selectedTasks', { count: allTaskIds.size }));
        return; // Don't close the sheet
      case 'move':
        setIsMoveToFolderOpen(true);
        break;
      case 'delete':
        setItems(items.filter(i => !selectedTaskIds.has(i.id)));
        setSelectedTaskIds(new Set());
        setIsSelectionMode(false);
        toast.success(t('todayPage.deletedTasks', { count: selectedItems.length }));
        break;
      case 'complete':
        // Play sound for each completed task
        playCompletionSound();
        setItems(items.map(i => selectedTaskIds.has(i.id) ? { ...i, completed: true } : i));
        setSelectedTaskIds(new Set());
        setIsSelectionMode(false);
        toast.success(t('todayPage.completedTasks', { count: selectedItems.length }));
        break;
      case 'pin':
        if (!requireFeature('pin_feature')) return;
        setItems(items.map(i => selectedTaskIds.has(i.id) ? { ...i, isPinned: !i.isPinned } : i));
        toast.success(t('todayPage.pinnedTasks', { count: selectedItems.length }));
        setSelectedTaskIds(new Set());
        setIsSelectionMode(false);
        break;
      case 'priority':
        setIsPrioritySheetOpen(true);
        break;
      case 'duplicate':
        const duplicated = selectedItems.map((item, idx) => ({
          ...item,
          id: `${Date.now()}-${idx}`,
          completed: false,
          text: `${item.text} (Copy)`
        }));
        setItems([...duplicated, ...items]);
        setSelectedTaskIds(new Set());
        setIsSelectionMode(false);
        toast.success(t('todayPage.duplicatedTasks', { count: selectedItems.length }));
        break;
      case 'convert':
        convertToNotes(selectedItems);
        break;
      case 'setDueDate':
        setIsBulkDateSheetOpen(true);
        break;
      case 'setReminder':
        setIsBulkReminderSheetOpen(true);
        break;
      case 'setRepeat':
        setIsBulkRepeatSheetOpen(true);
        break;
      case 'moveToSection':
        setIsBulkSectionMoveOpen(true);
        break;
      case 'setStatus':
        if (!requireFeature('task_status')) return;
        setIsBulkStatusOpen(true);
        break;
    }
    setIsSelectActionsOpen(false);
  };

  const handleMoveToFolder = (folderId: string | null) => {
    setItems(items.map(i => selectedTaskIds.has(i.id) ? { ...i, folderId: folderId || undefined } : i));
    setSelectedTaskIds(new Set());
    setIsSelectionMode(false);
    toast.success(t('todayPage.movedTasks', { count: selectedTaskIds.size }));
  };

  const handleSetPriority = (priority: Priority) => {
    setItems(items.map(i => selectedTaskIds.has(i.id) ? { ...i, priority } : i));
    setSelectedTaskIds(new Set());
    setIsSelectionMode(false);
    toast.success(t('todayPage.updatedPriority', { count: selectedTaskIds.size }));
  };

  const convertToNotes = async (tasksToConvert: TodoItem[]) => {
    const { loadNotesFromDB, saveNotesToDB } = await import('@/utils/noteStorage');
    const existingNotes = await loadNotesFromDB();
    
    const newNotes: Note[] = tasksToConvert.map((task, idx) => ({
      id: `${Date.now()}-${idx}`,
      type: 'regular' as const,
      title: task.text,
      content: task.description || '',
      voiceRecordings: [],
      images: task.imageUrl ? [task.imageUrl] : [],
      syncVersion: 1,
      syncStatus: 'pending' as const,
      isDirty: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await saveNotesToDB([...newNotes, ...existingNotes]);
    setItems(items.filter(i => !tasksToConvert.some(t => t.id === i.id)));
    setSelectedTaskIds(new Set());
    setIsSelectionMode(false);
    toast.success(t('todayPage.convertedToNotes', { count: tasksToConvert.length }));
  };

  const handleConvertSingleTask = (task: TodoItem) => {
    convertToNotes([task]);
  };

  const handleMoveTaskToFolder = (taskId: string, folderId: string | null) => {
    setItems(items.map(i => i.id === taskId ? { ...i, folderId: folderId || undefined } : i));
    toast.success(t('todayPage.taskMoved'));
  };

  const processedItems = useMemo(() => {
    let filtered = items.filter(item => {
      // Smart list filter (takes precedence)
      if (smartList !== 'all') {
        const smartListFilter = getSmartListFilter(smartList);
        if (!smartListFilter(item)) return false;
      }

      // Folder filter
      const folderMatch = selectedFolderId ? item.folderId === selectedFolderId : true;
      
      // Priority filter
      const priorityMatch = priorityFilter === 'all' ? true : item.priority === priorityFilter;
      
      // Status filter - handles both completion and task status
      let statusMatch = true;
      if (statusFilter === 'completed') statusMatch = item.completed;
      else if (statusFilter === 'uncompleted') statusMatch = !item.completed;
      else if (statusFilter === 'not_started') statusMatch = item.status === 'not_started' || !item.status;
      else if (statusFilter === 'in_progress') statusMatch = item.status === 'in_progress';
      else if (statusFilter === 'almost_done') statusMatch = item.status === 'almost_done';
      
      // Date filter
      let dateMatch = true;
      if (dateFilter !== 'all') {
        const today = startOfDay(new Date());
        const itemDate = item.dueDate ? new Date(item.dueDate) : null;
        
        switch (dateFilter) {
          case 'today':
            dateMatch = itemDate ? isToday(itemDate) : false;
            break;
          case 'tomorrow':
            dateMatch = itemDate ? isTomorrow(itemDate) : false;
            break;
          case 'this-week':
            dateMatch = itemDate ? isThisWeek(itemDate) : false;
            break;
          case 'overdue':
            dateMatch = itemDate ? isBefore(itemDate, today) && !item.completed : false;
            break;
          case 'has-date':
            dateMatch = !!itemDate;
            break;
          case 'no-date':
            dateMatch = !itemDate;
            break;
        }
      }

      // Tag filter
      let tagMatch = true;
      if (tagFilter.length > 0) {
        const itemTagIds = item.tagIds || [];
        tagMatch = tagFilter.some(tag => itemTagIds.includes(tag));
      }
      
      return folderMatch && priorityMatch && statusMatch && dateMatch && tagMatch;
    });

    // Sort based on sortBy state, with pinned items always first
    filtered = [...filtered].sort((a, b) => {
      // Pinned items always come first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      
      // Then sort by selected criteria
      switch (sortBy) {
        case 'date':
          const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          return dateA - dateB;
        case 'priority':
          const priorityOrder = { high: 0, medium: 1, low: 2, undefined: 3 };
          return (priorityOrder[a.priority || 'undefined'] || 3) - (priorityOrder[b.priority || 'undefined'] || 3);
        case 'name':
          return a.text.localeCompare(b.text);
        case 'created':
          return parseInt(b.id) - parseInt(a.id); // Newer first (id is timestamp-based)
        default:
          return 0;
      }
    });

    return filtered;
  }, [items, selectedFolderId, priorityFilter, statusFilter, dateFilter, tagFilter, smartList, sortBy]);

  // Apply view mode search filter
  const searchFilteredItems = useMemo(() => {
    if (!viewModeSearch.trim()) return processedItems;
    const search = viewModeSearch.toLowerCase();
    return processedItems.filter(item => 
      item.text.toLowerCase().includes(search) ||
      item.description?.toLowerCase().includes(search)
    );
  }, [processedItems, viewModeSearch]);

  const uncompletedItems = useMemo(() => searchFilteredItems.filter(item => !item.completed), [searchFilteredItems]);
  const completedItems = useMemo(() => searchFilteredItems.filter(item => item.completed), [searchFilteredItems]);

  const handleClearFilters = () => {
    setSelectedFolderId(null);
    setDateFilter('all');
    setPriorityFilter('all');
    setStatusFilter('all');
    setTagFilter([]);
    setSmartList('all');
  };

  // Priority colors come from Priority Settings (usePriorities)


  // Voice playback state for flat view
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [voiceProgress, setVoiceProgress] = useState(0);
  const [voiceCurrentTime, setVoiceCurrentTime] = useState(0);
  const [voiceDuration, setVoiceDuration] = useState<Record<string, number>>({});
  const [voicePlaybackSpeed, setVoicePlaybackSpeed] = useState(1);
  const [resolvedVoiceUrls, setResolvedVoiceUrls] = useState<Record<string, string>>({});
  const flatAudioRef = useRef<HTMLAudioElement | null>(null);
  const VOICE_PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2];
  
  // Resolve voice URLs for items with voice recordings
  useEffect(() => {
    const resolveUrls = async () => {
      const voiceItems = items.filter(item => item.voiceRecording?.audioUrl);
      for (const item of voiceItems) {
        if (item.voiceRecording && !resolvedVoiceUrls[item.id]) {
          const url = await resolveTaskMediaUrl(item.voiceRecording.audioUrl);
          if (url) {
            setResolvedVoiceUrls(prev => ({ ...prev, [item.id]: url }));
          }
        }
      }
    };
    resolveUrls();
  }, [items]);
  
  // Swipe state for flat view (snap-to-reveal style)
  const [swipeState, setSwipeState] = useState<{ id: string; x: number; isSwiping: boolean; snapped?: 'left' | 'right' } | null>(null);
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const SWIPE_THRESHOLD = 60;
  const SWIPE_ACTION_WIDTH = 60; // Width per action button

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFlatVoicePlay = async (item: TodoItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.voiceRecording) return;

    if (playingVoiceId === item.id && flatAudioRef.current) {
      flatAudioRef.current.pause();
      flatAudioRef.current = null;
      setPlayingVoiceId(null);
      setVoiceProgress(0);
      setVoiceCurrentTime(0);
      return;
    }

    if (flatAudioRef.current) {
      flatAudioRef.current.pause();
      flatAudioRef.current = null;
    }

    // Resolve media ref if needed
    const audioUrl = await resolveTaskMediaUrl(item.voiceRecording.audioUrl);
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audio.playbackRate = voicePlaybackSpeed;
    flatAudioRef.current = audio;
    
    audio.ontimeupdate = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setVoiceProgress((audio.currentTime / audio.duration) * 100);
        setVoiceCurrentTime(audio.currentTime);
      }
    };
    
    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setVoiceDuration(prev => ({ ...prev, [item.id]: Math.round(audio.duration) }));
      }
    };
    
    audio.onended = () => {
      setPlayingVoiceId(null);
      setVoiceProgress(0);
      setVoiceCurrentTime(0);
      flatAudioRef.current = null;
    };
    
    audio.play();
    setPlayingVoiceId(item.id);
  };

  const cycleVoicePlaybackSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIndex = VOICE_PLAYBACK_SPEEDS.indexOf(voicePlaybackSpeed);
    const nextIndex = (currentIndex + 1) % VOICE_PLAYBACK_SPEEDS.length;
    const newSpeed = VOICE_PLAYBACK_SPEEDS[nextIndex];
    setVoicePlaybackSpeed(newSpeed);
    if (flatAudioRef.current) {
      flatAudioRef.current.playbackRate = newSpeed;
    }
  };

  const handleVoiceSeek = (e: React.MouseEvent<HTMLDivElement>, item: TodoItem) => {
    e.stopPropagation();
    if (!flatAudioRef.current || playingVoiceId !== item.id) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const duration = flatAudioRef.current.duration || voiceDuration[item.id] || item.voiceRecording?.duration || 0;
    if (duration && !isNaN(duration)) {
      flatAudioRef.current.currentTime = percentage * duration;
      setVoiceProgress(percentage * 100);
      setVoiceCurrentTime(percentage * duration);
    }
  };

  const handleFlatTouchStart = (itemId: string, e: React.TouchEvent) => {
    // Don't start swipe if swipeToComplete is disabled
    if (!tasksSettings.swipeToComplete) return;
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setSwipeState({ id: itemId, x: 0, isSwiping: false });
  };

  const handleFlatTouchMove = (itemId: string, e: React.TouchEvent) => {
    if (!tasksSettings.swipeToComplete) return;
    if (!swipeState || swipeState.id !== itemId) return;
    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    const deltaY = Math.abs(e.touches[0].clientY - touchStartRef.current.y);
    
    // If vertical movement is greater, don't swipe (user is scrolling)
    if (deltaY > 30 && !swipeState.isSwiping) return;
    
    if (Math.abs(deltaX) > 15) {
      // Limit swipe distance - 2 actions on left (140px), 3 on right (210px)
      const maxSwipeRight = SWIPE_ACTION_WIDTH * 2; // Done + Pin
      const maxSwipeLeft = SWIPE_ACTION_WIDTH * 3; // Move + Delete + Date
      const clampedX = Math.max(-maxSwipeLeft, Math.min(maxSwipeRight, deltaX));
      setSwipeState({ id: itemId, x: clampedX, isSwiping: true });
    }
  };

  const handleFlatTouchEnd = async (item: TodoItem) => {
    if (!tasksSettings.swipeToComplete) return;
    if (!swipeState || swipeState.id !== item.id) return;
    
    const maxSwipeRight = SWIPE_ACTION_WIDTH * 2;
    const maxSwipeLeft = SWIPE_ACTION_WIDTH * 3;
    
    if (swipeState.isSwiping) {
      if (swipeState.x > SWIPE_THRESHOLD) {
        // Snap to reveal left actions (Done + Pin)
        try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
        setSwipeState({ id: item.id, x: maxSwipeRight, isSwiping: false, snapped: 'right' });
        return;
      } else if (swipeState.x < -SWIPE_THRESHOLD) {
        // Snap to reveal right actions (Move + Delete + Date)
        try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
        setSwipeState({ id: item.id, x: -maxSwipeLeft, isSwiping: false, snapped: 'left' });
        return;
      }
    }
    
    setSwipeState(null);
  };
  
  // Handle swipe action button clicks
  const handleSwipeAction = async (action: () => void) => {
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
    action();
    setSwipeState(null);
  };

  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const toggleSubtasks = (taskId: string) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const updateSubtask = async (parentId: string, subtaskId: string, updates: Partial<TodoItem>) => {
    const now = new Date();
    const updatesWithTimestamp: Partial<TodoItem> = {
      ...updates,
      modifiedAt: now,
    };
    
    // Add completedAt when completing
    if (updates.completed === true) {
      updatesWithTimestamp.completedAt = now;
    }
    if (updates.completed === false) {
      updatesWithTimestamp.completedAt = undefined;
    }
    
    setItems(items.map(item => {
      if (item.id === parentId && item.subtasks) {
        return {
          ...item,
          modifiedAt: now,
          subtasks: item.subtasks.map(st => st.id === subtaskId ? { ...st, ...updatesWithTimestamp } : st)
        };
      }
      return item;
    }));
  };

  const deleteSubtask = (parentId: string, subtaskId: string, showUndo: boolean = false) => {
    let deletedSubtask: TodoItem | null = null;
    
    setItems(items.map(item => {
      if (item.id === parentId && item.subtasks) {
        deletedSubtask = item.subtasks.find(st => st.id === subtaskId) || null;
        return {
          ...item,
          subtasks: item.subtasks.filter(st => st.id !== subtaskId)
        };
      }
      return item;
    }));

    if (showUndo && deletedSubtask) {
      const subtaskToRestore = deletedSubtask;
      toast.success(t('todayPage.subtaskDeleted', 'Subtask deleted'), {
        action: {
          label: t('todayPage.undo'),
          onClick: () => {
            setItems(prev => prev.map(item => {
              if (item.id === parentId) {
                return {
                  ...item,
                  subtasks: [...(item.subtasks || []), subtaskToRestore]
                };
              }
              return item;
            }));
            toast.success(t('todayPage.subtaskRestored', 'Subtask restored'));
          }
        },
        duration: 5000,
      });
    }
  };

  const handleSubtaskSwipeStart = (subtaskId: string, parentId: string, e: React.TouchEvent) => {
    if (!tasksSettings.swipeToComplete) return;
    subtaskTouchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setSubtaskSwipeState({ id: subtaskId, parentId, x: 0, isSwiping: false });
  };

  const handleSubtaskSwipeMove = (subtaskId: string, parentId: string, e: React.TouchEvent) => {
    if (!tasksSettings.swipeToComplete) return;
    if (!subtaskSwipeState || subtaskSwipeState.id !== subtaskId) return;
    const deltaX = e.touches[0].clientX - subtaskTouchStartRef.current.x;
    const deltaY = Math.abs(e.touches[0].clientY - subtaskTouchStartRef.current.y);
    
    if (deltaY < 30) {
      const clampedX = Math.max(-120, Math.min(120, deltaX));
      setSubtaskSwipeState({ id: subtaskId, parentId, x: clampedX, isSwiping: true });
    }
  };

  const handleSubtaskSwipeEnd = async (subtask: TodoItem, parentId: string) => {
    if (!tasksSettings.swipeToComplete) return;
    if (!subtaskSwipeState || subtaskSwipeState.id !== subtask.id) return;
    
    if (subtaskSwipeState.x < -SWIPE_THRESHOLD) {
      try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
      deleteSubtask(parentId, subtask.id, true);
    } else if (subtaskSwipeState.x > SWIPE_THRESHOLD) {
      try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
      updateSubtask(parentId, subtask.id, { completed: !subtask.completed });
    }
    setSubtaskSwipeState(null);
  };

  // Render task item in flat layout style for ALL view modes
  const renderTaskItem = (item: TodoItem) => {
    const hasSubtasks = item.subtasks && item.subtasks.length > 0;
    const currentSwipe = swipeState?.id === item.id ? swipeState : null;
    const isExpanded = expandedTasks.has(item.id);
    const completedSubtasks = item.subtasks?.filter(st => st.completed).length || 0;
    const totalSubtasks = item.subtasks?.length || 0;
    
    // Always use flat layout style for consistency across all view modes
    return (
      <div key={item.id} className="relative">
        <div className="relative overflow-hidden">
          {/* Swipe action backgrounds - snap-to-reveal style */}
          <div className="absolute inset-0 flex">
            {/* Left side actions - Done + Pin (swipe right reveals) */}
            <div 
              className="flex items-center justify-start"
              style={{ opacity: (currentSwipe?.x || 0) > 0 ? 1 : 0 }}
            >
               <button
                 onClick={() => handleSwipeAction(() => {
                   if (!item.completed) {
                     setPendingCompleteId(item.id);
                     Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
                     pendingCompleteTimer.current = setTimeout(() => {
                       setPendingCompleteId(null);
                       pendingCompleteTimer.current = null;
                       updateItem(item.id, { completed: true });
                      }, 400);
                   } else {
                     updateItem(item.id, { completed: false });
                   }
                 })}
                 className="flex flex-col items-center justify-center w-[60px] h-full bg-success text-success-foreground"
               >
                 <Check className="h-5 w-5" />
                 <span className="text-[10px] font-medium mt-1">{t('swipe.done', 'Done')}</span>
               </button>
               <button
                 onClick={() => handleSwipeAction(() => { if (!requireFeature('pin_feature')) return; updateItem(item.id, { isPinned: !item.isPinned }); })}
                 className="flex flex-col items-center justify-center w-[60px] h-full bg-warning text-warning-foreground"
               >
                 <ArrowUpCircle className={cn("h-5 w-5", item.isPinned && "fill-current")} />
                 <span className="text-[10px] font-medium mt-1">{t('swipe.pin', 'Pin')}</span>
               </button>
            </div>
            {/* Right side actions - Move + Delete + Date (swipe left reveals) */}
            <div 
              className="absolute right-0 inset-y-0 flex items-center justify-end"
              style={{ opacity: (currentSwipe?.x || 0) < 0 ? 1 : 0, width: SWIPE_ACTION_WIDTH * 3 }}
            >
              <button
                onClick={() => handleSwipeAction(() => setSwipeMoveTaskId(item.id))}
                className="flex flex-col items-center justify-center w-[60px] h-full bg-info text-info-foreground"
              >
                <FolderIcon className="h-5 w-5" />
                <span className="text-[10px] font-medium mt-1">{t('swipe.move', 'Move')}</span>
              </button>
              <button
                onClick={() => handleSwipeAction(() => deleteItem(item.id, true))}
                className="flex flex-col items-center justify-center w-[60px] h-full bg-destructive text-destructive-foreground"
              >
                <TrashIcon className="h-5 w-5" />
                <span className="text-[10px] font-medium mt-1">{t('swipe.delete', 'Delete')}</span>
              </button>
              <button
                onClick={() => handleSwipeAction(() => setSwipeDateTaskId(item.id))}
                className="flex flex-col items-center justify-center w-[60px] h-full bg-warning text-warning-foreground"
              >
                <CalendarIcon2 className="h-5 w-5" />
                <span className="text-[10px] font-medium mt-1">{t('swipe.date', 'Date')}</span>
              </button>
            </div>
          </div>
          
          {/* Main flat item */}
          <div 
            className={cn(
              "flex items-start gap-3 border-b border-border/50 bg-background relative z-10",
              compactMode ? "py-1.5 px-1.5 gap-2" : "py-2.5 px-2"
            )}
            style={{ 
              transform: `translateX(${currentSwipe?.x || 0}px)`, 
              transition: currentSwipe?.isSwiping ? 'none' : 'transform 0.3s ease-out' 
            }}
            onTouchStart={(e) => handleFlatTouchStart(item.id, e)}
            onTouchMove={(e) => handleFlatTouchMove(item.id, e)}
            onTouchEnd={() => handleFlatTouchEnd(item)}
          >
          {isSelectionMode && (
              <Checkbox checked={selectedTaskIds.has(item.id)} onCheckedChange={() => handleSelectTask(item.id)} className={cn(compactMode ? "h-4 w-4" : "h-5 w-5", "mt-0.5")} />
            )}
            
            <button
              disabled={false}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const isPending = pendingCompleteId === item.id;
                if (item.completed || isPending) {
                  if (pendingCompleteTimer.current) {
                    clearTimeout(pendingCompleteTimer.current);
                    pendingCompleteTimer.current = null;
                  }
                  setPendingCompleteId(null);
                  if (item.completed) {
                    updateItem(item.id, { completed: false });
                  }
                  return;
                }
                setPendingCompleteId(item.id);
                Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
                setTimeout(() => { Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {}); }, 100);
                pendingCompleteTimer.current = setTimeout(() => {
                  setPendingCompleteId(null);
                  pendingCompleteTimer.current = null;
                  updateItem(item.id, { completed: true });
                }, 400);
              }}
              className={cn(
                TASK_CIRCLE.base,
                TASK_CIRCLE.marginTop,
                compactMode ? TASK_CIRCLE.sizeCompact : TASK_CIRCLE.size,
                item.completed && TASK_CIRCLE.completed,
                pendingCompleteId === item.id && TASK_CIRCLE.pending,
              )}
              style={{
                borderColor: (item.completed || pendingCompleteId === item.id) ? undefined : getPriorityColor(item.priority || 'none'),
                backgroundColor: pendingCompleteId === item.id ? getPriorityColor(item.priority || 'none') : undefined,
              }}
            >
              {(item.completed || pendingCompleteId === item.id) && (
                <Check 
                  className={cn(
                    TASK_CHECK_ICON.base,
                    compactMode ? TASK_CHECK_ICON.sizeCompact : TASK_CHECK_ICON.size,
                    pendingCompleteId === item.id && TASK_CHECK_ICON.pendingAnimation
                  )} 
                  style={{ 
                    color: pendingCompleteId === item.id 
                      ? TASK_CHECK_ICON.pendingColor
                      : TASK_CHECK_ICON.completedColor
                  }}
                  strokeWidth={TASK_CHECK_ICON.strokeWidth}
                />
              )}
            </button>
            <div className="flex-1 min-w-0" onClick={() => !currentSwipe?.isSwiping && setSelectedTask(item)}>
              {/* Show voice player OR text based on whether it's a voice task */}
              {item.voiceRecording ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleFlatVoicePlay(item, e)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors min-w-0 flex-1"
                  >
                    {playingVoiceId === item.id ? (
                      <Pause className="h-4 w-4 text-primary flex-shrink-0" />
                    ) : (
                      <Play className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                    {/* Waveform progress bar */}
                    <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                      {resolvedVoiceUrls[item.id] ? (
                        <WaveformProgressBar
                          audioUrl={resolvedVoiceUrls[item.id]}
                          progress={playingVoiceId === item.id ? voiceProgress : 0}
                          duration={voiceDuration[item.id] || item.voiceRecording.duration}
                          isPlaying={playingVoiceId === item.id}
                          onSeek={(percent) => {
                            if (flatAudioRef.current && playingVoiceId === item.id) {
                              const duration = flatAudioRef.current.duration || voiceDuration[item.id] || item.voiceRecording!.duration;
                              if (duration && !isNaN(duration)) {
                                flatAudioRef.current.currentTime = (percent / 100) * duration;
                                setVoiceProgress(percent);
                                setVoiceCurrentTime((percent / 100) * duration);
                              }
                            }
                          }}
                          height={12}
                        />
                      ) : (
                        <div 
                          className="relative h-1.5 bg-primary/20 rounded-full overflow-hidden cursor-pointer"
                          onClick={(e) => handleVoiceSeek(e, item)}
                        >
                          <div 
                            className="absolute h-full bg-primary rounded-full transition-all duration-100"
                            style={{ width: playingVoiceId === item.id ? `${voiceProgress}%` : '0%' }}
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-primary font-medium">
                          {playingVoiceId === item.id ? formatDuration(Math.round(voiceCurrentTime)) : '0:00'}
                        </span>
                        <span className="text-primary/70">
                          {formatDuration(voiceDuration[item.id] || item.voiceRecording.duration)}
                        </span>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={cycleVoicePlaybackSpeed}
                    className="px-2 py-1 text-xs font-semibold rounded-md bg-muted hover:bg-muted/80 transition-colors min-w-[40px]"
                  >
                    {voicePlaybackSpeed}x
                  </button>
                  {item.repeatType && item.repeatType !== 'none' && <Repeat className="h-3 w-3 text-accent-purple flex-shrink-0" />}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {item.isPinned && <Pin className={cn(compactMode ? "h-3 w-3" : "h-3.5 w-3.5", "text-warning fill-warning flex-shrink-0")} />}
                  <span className={cn(compactMode ? "text-xs" : "text-sm", "transition-all duration-300", (item.completed || pendingCompleteId === item.id) && "text-muted-foreground line-through")}>{item.text}</span>
                  {item.repeatType && item.repeatType !== 'none' && <Repeat className={cn(compactMode ? "h-2.5 w-2.5" : "h-3 w-3", "text-accent-purple flex-shrink-0")} />}
                </div>
              )}
              {/* Tags display - hide in compact mode */}
              {!compactMode && !hideDetailsOptions.hideDateTime && item.tagIds && item.tagIds.length > 0 && (
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {item.tagIds.slice(0, 4).map((tagId) => {
                    const tag = allGlobalTags.find(t => t.id === tagId);
                    if (!tag) return null;
                    return (
                      <span 
                        key={tagId}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full text-white"
                        style={{ backgroundColor: `hsl(${tag.color})` }}
                      >
                        {tag.icon && <span>{tag.icon}</span>}
                        <Tag className="h-2.5 w-2.5" />
                        {tag.name}
                      </span>
                    );
                  })}
                  {item.tagIds.length > 4 && (
                    <span className="text-[10px] text-muted-foreground">+{item.tagIds.length - 4}</span>
                  )}
                </div>
              )}
              {/* Date display - inline in compact mode */}
              {!hideDetailsOptions.hideDateTime && item.dueDate && (
                <p className={cn("text-muted-foreground", compactMode ? "text-[10px] mt-0.5" : "text-xs mt-1")}>
                  {new Date(item.dueDate).toLocaleDateString()}
                </p>
              )}
              {/* Subtasks indicator - inline in compact mode */}
              {!hideDetailsOptions.hideSubtasks && hasSubtasks && !isExpanded && (
                <p className={cn("text-muted-foreground", compactMode ? "text-[10px] mt-0.5" : "text-xs mt-1")}>
                  {completedSubtasks}/{totalSubtasks} subtasks
                </p>
              )}
              {/* Status badge - hide in compact mode */}
              {!compactMode && !hideDetailsOptions.hideStatus && showStatusBadge && !item.completed && item.status && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-[10px] px-1.5 py-0 mt-1",
                    item.status === 'not_started' && "border-muted-foreground text-muted-foreground bg-muted/30",
                    item.status === 'in_progress' && "border-info text-info bg-info/10",
                    item.status === 'almost_done' && "border-warning text-warning bg-warning/10"
                  )}
                >
                  {item.status === 'not_started' ? t('grouping.notStarted') : item.status === 'in_progress' ? t('grouping.inProgress') : t('grouping.almostDone')}
                </Badge>
              )}
            </div>
            {/* Image display - smaller in compact mode */}
            {item.imageUrl && (
              <div
                className={cn(
                  "rounded-full overflow-hidden border-2 border-border flex-shrink-0 cursor-pointer hover:border-primary transition-colors",
                  compactMode ? "w-7 h-7" : "w-10 h-10"
                )}
                onClick={(e) => { e.stopPropagation(); setSelectedImage(item.imageUrl!); }}
              >
                <ResolvedTaskImage srcRef={item.imageUrl} alt="Task attachment" className="w-full h-full object-cover" />
              </div>
            )}
            {/* Expand/Collapse button for subtasks - always visible */}
            {hasSubtasks && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleSubtasks(item.id); }}
                className={cn("rounded hover:bg-muted transition-colors flex-shrink-0", compactMode ? "p-0.5" : "p-1 mt-0.5")}
              >
                {isExpanded ? (
                  <ChevronDown className={cn(compactMode ? "h-3 w-3" : "h-4 w-4", "text-muted-foreground")} />
                ) : (
                  <ChevronRight className={cn(compactMode ? "h-3 w-3" : "h-4 w-4", "text-muted-foreground")} />
                )}
              </button>
            )}
          </div>
        </div>
        {/* Subtasks are rendered by UnifiedDragDropList - not here to avoid duplicates */}
      </div>
    );
  };

  // Render subtasks inline for Kanban/Progress/Timeline views
  const renderSubtasksInline = (item: TodoItem) => {
    const isExpanded = expandedTasks.has(item.id);
    if (!isExpanded || !item.subtasks || item.subtasks.length === 0) return null;
    
    
    return (
      <div className="border-t border-border/30 bg-muted/20 p-2 space-y-1">
        {item.subtasks.map((subtask) => (
          <div 
            key={subtask.id}
            className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors"
            style={{ borderLeft: `3px solid ${getPriorityColor(subtask.priority || 'none')}` }}
          >
            <Checkbox
              checked={subtask.completed}
              onCheckedChange={(checked) => {
                const updatedSubtasks = item.subtasks?.map(st => 
                  st.id === subtask.id ? { ...st, completed: !!checked } : st
                );
                updateItem(item.id, { subtasks: updatedSubtasks });
              }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "h-4 w-4 rounded-sm border-0",
                subtask.completed 
                  ? "bg-muted-foreground/30 data-[state=checked]:bg-muted-foreground/30 data-[state=checked]:text-white" 
                  : "border-2"
              )}
              style={{ borderColor: subtask.completed ? undefined : getPriorityColor(subtask.priority || 'none') }}
            />
            <span 
              className={cn("text-xs flex-1", subtask.completed && "text-muted-foreground line-through")}
              onClick={() => setSelectedSubtask({ subtask, parentId: item.id })}
            >
              • {subtask.text}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  // Get view mode icon for visual indicator
  const getViewModeIcon = () => {
    switch (viewMode) {
      case 'kanban': return <Columns3 className="h-3.5 w-3.5" />;
      case 'kanban-status': return <ListChecks className="h-3.5 w-3.5" />;
      case 'timeline': return <GitBranch className="h-3.5 w-3.5" />;
      case 'progress': return <TrendingUp className="h-3.5 w-3.5" />;
      case 'priority': return <Flag className="h-3.5 w-3.5" />;
      case 'history': return <History className="h-3.5 w-3.5" />;
      default: return <LayoutList className="h-3.5 w-3.5" />;
    }
  };

  const renderSectionHeader = (section: TaskSection, isDragging: boolean = false) => {
    const sectionTasks = uncompletedItems.filter(item => item.sectionId === section.id || (!item.sectionId && section.id === sections[0]?.id));
    
    return (
      <div
        data-tour="task-section"
        className={cn(
          "flex items-center",
          isDragging && "opacity-90 scale-[1.02] shadow-xl bg-card rounded-t-xl"
        )} 
        style={{ borderLeft: `4px solid ${section.color}` }}
      >
        <div className="flex-1 flex items-center gap-3 px-3 py-2.5 bg-muted/30">
          {/* View mode indicator icon */}
          <span className="text-muted-foreground" style={{ color: section.color }}>
            {getViewModeIcon()}
          </span>
          <span className="text-sm font-semibold">{section.name}</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{sectionTasks.length}</span>
        </div>
        
        {/* Collapse button */}
        <button
          onClick={() => handleToggleSectionCollapse(section.id)}
          className="p-2 hover:bg-muted/50 transition-colors"
        >
          {collapsedViewSections.has(`flat-${section.id}`) ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* Options menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-2 hover:bg-muted/50 transition-colors">
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-popover border shadow-lg z-50">
            <DropdownMenuItem onClick={() => handleEditSection(section)} className="cursor-pointer">
              <Edit className="h-4 w-4 mr-2" />{t('sections.editSection')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAddTaskToSection(section.id)} className="cursor-pointer">
              <PlusIcon className="h-4 w-4 mr-2" />{t('sections.addTask')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleAddSection('above', section.id)} className="cursor-pointer">
              <ArrowUpCircle className="h-4 w-4 mr-2" />{t('sections.addSectionAbove')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAddSection('below', section.id)} className="cursor-pointer">
              <ArrowDownCircle className="h-4 w-4 mr-2" />{t('sections.addSectionBelow')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDuplicateSection(section.id)} className="cursor-pointer">
              <Copy className="h-4 w-4 mr-2" />{t('sections.duplicateSection')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setEditingSection(section); setIsSectionMoveOpen(true); }} className="cursor-pointer">
              <Move className="h-4 w-4 mr-2" />{t('sections.moveTo')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => handleDeleteSection(section.id)} 
              className="cursor-pointer text-destructive focus:text-destructive"
              disabled={sections.length <= 1}
            >
              <Trash2 className="h-4 w-4 mr-2" />{t('common.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  // Collapsible section state for all view modes (persisted)
  const [collapsedViewSections, setCollapsedViewSections] = useState<Set<string>>(new Set());
  const [collapsedSectionsLoaded, setCollapsedSectionsLoaded] = useState(false);
  
  // Load collapsed sections from IndexedDB on mount
  useEffect(() => {
    const loadCollapsedSections = async () => {
      const saved = await getSetting<string[]>('todoCollapsedSections', []);
      if (saved && saved.length > 0) {
        setCollapsedViewSections(new Set(saved));
      }
      setCollapsedSectionsLoaded(true);
    };
    loadCollapsedSections();
  }, []);
  
  // Persist collapsed sections to IndexedDB when they change
  useEffect(() => {
    if (collapsedSectionsLoaded) {
      setSetting('todoCollapsedSections', Array.from(collapsedViewSections));
    }
  }, [collapsedViewSections, collapsedSectionsLoaded]);
  
  const toggleViewSectionCollapse = (sectionId: string) => {
    setCollapsedViewSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  // Render collapsible section header for special view modes
  const renderViewModeSectionHeader = (
    label: string, 
    taskCount: number, 
    color: string, 
    icon: React.ReactNode,
    sectionId: string,
    extra?: React.ReactNode
  ) => {
    const isCollapsed = collapsedViewSections.has(sectionId);
    
    return (
      <button 
        onClick={() => toggleViewSectionCollapse(sectionId)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b border-border/30 hover:bg-muted/20 transition-colors" 
        style={{ borderLeft: `4px solid ${color}` }}
      >
        <span style={{ color }}>{icon}</span>
        <span className="text-sm font-semibold flex-1 text-left">{label}</span>
        {extra}
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{taskCount}</span>
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
    );
  };

  // Render completed section for special view modes
  const renderCompletedSectionForViewMode = () => {
    if (!showCompleted || completedItems.length === 0) return null;
    
    const isCollapsed = collapsedViewSections.has('view-completed');
    
    return (
      <div className="bg-muted/30 rounded-xl border border-border/30 overflow-hidden mt-6">
        <button 
          onClick={() => toggleViewSectionCollapse('view-completed')}
          className="w-full flex items-center gap-2 px-4 py-3 border-b border-border/30 hover:bg-muted/20 transition-colors" 
          style={{ borderLeft: `4px solid #10b981` }}
        >
          <CheckCircle2 className="h-4 w-4 text-success" />
          <span className="text-sm font-semibold flex-1 text-left text-muted-foreground uppercase tracking-wide">Completed</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{completedItems.length}</span>
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {!isCollapsed && (
          <div className="p-2 space-y-2">
            {completedItems.map((item) => (
              <div key={item.id} className="bg-card rounded-lg border border-border/50 opacity-70">
                {renderTaskItem(item)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleSubtaskClick = (subtask: TodoItem, parentId?: string) => {
    if (parentId) {
      setSelectedSubtask({ subtask, parentId });
    } else {
      setSelectedTask(subtask);
    }
  };

  return (
    <TodoLayout title="Npd" searchValue={viewModeSearch} onSearchChange={setViewModeSearch}>
      <main className="container mx-auto px-4 py-3 pb-32">
        <div className="max-w-2xl mx-auto">
          {/* Folders */}
          <div className="mb-4" data-tour="todo-folders-section">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold flex items-center gap-2"><FolderIcon className="h-5 w-5" />{t('menu.folders')}</h2>
                {smartList === 'location-reminders' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsLocationMapOpen(true)}
                    className="gap-1"
                  >
                    <MapPin className="h-4 w-4" />
                    {t('menu.mapView')}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isSelectionMode && (
                  <Button variant="default" size="sm" onClick={() => { setIsSelectionMode(false); setSelectedTaskIds(new Set()); }}>
                    {t('menu.cancel')}
                  </Button>
                )}
                <DropdownMenu onOpenChange={(open) => { if (!open) setDropdownView('main'); }}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9" data-tour="todo-options-menu">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-56 max-h-[70vh] overflow-y-auto bg-popover border shadow-lg z-50">
                    <div className={cn(
                      "transition-all duration-200 ease-out",
                      dropdownView === 'main' ? "animate-in slide-in-from-left-full" : "hidden"
                    )}>
                      {dropdownView === 'main' && (
                        <>
                          {/* Smart Lists - Premium */}
                          <DropdownMenuItem onClick={(e) => { e.preventDefault(); if (!requireFeature('smart_lists')) return; setDropdownView('smartLists'); }} className="cursor-pointer">
                            <Sparkles className="h-4 w-4 mr-2" />
                            {t('menu.smartLists')}
                            {!isPro && <Crown className="h-3.5 w-3.5 ml-auto" style={{ color: '#3c78f0' }} />}
                            {smartList !== 'all' && (
                              <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-xs mr-1">
                                {t('menu.active')}
                              </Badge>
                            )}
                            <ChevronRight className="h-4 w-4 ml-auto" />
                          </DropdownMenuItem>
                          {/* Sort By */}
                          <DropdownMenuItem onClick={(e) => { e.preventDefault(); setDropdownView('sortBy'); }} className="cursor-pointer">
                            <ArrowUpDown className="h-4 w-4 mr-2" />
                            {t('menu.sortBy')}
                            <ChevronRight className="h-4 w-4 ml-auto" />
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setShowCompleted(!showCompleted)} className="cursor-pointer">
                            {showCompleted ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                            {showCompleted ? t('menu.hideCompleted') : t('menu.showCompleted')}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => {
                              const allHidden = hideDetailsOptions.hideDateTime && hideDetailsOptions.hideStatus && hideDetailsOptions.hideSubtasks;
                              setHideDetailsOptions({
                                hideDateTime: !allHidden,
                                hideStatus: !allHidden,
                                hideSubtasks: !allHidden,
                              });
                            }} 
                            className="cursor-pointer"
                          >
                            {(hideDetailsOptions.hideDateTime && hideDetailsOptions.hideStatus && hideDetailsOptions.hideSubtasks) ? (
                              <><Eye className="h-4 w-4 mr-2" />{t('menu.showAllDetails')}</>
                            ) : (
                              <><EyeOff className="h-4 w-4 mr-2" />{t('menu.hideAllDetails')}</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setCompactMode(!compactMode)} className="cursor-pointer">
                            {compactMode ? <LayoutList className="h-4 w-4 mr-2" /> : <LayoutGrid className="h-4 w-4 mr-2" />}
                            {compactMode ? t('menu.normalMode') : t('menu.compactMode')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setIsTaskOptionsOpen(true)} className="cursor-pointer">
                            <Settings className="h-4 w-4 mr-2" />
                            {t('menu.detailSettings')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {/* Group By */}
                          <DropdownMenuItem onClick={(e) => { e.preventDefault(); setDropdownView('groupBy'); }} className="cursor-pointer">
                            <Columns3 className="h-4 w-4 mr-2" />
                            {t('menu.groupBy')}
                            {groupByOption !== 'none' && (
                              <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-xs mr-1">
                                {groupByOption}
                              </Badge>
                            )}
                            <ChevronRight className="h-4 w-4 ml-auto" />
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setIsFilterSheetOpen(true)} className="cursor-pointer">
                            <Filter className="h-4 w-4 mr-2" />{t('menu.filter')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setIsDuplicateSheetOpen(true)} className="cursor-pointer">
                            <Copy className="h-4 w-4 mr-2" />{t('menu.duplicate')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { if (!requireFeature('multiple_tasks')) return; setIsBatchTaskOpen(true); }} className="cursor-pointer">
                            <ListPlus className="h-4 w-4 mr-2" />{t('menu.addMultipleTasks')}
                            {!isPro && <Crown className="h-3.5 w-3.5 ml-auto" style={{ color: '#3c78f0' }} />}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleAddSection('below')} className="cursor-pointer">
                            <PlusIcon className="h-4 w-4 mr-2" />{t('menu.sections')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setIsFolderManageOpen(true)} className="cursor-pointer">
                            <FolderIcon className="h-4 w-4 mr-2" />{t('menu.folders')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => { setIsSelectionMode(true); setIsSelectActionsOpen(true); }} className="cursor-pointer">
                            <MousePointer2 className="h-4 w-4 mr-2" />{t('menu.select')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setViewMode('flat')} className={cn("cursor-pointer", viewMode === 'flat' && "bg-accent")}>
                            <LayoutList className="h-4 w-4 mr-2" />{t('menu.flatLayout')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setViewMode('kanban')} className={cn("cursor-pointer", viewMode === 'kanban' && "bg-accent")}>
                            <Columns3 className="h-4 w-4 mr-2" />{t('menu.kanbanBoard')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { if (!requireFeature('view_mode_status_board')) return; setViewMode('kanban-status'); }} className={cn("cursor-pointer", viewMode === 'kanban-status' && "bg-accent")}>
                            <ListChecks className="h-4 w-4 mr-2" />{t('menu.statusBoard')}
                            {!isPro && <Crown className="h-3.5 w-3.5 ml-auto" style={{ color: '#3c78f0' }} />}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { if (!requireFeature('view_mode_timeline')) return; setViewMode('timeline'); }} className={cn("cursor-pointer", viewMode === 'timeline' && "bg-accent")}>
                            <GitBranch className="h-4 w-4 mr-2" />{t('menu.timelineBoard')}
                            {!isPro && <Crown className="h-3.5 w-3.5 ml-auto" style={{ color: '#3c78f0' }} />}
                          </DropdownMenuItem>
                          {/* Progress Board removed from views */}
                          <DropdownMenuItem onClick={() => { if (!requireFeature('view_mode_priority')) return; setViewMode('priority'); }} className={cn("cursor-pointer", viewMode === 'priority' && "bg-accent")}>
                            <Flag className="h-4 w-4 mr-2" />{t('menu.priorityBoard')}
                            {!isPro && <Crown className="h-3.5 w-3.5 ml-auto" style={{ color: '#3c78f0' }} />}
                          </DropdownMenuItem>
                          {/* History Log removed from views */}
                        </>
                      )}
                    </div>
                    <div className={cn(
                      "transition-all duration-200 ease-out",
                      dropdownView === 'smartLists' ? "animate-in slide-in-from-right-full" : "hidden"
                    )}>
                      {dropdownView === 'smartLists' && (
                        <>
                          <DropdownMenuItem onClick={(e) => { e.preventDefault(); setDropdownView('main'); }} className="cursor-pointer">
                            <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
                            {t('menu.back')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {smartListData.smartLists.map((list) => (
                            <DropdownMenuItem
                              key={list.id}
                              onClick={() => {
                                setSmartList(list.id);
                                setActiveCustomViewId(null);
                              }}
                              className={cn("cursor-pointer", smartList === list.id && !activeCustomViewId && "bg-accent")}
                            >
                              {list.icon}
                              <span className={cn("ml-2", list.color)}>{list.label}</span>
                              {smartListData.getCounts[list.id] > 0 && (
                                <Badge 
                                  variant={list.id === 'overdue' ? "destructive" : "secondary"}
                                  className="ml-auto"
                                >
                                  {smartListData.getCounts[list.id]}
                                </Badge>
                              )}
                            </DropdownMenuItem>
                          ))}
                          {/* Custom Smart Views */}
                          {customSmartViews.length > 0 && (
                            <>
                              <DropdownMenuSeparator />
                              <div className="px-2 py-1.5">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                  Saved Views
                                </span>
                              </div>
                              {customSmartViews.map((view) => (
                                <DropdownMenuItem
                                  key={view.id}
                                  onClick={() => {
                                    // Apply the saved filters
                                    setDateFilter(view.filters.dateFilter);
                                    setPriorityFilter(view.filters.priorityFilter);
                                    setStatusFilter(view.filters.statusFilter);
                                    setTagFilter(view.filters.tags);
                                    setSelectedFolderId(view.filters.folderId);
                                    setSmartList('all');
                                    setActiveCustomViewId(view.id);
                                    toast.success(`Applied "${view.name}" view`);
                                  }}
                                  className={cn("cursor-pointer group", activeCustomViewId === view.id && "bg-accent")}
                                >
                                  <span className="mr-2">{view.icon}</span>
                                  <span className="truncate" style={{ color: view.color }}>{view.name}</span>
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const { deleteCustomSmartView } = await import('@/utils/customSmartViews');
                                      await deleteCustomSmartView(view.id);
                                      loadCustomSmartViews().then(setCustomSmartViews);
                                      if (activeCustomViewId === view.id) setActiveCustomViewId(null);
                                      toast.success('Smart View deleted');
                                    }}
                                    className="opacity-0 group-hover:opacity-100 ml-auto p-1 hover:bg-destructive/10 rounded transition-opacity"
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </button>
                                </DropdownMenuItem>
                              ))}
                            </>
                          )}
                        </>
                      )}
                    </div>
                    <div className={cn(
                      "transition-all duration-200 ease-out",
                      dropdownView === 'sortBy' ? "animate-in slide-in-from-right-full" : "hidden"
                    )}>
                      {dropdownView === 'sortBy' && (
                        <>
                          <DropdownMenuItem onClick={(e) => { e.preventDefault(); setDropdownView('main'); }} className="cursor-pointer">
                            <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
                            {t('menu.back')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setSortBy('date')} className={cn("cursor-pointer", sortBy === 'date' && "bg-accent")}>
                            <CalendarIcon2 className="h-4 w-4 mr-2 text-info" />
                            {t('menu.dueDate')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSortBy('priority')} className={cn("cursor-pointer", sortBy === 'priority' && "bg-accent")}>
                            <Flame className="h-4 w-4 mr-2 text-streak" />
                            {t('menu.priority')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSortBy('name')} className={cn("cursor-pointer", sortBy === 'name' && "bg-accent")}>
                            <ArrowDownAZ className="h-4 w-4 mr-2 text-accent-purple" />
                            {t('menu.name')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSortBy('created')} className={cn("cursor-pointer", sortBy === 'created' && "bg-accent")}>
                            <Clock className="h-4 w-4 mr-2 text-success" />
                            {t('menu.createdTime')}
                          </DropdownMenuItem>
                        </>
                      )}
                    </div>
                    <div className={cn(
                      "transition-all duration-200 ease-out",
                      dropdownView === 'groupBy' ? "animate-in slide-in-from-right-full" : "hidden"
                    )}>
                      {dropdownView === 'groupBy' && (
                        <>
                          <DropdownMenuItem onClick={(e) => { e.preventDefault(); setDropdownView('main'); }} className="cursor-pointer">
                            <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
                            {t('menu.back')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setGroupByOption('none')} className={cn("cursor-pointer", groupByOption === 'none' && "bg-accent")}>
                            <LayoutList className="h-4 w-4 mr-2 text-muted-foreground" />
                            {t('menu.noGrouping')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setGroupByOption('section')} className={cn("cursor-pointer", groupByOption === 'section' && "bg-accent")}>
                            <Columns3 className="h-4 w-4 mr-2 text-info" />
                            {t('menu.bySection')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setGroupByOption('priority')} className={cn("cursor-pointer", groupByOption === 'priority' && "bg-accent")}>
                            <Flag className="h-4 w-4 mr-2 text-streak" />
                            {t('menu.byPriority')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setGroupByOption('date')} className={cn("cursor-pointer", groupByOption === 'date' && "bg-accent")}>
                            <CalendarIcon2 className="h-4 w-4 mr-2 text-success" />
                            {t('menu.byDueDate')}
                          </DropdownMenuItem>
                        </>
                      )}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button onClick={() => setSelectedFolderId(null)} className={cn("flex items-center gap-2 px-4 py-2 rounded-full transition-all whitespace-nowrap flex-shrink-0", !selectedFolderId ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>
                <FolderIcon className="h-4 w-4" />{t('smartLists.allTasks')}
              </button>
              <DragDropContext onDragEnd={(result: DropResult) => {
                if (!result.destination) return;
                const sorted = [...folders].sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));
                const reordered = Array.from(sorted);
                const [moved] = reordered.splice(result.source.index, 1);
                reordered.splice(result.destination.index, 0, moved);
                handleReorderFolders(reordered);
              }}>
                <Droppable droppableId="folder-chips" direction="horizontal">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="flex gap-2">
                      {[...folders].sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0)).map((folder, index) => {
                        const isSelected = selectedFolderId === folder.id;
                        return (
                          <Draggable key={folder.id} draggableId={`folder-chip-${folder.id}`} index={index}>
                            {(dragProvided, snapshot) => (
                              <button
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                onClick={() => setSelectedFolderId(folder.id)}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  handleToggleFolderFavorite(folder.id);
                                }}
                                className={cn(
                                  "flex items-center gap-2 px-4 py-2 rounded-full transition-all whitespace-nowrap flex-shrink-0",
                                  isSelected 
                                    ? "text-primary-foreground" 
                                    : "hover:opacity-80 text-foreground",
                                  !isSelected && "bg-[#f1f4f9] dark:bg-muted",
                                  snapshot.isDragging && "shadow-lg opacity-90 ring-2 ring-primary/30"
                                )}
                                style={{
                                  ...(isSelected ? { backgroundColor: folder.color } : undefined),
                                  ...dragProvided.draggableProps.style,
                                }}
                              >
                                {folder.isFavorite && <Star className="h-3.5 w-3.5 fill-current" />}
                                <FolderIcon className="h-4 w-4" />
                                {folder.name}
                              </button>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
            
          </div>
          {isSelectionMode && selectedTaskIds.size > 0 && (
            <div className="fixed left-4 right-4 z-40 bg-card border rounded-lg shadow-lg p-4" style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
              <p className="text-sm mb-3 font-medium">{t('bulk.tasksSelected', { count: selectedTaskIds.size })}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsSelectActionsOpen(true)}>{t('common.actions', 'Actions')}</Button>
                <Button variant="outline" size="sm" onClick={() => { setItems(items.filter(i => !selectedTaskIds.has(i.id))); setSelectedTaskIds(new Set()); setIsSelectionMode(false); }}>
                  <Trash2 className="h-4 w-4 mr-2" />{t('common.delete')}
                </Button>
              </div>
            </div>
          )}
          {/* Collapse All / Expand All Button - for all view modes with sections */}
          {['flat', 'timeline', 'progress', 'priority', 'history', 'kanban'].includes(viewMode) && (
            <div className="mb-4 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (collapsedViewSections.size > 0) {
                    // Expand all
                    setCollapsedViewSections(new Set());
                  } else {
                    // Collapse all - add all possible section IDs
                    const allSectionIds = new Set<string>();
                    if (viewMode === 'flat') {
                      if (groupByOption !== 'none') {
                        // Grouped flat view
                        if (groupByOption === 'section') {
                          sortedSections.forEach(s => allSectionIds.add(`group-section-${s.id}`));
                        } else if (groupByOption === 'priority') {
                          ['high', 'medium', 'low', 'none'].forEach(id => allSectionIds.add(`group-priority-${id}`));
                        } else if (groupByOption === 'date') {
                          ['overdue', 'today', 'tomorrow', 'this-week', 'later', 'no-date'].forEach(id => allSectionIds.add(`group-date-${id}`));
                        }
                      } else {
                        // Regular flat view
                        sortedSections.forEach(s => allSectionIds.add(`flat-${s.id}`));
                      }
                    } else if (viewMode === 'kanban') {
                      sortedSections.forEach(s => allSectionIds.add(`kanban-${s.id}`));
                      allSectionIds.add('kanban-completed');
                    } else if (viewMode === 'timeline') {
                      ['timeline-overdue', 'timeline-today', 'timeline-tomorrow', 'timeline-thisweek', 'timeline-later', 'timeline-nodate'].forEach(id => allSectionIds.add(id));
                    } else if (viewMode === 'progress') {
                      ['progress-notstarted', 'progress-inprogress', 'progress-almostdone'].forEach(id => allSectionIds.add(id));
                    } else if (viewMode === 'priority') {
                      ['priority-high', 'priority-medium', 'priority-low', 'priority-none'].forEach(id => allSectionIds.add(id));
                    } else if (viewMode === 'history') {
                      ['history-completed-today', 'history-completed-yesterday', 'history-this-week', 'history-older'].forEach(id => allSectionIds.add(id));
                    }
                    allSectionIds.add('view-completed');
                    setCollapsedViewSections(allSectionIds);
                  }
                }}
                className="gap-1 whitespace-nowrap"
              >
                {collapsedViewSections.size > 0 ? (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    {t('sections.expandAll')}
                  </>
                ) : (
                  <>
                    <ChevronRight className="h-4 w-4" />
                    {t('sections.collapseAll')}
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Tasks by Sections */}
          {processedItems.length === 0 ? (
            <div className="text-center py-20"><p className="text-muted-foreground">{t('emptyStates.noTasks')}</p></div>
          ) : viewMode === 'kanban' ? (
            /* Kanban Mode - Horizontal Sections with Drag & Drop */
            <DragDropContext onDragEnd={(result: DropResult) => {
              if (!result.destination) return;
              const { source, destination, draggableId } = result;
              
              const taskId = draggableId;
              const sourceSectionId = source.droppableId;
              const destSectionId = destination.droppableId;
              const sourceIndex = source.index;
              const destIndex = destination.index;
              
              // If dropped in same position, do nothing
              if (sourceSectionId === destSectionId && sourceIndex === destIndex) return;
              
              setItems(prevItems => {
                const taskToMove = prevItems.find(item => item.id === taskId);
                if (!taskToMove) return prevItems;
                
                // Get uncompleted items for reordering
                const uncompletedList = prevItems.filter(item => !item.completed);
                const completedList = prevItems.filter(item => item.completed);
                
                // Get source section tasks
                const sourceTasks = uncompletedList.filter(item => 
                  item.sectionId === sourceSectionId || (!item.sectionId && sourceSectionId === sections[0]?.id)
                );
                
                // Get destination section tasks (excluding the moved task)
                const destTasksRaw = uncompletedList.filter(item => 
                  item.id !== taskId &&
                  (item.sectionId === destSectionId || (!item.sectionId && destSectionId === sections[0]?.id))
                );
                
                // Apply current saved order first, then reorder
                const currentlyOrderedDestTasks = applyTaskOrder(destTasksRaw, `kanban-${destSectionId}`);
                const currentDestOrderIds = currentlyOrderedDestTasks.map(t => t.id);
                currentDestOrderIds.splice(destIndex, 0, taskId);
                
                // Persist the new order for destination section
                updateSectionOrder(`kanban-${destSectionId}`, currentDestOrderIds);
                
                // Build destTasks for array reconstruction
                const destTasks = [...currentlyOrderedDestTasks];
                const updatedTask = { ...taskToMove, sectionId: destSectionId };
                destTasks.splice(destIndex, 0, updatedTask);
                
                // If moving between sections, also update source section order
                if (sourceSectionId !== destSectionId) {
                  const currentlyOrderedSourceTasks = applyTaskOrder(sourceTasks, `kanban-${sourceSectionId}`);
                  const sourceOrderIds = currentlyOrderedSourceTasks.map(t => t.id).filter(id => id !== taskId);
                  updateSectionOrder(`kanban-${sourceSectionId}`, sourceOrderIds);
                }
                
                // Build new items array preserving order
                const otherTasks = uncompletedList.filter(item => 
                  item.id !== taskId &&
                  item.sectionId !== destSectionId && 
                  (item.sectionId || destSectionId !== sections[0]?.id)
                );
                
                return [...otherTasks, ...destTasks, ...completedList];
              });
              
              // Force re-render to apply the new order immediately
              setOrderVersion(v => v + 1);
              
              Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
              toast.success('Task moved');
            }}>
              <div className="overflow-x-auto pb-4 -mx-4 px-4">
                <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
                  {sortedSections.map((section) => {
                    const rawSectionTasks = uncompletedItems.filter(
                      item => item.sectionId === section.id || (!item.sectionId && section.id === sections[0]?.id)
                    );
                    // Apply persisted order
                    const sectionTasks = applyTaskOrder(rawSectionTasks, `kanban-${section.id}`);
                    const kanbanSectionId = `kanban-${section.id}`;
                    const isCollapsed = collapsedViewSections.has(kanbanSectionId);
                    
                    return (
                      <div 
                        key={section.id} 
                        className="flex-shrink-0 w-72 bg-muted/30 rounded-xl border border-border/30 overflow-hidden"
                      >
                        {/* Kanban Column Header with Collapse */}
                        <button 
                          onClick={() => toggleViewSectionCollapse(kanbanSectionId)}
                          className="w-full flex items-center gap-2 px-3 py-3 border-b border-border/30 hover:bg-muted/20 transition-colors"
                          style={{ borderLeft: `4px solid ${section.color}` }}
                        >
                          <Columns3 className="h-3.5 w-3.5" style={{ color: section.color }} />
                          <span className="text-sm font-semibold flex-1 text-left">{section.name}</span>
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {sectionTasks.length}
                          </span>
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <div className="p-1 hover:bg-muted/50 rounded transition-colors">
                                <MoreVertical className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-popover border shadow-lg z-50">
                              <DropdownMenuItem onClick={() => handleEditSection(section)} className="cursor-pointer">
                                <Edit className="h-4 w-4 mr-2" />{t('sections.editSection')}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAddTaskToSection(section.id)} className="cursor-pointer">
                                <PlusIcon className="h-4 w-4 mr-2" />{t('sections.addTask')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDuplicateSection(section.id)} className="cursor-pointer">
                                <Copy className="h-4 w-4 mr-2" />{t('common.duplicate')}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteSection(section.id)} 
                                className="cursor-pointer text-destructive focus:text-destructive"
                                disabled={sections.length <= 1}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />{t('common.delete')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </button>
                        
                        {/* Kanban Column Tasks with Drag & Drop */}
                        {!isCollapsed && (
                          <>
                            <Droppable droppableId={section.id}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={cn("min-h-[300px] max-h-[400px] overflow-y-auto p-2 space-y-2", snapshot.isDraggingOver && "bg-primary/5")}
                                >
                                  {sectionTasks.length === 0 ? (
                                    <div className="py-8 text-center text-sm text-muted-foreground">
                                      {t('sections.dropTasksHere')}
                                    </div>
                                  ) : (
                                    sectionTasks.map((item, index) => (
                                      <Draggable key={item.id} draggableId={item.id} index={index}>
                                        {(provided, snapshot) => (
                                          <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            className={cn("bg-card rounded-lg border border-border/50 shadow-sm", snapshot.isDragging && "shadow-lg ring-2 ring-primary")}
                                          >
                                            {renderTaskItem(item)}
                                            {renderSubtasksInline(item)}
                                          </div>
                                        )}
                                      </Draggable>
                                    ))
                                  )}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                            
                            {/* Add Task Button */}
                            <div className="p-2 border-t border-border/30">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="w-full justify-start text-muted-foreground"
                                onClick={() => handleAddTaskToSection(section.id)}
                              >
                                <PlusIcon className="h-4 w-4 mr-2" />
                                {t('sections.addTask')}
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Completed Column for Kanban */}
                  {showCompleted && completedItems.length > 0 && (
                    <div className="flex-shrink-0 w-72 bg-muted/30 rounded-xl border border-border/30 overflow-hidden">
                      <button 
                        onClick={() => toggleViewSectionCollapse('kanban-completed')}
                        className="w-full flex items-center gap-2 px-3 py-3 border-b border-border/30 hover:bg-muted/20 transition-colors"
                        style={{ borderLeft: `4px solid #10b981` }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        <span className="text-sm font-semibold flex-1 text-left text-muted-foreground uppercase tracking-wide">Completed</span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {completedItems.length}
                        </span>
                        {collapsedViewSections.has('kanban-completed') ? (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                      {!collapsedViewSections.has('kanban-completed') && (
                        <div className="min-h-[100px] max-h-[400px] overflow-y-auto p-2 space-y-2">
                          {completedItems.map((item) => (
                            <div key={item.id} className="bg-card rounded-lg border border-border/50 shadow-sm opacity-70">
                              {renderTaskItem(item)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Add Section Column */}
                  <div className="flex-shrink-0 w-72">
                    <Button 
                      variant="outline" 
                      className="w-full h-12 border-dashed"
                      onClick={() => handleAddSection('below')}
                    >
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Add Section
                    </Button>
                  </div>
                </div>
              </div>
            </DragDropContext>
          ) : viewMode === 'kanban-status' ? (
            /* Status Kanban Board - Tasks grouped by status with drag-drop */
            <DragDropContext onDragEnd={(result) => {
              if (!result.destination) return;
              const { source, destination, draggableId } = result;
              const taskId = draggableId;
              const sourceStatus = source.droppableId.replace('status-', '') as TaskStatus;
              const destStatus = destination.droppableId.replace('status-', '') as TaskStatus;
              const destIndex = destination.index;
              
              // If dropped in same position, do nothing
              if (source.droppableId === destination.droppableId && source.index === destination.index) return;
              
              // Update task status when moving between columns
              if (sourceStatus !== destStatus) {
                updateItem(taskId, { 
                  status: destStatus,
                  // Auto-complete when moved to completed column
                  completed: destStatus === 'completed',
                  completedAt: destStatus === 'completed' ? new Date() : undefined
                });
                Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
                toast.success(`Task status updated to ${destStatus.replace('_', ' ')}`);
              }
              
              // Persist new order
              const destGroupId = destination.droppableId;
              const destTasks = items.filter(item => {
                const itemStatus = item.status || 'not_started';
                return destGroupId === `status-${itemStatus}` || 
                       (destGroupId === 'status-completed' && item.completed);
              });
              // Apply current saved order first
              const currentlyOrderedTasks = applyTaskOrder(destTasks, destGroupId);
              const currentOrderIds = currentlyOrderedTasks.map(t => t.id);
              const taskCurrentIndex = currentOrderIds.indexOf(taskId);
              if (taskCurrentIndex !== -1) {
                currentOrderIds.splice(taskCurrentIndex, 1);
              }
              currentOrderIds.splice(destIndex, 0, taskId);
              updateSectionOrder(destGroupId, currentOrderIds);
              setOrderVersion(v => v + 1);
            }}>
              <div className="overflow-x-auto pb-4 -mx-4 px-4">
                <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
                  {(() => {
                    const statusGroups: { id: TaskStatus; label: string; color: string; icon: React.ReactNode; tasks: TodoItem[] }[] = [
                      { 
                        id: 'not_started', 
                        label: t('grouping.notStarted'), 
                        color: '#6b7280', 
                        icon: <Circle className="h-3.5 w-3.5" />,
                        tasks: uncompletedItems.filter(item => !item.status || item.status === 'not_started')
                      },
                      { 
                        id: 'in_progress', 
                        label: t('grouping.inProgress'), 
                        color: '#3b82f6', 
                        icon: <Loader2 className="h-3.5 w-3.5" />,
                        tasks: uncompletedItems.filter(item => item.status === 'in_progress')
                      },
                      { 
                        id: 'almost_done', 
                        label: t('grouping.almostDone'), 
                        color: '#f59e0b', 
                        icon: <ClockIcon className="h-3.5 w-3.5" />,
                        tasks: uncompletedItems.filter(item => item.status === 'almost_done')
                      },
                      { 
                        id: 'completed', 
                        label: t('grouping.completed'), 
                        color: '#10b981', 
                        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
                        tasks: completedItems
                      },
                    ];
                    
                    return statusGroups.map((group) => {
                      const statusSectionId = `status-${group.id}`;
                      const isCollapsed = collapsedViewSections.has(statusSectionId);
                      const orderedTasks = applyTaskOrder(group.tasks, statusSectionId);
                      
                      return (
                        <div 
                          key={group.id} 
                          className="flex-shrink-0 w-72 bg-muted/30 rounded-xl border border-border/30 overflow-hidden"
                        >
                          <button 
                            onClick={() => toggleViewSectionCollapse(statusSectionId)}
                            className="w-full flex items-center gap-2 px-3 py-3 border-b border-border/30 hover:bg-muted/20 transition-colors"
                            style={{ borderLeft: `4px solid ${group.color}` }}
                          >
                            <span style={{ color: group.color }}>{group.icon}</span>
                            <span className="text-sm font-semibold flex-1 text-left">{group.label}</span>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              {group.tasks.length}
                            </span>
                            {isCollapsed ? (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                          
                          {!isCollapsed && (
                            <Droppable droppableId={statusSectionId}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={cn(
                                    "min-h-[200px] max-h-[400px] overflow-y-auto p-2 space-y-2",
                                    snapshot.isDraggingOver && "bg-primary/5"
                                  )}
                                >
                                  {orderedTasks.length === 0 ? (
                                    <div className="py-8 text-center text-sm text-muted-foreground">
                                      Drop tasks here
                                    </div>
                                  ) : (
                                    orderedTasks.map((item, index) => (
                                      <Draggable key={item.id} draggableId={item.id} index={index}>
                                        {(provided, snapshot) => (
                                          <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            className={cn(
                                              "bg-card rounded-lg border border-border/50 shadow-sm overflow-hidden",
                                              snapshot.isDragging && "shadow-lg ring-2 ring-primary",
                                              group.id === 'completed' && "opacity-70"
                                            )}
                                          >
                                            {renderTaskItem(item)}
                                            {renderSubtasksInline(item)}
                                          </div>
                                        )}
                                      </Draggable>
                                    ))
                                  )}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </DragDropContext>
          ) : viewMode === 'timeline' ? (
            /* Timeline Board - Tasks grouped by date with drag-drop */
            <DragDropContext onDragEnd={(result) => {
              if (!result.destination) return;
              const { source, destination, draggableId } = result;
              const taskId = draggableId;
              const sourceGroup = source.droppableId;
              const destGroup = destination.droppableId;
              const sourceIndex = source.index;
              const destIndex = destination.index;
              
              // If dropped in same position, do nothing
              if (sourceGroup === destGroup && sourceIndex === destIndex) return;
              
              const today = new Date();
              let newDate: Date | undefined;
              
              // Only update date if moving to a different group
              if (sourceGroup !== destGroup) {
                if (destGroup === 'timeline-overdue') newDate = subDays(today, 1);
                else if (destGroup === 'timeline-today') newDate = today;
                else if (destGroup === 'timeline-tomorrow') { newDate = new Date(); newDate.setDate(newDate.getDate() + 1); }
                else if (destGroup === 'timeline-thisweek') { newDate = new Date(); newDate.setDate(newDate.getDate() + 3); }
                else if (destGroup === 'timeline-later') { newDate = new Date(); newDate.setDate(newDate.getDate() + 14); }
                else if (destGroup === 'timeline-nodate') newDate = undefined;
                
                updateItem(taskId, { dueDate: newDate });
                Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
                toast.success('Task date updated');
              }
              
              // Persist new order for the destination group (whether moved or reordered)
              const destGroupTasks = items.filter(item => !item.completed).filter(item => {
                const itemDate = item.dueDate ? new Date(item.dueDate) : null;
                if (destGroup === 'timeline-overdue') return itemDate && isBefore(itemDate, startOfDay(today));
                if (destGroup === 'timeline-today') return itemDate && isToday(itemDate);
                if (destGroup === 'timeline-tomorrow') return itemDate && isTomorrow(itemDate);
                if (destGroup === 'timeline-thisweek') return itemDate && isThisWeek(itemDate) && !isToday(itemDate) && !isTomorrow(itemDate);
                if (destGroup === 'timeline-later') return itemDate && !isBefore(itemDate, startOfDay(today)) && !isThisWeek(itemDate);
                if (destGroup === 'timeline-nodate') return !itemDate;
                return false;
              });
              // Apply current saved order first
              const currentlyOrderedTasks = applyTaskOrder(destGroupTasks, destGroup);
              const currentOrderIds = currentlyOrderedTasks.map(t => t.id);
              const taskCurrentIndex = currentOrderIds.indexOf(taskId);
              if (taskCurrentIndex !== -1) {
                currentOrderIds.splice(taskCurrentIndex, 1);
              }
              currentOrderIds.splice(destIndex, 0, taskId);
              updateSectionOrder(destGroup, currentOrderIds);
              
              // Force re-render to apply the new order immediately
              setOrderVersion(v => v + 1);
              
              Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
            }}>
              <div className="space-y-6">
                {(() => {
                  const today = startOfDay(new Date());
                  const overdueTasks = uncompletedItems.filter(item => item.dueDate && isBefore(new Date(item.dueDate), today));
                  const todayTasks = uncompletedItems.filter(item => item.dueDate && isToday(new Date(item.dueDate)));
                  const tomorrowTasks = uncompletedItems.filter(item => item.dueDate && isTomorrow(new Date(item.dueDate)));
                  const thisWeekTasks = uncompletedItems.filter(item => item.dueDate && isThisWeek(new Date(item.dueDate)) && !isToday(new Date(item.dueDate)) && !isTomorrow(new Date(item.dueDate)));
                  const laterTasks = uncompletedItems.filter(item => item.dueDate && !isBefore(new Date(item.dueDate), today) && !isThisWeek(new Date(item.dueDate)));
                  const noDateTasks = uncompletedItems.filter(item => !item.dueDate);
                  
                  const timelineGroups = [
                    { id: 'timeline-overdue', label: t('grouping.overdue'), tasks: overdueTasks, color: '#ef4444', icon: <AlertCircle className="h-4 w-4" /> },
                    { id: 'timeline-today', label: t('grouping.today'), tasks: todayTasks, color: '#3b82f6', icon: <Sun className="h-4 w-4" /> },
                    { id: 'timeline-tomorrow', label: t('grouping.tomorrow'), tasks: tomorrowTasks, color: '#f59e0b', icon: <CalendarIcon2 className="h-4 w-4" /> },
                    { id: 'timeline-thisweek', label: t('grouping.thisWeek'), tasks: thisWeekTasks, color: '#10b981', icon: <CalendarIcon2 className="h-4 w-4" /> },
                    { id: 'timeline-later', label: t('grouping.later'), tasks: laterTasks, color: '#8b5cf6', icon: <Clock className="h-4 w-4" /> },
                    { id: 'timeline-nodate', label: t('grouping.noDate'), tasks: noDateTasks, color: '#6b7280', icon: <CalendarX className="h-4 w-4" /> },
                  ];
                  
                  return (
                    <>
                      {timelineGroups.map((group) => {
                        const isCollapsed = collapsedViewSections.has(group.id);
                        // Apply persisted order
                        const orderedTasks = applyTaskOrder(group.tasks, group.id);
                        return (
                          <div key={group.label} className="bg-muted/30 rounded-xl border border-border/30 overflow-hidden">
                            {renderViewModeSectionHeader(group.label, group.tasks.length, group.color, group.icon, group.id)}
                            {!isCollapsed && (
                              <Droppable droppableId={group.id}>
                                {(provided, snapshot) => (
                                  <div ref={provided.innerRef} {...provided.droppableProps} className={cn("p-2 space-y-2 min-h-[50px]", snapshot.isDraggingOver && "bg-primary/5")}>
                                    {orderedTasks.map((item, index) => (
                                      <Draggable key={item.id} draggableId={item.id} index={index}>
                                        {(provided, snapshot) => (
                                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={cn("bg-card rounded-lg border border-border/50", snapshot.isDragging && "shadow-lg ring-2 ring-primary")}>
                                            {renderTaskItem(item)}
                                            {renderSubtasksInline(item)}
                                          </div>
                                        )}
                                      </Draggable>
                                    ))}
                                    {provided.placeholder}
                                  </div>
                                )}
                              </Droppable>
                            )}
                          </div>
                        );
                      })}
                      {renderCompletedSectionForViewMode()}
                    </>
                  );
                })()}
              </div>
            </DragDropContext>
          ) : viewMode === 'progress' ? (
            /* Progress Board - Tasks grouped by completion status/subtask progress with drag-drop */
            <DragDropContext onDragEnd={(result) => {
              if (!result.destination) return;
              const { source, destination } = result;
              
              const taskId = result.draggableId;
              const destGroup = destination.droppableId;
              const destIndex = destination.index;
              
              // If dropped in same position, do nothing
              if (source.droppableId === destination.droppableId && source.index === destination.index) return;
              
              // Progress board allows visual reordering with haptic feedback
              // Persist the new order
              const destGroupTasks = items.filter(item => !item.completed).filter(item => {
                const hasSubtasks = item.subtasks && item.subtasks.length > 0;
                const completedSubtasks = hasSubtasks ? item.subtasks.filter(st => st.completed).length : 0;
                const totalSubtasks = hasSubtasks ? item.subtasks.length : 0;
                const completionPercent = hasSubtasks ? completedSubtasks / totalSubtasks : 0;
                
                if (destGroup === 'progress-notstarted') return !hasSubtasks || completedSubtasks === 0;
                if (destGroup === 'progress-inprogress') return hasSubtasks && completedSubtasks > 0 && completionPercent < 0.75;
                if (destGroup === 'progress-almostdone') return hasSubtasks && completionPercent >= 0.75 && completedSubtasks < totalSubtasks;
                return false;
              });
              // Apply current saved order first
              const currentlyOrderedTasks = applyTaskOrder(destGroupTasks, destGroup);
              const currentOrderIds = currentlyOrderedTasks.map(t => t.id);
              const taskCurrentIndex = currentOrderIds.indexOf(taskId);
              if (taskCurrentIndex !== -1) {
                currentOrderIds.splice(taskCurrentIndex, 1);
              }
              currentOrderIds.splice(destIndex, 0, taskId);
              updateSectionOrder(destGroup, currentOrderIds);
              
              // Force re-render to apply the new order immediately
              setOrderVersion(v => v + 1);
              
              Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
            }}>
              <div className="space-y-6">
                {(() => {
                  const notStarted = uncompletedItems.filter(item => !item.subtasks || item.subtasks.length === 0 || item.subtasks.every(st => !st.completed));
                  const inProgress = uncompletedItems.filter(item => item.subtasks && item.subtasks.length > 0 && item.subtasks.some(st => st.completed) && item.subtasks.some(st => !st.completed));
                  const almostDone = uncompletedItems.filter(item => item.subtasks && item.subtasks.length > 0 && item.subtasks.filter(st => st.completed).length >= item.subtasks.length * 0.75 && item.subtasks.some(st => !st.completed));
                  
                  const progressGroups = [
                    { id: 'progress-notstarted', label: t('grouping.notStarted'), tasks: notStarted.filter(t => !inProgress.includes(t) && !almostDone.includes(t)), color: '#6b7280', percent: '0%' },
                    { id: 'progress-inprogress', label: t('grouping.inProgress'), tasks: inProgress.filter(t => !almostDone.includes(t)), color: '#f59e0b', percent: '25-74%' },
                    { id: 'progress-almostdone', label: t('grouping.almostDone'), tasks: almostDone, color: '#10b981', percent: '75%+' },
                  ];
                  
                  return (
                    <>
                      {progressGroups.map((group) => {
                        const isCollapsed = collapsedViewSections.has(group.id);
                        // Apply persisted order
                        const orderedTasks = applyTaskOrder(group.tasks, group.id);
                        return (
                          <div key={group.label} className="bg-muted/30 rounded-xl border border-border/30 overflow-hidden">
                            {renderViewModeSectionHeader(
                              group.label, 
                              group.tasks.length, 
                              group.color, 
                              <TrendingUp className="h-4 w-4" />, 
                              group.id,
                              <span className="text-xs text-muted-foreground">{group.percent}</span>
                            )}
                            {!isCollapsed && (
                              <Droppable droppableId={group.id}>
                                {(provided, snapshot) => (
                                  <div ref={provided.innerRef} {...provided.droppableProps} className={cn("p-2 space-y-2 min-h-[50px]", snapshot.isDraggingOver && "bg-primary/5")}>
                                    {orderedTasks.map((item, index) => (
                                      <Draggable key={item.id} draggableId={item.id} index={index}>
                                        {(provided, snapshot) => (
                                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={cn("bg-card rounded-lg border border-border/50 overflow-hidden", snapshot.isDragging && "shadow-lg ring-2 ring-primary")}>
                                            {renderTaskItem(item)}
                                            {renderSubtasksInline(item)}
                                          </div>
                                        )}
                                      </Draggable>
                                    ))}
                                    {provided.placeholder}
                                  </div>
                                )}
                              </Droppable>
                            )}
                          </div>
                        );
                      })}
                      {renderCompletedSectionForViewMode()}
                    </>
                  );
                })()}
              </div>
            </DragDropContext>
          ) : viewMode === 'priority' ? (
            /* Priority Board - Tasks grouped by priority with drag-drop */
            <DragDropContext onDragEnd={(result) => {
              if (!result.destination) return;
              const { source, destination, draggableId } = result;
              const taskId = draggableId;
              const sourceGroup = source.droppableId;
              const destGroup = destination.droppableId;
              const sourceIndex = source.index;
              const destIndex = destination.index;
              
              // If dropped in same position, do nothing
              if (sourceGroup === destGroup && sourceIndex === destIndex) return;
              
              // Only update priority if moving to a different group
              if (sourceGroup !== destGroup) {
                let newPriority: Priority = 'none';
                
                if (destGroup === 'priority-high') newPriority = 'high';
                else if (destGroup === 'priority-medium') newPriority = 'medium';
                else if (destGroup === 'priority-low') newPriority = 'low';
                else if (destGroup === 'priority-none') newPriority = 'none';
                
                updateItem(taskId, { priority: newPriority });
                Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
                toast.success(t('todayPage.priorityUpdated'));
              }
              
              // Persist new order for the destination group
              const destGroupTasks = items.filter(item => !item.completed).filter(item => {
                if (destGroup === 'priority-high') return item.priority === 'high';
                if (destGroup === 'priority-medium') return item.priority === 'medium';
                if (destGroup === 'priority-low') return item.priority === 'low';
                if (destGroup === 'priority-none') return !item.priority || item.priority === 'none';
                return false;
              });
              // Apply current saved order first
              const currentlyOrderedTasks = applyTaskOrder(destGroupTasks, destGroup);
              const currentOrderIds = currentlyOrderedTasks.map(t => t.id);
              const taskCurrentIndex = currentOrderIds.indexOf(taskId);
              if (taskCurrentIndex !== -1) {
                currentOrderIds.splice(taskCurrentIndex, 1);
              }
              currentOrderIds.splice(destIndex, 0, taskId);
              updateSectionOrder(destGroup, currentOrderIds);
              
              // Force re-render to apply the new order immediately
              setOrderVersion(v => v + 1);
              
              Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
            }}>
              <div className="space-y-6">
                {(() => {
                  const highPriority = uncompletedItems.filter(item => item.priority === 'high');
                  const mediumPriority = uncompletedItems.filter(item => item.priority === 'medium');
                  const lowPriority = uncompletedItems.filter(item => item.priority === 'low');
                  const noPriority = uncompletedItems.filter(item => !item.priority || item.priority === 'none');
                  
                  const priorityGroups = [
                    { id: 'priority-high', label: t('grouping.highPriority', 'High Priority'), tasks: highPriority, color: getPriorityColor('high'), icon: <Flame className="h-4 w-4" style={{ color: getPriorityColor('high') }} /> },
                    { id: 'priority-medium', label: t('grouping.mediumPriority', 'Medium Priority'), tasks: mediumPriority, color: getPriorityColor('medium'), icon: <Flag className="h-4 w-4" style={{ color: getPriorityColor('medium') }} /> },
                    { id: 'priority-low', label: t('grouping.lowPriority', 'Low Priority'), tasks: lowPriority, color: getPriorityColor('low'), icon: <Flag className="h-4 w-4" style={{ color: getPriorityColor('low') }} /> },
                    { id: 'priority-none', label: t('grouping.noPriority', 'No Priority'), tasks: noPriority, color: getPriorityColor('none'), icon: <Flag className="h-4 w-4" style={{ color: getPriorityColor('none') }} /> },
                  ];
                  
                  return (
                    <>
                      {priorityGroups.map((group) => {
                        const isCollapsed = collapsedViewSections.has(group.id);
                        // Apply persisted order
                        const orderedTasks = applyTaskOrder(group.tasks, group.id);
                        return (
                          <div key={group.label} className="bg-muted/30 rounded-xl border border-border/30 overflow-hidden">
                            {renderViewModeSectionHeader(group.label, group.tasks.length, group.color, group.icon, group.id)}
                            {!isCollapsed && (
                              <Droppable droppableId={group.id}>
                                {(provided, snapshot) => (
                                  <div ref={provided.innerRef} {...provided.droppableProps} className={cn("p-2 space-y-2 min-h-[50px]", snapshot.isDraggingOver && "bg-primary/5")}>
                                    {orderedTasks.map((item, index) => (
                                      <Draggable key={item.id} draggableId={item.id} index={index}>
                                        {(provided, snapshot) => (
                                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={cn("bg-card rounded-lg border border-border/50 overflow-hidden", snapshot.isDragging && "shadow-lg ring-2 ring-primary")}>
                                            {renderTaskItem(item)}
                                            {renderSubtasksInline(item)}
                                          </div>
                                        )}
                                      </Draggable>
                                    ))}
                                    {provided.placeholder}
                                  </div>
                                )}
                              </Droppable>
                            )}
                          </div>
                        );
                      })}
                      {renderCompletedSectionForViewMode()}
                    </>
                  );
                })()}
              </div>
            </DragDropContext>
          ) : viewMode === 'history' ? (
            /* History Log - Recent activity and completed tasks */
            <div className="space-y-6">
              {(() => {
                const todayCompleted = completedItems.filter(item => item.dueDate && isToday(new Date(item.dueDate)));
                const yesterdayCompleted = completedItems.filter(item => item.dueDate && isYesterday(new Date(item.dueDate)));
                const thisWeekCompleted = completedItems.filter(item => item.dueDate && isThisWeek(new Date(item.dueDate)) && !isToday(new Date(item.dueDate)) && !isYesterday(new Date(item.dueDate)));
                const olderCompleted = completedItems.filter(item => !item.dueDate || (!isThisWeek(new Date(item.dueDate))));
                
                const historyGroups = [
                  { label: t('grouping.completedToday', 'Completed Today'), tasks: todayCompleted, color: '#10b981' },
                  { label: t('grouping.completedYesterday', 'Completed Yesterday'), tasks: yesterdayCompleted, color: '#3b82f6' },
                  { label: t('grouping.thisWeek', 'This Week'), tasks: thisWeekCompleted, color: '#8b5cf6' },
                  { label: t('grouping.older', 'Older'), tasks: olderCompleted, color: '#6b7280' },
                ];
                
                return historyGroups.filter(g => g.tasks.length > 0).length === 0 ? (
                  <div className="text-center py-20">
                    <History className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">{t('emptyStates.noCompletedTasks')}</p>
                  </div>
                ) : (
                  <>
                    {historyGroups.filter(g => g.tasks.length > 0).map((group) => {
                      const sectionId = `history-${group.label.toLowerCase().replace(/\s+/g, '-')}`;
                      const isCollapsed = collapsedViewSections.has(sectionId);
                      return (
                        <div key={group.label} className="bg-muted/30 rounded-xl border border-border/30 overflow-hidden">
                          {renderViewModeSectionHeader(group.label, group.tasks.length, group.color, <CheckCircle2 className="h-4 w-4" />, sectionId)}
                          {!isCollapsed && (
                            <div className="p-2 space-y-2">
                              {group.tasks.map((item) => (
                                <div key={item.id} className="bg-card rounded-lg border border-border/50 opacity-70">
                                  {renderTaskItem(item)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          ) : groupByOption !== 'none' ? (
            /* Grouped Flat Mode with Drag & Drop */
            <DragDropContext onDragEnd={(result) => {
              if (!result.destination) return;
              const { source, destination, draggableId } = result;
              const taskId = draggableId;
              const sourceGroup = source.droppableId.replace('grouped-', '');
              const destGroup = destination.droppableId.replace('grouped-', '');
              const destIndex = destination.index;
              
              // If dropped in same position, do nothing
              if (source.droppableId === destination.droppableId && source.index === destination.index) return;
              
              // Update task based on group type
              if (sourceGroup !== destGroup) {
                if (groupByOption === 'priority') {
                  const priorityMap: Record<string, Priority> = { 'high': 'high', 'medium': 'medium', 'low': 'low', 'none': 'none' };
                  updateItem(taskId, { priority: priorityMap[destGroup] || 'none' });
                  toast.success(t('todayPage.priorityUpdated'));
                } else if (groupByOption === 'section') {
                  updateItem(taskId, { sectionId: destGroup });
                  toast.success(t('todayPage.sectionMoved'));
                } else if (groupByOption === 'date') {
                  const today = new Date();
                  let newDate: Date | undefined;
                  if (destGroup === 'overdue') newDate = subDays(today, 1);
                  else if (destGroup === 'today') newDate = today;
                  else if (destGroup === 'tomorrow') { newDate = new Date(); newDate.setDate(newDate.getDate() + 1); }
                  else if (destGroup === 'this-week') { newDate = new Date(); newDate.setDate(newDate.getDate() + 3); }
                  else if (destGroup === 'later') { newDate = new Date(); newDate.setDate(newDate.getDate() + 14); }
                  else if (destGroup === 'no-date') newDate = undefined;
                  updateItem(taskId, { dueDate: newDate });
                  toast.success(t('todayPage.dateUpdated', 'Date updated'));
                }
                Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
              }
              
              // Persist order in destination group
              const destGroupId = `grouped-${destGroup}`;
              updateSectionOrder(destGroupId, [taskId]);
              setOrderVersion(v => v + 1);
            }}>
              <div className="space-y-4">
                {(() => {
                  // Generate groups based on groupByOption
                  let groups: { id: string; label: string; color: string; icon: React.ReactNode; tasks: TodoItem[] }[] = [];
                  
                  if (groupByOption === 'section') {
                    groups = sortedSections.map(section => ({
                      id: section.id,
                      label: section.name,
                      color: section.color,
                      icon: <Columns3 className="h-4 w-4" style={{ color: section.color }} />,
                      tasks: uncompletedItems.filter(item => item.sectionId === section.id || (!item.sectionId && section.id === sections[0]?.id))
                    }));
                  } else if (groupByOption === 'priority') {
                    groups = [
                      { id: 'high', label: t('grouping.highPriority'), color: getPriorityColor('high'), icon: <Flame className="h-4 w-4" style={{ color: getPriorityColor('high') }} />, tasks: uncompletedItems.filter(item => item.priority === 'high') },
                      { id: 'medium', label: t('grouping.mediumPriority'), color: getPriorityColor('medium'), icon: <Flag className="h-4 w-4" style={{ color: getPriorityColor('medium') }} />, tasks: uncompletedItems.filter(item => item.priority === 'medium') },
                      { id: 'low', label: t('grouping.lowPriority'), color: getPriorityColor('low'), icon: <Flag className="h-4 w-4" style={{ color: getPriorityColor('low') }} />, tasks: uncompletedItems.filter(item => item.priority === 'low') },
                      { id: 'none', label: t('grouping.noPriority'), color: getPriorityColor('none'), icon: <Flag className="h-4 w-4" style={{ color: getPriorityColor('none') }} />, tasks: uncompletedItems.filter(item => !item.priority || item.priority === 'none') },
                    ];
                  } else if (groupByOption === 'date') {
                    const today = startOfDay(new Date());
                    groups = [
                      { id: 'overdue', label: t('grouping.overdue'), color: '#ef4444', icon: <AlertCircle className="h-4 w-4 text-destructive" />, tasks: uncompletedItems.filter(item => item.dueDate && isBefore(new Date(item.dueDate), today)) },
                      { id: 'today', label: t('grouping.today'), color: '#3b82f6', icon: <Sun className="h-4 w-4 text-info" />, tasks: uncompletedItems.filter(item => item.dueDate && isToday(new Date(item.dueDate))) },
                      { id: 'tomorrow', label: t('grouping.tomorrow'), color: '#f59e0b', icon: <CalendarIcon2 className="h-4 w-4 text-warning" />, tasks: uncompletedItems.filter(item => item.dueDate && isTomorrow(new Date(item.dueDate))) },
                      { id: 'this-week', label: t('grouping.thisWeek'), color: '#10b981', icon: <CalendarIcon2 className="h-4 w-4 text-success" />, tasks: uncompletedItems.filter(item => item.dueDate && isThisWeek(new Date(item.dueDate)) && !isToday(new Date(item.dueDate)) && !isTomorrow(new Date(item.dueDate))) },
                      { id: 'later', label: t('grouping.later'), color: '#8b5cf6', icon: <Clock className="h-4 w-4 text-accent-purple" />, tasks: uncompletedItems.filter(item => item.dueDate && !isBefore(new Date(item.dueDate), today) && !isThisWeek(new Date(item.dueDate))) },
                      { id: 'no-date', label: t('grouping.noDate'), color: '#6b7280', icon: <CalendarX className="h-4 w-4 text-muted-foreground" />, tasks: uncompletedItems.filter(item => !item.dueDate) },
                    ];
                  }
                  
                  // Show all groups including empty ones for drag-drop targets
                  return groups.map(group => {
                    const groupSectionId = `group-${groupByOption}-${group.id}`;
                    const isCollapsed = collapsedViewSections.has(groupSectionId);
                    const orderedTasks = applyTaskOrder(group.tasks, `grouped-${group.id}`);
                    
                    return (
                      <div key={group.id} className="bg-muted/30 rounded-xl border border-border/30 overflow-hidden">
                        <button 
                          onClick={() => toggleViewSectionCollapse(groupSectionId)}
                          className="w-full flex items-center gap-2 px-3 py-3 border-b border-border/30 hover:bg-muted/20 transition-colors"
                          style={{ borderLeft: `4px solid ${group.color}` }}
                        >
                          {group.icon}
                          <span className="text-sm font-semibold flex-1 text-left">{group.label}</span>
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {group.tasks.length}
                          </span>
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                        {!isCollapsed && (
                          <Droppable droppableId={`grouped-${group.id}`}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={cn(
                                  "p-2 space-y-1 min-h-[40px]",
                                  compactMode && "p-1 space-y-0",
                                  snapshot.isDraggingOver && "bg-primary/5"
                                )}
                              >
                                {orderedTasks.length === 0 ? (
                                  <div className="py-4 text-center text-sm text-muted-foreground">
                                    {t('todayPage.dropTasksHere')}
                                  </div>
                                ) : (
                                  orderedTasks.map((item, index) => (
                                    <Draggable key={item.id} draggableId={item.id} index={index}>
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          className={cn(
                                            "bg-card rounded-lg border border-border/50",
                                            snapshot.isDragging && "shadow-lg ring-2 ring-primary"
                                          )}
                                        >
                                          {renderTaskItem(item)}
                                          {renderSubtasksInline(item)}
                                        </div>
                                      )}
                                    </Draggable>
                                  ))
                                )}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        )}
                      </div>
                    );
                  });
                })()}
                {/* Completed Section */}
                {showCompleted && completedItems.length > 0 && (
                  <Collapsible open={isCompletedOpen} onOpenChange={setIsCompletedOpen}>
                    <div className="bg-muted/50 rounded-xl p-3 border border-border/30">
                      <CollapsibleTrigger asChild>
                        <button className="w-full flex items-center justify-between px-2 py-2 hover:bg-muted/60 rounded-lg transition-colors">
                          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('todayPage.completed')}</span>
                          <div className="flex items-center gap-2 text-muted-foreground"><span className="text-sm font-medium">{completedItems.length}</span>{isCompletedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</div>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className={cn("space-y-2 mt-2", compactMode && "space-y-1 mt-1")}>{completedItems.map(renderTaskItem)}</CollapsibleContent>
                    </div>
                  </Collapsible>
                )}
              </div>
            </DragDropContext>
          ) : (
            /* Flat/Card Mode - Vertical Sections with @hello-pangea/dnd */
            <DragDropContext onDragEnd={(result) => {
              if (!result.destination) return;
              const { source, destination, draggableId } = result;
              const taskId = draggableId;
              const sourceSectionId = source.droppableId.replace('flat-section-', '');
              const destSectionId = destination.droppableId.replace('flat-section-', '');
              const destIndex = destination.index;
              
              // If dropped in same position, do nothing
              if (source.droppableId === destination.droppableId && source.index === destination.index) return;
              
              // Update task section if moved to a different section
              if (sourceSectionId !== destSectionId) {
                updateItem(taskId, { sectionId: destSectionId === 'default' ? undefined : destSectionId });
                toast.success(t('tasks.movedToSection', 'Moved to section'));
                Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
              }
              
              // Persist order in destination section
              const destSectionTasks = uncompletedItems.filter(item => {
                const itemSectionId = item.sectionId || 'default';
                return itemSectionId === destSectionId;
              });
              // Apply current saved order first, then reorder
              const currentlyOrderedTasks = applyTaskOrder(destSectionTasks, `flat-section-${destSectionId}`);
              const currentOrderIds = currentlyOrderedTasks.map(t => t.id);
              
              // Remove the task from its current position and insert at new position
              const taskCurrentIndex = currentOrderIds.indexOf(taskId);
              if (taskCurrentIndex !== -1) {
                currentOrderIds.splice(taskCurrentIndex, 1);
              }
              currentOrderIds.splice(destIndex, 0, taskId);
              
              updateSectionOrder(`flat-section-${destSectionId}`, currentOrderIds);
              
              // Force re-render to apply the new order immediately
              setOrderVersion(v => v + 1);
              
              Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
            }}>
              <div className="space-y-4">
                {sortedSections.map((section) => {
                  const sectionTasks = uncompletedItems.filter(item => 
                    item.sectionId === section.id || (!item.sectionId && section.id === sections[0]?.id)
                  );
                  const sectionId = section.id === sections[0]?.id ? 'default' : section.id;
                  const isCollapsed = collapsedViewSections.has(`flat-${section.id}`);
                  const orderedTasks = applyTaskOrder(sectionTasks, `flat-section-${sectionId}`);
                  
                  return (
                    <div key={section.id} className="bg-muted/30 rounded-xl border border-border/30 overflow-hidden">
                      {renderSectionHeader(section, false)}
                      {!isCollapsed && (
                        <Droppable droppableId={`flat-section-${sectionId}`}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={cn(
                                "p-2 space-y-1 min-h-[40px]",
                                compactMode && "p-1 space-y-0",
                                snapshot.isDraggingOver && "bg-primary/5"
                              )}
                            >
                              {orderedTasks.length === 0 ? (
                                <div className={cn("text-center text-sm text-muted-foreground", compactMode ? "py-2 px-2" : "py-4 px-4")}>
                                  {t('emptyStates.noTasksInSection')}
                                </div>
                              ) : (
                                orderedTasks.map((item, index) => (
                                  <Draggable key={item.id} draggableId={item.id} index={index}>
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={cn(
                                          "bg-card rounded-lg border border-border/50",
                                          snapshot.isDragging && "shadow-lg ring-2 ring-primary"
                                        )}
                                      >
                                        {renderTaskItem(item)}
                                        {renderSubtasksInline(item)}
                                      </div>
                                    )}
                                  </Draggable>
                                ))
                              )}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      )}
                    </div>
                  );
                })}
                {/* Completed Section */}
                {showCompleted && completedItems.length > 0 && (
                  <Collapsible open={isCompletedOpen} onOpenChange={setIsCompletedOpen}>
                    <div className="bg-muted/50 rounded-xl p-3 border border-border/30">
                      <CollapsibleTrigger asChild>
                        <button className="w-full flex items-center justify-between px-2 py-2 hover:bg-muted/60 rounded-lg transition-colors">
                          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('grouping.completed')}</span>
                          <div className="flex items-center gap-2 text-muted-foreground"><span className="text-sm font-medium">{completedItems.length}</span>{isCompletedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</div>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className={cn("space-y-2 mt-2", compactMode && "space-y-1 mt-1")}>{completedItems.map(renderTaskItem)}</CollapsibleContent>
                    </div>
                  </Collapsible>
                )}
              </div>
            </DragDropContext>
          )}
        </div>
      </main>

      <Button data-tour="todo-add-task" onClick={async () => { try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {} setIsInputOpen(true); }} className="fixed left-4 right-4 z-30 h-12 text-base font-semibold" style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }} size="lg">
        <Plus className="h-5 w-5" />{t('tasks.addTask')}
      </Button>

      <TaskInputSheet isOpen={isInputOpen} onClose={() => { setIsInputOpen(false); setInputSectionId(null); }} onAddTask={handleAddTask} folders={folders} selectedFolderId={selectedFolderId} onCreateFolder={handleCreateFolder} sections={sections} selectedSectionId={inputSectionId} />
      <TaskDetailPage 
        isOpen={!!selectedTask} 
        task={selectedTask} 
        folders={folders}
        allTasks={items}
        onClose={() => setSelectedTask(null)} 
        onUpdate={(updatedTask) => { updateItem(updatedTask.id, updatedTask); setSelectedTask(updatedTask); }} 
        onDelete={deleteItem} 
        onDuplicate={duplicateTask}
        onConvertToNote={handleConvertSingleTask}
        onMoveToFolder={handleMoveTaskToFolder}
      />
      <TaskFilterSheet isOpen={isFilterSheetOpen} onClose={() => setIsFilterSheetOpen(false)} folders={folders} selectedFolderId={selectedFolderId} onFolderChange={setSelectedFolderId} dateFilter={dateFilter} onDateFilterChange={setDateFilter} priorityFilter={priorityFilter} onPriorityFilterChange={setPriorityFilter} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} selectedTags={tagFilter} onTagsChange={setTagFilter} onClearAll={handleClearFilters} onSaveAsSmartView={() => setIsSaveSmartViewOpen(true)} />
      <SaveSmartViewSheet
        isOpen={isSaveSmartViewOpen}
        onClose={() => setIsSaveSmartViewOpen(false)}
        currentFilters={{
          dateFilter,
          priorityFilter,
          statusFilter,
          tags: tagFilter,
          folderId: selectedFolderId,
        }}
        onSaved={() => loadCustomSmartViews().then(setCustomSmartViews)}
      />
      <DuplicateOptionsSheet isOpen={isDuplicateSheetOpen} onClose={() => setIsDuplicateSheetOpen(false)} onSelect={handleDuplicate} />
      <FolderManageSheet isOpen={isFolderManageOpen} onClose={() => setIsFolderManageOpen(false)} folders={folders} onCreateFolder={handleCreateFolder} onEditFolder={handleEditFolder} onDeleteFolder={handleDeleteFolder} onReorderFolders={handleReorderFolders} onToggleFavorite={handleToggleFolderFavorite} />
      
      <AutoScheduleSheet isOpen={isAutoScheduleOpen} onClose={() => setIsAutoScheduleOpen(false)} tasks={items} onApply={(updated) => { setItems(updated); toast.success(t('todayPage.scheduleApplied', 'Schedule applied!'), { icon: '📅' }); }} />
      <MoveToFolderSheet isOpen={isMoveToFolderOpen} onClose={() => setIsMoveToFolderOpen(false)} folders={folders} onSelect={handleMoveToFolder} />
      <SelectActionsSheet isOpen={isSelectActionsOpen} onClose={() => setIsSelectActionsOpen(false)} selectedCount={selectedTaskIds.size} onAction={handleSelectAction} totalCount={uncompletedItems.length} />
      <PrioritySelectSheet isOpen={isPrioritySheetOpen} onClose={() => setIsPrioritySheetOpen(false)} onSelect={handleSetPriority} />
      <BatchTaskSheet isOpen={isBatchTaskOpen} onClose={() => setIsBatchTaskOpen(false)} onAddTasks={handleBatchAddTasks} sections={sections} folders={folders} />
      <SectionEditSheet 
        isOpen={isSectionEditOpen} 
        onClose={() => { setIsSectionEditOpen(false); setEditingSection(null); }} 
        section={editingSection} 
        onSave={handleSaveSection} 
      />
      <SectionMoveSheet 
        isOpen={isSectionMoveOpen} 
        onClose={() => { setIsSectionMoveOpen(false); setEditingSection(null); }} 
        sections={sections} 
        currentSectionId={editingSection?.id || ''} 
        onMoveToPosition={(targetIndex) => editingSection && handleMoveSection(editingSection.id, targetIndex)} 
      />
      <SubtaskDetailSheet
        isOpen={!!selectedSubtask}
        subtask={selectedSubtask?.subtask || null}
        parentId={selectedSubtask?.parentId || null}
        onClose={() => setSelectedSubtask(null)}
        onUpdate={handleUpdateSubtaskFromSheet}
        onDelete={handleDeleteSubtaskFromSheet}
        onConvertToTask={handleConvertSubtaskToTask}
      />
      <TaskOptionsSheet
        isOpen={isTaskOptionsOpen}
        onClose={() => setIsTaskOptionsOpen(false)}
        groupBy={groupBy}
        sortBy={optionsSortBy}
        onGroupByChange={setGroupBy}
        onSortByChange={setOptionsSortBy}
        sections={sections}
        defaultSectionId={defaultSectionId}
        onDefaultSectionChange={setDefaultSectionId}
        taskAddPosition={taskAddPosition}
        onTaskAddPositionChange={setTaskAddPosition}
        hideDetailsOptions={hideDetailsOptions}
        onHideDetailsOptionsChange={setHideDetailsOptions}
      />
      <ResolvedImageDialog imageRef={selectedImage} onClose={() => setSelectedImage(null)} />
      <LocationRemindersMap
        open={isLocationMapOpen}
        onOpenChange={setIsLocationMapOpen}
        tasks={items}
        onTaskClick={(task) => {
          setSelectedTask(task);
          setIsLocationMapOpen(false);
        }}
      />
      <BulkDateSheet
        isOpen={isBulkDateSheetOpen}
        onClose={() => setIsBulkDateSheetOpen(false)}
        selectedCount={selectedTaskIds.size}
        onSetDate={(date) => {
          setItems(items.map(i => selectedTaskIds.has(i.id) ? { ...i, dueDate: date } : i));
          setSelectedTaskIds(new Set());
          setIsSelectionMode(false);
          toast.success(t('todayPage.bulkDateSet', { count: selectedTaskIds.size }));
        }}
      />
      <BulkReminderSheet
        isOpen={isBulkReminderSheetOpen}
        onClose={() => setIsBulkReminderSheetOpen(false)}
        selectedCount={selectedTaskIds.size}
        onSetReminder={(date) => {
          setItems(items.map(i => selectedTaskIds.has(i.id) ? { ...i, reminderTime: date } : i));
          setSelectedTaskIds(new Set());
          setIsSelectionMode(false);
          toast.success(t('todayPage.bulkReminderSet', { count: selectedTaskIds.size }));
        }}
      />
      <BulkRepeatSheet
        isOpen={isBulkRepeatSheetOpen}
        onClose={() => setIsBulkRepeatSheetOpen(false)}
        selectedCount={selectedTaskIds.size}
        onSetRepeat={(repeatType) => {
          setItems(items.map(i => selectedTaskIds.has(i.id) ? { ...i, repeatType } : i));
          setSelectedTaskIds(new Set());
          setIsSelectionMode(false);
          toast.success(t('todayPage.bulkRepeatSet', { count: selectedTaskIds.size }));
        }}
      />
      <BulkSectionMoveSheet
        isOpen={isBulkSectionMoveOpen}
        onClose={() => setIsBulkSectionMoveOpen(false)}
        selectedCount={selectedTaskIds.size}
        sections={sections}
        onMoveToSection={(sectionId) => {
          setItems(items.map(i => selectedTaskIds.has(i.id) ? { ...i, sectionId } : i));
          setSelectedTaskIds(new Set());
          setIsSelectionMode(false);
          toast.success(t('todayPage.bulkSectionMoved', { count: selectedTaskIds.size }));
        }}
      />
      <BulkStatusSheet
        isOpen={isBulkStatusOpen}
        onClose={() => setIsBulkStatusOpen(false)}
        selectedCount={selectedTaskIds.size}
        onStatusChange={(status) => {
          const isCompleting = status === 'completed';
          const now = new Date();
          setItems(items.map(i => selectedTaskIds.has(i.id) ? { 
            ...i, 
            status,
            completed: isCompleting ? true : i.completed,
            completedAt: isCompleting ? now : i.completedAt,
            modifiedAt: now
          } : i));
          setSelectedTaskIds(new Set());
          setIsSelectionMode(false);
          if (isCompleting) {
            playCompletionSound();
          }
          toast.success(t('todayPage.bulkStatusSet', { count: selectedTaskIds.size }));
        }}
      />
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmItem} onOpenChange={() => setDeleteConfirmItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('tasks.confirmDelete', 'Delete Task?')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {t('tasks.confirmDeleteMessage', 'Are you sure you want to delete this task?')}
          </p>
          <p className="text-sm font-medium truncate">{deleteConfirmItem?.text}</p>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirmItem(null)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button variant="destructive" className="flex-1" onClick={confirmDelete}>
              {t('common.delete', 'Delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Single Task Move Sheet (for swipe action) */}
      <TaskMoveSheet
        isOpen={!!swipeMoveTaskId}
        onClose={() => setSwipeMoveTaskId(null)}
        folders={folders}
        sections={sections}
        onSelectFolder={(folderId) => {
          if (swipeMoveTaskId) {
            updateItem(swipeMoveTaskId, { folderId: folderId || undefined });
            toast.success(t('tasks.movedToFolder', 'Task moved to folder'));
          }
          setSwipeMoveTaskId(null);
        }}
        onSelectSection={(sectionId) => {
          if (swipeMoveTaskId) {
            updateItem(swipeMoveTaskId, { sectionId: sectionId || undefined });
            toast.success(t('tasks.movedToSection', 'Task moved to section'));
          }
          setSwipeMoveTaskId(null);
        }}
        currentFolderId={items.find(i => i.id === swipeMoveTaskId)?.folderId}
        currentSectionId={items.find(i => i.id === swipeMoveTaskId)?.sectionId}
      />
      
      {/* Single Task Date Sheet (for swipe action) */}
      <Sheet open={!!swipeDateTaskId} onOpenChange={(open) => !open && setSwipeDateTaskId(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <CalendarIcon2 className="h-5 w-5" />
              {t('tasks.setDate', 'Set Date')}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (swipeDateTaskId) {
                    updateItem(swipeDateTaskId, { dueDate: new Date() });
                    toast.success(t('tasks.dateSetToday', 'Date set to today'));
                  }
                  setSwipeDateTaskId(null);
                }}
              >
                {t('common.today', 'Today')}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (swipeDateTaskId) {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    updateItem(swipeDateTaskId, { dueDate: tomorrow });
                    toast.success(t('tasks.dateSetTomorrow', 'Date set to tomorrow'));
                  }
                  setSwipeDateTaskId(null);
                }}
              >
                {t('common.tomorrow', 'Tomorrow')}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (swipeDateTaskId) {
                    const nextWeek = new Date();
                    nextWeek.setDate(nextWeek.getDate() + 7);
                    updateItem(swipeDateTaskId, { dueDate: nextWeek });
                    toast.success(t('tasks.dateSetNextWeek', 'Date set to next week'));
                  }
                  setSwipeDateTaskId(null);
                }}
              >
                {t('common.nextWeek', 'Next Week')}
              </Button>
            </div>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => {
                if (swipeDateTaskId) {
                  updateItem(swipeDateTaskId, { dueDate: undefined });
                  toast.success(t('tasks.dateCleared', 'Date cleared'));
                }
                setSwipeDateTaskId(null);
              }}
            >
              {t('tasks.clearDate', 'Clear Date')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      
      {/* Streak Challenge Dialog */}
      <StreakChallengeDialog
        isOpen={showStreakChallenge}
        onClose={closeStreakChallenge}
        currentStreak={streakData?.currentStreak || 0}
        weekData={streakWeekData}
      />
    </TodoLayout>
  );
};

export default Today;
