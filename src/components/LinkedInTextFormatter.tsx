/**
 * LinkedIn-style Text Formatter Component
 * Formats text using Unicode characters that work on LinkedIn, WhatsApp, Twitter, etc.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Bold, 
  Italic, 
  Underline, 
  Smile, 
  Link2, 
  Undo, 
  Redo, 
  Eraser,
  List,
  ListOrdered,
  Copy,
  Check,
  Type,
  ChevronDown,
  TextSelect
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  toUnicodeStyle,
  toBulletList,
  toNumberedList,
  toCheckboxList,
  removeUnicodeFormatting,
  copyStyledText,
  convertPreservingEmphasis,
  availableStyles,
  UnicodeStyle,
} from '@/utils/unicodeTextFormatter';
import { EmojiPicker } from '@/components/EmojiPicker';

interface LinkedInTextFormatterProps {
  initialContent?: string;
  onContentChange?: (content: string) => void;
  placeholder?: string;
  className?: string;
}

// Style variants to show automatically
const autoVariantKeys: { id: UnicodeStyle | 'normal' | 'bullet' | 'numbered'; nameKey: string }[] = [
  { id: 'normal', nameKey: 'linkedinFormatter.styles.normal' },
  { id: 'bold', nameKey: 'linkedinFormatter.styles.bold' },
  { id: 'sansNormal', nameKey: 'linkedinFormatter.styles.sansSerif' },
  { id: 'boldSans', nameKey: 'linkedinFormatter.styles.boldSans' },
  { id: 'italic', nameKey: 'linkedinFormatter.styles.italic' },
  { id: 'italicSans', nameKey: 'linkedinFormatter.styles.italicSans' },
  { id: 'boldItalic', nameKey: 'linkedinFormatter.styles.boldItalic' },
  { id: 'boldItalicSans', nameKey: 'linkedinFormatter.styles.boldItalicSans' },
  { id: 'script', nameKey: 'linkedinFormatter.styles.script' },
  { id: 'bullet', nameKey: 'linkedinFormatter.styles.bulletPoints' },
  { id: 'numbered', nameKey: 'linkedinFormatter.styles.numberedList' },
];

// Variant card component
const VariantCard = ({ 
  name, 
  text, 
  onCopy,
  copiedLabel,
  copyLabel,
}: { 
  name: string; 
  text: string; 
  onCopy: () => void;
  copiedLabel: string;
  copyLabel: string;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyStyledText(text);
    if (success) {
      setCopied(true);
      onCopy();
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="border rounded-lg bg-card">
      <div className="px-3 py-2 border-b bg-muted/30">
        <span className="text-sm font-medium text-foreground">{name}</span>

      </div>
      <div className="p-3 min-h-[80px] max-h-[150px] overflow-y-auto">
        <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
          {text}
        </p>
      </div>
      <div className="p-2 border-t">
        <Button
          variant="default"
          size="sm"
          onClick={handleCopy}
          className="w-full gap-2"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              {copiedLabel}
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              {copyLabel}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export const LinkedInTextFormatter = ({
  initialContent = '',
  onContentChange,
  placeholder = 'Write here...',
  className,
}: LinkedInTextFormatterProps) => {
  const { t } = useTranslation();
  const [content, setContent] = useState(initialContent);
  const [history, setHistory] = useState<string[]>([initialContent]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [showVariants, setShowVariants] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Generate all variants based on current content (preserving user's text as-is)
  const variants = useMemo(() => {
    if (!content.trim()) return [];
    
    // Use the content as-is (with any formatting the user has applied)
    // This way, when user applies bold/italic etc., all variants show that styling
    const textToUse = content;
    
    return autoVariantKeys.map(variant => {
      let styledText: string;
      
      switch (variant.id) {
        case 'normal':
          // Strip bold/italic but keep underline/strikethrough
          styledText = removeUnicodeFormatting(textToUse, true);
          break;
        case 'bullet':
          styledText = textToUse.split('\n').filter(line => line.trim()).map(line => `• ${line.trim()}`).join('\n');
          break;
        case 'numbered':
          styledText = textToUse.split('\n').filter(line => line.trim()).map((line, i) => `${i + 1}. ${line.trim()}`).join('\n');
          break;
        default:
          // Convert preserving per-character emphasis (bold/italic applied by user)
          styledText = convertPreservingEmphasis(textToUse, variant.id);
      }
      
      return {
        name: t(variant.nameKey),
        text: styledText,
      };
    });
  }, [content]);

  // Update content and history
  const updateContent = useCallback((newContent: string) => {
    setContent(newContent);
    onContentChange?.(newContent);
    
    // Add to history (limit to 50 entries)
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newContent);
      return newHistory.slice(-50);
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex, onContentChange]);

  // Get selected text
  const getSelection = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return { text: '', start: 0, end: 0 };
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = content.substring(start, end);
    
    return { text, start, end };
  }, [content]);

  // Apply style to selection
  const applyStyle = useCallback((style: UnicodeStyle) => {
    const { text, start, end } = getSelection();
    
    if (!text) {
      toast.error(t('linkedinFormatter.selectTextFirst'));
      return;
    }
    
    const styledText = toUnicodeStyle(text, style);
    const newContent = content.substring(0, start) + styledText + content.substring(end);
    updateContent(newContent);
    
    // Restore focus and selection
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(start, start + styledText.length);
    }, 0);
  }, [content, getSelection, updateContent]);

  // Apply list formatting
  const applyListFormat = useCallback((type: 'bullet' | 'numbered' | 'checkbox') => {
    const { text, start, end } = getSelection();
    const textToFormat = text || content;
    
    let formattedText: string;
    switch (type) {
      case 'bullet':
        formattedText = toBulletList(textToFormat);
        break;
      case 'numbered':
        formattedText = toNumberedList(textToFormat);
        break;
      case 'checkbox':
        formattedText = toCheckboxList(textToFormat);
        break;
    }
    
    if (text) {
      const newContent = content.substring(0, start) + formattedText + content.substring(end);
      updateContent(newContent);
    } else {
      updateContent(formattedText);
    }
  }, [content, getSelection, updateContent]);

  // Clear formatting
  const clearFormatting = useCallback(() => {
    const { text, start, end } = getSelection();
    
    if (text) {
      const plainText = removeUnicodeFormatting(text);
      const newContent = content.substring(0, start) + plainText + content.substring(end);
      updateContent(newContent);
    } else {
      updateContent(removeUnicodeFormatting(content));
    }
    
    toast.success(t('linkedinFormatter.formattingCleared'));
  }, [content, getSelection, updateContent]);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setContent(history[newIndex]);
      onContentChange?.(history[newIndex]);
    }
  }, [history, historyIndex, onContentChange]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setContent(history[newIndex]);
      onContentChange?.(history[newIndex]);
    }
  }, [history, historyIndex, onContentChange]);

  // Copy content
  const copyContent = useCallback(async () => {
    const success = await copyStyledText(content);
    if (success) {
      setCopied(true);
      toast.success(t('linkedinFormatter.copiedPaste'));
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error(t('linkedinFormatter.failedToCopy'));
    }
  }, [content]);

  // Insert emoji
  const insertEmoji = useCallback((emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const newContent = content.substring(0, start) + emoji + content.substring(start);
    updateContent(newContent);
    setShowEmojiPicker(false);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  }, [content, updateContent]);

  // Insert link
  const insertLink = useCallback(() => {
    const url = prompt('Enter URL:');
    if (!url) return;
    
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    // If text is selected, wrap it; otherwise just insert the URL
    const linkText = selectedText ? `${selectedText} (${url})` : url;
    const newContent = content.substring(0, start) + linkText + content.substring(end);
    updateContent(newContent);
  }, [content, updateContent]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!textareaRef.current?.contains(document.activeElement)) return;
      
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            applyStyle('bold');
            break;
          case 'i':
            e.preventDefault();
            applyStyle('italic');
            break;
          case 'u':
            e.preventDefault();
            applyStyle('underline');
            break;
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              redo();
            } else {
              undo();
            }
            break;
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [applyStyle, undo, redo]);

  return (
    <ScrollArea className={cn('flex-1 h-full', className)}>
      <div className="flex flex-col bg-background rounded-xl border">
        {/* Toolbar */}
        <div className="flex items-center gap-1 p-2 border-b flex-wrap sticky top-0 bg-background z-10">
        {/* Basic formatting */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => applyStyle('bold')}
            title={`${t('common.bold', 'Bold')} (Ctrl+B)`}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => applyStyle('italic')}
            title={`${t('common.italic', 'Italic')} (Ctrl+I)`}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => applyStyle('underline')}
            title={`${t('common.underline', 'Underline')} (Ctrl+U)`}
          >
            <Underline className="h-4 w-4" />
          </Button>
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        {/* More styles */}
        <Popover open={showStylePicker} onOpenChange={setShowStylePicker}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title={t('common.moreStyles')}>
              <Type className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <ScrollArea className="h-64">
              <div className="space-y-1">
                {availableStyles.map(style => (
                  <button
                    key={style.id}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted text-left"
                    onClick={() => {
                      applyStyle(style.id);
                      setShowStylePicker(false);
                    }}
                  >
                    <span className="text-sm">{style.name}</span>
                    <span className="text-sm text-muted-foreground">{style.example}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {/* Emoji */}
        <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title={t('common.emoji')}>
              <Smile className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <EmojiPicker onEmojiSelect={(emoji) => {
              insertEmoji(emoji);
              setShowEmojiPicker(false);
            }} />
          </PopoverContent>
        </Popover>

        {/* Link */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={insertLink}
          title={t('common.insertLink')}
        >
          <Link2 className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Undo/Redo */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={undo}
          disabled={historyIndex <= 0}
          title={`${t('common.undo', 'Undo')} (Ctrl+Z)`}
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={redo}
          disabled={historyIndex >= history.length - 1}
          title={`${t('common.redo', 'Redo')} (Ctrl+Shift+Z)`}
        >
          <Redo className="h-4 w-4" />
        </Button>

        {/* Clear formatting */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={clearFormatting}
          title={t('common.clearFormatting')}
        >
          <Eraser className="h-4 w-4" />
        </Button>

        {/* Select All */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => {
            textareaRef.current?.focus();
            textareaRef.current?.setSelectionRange(0, content.length);
          }}
          title={t('common.selectAllText')}
          disabled={!content}
        >
          <TextSelect className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Lists */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => applyListFormat('bullet')}
          title={t('common.bulletList')}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => applyListFormat('numbered')}
          title={t('common.numberedList')}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
      </div>

      {/* Text area */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => updateContent(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-h-[250px] p-4 bg-transparent resize-none focus:outline-none text-foreground placeholder:text-muted-foreground text-base leading-relaxed"
      />

      {/* Footer with copy button */}
      <div className="flex items-center justify-between p-3 border-t">
        <span className="text-xs text-muted-foreground">
          {t('linkedinFormatter.characters', { count: content.length })}
        </span>
        <Button
          variant="default"
          size="sm"
          onClick={copyContent}
          className="gap-2"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              {t('linkedinFormatter.copied')}
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              {t('linkedinFormatter.copyText')}
            </>
          )}
        </Button>
      </div>

      {/* Auto-generated Style Variants */}
      {variants.length > 0 && (
        <div className="border-t">
          <button
            onClick={() => setShowVariants(!showVariants)}
            className="w-full p-3 bg-muted/30 border-b flex items-center justify-between hover:bg-muted/50 transition-colors"
          >
            <div className="text-left">
              <h3 className="text-sm font-medium text-foreground">{t('linkedinFormatter.styleVariants')}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('linkedinFormatter.styleVariantsDesc')}
              </p>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showVariants ? 'rotate-180' : ''}`} />
          </button>
          {showVariants && (
            <div className="p-3 grid gap-3">
              {variants.map((variant, index) => (
                <VariantCard
                  key={index}
                  name={variant.name}
                  text={variant.text}
                  copiedLabel={t('linkedinFormatter.copied')}
                  copyLabel={t('linkedinFormatter.copyText')}
                  onCopy={() => toast.success(t('linkedinFormatter.variantCopied', { name: variant.name }))}
                />
              ))}
            </div>
          )}
        </div>
      )}
      </div>
    </ScrollArea>
  );
};

export default LinkedInTextFormatter;
