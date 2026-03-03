import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Move, Maximize2 } from 'lucide-react';

interface ResizableImageProps {
  src: string;
  alt?: string;
  initialWidth?: number;
  initialPosition?: { x: number; y: number };
  onUpdate?: (width: number, position: { x: number; y: number }) => void;
  className?: string;
}

export const ResizableImage = ({
  src,
  alt = 'Image',
  initialWidth = 300,
  initialPosition = { x: 0, y: 0 },
  onUpdate,
  className,
}: ResizableImageProps) => {
  const [width, setWidth] = useState(initialWidth);
  const [position, setPosition] = useState(initialPosition);
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);
  const startRef = useRef({ x: 0, y: 0, width: 0, posX: 0, posY: 0 });

  // Handle resize
  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    startRef.current = {
      x: clientX,
      y: clientY,
      width,
      posX: position.x,
      posY: position.y,
    };
  }, [width, position]);

  const handleResizeMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isResizing) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const deltaX = clientX - startRef.current.x;
    const newWidth = Math.max(50, Math.min(800, startRef.current.width + deltaX));
    
    setWidth(newWidth);
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
      onUpdate?.(width, position);
    }
  }, [isResizing, width, position, onUpdate]);

  // Handle drag
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    startRef.current = {
      x: clientX,
      y: clientY,
      width,
      posX: position.x,
      posY: position.y,
    };
  }, [width, position]);

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const deltaX = clientX - startRef.current.x;
    const deltaY = clientY - startRef.current.y;
    
    setPosition({
      x: startRef.current.posX + deltaX,
      y: startRef.current.posY + deltaY,
    });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      onUpdate?.(width, position);
    }
  }, [isDragging, width, position, onUpdate]);

  // Add/remove event listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      document.addEventListener('touchmove', handleResizeMove);
      document.addEventListener('touchend', handleResizeEnd);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.removeEventListener('touchmove', handleResizeMove);
      document.removeEventListener('touchend', handleResizeEnd);
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.addEventListener('touchmove', handleDragMove);
      document.addEventListener('touchend', handleDragEnd);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleDragMove);
      document.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Click outside to deselect
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (imageRef.current && !imageRef.current.contains(e.target as Node)) {
        setIsSelected(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      ref={imageRef}
      className={cn(
        "relative inline-block my-2 select-none",
        isSelected && "ring-2 ring-primary ring-offset-2",
        (isDragging || isResizing) && "z-50",
        className
      )}
      style={{
        width: `${width}px`,
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
      onClick={() => setIsSelected(true)}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-auto rounded-lg"
        draggable={false}
      />
      
      {isSelected && (
        <>
          {/* Move handle */}
          <div
            className="absolute -top-3 -left-3 w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing shadow-lg"
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
          >
            <Move className="h-4 w-4" />
          </div>
          
          {/* Resize handle */}
          <div
            className="absolute -bottom-3 -right-3 w-7 h-7 bg-primary text-primary-foreground rounded-full flex items-center justify-center cursor-se-resize shadow-lg"
            onMouseDown={handleResizeStart}
            onTouchStart={handleResizeStart}
          >
            <Maximize2 className="h-4 w-4" />
          </div>
          
          {/* Size indicator */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-background/90 text-foreground text-xs px-2 py-1 rounded shadow">
            {Math.round(width)}px
          </div>
        </>
      )}
    </div>
  );
};
