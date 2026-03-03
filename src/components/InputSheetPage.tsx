import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { X, Check } from 'lucide-react';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { cn } from '@/lib/utils';

interface InputSheetPageProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (value: string) => void;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  multiline?: boolean;
  maxLength?: number;
}

export const InputSheetPage = ({
  isOpen,
  onClose,
  onSave,
  title,
  placeholder = '',
  defaultValue = '',
  multiline = false,
  maxLength,
}: InputSheetPageProps) => {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      // Focus input after render
      setTimeout(() => {
        if (multiline) {
          textareaRef.current?.focus();
        } else {
          inputRef.current?.focus();
        }
      }, 100);
    }
  }, [isOpen, defaultValue, multiline]);

  const handleSave = () => {
    onSave(value);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-in slide-in-from-bottom duration-200" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="gap-1"
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>
        <h2 className="text-base font-semibold">{title}</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          className="gap-1 text-primary"
        >
          <Check className="h-4 w-4" />
          Save
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-auto">
        {multiline ? (
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            className="min-h-[200px] text-base resize-none"
          />
        ) : (
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            className="text-base"
          />
        )}
        {maxLength && (
          <p className="text-xs text-muted-foreground mt-2 text-right">
            {value.length}/{maxLength}
          </p>
        )}
      </div>
    </div>
  );
};
