import { useResolvedTaskMedia } from '@/hooks/useResolvedTaskMedia';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ResolvedImageDialogProps {
  imageRef: string | null;
  onClose: () => void;
}

export const ResolvedImageDialog = ({ imageRef, onClose }: ResolvedImageDialogProps) => {
  const resolved = useResolvedTaskMedia(imageRef);

  return (
    <Dialog open={!!imageRef} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Task Image</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center">
          {resolved ? (
            <img
              src={resolved}
              alt="Task attachment"
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
            />
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground">Loading...</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
