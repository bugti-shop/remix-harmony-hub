import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ChevronRight, ChevronLeft, Type, Wand2, FileText, SpellCheck, Bold, Italic, Underline, Strikethrough, Highlighter } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import { toast } from 'sonner';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// Types for settings
export interface FontSettings {
  fontFamily: string;
  fontSize: string;
  fontColor: string;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isStrikethrough?: boolean;
  highlightColor?: string;
}

export interface NotesSettings {
  normalText: FontSettings;
  headings: FontSettings;
  startNotesIn: 'title' | 'body';
  spellCheck: boolean;
  smartDetection: {
    urls: boolean;
    phoneNumbers: boolean;
    emailAddresses: boolean;
  };
}

const DEFAULT_NOTES_SETTINGS: NotesSettings = {
  normalText: {
    fontFamily: 'System Default',
    fontSize: '16',
    fontColor: '#000000',
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isStrikethrough: false,
    highlightColor: 'transparent',
  },
  headings: {
    fontFamily: 'System Default',
    fontSize: '24',
    fontColor: '#000000',
    isBold: true,
    isItalic: false,
    isUnderline: false,
    isStrikethrough: false,
    highlightColor: 'transparent',
  },
  startNotesIn: 'title',
  spellCheck: false,
  smartDetection: {
    urls: false,
    phoneNumbers: false,
    emailAddresses: false,
  },
};

const FONT_FAMILIES = [
  'System Default',
  'Arial',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Courier New',
  'Trebuchet MS',
  'Palatino',
  'Garamond',
];

const FONT_SIZES = ['12', '14', '16', '18', '20', '22', '24', '28', '32', '36', '40', '48'];

const FONT_COLORS = [
  { label: 'Default', value: '#000000' },
  { label: 'Gray', value: '#6b7280' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Pink', value: '#ec4899' },
];

const HIGHLIGHT_COLORS = [
  { label: 'None', value: 'transparent' },
  { label: 'Yellow', value: '#FEF08A' },
  { label: 'Green', value: '#BBF7D0' },
  { label: 'Blue', value: '#BFDBFE' },
  { label: 'Pink', value: '#FBCFE8' },
  { label: 'Purple', value: '#E9D5FF' },
  { label: 'Orange', value: '#FED7AA' },
  { label: 'Cyan', value: '#A5F3FC' },
];

type SubPage = 'main' | 'defaultFont' | 'advancedEditing';

interface NotesSettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotesSettingsSheet = ({ isOpen, onClose }: NotesSettingsSheetProps) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<NotesSettings>(DEFAULT_NOTES_SETTINGS);
  const [currentPage, setCurrentPage] = useState<SubPage>('main');
  const [isLoading, setIsLoading] = useState(true);

  useHardwareBackButton({
    onBack: () => {
      if (currentPage !== 'main') {
        setCurrentPage('main');
      } else {
        onClose();
      }
    },
    enabled: isOpen,
    priority: 'sheet',
  });

  // Load settings
  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  // Reset to main page when sheet closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentPage('main');
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const saved = await getSetting<NotesSettings | null>('notesEditorSettings', null);
      if (saved) {
        setSettings({ ...DEFAULT_NOTES_SETTINGS, ...saved });
      }
    } catch (error) {
      console.error('Error loading notes settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: NotesSettings) => {
    setSettings(newSettings);
    await setSetting('notesEditorSettings', newSettings);
  };

  const updateNormalText = async (key: keyof FontSettings, value: string | boolean) => {
    // Handle boolean values for style toggles
    const processedValue = value === 'true' ? true : value === 'false' ? false : value;
    const newSettings = {
      ...settings,
      normalText: { ...settings.normalText, [key]: processedValue },
    };
    await saveSettings(newSettings);
    // Dispatch event so editors can update live
    window.dispatchEvent(new CustomEvent('notesSettingsChanged', { detail: newSettings }));
    toast.success(t('settings.settingsSaved', 'Settings saved'));
  };

  const updateHeadings = async (key: keyof FontSettings, value: string | boolean) => {
    // Handle boolean values for style toggles
    const processedValue = value === 'true' ? true : value === 'false' ? false : value;
    const newSettings = {
      ...settings,
      headings: { ...settings.headings, [key]: processedValue },
    };
    await saveSettings(newSettings);
    // Dispatch event so editors can update live
    window.dispatchEvent(new CustomEvent('notesSettingsChanged', { detail: newSettings }));
    toast.success(t('settings.settingsSaved', 'Settings saved'));
  };

  const updateSmartDetection = async (key: keyof NotesSettings['smartDetection'], value: boolean) => {
    const newSettings = {
      ...settings,
      smartDetection: { ...settings.smartDetection, [key]: value },
    };
    await saveSettings(newSettings);
    toast.success(t('settings.settingsSaved', 'Settings saved'));
  };

  const updateSpellCheck = async (value: boolean) => {
    const newSettings = { ...settings, spellCheck: value };
    await saveSettings(newSettings);
    // Dispatch event so editors can update live
    window.dispatchEvent(new CustomEvent('notesSettingsChanged', { detail: newSettings }));
    toast.success(t('settings.settingsSaved', 'Settings saved'));
  };

  const updateStartNotesIn = async (value: 'title' | 'body') => {
    const newSettings = { ...settings, startNotesIn: value };
    await saveSettings(newSettings);
    toast.success(t('settings.settingsSaved', 'Settings saved'));
  };

  const SettingsRow = ({ 
    label, 
    subtitle,
    onClick, 
    rightElement 
  }: { 
    label: string; 
    subtitle?: string;
    onClick?: () => void; 
    rightElement?: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "w-full flex items-center justify-between px-4 py-3 border-b border-border/50",
        onClick && "hover:bg-muted/50 transition-colors"
      )}
    >
      <div className="flex flex-col items-start">
        <span className="text-foreground text-sm">{label}</span>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </div>
      {rightElement || (onClick && <ChevronRight className="h-4 w-4 text-muted-foreground" />)}
    </button>
  );

  const SectionHeading = ({ title }: { title: string }) => (
    <div className="px-4 py-2 bg-muted/50">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</span>
    </div>
  );

  const BackButton = ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick} className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors">
      <ChevronLeft className="h-5 w-5" />
    </button>
  );

  // Main page
  const renderMainPage = () => (
    <>
      <SheetHeader className="px-4 py-3 border-b">
        <SheetTitle className="text-lg">{t('settings.notesSettings', 'Notes Settings')}</SheetTitle>
      </SheetHeader>
      <ScrollArea className="flex-1">
        <div className="py-2">
          <SettingsRow 
            label={t('settings.defaultFontSettings', 'Default Font Settings')}
            subtitle={t('settings.defaultFontSettingsDesc', 'Customize fonts for text and headings')}
            onClick={() => setCurrentPage('defaultFont')}
          />
          <SettingsRow 
            label={t('settings.advancedEditing', 'Advanced Editing')}
            subtitle={t('settings.advancedEditingDesc', 'Smart detection for URLs, phone, email')}
            onClick={() => setCurrentPage('advancedEditing')}
          />
        </div>
      </ScrollArea>
    </>
  );

  // Default Font Settings page
  const renderDefaultFontPage = () => (
    <>
      <SheetHeader className="px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <BackButton onClick={() => setCurrentPage('main')} />
          <SheetTitle className="text-lg">{t('settings.defaultFontSettings', 'Default Font Settings')}</SheetTitle>
        </div>
      </SheetHeader>
      <ScrollArea className="flex-1">
        <div className="py-2">
          {/* Normal Text Section */}
          <SectionHeading title={t('settings.normalText', 'Normal Text')} />
          
          {/* Font Style Toggles */}
          <div className="px-4 py-3 border-b border-border/50">
            <label className="text-sm text-muted-foreground mb-3 block">{t('settings.textStyle', 'Text Style')}</label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={settings.normalText.isBold ? "default" : "outline"}
                size="sm"
                onClick={() => updateNormalText('isBold', !settings.normalText.isBold ? 'true' : 'false')}
                className="h-10 w-10 p-0"
                title={t('settings.bold', 'Bold')}
              >
                <Bold className="h-5 w-5" />
              </Button>
              <Button
                variant={settings.normalText.isItalic ? "default" : "outline"}
                size="sm"
                onClick={() => updateNormalText('isItalic', !settings.normalText.isItalic ? 'true' : 'false')}
                className="h-10 w-10 p-0"
                title={t('settings.italic', 'Italic')}
              >
                <Italic className="h-5 w-5" />
              </Button>
              <Button
                variant={settings.normalText.isUnderline ? "default" : "outline"}
                size="sm"
                onClick={() => updateNormalText('isUnderline', !settings.normalText.isUnderline ? 'true' : 'false')}
                className="h-10 w-10 p-0"
                title={t('settings.underline', 'Underline')}
              >
                <Underline className="h-5 w-5" />
              </Button>
              <Button
                variant={settings.normalText.isStrikethrough ? "default" : "outline"}
                size="sm"
                onClick={() => updateNormalText('isStrikethrough', !settings.normalText.isStrikethrough ? 'true' : 'false')}
                className="h-10 w-10 p-0"
                title={t('settings.strikethrough', 'Strikethrough')}
              >
                <Strikethrough className="h-5 w-5" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={settings.normalText.highlightColor && settings.normalText.highlightColor !== 'transparent' ? "default" : "outline"}
                    size="sm"
                    className="h-10 w-10 p-0 relative"
                    title={t('settings.highlight', 'Highlight')}
                  >
                    <Highlighter className="h-5 w-5" />
                    {settings.normalText.highlightColor && settings.normalText.highlightColor !== 'transparent' && (
                      <div 
                        className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-6 rounded-sm" 
                        style={{ backgroundColor: settings.normalText.highlightColor }}
                      />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2">
                  <div className="flex flex-wrap gap-2 max-w-[200px]">
                    {HIGHLIGHT_COLORS.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => updateNormalText('highlightColor', color.value)}
                        className={cn(
                          "w-8 h-8 rounded-md border-2 transition-all",
                          settings.normalText.highlightColor === color.value 
                            ? "border-primary ring-2 ring-primary/30" 
                            : "border-border"
                        )}
                        style={{ backgroundColor: color.value === 'transparent' ? 'white' : color.value }}
                        title={color.label}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="px-4 py-3 border-b border-border/50">
            <label className="text-sm text-muted-foreground mb-2 block">{t('settings.fontFamily', 'Font Family')}</label>
            <Select value={settings.normalText.fontFamily} onValueChange={(v) => updateNormalText('fontFamily', v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_FAMILIES.map((font) => (
                  <SelectItem key={font} value={font} style={{ fontFamily: font === 'System Default' ? 'inherit' : font }}>
                    {font}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="px-4 py-3 border-b border-border/50">
            <label className="text-sm text-muted-foreground mb-2 block">{t('settings.fontSize', 'Font Size')}</label>
            <Select value={settings.normalText.fontSize} onValueChange={(v) => updateNormalText('fontSize', v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>{size}px</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="px-4 py-3 border-b border-border/50">
            <label className="text-sm text-muted-foreground mb-2 block">{t('settings.fontColor', 'Font Color')}</label>
            <div className="flex flex-wrap gap-2">
              {FONT_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => updateNormalText('fontColor', color.value)}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-all",
                    settings.normalText.fontColor === color.value 
                      ? "border-primary ring-2 ring-primary/30" 
                      : "border-border"
                  )}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          {/* Headings Section */}
          <SectionHeading title={t('settings.headings', 'Headings')} />
          
          {/* Heading Style Toggles */}
          <div className="px-4 py-3 border-b border-border/50">
            <label className="text-sm text-muted-foreground mb-3 block">{t('settings.textStyle', 'Text Style')}</label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={settings.headings.isBold ? "default" : "outline"}
                size="sm"
                onClick={() => updateHeadings('isBold', !settings.headings.isBold ? 'true' : 'false')}
                className="h-10 w-10 p-0"
                title={t('settings.bold', 'Bold')}
              >
                <Bold className="h-5 w-5" />
              </Button>
              <Button
                variant={settings.headings.isItalic ? "default" : "outline"}
                size="sm"
                onClick={() => updateHeadings('isItalic', !settings.headings.isItalic ? 'true' : 'false')}
                className="h-10 w-10 p-0"
                title={t('settings.italic', 'Italic')}
              >
                <Italic className="h-5 w-5" />
              </Button>
              <Button
                variant={settings.headings.isUnderline ? "default" : "outline"}
                size="sm"
                onClick={() => updateHeadings('isUnderline', !settings.headings.isUnderline ? 'true' : 'false')}
                className="h-10 w-10 p-0"
                title={t('settings.underline', 'Underline')}
              >
                <Underline className="h-5 w-5" />
              </Button>
              <Button
                variant={settings.headings.isStrikethrough ? "default" : "outline"}
                size="sm"
                onClick={() => updateHeadings('isStrikethrough', !settings.headings.isStrikethrough ? 'true' : 'false')}
                className="h-10 w-10 p-0"
                title={t('settings.strikethrough', 'Strikethrough')}
              >
                <Strikethrough className="h-5 w-5" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={settings.headings.highlightColor && settings.headings.highlightColor !== 'transparent' ? "default" : "outline"}
                    size="sm"
                    className="h-10 w-10 p-0 relative"
                    title={t('settings.highlight', 'Highlight')}
                  >
                    <Highlighter className="h-5 w-5" />
                    {settings.headings.highlightColor && settings.headings.highlightColor !== 'transparent' && (
                      <div 
                        className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-6 rounded-sm" 
                        style={{ backgroundColor: settings.headings.highlightColor }}
                      />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2">
                  <div className="flex flex-wrap gap-2 max-w-[200px]">
                    {HIGHLIGHT_COLORS.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => updateHeadings('highlightColor', color.value)}
                        className={cn(
                          "w-8 h-8 rounded-md border-2 transition-all",
                          settings.headings.highlightColor === color.value 
                            ? "border-primary ring-2 ring-primary/30" 
                            : "border-border"
                        )}
                        style={{ backgroundColor: color.value === 'transparent' ? 'white' : color.value }}
                        title={color.label}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="px-4 py-3 border-b border-border/50">
            <label className="text-sm text-muted-foreground mb-2 block">{t('settings.fontFamily', 'Font Family')}</label>
            <Select value={settings.headings.fontFamily} onValueChange={(v) => updateHeadings('fontFamily', v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_FAMILIES.map((font) => (
                  <SelectItem key={font} value={font} style={{ fontFamily: font === 'System Default' ? 'inherit' : font }}>
                    {font}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="px-4 py-3 border-b border-border/50">
            <label className="text-sm text-muted-foreground mb-2 block">{t('settings.fontSize', 'Font Size')}</label>
            <Select value={settings.headings.fontSize} onValueChange={(v) => updateHeadings('fontSize', v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_SIZES.map((size) => (
                  <SelectItem key={size} value={size}>{size}px</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="px-4 py-3">
            <label className="text-sm text-muted-foreground mb-2 block">{t('settings.fontColor', 'Font Color')}</label>
            <div className="flex flex-wrap gap-2">
              {FONT_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => updateHeadings('fontColor', color.value)}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-all",
                    settings.headings.fontColor === color.value 
                      ? "border-primary ring-2 ring-primary/30" 
                      : "border-border"
                  )}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                />
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </>
  );

  // Advanced Editing page
  const renderAdvancedEditingPage = () => (
    <>
      <SheetHeader className="px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <BackButton onClick={() => setCurrentPage('main')} />
          <SheetTitle className="text-lg">{t('settings.advancedEditing', 'Advanced Editing')}</SheetTitle>
        </div>
      </SheetHeader>
      <ScrollArea className="flex-1">
        <div className="py-2">
          {/* Spell Check Section */}
          <SectionHeading title={t('settings.spellCheckSection', 'Spell Check')} />
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2">
                <SpellCheck className="h-4 w-4 text-primary" />
                <span className="text-foreground text-sm block">{t('settings.spellCheck', 'Spell Check')}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {t('settings.spellCheckDesc', 'Highlight misspelled words and show suggestions while typing in notes')}
              </span>
            </div>
            <Switch
              checked={settings.spellCheck}
              onCheckedChange={updateSpellCheck}
            />
          </div>

          <SectionHeading title={t('settings.smartDetection', 'Smart Detection')} />
          
          {/* URLs */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex-1 pr-4">
              <span className="text-foreground text-sm block">{t('settings.urls', 'URLs')}</span>
              <span className="text-xs text-muted-foreground">
                {t('settings.urlsDesc', 'Auto-detect URLs and make them clickable (opens in browser)')}
              </span>
            </div>
            <Switch
              checked={settings.smartDetection.urls}
              onCheckedChange={(checked) => updateSmartDetection('urls', checked)}
            />
          </div>

          {/* Phone Numbers */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex-1 pr-4">
              <span className="text-foreground text-sm block">{t('settings.phoneNumbers', 'Phone Numbers')}</span>
              <span className="text-xs text-muted-foreground">
                {t('settings.phoneNumbersDesc', 'Auto-detect phone numbers with country codes (+1, +9, etc.) and make them callable')}
              </span>
            </div>
            <Switch
              checked={settings.smartDetection.phoneNumbers}
              onCheckedChange={(checked) => updateSmartDetection('phoneNumbers', checked)}
            />
          </div>

          {/* Email Addresses */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex-1 pr-4">
              <span className="text-foreground text-sm block">{t('settings.emailAddresses', 'Email Addresses')}</span>
              <span className="text-xs text-muted-foreground">
                {t('settings.emailAddressesDesc', 'Auto-detect email addresses and make them clickable (opens email app)')}
              </span>
            </div>
            <Switch
              checked={settings.smartDetection.emailAddresses}
              onCheckedChange={(checked) => updateSmartDetection('emailAddresses', checked)}
            />
          </div>
        </div>
      </ScrollArea>
    </>
  );

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0 flex flex-col">
        {currentPage === 'main' && renderMainPage()}
        {currentPage === 'defaultFont' && renderDefaultFontPage()}
        {currentPage === 'advancedEditing' && renderAdvancedEditingPage()}
      </SheetContent>
    </Sheet>
  );
};

// Hook to access notes settings with live updates
export const useNotesSettings = () => {
  const [settings, setSettings] = useState<NotesSettings>(DEFAULT_NOTES_SETTINGS);

  useEffect(() => {
    // Load initial settings
    getSetting<NotesSettings | null>('notesEditorSettings', null).then((saved) => {
      if (saved) {
        setSettings({ ...DEFAULT_NOTES_SETTINGS, ...saved });
      }
    });

    // Listen for live setting changes
    const handleSettingsChange = (event: CustomEvent<NotesSettings>) => {
      setSettings({ ...DEFAULT_NOTES_SETTINGS, ...event.detail });
    };

    window.addEventListener('notesSettingsChanged', handleSettingsChange as EventListener);
    return () => {
      window.removeEventListener('notesSettingsChanged', handleSettingsChange as EventListener);
    };
  }, []);

  return settings;
};
