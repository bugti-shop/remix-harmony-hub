import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TodoItem } from '@/types/note';
import { TodoLayout } from './TodoLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { 
  History, CheckCircle2, Repeat, Calendar as CalendarIcon, Clock, ArrowUpDown,
  Archive, ArchiveRestore, Trash2, MoreHorizontal, Search, X, CalendarRange
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { loadTodoItems, saveTodoItems } from '@/utils/todoItemsStorage';
import { loadArchivedTasks, unarchiveTasks, deleteArchivedTasks, clearAllArchivedTasks } from '@/utils/taskCleanup';
import { getRepeatLabel } from '@/utils/recurringTasks';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { toast } from 'sonner';
import { 
  format, isToday, isYesterday, isThisWeek, isThisMonth, 
  isWithinInterval, startOfDay, endOfDay
} from 'date-fns';

type ViewType = 'completed' | 'archived';
type FilterType = 'all' | 'recurring' | 'today' | 'week' | 'month' | 'dateRange';
type SortType = 'newest' | 'oldest' | 'name';

const TaskHistory = () => {
  const { t } = useTranslation();
  const [activeItems, setActiveItems] = useState<TodoItem[]>([]);
  const [archivedItems, setArchivedItems] = useState<TodoItem[]>([]);
  const [view, setView] = useState<ViewType>('completed');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('newest');
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);

  const loadData = useCallback(async () => {
    const [active, archived] = await Promise.all([loadTodoItems(), loadArchivedTasks()]);
    setActiveItems(active);
    setArchivedItems(archived);
  }, []);

  useEffect(() => {
    loadData();
    const handler = () => loadData();
    window.addEventListener('tasksUpdated', handler);
    return () => window.removeEventListener('tasksUpdated', handler);
  }, [loadData]);

  const sourceItems = view === 'completed'
    ? activeItems.filter(t => t.completed)
    : archivedItems;

  const filteredTasks = useMemo(() => {
    let filtered = [...sourceItems];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.text.toLowerCase().includes(q) || 
        t.description?.toLowerCase().includes(q) ||
        t.tags?.some(tag => tag.toLowerCase().includes(q))
      );
    }

    switch (filter) {
      case 'recurring':
        filtered = filtered.filter(t => t.repeatType && t.repeatType !== 'none');
        break;
      case 'today':
        filtered = filtered.filter(t => t.dueDate && isToday(new Date(t.dueDate)));
        break;
      case 'week':
        filtered = filtered.filter(t => t.dueDate && isThisWeek(new Date(t.dueDate)));
        break;
      case 'month':
        filtered = filtered.filter(t => t.dueDate && isThisMonth(new Date(t.dueDate)));
        break;
      case 'dateRange':
        if (dateFrom || dateTo) {
          filtered = filtered.filter(t => {
            const taskDate = t.completedAt ? new Date(t.completedAt) 
              : t.dueDate ? new Date(t.dueDate) 
              : new Date(parseInt(t.id) || Date.now());
            if (dateFrom && dateTo) {
              return isWithinInterval(taskDate, { start: startOfDay(dateFrom), end: endOfDay(dateTo) });
            }
            if (dateFrom) return taskDate >= startOfDay(dateFrom);
            if (dateTo) return taskDate <= endOfDay(dateTo);
            return true;
          });
        }
        break;
    }

    filtered.sort((a, b) => {
      const getTime = (t: TodoItem) => {
        if (t.completedAt) return new Date(t.completedAt).getTime();
        if (t.dueDate) return new Date(t.dueDate).getTime();
        return parseInt(t.id) || 0;
      };
      switch (sortBy) {
        case 'newest': return getTime(b) - getTime(a);
        case 'oldest': return getTime(a) - getTime(b);
        case 'name': return a.text.localeCompare(b.text);
        default: return 0;
      }
    });

    return filtered;
  }, [sourceItems, filter, sortBy, searchQuery, dateFrom, dateTo]);

  const groupedTasks = useMemo(() => {
    const groups: Record<string, TodoItem[]> = {};
    filteredTasks.forEach(task => {
      const date = task.completedAt ? new Date(task.completedAt) 
        : task.dueDate ? new Date(task.dueDate) 
        : new Date(parseInt(task.id) || Date.now());
      let key: string;
      if (isToday(date)) key = t('common.today');
      else if (isYesterday(date)) key = t('common.yesterday');
      else if (isThisWeek(date)) key = t('todayPage.thisWeek');
      else if (isThisMonth(date)) key = t('taskHistory.month');
      else key = format(date, 'MMMM yyyy');
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    });
    return groups;
  }, [filteredTasks]);

  const handleUnarchive = async (taskId: string) => {
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    const restored = await unarchiveTasks([taskId]);
    if (restored.length > 0) {
      const current = await loadTodoItems();
      await saveTodoItems([...restored, ...current]);
      window.dispatchEvent(new CustomEvent('tasksUpdated'));
      toast.success(t('taskHistory.taskRestored'), { icon: '↩️' });
    }
    await loadData();
  };

  const handleDeleteArchived = async (taskId: string) => {
    await deleteArchivedTasks([taskId]);
    toast.success(t('taskHistory.permanentlyDeleted'));
    await loadData();
  };

  const handleClearAll = async () => {
    const count = await clearAllArchivedTasks();
    toast.success(t('taskHistory.clearedArchived', { count }));
    setConfirmClearAll(false);
    await loadData();
  };

  const formatTaskDate = (task: TodoItem): string => {
    const date = task.completedAt ? new Date(task.completedAt)
      : task.dueDate ? new Date(task.dueDate) 
      : new Date(parseInt(task.id) || Date.now());
    if (isToday(date)) return format(date, 'h:mm a');
    if (isYesterday(date)) return 'Yesterday ' + format(date, 'h:mm a');
    return format(date, 'MMM d, h:mm a');
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'text-destructive bg-destructive/10';
      case 'medium': return 'text-warning bg-warning/10';
      case 'low': return 'text-success bg-success/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  return (
    <TodoLayout title={t('common.taskHistory')}>
      <main className="container mx-auto px-4 py-6 pb-32">
        <div className="max-w-lg mx-auto space-y-4">
          {/* View Toggle */}
          <Tabs value={view} onValueChange={(v) => setView(v as ViewType)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="completed" className="text-xs flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t('taskHistory.completed')} ({activeItems.filter(t => t.completed).length})
              </TabsTrigger>
              <TabsTrigger value="archived" className="text-xs flex items-center gap-1.5">
                <Archive className="h-3.5 w-3.5" />
                {t('taskHistory.archived')} ({archivedItems.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('taskHistory.searchTasks')}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2">
            <Tabs value={filter} onValueChange={(v) => { setFilter(v as FilterType); if (v === 'dateRange') setShowDatePicker(true); }} className="flex-1">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="all" className="text-[10px]">{t('taskHistory.all')}</TabsTrigger>
                <TabsTrigger value="recurring" className="text-[10px]">{t('taskHistory.repeat')}</TabsTrigger>
                <TabsTrigger value="today" className="text-[10px]">{t('taskHistory.today')}</TabsTrigger>
                <TabsTrigger value="week" className="text-[10px]">{t('taskHistory.week')}</TabsTrigger>
                <TabsTrigger value="month" className="text-[10px]">{t('taskHistory.month')}</TabsTrigger>
                <TabsTrigger value="dateRange" className="text-[10px]">
                  <CalendarRange className="h-3 w-3 mr-0.5" />
                  {t('taskHistory.range')}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Date Range Picker */}
          {filter === 'dateRange' && (
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("flex-1 text-xs justify-start", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                    {dateFrom ? format(dateFrom, 'MMM d, yyyy') : t('taskHistory.fromDate')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground text-xs">→</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("flex-1 text-xs justify-start", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                    {dateTo ? format(dateTo, 'MMM d, yyyy') : t('taskHistory.toDate')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="px-2" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}

          {/* Sort & Count */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {view === 'archived' ? (
                <Archive className="h-4 w-4 text-primary" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-success" />
              )}
              <span>{filteredTasks.length} {t('taskHistory.tasks', { count: filteredTasks.length }).split(' ').slice(1).join(' ')}</span>
            </div>
            <div className="flex items-center gap-1">
              {view === 'archived' && archivedItems.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setConfirmClearAll(true)} className="text-destructive text-xs">
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                   {t('taskHistory.clearAll')}
                </Button>
              )}
              <Button 
                variant="ghost" size="sm"
                onClick={() => setSortBy(prev => prev === 'newest' ? 'oldest' : prev === 'oldest' ? 'name' : 'newest')}
              >
                <ArrowUpDown className="h-4 w-4 mr-1" />
                {sortBy === 'newest' ? t('taskHistory.newest') : sortBy === 'oldest' ? t('taskHistory.oldest') : t('taskHistory.alphabetical')}
              </Button>
            </div>
          </div>

          {/* Task List */}
          <ScrollArea className="h-[calc(100vh-380px)]">
            <div className="space-y-6">
              {Object.entries(groupedTasks).map(([groupName, tasks]) => (
                <div key={groupName}>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {groupName}
                    <Badge variant="secondary" className="ml-auto">{tasks.length}</Badge>
                  </h3>
                  <div className="space-y-2">
                    {tasks.map(task => (
                      <Card key={task.id} className="overflow-hidden">
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            {view === 'archived' ? (
                              <Archive className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                            ) : (
                              <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={cn("font-medium", view === 'completed' && "line-through text-muted-foreground")}>{task.text}</p>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatTaskDate(task)}
                                </span>
                                {task.priority && task.priority !== 'none' && (
                                  <Badge className={cn("text-[10px] px-1.5", getPriorityColor(task.priority))}>
                                    {task.priority}
                                  </Badge>
                                )}
                                {task.repeatType && task.repeatType !== 'none' && (
                                  <Badge variant="outline" className="text-[10px] px-1.5">
                                    <Repeat className="h-2.5 w-2.5 mr-1" />
                                    {getRepeatLabel(task.repeatType, task.repeatDays, task.advancedRepeat)}
                                  </Badge>
                                )}
                              </div>
                              {task.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{task.description}</p>
                              )}
                            </div>
                            {view === 'archived' && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleUnarchive(task.id)}>
                                    <ArchiveRestore className="h-4 w-4 mr-2" />
                                    {t('taskHistory.restoreTask')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDeleteArchived(task.id)} className="text-destructive">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    {t('taskHistory.deletePermanently')}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}

              {filteredTasks.length === 0 && (
                <div className="text-center py-12">
                  {view === 'archived' ? (
                    <>
                       <Archive className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                       <h3 className="font-medium text-lg mb-1">{t('taskHistory.noArchivedTasks')}</h3>
                       <p className="text-sm text-muted-foreground">
                         {t('taskHistory.archivedAutoInfo')}
                      </p>
                    </>
                  ) : (
                    <>
                      <History className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                       <h3 className="font-medium text-lg mb-1">{t('taskHistory.noCompletedTasks')}</h3>
                       <p className="text-sm text-muted-foreground">{t('taskHistory.completeTasksInfo')}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </main>

      {/* Confirm Clear All */}
      <AlertDialog open={confirmClearAll} onOpenChange={setConfirmClearAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
             <AlertDialogTitle>{t('taskHistory.clearAllArchived')}</AlertDialogTitle>
             <AlertDialogDescription>
               {t('taskHistory.clearAllArchivedDesc', { count: archivedItems.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
             <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground">
               {t('taskHistory.deleteAll')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TodoLayout>
  );
};

export default TaskHistory;
