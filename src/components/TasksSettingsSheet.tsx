import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ChevronRight, ChevronLeft, ListTodo, Settings2, Bell, Trash2, Flag, Plus, Pencil, X, Check } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import { toast } from 'sonner';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { CustomPriority, getPriorities, savePriorities, DEFAULT_PRIORITIES } from '@/utils/priorityStorage';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface TasksSettings {
  defaultPriority: string; // Changed to string to support custom priorities
  defaultDueDate: 'none' | 'today' | 'tomorrow';
  showCompletedTasks: boolean;
  autoArchiveCompleted: boolean;
  archiveAfterDays: number;
  confirmBeforeDelete: boolean;
  swipeToComplete: boolean;
  // Display settings
  showDateTime: boolean;
  showStatus: boolean;
  showSubtasks: boolean;
  // Reminder defaults
  defaultReminderTime: string;
  reminderSound: boolean;
  reminderVibration: boolean;
}

const DEFAULT_TASKS_SETTINGS: TasksSettings = {
  defaultPriority: 'none',
  defaultDueDate: 'none',
  showCompletedTasks: true,
  autoArchiveCompleted: false,
  archiveAfterDays: 7,
  confirmBeforeDelete: true,
  swipeToComplete: true,
  showDateTime: false,
  showStatus: false,
  showSubtasks: false,
  defaultReminderTime: '09:00',
  reminderSound: true,
  reminderVibration: true,
};

// Preset colors for priority selection
const PRIORITY_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
  '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
  '#EC4899', '#F43F5E', '#78716C', '#6B7280', '#64748B'
];

type SubPage = 'main' | 'defaults' | 'display' | 'behavior' | 'reminders' | 'priorities';

interface TasksSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TasksSettingsSheet = ({ isOpen, onClose }: TasksSettingsSheetProps) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<TasksSettings>(DEFAULT_TASKS_SETTINGS);
  const [currentPage, setCurrentPage] = useState<SubPage>('main');
  const [isLoading, setIsLoading] = useState(true);
  
  // Priority customization state
  const [priorities, setPriorities] = useState<CustomPriority[]>(DEFAULT_PRIORITIES);
  const [editingPriority, setEditingPriority] = useState<CustomPriority | null>(null);
  const [newPriorityName, setNewPriorityName] = useState('');
  const [newPriorityColor, setNewPriorityColor] = useState('#3B82F6');
  const [isAddingPriority, setIsAddingPriority] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useHardwareBackButton({
    onBack: () => {
      if (currentPage !== 'main') {
        setCurrentPage('main');
      } else {
        onClose();
      }
    },
    enabled: isOpen,
    priority: 'sheet',
  });

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  // Reset to main page when sheet closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentPage('main');
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const saved = await getSetting<TasksSettings | null>('tasksSettings', null);
      if (saved) {
        setSettings({ ...DEFAULT_TASKS_SETTINGS, ...saved });
      }
      // Load priorities
      const loadedPriorities = await getPriorities();
      setPriorities(loadedPriorities);
    } catch (error) {
      console.error('Error loading tasks settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: TasksSettings) => {
    setSettings(newSettings);
    await setSetting('tasksSettings', newSettings);
    // Dispatch event to notify all task components
    window.dispatchEvent(new CustomEvent('tasksSettingsChanged', { detail: newSettings }));
  };

  const updateSetting = async <K extends keyof TasksSettings>(key: K, value: TasksSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    await saveSettings(newSettings);
    toast.success(t('settings.settingsSaved', 'Settings saved'));
  };

  const SettingsRow = ({ 
    label, 
    subtitle,
    onClick, 
    rightElement,
    icon: Icon,
  }: { 
    label: string; 
    subtitle?: string;
    onClick?: () => void; 
    rightElement?: React.ReactNode;
    icon?: React.ComponentType<{ className?: string }>;
  }) => (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "w-full flex items-center justify-between px-4 py-3 border-b border-border/50",
        onClick && "hover:bg-muted/50 transition-colors"
      )}
    >
      <div className="flex items-center gap-3">
        {Icon && <Icon className="h-5 w-5 text-primary" />}
        <div className="flex flex-col items-start">
          <span className="text-foreground text-sm">{label}</span>
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </div>
      </div>
      {rightElement || (onClick && <ChevronRight className="h-4 w-4 text-muted-foreground" />)}
    </button>
  );

  const SectionHeading = ({ title }: { title: string }) => (
    <div className="px-4 py-2 bg-muted/50">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</span>
    </div>
  );

  const BackButton = ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick} className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors">
      <ChevronLeft className="h-5 w-5" />
    </button>
  );

  // Main page
  const renderMainPage = () => (
    <>
      <SheetHeader className="px-4 py-3 border-b">
        <SheetTitle className="text-lg">{t('settings.tasksSettings', 'Tasks Settings')}</SheetTitle>
      </SheetHeader>
      <ScrollArea className="flex-1">
        <div className="py-2">
          <SettingsRow 
            icon={ListTodo}
            label={t('settings.defaultSettings', 'Default Settings')}
            subtitle={t('settings.defaultSettingsDesc', 'Priority, due date defaults')}
            onClick={() => setCurrentPage('defaults')}
          />
          <SettingsRow 
            icon={Settings2}
            label={t('settings.displaySettings', 'Display Settings')}
            subtitle={t('settings.displaySettingsDesc', 'What to show on task cards')}
            onClick={() => setCurrentPage('display')}
          />
          <SettingsRow 
            icon={Bell}
            label={t('settings.reminderSettings', 'Reminder Settings')}
            subtitle={t('settings.reminderSettingsDesc', 'Default reminder options')}
            onClick={() => setCurrentPage('reminders')}
          />
          <SettingsRow 
            icon={Trash2}
            label={t('settings.behaviorSettings', 'Behavior & Actions')}
            subtitle={t('settings.behaviorSettingsDesc', 'Swipe actions, confirmations')}
            onClick={() => setCurrentPage('behavior')}
          />
          <SettingsRow 
            icon={Flag}
            label={t('settings.prioritySettings', 'Priority Settings')}
            subtitle={t('settings.prioritySettingsDesc', 'Customize priority colors')}
            onClick={() => setCurrentPage('priorities')}
          />
        </div>
      </ScrollArea>
    </>
  );

  // Default Settings page
  const renderDefaultsPage = () => (
    <>
      <SheetHeader className="px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <BackButton onClick={() => setCurrentPage('main')} />
          <SheetTitle className="text-lg">{t('settings.defaultSettings', 'Default Settings')}</SheetTitle>
        </div>
      </SheetHeader>
      <ScrollArea className="flex-1">
        <div className="py-2">
          <SectionHeading title={t('settings.newTaskDefaults', 'New Task Defaults')} />
          
          <div className="px-4 py-3 border-b border-border/50">
            <label className="text-sm text-muted-foreground mb-2 block">
              {t('settings.defaultPriority', 'Default Priority')}
            </label>
            <Select 
              value={settings.defaultPriority} 
              onValueChange={(v) => updateSetting('defaultPriority', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: priorities.find(p => p.id === settings.defaultPriority)?.color || '#6B7280' }}
                    />
                    {priorities.find(p => p.id === settings.defaultPriority)?.name || 'None'}
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {priorities.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      {p.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="px-4 py-3">
            <label className="text-sm text-muted-foreground mb-2 block">
              {t('settings.defaultDueDate', 'Default Due Date')}
            </label>
            <Select 
              value={settings.defaultDueDate} 
              onValueChange={(v: TasksSettings['defaultDueDate']) => updateSetting('defaultDueDate', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('dueDate.none', 'None')}</SelectItem>
                <SelectItem value="today">{t('dueDate.today', 'Today')}</SelectItem>
                <SelectItem value="tomorrow">{t('dueDate.tomorrow', 'Tomorrow')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </ScrollArea>
    </>
  );

  // Display Settings page
  const renderDisplayPage = () => (
    <>
      <SheetHeader className="px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <BackButton onClick={() => setCurrentPage('main')} />
          <SheetTitle className="text-lg">{t('settings.displaySettings', 'Display Settings')}</SheetTitle>
        </div>
      </SheetHeader>
      <ScrollArea className="flex-1">
        <div className="py-2">
          <SectionHeading title={t('settings.taskCardDisplay', 'Task Card Display')} />

          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex-1 pr-4">
              <span className="text-foreground text-sm block">
                {t('settings.showDateTime', 'Show Date & Time')}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('settings.showDateTimeDesc', 'Display due date and reminder time on task cards')}
              </span>
            </div>
            <Switch
              checked={settings.showDateTime}
              onCheckedChange={(checked) => updateSetting('showDateTime', checked)}
            />
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex-1 pr-4">
              <span className="text-foreground text-sm block">
                {t('settings.showStatus', 'Show Status Badge')}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('settings.showStatusDesc', 'Display task status (In Progress, Almost Done, etc.)')}
              </span>
            </div>
            <Switch
              checked={settings.showStatus}
              onCheckedChange={(checked) => updateSetting('showStatus', checked)}
            />
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex-1 pr-4">
              <span className="text-foreground text-sm block">
                {t('settings.showSubtasks', 'Show Subtasks Count')}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('settings.showSubtasksDesc', 'Display number of subtasks on task cards')}
              </span>
            </div>
            <Switch
              checked={settings.showSubtasks}
              onCheckedChange={(checked) => updateSetting('showSubtasks', checked)}
            />
          </div>

          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex-1 pr-4">
              <span className="text-foreground text-sm block">
                {t('settings.showCompletedTasks', 'Show Completed Tasks')}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('settings.showCompletedTasksDesc', 'Display completed tasks in the list')}
              </span>
            </div>
            <Switch
              checked={settings.showCompletedTasks}
              onCheckedChange={(checked) => updateSetting('showCompletedTasks', checked)}
            />
          </div>
        </div>
      </ScrollArea>
    </>
  );

  // Reminder Settings page
  const renderRemindersPage = () => (
    <>
      <SheetHeader className="px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <BackButton onClick={() => setCurrentPage('main')} />
          <SheetTitle className="text-lg">{t('settings.reminderSettings', 'Reminder Settings')}</SheetTitle>
        </div>
      </SheetHeader>
      <ScrollArea className="flex-1">
        <div className="py-2">
          <SectionHeading title={t('settings.reminderDefaults', 'Reminder Defaults')} />

          <div className="px-4 py-3 border-b border-border/50">
            <label className="text-sm text-muted-foreground mb-2 block">
              {t('settings.defaultReminderTime', 'Default Reminder Time')}
            </label>
            <input
              type="time"
              value={settings.defaultReminderTime}
              onChange={(e) => updateSetting('defaultReminderTime', e.target.value)}
              className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm"
            />
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex-1 pr-4">
              <span className="text-foreground text-sm block">
                {t('settings.reminderSound', 'Reminder Sound')}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('settings.reminderSoundDesc', 'Play sound when reminder triggers')}
              </span>
            </div>
            <Switch
              checked={settings.reminderSound}
              onCheckedChange={(checked) => updateSetting('reminderSound', checked)}
            />
          </div>

          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex-1 pr-4">
              <span className="text-foreground text-sm block">
                {t('settings.reminderVibration', 'Reminder Vibration')}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('settings.reminderVibrationDesc', 'Vibrate device when reminder triggers')}
              </span>
            </div>
            <Switch
              checked={settings.reminderVibration}
              onCheckedChange={(checked) => updateSetting('reminderVibration', checked)}
            />
          </div>
        </div>
      </ScrollArea>
    </>
  );

  // Behavior Settings page
  const renderBehaviorPage = () => (
    <>
      <SheetHeader className="px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <BackButton onClick={() => setCurrentPage('main')} />
          <SheetTitle className="text-lg">{t('settings.behaviorSettings', 'Behavior & Actions')}</SheetTitle>
        </div>
      </SheetHeader>
      <ScrollArea className="flex-1">
        <div className="py-2">
          <SectionHeading title={t('settings.swipeActions', 'Swipe Actions')} />

          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex-1 pr-4">
              <span className="text-foreground text-sm block">
                {t('settings.swipeToComplete', 'Swipe to Complete')}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('settings.swipeToCompleteDesc', 'Swipe right on a task to mark it complete')}
              </span>
            </div>
            <Switch
              checked={settings.swipeToComplete}
              onCheckedChange={(checked) => updateSetting('swipeToComplete', checked)}
            />
          </div>

          <SectionHeading title={t('settings.confirmations', 'Confirmations')} />

          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex-1 pr-4">
              <span className="text-foreground text-sm block">
                {t('settings.confirmBeforeDelete', 'Confirm Before Delete')}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('settings.confirmBeforeDeleteDesc', 'Show confirmation dialog before deleting tasks')}
              </span>
            </div>
            <Switch
              checked={settings.confirmBeforeDelete}
              onCheckedChange={(checked) => updateSetting('confirmBeforeDelete', checked)}
            />
          </div>
        </div>
      </ScrollArea>
    </>
  );

  // Priority Settings page
  const renderPrioritiesPage = () => (
    <>
      <SheetHeader className="px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <BackButton onClick={() => setCurrentPage('main')} />
          <SheetTitle className="text-lg">{t('settings.prioritySettings', 'Priority Settings')}</SheetTitle>
        </div>
      </SheetHeader>
      <ScrollArea className="flex-1">
        <div className="py-2">
          <SectionHeading title={t('settings.customizePriorities', 'Customize Priorities')} />
          
          {/* Existing Priorities */}
          {priorities.map((priority) => (
            <div key={priority.id} className="px-4 py-3 border-b border-border/50">
              {editingPriority?.id === priority.id ? (
                <div className="space-y-3">
                  <Input
                    value={priority.name}
                    readOnly
                    disabled
                    placeholder={t('settings.priorityName', 'Priority name')}
                  />
                  <div className="flex flex-wrap gap-2">
                    {PRIORITY_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditingPriority({ ...editingPriority, color })}
                        className={cn(
                          "h-8 w-8 rounded-full border-2 transition-all",
                          editingPriority.color === color ? "ring-2 ring-ring ring-offset-2" : "border-transparent"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        const updated = priorities.map(p => 
                          p.id === editingPriority.id ? { ...p, color: editingPriority.color } : p
                        );
                        await savePriorities(updated);
                        setPriorities(updated);
                        setEditingPriority(null);
                        toast.success(t('settings.prioritySaved', 'Priority saved'));
                      }}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      {t('common.save', 'Save')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingPriority(null)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      {t('common.cancel', 'Cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-6 h-6 rounded-full border-2 border-border"
                      style={{ backgroundColor: priority.color }}
                    />
                    <span className="text-foreground">{priority.name}</span>
                    {priority.isDefault && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {t('settings.default', 'Default')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => setEditingPriority(priority)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!priority.isDefault && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteConfirmId(priority.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {/* Add New Priority */}
          {isAddingPriority ? (
            <div className="px-4 py-3 space-y-3">
              <Input
                value={newPriorityName}
                onChange={(e) => setNewPriorityName(e.target.value)}
                placeholder={t('settings.newPriorityName', 'New priority name')}
                autoFocus
              />
              <div className="flex flex-wrap gap-2">
                {PRIORITY_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewPriorityColor(color)}
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition-all",
                      newPriorityColor === color ? "ring-2 ring-ring ring-offset-2" : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!newPriorityName.trim()}
                  onClick={async () => {
                    const newPriority: CustomPriority = {
                      id: `custom_${Date.now()}`,
                      name: newPriorityName.trim(),
                      color: newPriorityColor,
                      order: priorities.length,
                      isDefault: false,
                    };
                    const updated = [...priorities, newPriority];
                    await savePriorities(updated);
                    setPriorities(updated);
                    setNewPriorityName('');
                    setNewPriorityColor('#3B82F6');
                    setIsAddingPriority(false);
                    toast.success(t('settings.priorityAdded', 'Priority added'));
                  }}
                >
                  <Check className="h-4 w-4 mr-1" />
                  {t('common.add', 'Add')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsAddingPriority(false);
                    setNewPriorityName('');
                    setNewPriorityColor('#3B82F6');
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  {t('common.cancel', 'Cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full mt-4 mx-4"
              style={{ width: 'calc(100% - 2rem)' }}
              onClick={() => setIsAddingPriority(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('settings.addPriority', 'Add Custom Priority')}
            </Button>
          )}
        </div>
      </ScrollArea>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.deletePriority', 'Delete Priority')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.deletePriorityDesc', 'Are you sure you want to delete this priority? Tasks using this priority will be set to None.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteConfirmId) {
                  const updated = priorities.filter(p => p.id !== deleteConfirmId);
                  await savePriorities(updated);
                  setPriorities(updated);
                  setDeleteConfirmId(null);
                  toast.success(t('settings.priorityDeleted', 'Priority deleted'));
                }
              }}
            >
              {t('common.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0 flex flex-col">
        {currentPage === 'main' && renderMainPage()}
        {currentPage === 'defaults' && renderDefaultsPage()}
        {currentPage === 'display' && renderDisplayPage()}
        {currentPage === 'reminders' && renderRemindersPage()}
        {currentPage === 'behavior' && renderBehaviorPage()}
        {currentPage === 'priorities' && renderPrioritiesPage()}
      </SheetContent>
    </Sheet>
  );
};

// Hook to access tasks settings with live updates
export const useTasksSettings = () => {
  const [settings, setSettings] = useState<TasksSettings>(DEFAULT_TASKS_SETTINGS);

  useEffect(() => {
    const loadSettings = async () => {
      const saved = await getSetting<TasksSettings | null>('tasksSettings', null);
      if (saved) {
        setSettings({ ...DEFAULT_TASKS_SETTINGS, ...saved });
      }
    };
    
    loadSettings();

    // Listen for settings changes
    const handleChange = (e: CustomEvent<TasksSettings>) => {
      setSettings({ ...DEFAULT_TASKS_SETTINGS, ...e.detail });
    };
    window.addEventListener('tasksSettingsChanged', handleChange as EventListener);
    return () => window.removeEventListener('tasksSettingsChanged', handleChange as EventListener);
  }, []);

  return settings;
};

// Export defaults for use in other components
export const DEFAULT_TASKS_SETTINGS_VALUES = DEFAULT_TASKS_SETTINGS;
