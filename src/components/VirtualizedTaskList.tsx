// Virtualized Task List for handling 700+ tasks efficiently
// Uses @tanstack/react-virtual for windowed rendering

import { useRef, useCallback, useMemo, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TodoItem, TaskSection } from '@/types/note';
import { cn } from '@/lib/utils';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

interface VirtualizedTaskListProps {
  items: TodoItem[];
  sections: TaskSection[];
  expandedTasks: Set<string>;
  onReorder: (updatedItems: TodoItem[]) => void;
  renderTask: (item: TodoItem, index: number) => React.ReactNode;
  renderSectionHeader: (section: TaskSection) => React.ReactNode;
  estimateSize?: number;
  className?: string;
  compactMode?: boolean;
}

interface FlattenedItem {
  type: 'section' | 'task' | 'subtask';
  id: string;
  data: TodoItem | TaskSection;
  parentId?: string;
  sectionId?: string;
}

const LONG_PRESS_DELAY = 200;

export const VirtualizedTaskList = ({
  items,
  sections,
  expandedTasks,
  onReorder,
  renderTask,
  renderSectionHeader,
  estimateSize = 72,
  className,
  compactMode = false,
}: VirtualizedTaskListProps) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    draggedId: string | null;
    draggedIndex: number | null;
    currentY: number;
    startY: number;
  } | null>(null);
  
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; index: number } | null>(null);

  // Flatten sections and tasks for virtualization
  const flattenedItems = useMemo((): FlattenedItem[] => {
    const result: FlattenedItem[] = [];
    const sortedSections = [...sections].sort((a, b) => a.order - b.order);
    
    sortedSections.forEach(section => {
      // Add section header
      result.push({
        type: 'section',
        id: `section-${section.id}`,
        data: section,
        sectionId: section.id,
      });
      
      // Add tasks in this section
      const sectionTasks = items.filter(
        item => !item.completed && (item.sectionId === section.id || (!item.sectionId && section.id === sections[0]?.id))
      );
      
      sectionTasks.forEach(task => {
        result.push({
          type: 'task',
          id: task.id,
          data: task,
          sectionId: section.id,
        });
        
        // Add expanded subtasks
        if (expandedTasks.has(task.id) && task.subtasks && task.subtasks.length > 0) {
          task.subtasks.forEach(subtask => {
            result.push({
              type: 'subtask',
              id: subtask.id,
              data: subtask,
              parentId: task.id,
              sectionId: section.id,
            });
          });
        }
      });
    });
    
    return result;
  }, [items, sections, expandedTasks]);

  // Estimate row height based on item type and compact mode
  const estimateItemSize = useCallback((index: number) => {
    const item = flattenedItems[index];
    if (!item) return estimateSize;
    
    if (item.type === 'section') {
      return compactMode ? 40 : 48;
    }
    if (item.type === 'subtask') {
      return compactMode ? 32 : 40;
    }
    return compactMode ? 56 : estimateSize;
  }, [flattenedItems, estimateSize, compactMode]);

  const virtualizer = useVirtualizer({
    count: flattenedItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: estimateItemSize,
    overscan: 10, // Render 10 extra items for smoother scrolling
    getItemKey: (index) => flattenedItems[index]?.id || index.toString(),
  });

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback((index: number, e: React.TouchEvent) => {
    const item = flattenedItems[index];
    if (!item || item.type === 'section') return;
    
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, index };
    
    longPressTimerRef.current = setTimeout(async () => {
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch {}
      
      setDragState({
        isDragging: true,
        draggedId: item.id,
        draggedIndex: index,
        currentY: touch.clientY,
        startY: touch.clientY,
      });
    }, LONG_PRESS_DELAY);
  }, [flattenedItems]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    
    if (touchStartRef.current && !dragState?.isDragging) {
      const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
      
      if (deltaX > 10 || deltaY > 10) {
        clearLongPressTimer();
        touchStartRef.current = null;
        return;
      }
    }
    
    if (dragState?.isDragging) {
      e.preventDefault();
      setDragState(prev => prev ? { ...prev, currentY: touch.clientY } : null);
    }
  }, [dragState, clearLongPressTimer]);

  const handleTouchEnd = useCallback(() => {
    clearLongPressTimer();
    
    if (dragState?.isDragging && dragState.draggedIndex !== null) {
      // Calculate drop position based on current Y
      const virtualItems = virtualizer.getVirtualItems();
      let dropIndex = dragState.draggedIndex;
      
      for (const vItem of virtualItems) {
        const itemTop = vItem.start;
        const itemBottom = vItem.start + vItem.size;
        const relativeDragY = dragState.currentY - (parentRef.current?.getBoundingClientRect().top || 0) + (parentRef.current?.scrollTop || 0);
        
        if (relativeDragY >= itemTop && relativeDragY <= itemBottom) {
          dropIndex = vItem.index;
          break;
        }
      }
      
      if (dropIndex !== dragState.draggedIndex) {
        // Reorder items
        const fromItem = flattenedItems[dragState.draggedIndex];
        const toItem = flattenedItems[dropIndex];
        
        if (fromItem?.type === 'task' && toItem?.type === 'task' && fromItem.data && toItem.data) {
          const newItems = [...items];
          const fromIdx = newItems.findIndex(i => i.id === fromItem.id);
          const toIdx = newItems.findIndex(i => i.id === toItem.id);
          
          if (fromIdx !== -1 && toIdx !== -1) {
            const [moved] = newItems.splice(fromIdx, 1);
            newItems.splice(toIdx, 0, moved);
            
            Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
            onReorder(newItems);
          }
        }
      }
    }
    
    setDragState(null);
    touchStartRef.current = null;
  }, [dragState, virtualizer, flattenedItems, items, onReorder, clearLongPressTimer]);

  return (
    <div
      ref={parentRef}
      className={cn("h-full overflow-auto", className)}
      style={{ contain: 'strict' }}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        clearLongPressTimer();
        setDragState(null);
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = flattenedItems[virtualRow.index];
          if (!item) return null;
          
          const isDragging = dragState?.draggedId === item.id;
          const translateY = isDragging ? dragState.currentY - dragState.startY : 0;
          
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start + translateY}px)`,
                zIndex: isDragging ? 50 : 1,
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
              }}
              className={cn(isDragging && "opacity-90 shadow-xl rounded-lg")}
              onTouchStart={(e) => handleTouchStart(virtualRow.index, e)}
            >
              {item.type === 'section' ? (
                renderSectionHeader(item.data as TaskSection)
              ) : item.type === 'task' ? (
                renderTask(item.data as TodoItem, virtualRow.index)
              ) : (
                // Subtask rendering (simplified)
                <div className={cn("ml-8 border-l-2 border-border/30 pl-2", compactMode && "ml-6")}>
                  {renderTask(item.data as TodoItem, virtualRow.index)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Simple wrapper for non-virtualized small lists (< 50 items)
export const shouldUseVirtualization = (itemCount: number): boolean => {
  return itemCount > 50;
};
