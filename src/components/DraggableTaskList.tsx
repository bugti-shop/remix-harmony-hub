import { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react';
import { TodoItem } from '@/types/note';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { cn } from '@/lib/utils';
import { throttleRAF, DragAnimator } from '@/utils/performanceOptimizer';

interface DraggableTaskListProps {
  items: TodoItem[];
  onReorder: (reorderedItems: TodoItem[]) => void;
  renderItem: (item: TodoItem, isDragging: boolean, isDropTarget: boolean) => React.ReactNode;
  className?: string;
}

const LONG_PRESS_DELAY = 250;
const ITEM_HEIGHT = 60;

// Memoized task item to prevent unnecessary re-renders
const MemoizedTaskItem = memo(({ 
  item, 
  index,
  isDragging, 
  isDropTarget,
  displacement,
  dragTranslateY,
  onTouchStart,
  setRef,
  renderItem 
}: {
  item: TodoItem;
  index: number;
  isDragging: boolean;
  isDropTarget: boolean;
  displacement: number;
  dragTranslateY: number;
  onTouchStart: (item: TodoItem, index: number, e: React.TouchEvent) => void;
  setRef: (id: string, ref: HTMLDivElement | null) => void;
  renderItem: (item: TodoItem, isDragging: boolean, isDropTarget: boolean) => React.ReactNode;
}) => {
  const translateY = isDragging ? dragTranslateY : displacement;
  
  return (
    <div
      ref={(ref) => setRef(item.id, ref)}
      className={cn(
        "relative will-change-transform",
        isDragging && "opacity-95 shadow-xl rounded-lg z-50",
        isDropTarget && "before:absolute before:inset-x-0 before:-top-1 before:h-1.5 before:bg-primary before:rounded-full"
      )}
      style={{
        transform: `translateY(${translateY}px) scale(${isDragging ? 1.02 : 1})`,
        transition: isDragging ? 'none' : 'transform 0.15s ease-out',
        zIndex: isDragging ? 50 : 1,
      }}
      onTouchStart={(e) => onTouchStart(item, index, e)}
    >
      {renderItem(item, isDragging, isDropTarget)}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.isDropTarget === nextProps.isDropTarget &&
    prevProps.displacement === nextProps.displacement &&
    prevProps.dragTranslateY === nextProps.dragTranslateY
  );
});

MemoizedTaskItem.displayName = 'MemoizedTaskItem';

export const DraggableTaskList = ({ 
  items, 
  onReorder, 
  renderItem,
  className 
}: DraggableTaskListProps) => {
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    draggedId: string | null;
    draggedIndex: number | null;
    dropTargetIndex: number | null;
    translateY: number;
    startY: number;
  }>({
    isDragging: false,
    draggedId: null,
    draggedIndex: null,
    dropTargetIndex: null,
    translateY: 0,
    startY: 0,
  });

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const dragAnimatorRef = useRef<DragAnimator | null>(null);
  const lastHapticIndex = useRef<number | null>(null);

  // Initialize drag animator
  useEffect(() => {
    dragAnimatorRef.current = new DragAnimator((y) => {
      setDragState(prev => prev.isDragging ? { ...prev, translateY: y } : prev);
    });
    
    return () => {
      dragAnimatorRef.current?.stop();
    };
  }, []);

  // Memoize item positions for faster lookups
  const itemPositions = useMemo(() => {
    const positions = new Map<string, { top: number; height: number; index: number }>();
    items.forEach((item, index) => {
      positions.set(item.id, {
        top: index * ITEM_HEIGHT,
        height: ITEM_HEIGHT,
        index,
      });
    });
    return positions;
  }, [items]);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback((item: TodoItem, index: number, e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    hasMovedRef.current = false;

    longPressTimerRef.current = setTimeout(async () => {
      if (!hasMovedRef.current) {
        try {
          await Haptics.impact({ style: ImpactStyle.Medium });
        } catch {}

        setDragState({
          isDragging: true,
          draggedId: item.id,
          draggedIndex: index,
          dropTargetIndex: index,
          translateY: 0,
          startY: touch.clientY,
        });
        
        dragAnimatorRef.current?.setImmediate(0);
        lastHapticIndex.current = index;
      }
    }, LONG_PRESS_DELAY);
  }, []);

  // Throttled touch move handler using RAF
  const handleTouchMoveThrottled = useMemo(() => throttleRAF((
    touch: { clientX: number; clientY: number },
    currentDragState: typeof dragState
  ) => {
    if (!currentDragState.isDragging || currentDragState.draggedIndex === null) return;

    const translateY = touch.clientY - currentDragState.startY;
    
    // Use animator for smooth updates
    dragAnimatorRef.current?.setTarget(translateY);

    // Calculate drop target based on position
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const relativeY = touch.clientY - containerRect.top + (containerRef.current?.scrollTop || 0);
    let newDropTargetIndex = Math.floor(relativeY / ITEM_HEIGHT);
    newDropTargetIndex = Math.max(0, Math.min(items.length - 1, newDropTargetIndex));

    // Haptic feedback when crossing item boundaries
    if (newDropTargetIndex !== lastHapticIndex.current) {
      lastHapticIndex.current = newDropTargetIndex;
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    }

    if (newDropTargetIndex !== currentDragState.dropTargetIndex) {
      setDragState(prev => ({
        ...prev,
        dropTargetIndex: newDropTargetIndex,
      }));
    }
  }), [items.length]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

    // If moved more than 10px before long press, cancel
    if (!dragState.isDragging && (deltaX > 10 || deltaY > 10)) {
      hasMovedRef.current = true;
      clearLongPressTimer();
      return;
    }

    if (dragState.isDragging) {
      e.preventDefault();
      e.stopPropagation();
      handleTouchMoveThrottled(
        { clientX: touch.clientX, clientY: touch.clientY },
        dragState
      );
    }
  }, [dragState, clearLongPressTimer, handleTouchMoveThrottled]);

  const handleTouchEnd = useCallback(() => {
    clearLongPressTimer();
    dragAnimatorRef.current?.stop();

    if (dragState.isDragging && dragState.draggedIndex !== null && dragState.dropTargetIndex !== null) {
      const fromIndex = dragState.draggedIndex;
      let toIndex = dragState.dropTargetIndex;
      
      if (fromIndex !== toIndex) {
        // Adjust toIndex if moving downward
        if (toIndex > fromIndex) {
          toIndex = toIndex;
        }
        
        const newItems = [...items];
        const [movedItem] = newItems.splice(fromIndex, 1);
        newItems.splice(toIndex, 0, movedItem);
        
        Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
        
        // Use requestAnimationFrame for smooth update
        requestAnimationFrame(() => {
          onReorder(newItems);
        });
      }
    }

    setDragState({
      isDragging: false,
      draggedId: null,
      draggedIndex: null,
      dropTargetIndex: null,
      translateY: 0,
      startY: 0,
    });
    lastHapticIndex.current = null;
  }, [dragState, items, onReorder, clearLongPressTimer]);

  const handleTouchCancel = useCallback(() => {
    clearLongPressTimer();
    dragAnimatorRef.current?.stop();
    setDragState({
      isDragging: false,
      draggedId: null,
      draggedIndex: null,
      dropTargetIndex: null,
      translateY: 0,
      startY: 0,
    });
    lastHapticIndex.current = null;
  }, [clearLongPressTimer]);

  // Prevent context menu on long press
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventContextMenu = (e: Event) => {
      if (dragState.isDragging) {
        e.preventDefault();
      }
    };

    container.addEventListener('contextmenu', preventContextMenu, { passive: false });
    return () => {
      container.removeEventListener('contextmenu', preventContextMenu);
    };
  }, [dragState.isDragging]);

  const setItemRef = useCallback((id: string, ref: HTMLDivElement | null) => {
    if (ref) {
      itemRefs.current.set(id, ref);
    } else {
      itemRefs.current.delete(id);
    }
  }, []);

  // Calculate visual displacement for non-dragged items
  const getItemDisplacement = useCallback((index: number) => {
    if (!dragState.isDragging || dragState.draggedIndex === null || dragState.dropTargetIndex === null) {
      return 0;
    }
    
    const draggedIdx = dragState.draggedIndex;
    const dropIdx = dragState.dropTargetIndex;
    
    if (index === draggedIdx) return 0;
    
    // Calculate which items need to shift
    if (draggedIdx < dropIdx) {
      if (index > draggedIdx && index <= dropIdx) {
        return -ITEM_HEIGHT;
      }
    } else if (draggedIdx > dropIdx) {
      if (index >= dropIdx && index < draggedIdx) {
        return ITEM_HEIGHT;
      }
    }
    
    return 0;
  }, [dragState]);

  return (
    <div 
      ref={containerRef}
      className={cn("relative", className)}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      style={{ 
        touchAction: dragState.isDragging ? 'none' : 'auto',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        contain: 'layout style',
      }}
    >
      {items.map((item, index) => {
        const isDragging = dragState.draggedId === item.id;
        const isDropTarget = !isDragging && 
          dragState.isDragging && 
          dragState.dropTargetIndex !== null &&
          index === dragState.dropTargetIndex;
        
        const displacement = getItemDisplacement(index);
        
        return (
          <MemoizedTaskItem
            key={item.id}
            item={item}
            index={index}
            isDragging={isDragging}
            isDropTarget={isDropTarget}
            displacement={displacement}
            dragTranslateY={isDragging ? dragState.translateY : 0}
            onTouchStart={handleTouchStart}
            setRef={setItemRef}
            renderItem={renderItem}
          />
        );
      })}
    </div>
  );
};
