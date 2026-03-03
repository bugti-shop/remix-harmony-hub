import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { FloatingImage } from '@/types/note';
import { Trash2, Move } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface FloatingImageLayerHandle {
  triggerAdd: () => void;
}

interface FloatingImageLayerProps {
  images: FloatingImage[];
  onChange: (images: FloatingImage[]) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
}

const HANDLE_SIZE = 10;
const MIN_SIZE = 40;

type HandleType = 'nw' | 'ne' | 'sw' | 'se';

export const FloatingImageLayer = forwardRef<FloatingImageLayerHandle, FloatingImageLayerProps>(({ images, onChange, containerRef }, ref) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; handle: HandleType; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  const handleAddImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  useImperativeHandle(ref, () => ({
    triggerAdd: handleAddImage,
  }), [handleAddImage]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // Scale down to fit within container
        const maxW = 280;
        const maxH = 280;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxW) { h = h * (maxW / w); w = maxW; }
        if (h > maxH) { w = w * (maxH / h); h = maxH; }

        const newImage: FloatingImage = {
          id: `fimg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          src,
          x: 20,
          y: 20,
          width: Math.round(w),
          height: Math.round(h),
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        };
        const updated = [...images, newImage];
        onChange(updated);
        setSelectedId(newImage.id);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [images, onChange]);

  const handleDelete = useCallback((id: string) => {
    onChange(images.filter(img => img.id !== id));
    setSelectedId(null);
  }, [images, onChange]);

  const handlePointerDown = useCallback((e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const img = images.find(i => i.id === id);
    if (!img) return;
    setSelectedId(id);
    setDragging({ id, startX: e.clientX, startY: e.clientY, origX: img.x, origY: img.y });
  }, [images]);

  const handleResizeStart = useCallback((e: React.PointerEvent, id: string, handle: HandleType) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const img = images.find(i => i.id === id);
    if (!img) return;
    setResizing({ id, handle, startX: e.clientX, startY: e.clientY, origX: img.x, origY: img.y, origW: img.width, origH: img.height });
  }, [images]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragging) {
      const dx = e.clientX - dragging.startX;
      const dy = e.clientY - dragging.startY;
      onChange(images.map(img =>
        img.id === dragging.id
          ? { ...img, x: Math.max(0, dragging.origX + dx), y: Math.max(0, dragging.origY + dy) }
          : img
      ));
    }
    if (resizing) {
      const dx = e.clientX - resizing.startX;
      const dy = e.clientY - resizing.startY;
      const aspectRatio = resizing.origW / resizing.origH;

      onChange(images.map(img => {
        if (img.id !== resizing.id) return img;
        let newW = resizing.origW;
        let newH = resizing.origH;
        let newX = resizing.origX;
        let newY = resizing.origY;

        switch (resizing.handle) {
          case 'se':
            newW = Math.max(MIN_SIZE, resizing.origW + dx);
            newH = newW / aspectRatio;
            break;
          case 'sw':
            newW = Math.max(MIN_SIZE, resizing.origW - dx);
            newH = newW / aspectRatio;
            newX = resizing.origX + (resizing.origW - newW);
            break;
          case 'ne':
            newW = Math.max(MIN_SIZE, resizing.origW + dx);
            newH = newW / aspectRatio;
            newY = resizing.origY + (resizing.origH - newH);
            break;
          case 'nw':
            newW = Math.max(MIN_SIZE, resizing.origW - dx);
            newH = newW / aspectRatio;
            newX = resizing.origX + (resizing.origW - newW);
            newY = resizing.origY + (resizing.origH - newH);
            break;
        }

        return { ...img, x: Math.max(0, newX), y: Math.max(0, newY), width: Math.round(newW), height: Math.round(newH) };
      }));
    }
  }, [dragging, resizing, images, onChange]);

  const handlePointerUp = useCallback(() => {
    setDragging(null);
    setResizing(null);
  }, []);

  // Deselect when clicking outside
  const handleLayerClick = useCallback((e: React.MouseEvent) => {
    if (e.target === layerRef.current) {
      setSelectedId(null);
    }
  }, []);

  // Handle keyboard delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedId && (e.key === 'Delete' || e.key === 'Backspace')) {
        // Only if no text input is focused
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).contentEditable === 'true')) return;
        handleDelete(selectedId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, handleDelete]);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Floating images overlay */}
      {images.length > 0 && (
        <div
          ref={layerRef}
          className="absolute inset-0 z-20 pointer-events-none"
          onClick={handleLayerClick}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ touchAction: 'none' }}
        >
          {images.map((img) => {
            const isSelected = selectedId === img.id;
            return (
              <div
                key={img.id}
                className={cn(
                  "absolute pointer-events-auto cursor-move select-none",
                  isSelected && "ring-2 ring-primary ring-offset-1"
                )}
                style={{
                  left: img.x,
                  top: img.y,
                  width: img.width,
                  height: img.height,
                }}
                onPointerDown={(e) => handlePointerDown(e, img.id)}
                onClick={(e) => { e.stopPropagation(); setSelectedId(img.id); }}
              >
                <img
                  src={img.src}
                  alt="Floating"
                  className="w-full h-full object-contain rounded-md"
                  draggable={false}
                />

                {/* Selection UI */}
                {isSelected && (
                  <>
                    {/* Delete button */}
                    <button
                      className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md z-10"
                      onClick={(e) => { e.stopPropagation(); handleDelete(img.id); }}
                      title="Delete image"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>

                    {/* Move indicator */}
                    <div className="absolute top-1 left-1 h-5 w-5 rounded bg-primary/80 text-primary-foreground flex items-center justify-center">
                      <Move className="h-3 w-3" />
                    </div>

                    {/* Resize handles */}
                    {(['nw', 'ne', 'sw', 'se'] as HandleType[]).map((handle) => (
                      <div
                        key={handle}
                        className="absolute bg-primary border-2 border-primary-foreground rounded-sm shadow-sm z-10"
                        style={{
                          width: HANDLE_SIZE,
                          height: HANDLE_SIZE,
                          cursor: handle === 'nw' || handle === 'se' ? 'nwse-resize' : 'nesw-resize',
                          ...(handle.includes('n') ? { top: -HANDLE_SIZE / 2 } : { bottom: -HANDLE_SIZE / 2 }),
                          ...(handle.includes('w') ? { left: -HANDLE_SIZE / 2 } : { right: -HANDLE_SIZE / 2 }),
                        }}
                        onPointerDown={(e) => handleResizeStart(e, img.id, handle)}
                      />
                    ))}

                    {/* Size indicator */}
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-card/90 backdrop-blur-sm text-foreground text-[9px] px-1.5 py-0.5 rounded-md border border-border shadow-sm whitespace-nowrap">
                      {img.width} × {img.height}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
});

FloatingImageLayer.displayName = 'FloatingImageLayer';
