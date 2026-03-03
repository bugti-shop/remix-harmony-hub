import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical, RotateCcw, Settings2 } from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import { Switch } from '@/components/ui/switch';

export type ToolbarItemId = 
  | 'bold' | 'italic' | 'underline' | 'strikethrough' | 'subscript' | 'superscript' 
  | 'clearFormatting' | 'codeBlock' | 'horizontalRule' | 'blockquote' | 'emoji'
  | 'bulletList' | 'numberedList' | 'checklist' | 'image' | 'table' | 'highlight' | 'textColor'
  | 'undo' | 'redo' | 'alignLeft' | 'alignCenter' | 'alignRight' | 'alignJustify'
  | 'fontFamily' | 'fontSize' | 'headings' | 'textCase' | 'textDirection'
  | 'comment' | 'link' | 'noteLink' | 'attachment' | 'zoom';

const TOOLBAR_ORDER_KEY = 'wordToolbarOrder';
const TOOLBAR_VISIBILITY_KEY = 'wordToolbarVisibility';

export const DEFAULT_TOOLBAR_ORDER: ToolbarItemId[] = [
  'bold', 'italic', 'underline', 'fontFamily', 'fontSize', 'highlight', 'textColor',
  'image', 'table', 'bulletList', 'numberedList', 'checklist',
  'strikethrough', 'subscript', 'superscript',
  'clearFormatting', 'codeBlock', 'horizontalRule', 'blockquote', 'emoji',
  'undo', 'redo', 'alignLeft', 'alignCenter', 'alignRight', 'alignJustify',
  'headings', 'textCase', 'textDirection',
  'comment', 'link', 'noteLink', 'attachment', 'zoom'
];

const TOOLBAR_ITEM_LABELS: Record<ToolbarItemId, string> = {
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  strikethrough: 'Strikethrough',
  subscript: 'Subscript',
  superscript: 'Superscript',
  clearFormatting: 'Clear Formatting',
  codeBlock: 'Code Block',
  horizontalRule: 'Horizontal Rule',
  blockquote: 'Blockquote',
  emoji: 'Emoji Picker',
  bulletList: 'Bullet List',
  numberedList: 'Numbered List',
  checklist: 'Checklist',
  image: 'Insert Image',
  table: 'Insert Table',
  highlight: 'Highlight',
  textColor: 'Text Color',
  undo: 'Undo',
  redo: 'Redo',
  alignLeft: 'Align Left',
  alignCenter: 'Align Center',
  alignRight: 'Align Right',
  alignJustify: 'Justify',
  fontFamily: 'Font Family',
  fontSize: 'Font Size',
  headings: 'Headings',
  textCase: 'Text Case',
  textDirection: 'Text Direction',
  comment: 'Comment',
  link: 'Insert Link',
  noteLink: 'Link to Note',
  attachment: 'Attachment',
  zoom: 'Zoom Controls',
};

// Default all items visible
const DEFAULT_VISIBILITY: Record<ToolbarItemId, boolean> = DEFAULT_TOOLBAR_ORDER.reduce(
  (acc, id) => ({ ...acc, [id]: true }), 
  {} as Record<ToolbarItemId, boolean>
);

export const getToolbarOrder = async (): Promise<ToolbarItemId[]> => {
  try {
    const saved = await getSetting<ToolbarItemId[] | null>(TOOLBAR_ORDER_KEY, null);
    if (saved) {
      // Merge with defaults to include any new items
      const existing = new Set(saved);
      const merged = [...saved];
      DEFAULT_TOOLBAR_ORDER.forEach(item => {
        if (!existing.has(item)) merged.push(item);
      });
      return merged;
    }
  } catch {}
  return [...DEFAULT_TOOLBAR_ORDER];
};

export const saveToolbarOrder = async (order: ToolbarItemId[]) => {
  await setSetting(TOOLBAR_ORDER_KEY, order);
};

export const getToolbarVisibility = async (): Promise<Record<ToolbarItemId, boolean>> => {
  try {
    const saved = await getSetting<Record<ToolbarItemId, boolean> | null>(TOOLBAR_VISIBILITY_KEY, null);
    if (saved) {
      // Merge with defaults to include any new items
      return { ...DEFAULT_VISIBILITY, ...saved };
    }
  } catch {}
  return { ...DEFAULT_VISIBILITY };
};

export const saveToolbarVisibility = async (visibility: Record<ToolbarItemId, boolean>) => {
  await setSetting(TOOLBAR_VISIBILITY_KEY, visibility);
};

interface ToolbarOrderManagerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderChange: (order: ToolbarItemId[]) => void;
  onVisibilityChange: (visibility: Record<ToolbarItemId, boolean>) => void;
  currentOrder: ToolbarItemId[];
  currentVisibility: Record<ToolbarItemId, boolean>;
}

export const ToolbarOrderManager = ({
  isOpen,
  onOpenChange,
  onOrderChange,
  onVisibilityChange,
  currentOrder,
  currentVisibility,
}: ToolbarOrderManagerProps) => {
  const { t } = useTranslation();
  const [localOrder, setLocalOrder] = useState<ToolbarItemId[]>(currentOrder);
  const [localVisibility, setLocalVisibility] = useState<Record<ToolbarItemId, boolean>>(currentVisibility);

  useHardwareBackButton({
    onBack: () => {
      onOpenChange(false);
    },
    enabled: isOpen,
    priority: 'sheet',
  });

  useEffect(() => {
    setLocalOrder(currentOrder);
    setLocalVisibility(currentVisibility);
  }, [currentOrder, currentVisibility]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;

    if (sourceIndex === destIndex) return;

    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {}

    const newOrder = [...localOrder];
    const [removed] = newOrder.splice(sourceIndex, 1);
    newOrder.splice(destIndex, 0, removed);

    setLocalOrder(newOrder);
    saveToolbarOrder(newOrder);
    onOrderChange(newOrder);
    // Dispatch event to sync order with WordToolbar
    window.dispatchEvent(new CustomEvent('toolbarOrderChanged', { detail: { order: newOrder } }));
    toast.success(t('toolbarManager.orderUpdated'));
  };

  const handleVisibilityToggle = async (itemId: ToolbarItemId) => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}

    const newVisibility = {
      ...localVisibility,
      [itemId]: !localVisibility[itemId],
    };

    setLocalVisibility(newVisibility);
    saveToolbarVisibility(newVisibility);
    onVisibilityChange(newVisibility);
    
    toast.success(
      newVisibility[itemId] 
        ? t('toolbarManager.itemShown', { item: TOOLBAR_ITEM_LABELS[itemId] })
        : t('toolbarManager.itemHidden', { item: TOOLBAR_ITEM_LABELS[itemId] })
    );
  };

  const handleReset = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
    setLocalOrder([...DEFAULT_TOOLBAR_ORDER]);
    setLocalVisibility({ ...DEFAULT_VISIBILITY });
    saveToolbarOrder(DEFAULT_TOOLBAR_ORDER);
    saveToolbarVisibility(DEFAULT_VISIBILITY);
    onOrderChange([...DEFAULT_TOOLBAR_ORDER]);
    onVisibilityChange({ ...DEFAULT_VISIBILITY });
    toast.success(t('toolbarManager.resetToDefaults'));
  };

  const visibleCount = Object.values(localVisibility).filter(Boolean).length;
  const totalCount = Object.keys(localVisibility).length;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl flex flex-col overflow-hidden">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              {t('toolbarManager.customizeToolbar')}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              {t('toolbarManager.reset')}
            </Button>
          </SheetTitle>
        </SheetHeader>

        <p className="text-sm text-muted-foreground mb-2">
          {t('toolbarManager.dragToReorder', { visible: visibleCount, total: totalCount })}
        </p>

        <div className="flex-1 overflow-y-auto">
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="toolbar-items">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-1 pb-4"
                >
                  {localOrder.map((itemId, index) => (
                    <Draggable key={itemId} draggableId={itemId} index={index}>
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
                            "flex items-center gap-3 p-3 rounded-lg border border-border/50 select-none",
                            "transition-all duration-200",
                            localVisibility[itemId] ? "bg-muted/50" : "bg-muted/20 opacity-60",
                            snapshot.isDragging && "bg-primary/10 border-primary shadow-lg scale-[1.02]"
                          )}
                        >
                          <div className="touch-none cursor-grab active:cursor-grabbing p-1">
                            <GripVertical className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                          </div>
                          <span className={cn(
                            "text-sm font-medium flex-1",
                            !localVisibility[itemId] && "text-muted-foreground"
                          )}>
                            {TOOLBAR_ITEM_LABELS[itemId]}
                          </span>
                          <Switch
                            checked={localVisibility[itemId]}
                            onCheckedChange={() => handleVisibilityToggle(itemId)}
                            onClick={(e) => e.stopPropagation()}
                            className="scale-90"
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

// Custom hook for managing toolbar order and visibility
export const useToolbarOrder = () => {
  const [order, setOrder] = useState<ToolbarItemId[]>(DEFAULT_TOOLBAR_ORDER);
  const [visibility, setVisibility] = useState<Record<ToolbarItemId, boolean>>(DEFAULT_VISIBILITY);
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  useEffect(() => {
    Promise.all([getToolbarOrder(), getToolbarVisibility()]).then(([savedOrder, savedVisibility]) => {
      setOrder(savedOrder);
      setVisibility(savedVisibility);
      // Dispatch event to sync visibility with WordToolbar
      window.dispatchEvent(new CustomEvent('toolbarVisibilityChanged', { detail: { visibility: savedVisibility } }));
    });
  }, []);

  const updateOrder = (newOrder: ToolbarItemId[]) => {
    setOrder(newOrder);
  };

  const updateVisibility = (newVisibility: Record<ToolbarItemId, boolean>) => {
    setVisibility(newVisibility);
    // Dispatch event to sync visibility with WordToolbar
    window.dispatchEvent(new CustomEvent('toolbarVisibilityChanged', { detail: { visibility: newVisibility } }));
  };

  // Get only visible items in order
  const visibleOrder = order.filter(id => visibility[id]);

  return {
    order,
    visibility,
    visibleOrder,
    updateOrder,
    updateVisibility,
    isManagerOpen,
    setIsManagerOpen,
    openManager: () => setIsManagerOpen(true),
  };
};
