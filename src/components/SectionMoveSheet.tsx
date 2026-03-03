import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';

interface TaskSection {
  id: string;
  name: string;
  color: string;
  isCollapsed: boolean;
  order: number;
}

interface SectionMoveSheetProps {
  isOpen: boolean;
  onClose: () => void;
  sections: TaskSection[];
  currentSectionId: string;
  onMoveToPosition: (targetIndex: number) => void;
}

export const SectionMoveSheet = ({ isOpen, onClose, sections, currentSectionId, onMoveToPosition }: SectionMoveSheetProps) => {
  // Hardware back button support - use 'sheet' priority to close sheet before navigation
  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);
  const currentIndex = sortedSections.findIndex(s => s.id === currentSectionId);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-[20px]">
        <SheetHeader className="mb-4">
          <SheetTitle>Move Section</SheetTitle>
        </SheetHeader>

        <div className="space-y-2">
          {sortedSections.map((section, index) => {
            const isCurrent = section.id === currentSectionId;
            return (
              <button
                key={section.id}
                onClick={() => {
                  if (!isCurrent) {
                    onMoveToPosition(index);
                    onClose();
                  }
                }}
                disabled={isCurrent}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
                  isCurrent 
                    ? 'bg-primary/10 border-primary cursor-default' 
                    : 'hover:bg-muted border-border cursor-pointer'
                }`}
              >
                <div 
                  className="w-1 h-6 rounded-full" 
                  style={{ backgroundColor: section.color }} 
                />
                <span className={isCurrent ? 'font-medium' : ''}>
                  {section.name}
                  {isCurrent && ' (current)'}
                </span>
                {!isCurrent && (
                  <div className="ml-auto flex items-center gap-1 text-muted-foreground">
                    {index < currentIndex ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <Button variant="outline" onClick={onClose} className="w-full mt-4">
          Cancel
        </Button>
      </SheetContent>
    </Sheet>
  );
};
