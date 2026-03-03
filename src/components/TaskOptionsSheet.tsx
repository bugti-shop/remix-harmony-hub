import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { TaskSection } from '@/types/note';

export type GroupBy = 'custom' | 'date' | 'priority';
export type SortBy = 'custom' | 'date' | 'priority';
export type TaskAddPosition = 'top' | 'bottom';

export interface HideDetailsOptions {
  hideDateTime: boolean;
  hideStatus: boolean;
  hideSubtasks: boolean;
}

interface TaskOptionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  groupBy: GroupBy;
  sortBy: SortBy;
  onGroupByChange: (value: GroupBy) => void;
  onSortByChange: (value: SortBy) => void;
  // New props for default section and task position
  sections?: TaskSection[];
  defaultSectionId?: string;
  onDefaultSectionChange?: (sectionId: string) => void;
  taskAddPosition?: TaskAddPosition;
  onTaskAddPositionChange?: (position: TaskAddPosition) => void;
  showStatusBadge?: boolean;
  onShowStatusBadgeChange?: (show: boolean) => void;
  // Granular hide/show options
  hideDetailsOptions?: HideDetailsOptions;
  onHideDetailsOptionsChange?: (options: HideDetailsOptions) => void;
}

export const TaskOptionsSheet = ({
  isOpen,
  onClose,
  groupBy,
  sortBy,
  onGroupByChange,
  onSortByChange,
  sections = [],
  defaultSectionId,
  onDefaultSectionChange,
  taskAddPosition = 'top',
  onTaskAddPositionChange,
  showStatusBadge = true,
  onShowStatusBadgeChange,
  hideDetailsOptions = { hideDateTime: false, hideStatus: false, hideSubtasks: false },
  onHideDetailsOptionsChange,
}: TaskOptionsSheetProps) => {
  const { t } = useTranslation();
  
  // Hardware back button support - use 'sheet' priority to close sheet before navigation
  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  const updateHideOption = (key: keyof HideDetailsOptions, value: boolean) => {
    if (onHideDetailsOptionsChange) {
      onHideDetailsOptionsChange({ ...hideDetailsOptions, [key]: value });
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl flex flex-col">
        <SheetHeader className="pb-4 flex-shrink-0">
          <SheetTitle className="text-lg font-semibold">{t('tasks.options', 'Task Options')}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pb-4">
          {/* Default Section */}
          {sections.length > 0 && onDefaultSectionChange && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('tasks.defaultSection', 'Default Section for New Tasks')}</h3>
              <Select value={defaultSectionId || sections[0]?.id} onValueChange={onDefaultSectionChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('tasks.sections.title')} />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: section.color }} />
                        {section.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Task Add Position */}
          {onTaskAddPositionChange && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('tasks.addPosition', 'Add New Tasks To')}</h3>
                <RadioGroup value={taskAddPosition} onValueChange={(v) => onTaskAddPositionChange(v as TaskAddPosition)}>
                  <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="top" id="pos-top" />
                    <Label htmlFor="pos-top" className="cursor-pointer flex-1">{t('tasks.topOfSection', 'Top of Section')}</Label>
                  </div>
                  <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="bottom" id="pos-bottom" />
                    <Label htmlFor="pos-bottom" className="cursor-pointer flex-1">{t('tasks.bottomOfSection', 'Bottom of Section')}</Label>
                  </div>
                </RadioGroup>
              </div>
            </>
          )}

          {/* Granular Hide/Show Options */}
          {onHideDetailsOptionsChange && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('tasks.showHideDetails', 'Show / Hide Details')}</h3>
                
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50">
                  <div className="space-y-1">
                    <Label className="font-medium">{t('dateTime.date')} & {t('dateTime.time')}</Label>
                    <p className="text-xs text-muted-foreground">{t('tasks.showDueDates', 'Show due dates on tasks')}</p>
                  </div>
                  <Switch 
                    checked={!hideDetailsOptions.hideDateTime} 
                    onCheckedChange={(checked) => updateHideOption('hideDateTime', !checked)} 
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50">
                  <div className="space-y-1">
                    <Label className="font-medium">{t('tasks.status.title')}</Label>
                    <p className="text-xs text-muted-foreground">{t('tasks.showStatus', 'Show status on tasks')}</p>
                  </div>
                  <Switch 
                    checked={!hideDetailsOptions.hideStatus} 
                    onCheckedChange={(checked) => updateHideOption('hideStatus', !checked)} 
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50">
                  <div className="space-y-1">
                    <Label className="font-medium">{t('tasks.subtasks', 'Subtasks')}</Label>
                    <p className="text-xs text-muted-foreground">{t('tasks.showSubtaskCounts', 'Show subtask counts')}</p>
                  </div>
                  <Switch 
                    checked={!hideDetailsOptions.hideSubtasks} 
                    onCheckedChange={(checked) => updateHideOption('hideSubtasks', !checked)} 
                  />
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Group By */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('tasks.groupBy', 'Group By')}</h3>
            <RadioGroup value={groupBy} onValueChange={(v) => onGroupByChange(v as GroupBy)}>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="custom" id="group-custom" />
                <Label htmlFor="group-custom" className="cursor-pointer flex-1">{t('tasks.repeat.custom', 'Custom')}</Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="date" id="group-date" />
                <Label htmlFor="group-date" className="cursor-pointer flex-1">{t('tasks.sort.date')}</Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="priority" id="group-priority" />
                <Label htmlFor="group-priority" className="cursor-pointer flex-1">{t('tasks.priority.title')}</Label>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* Sort By */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('tasks.sort.title')}</h3>
            <RadioGroup value={sortBy} onValueChange={(v) => onSortByChange(v as SortBy)}>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="custom" id="sort-custom" />
                <Label htmlFor="sort-custom" className="cursor-pointer flex-1">{t('tasks.repeat.custom', 'Custom')}</Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="date" id="sort-date" />
                <Label htmlFor="sort-date" className="cursor-pointer flex-1">{t('tasks.sort.date')}</Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="priority" id="sort-priority" />
                <Label htmlFor="sort-priority" className="cursor-pointer flex-1">{t('tasks.priority.title')}</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};