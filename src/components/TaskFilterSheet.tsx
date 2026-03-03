import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Folder, Priority, TaskStatus } from '@/types/note';
import { X, Tag, Circle, Clock, Loader2, CheckCircle, Bookmark } from 'lucide-react';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { useGlobalTags } from '@/hooks/useGlobalTags';
import { AppTag } from '@/utils/tagStorage';

export type DateFilter = 'all' | 'today' | 'tomorrow' | 'this-week' | 'overdue' | 'no-date' | 'has-date';
export type PriorityFilter = 'all' | Priority;
export type StatusFilter = 'all' | 'completed' | 'uncompleted' | TaskStatus;

interface TaskFilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  selectedFolderId: string | null;
  onFolderChange: (folderId: string | null) => void;
  dateFilter: DateFilter;
  onDateFilterChange: (value: DateFilter) => void;
  priorityFilter: PriorityFilter;
  onPriorityFilterChange: (value: PriorityFilter) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  onClearAll: () => void;
  onSaveAsSmartView?: () => void;
}

export const TaskFilterSheet = ({
  isOpen,
  onClose,
  folders,
  selectedFolderId,
  onFolderChange,
  dateFilter,
  onDateFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  statusFilter,
  onStatusFilterChange,
  selectedTags,
  onTagsChange,
  onClearAll,
  onSaveAsSmartView,
}: TaskFilterSheetProps) => {
  const { t } = useTranslation();
  const { tags: globalTags } = useGlobalTags();

  const hasActiveFilters = selectedFolderId !== null || dateFilter !== 'all' || priorityFilter !== 'all' || statusFilter !== 'all' || selectedTags.length > 0;

  // Hardware back button support
  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  const handleTagToggle = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onTagsChange(selectedTags.filter(t => t !== tagId));
    } else {
      onTagsChange([...selectedTags, tagId]);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-semibold">{t('tasks.filters.title')}</SheetTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={onClearAll} className="text-destructive hover:text-destructive">
                <X className="h-4 w-4 mr-1" />
                {t('tasks.filters.clearFilters')}
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="space-y-6 overflow-y-auto pb-8">
          {/* Filter by Tags */}
          {globalTags.length > 0 && (
            <>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('tasks.tags')}</h3>
                <div className="flex flex-wrap gap-2">
                  {globalTags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => handleTagToggle(tag.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full transition-all text-white ${
                        selectedTags.includes(tag.id) 
                          ? 'ring-2 ring-offset-2 ring-primary' 
                          : 'hover:opacity-80'
                      }`}
                      style={{ backgroundColor: `hsl(${tag.color})` }}
                    >
                      {tag.icon && <span>{tag.icon}</span>}
                      <Tag className="h-3.5 w-3.5" />
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Filter by Folder */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('tasks.folders.title')}</h3>
            <RadioGroup value={selectedFolderId || 'all'} onValueChange={(v) => onFolderChange(v === 'all' ? null : v)}>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="all" id="folder-all" />
                <Label htmlFor="folder-all" className="cursor-pointer flex-1">{t('tasks.folders.all')}</Label>
              </div>
              {folders.map((folder) => (
                <div key={folder.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value={folder.id} id={`folder-${folder.id}`} />
                  <Label htmlFor={`folder-${folder.id}`} className="cursor-pointer flex-1 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: folder.color }} />
                    {folder.name}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <Separator />

          {/* Filter by Date */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('dateTime.date')}</h3>
            <RadioGroup value={dateFilter} onValueChange={(v) => onDateFilterChange(v as DateFilter)}>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="all" id="date-all" />
                <Label htmlFor="date-all" className="cursor-pointer flex-1">{t('tasks.filters.all')}</Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="today" id="date-today" />
                <Label htmlFor="date-today" className="cursor-pointer flex-1">{t('common.today')}</Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="tomorrow" id="date-tomorrow" />
                <Label htmlFor="date-tomorrow" className="cursor-pointer flex-1">{t('common.tomorrow')}</Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="this-week" id="date-week" />
                <Label htmlFor="date-week" className="cursor-pointer flex-1">{t('common.thisWeek')}</Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="overdue" id="date-overdue" />
                <Label htmlFor="date-overdue" className="cursor-pointer flex-1 text-destructive">{t('tasks.overdue')}</Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="has-date" id="date-has" />
                <Label htmlFor="date-has" className="cursor-pointer flex-1">{t('tasks.filters.hasDate')}</Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="no-date" id="date-no" />
                <Label htmlFor="date-no" className="cursor-pointer flex-1">{t('tasks.noDueDate')}</Label>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* Filter by Priority */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('tasks.priority.title')}</h3>
            <RadioGroup value={priorityFilter} onValueChange={(v) => onPriorityFilterChange(v as PriorityFilter)}>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="all" id="priority-all" />
                <Label htmlFor="priority-all" className="cursor-pointer flex-1">{t('tasks.filters.all')}</Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="high" id="priority-high" />
                <Label htmlFor="priority-high" className="cursor-pointer flex-1 text-red-500">{t('tasks.priority.high')}</Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="medium" id="priority-medium" />
                <Label htmlFor="priority-medium" className="cursor-pointer flex-1 text-yellow-500">{t('tasks.priority.medium')}</Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="low" id="priority-low" />
                <Label htmlFor="priority-low" className="cursor-pointer flex-1 text-blue-500">{t('tasks.priority.low')}</Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="none" id="priority-none" />
                <Label htmlFor="priority-none" className="cursor-pointer flex-1">{t('tasks.priority.none')}</Label>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* Filter by Status */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('tasks.status.title')}</h3>
            <RadioGroup value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as StatusFilter)}>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="all" id="status-all" />
                <Label htmlFor="status-all" className="cursor-pointer flex-1">{t('tasks.filters.all')}</Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="uncompleted" id="status-uncompleted" />
                <Label htmlFor="status-uncompleted" className="cursor-pointer flex-1">{t('tasks.incomplete')}</Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="completed" id="status-completed" />
                <Label htmlFor="status-completed" className="cursor-pointer flex-1">{t('tasks.completed')}</Label>
              </div>
              <Separator className="my-2" />
              <p className="text-xs text-muted-foreground px-3 pb-1">{t('tasks.filters.byStatus')}</p>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="not_started" id="status-not-started" />
                <Label htmlFor="status-not-started" className="cursor-pointer flex-1 flex items-center gap-2">
                  <Circle className="h-4 w-4 text-gray-500" />
                  {t('tasks.status.notStarted')}
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="in_progress" id="status-in-progress" />
                <Label htmlFor="status-in-progress" className="cursor-pointer flex-1 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 text-blue-500" />
                  {t('tasks.status.inProgress')}
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="almost_done" id="status-almost-done" />
                <Label htmlFor="status-almost-done" className="cursor-pointer flex-1 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-orange-500" />
                  {t('tasks.status.almostDone')}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Save as Smart View */}
          {hasActiveFilters && onSaveAsSmartView && (
            <>
              <Separator />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  onSaveAsSmartView();
                  onClose();
                }}
              >
                <Bookmark className="h-4 w-4 mr-2" />
                {t('tasks.filters.saveAsSmartView', 'Save as Smart View')}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
