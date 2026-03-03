import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Copy, CheckSquare, Square } from 'lucide-react';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { useTranslation } from 'react-i18next';

export type DuplicateOption = 'uncompleted' | 'all-preserve' | 'all-reset';

interface DuplicateOptionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (option: DuplicateOption) => void;
}

export const DuplicateOptionsSheet = ({ isOpen, onClose, onSelect }: DuplicateOptionsSheetProps) => {
  const { t } = useTranslation();
  
  // Hardware back button support - use 'sheet' priority to close sheet before navigation
  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  const handleSelect = (option: DuplicateOption) => {
    onSelect(option);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            {t('bulk.duplicateOptions')}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start h-14 text-left"
            onClick={() => handleSelect('uncompleted')}
          >
            <Square className="h-5 w-5 mr-3 text-blue-500" />
            <div>
              <p className="font-medium">{t('bulk.uncompletedOnly')}</p>
              <p className="text-xs text-muted-foreground">{t('bulk.uncompletedOnlyDesc')}</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start h-14 text-left"
            onClick={() => handleSelect('all-preserve')}
          >
            <CheckSquare className="h-5 w-5 mr-3 text-green-500" />
            <div>
              <p className="font-medium">{t('bulk.allPreserve')}</p>
              <p className="text-xs text-muted-foreground">{t('bulk.allPreserveDesc')}</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start h-14 text-left"
            onClick={() => handleSelect('all-reset')}
          >
            <Square className="h-5 w-5 mr-3 text-orange-500" />
            <div>
              <p className="font-medium">{t('bulk.allReset')}</p>
              <p className="text-xs text-muted-foreground">{t('bulk.allResetDesc')}</p>
            </div>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
