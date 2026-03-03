import { useState, useEffect, useMemo, useCallback } from 'react';
import { recordCompletion, TASK_STREAK_KEY } from '@/utils/streakStorage';

import { useTranslation } from 'react-i18next';
import { TodoItem, Priority, Folder, TaskSection } from '@/types/note';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Plus, ArrowUpDown, Filter, MousePointer2, Eye, EyeOff, MoreVertical, Copy, FolderInput, Flag, CheckCheck, X, MapPin, Crown } from 'lucide-react';
import { useSubscription, FREE_LIMITS } from '@/contexts/SubscriptionContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { format, isAfter, startOfDay, startOfWeek, endOfWeek, addDays, isTomorrow, isThisWeek } from 'date-fns';
import { TaskInputSheet } from '@/components/TaskInputSheet';
import { TaskDetailPage } from '@/components/TaskDetailPage';
import { TaskFilterSheet, DateFilter, PriorityFilter, StatusFilter } from '@/components/TaskFilterSheet';
import { SelectActionsSheet, SelectAction } from '@/components/SelectActionsSheet';
import { MoveToFolderSheet } from '@/components/MoveToFolderSheet';
import { PrioritySelectSheet } from '@/components/PrioritySelectSheet';
import { TaskItem } from '@/components/TaskItem';
import { SmartListsDropdown, SmartListType, getSmartListFilter } from '@/components/SmartListsDropdown';
import { LocationRemindersMap } from '@/components/LocationRemindersMap';

import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

import { createNextRecurringTask } from '@/utils/recurringTasks';
import { archiveCompletedTasks } from '@/utils/taskCleanup';
import { getCategoryById } from '@/utils/categories';
import { TodoLayout } from './TodoLayout';
import { loadTodoItems, saveTodoItems } from '@/utils/todoItemsStorage';
import { playCompletionSound } from '@/utils/taskSounds';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

const Upcoming = () => {
  const { t } = useTranslation();
  const { requireFeature, isPro } = useSubscription();
  const [items, setItems] = useState<TodoItem[]>([]);
  const [allItems, setAllItems] = useState<TodoItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<'week' | 'month'>('week');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedTask, setSelectedTask] = useState<TodoItem | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  
  // Selection mode
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  
  // Filters
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [smartList, setSmartList] = useState<SmartListType>('all');
  
  // Sheets
  const [isSelectActionsOpen, setIsSelectActionsOpen] = useState(false);
  const [isMoveToFolderOpen, setIsMoveToFolderOpen] = useState(false);
  const [isPrioritySheetOpen, setIsPrioritySheetOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const [isLocationMapOpen, setIsLocationMapOpen] = useState(false);
  

  const loadItems = useCallback(async () => {
    let loadedItems = await loadTodoItems();
    
    // Auto-archive completed tasks older than 3 days
    const { activeTasks, archivedCount } = await archiveCompletedTasks(loadedItems, 3);
    if (archivedCount > 0) {
      await saveTodoItems(activeTasks);
      loadedItems = activeTasks;
      toast.info(t('todayPage.archivedCompleted', { count: archivedCount }), { icon: '📦' });
    }
    
    setAllItems(loadedItems);
    
    const today = startOfDay(new Date());
    const upcomingItems = loadedItems.filter((item: TodoItem) =>
      item.dueDate && isAfter(startOfDay(new Date(item.dueDate)), today)
    );
    setItems(upcomingItems);
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      await loadItems();
      const { getSetting } = await import('@/utils/settingsStorage');
      const savedFolders = await getSetting<Folder[] | null>('todoFolders', null);
      if (savedFolders) {
        setFolders(savedFolders.map((f: Folder) => ({ ...f, createdAt: new Date(f.createdAt) })));
      }
    };
    loadAll();
    
    // Real-time updates
    const handleTasksUpdate = () => loadItems();
    window.addEventListener('tasksUpdated', handleTasksUpdate);
    
    return () => {
      window.removeEventListener('tasksUpdated', handleTasksUpdate);
    };
  }, [loadItems]);

  // Persist items
  useEffect(() => {
    if (allItems.length > 0) {
      saveTodoItems(allItems).then(({ persisted }) => {
        if (!persisted) {
          toast.error(t('todayPage.storageFull'), { id: 'storage-full' });
        }
      });
      window.dispatchEvent(new Event('tasksUpdated'));
    }
  }, [allItems]);

  const handleCreateFolder = async (name: string, color: string) => {
    if (!isPro && folders.length >= FREE_LIMITS.maxTaskFolders) {
      requireFeature('extra_folders');
      return;
    }
    const { setSetting } = await import('@/utils/settingsStorage');
    const newFolder: Folder = { id: Date.now().toString(), name, color, isDefault: false, createdAt: new Date() };
    const updatedFolders = [...folders, newFolder];
    setFolders(updatedFolders);
    await setSetting('todoFolders', updatedFolders);
  };

  const handleAddTask = async (task: Omit<TodoItem, 'id' | 'completed'>) => {
    const newItem: TodoItem = { id: Date.now().toString(), completed: false, ...task };
    const updatedAllItems = [newItem, ...allItems];
    setAllItems(updatedAllItems);
    await saveTodoItems(updatedAllItems);
    loadItems();
    
    // Schedule reminder in background
    if (newItem.reminderTime) {
      import('@/utils/reminderScheduler').then(({ scheduleTaskReminder }) => {
        scheduleTaskReminder(newItem.id, newItem.text, new Date(newItem.reminderTime!)).catch(console.warn);
      });
    }
  };

  const updateItem = async (itemId: string, updates: Partial<TodoItem>) => {
    const currentItem = allItems.find(i => i.id === itemId);
    
    // Play completion sound when completing a task
    if (updates.completed === true && currentItem && !currentItem.completed) {
      playCompletionSound();
      
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
    
    // Check if this is a recurring task being completed
    if (currentItem && updates.completed === true && !currentItem.completed) {
      if (currentItem.repeatType && currentItem.repeatType !== 'none') {
        const nextTask = createNextRecurringTask(currentItem);
        if (nextTask) {
          // Add the next occurrence
          const updatedAllItems = [
            nextTask,
            ...allItems.map(i => i.id === itemId ? { ...i, ...updates } : i)
          ];
          setAllItems(updatedAllItems);
          await saveTodoItems(updatedAllItems);
          toast.success(t('todayPage.recurringTaskCompleted'), {
            icon: '🔄',
          });
          loadItems();
          return;
        }
      }
    }
    
    const updatedAllItems = allItems.map((item) => (item.id === itemId ? { ...item, ...updates } : item));
    setAllItems(updatedAllItems);
    
    
    
    loadItems();
  };

  const deleteItem = async (itemId: string) => {
    const updatedAllItems = allItems.filter((item: TodoItem) => item.id !== itemId);
    setAllItems(updatedAllItems);
    await saveTodoItems(updatedAllItems);
    loadItems();
  };

  const duplicateTask = async (task: TodoItem) => {
    try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
    const duplicatedTask: TodoItem = { ...task, id: Date.now().toString(), completed: false, text: `${task.text} (Copy)` };
    const updatedAllItems = [duplicatedTask, ...allItems];
    setAllItems(updatedAllItems);
    await saveTodoItems(updatedAllItems);
    loadItems();
  };

  // Selection handlers
  const handleToggleSelection = (taskId: string) => {
    const newSelected = new Set(selectedTaskIds);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTaskIds(newSelected);
  };

  const handleSelectAll = () => {
    const allFilteredIds = filteredItems.map(item => item.id);
    setSelectedTaskIds(new Set(allFilteredIds));
  };

  const handleSelectAction = async (action: SelectAction) => {
    const selectedItems = items.filter(i => selectedTaskIds.has(i.id));
    
    switch (action) {
      case 'selectAll':
        handleSelectAll();
        return;
      case 'move':
        setIsMoveToFolderOpen(true);
        return;
      case 'priority':
        setIsPrioritySheetOpen(true);
        return;
      case 'delete':
        for (const item of selectedItems) {
          await deleteItem(item.id);
        }
        setSelectedTaskIds(new Set());
        setIsSelectionMode(false);
        toast.success(t('todayPage.deletedTasks', { count: selectedItems.length }));
        break;
      case 'complete':
        for (const item of selectedItems) {
          await updateItem(item.id, { completed: true });
        }
        setSelectedTaskIds(new Set());
        setIsSelectionMode(false);
        toast.success(t('todayPage.completedTasks', { count: selectedItems.length }));
        break;
      case 'duplicate':
        for (const item of selectedItems) {
          await duplicateTask(item);
        }
        setSelectedTaskIds(new Set());
        setIsSelectionMode(false);
        toast.success(t('todayPage.duplicatedTasks', { count: selectedItems.length }));
        break;
    }
  };

  const handleMoveToFolder = async (folderId: string | null) => {
    const selectedItems = items.filter(i => selectedTaskIds.has(i.id));
    for (const item of selectedItems) {
      await updateItem(item.id, { folderId: folderId || undefined });
    }
    setSelectedTaskIds(new Set());
    setIsSelectionMode(false);
    setIsMoveToFolderOpen(false);
    toast.success(t('todayPage.movedTasks', { count: selectedItems.length }));
  };

  const handleSetPriority = async (priority: Priority) => {
    const selectedItems = items.filter(i => selectedTaskIds.has(i.id));
    for (const item of selectedItems) {
      await updateItem(item.id, { priority });
    }
    setSelectedTaskIds(new Set());
    setIsSelectionMode(false);
    setIsPrioritySheetOpen(false);
    toast.success(t('todayPage.updatedPriority', { count: selectedItems.length }));
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
    const reorderedItems = Array.from(items);
    const [movedItem] = reorderedItems.splice(result.source.index, 1);
    reorderedItems.splice(result.destination.index, 0, movedItem);
    setItems(reorderedItems);
  };

  const handleClearAllFilters = () => {
    setDateFilter('all');
    setPriorityFilter('all');
    setStatusFilter('all');
    setTagFilter([]);
    setSmartList('all');
    setSelectedFolderId(null);
  };

  const handleImageClick = (imageUrl: string) => {
    window.open(imageUrl, '_blank');
  };

  // Apply filters
  const filteredItems = useMemo(() => {
    let filtered = [...items];
    
    // Smart list filter
    if (smartList !== 'all') {
      const smartFilter = getSmartListFilter(smartList);
      filtered = filtered.filter(smartFilter);
    }
    
    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(item => item.priority === priorityFilter);
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'completed') {
        filtered = filtered.filter(item => item.completed);
      } else {
        filtered = filtered.filter(item => !item.completed);
      }
    }
    
    // Folder filter
    if (selectedFolderId) {
      filtered = filtered.filter(item => item.folderId === selectedFolderId);
    }
    
    // Show/hide completed
    if (!showCompleted) {
      filtered = filtered.filter(item => !item.completed);
    }
    
    return filtered;
  }, [items, smartList, priorityFilter, statusFilter, selectedFolderId, showCompleted]);

  const groupedTasks = useMemo(() => {
    const sorted = [...filteredItems].sort((a, b) => {
      if (!a.dueDate || !b.dueDate) return 0;
      const comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    const groups: { [key: string]: TodoItem[] } = {};
    sorted.forEach((item) => {
      if (!item.dueDate) return;
      const dueDate = new Date(item.dueDate);
      let groupKey: string;
      if (groupBy === 'week') {
        const weekStart = startOfWeek(dueDate, { weekStartsOn: 0 });
        const weekEnd = endOfWeek(dueDate, { weekStartsOn: 0 });
        groupKey = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      } else {
        groupKey = format(dueDate, 'MMMM yyyy');
      }
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(item);
    });
    return groups;
  }, [filteredItems, sortOrder, groupBy]);

  const getPriorityBorderColor = (priority?: Priority) => {
    switch (priority) {
      case 'high': return 'border-red-500';
      case 'medium': return 'border-orange-500';
      case 'low': return 'border-blue-500';
      default: return 'border-muted-foreground/40';
    }
  };

  const activeFiltersCount = [
    priorityFilter !== 'all',
    statusFilter !== 'all',
    smartList !== 'all',
    selectedFolderId !== null,
  ].filter(Boolean).length;

  return (
    <TodoLayout title={t('upcoming.title', 'Upcoming')}>
      <main className="container mx-auto px-4 py-6 pb-32">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SmartListsDropdown
                currentList={smartList}
                onSelectList={(list) => { if (list !== 'all' && !requireFeature('smart_lists')) return; setSmartList(list); }}
                items={items}
              />
              
              {smartList === 'location-reminders' && (
                <Button variant="outline" size="sm" onClick={() => setIsLocationMapOpen(true)}>
                  <MapPin className="h-4 w-4 mr-1" />
                   Map
                </Button>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSelectionMode(!isSelectionMode)}
                className={cn(isSelectionMode && "bg-primary/10")}
              >
                <MousePointer2 className="h-5 w-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCompleted(!showCompleted)}
              >
                {showCompleted ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFilterSheetOpen(true)}
                className="relative"
              >
                <Filter className="h-5 w-5" />
                {activeFiltersCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
              
              <Button variant="ghost" size="icon" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                <ArrowUpDown className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Selection mode bar */}
          {isSelectionMode && (
            <div className="flex items-center justify-between bg-muted rounded-lg p-2">
              <span className="text-sm font-medium">
                {selectedTaskIds.size} {t('upcoming.selected')}
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleSelectAll}>
                  <CheckCheck className="h-4 w-4 mr-1" />
                  {t('upcoming.all')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsSelectActionsOpen(true)} disabled={selectedTaskIds.size === 0}>
                  {t('upcoming.actions')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => {
                  setIsSelectionMode(false);
                  setSelectedTaskIds(new Set());
                }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as 'week' | 'month')}>
            <TabsList className="w-full">
              <TabsTrigger value="week" className="flex-1">{t('upcoming.byWeek')}</TabsTrigger>
              <TabsTrigger value="month" className="flex-1">{t('upcoming.byMonth')}</TabsTrigger>
            </TabsList>
          </Tabs>

          {filteredItems.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground">{t('upcoming.noUpcomingTasks')}</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-320px)]">
              <DragDropContext onDragEnd={handleDragEnd}>
                {Object.entries(groupedTasks).map(([groupName, groupItems]) => (
                  <div key={groupName} className="space-y-2 mb-6">
                    <h3 className="text-sm font-semibold text-muted-foreground px-1 sticky top-0 bg-background py-1">
                      {groupName} ({groupItems.length})
                    </h3>
                    <Droppable droppableId={`group-${groupName}`}>
                      {(provided, snapshot) => (
                        <div
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className={cn("space-y-2 transition-colors rounded-lg", snapshot.isDraggingOver && "bg-muted/20 p-2")}
                        >
                          {groupItems.map((item, index) => (
                            <Draggable key={item.id} draggableId={item.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={cn(
                                    "transition-all",
                                    snapshot.isDragging && "shadow-lg scale-105 rotate-1"
                                  )}
                                >
                                  {isSelectionMode ? (
                                    <div
                                      className={cn(
                                        "bg-card rounded-lg border p-3 cursor-pointer flex items-center gap-3",
                                        selectedTaskIds.has(item.id) && "ring-2 ring-primary"
                                      )}
                                      onClick={() => handleToggleSelection(item.id)}
                                    >
                                      <Checkbox
                                        checked={selectedTaskIds.has(item.id)}
                                        className="h-5 w-5"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <p className={cn("text-base font-medium", item.completed && "line-through text-muted-foreground")}>
                                          {item.text}
                                        </p>
                                        {item.dueDate && (
                                          <p className="text-xs text-muted-foreground">
                                            {format(new Date(item.dueDate), 'MMM d, yyyy')}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <TaskItem
                                      item={item}
                                      onUpdate={updateItem}
                                      onDelete={deleteItem}
                                      onTaskClick={setSelectedTask}
                                      onImageClick={handleImageClick}
                                      allTasks={allItems}
                                    />
                                  )}
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                ))}
              </DragDropContext>
            </ScrollArea>
          )}
        </div>
      </main>

      <Button
        onClick={async () => {
          try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
          setIsInputOpen(true);
        }}
        className="fixed left-4 right-4 z-30 h-12 text-base font-semibold"
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
        size="lg"
      >
        <Plus className="h-5 w-5" />{t('common.addTask')}
      </Button>

      <TaskInputSheet
        isOpen={isInputOpen}
        onClose={() => setIsInputOpen(false)}
        onAddTask={handleAddTask}
        folders={folders}
        selectedFolderId={null}
        onCreateFolder={handleCreateFolder}
      />
      
      <TaskDetailPage
        isOpen={!!selectedTask}
        task={selectedTask}
        folders={folders}
        allTasks={allItems}
        onClose={() => setSelectedTask(null)}
        onUpdate={(updatedTask) => {
          updateItem(updatedTask.id, updatedTask);
          setSelectedTask(updatedTask);
        }}
        onDelete={deleteItem}
        onDuplicate={duplicateTask}
        onConvertToNote={() => {}}
        onMoveToFolder={(taskId, folderId) => updateItem(taskId, { folderId: folderId || undefined })}
      />
      
      <TaskFilterSheet
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        folders={folders}
        selectedFolderId={selectedFolderId}
        onFolderChange={setSelectedFolderId}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        selectedTags={tagFilter}
        onTagsChange={setTagFilter}
        onClearAll={handleClearAllFilters}
      />
      
      <SelectActionsSheet
        isOpen={isSelectActionsOpen}
        onClose={() => setIsSelectActionsOpen(false)}
        selectedCount={selectedTaskIds.size}
        onAction={handleSelectAction}
        totalCount={filteredItems.length}
      />
      
      <MoveToFolderSheet
        isOpen={isMoveToFolderOpen}
        onClose={() => setIsMoveToFolderOpen(false)}
        folders={folders}
        onSelect={handleMoveToFolder}
        currentFolderId={selectedFolderId}
      />
      
      <PrioritySelectSheet
        isOpen={isPrioritySheetOpen}
        onClose={() => setIsPrioritySheetOpen(false)}
        onSelect={handleSetPriority}
      />
      
      <LocationRemindersMap
        open={isLocationMapOpen}
        onOpenChange={setIsLocationMapOpen}
        tasks={items}
      />
      
    </TodoLayout>
  );
};

export default Upcoming;
