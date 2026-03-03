import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Bell } from 'lucide-react';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { useTranslation } from 'react-i18next';

interface BulkReminderSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onSetReminder: (date: Date | undefined) => void;
}

export const BulkReminderSheet = ({ isOpen, onClose, selectedCount, onSetReminder }: BulkReminderSheetProps) => {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  const handleApply = () => {
    onSetReminder(selectedDate);
    onClose();
  };

  const handleClear = () => {
    onSetReminder(undefined);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[60vh] rounded-t-3xl flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t('bulk.setReminderFor', { count: selectedCount })}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="rounded-md border mx-auto"
          />
        </div>

        <div className="flex gap-2 pt-4 flex-shrink-0 border-t">
          <Button variant="outline" onClick={handleClear} className="flex-1">
            {t('bulk.clearReminder')}
          </Button>
          <Button onClick={handleApply} className="flex-1">
            {t('bulk.apply')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};