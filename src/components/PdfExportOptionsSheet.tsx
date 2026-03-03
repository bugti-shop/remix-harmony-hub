import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { FileDown, FileText, Ruler, AlignVerticalJustifyStart, Type, Palette } from 'lucide-react';
import type { NoteType, StickyColor } from '@/types/note';

export interface PdfExportSettings {
  pageSize: 'a4' | 'letter' | 'legal' | 'a5';
  orientation: 'portrait' | 'landscape';
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  includeTitle: boolean;
  includeDate: boolean;
  includePageNumbers: boolean;
  headerText: string;
  footerText: string;
  fontSize: number;
  preserveNoteStyle: boolean;
}

interface PdfExportOptionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (settings: PdfExportSettings) => void;
  noteTitle: string;
  isExporting?: boolean;
  noteType?: NoteType;
  stickyColor?: StickyColor;
  customColor?: string;
}

const DEFAULT_SETTINGS: PdfExportSettings = {
  pageSize: 'a4',
  orientation: 'portrait',
  marginTop: 15,
  marginBottom: 15,
  marginLeft: 15,
  marginRight: 15,
  includeTitle: true,
  includeDate: true,
  includePageNumbers: true,
  headerText: '',
  footerText: '',
  fontSize: 12,
  preserveNoteStyle: true,
};

export const PdfExportOptionsSheet = ({
  isOpen,
  onClose,
  onExport,
  noteTitle,
  isExporting = false,
  noteType,
  stickyColor,
  customColor,
}: PdfExportOptionsSheetProps) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<PdfExportSettings>(DEFAULT_SETTINGS);

  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  const updateSetting = <K extends keyof PdfExportSettings>(
    key: K,
    value: PdfExportSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleExport = () => {
    onExport(settings);
  };

  const pageSizeLabels: Record<string, string> = {
    a4: 'A4 (210 × 297 mm)',
    letter: 'Letter (8.5 × 11 in)',
    legal: 'Legal (8.5 × 14 in)',
    a5: 'A5 (148 × 210 mm)',
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            {t('pdf.exportOptions', 'PDF Export Options')}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 pb-4">
          {/* Page Size & Orientation */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t('pdf.pageSettings', 'Page Settings')}
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('pdf.pageSize', 'Page Size')}</Label>
                <Select
                  value={settings.pageSize}
                  onValueChange={(value) => updateSetting('pageSize', value as PdfExportSettings['pageSize'])}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(pageSizeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('pdf.orientation', 'Orientation')}</Label>
                <Select
                  value={settings.orientation}
                  onValueChange={(value) => updateSetting('orientation', value as 'portrait' | 'landscape')}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">{t('pdf.portrait', 'Portrait')}</SelectItem>
                    <SelectItem value="landscape">{t('pdf.landscape', 'Landscape')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Margins */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Ruler className="h-4 w-4" />
              {t('pdf.margins', 'Margins (mm)')}
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('pdf.marginTop', 'Top')}</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[settings.marginTop]}
                    onValueChange={([value]) => updateSetting('marginTop', value)}
                    min={5}
                    max={50}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm w-8 text-right">{settings.marginTop}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('pdf.marginBottom', 'Bottom')}</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[settings.marginBottom]}
                    onValueChange={([value]) => updateSetting('marginBottom', value)}
                    min={5}
                    max={50}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm w-8 text-right">{settings.marginBottom}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('pdf.marginLeft', 'Left')}</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[settings.marginLeft]}
                    onValueChange={([value]) => updateSetting('marginLeft', value)}
                    min={5}
                    max={50}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm w-8 text-right">{settings.marginLeft}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('pdf.marginRight', 'Right')}</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[settings.marginRight]}
                    onValueChange={([value]) => updateSetting('marginRight', value)}
                    min={5}
                    max={50}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm w-8 text-right">{settings.marginRight}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Font Size */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Type className="h-4 w-4" />
              {t('pdf.fontSize', 'Font Size (pt)')}
            </Label>
            <div className="flex items-center gap-2">
              <Slider
                value={[settings.fontSize]}
                onValueChange={([value]) => updateSetting('fontSize', value)}
                min={8}
                max={18}
                step={1}
                className="flex-1"
              />
              <span className="text-sm w-8 text-right">{settings.fontSize}</span>
            </div>
          </div>

          {/* Header/Footer */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <AlignVerticalJustifyStart className="h-4 w-4" />
              {t('pdf.headerFooter', 'Header & Footer')}
            </Label>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">{t('pdf.includeTitle', 'Include Title')}</Label>
                <Switch
                  checked={settings.includeTitle}
                  onCheckedChange={(checked) => updateSetting('includeTitle', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label className="text-sm">{t('pdf.includeDate', 'Include Export Date')}</Label>
                <Switch
                  checked={settings.includeDate}
                  onCheckedChange={(checked) => updateSetting('includeDate', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label className="text-sm">{t('pdf.includePageNumbers', 'Include Page Numbers')}</Label>
                <Switch
                  checked={settings.includePageNumbers}
                  onCheckedChange={(checked) => updateSetting('includePageNumbers', checked)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('pdf.customHeader', 'Custom Header Text')}</Label>
                <Input
                  value={settings.headerText}
                  onChange={(e) => updateSetting('headerText', e.target.value)}
                  placeholder={t('pdf.headerPlaceholder', 'Leave empty for none')}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('pdf.customFooter', 'Custom Footer Text')}</Label>
                <Input
                  value={settings.footerText}
                  onChange={(e) => updateSetting('footerText', e.target.value)}
                  placeholder={t('pdf.footerPlaceholder', 'Leave empty for none')}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          {/* Note Style Preservation */}
          {(noteType === 'sticky' || noteType === 'lined' || customColor) && (
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Palette className="h-4 w-4" />
                {t('pdf.noteStyle', 'Note Style')}
              </Label>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">{t('pdf.preserveNoteStyle', 'Preserve Note Style')}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {noteType === 'sticky' && t('pdf.stickyStyleHint', 'Include sticky note background color')}
                    {noteType === 'lined' && t('pdf.linedStyleHint', 'Include lined paper pattern')}
                    {noteType !== 'sticky' && noteType !== 'lined' && customColor && t('pdf.customColorHint', 'Include custom background color')}
                  </p>
                </div>
                <Switch
                  checked={settings.preserveNoteStyle}
                  onCheckedChange={(checked) => updateSetting('preserveNoteStyle', checked)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={isExporting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleExport} className="flex-1" disabled={isExporting}>
            {isExporting ? t('pdf.exporting', 'Exporting...') : t('pdf.export', 'Export PDF')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
