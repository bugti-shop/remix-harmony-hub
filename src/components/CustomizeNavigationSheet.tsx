import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical, RotateCcw, Home, FileText, Calendar, Settings, User, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import { toast } from 'sonner';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export interface NavItem {
  id: string;
  label: string;
  customLabel?: string; // User-defined custom label
  icon: string;
  path: string;
  visible: boolean;
}

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: 'Home', path: '/', visible: true },
  { id: 'notes', label: 'Notes', icon: 'FileText', path: '/notes', visible: true },
  { id: 'profile', label: 'Profile', icon: 'User', path: '/profile', visible: true },
  { id: 'calendar', label: 'Calendar', icon: 'Calendar', path: '/calendar', visible: true },
  { id: 'settings', label: 'Settings', icon: 'Settings', path: '/settings', visible: true },
];

const ICON_MAP: Record<string, React.ReactNode> = {
  Home: <Home className="h-5 w-5" />,
  FileText: <FileText className="h-5 w-5" />,
  Calendar: <Calendar className="h-5 w-5" />,
  Settings: <Settings className="h-5 w-5" />,
  User: <User className="h-5 w-5" />,
};

interface CustomizeNavigationSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomizeNavigationSheet = ({ isOpen, onClose }: CustomizeNavigationSheetProps) => {
  const { t } = useTranslation();
  const [navItems, setNavItems] = useState<NavItem[]>(DEFAULT_NAV_ITEMS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  useEffect(() => {
    if (isOpen) {
      loadNavItems();
    }
  }, [isOpen]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const loadNavItems = async () => {
    try {
      const saved = await getSetting<NavItem[] | null>('customNavItems', null);
      if (saved && saved.length > 0) {
        // Merge with defaults to include any new items and ensure paths are set
        const savedMap = new Map(saved.map(item => [item.id, item]));
        const merged = DEFAULT_NAV_ITEMS.map(defaultItem => {
          const savedItem = savedMap.get(defaultItem.id);
          if (savedItem) {
            return {
              ...defaultItem,
              ...savedItem,
              path: defaultItem.path, // Always use default path
            };
          }
          return defaultItem;
        });
        // Reorder based on saved order
        const orderedMerged = saved
          .map(s => merged.find(m => m.id === s.id))
          .filter(Boolean) as NavItem[];
        // Add any new items not in saved
        merged.forEach(item => {
          if (!orderedMerged.find(o => o.id === item.id)) {
            orderedMerged.push(item);
          }
        });
        setNavItems(orderedMerged);
      } else {
        setNavItems(DEFAULT_NAV_ITEMS);
      }
    } catch (error) {
      console.error('Error loading nav items:', error);
      setNavItems(DEFAULT_NAV_ITEMS);
    }
  };

  const saveNavItems = async (items: NavItem[]) => {
    setNavItems(items);
    await setSetting('customNavItems', items);
    // Dispatch event to notify BottomNavigation
    window.dispatchEvent(new CustomEvent('navItemsChanged'));
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;

    if (sourceIndex === destIndex) return;

    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {}

    const newItems = Array.from(navItems);
    const [removed] = newItems.splice(sourceIndex, 1);
    newItems.splice(destIndex, 0, removed);

    await saveNavItems(newItems);
    toast.success(t('settings.navigationOrderUpdated', 'Navigation order updated'));
  };

  const toggleVisibility = async (id: string) => {
    // Ensure at least 2 items remain visible
    const visibleCount = navItems.filter(item => item.visible).length;
    const item = navItems.find(i => i.id === id);
    
    if (item?.visible && visibleCount <= 2) {
      toast.error(t('settings.minNavItems', 'At least 2 navigation items must be visible'));
      return;
    }

    const newItems = navItems.map(item => 
      item.id === id ? { ...item, visible: !item.visible } : item
    );
    await saveNavItems(newItems);
  };

  const startEditing = (item: NavItem) => {
    setEditingId(item.id);
    setEditValue(item.customLabel || item.label);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    
    const trimmedValue = editValue.trim();
    if (!trimmedValue) {
      cancelEdit();
      return;
    }

    const newItems = navItems.map(item => 
      item.id === editingId 
        ? { ...item, customLabel: trimmedValue === item.label ? undefined : trimmedValue }
        : item
    );
    await saveNavItems(newItems);
    setEditingId(null);
    setEditValue('');
    toast.success(t('settings.navigationNameUpdated', 'Navigation name updated'));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleReset = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
    await saveNavItems([...DEFAULT_NAV_ITEMS]);
    toast.success(t('settings.navigationReset', 'Navigation reset to default'));
  };

  const getDisplayLabel = (item: NavItem) => {
    return item.customLabel || t(`nav.${item.id}`, item.label);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[75vh] rounded-t-2xl p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">{t('settings.customizeNavigation', 'Customize Navigation')}</SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              {t('common.reset', 'Reset')}
            </Button>
          </div>
        </SheetHeader>

        <p className="px-4 py-2 text-sm text-muted-foreground">
          {t('settings.customizeNavigationDesc', 'Drag to reorder, toggle visibility, and tap pencil to rename')}
        </p>

        <div className="flex-1 overflow-y-auto px-4">
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="nav-items">
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={cn(
                    "space-y-2 pb-4 min-h-[200px]",
                    snapshot.isDraggingOver && "bg-primary/5 rounded-lg"
                  )}
                >
                  {navItems.map((item, index) => (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          style={{
                            ...provided.draggableProps.style,
                            touchAction: 'none',
                          }}
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
                          
                          <div className="text-muted-foreground flex-shrink-0">
                            {ICON_MAP[item.icon]}
                          </div>
                          
                          {editingId === item.id ? (
                            <div className="flex-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <Input
                                ref={editInputRef}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEdit();
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                                className="h-8 text-sm"
                                maxLength={20}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 flex-shrink-0"
                                onClick={(e) => { e.stopPropagation(); saveEdit(); }}
                              >
                                <Check className="h-4 w-4 text-primary" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 flex-shrink-0"
                                onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                              >
                                <X className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span className="text-sm font-medium flex-1 truncate">
                                {getDisplayLabel(item)}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 flex-shrink-0"
                                onClick={(e) => { e.stopPropagation(); startEditing(item); }}
                              >
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

// Hook to access nav items - returns visible items in custom order
export const useCustomNavigation = () => {
  const [navItems, setNavItems] = useState<NavItem[]>(DEFAULT_NAV_ITEMS);

  useEffect(() => {
    const loadItems = async () => {
      const saved = await getSetting<NavItem[] | null>('customNavItems', null);
      if (saved && saved.length > 0) {
        // Merge with defaults to ensure paths are correct
        const savedMap = new Map(saved.map(item => [item.id, item]));
        const merged = DEFAULT_NAV_ITEMS.map(defaultItem => {
          const savedItem = savedMap.get(defaultItem.id);
          if (savedItem) {
            return {
              ...defaultItem,
              ...savedItem,
              path: defaultItem.path,
            };
          }
          return defaultItem;
        });
        // Reorder based on saved order
        const orderedMerged = saved
          .map(s => merged.find(m => m.id === s.id))
          .filter(Boolean) as NavItem[];
        merged.forEach(item => {
          if (!orderedMerged.find(o => o.id === item.id)) {
            orderedMerged.push(item);
          }
        });
        setNavItems(orderedMerged);
      }
    };
    
    loadItems();

    // Listen for changes
    const handleChange = () => loadItems();
    window.addEventListener('navItemsChanged', handleChange);
    return () => window.removeEventListener('navItemsChanged', handleChange);
  }, []);

  return navItems.filter(item => item.visible);
};
