import { useState, useRef, useCallback, useEffect } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

interface UseLongPressDragOptions {
  onDragStart?: (id: string) => void;
  onDragEnd?: (id: string) => void;
  onDragOver?: (id: string) => void;
  longPressDelay?: number;
}

interface DragState {
  isDragging: boolean;
  draggedId: string | null;
  dragOverId: string | null;
  startY: number;
  currentY: number;
}

export function useLongPressDrag(options: UseLongPressDragOptions = {}) {
  const { onDragStart, onDragEnd, onDragOver, longPressDelay = 300 } = options;
  
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedId: null,
    dragOverId: null,
    startY: 0,
    currentY: 0,
  });
  
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback((id: string, e: React.TouchEvent<HTMLElement>) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    hasMovedRef.current = false;
    
    // Prevent text selection on long press
    const target = e.currentTarget as HTMLElement;
    target.style.userSelect = 'none';
    target.style.webkitUserSelect = 'none';
    
    longPressTimerRef.current = setTimeout(async () => {
      if (!hasMovedRef.current) {
        try {
          await Haptics.impact({ style: ImpactStyle.Heavy });
        } catch {}
        
        setDragState({
          isDragging: true,
          draggedId: id,
          dragOverId: null,
          startY: touch.clientY,
          currentY: touch.clientY,
        });
        
        onDragStart?.(id);
      }
    }, longPressDelay);
  }, [longPressDelay, onDragStart]);

  const handleTouchMove = useCallback((id: string, e: React.TouchEvent) => {
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
    
    // If moved more than 10px before long press, cancel
    if (deltaX > 10 || deltaY > 10) {
      hasMovedRef.current = true;
      clearLongPressTimer();
    }
    
    if (dragState.isDragging && dragState.draggedId === id) {
      e.preventDefault();
      setDragState(prev => ({
        ...prev,
        currentY: touch.clientY,
      }));
    }
  }, [dragState.isDragging, dragState.draggedId, clearLongPressTimer]);

  const handleTouchEnd = useCallback((id: string) => {
    clearLongPressTimer();
    
    if (dragState.isDragging && dragState.draggedId === id) {
      onDragEnd?.(id);
      setDragState({
        isDragging: false,
        draggedId: null,
        dragOverId: null,
        startY: 0,
        currentY: 0,
      });
    }
  }, [dragState.isDragging, dragState.draggedId, clearLongPressTimer, onDragEnd]);

  const handleDragOver = useCallback((id: string) => {
    if (dragState.isDragging && dragState.draggedId !== id) {
      if (dragState.dragOverId !== id) {
        setDragState(prev => ({ ...prev, dragOverId: id }));
        onDragOver?.(id);
        try {
          Haptics.impact({ style: ImpactStyle.Heavy });
        } catch {}
      }
    }
  }, [dragState.isDragging, dragState.draggedId, dragState.dragOverId, onDragOver]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, [clearLongPressTimer]);

  const getDragOffset = useCallback(() => {
    if (!dragState.isDragging) return 0;
    return dragState.currentY - dragState.startY;
  }, [dragState]);

  return {
    dragState,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleDragOver,
    getDragOffset,
    isDragging: dragState.isDragging,
    draggedId: dragState.draggedId,
    dragOverId: dragState.dragOverId,
  };
}