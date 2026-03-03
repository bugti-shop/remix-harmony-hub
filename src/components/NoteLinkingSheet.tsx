import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Note } from '@/types/note';
import { Link2, Search, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';

interface NoteLinkingSheetProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  currentNoteId?: string;
  onSelectNote: (noteTitle: string) => void;
}

export const NoteLinkingSheet = ({
  isOpen,
  onClose,
  notes,
  currentNoteId,
  onSelectNote,
}: NoteLinkingSheetProps) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  const filteredNotes = useMemo(() => {
    return notes
      .filter(note => note.id !== currentNoteId)
      .filter(note => 
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.replace(/<[^>]*>/g, '').toLowerCase().includes(searchQuery.toLowerCase())
      )
      .slice(0, 20);
  }, [notes, currentNoteId, searchQuery]);

  const handleSelect = (note: Note) => {
    onSelectNote(note.title);
    setSearchQuery('');
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[60vh]">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {t('noteLinking.linkToNote')}
          </SheetTitle>
        </SheetHeader>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('noteLinking.searchNotes')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        <ScrollArea className="h-[calc(100%-6rem)]">
          {filteredNotes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('noteLinking.noNotesFound')}</p>
              <p className="text-sm mt-1">{t('noteLinking.tryDifferentSearch')}</p>
            </div>
          ) : (
            <div className="space-y-2 pr-4">
              {filteredNotes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => handleSelect(note)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border bg-card transition-colors",
                    "hover:bg-accent/50 hover:border-primary/50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {note.title || t('widgetSettings.untitled')}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {note.content
                          .replace(/<[^>]*>/g, '')
                          .replace(/&nbsp;/g, ' ')
                          .slice(0, 100)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(note.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
          <p className="font-medium">{t('noteLinking.tipTitle')}</p>
          <p className="text-xs mt-1">{t('noteLinking.tipDesc')}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
};
