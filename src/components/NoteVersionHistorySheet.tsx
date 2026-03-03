import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getNoteVersions, NoteVersion, formatVersionTimestamp, restoreNoteVersion } from '@/utils/noteVersionHistory';
import { History, RotateCcw, FileEdit, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';

interface NoteVersionHistorySheetProps {
  isOpen: boolean;
  onClose: () => void;
  noteId: string;
  onRestore: (content: string, title: string) => void;
}

const ChangeTypeIcon = ({ type }: { type: NoteVersion['changeType'] }) => {
  switch (type) {
    case 'create':
      return <Plus className="h-3 w-3 text-green-500" />;
    case 'restore':
      return <RotateCcw className="h-3 w-3 text-blue-500" />;
    default:
      return <FileEdit className="h-3 w-3 text-muted-foreground" />;
  }
};

export const NoteVersionHistorySheet = ({
  isOpen,
  onClose,
  noteId,
  onRestore,
}: NoteVersionHistorySheetProps) => {
  const [versions, setVersions] = useState<NoteVersion[]>([]);

  // Hardware back button support - use 'sheet' priority to close sheet before navigation
  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  // Load versions from IndexedDB
  useEffect(() => {
    if (isOpen && noteId) {
      getNoteVersions(noteId).then(setVersions);
    }
  }, [isOpen, noteId]);

  const handleRestore = (version: NoteVersion) => {
    const restored = restoreNoteVersion(version);
    onRestore(restored.content || '', restored.title || '');
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[70vh]">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100%-4rem)]">
          {versions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No version history yet</p>
              <p className="text-sm mt-1">Changes will be saved automatically</p>
            </div>
          ) : (
            <div className="space-y-2 pr-4">
              {versions.map((version, index) => (
                <div
                  key={version.id}
                  className={cn(
                    "p-3 rounded-lg border bg-card transition-colors hover:bg-accent/50",
                    index === 0 && "border-primary/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <ChangeTypeIcon type={version.changeType} />
                        <span className="text-sm font-medium capitalize">
                          {version.changeType}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatVersionTimestamp(version.timestamp)}
                        </span>
                        {index === 0 && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium truncate">
                        {version.title || 'Untitled'}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {version.content
                          .replace(/<[^>]*>/g, '')
                          .replace(/&nbsp;/g, ' ')
                          .slice(0, 150)}
                        {version.content.length > 150 ? '...' : ''}
                      </p>
                    </div>
                    {index !== 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRestore(version)}
                        className="shrink-0"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Restore
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
