import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TodoItem } from '@/types/note';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface TodoEditorProps {
  items: TodoItem[];
  onChange: (items: TodoItem[]) => void;
}

export const TodoEditor = ({ items, onChange }: TodoEditorProps) => {
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState('');

  const addItem = () => {
    if (currentTask.trim()) {
      onChange([...items, { id: Date.now().toString(), text: currentTask, completed: false }]);
      setCurrentTask('');
      setIsDialogOpen(false);
    }
  };

  const updateItem = (itemId: string, updates: Partial<TodoItem>) => {
    onChange(items.map((item) => (item.id === itemId ? { ...item, ...updates } : item)));
  };

  const deleteItem = (itemId: string) => {
    onChange(items.filter((item) => item.id !== itemId));
  };

  return (
    <div className="p-4 sm:p-6 overflow-y-auto h-full pb-32 bg-background">
      <div className="max-w-2xl mx-auto space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 p-3 bg-card rounded-lg border group hover:shadow-sm transition-shadow"
          >
            <Checkbox
              checked={item.completed}
              onCheckedChange={(checked) => updateItem(item.id, { completed: !!checked })}
              className={cn(
                "h-6 w-6 rounded-full border-2",
                item.completed
                  ? "bg-success border-success data-[state=checked]:bg-success data-[state=checked]:text-success-foreground"
                  : "border-muted-foreground/40"
              )}
            />
            <Input
              value={item.text}
              onChange={(e) => updateItem(item.id, { text: e.target.value })}
              className={cn(
                "flex-1 border-0 h-9 px-2 focus-visible:ring-0 bg-transparent text-base",
                item.completed && "line-through text-muted-foreground"
              )}
              placeholder="Add a task..."
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteItem(item.id)}
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <Button
          onClick={() => setIsDialogOpen(true)}
          className="w-full h-12 mt-4 text-base bg-primary"
        >
          <Plus className="h-5 w-5 mr-2" />
          {t('common.addTask')}
        </Button>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-[280px] bg-card p-5 gap-5 mx-auto top-[20%] translate-y-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-normal">{t('common.addItem')}</DialogTitle>
            </DialogHeader>

            <div className="space-y-5">
              <Input
                placeholder=""
                value={currentTask}
                onChange={(e) => setCurrentTask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (currentTask.trim()) {
                      onChange([...items, { id: Date.now().toString(), text: currentTask, completed: false }]);
                      setCurrentTask('');
                    }
                  }
                }}
                className="text-base border-0 border-b border-primary rounded-none px-0 bg-transparent placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:border-primary"
                autoFocus
              />

              <div className="flex justify-between gap-3 pt-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (currentTask.trim()) {
                      onChange([...items, { id: Date.now().toString(), text: currentTask, completed: false }]);
                      setCurrentTask('');
                    }
                  }}
                  className="hover:bg-transparent uppercase font-medium text-sm text-primary"
                >
                  {t('common.next')}
                </Button>
                <div className="flex gap-4">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsDialogOpen(false);
                      setCurrentTask('');
                    }}
                    className="hover:bg-transparent uppercase font-medium text-sm text-primary"
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={addItem}
                    className="hover:bg-transparent uppercase font-medium text-sm text-primary"
                  >
                    {t('common.ok')}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
