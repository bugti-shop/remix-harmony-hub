import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { LayoutList } from 'lucide-react';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { TaskSection } from '@/types/note';
import { useTranslation } from 'react-i18next';

interface BulkSectionMoveSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  sections: TaskSection[];
  onMoveToSection: (sectionId: string) => void;
}

export const BulkSectionMoveSheet = ({ isOpen, onClose, selectedCount, sections, onMoveToSection }: BulkSectionMoveSheetProps) => {
  const { t } = useTranslation();
  
  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  const handleSelect = (sectionId: string) => {
    onMoveToSection(sectionId);
    onClose();
  };

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-auto max-h-[60vh] rounded-t-3xl flex flex-col">
        <SheetHeader className="pb-4 flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <LayoutList className="h-5 w-5" />
            {t('bulk.moveTasks', { count: selectedCount })}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-2 pb-4 overflow-y-auto flex-1">
          {sortedSections.map((section) => (
            <Button
              key={section.id}
              variant="outline"
              className="w-full justify-start h-auto py-3"
              onClick={() => handleSelect(section.id)}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: section.color }}
                />
                <span>{section.name}</span>
              </div>
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};