import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Folder as FolderType, TaskSection } from '@/types/note';
import { FolderIcon, Check, Layers, FileStack } from 'lucide-react';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface TaskMoveSheetProps {
  isOpen: boolean;
  onClose: () => void;
  folders: FolderType[];
  sections: TaskSection[];
  onSelectFolder: (folderId: string | null) => void;
  onSelectSection: (sectionId: string | null) => void;
  currentFolderId?: string | null;
  currentSectionId?: string | null;
}

export const TaskMoveSheet = ({
  isOpen,
  onClose,
  folders,
  sections,
  onSelectFolder,
  onSelectSection,
  currentFolderId,
  currentSectionId
}: TaskMoveSheetProps) => {
  const { t } = useTranslation();
  
  // Hardware back button support
  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  const handleSelectFolder = (folderId: string | null) => {
    onSelectFolder(folderId);
    onClose();
  };

  const handleSelectSection = (sectionId: string | null) => {
    onSelectSection(sectionId);
    onClose();
  };

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[70vh]">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <FileStack className="h-5 w-5" />
            {t('tasks.moveTask', 'Move Task')}
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="folders" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="folders" className="flex items-center gap-2">
              <FolderIcon className="h-4 w-4" />
              {t('tasks.folders', 'Folders')}
            </TabsTrigger>
            <TabsTrigger value="sections" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              {t('tasks.sections', 'Sections')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="folders" className="space-y-2 max-h-[40vh] overflow-y-auto">
            <Button
              variant={currentFolderId === null || currentFolderId === undefined ? "default" : "outline"}
              className="w-full justify-between h-12"
              onClick={() => handleSelectFolder(null)}
            >
              <span className="flex items-center gap-2">
                <FolderIcon className="h-4 w-4" />
                {t('tasks.allTasks', 'All Tasks (No folder)')}
              </span>
              {(currentFolderId === null || currentFolderId === undefined) && <Check className="h-4 w-4" />}
            </Button>

            {folders.map((folder) => (
              <Button
                key={folder.id}
                variant={currentFolderId === folder.id ? "default" : "outline"}
                className="w-full justify-between h-12"
                onClick={() => handleSelectFolder(folder.id)}
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
              <p className="text-center text-muted-foreground py-8">
                {t('tasks.noFolders', 'No folders created yet')}
              </p>
            )}
          </TabsContent>

          <TabsContent value="sections" className="space-y-2 max-h-[40vh] overflow-y-auto">
            <Button
              variant={currentSectionId === null || currentSectionId === undefined ? "default" : "outline"}
              className="w-full justify-between h-12"
              onClick={() => handleSelectSection(null)}
            >
              <span className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                {t('tasks.noSection', 'No Section')}
              </span>
              {(currentSectionId === null || currentSectionId === undefined) && <Check className="h-4 w-4" />}
            </Button>

            {sortedSections.map((section) => (
              <Button
                key={section.id}
                variant={currentSectionId === section.id ? "default" : "outline"}
                className="w-full justify-between h-12"
                onClick={() => handleSelectSection(section.id)}
              >
                <span className="flex items-center gap-2">
                  <div
                    className="w-1 h-6 rounded-full"
                    style={{ backgroundColor: section.color }}
                  />
                  {section.name}
                </span>
                {currentSectionId === section.id && <Check className="h-4 w-4" />}
              </Button>
            ))}

            {sections.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                {t('tasks.noSections', 'No sections created yet')}
              </p>
            )}
          </TabsContent>
        </Tabs>

        <Button variant="outline" onClick={onClose} className="w-full mt-4">
          {t('common.cancel', 'Cancel')}
        </Button>
      </SheetContent>
    </Sheet>
  );
};
