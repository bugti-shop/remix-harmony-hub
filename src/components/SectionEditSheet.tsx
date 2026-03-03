import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { useTranslation } from 'react-i18next';

interface TaskSection {
  id: string;
  name: string;
  color: string;
  isCollapsed: boolean;
  order: number;
}

interface SectionEditSheetProps {
  isOpen: boolean;
  onClose: () => void;
  section: TaskSection | null;
  onSave: (section: TaskSection) => void;
}

const sectionColors = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#6366f1', // indigo
];

export const SectionEditSheet = ({ isOpen, onClose, section, onSave }: SectionEditSheetProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');

  // Hardware back button support - use 'sheet' priority to close sheet before navigation
  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  useEffect(() => {
    if (section) {
      setName(section.name);
      setColor(section.color);
    }
  }, [section]);

  const handleSave = () => {
    if (!section || !name.trim()) return;
    onSave({
      ...section,
      name: name.trim(),
      color,
    });
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-[20px]">
        <SheetHeader className="mb-4">
          <SheetTitle>{t('sections.editSection')}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="section-name">{t('sections.sectionName')}</Label>
            <Input
              id="section-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('sections.enterSectionName')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('sections.sectionColor')}</Label>
            <div className="flex flex-wrap gap-2">
              {sectionColors.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} className="flex-1" disabled={!name.trim()}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
