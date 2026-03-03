import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, Monitor, Cloud, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  SyncConflict,
  getPendingConflicts,
  addConflictListener,
  resolveConflict,
} from '@/utils/syncConflicts';
import { saveNoteToDBSingle } from '@/utils/noteStorage';
import { saveTodoItems, loadTodoItems } from '@/utils/todoItemsStorage';
import { Note, TodoItem } from '@/types/note';
import { useToast } from '@/hooks/use-toast';

export const SyncConflictSheet = () => {
  const { toast } = useToast();
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isOpen = conflicts.length > 0;

  useEffect(() => {
    setConflicts(getPendingConflicts());
    return addConflictListener(setConflicts);
  }, []);

  const handleResolve = useCallback(async (conflict: SyncConflict, choice: 'local' | 'remote') => {
    try {
      const chosen = choice === 'local' ? conflict.localItem : conflict.remoteItem;

      if (conflict.type === 'note') {
        const note = { ...(chosen as Note), hasConflict: false, syncStatus: 'synced' as const, isDirty: choice === 'local' };
        await saveNoteToDBSingle(note);
        window.dispatchEvent(new Event('notesUpdated'));
      } else {
        const task = chosen as TodoItem;
        const allTasks = await loadTodoItems();
        const updated = allTasks.map(t => t.id === task.id ? task : t);
        await saveTodoItems(updated);
        window.dispatchEvent(new Event('tasksUpdated'));
      }

      resolveConflict(conflict.id);
      toast({ title: 'Conflict resolved', description: `Kept ${choice} version.` });
    } catch (e) {
      console.error('Failed to resolve conflict:', e);
      toast({ title: 'Error', description: 'Failed to resolve conflict.', variant: 'destructive' });
    }
  }, [toast]);

  const handleResolveAllLocal = useCallback(async () => {
    for (const c of conflicts) {
      await handleResolve(c, 'local');
    }
  }, [conflicts, handleResolve]);

  const handleResolveAllRemote = useCallback(async () => {
    for (const c of conflicts) {
      await handleResolve(c, 'remote');
    }
  }, [conflicts, handleResolve]);

  const getItemTitle = (item: Note | TodoItem, type: 'note' | 'task'): string => {
    if (type === 'note') return (item as Note).title || 'Untitled Note';
    return (item as TodoItem).text || 'Untitled Task';
  };

  const getItemPreview = (item: Note | TodoItem, type: 'note' | 'task'): string => {
    if (type === 'note') {
      const note = item as Note;
      const text = note.content?.replace(/<[^>]*>/g, '') || '';
      return text.slice(0, 120) + (text.length > 120 ? '…' : '');
    }
    const task = item as TodoItem;
    return task.description?.slice(0, 120) || task.text || '';
  };

  const getItemDate = (item: Note | TodoItem, type: 'note' | 'task'): Date | undefined => {
    if (type === 'note') return (item as Note).updatedAt;
    const task = item as TodoItem;
    return task.modifiedAt || task.createdAt;
  };

  if (!isOpen) return null;

  return (
    <Sheet open={isOpen} onOpenChange={() => {}}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl px-0" onPointerDownOutside={e => e.preventDefault()}>
        <SheetHeader className="px-5 pb-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Sync Conflicts ({conflicts.length})
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            These items were edited on multiple devices. Choose which version to keep.
          </p>
        </SheetHeader>

        {conflicts.length > 1 && (
          <div className="flex gap-2 px-5 pb-3">
            <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={handleResolveAllLocal}>
              <Monitor className="h-3.5 w-3.5 mr-1" /> Keep all local
            </Button>
            <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={handleResolveAllRemote}>
              <Cloud className="h-3.5 w-3.5 mr-1" /> Keep all remote
            </Button>
          </div>
        )}

        <Separator />

        <ScrollArea className="h-full px-5 pt-3">
          <div className="space-y-3 pb-20">
            {conflicts.map(conflict => {
              const isExpanded = expandedId === conflict.id;
              const title = getItemTitle(conflict.localItem, conflict.type);

              return (
                <div key={conflict.id} className="rounded-lg border bg-card p-3 space-y-2">
                  {/* Header */}
                  <button
                    className="flex items-center justify-between w-full text-left"
                    onClick={() => setExpandedId(isExpanded ? null : conflict.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {conflict.type}
                      </Badge>
                      <span className="text-sm font-medium truncate">{title}</span>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  </button>

                  {/* Expanded comparison */}
                  {isExpanded && (
                    <div className="space-y-2 pt-1">
                      {/* Local version */}
                      <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-xs font-medium">
                            <Monitor className="h-3.5 w-3.5 text-primary" /> This Device
                          </span>
                          {(() => {
                            const d = getItemDate(conflict.localItem, conflict.type);
                            return d ? <span className="text-[10px] text-muted-foreground">{format(d, 'MMM d, h:mm a')}</span> : null;
                          })()}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {getItemPreview(conflict.localItem, conflict.type)}
                        </p>
                        <Button size="sm" variant="default" className="w-full h-7 text-xs mt-1" onClick={() => handleResolve(conflict, 'local')}>
                          <Check className="h-3 w-3 mr-1" /> Keep Local
                        </Button>
                      </div>

                      {/* Remote version */}
                      <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-xs font-medium">
                            <Cloud className="h-3.5 w-3.5 text-blue-500" /> Google Drive
                          </span>
                          {(() => {
                            const d = getItemDate(conflict.remoteItem, conflict.type);
                            return d ? <span className="text-[10px] text-muted-foreground">{format(d, 'MMM d, h:mm a')}</span> : null;
                          })()}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {getItemPreview(conflict.remoteItem, conflict.type)}
                        </p>
                        <Button size="sm" variant="outline" className="w-full h-7 text-xs mt-1 border-blue-500/30 text-blue-600 hover:bg-blue-500/10" onClick={() => handleResolve(conflict, 'remote')}>
                          <Check className="h-3 w-3 mr-1" /> Keep Remote
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Collapsed actions */}
                  {!isExpanded && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="default" className="flex-1 h-7 text-xs" onClick={() => handleResolve(conflict, 'local')}>
                        <Monitor className="h-3 w-3 mr-1" /> Local
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => handleResolve(conflict, 'remote')}>
                        <Cloud className="h-3 w-3 mr-1" /> Remote
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
