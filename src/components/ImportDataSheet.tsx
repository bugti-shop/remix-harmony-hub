import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, CheckCircle2, FileText, ListTodo } from 'lucide-react';
import { ImportSource, importFromFile, getAcceptedFileTypes, ImportResult } from '@/utils/importData';
import { loadNotesFromDB, saveNotesToDB } from '@/utils/noteStorage';
import { loadTodoItems, saveTodoItems } from '@/utils/todoItemsStorage';
import { cn } from '@/lib/utils';

interface ImportDataSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const sources: { id: ImportSource; name: string; description: string; formats: string }[] = [
  { id: 'todoist', name: 'Todoist', description: 'Import tasks from Todoist CSV export', formats: 'CSV' },
  { id: 'notion', name: 'Notion', description: 'Import pages & databases from Notion', formats: 'CSV, JSON' },
  { id: 'evernote', name: 'Evernote', description: 'Import notes from Evernote export', formats: 'ENEX, HTML' },
];

export const ImportDataSheet = ({ isOpen, onClose }: ImportDataSheetProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedSource, setSelectedSource] = useState<ImportSource | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleSourceSelect = (source: ImportSource) => {
    setSelectedSource(source);
    setResult(null);
  };

  const handleFileSelect = () => {
    if (!selectedSource || !fileInputRef.current) return;
    fileInputRef.current.accept = getAcceptedFileTypes(selectedSource);
    fileInputRef.current.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSource) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const fileType = file.name.split('.').pop()?.toLowerCase() || '';
      const importResult = importFromFile(text, selectedSource, fileType);

      if (!importResult.success) {
        toast({ title: t('settings.importFailed', 'Import failed'), description: importResult.error, variant: 'destructive' });
        setIsImporting(false);
        return;
      }

      // Save imported data
      if (importResult.tasks.length > 0) {
        const existing = await loadTodoItems();
        await saveTodoItems([...existing, ...importResult.tasks]);
        window.dispatchEvent(new Event('tasksUpdated'));
      }
      if (importResult.notes.length > 0) {
        const existing = await loadNotesFromDB();
        await saveNotesToDB([...existing, ...importResult.notes]);
        window.dispatchEvent(new Event('notesUpdated'));
      }

      setResult(importResult);
      toast({ title: t('settings.importSuccess', 'Import successful!'), description: `${importResult.stats.tasks} tasks, ${importResult.stats.notes} notes imported` });
    } catch (err) {
      toast({ title: t('settings.importFailed', 'Import failed'), variant: 'destructive' });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    setSelectedSource(null);
    setResult(null);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh]">
        <SheetHeader className="pb-4">
          <SheetTitle>{t('settings.importData', 'Import Data')}</SheetTitle>
        </SheetHeader>

        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

        {result ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <p className="text-lg font-semibold text-foreground">{t('settings.importComplete', 'Import Complete!')}</p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              {result.stats.tasks > 0 && (
                <div className="flex items-center gap-1.5">
                  <ListTodo className="h-4 w-4" />
                  <span>{result.stats.tasks} {t('common.tasks', 'tasks')}</span>
                </div>
              )}
              {result.stats.notes > 0 && (
                <div className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4" />
                  <span>{result.stats.notes} {t('common.notes', 'notes')}</span>
                </div>
              )}
            </div>
            <Button onClick={handleClose} className="mt-2">{t('common.done', 'Done')}</Button>
          </div>
        ) : (
          <div className="space-y-3 pb-6">
            <p className="text-sm text-muted-foreground mb-4">
              {t('settings.importDescription', 'Select a source to import your tasks and notes from another app.')}
            </p>

            {sources.map((source) => (
              <button
                key={source.id}
                onClick={() => handleSourceSelect(source.id)}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left",
                  selectedSource === source.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                )}
              >
                <div>
                  <p className="font-medium text-foreground">{source.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{source.description}</p>
                </div>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">{source.formats}</span>
              </button>
            ))}

            {selectedSource && (
              <Button
                onClick={handleFileSelect}
                disabled={isImporting}
                className="w-full mt-4 gap-2"
                size="lg"
              >
                <Upload className="h-4 w-4" />
                {isImporting
                  ? t('settings.importing', 'Importing...')
                  : t('settings.selectFile', 'Select File')}
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
