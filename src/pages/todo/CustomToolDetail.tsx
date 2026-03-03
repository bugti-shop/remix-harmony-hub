import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Trash2, Calendar, MoreVertical, Target, Zap, Brain, Sparkles, Timer, Focus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TodoItem, Folder } from '@/types/note';
import { useSubscription, FREE_LIMITS } from '@/contexts/SubscriptionContext';
import { loadTasksFromDB, saveTasksToDB, updateTaskInDB, deleteTaskFromDB } from '@/utils/taskStorage';
import { TodoLayout } from './TodoLayout';
import { TaskDateTimePage } from '@/components/TaskDateTimePage';
import { TaskInputSheet } from '@/components/TaskInputSheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CustomTool {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  enabled: boolean;
  linkedTaskIds?: string[];
  linkedCategoryId?: string;
}

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  target: Target,
  zap: Zap,
  brain: Brain,
  sparkles: Sparkles,
  timer: Timer,
  focus: Focus,
};

const CustomToolDetail = () => {
  const { toolId } = useParams<{ toolId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isPro, requireFeature } = useSubscription();
  const [tool, setTool] = useState<CustomTool | null>(null);
  const [linkedTasks, setLinkedTasks] = useState<TodoItem[]>([]);
  const [allTasks, setAllTasks] = useState<TodoItem[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [taskToReschedule, setTaskToReschedule] = useState<TodoItem | null>(null);
  const [showTaskInput, setShowTaskInput] = useState(false);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [quickTaskText, setQuickTaskText] = useState('');

  useEffect(() => {
    const loadData = async () => {
      const { getSetting } = await import('@/utils/settingsStorage');
      
      // Load custom tool
      const savedTools = await getSetting<CustomTool[]>('customProductivityTools', []);
      if (savedTools.length > 0 && toolId) {
        const foundTool = savedTools.find(t => t.id === toolId);
        setTool(foundTool || null);
      }

      // Load all tasks from IndexedDB
      const tasks = await loadTasksFromDB();
      setAllTasks(tasks);

      // Load folders
      const savedFolders = await getSetting<Folder[]>('todoFolders', []);
      setFolders(savedFolders);
    };
    loadData();
  }, [toolId]);

  useEffect(() => {
    if (tool && allTasks.length > 0) {
      // Filter tasks linked to this tool
      const linked = allTasks.filter(task => 
        tool.linkedTaskIds?.includes(task.id) || 
        (tool.linkedCategoryId && task.categoryId === tool.linkedCategoryId)
      );
      setLinkedTasks(linked);
    }
  }, [tool, allTasks]);

  const handleCompleteTask = async (taskId: string) => {
    const task = allTasks.find(t => t.id === taskId);
    const newCompleted = !task?.completed;
    
    const updatedTasks = allTasks.map(task => 
      task.id === taskId ? { ...task, completed: newCompleted } : task
    );
    setAllTasks(updatedTasks);
    await updateTaskInDB(taskId, { completed: newCompleted });
    window.dispatchEvent(new Event('tasksUpdated'));
    
    toast.success(newCompleted ? t('customTool.taskCompleted') : t('customTool.taskUncompleted'));
  };

  const handleDeleteTask = (taskId: string) => {
    setTaskToDelete(taskId);
    setShowDeleteDialog(true);
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;
    
    const updatedTasks = allTasks.filter(task => task.id !== taskToDelete);
    setAllTasks(updatedTasks);
    await deleteTaskFromDB(taskToDelete);
    window.dispatchEvent(new Event('tasksUpdated'));
    
    // Also remove from tool's linked tasks
    if (tool) {
      const { getSetting, setSetting } = await import('@/utils/settingsStorage');
      const savedTools = await getSetting<CustomTool[]>('customProductivityTools', []);
      const updatedTool = savedTools.map((t: CustomTool) => {
        if (t.id === tool.id) {
          return {
            ...t,
            linkedTaskIds: t.linkedTaskIds?.filter(id => id !== taskToDelete)
          };
        }
        return t;
      });
      await setSetting('customProductivityTools', updatedTool);
    }
    
    setShowDeleteDialog(false);
    setTaskToDelete(null);
    toast.success(t('customTool.taskDeleted'));
  };

  const handleRescheduleTask = (task: TodoItem) => {
    setTaskToReschedule(task);
    setShowDatePicker(true);
  };

  const handleSaveReschedule = async (updatedTask: Partial<TodoItem>) => {
    if (!taskToReschedule) return;
    
    const updatedTasks = allTasks.map(task => 
      task.id === taskToReschedule.id ? { ...task, ...updatedTask } : task
    );
    setAllTasks(updatedTasks);
    await updateTaskInDB(taskToReschedule.id, updatedTask);
    window.dispatchEvent(new Event('tasksUpdated'));
    
    setShowDatePicker(false);
    setTaskToReschedule(null);
    toast.success(t('customTool.taskRescheduled'));
  };

  const handleUnlinkTask = async (taskId: string) => {
    if (!tool) return;
    
    const { getSetting, setSetting } = await import('@/utils/settingsStorage');
    const savedTools = await getSetting<CustomTool[]>('customProductivityTools', []);
    const updated = savedTools.map((t: CustomTool) => {
      if (t.id === tool.id) {
        return {
          ...t,
          linkedTaskIds: t.linkedTaskIds?.filter(id => id !== taskId)
        };
      }
      return t;
    });
    await setSetting('customProductivityTools', updated);
    
    // Update local state
    setTool(prev => prev ? {
      ...prev,
      linkedTaskIds: prev.linkedTaskIds?.filter(id => id !== taskId)
    } : null);
    
    toast.success(t('customTool.taskUnlinked'));
  };

  const handleAddTask = async (taskData: Omit<TodoItem, 'id' | 'completed'>) => {
    if (!tool) return;
    
    const newTask: TodoItem = {
      ...taskData,
      id: Date.now().toString(),
      completed: false,
    };
    
    // Add to all tasks
    const updatedTasks = [...allTasks, newTask];
    setAllTasks(updatedTasks);
    await saveTasksToDB(updatedTasks);
    window.dispatchEvent(new Event('tasksUpdated'));
    
    // Link task to this tool
    const { getSetting, setSetting } = await import('@/utils/settingsStorage');
    const savedTools = await getSetting<CustomTool[]>('customProductivityTools', []);
    const updated = savedTools.map((t: CustomTool) => {
      if (t.id === tool.id) {
        return {
          ...t,
          linkedTaskIds: [...(t.linkedTaskIds || []), newTask.id]
        };
      }
      return t;
    });
    await setSetting('customProductivityTools', updated);
    
    // Update local tool state
    setTool(prev => prev ? {
      ...prev,
      linkedTaskIds: [...(prev.linkedTaskIds || []), newTask.id]
    } : null);
    
    // Keep sheet open so users can add more tasks
    toast.success(t('customTool.taskAddedLinked'));
  };

  const handleQuickAddTask = async () => {
    if (!quickTaskText.trim() || !tool) return;
    
    const newTask: TodoItem = {
      id: Date.now().toString(),
      text: quickTaskText.trim(),
      completed: false,
    };
    
    // Add to all tasks
    const updatedTasks = [...allTasks, newTask];
    setAllTasks(updatedTasks);
    await saveTasksToDB(updatedTasks);
    window.dispatchEvent(new Event('tasksUpdated'));
    
    // Link task to this tool
    const { getSetting, setSetting } = await import('@/utils/settingsStorage');
    const savedTools = await getSetting<CustomTool[]>('customProductivityTools', []);
    const updated = savedTools.map((t: CustomTool) => {
      if (t.id === tool.id) {
        return {
          ...t,
          linkedTaskIds: [...(t.linkedTaskIds || []), newTask.id]
        };
      }
      return t;
    });
    await setSetting('customProductivityTools', updated);
    
    // Update local tool state
    setTool(prev => prev ? {
      ...prev,
      linkedTaskIds: [...(prev.linkedTaskIds || []), newTask.id]
    } : null);
    
    setQuickTaskText('');
    toast.success(t('customTool.taskAdded'));
  };

  const handleCreateFolder = async (name: string, color: string) => {
    if (!isPro && folders.length >= FREE_LIMITS.maxTaskFolders) {
      requireFeature('extra_folders');
      return;
    }
    const { setSetting } = await import('@/utils/settingsStorage');
    const newFolder: Folder = {
      id: Date.now().toString(),
      name,
      color,
      isDefault: false,
      createdAt: new Date(),
    };
    const updatedFolders = [...folders, newFolder];
    setFolders(updatedFolders);
    await setSetting('todoFolders', updatedFolders);
  };

  const IconComponent = tool ? TOOL_ICONS[tool.icon] || Target : Target;

  if (!tool) {
    return (
      <TodoLayout title={t('customTool.toolNotFound')}>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <p className="text-muted-foreground">{t('customTool.toolNotFoundDesc')}</p>
          <Button onClick={() => navigate('/todo/settings')}>{t('customTool.backToSettings')}</Button>
        </div>
      </TodoLayout>
    );
  }

  const completedTasks = linkedTasks.filter(t => t.completed);
  const pendingTasks = linkedTasks.filter(t => !t.completed);

  return (
    <TodoLayout title={tool.name}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/todo/settings')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3 flex-1">
              <div 
                className="p-2 rounded-lg" 
                style={{ backgroundColor: `${tool.color}20` }}
              >
                <IconComponent className="h-6 w-6" style={{ color: tool.color }} />
              </div>
              <div>
                <h1 className="font-semibold text-lg">{tool.name}</h1>
                <p className="text-sm text-muted-foreground">{tool.description}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="p-4 grid grid-cols-3 gap-3">
          <div className="bg-card border rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{linkedTasks.length}</p>
             <p className="text-xs text-muted-foreground">{t('customTool.totalTasks')}</p>
           </div>
           <div className="bg-card border rounded-lg p-3 text-center">
             <p className="text-2xl font-bold text-green-500">{completedTasks.length}</p>
             <p className="text-xs text-muted-foreground">{t('customTool.completed')}</p>
           </div>
           <div className="bg-card border rounded-lg p-3 text-center">
             <p className="text-2xl font-bold text-orange-500">{pendingTasks.length}</p>
             <p className="text-xs text-muted-foreground">{t('customTool.pending')}</p>
          </div>
        </div>

        {/* Quick Add Task */}
        <div className="px-4 pb-4">
          <div className="flex gap-2">
            <Input
              placeholder={t('customTool.quickAddTask')}
              value={quickTaskText}
              onChange={(e) => setQuickTaskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleQuickAddTask();
                }
              }}
              className="flex-1"
            />
            <Button 
              size="icon" 
              onClick={handleQuickAddTask}
              disabled={!quickTaskText.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowTaskInput(true)}
            >
              {t('customTool.moreOptions')}
            </Button>
          </div>
        </div>

        {/* Tasks List */}
        <ScrollArea className="flex-1 px-4 pb-24">
          {linkedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <IconComponent className="h-12 w-12 text-muted-foreground/30 mb-4" />
               <p className="text-muted-foreground">{t('customTool.noTasksLinked')}</p>
               <p className="text-sm text-muted-foreground/70 mt-1">
                 {t('customTool.addTaskHint')}
               </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pending Tasks */}
              {pendingTasks.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">{t('customTool.pendingCount', { count: pendingTasks.length })}</h3>
                  <div className="space-y-2">
                    {pendingTasks.map(task => (
                      <div 
                        key={task.id}
                        className="bg-card border rounded-lg p-3 flex items-start gap-3"
                      >
                        <Checkbox
                          checked={task.completed}
                          onCheckedChange={() => handleCompleteTask(task.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{task.text}</p>
                          {task.dueDate && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Due: {new Date(task.dueDate).toLocaleDateString()}
                            </p>
                          )}
                          {task.tagIds && task.tagIds.length > 0 && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {task.tagIds.slice(0, 3).map((tagId, idx) => (
                                <span 
                                  key={idx}
                                  className="text-xs px-2 py-0.5 rounded-full text-white"
                                  style={{ backgroundColor: `hsl(var(--primary))` }}
                                >
                                  {tagId}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                             <DropdownMenuItem onClick={() => handleCompleteTask(task.id)}>
                               <Check className="h-4 w-4 mr-2" />
                               {t('customTool.markComplete')}
                             </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => handleRescheduleTask(task)}>
                               <Calendar className="h-4 w-4 mr-2" />
                               {t('customTool.reschedule')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleUnlinkTask(task.id)}>
                               {t('customTool.unlinkFromTool')}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-destructive"
                            >
                               <Trash2 className="h-4 w-4 mr-2" />
                               {t('customTool.deleteTask')}
                             </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Tasks */}
              {completedTasks.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">{t('customTool.completedCount', { count: completedTasks.length })}</h3>
                  <div className="space-y-2">
                    {completedTasks.map(task => (
                      <div 
                        key={task.id}
                        className="bg-muted/30 border rounded-lg p-3 flex items-start gap-3 opacity-60"
                      >
                        <Checkbox
                          checked={task.completed}
                          onCheckedChange={() => handleCompleteTask(task.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate line-through text-muted-foreground">{task.text}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                             <DropdownMenuItem onClick={() => handleCompleteTask(task.id)}>
                               {t('customTool.undoComplete')}
                             </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => handleUnlinkTask(task.id)}>
                               {t('customTool.unlinkFromTool')}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-destructive"
                            >
                               <Trash2 className="h-4 w-4 mr-2" />
                               {t('customTool.deleteTask')}
                             </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Delete Confirmation */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
             <AlertDialogTitle>{t('customTool.deleteTaskTitle')}</AlertDialogTitle>
             <AlertDialogDescription>
               {t('customTool.deleteTaskDesc')}
             </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
               <AlertDialogAction onClick={confirmDeleteTask} className="bg-destructive hover:bg-destructive/90">
                 {t('common.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Reschedule Date Picker */}
        {showDatePicker && taskToReschedule && (
          <TaskDateTimePage
            isOpen={showDatePicker}
            onClose={() => {
              setShowDatePicker(false);
              setTaskToReschedule(null);
            }}
            initialDate={taskToReschedule.dueDate}
            onSave={(data) => {
              handleSaveReschedule({
                dueDate: data.selectedDate,
                reminderTime: data.selectedTime 
                  ? new Date(new Date().setHours(
                      data.selectedTime.period === 'PM' && data.selectedTime.hour !== 12 
                        ? data.selectedTime.hour + 12 
                        : data.selectedTime.period === 'AM' && data.selectedTime.hour === 12 
                          ? 0 
                          : data.selectedTime.hour,
                      data.selectedTime.minute
                    ))
                  : undefined,
              });
            }}
            hideRepeat={false}
          />
        )}

        {/* Task Input Sheet */}
        <TaskInputSheet
          isOpen={showTaskInput}
          onClose={() => setShowTaskInput(false)}
          onAddTask={handleAddTask}
          folders={folders}
          selectedFolderId={null}
          onCreateFolder={handleCreateFolder}
        />
      </div>
    </TodoLayout>
  );
};

export default CustomToolDetail;
