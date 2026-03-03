import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ListPlus, FolderIcon, LayoutList, Flag, Calendar } from 'lucide-react';
import { TaskSection, Folder, Priority } from '@/types/note';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { useTranslation } from 'react-i18next';

interface BatchTaskSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTasks: (tasks: string[], sectionId?: string, folderId?: string, priority?: Priority, dueDate?: Date) => void;
  sections?: TaskSection[];
  folders?: Folder[];
}

export const BatchTaskSheet = ({ isOpen, onClose, onAddTasks, sections = [], folders = [] }: BatchTaskSheetProps) => {
  const { t } = useTranslation();
  
  // Hardware back button support - use 'sheet' priority to close sheet before navigation
  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  const [text, setText] = useState('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<Priority>('none');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const priorityOptions: { value: Priority; labelKey: string; color: string }[] = [
    { value: 'high', labelKey: 'tasks.priority.high', color: 'text-destructive' },
    { value: 'medium', labelKey: 'tasks.priority.medium', color: 'text-streak' },
    { value: 'low', labelKey: 'tasks.priority.low', color: 'text-success' },
    { value: 'none', labelKey: 'tasks.priority.none', color: 'text-muted-foreground' },
  ];

  const handleAdd = () => {
    const tasks = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    if (tasks.length > 0) {
      onAddTasks(
        tasks, 
        selectedSection || undefined, 
        selectedFolder || undefined,
        selectedPriority !== 'none' ? selectedPriority : undefined,
        selectedDate
      );
      setText('');
      setSelectedSection('');
      setSelectedFolder('');
      setSelectedPriority('none');
      setSelectedDate(undefined);
      onClose();
    }
  };

  const taskCount = text.split('\n').filter(line => line.trim().length > 0).length;
  const selectedPriorityOption = priorityOptions.find(p => p.value === selectedPriority);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[75vh] rounded-t-3xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <ListPlus className="h-5 w-5" />
            {t('batch.addMultipleTasks')}
          </SheetTitle>
        </SheetHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('batch.instructions')}
          </p>
          
          <Textarea
            placeholder={t('batch.placeholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[160px] resize-none"
            autoFocus
          />

          {/* Section and Folder Selection */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <LayoutList className="h-3.5 w-3.5" />
                {t('tasks.section')}
              </label>
              <Select value={selectedSection || "no-section"} onValueChange={(v) => setSelectedSection(v === "no-section" ? "" : v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t('batch.noSection')} />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="no-section">{t('batch.noSection')}</SelectItem>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: section.color }}
                        />
                        {section.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 space-y-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <FolderIcon className="h-3.5 w-3.5" />
                {t('tasks.folder')}
              </label>
              <Select value={selectedFolder || "no-folder"} onValueChange={(v) => setSelectedFolder(v === "no-folder" ? "" : v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t('batch.noFolder')} />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="no-folder">{t('batch.noFolder')}</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      <div className="flex items-center gap-2">
                        {folder.color && (
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: folder.color }}
                          />
                        )}
                        {folder.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Priority and Due Date Selection */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Flag className="h-3.5 w-3.5" />
                {t('tasks.priority.title')}
              </label>
              <Select value={selectedPriority} onValueChange={(v) => setSelectedPriority(v as Priority)}>
                <SelectTrigger className="h-9">
                  <SelectValue>
                    <span className={cn(selectedPriorityOption?.color)}>
                      {selectedPriorityOption ? t(selectedPriorityOption.labelKey) : t('tasks.priority.none')}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {priorityOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className={cn(option.color)}>{t(option.labelKey)}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 space-y-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {t('dateTime.dueDate')}
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-9 w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    {selectedDate ? format(selectedDate, 'MMM d, yyyy') : t('batch.noDate')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                  />
                  {selectedDate && (
                    <div className="p-2 border-t">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full"
                        onClick={() => setSelectedDate(undefined)}
                      >
                        {t('batch.clearDate')}
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t('batch.tasksToAdd', { count: taskCount })}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
              <Button onClick={handleAdd} disabled={taskCount === 0}>
                {taskCount > 0 ? t('batch.addTasksCount', { count: taskCount }) : t('batch.addTasks')}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
