import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { TaskStatus } from '@/types/note';
import { TASK_STATUS_OPTIONS, getStatusConfig } from './TaskStatusBadge';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface BulkStatusSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onStatusChange: (status: TaskStatus) => void;
}

export const BulkStatusSheet = ({
  isOpen,
  onClose,
  selectedCount,
  onStatusChange,
}: BulkStatusSheetProps) => {
  const { t } = useTranslation();
  
  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  const handleStatusSelect = (status: TaskStatus) => {
    onStatusChange(status);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="mb-4">
          <SheetTitle>{t('bulk.setStatusFor', { count: selectedCount })}</SheetTitle>
        </SheetHeader>

        <div className="space-y-2">
          {TASK_STATUS_OPTIONS.map((option) => {
            const config = getStatusConfig(option.value);
            const Icon = config.icon;
            return (
              <Button
                key={option.value}
                variant="outline"
                className={cn(
                  "w-full justify-start gap-3 h-12",
                  config.color
                )}
                onClick={() => handleStatusSelect(option.value)}
              >
                <Icon className="h-5 w-5" />
                <span>{option.label}</span>
              </Button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};
