import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Share2, Eye, FileCheck, Loader2 } from 'lucide-react';
import { sharePdf, viewPdf } from '@/utils/exportToPdf';
import { toast } from 'sonner';

interface PdfExportSuccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  filename: string;
  base64Data: string;
}

export const PdfExportSuccessDialog = ({
  isOpen,
  onClose,
  filename,
  base64Data,
}: PdfExportSuccessDialogProps) => {
  const { t } = useTranslation();
  const [isSharing, setIsSharing] = useState(false);
  const [isViewing, setIsViewing] = useState(false);

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const success = await sharePdf(base64Data, filename);
      if (success) {
        toast.success(t('toast.pdfShared', 'PDF shared successfully'));
      } else {
        toast.error(t('toast.shareFailed', 'Share failed'));
      }
    } catch (error) {
      console.error('Share error:', error);
      toast.error(t('toast.shareFailed', 'Share failed'));
    } finally {
      setIsSharing(false);
    }
  };

  const handleView = async () => {
    setIsViewing(true);
    try {
      const success = await viewPdf(base64Data, filename);
      if (!success) {
        toast.error(t('toast.viewFailed', 'Could not open PDF'));
      }
    } catch (error) {
      console.error('View error:', error);
      toast.error(t('toast.viewFailed', 'Could not open PDF'));
    } finally {
      setIsViewing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center items-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <FileCheck className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-xl">
            {t('pdf.noteExported', 'Note Exported')}
          </DialogTitle>
          <DialogDescription className="text-center">
            {t('pdf.exportSuccess', 'Your note has been exported as PDF successfully.')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-4">
          <Button
            onClick={handleShare}
            disabled={isSharing || isViewing}
            className="w-full gap-2"
            size="lg"
          >
            {isSharing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Share2 className="h-5 w-5" />
            )}
            {t('common.share', 'Share')}
          </Button>

          <Button
            onClick={handleView}
            disabled={isSharing || isViewing}
            variant="outline"
            className="w-full gap-2"
            size="lg"
          >
            {isViewing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
            {t('common.view', 'View')}
          </Button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground">
            {filename}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
