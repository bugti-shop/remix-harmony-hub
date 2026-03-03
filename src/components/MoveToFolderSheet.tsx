import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Folder as FolderType } from '@/types/note';
import { FolderIcon, Check } from 'lucide-react';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { useTranslation } from 'react-i18next';

interface MoveToFolderSheetProps {
  isOpen: boolean;
  onClose: () => void;
  folders: FolderType[];
  onSelect: (folderId: string | null) => void;
  currentFolderId?: string | null;
}

export const MoveToFolderSheet = ({
  isOpen,
  onClose,
  folders,
  onSelect,
  currentFolderId
}: MoveToFolderSheetProps) => {
  const { t } = useTranslation();
  // Hardware back button support - use 'sheet' priority to close sheet before navigation
  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  const handleSelect = (folderId: string | null) => {
    onSelect(folderId);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <FolderIcon className="h-5 w-5" />
            {t('notes.moveToFolder', 'Move to Folder')}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          <Button
            variant={currentFolderId === null ? "default" : "outline"}
            className="w-full justify-between h-12"
            onClick={() => handleSelect(null)}
          >
            <span className="flex items-center gap-2">
              <FolderIcon className="h-4 w-4" />
              All Tasks (No folder)
            </span>
            {currentFolderId === null && <Check className="h-4 w-4" />}
          </Button>

          {folders.map((folder) => (
            <Button
              key={folder.id}
              variant={currentFolderId === folder.id ? "default" : "outline"}
              className="w-full justify-between h-12"
              onClick={() => handleSelect(folder.id)}
            >
              <span className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: folder.color }}
                />
                {folder.name}
              </span>
              {currentFolderId === folder.id && <Check className="h-4 w-4" />}
            </Button>
          ))}

          {folders.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No folders created yet</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
