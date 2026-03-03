import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Repeat } from 'lucide-react';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { RepeatType } from '@/types/note';
import { useTranslation } from 'react-i18next';

interface BulkRepeatSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onSetRepeat: (repeatType: RepeatType) => void;
}

export const BulkRepeatSheet = ({ isOpen, onClose, selectedCount, onSetRepeat }: BulkRepeatSheetProps) => {
  const { t } = useTranslation();
  
  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  const handleSelect = (repeatType: RepeatType) => {
    onSetRepeat(repeatType);
    onClose();
  };

  const repeatOptions: { value: RepeatType; label: string; description: string }[] = [
    { value: 'none', label: t('tasks.repeat.none'), description: t('bulk.repeatDesc.none') },
    { value: 'daily', label: t('tasks.repeat.daily'), description: t('bulk.repeatDesc.daily') },
    { value: 'weekly', label: t('tasks.repeat.weekly'), description: t('bulk.repeatDesc.weekly') },
    { value: 'weekdays', label: t('bulk.weekdays'), description: t('bulk.repeatDesc.weekdays') },
    { value: 'monthly', label: t('tasks.repeat.monthly'), description: t('bulk.repeatDesc.monthly') },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-auto rounded-t-3xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            {t('bulk.setRepeatFor', { count: selectedCount })}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-2 pb-4">
          {repeatOptions.map((option) => (
            <Button
              key={option.value}
              variant="outline"
              className="w-full justify-start h-auto py-3"
              onClick={() => handleSelect(option.value)}
            >
              <div className="text-left">
                <div className="font-medium">{option.label}</div>
                <div className="text-xs text-muted-foreground">{option.description}</div>
              </div>
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};