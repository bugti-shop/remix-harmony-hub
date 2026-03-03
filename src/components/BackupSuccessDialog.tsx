import { useTranslation } from 'react-i18next';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';

interface BackupSuccessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
}

export const BackupSuccessDialog = ({ isOpen, onClose, filePath }: BackupSuccessDialogProps) => {
  const { t } = useTranslation();
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-6">
        <div className="flex flex-col items-center text-center space-y-4">
          {/* Success Icon */}
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-primary" />
          </div>
          
          {/* Title */}
          <h2 className="text-xl font-semibold text-foreground">
            {t('backup.success')}
          </h2>
          
          {/* File Path */}
          <p className="text-sm text-muted-foreground break-all">
            {t('backup.fileSavedIn', { path: filePath })}
          </p>
          
          {/* Got It Button */}
          <Button
            onClick={onClose}
            className="w-full mt-2"
            size="lg"
          >
            {t('backup.gotIt')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
