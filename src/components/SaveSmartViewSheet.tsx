import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { DateFilter, PriorityFilter, StatusFilter } from '@/components/TaskFilterSheet';
import { addCustomSmartView } from '@/utils/customSmartViews';
import { toast } from 'sonner';
import { Bookmark, Sparkles } from 'lucide-react';

const EMOJI_OPTIONS = ['📋', '⭐', '🔥', '💡', '🎯', '📌', '🚀', '💼', '📊', '🏷️', '⚡', '🔔'];
const COLOR_OPTIONS = [
  '#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];

interface SaveSmartViewSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilters: {
    dateFilter: DateFilter;
    priorityFilter: PriorityFilter;
    statusFilter: StatusFilter;
    tags: string[];
    folderId: string | null;
  };
  onSaved: () => void;
}

export const SaveSmartViewSheet = ({
  isOpen,
  onClose,
  currentFilters,
  onSaved,
}: SaveSmartViewSheetProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('📋');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');

  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a name');
      return;
    }

    await addCustomSmartView({
      name: name.trim(),
      icon: selectedEmoji,
      color: selectedColor,
      filters: currentFilters,
    });

    toast.success(`Smart View "${name.trim()}" saved!`);
    setName('');
    setSelectedEmoji('📋');
    setSelectedColor('#3b82f6');
    onSaved();
    onClose();
  };

  const getFilterSummary = () => {
    const parts: string[] = [];
    if (currentFilters.dateFilter !== 'all') parts.push(`Date: ${currentFilters.dateFilter}`);
    if (currentFilters.priorityFilter !== 'all') parts.push(`Priority: ${currentFilters.priorityFilter}`);
    if (currentFilters.statusFilter !== 'all') parts.push(`Status: ${currentFilters.statusFilter}`);
    if (currentFilters.tags.length > 0) parts.push(`Tags: ${currentFilters.tags.join(', ')}`);
    if (currentFilters.folderId) parts.push('Folder filter active');
    return parts.length > 0 ? parts.join(' • ') : 'No filters active';
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5" />
            Save as Smart View
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 pb-4">
          {/* Filter summary */}
          <div className="p-3 rounded-xl bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground mb-1">Current filters:</p>
            <p className="text-sm font-medium">{getFilterSummary()}</p>
          </div>

          {/* Name input */}
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Urgent This Week"
              autoFocus
            />
          </div>

          {/* Emoji picker */}
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setSelectedEmoji(emoji)}
                  className={`w-10 h-10 rounded-lg text-lg flex items-center justify-center transition-all border-2 ${
                    selectedEmoji === emoji
                      ? 'border-primary bg-primary/10 scale-110'
                      : 'border-transparent bg-muted hover:bg-muted/80'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-8 h-8 rounded-full transition-all border-2 ${
                    selectedColor === color
                      ? 'border-foreground scale-110'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <Button onClick={handleSave} className="w-full" disabled={!name.trim()}>
            <Sparkles className="h-4 w-4 mr-2" />
            Save Smart View
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
