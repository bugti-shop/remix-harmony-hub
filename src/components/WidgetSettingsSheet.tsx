import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { widgetDataSync, WidgetConfig, WidgetType, WIDGET_TYPES } from '@/utils/widgetDataSync';
import { loadNotesFromDB } from '@/utils/noteStorage';
import { getSetting } from '@/utils/settingsStorage';
import { Note } from '@/types/note';
import { toast } from 'sonner';
import { Smartphone, RefreshCw, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WidgetSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TaskSection {
  id: string;
  name: string;
  color: string;
}

export const WidgetSettingsSheet = ({ isOpen, onClose }: WidgetSettingsSheetProps) => {
  const { t } = useTranslation();
  const [widgetConfigs, setWidgetConfigs] = useState<WidgetConfig[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [sections, setSections] = useState<TaskSection[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    const configs = await widgetDataSync.getWidgetConfigs();
    setWidgetConfigs(configs);
    
    const loadedNotes = await loadNotesFromDB();
    setNotes(loadedNotes);
    
    const loadedSections = await getSetting<TaskSection[]>('task_sections', []);
    setSections(loadedSections);

    const specificNoteConfig = configs.find(c => c.type === 'specific_note');
    if (specificNoteConfig?.noteId) {
      setSelectedNoteId(specificNoteConfig.noteId);
    }
    
    const sectionConfig = configs.find(c => c.type === 'section_tasks');
    if (sectionConfig?.sectionId) {
      setSelectedSectionId(sectionConfig.sectionId);
    }
  };

  const handleToggleWidget = async (type: WidgetType, enabled: boolean) => {
    const existingIndex = widgetConfigs.findIndex(c => c.type === type);
    let newConfigs: WidgetConfig[];

    if (existingIndex >= 0) {
      newConfigs = [...widgetConfigs];
      newConfigs[existingIndex].enabled = enabled;
    } else {
      const newConfig: WidgetConfig = {
        id: `widget_${type}_${Date.now()}`,
        type,
        enabled,
      };
      newConfigs = [...widgetConfigs, newConfig];
    }

    setWidgetConfigs(newConfigs);
    await widgetDataSync.saveWidgetConfig(newConfigs);
  };

  const handleSelectNote = async (noteId: string) => {
    setSelectedNoteId(noteId);
    
    const existingIndex = widgetConfigs.findIndex(c => c.type === 'specific_note');
    let newConfigs: WidgetConfig[];

    if (existingIndex >= 0) {
      newConfigs = [...widgetConfigs];
      newConfigs[existingIndex].noteId = noteId;
      newConfigs[existingIndex].enabled = true;
    } else {
      const newConfig: WidgetConfig = {
        id: `widget_specific_note_${Date.now()}`,
        type: 'specific_note',
        enabled: true,
        noteId,
      };
      newConfigs = [...widgetConfigs, newConfig];
    }

    setWidgetConfigs(newConfigs);
    await widgetDataSync.saveWidgetConfig(newConfigs);
    await widgetDataSync.syncSpecificNote(noteId);
    toast.success(t('widgetSettings.noteWidgetConfigured'));
  };

  const handleSelectSection = async (sectionId: string) => {
    setSelectedSectionId(sectionId);
    
    const existingIndex = widgetConfigs.findIndex(c => c.type === 'section_tasks');
    let newConfigs: WidgetConfig[];

    if (existingIndex >= 0) {
      newConfigs = [...widgetConfigs];
      newConfigs[existingIndex].sectionId = sectionId;
      newConfigs[existingIndex].enabled = true;
    } else {
      const newConfig: WidgetConfig = {
        id: `widget_section_${Date.now()}`,
        type: 'section_tasks',
        enabled: true,
        sectionId,
      };
      newConfigs = [...widgetConfigs, newConfig];
    }

    setWidgetConfigs(newConfigs);
    await widgetDataSync.saveWidgetConfig(newConfigs);
    await widgetDataSync.syncSections();
    toast.success(t('widgetSettings.sectionWidgetConfigured'));
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      await widgetDataSync.syncAllData();
      toast.success(t('widgetSettings.widgetDataSynced'));
    } catch (error) {
      toast.error(t('widgetSettings.syncFailed'));
    } finally {
      setIsSyncing(false);
    }
  };

  const isWidgetEnabled = (type: WidgetType): boolean => {
    return widgetConfigs.find(c => c.type === type)?.enabled ?? false;
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl flex flex-col">
        <SheetHeader className="flex-shrink-0 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            {t('settings.widgets', 'Home Screen Widgets')}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-6">
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <p className="text-sm text-foreground">
                {t('widgetSettings.infoBanner')}
              </p>
              <Button 
                variant="link" 
                className="p-0 h-auto mt-2 text-primary"
                onClick={() => window.open('https://support.google.com/android/answer/9450271', '_blank')}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                {t('widgetSettings.howToAddWidgets')}
              </Button>
            </div>

            <Button 
              onClick={handleSyncNow} 
              disabled={isSyncing}
              variant="outline" 
              className="w-full"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
              {isSyncing ? t('widgetSettings.syncing') : t('widgetSettings.syncNow')}
            </Button>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">{t('widgetSettings.notesWidget')}</h3>
              
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📝</span>
                  <div>
                    <p className="text-sm font-medium">{t('widgetSettings.notesWidget')}</p>
                    <p className="text-xs text-muted-foreground">{t('widgetSettings.notesWidgetDesc')}</p>
                  </div>
                </div>
                <Switch
                  checked={isWidgetEnabled('specific_note')}
                  onCheckedChange={(checked) => handleToggleWidget('specific_note', checked)}
                />
              </div>

              {isWidgetEnabled('specific_note') && notes.length > 0 && (
                <div className="ml-4 p-3 rounded-lg bg-muted/50">
                  <p className="text-xs font-medium mb-2">{t('widgetSettings.selectNoteToDisplay')}</p>
                  <Select value={selectedNoteId} onValueChange={handleSelectNote}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('widgetSettings.chooseNote')} />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {notes.slice(0, 30).map((note) => (
                        <SelectItem key={note.id} value={note.id}>
                          <div className="flex items-center gap-2">
                            <span className="text-sm">
                              {note.type === 'regular' && '⬜'}
                              {note.type === 'sticky' && '📕'}
                              {note.type === 'lined' && '📄'}
                              {note.type === 'code' && '💻'}
                              
                              {note.type === 'voice' && '🎤'}
                            </span>
                            <span className="truncate max-w-[200px]">
                              {note.title || t('widgetSettings.untitled')}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">{t('widgetSettings.sectionTasksWidget')}</h3>
              
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📋</span>
                  <div>
                    <p className="text-sm font-medium">{t('widgetSettings.sectionTasks')}</p>
                    <p className="text-xs text-muted-foreground">{t('widgetSettings.sectionTasksDesc')}</p>
                  </div>
                </div>
                <Switch
                  checked={isWidgetEnabled('section_tasks')}
                  onCheckedChange={(checked) => handleToggleWidget('section_tasks', checked)}
                />
              </div>

              {isWidgetEnabled('section_tasks') && sections.length > 0 && (
                <div className="ml-4 p-3 rounded-lg bg-muted/50">
                  <p className="text-xs font-medium mb-2">{t('widgetSettings.selectSection')}</p>
                  <Select value={selectedSectionId} onValueChange={handleSelectSection}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('widgetSettings.chooseSection')} />
                    </SelectTrigger>
                    <SelectContent>
                      {sections.map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: section.color }} 
                            />
                            {section.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="bg-muted/50 rounded-lg p-4 mt-4">
              <h4 className="text-sm font-semibold mb-2">{t('widgetSettings.howToTitle')}</h4>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>{t('widgetSettings.step1')}</li>
                <li>{t('widgetSettings.step2')}</li>
                <li>{t('widgetSettings.step3')}</li>
                <li>{t('widgetSettings.step4')}</li>
                <li>{t('widgetSettings.step5')}</li>
              </ol>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
