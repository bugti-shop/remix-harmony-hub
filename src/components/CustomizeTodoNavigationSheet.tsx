import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical, RotateCcw, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import { toast } from 'sonner';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { DEFAULT_TODO_NAV_ITEMS, TodoNavItem } from './TodoBottomNavigation';
import { Home, Calendar, Settings, BarChart3, User, ClipboardList, History, CalendarDays, CalendarRange } from 'lucide-react';

const ICON_MAP: Record<string, React.ReactNode> = {
  Home: <Home className="h-5 w-5" />,
  BarChart3: <BarChart3 className="h-5 w-5" />,
  User: <User className="h-5 w-5" />,
  Calendar: <Calendar className="h-5 w-5" />,
  Settings: <Settings className="h-5 w-5" />,
  ClipboardList: <ClipboardList className="h-5 w-5" />,
  History: <History className="h-5 w-5" />,
  CalendarDays: <CalendarDays className="h-5 w-5" />,
  CalendarRange: <CalendarRange className="h-5 w-5" />,
};

const MAX_VISIBLE = 5;

interface CustomizeTodoNavigationSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomizeTodoNavigationSheet = ({ isOpen, onClose }: CustomizeTodoNavigationSheetProps) => {
  const { t } = useTranslation();
  const [navItems, setNavItems] = useState<TodoNavItem[]>(DEFAULT_TODO_NAV_ITEMS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useHardwareBackButton({ onBack: onClose, enabled: isOpen, priority: 'sheet' });

  useEffect(() => {
    if (isOpen) loadNavItems();
  }, [isOpen]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const loadNavItems = async () => {
    try {
      const saved = await getSetting<TodoNavItem[] | null>('customTodoNavItems', null);
      if (saved && saved.length > 0) {
        const savedMap = new Map(saved.map(item => [item.id, item]));
        const merged = DEFAULT_TODO_NAV_ITEMS.map(defaultItem => {
          const savedItem = savedMap.get(defaultItem.id);
          return savedItem ? { ...defaultItem, ...savedItem, path: defaultItem.path } : defaultItem;
        });
        const orderedMerged = saved
          .map(s => merged.find(m => m.id === s.id))
          .filter(Boolean) as TodoNavItem[];
        merged.forEach(item => {
          if (!orderedMerged.find(o => o.id === item.id)) orderedMerged.push(item);
        });
        setNavItems(orderedMerged);
      } else {
        setNavItems([...DEFAULT_TODO_NAV_ITEMS]);
      }
    } catch {
      setNavItems([...DEFAULT_TODO_NAV_ITEMS]);
    }
  };

  const saveNavItems = async (items: TodoNavItem[]) => {
    setNavItems(items);
    await setSetting('customTodoNavItems', items);
    window.dispatchEvent(new CustomEvent('todoNavItemsChanged'));
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || result.source.index === result.destination.index) return;
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
    const newItems = Array.from(navItems);
    const [removed] = newItems.splice(result.source.index, 1);
    newItems.splice(result.destination.index, 0, removed);
    await saveNavItems(newItems);
  };

  const toggleVisibility = async (id: string) => {
    const visibleCount = navItems.filter(item => item.visible).length;
    const item = navItems.find(i => i.id === id);
    
    if (item?.visible && visibleCount <= 2) {
      toast.error(t('settings.minNavItems', 'At least 2 navigation items must be visible'));
      return;
    }
    if (!item?.visible && visibleCount >= MAX_VISIBLE) {
      toast.error(t('settings.maxNavItems', 'Maximum 5 navigation items allowed'));
      return;
    }

    const newItems = navItems.map(i => i.id === id ? { ...i, visible: !i.visible } : i);
    await saveNavItems(newItems);
  };

  const startEditing = (item: TodoNavItem) => {
    setEditingId(item.id);
    setEditValue(item.customLabel || item.label);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const trimmedValue = editValue.trim();
    if (!trimmedValue) { cancelEdit(); return; }
    const newItems = navItems.map(item =>
      item.id === editingId
        ? { ...item, customLabel: trimmedValue === item.label ? undefined : trimmedValue }
        : item
    );
    await saveNavItems(newItems);
    setEditingId(null);
    setEditValue('');
  };

  const cancelEdit = () => { setEditingId(null); setEditValue(''); };

  const handleReset = async () => {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
    await saveNavItems([...DEFAULT_TODO_NAV_ITEMS]);
    toast.success(t('settings.navigationReset', 'Navigation reset to default'));
  };

  const getDisplayLabel = (item: TodoNavItem) => item.customLabel || t(`nav.${item.id}`, item.label);
  const visibleCount = navItems.filter(i => i.visible).length;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[75vh] rounded-t-2xl p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">{t('settings.customizeNavigation', 'Customize Navigation')}</SheetTitle>
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground hover:text-foreground">
              <RotateCcw className="h-4 w-4 mr-1" />
              {t('common.reset', 'Reset')}
            </Button>
          </div>
        </SheetHeader>

        <p className="px-4 py-2 text-sm text-muted-foreground">
          {t('settings.customizeNavigationDesc', 'Toggle visibility (max 5), drag to reorder, tap pencil to rename')}
          <span className="ml-1 font-medium text-foreground">{visibleCount}/{MAX_VISIBLE}</span>
        </p>

        <div className="flex-1 overflow-y-auto px-4">
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="todo-nav-items">
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={cn("space-y-2 pb-4 min-h-[200px]", snapshot.isDraggingOver && "bg-primary/5 rounded-lg")}
                >
                  {navItems.map((item, index) => (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          style={{ ...provided.draggableProps.style, touchAction: 'none' }}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50",
                            "transition-all duration-200 select-none",
                            snapshot.isDragging && "bg-primary/10 border-primary shadow-lg scale-[1.02] z-50",
                            !item.visible && "opacity-50"
                          )}
                        >
                          <div className="touch-none cursor-grab active:cursor-grabbing p-1">
                            <GripVertical className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                          </div>
                          <div className="text-muted-foreground flex-shrink-0">{ICON_MAP[item.icon]}</div>
                          {editingId === item.id ? (
                            <div className="flex-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <Input
                                ref={editInputRef}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                                className="h-8 text-sm"
                                maxLength={20}
                              />
                              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={(e) => { e.stopPropagation(); saveEdit(); }}>
                                <Check className="h-4 w-4 text-primary" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={(e) => { e.stopPropagation(); cancelEdit(); }}>
                                <X className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span className="text-sm font-medium flex-1 truncate">{getDisplayLabel(item)}</span>
                              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={(e) => { e.stopPropagation(); startEditing(item); }}>
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </>
                          )}
                          <Switch
                            checked={item.visible}
                            onCheckedChange={() => toggleVisibility(item.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-shrink-0"
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </SheetContent>
    </Sheet>
  );
};
