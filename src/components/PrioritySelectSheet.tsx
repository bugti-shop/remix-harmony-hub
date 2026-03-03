import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Priority } from '@/types/note';
import { Flag, Circle } from 'lucide-react';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { usePriorities } from '@/hooks/usePriorities';

interface PrioritySelectSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (priority: Priority) => void;
}

export const PrioritySelectSheet = ({ isOpen, onClose, onSelect }: PrioritySelectSheetProps) => {
  const { priorities } = usePriorities();
  
  // Hardware back button support - use 'sheet' priority to close sheet before navigation
  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  const handleSelect = (priority: Priority) => {
    onSelect(priority);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Set Priority
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-2">
          {priorities.map((p) => (
            <Button
              key={p.id}
              variant="outline"
              className="w-full justify-start h-12"
              onClick={() => handleSelect(p.id)}
            >
              <Circle 
                className="h-4 w-4 mr-3 fill-current" 
                style={{ color: p.color }}
              />
              {p.name}
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};
