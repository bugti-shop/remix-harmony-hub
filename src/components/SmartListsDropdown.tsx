import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TodoItem } from '@/types/note';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Sparkles, 
  AlertCircle, 
  CalendarX, 
  Flame, 
  Star, 
  Clock, 
  CheckCircle2,
  Calendar,
  MapPin,
  Trash2
} from 'lucide-react';
import { isToday, isTomorrow, isThisWeek, isBefore, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { CustomSmartView, loadCustomSmartViews, deleteCustomSmartView } from '@/utils/customSmartViews';
import { toast } from 'sonner';

export type SmartListType = 
  | 'all' 
  | 'overdue' 
  | 'no-date' 
  | 'high-priority-week' 
  | 'due-today'
  | 'due-tomorrow'
  | 'due-this-week'
  | 'recently-completed'
  | 'location-reminders';

interface SmartListsDropdownProps {
  items: TodoItem[];
  currentList: SmartListType;
  onSelectList: (list: SmartListType) => void;
  customViews?: CustomSmartView[];
  activeCustomViewId?: string | null;
  onSelectCustomView?: (view: CustomSmartView) => void;
  onCustomViewsChanged?: () => void;
}

export interface SmartListConfig {
  id: SmartListType;
  label: string;
  labelKey: string;
  icon: React.ReactNode;
  filter: (items: TodoItem[]) => TodoItem[];
  color?: string;
}

export const useSmartLists = (items: TodoItem[]) => {
  const { t } = useTranslation();
  const today = startOfDay(new Date());

  const smartLists: SmartListConfig[] = useMemo(() => [
    {
      id: 'all',
      label: t('smartLists.allTasks'),
      labelKey: 'smartLists.allTasks',
      icon: <Sparkles className="h-4 w-4" />,
      filter: (items) => items,
    },
    {
      id: 'overdue',
      label: t('smartLists.overdue'),
      labelKey: 'smartLists.overdue',
      icon: <AlertCircle className="h-4 w-4 text-red-500" />,
      filter: (items) => items.filter(item => 
        !item.completed && item.dueDate && isBefore(new Date(item.dueDate), today)
      ),
      color: 'text-red-500',
    },
    {
      id: 'due-today',
      label: t('smartLists.dueToday'),
      labelKey: 'smartLists.dueToday',
      icon: <Clock className="h-4 w-4 text-amber-500" />,
      filter: (items) => items.filter(item => 
        !item.completed && item.dueDate && isToday(new Date(item.dueDate))
      ),
      color: 'text-amber-500',
    },
    {
      id: 'due-tomorrow',
      label: t('smartLists.dueTomorrow'),
      labelKey: 'smartLists.dueTomorrow',
      icon: <Calendar className="h-4 w-4 text-blue-500" />,
      filter: (items) => items.filter(item => 
        !item.completed && item.dueDate && isTomorrow(new Date(item.dueDate))
      ),
      color: 'text-blue-500',
    },
    {
      id: 'due-this-week',
      label: t('smartLists.dueThisWeek'),
      labelKey: 'smartLists.dueThisWeek',
      icon: <Calendar className="h-4 w-4 text-purple-500" />,
      filter: (items) => items.filter(item => 
        !item.completed && item.dueDate && isThisWeek(new Date(item.dueDate)) && !isToday(new Date(item.dueDate))
      ),
      color: 'text-purple-500',
    },
    {
      id: 'no-date',
      label: t('smartLists.noDueDate'),
      labelKey: 'smartLists.noDueDate',
      icon: <CalendarX className="h-4 w-4 text-muted-foreground" />,
      filter: (items) => items.filter(item => !item.completed && !item.dueDate),
      color: 'text-muted-foreground',
    },
    {
      id: 'high-priority-week',
      label: t('smartLists.highPriorityWeek'),
      labelKey: 'smartLists.highPriorityWeek',
      icon: <Flame className="h-4 w-4 text-orange-500" />,
      filter: (items) => items.filter(item => 
        !item.completed && 
        item.priority === 'high' && 
        (!item.dueDate || isThisWeek(new Date(item.dueDate)) || isBefore(new Date(item.dueDate), today))
      ),
      color: 'text-orange-500',
    },
    {
      id: 'recently-completed',
      label: t('smartLists.recentlyCompleted'),
      labelKey: 'smartLists.recentlyCompleted',
      icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
      filter: (items) => items.filter(item => item.completed).slice(0, 20),
      color: 'text-green-500',
    },
    {
      id: 'location-reminders',
      label: t('smartLists.locationReminders'),
      labelKey: 'smartLists.locationReminders',
      icon: <MapPin className="h-4 w-4 text-emerald-500" />,
      filter: (items) => items.filter(item => 
        !item.completed && 
        item.locationReminder?.enabled
      ),
      color: 'text-emerald-500',
    },
  ], [today, t]);

  const getCounts = useMemo(() => {
    const counts: Record<SmartListType, number> = {} as any;
    smartLists.forEach(list => {
      counts[list.id] = list.filter(items).length;
    });
    return counts;
  }, [items, smartLists]);

  return { smartLists, getCounts };
};

export const SmartListsDropdown = ({ 
  items, 
  currentList, 
  onSelectList,
  customViews = [],
  activeCustomViewId,
  onSelectCustomView,
  onCustomViewsChanged,
}: SmartListsDropdownProps) => {
  const { t } = useTranslation();
  const { smartLists, getCounts } = useSmartLists(items);

  const currentListConfig = smartLists.find(l => l.id === currentList) || smartLists[0];
  const activeCustomView = customViews.find(v => v.id === activeCustomViewId);

  const handleDeleteCustomView = async (e: React.MouseEvent, viewId: string) => {
    e.stopPropagation();
    await deleteCustomSmartView(viewId);
    onCustomViewsChanged?.();
    toast.success('Smart View deleted');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {activeCustomView ? (
            <span>{activeCustomView.icon}</span>
          ) : (
            currentListConfig.icon
          )}
          <span className="hidden sm:inline">
            {activeCustomView ? activeCustomView.name : currentListConfig.label}
          </span>
          {!activeCustomView && currentList !== 'all' && getCounts[currentList] > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {getCounts[currentList]}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-[60vh] overflow-y-auto">
        {smartLists.map((list, index) => (
          <div key={list.id}>
            {index === 1 && <DropdownMenuSeparator />}
            {index === 5 && <DropdownMenuSeparator />}
            {index === 7 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={() => {
                onSelectList(list.id);
                // Clear custom view when selecting a built-in list
                if (onSelectCustomView && activeCustomViewId) {
                  onSelectCustomView(null as any);
                }
              }}
              className={cn(
                "cursor-pointer flex items-center justify-between",
                currentList === list.id && !activeCustomViewId && "bg-accent"
              )}
            >
              <div className="flex items-center gap-2">
                {list.icon}
                <span className={list.color}>{list.label}</span>
              </div>
              {getCounts[list.id] > 0 && (
                <Badge 
                  variant={list.id === 'overdue' && getCounts[list.id] > 0 ? "destructive" : "secondary"} 
                  className="h-5 px-1.5 text-xs"
                >
                  {getCounts[list.id]}
                </Badge>
              )}
            </DropdownMenuItem>
          </div>
        ))}

        {/* Custom Smart Views */}
        {customViews.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Saved Views
              </span>
            </div>
            {customViews.map((view) => (
              <DropdownMenuItem
                key={view.id}
                onClick={() => onSelectCustomView?.(view)}
                className={cn(
                  "cursor-pointer flex items-center justify-between group",
                  activeCustomViewId === view.id && "bg-accent"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span>{view.icon}</span>
                  <span className="truncate" style={{ color: view.color }}>{view.name}</span>
                </div>
                <button
                  onClick={(e) => handleDeleteCustomView(e, view.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity"
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Export filter function for use in parent components
export const getSmartListFilter = (listType: SmartListType): ((item: TodoItem) => boolean) => {
  const today = startOfDay(new Date());
  
  switch (listType) {
    case 'overdue':
      return (item) => !item.completed && !!item.dueDate && isBefore(new Date(item.dueDate), today);
    case 'due-today':
      return (item) => !item.completed && !!item.dueDate && isToday(new Date(item.dueDate));
    case 'due-tomorrow':
      return (item) => !item.completed && !!item.dueDate && isTomorrow(new Date(item.dueDate));
    case 'due-this-week':
      return (item) => !item.completed && !!item.dueDate && isThisWeek(new Date(item.dueDate)) && !isToday(new Date(item.dueDate));
    case 'no-date':
      return (item) => !item.completed && !item.dueDate;
    case 'high-priority-week':
      return (item) => 
        !item.completed && 
        item.priority === 'high' && 
        (!item.dueDate || isThisWeek(new Date(item.dueDate)) || isBefore(new Date(item.dueDate), today));
    case 'recently-completed':
      return (item) => item.completed;
    case 'location-reminders':
      return (item) => !item.completed && !!item.locationReminder?.enabled;
    default:
      return () => true;
  }
};
