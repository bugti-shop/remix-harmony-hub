import { useState, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface ProfileImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

const createCroppedImage = async (
  imageSrc: string,
  pixelCrop: Area
): Promise<string> => {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve) => { image.onload = resolve; });

  const canvas = document.createElement('canvas');
  const size = Math.min(pixelCrop.width, pixelCrop.height);
  canvas.width = 400;
  canvas.height = 400;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    400,
    400
  );

  return canvas.toDataURL('image/jpeg', 0.85);
};

export const ProfileImageCropper = ({ imageSrc, onCropComplete, onCancel }: ProfileImageCropperProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const onCropAreaChange = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setIsSaving(true);
    try {
      const croppedUrl = await createCroppedImage(imageSrc, croppedAreaPixels);
      onCropComplete(croppedUrl);
    } catch (e) {
      console.error('Crop failed:', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-border flex-shrink-0">
          <button onClick={onCancel} className="p-2 -ml-2 rounded-lg hover:bg-muted">
            <X className="h-5 w-5 text-foreground" />
          </button>
          <h2 className="text-sm font-semibold text-foreground">Crop Photo</h2>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg"
          >
            <Check className="h-4 w-4 mr-1" />
            {isSaving ? 'Saving...' : 'Done'}
          </Button>
        </div>

        {/* Crop area */}
        <div className="flex-1 relative bg-muted/80">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropAreaChange}
          />
        </div>

        {/* Controls */}
        <div className="p-4 pb-6 space-y-4 flex-shrink-0 border-t border-border bg-background">
          {/* Zoom */}
          <div className="flex items-center gap-3">
            <ZoomOut className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.05}
              onValueChange={(v) => setZoom(v[0])}
              className="flex-1"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </div>

          {/* Rotate */}
          <div className="flex justify-center">
            <button
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground px-3 py-2 rounded-lg hover:bg-muted transition-colors"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Rotate
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
