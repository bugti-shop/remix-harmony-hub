import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { TodoItem } from '@/types/note';
import { Link, Search, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';

interface TaskDependencySheetProps {
  isOpen: boolean;
  onClose: () => void;
  task: TodoItem;
  allTasks: TodoItem[];
  onSave: (dependsOn: string[]) => void;
}

export const TaskDependencySheet = ({
  isOpen,
  onClose,
  task,
  allTasks,
  onSave,
}: TaskDependencySheetProps) => {
  const [selectedDependencies, setSelectedDependencies] = useState<string[]>(
    task.dependsOn || []
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Hardware back button support - use 'sheet' priority to close sheet before navigation
  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  // Filter out current task and subtasks, also filter by search
  const availableTasks = allTasks.filter(t => {
    if (t.id === task.id) return false;
    // Prevent circular dependencies
    if (t.dependsOn?.includes(task.id)) return false;
    if (searchQuery) {
      return t.text.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const toggleDependency = (taskId: string) => {
    setSelectedDependencies(prev => {
      if (prev.includes(taskId)) {
        return prev.filter(id => id !== taskId);
      }
      return [...prev, taskId];
    });
  };

  const handleSave = () => {
    onSave(selectedDependencies);
    onClose();
  };

  // Get selected task objects for display
  const selectedTasks = allTasks.filter(t => selectedDependencies.includes(t.id));
  const hasUncompletedDependencies = selectedTasks.some(t => !t.completed);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Task Dependencies
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* Selected dependencies summary */}
          {selectedDependencies.length > 0 && (
            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                {hasUncompletedDependencies ? (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-amber-500">Waiting on {selectedDependencies.length} task(s)</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-green-500">All dependencies completed</span>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedTasks.map(t => (
                  <div
                    key={t.id}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs",
                      t.completed ? "bg-green-500/20 text-green-700" : "bg-amber-500/20 text-amber-700"
                    )}
                  >
                    <span className="truncate max-w-[150px]">{t.text}</span>
                    <button
                      onClick={() => toggleDependency(t.id)}
                      className="hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Task list */}
          <ScrollArea className="h-[45vh]">
            <div className="space-y-1">
              {availableTasks.map(t => (
                <div
                  key={t.id}
                  onClick={() => toggleDependency(t.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                    selectedDependencies.includes(t.id)
                      ? "bg-primary/10"
                      : "hover:bg-muted/50"
                  )}
                >
                  <Checkbox
                    checked={selectedDependencies.includes(t.id)}
                    onCheckedChange={() => toggleDependency(t.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm truncate",
                      t.completed && "line-through text-muted-foreground"
                    )}>
                      {t.text}
                    </p>
                  </div>
                  {t.completed && (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  )}
                </div>
              ))}
              {availableTasks.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No tasks available to link
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} className="flex-1">
              Save Dependencies
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

// Helper function to check if task can be completed
export const canCompleteTask = (task: TodoItem, allTasks: TodoItem[]): { canComplete: boolean; blockedBy: TodoItem[] } => {
  if (!task.dependsOn || task.dependsOn.length === 0) {
    return { canComplete: true, blockedBy: [] };
  }
  
  const blockedBy = allTasks.filter(t => 
    task.dependsOn?.includes(t.id) && !t.completed
  );
  
  return {
    canComplete: blockedBy.length === 0,
    blockedBy,
  };
};
