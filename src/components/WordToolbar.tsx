import { useCallback, useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Subscript,
  Superscript,
  RemoveFormatting,
  Code,
  Minus,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  List,
  ListOrdered,
  Highlighter,
  Undo,
  Redo,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Table,
  Paperclip,
  Heading1,
  Link2,
  ZoomIn,
  ZoomOut,
  PilcrowLeft,
  PilcrowRight,
  Plus,
  Mic,
  CheckSquare,
  ChevronDown,
  Indent,
  Outdent,
} from 'lucide-react';
import { EmojiPicker } from './EmojiPicker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface WordToolbarProps {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onStrikethrough?: () => void;
  onSubscript?: () => void;
  onSuperscript?: () => void;
  onClearFormatting?: () => void;
  onCodeBlock?: () => void;
  onHorizontalRule?: () => void;
  onBlockquote?: () => void;
  onTextColor: (color: string) => void;
  onHighlight: (color: string) => void;
  onBulletList: () => void;
  onNumberedList: () => void;
  onImageUpload: () => void;
  onTableInsert: (rows: number, cols: number, style?: string) => void;
  onAlignLeft: () => void;
  onAlignCenter: () => void;
  onAlignRight: () => void;
  onAlignJustify: () => void;
  onTextCase: (caseType: 'upper' | 'lower' | 'capitalize') => void;
  onFontFamily?: (font: string) => void;
  onFontSize?: (size: string) => void;
  onGlobalFontSizeChange?: (size: string) => void;
  onHeading: (level: 1 | 2 | 3 | 'p') => void;
  currentFontFamily?: string;
  currentFontSize?: string;
  onInsertLink?: () => void;
  onInsertNoteLink?: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  isStickyNote?: boolean;
  allowImages?: boolean;
  showTable?: boolean;
  onComment?: () => void;
  onTextDirection?: (dir: 'ltr' | 'rtl') => void;
  textDirection?: 'ltr' | 'rtl';
  onAttachment?: () => void;
  onVoiceRecord?: () => void;
  onEmojiInsert?: (emoji: string) => void;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isStrikethrough?: boolean;
  isSubscript?: boolean;
  isSuperscript?: boolean;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  isBulletList?: boolean;
  isNumberedList?: boolean;
  onIndent?: () => void;
  onOutdent?: () => void;
  onChecklist?: () => void;
  isChecklist?: boolean;
}

// Toolbar order types
type ToolbarItemId =
  | 'bold' | 'italic' | 'underline' | 'strikethrough' | 'subscript' | 'superscript'
  | 'clearFormatting' | 'codeBlock' | 'horizontalRule' | 'blockquote' | 'emoji'
  | 'bulletList' | 'numberedList' | 'image' | 'table' | 'highlight' | 'textColor'
  | 'undo' | 'redo' | 'alignLeft' | 'alignCenter' | 'alignRight' | 'alignJustify'
  | 'fontFamily' | 'fontSize' | 'headings' | 'textCase' | 'textDirection'
  | 'comment' | 'link' | 'noteLink' | 'attachment' | 'zoom';

const DEFAULT_TOOLBAR_ORDER: ToolbarItemId[] = [
  'bold', 'italic', 'underline', 'fontFamily', 'fontSize', 'highlight', 'textColor',
  'image', 'table', 'bulletList', 'numberedList',
  'strikethrough', 'subscript', 'superscript',
  'clearFormatting', 'codeBlock', 'horizontalRule', 'blockquote', 'emoji',
  'undo', 'redo', 'alignLeft', 'alignCenter', 'alignRight', 'alignJustify',
  'headings', 'textCase', 'textDirection',
  'comment', 'link', 'noteLink', 'attachment', 'zoom'
];

let cachedToolbarOrder: ToolbarItemId[] = [...DEFAULT_TOOLBAR_ORDER];
let cachedToolbarVisibility: Record<ToolbarItemId, boolean> = DEFAULT_TOOLBAR_ORDER.reduce(
  (acc, id) => ({ ...acc, [id]: true }),
  {} as Record<ToolbarItemId, boolean>
);

export const setCachedToolbarOrder = (order: ToolbarItemId[]) => {
  cachedToolbarOrder = [...order];
};

export const getCachedToolbarOrder = (): ToolbarItemId[] => {
  return cachedToolbarOrder;
};

export const setCachedToolbarVisibility = (visibility: Record<ToolbarItemId, boolean>) => {
  cachedToolbarVisibility = visibility;
};

export const isToolbarItemVisible = (itemId: ToolbarItemId): boolean => {
  return cachedToolbarVisibility[itemId] ?? true;
};

// Initialize visibility and order from stored settings
const initToolbarSettings = async () => {
  try {
    const storedVisibility = localStorage.getItem('settings_wordToolbarVisibility');
    if (storedVisibility) {
      const parsed = JSON.parse(storedVisibility);
      if (parsed && typeof parsed === 'object') {
        cachedToolbarVisibility = { ...cachedToolbarVisibility, ...parsed };
      }
    }
    const storedOrder = localStorage.getItem('settings_wordToolbarOrder');
    if (storedOrder) {
      const parsed = JSON.parse(storedOrder);
      if (Array.isArray(parsed)) {
        const existing = new Set(parsed);
        const merged = [...parsed];
        DEFAULT_TOOLBAR_ORDER.forEach(item => {
          if (!existing.has(item)) merged.push(item);
        });
        cachedToolbarOrder = merged;
      }
    }
  } catch {}
};

initToolbarSettings();

const TEXT_COLORS = [
  '#000000', '#1F2937', '#374151', '#4B5563', '#6B7280', '#9CA3AF',
  '#D1D5DB', '#E5E7EB', '#F3F4F6', '#FFFFFF',
  '#7F1D1D', '#991B1B', '#B91C1C', '#DC2626', '#EF4444', '#F87171',
  '#7C2D12', '#9A3412', '#C2410C', '#EA580C', '#F97316', '#FB923C',
  '#713F12', '#A16207', '#CA8A04', '#EAB308', '#FACC15',
  '#14532D', '#166534', '#15803D', '#16A34A', '#22C55E', '#4ADE80', '#86EFAC',
  '#134E4A', '#115E59', '#0D9488', '#14B8A6', '#2DD4BF',
  '#164E63', '#0E7490', '#0891B2', '#06B6D4', '#22D3EE',
  '#1E3A8A', '#1D4ED8', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD',
  '#312E81', '#4338CA', '#4F46E5', '#6366F1', '#818CF8',
  '#581C87', '#7E22CE', '#9333EA', '#A855F7', '#C084FC',
  '#831843', '#BE185D', '#DB2777', '#EC4899', '#F472B6',
];

const HIGHLIGHT_COLORS = [
  'transparent',
  '#FEF9C3', '#FEF08A', '#FDE047', '#FACC15', '#EAB308', '#CA8A04',
  '#FFEDD5', '#FED7AA', '#FDBA74', '#FB923C', '#F97316', '#EA580C',
  '#FEE2E2', '#FECACA', '#FCA5A5', '#F87171', '#EF4444', '#DC2626',
  '#FFE4E6', '#FECDD3', '#FDA4AF', '#FB7185', '#F43F5E', '#E11D48',
  '#FCE7F3', '#FBCFE8', '#F9A8D4', '#F472B6', '#EC4899', '#DB2777',
  '#FAE8FF', '#F5D0FE', '#F0ABFC', '#E879F9', '#D946EF', '#C026D3',
  '#F3E8FF', '#E9D5FF', '#D8B4FE', '#C084FC', '#A855F7', '#9333EA',
  '#EDE9FE', '#DDD6FE', '#C4B5FD', '#A78BFA', '#8B5CF6', '#7C3AED',
  '#E0E7FF', '#C7D2FE', '#A5B4FC', '#818CF8', '#6366F1', '#4F46E5',
  '#DBEAFE', '#BFDBFE', '#93C5FD', '#60A5FA', '#3B82F6', '#2563EB',
  '#CFFAFE', '#A5F3FC', '#67E8F9', '#22D3EE', '#06B6D4', '#0891B2',
  '#CCFBF1', '#99F6E4', '#5EEAD4', '#2DD4BF', '#14B8A6', '#0D9488',
  '#DCFCE7', '#BBF7D0', '#86EFAC', '#4ADE80', '#22C55E', '#16A34A',
  '#ECFCCB', '#D9F99D', '#BEF264', '#A3E635', '#84CC16', '#65A30D',
];

const FONT_FAMILIES = [
  { name: 'Default', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Times', value: '"Times New Roman", serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Courier', value: '"Courier New", monospace' },
  { name: 'Verdana', value: 'Verdana, sans-serif' },
];

const FONT_SIZES = ['10', '12', '14', '16', '18', '20', '24', '28', '32', '36', '48'];

export const WordToolbar = ({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onBold,
  onItalic,
  onUnderline,
  onStrikethrough,
  onSubscript,
  onSuperscript,
  onClearFormatting,
  onCodeBlock,
  onHorizontalRule,
  onBlockquote,
  onTextColor,
  onHighlight,
  onBulletList,
  onNumberedList,
  onImageUpload,
  onTableInsert,
  onAlignLeft,
  onAlignCenter,
  onAlignRight,
  onAlignJustify,
  onTextCase,
  onFontFamily,
  onFontSize,
  onHeading,
  currentFontFamily,
  currentFontSize = '16',
  onInsertLink,
  onInsertNoteLink,
  zoom,
  onZoomChange,
  isStickyNote = false,
  allowImages = true,
  showTable = true,
  onComment,
  onTextDirection,
  textDirection = 'ltr',
  onAttachment,
  onVoiceRecord,
  onEmojiInsert,
  isBold = false,
  isItalic = false,
  isUnderline = false,
  isStrikethrough = false,
  isSubscript = false,
  isSuperscript = false,
  alignment = 'left',
  isBulletList = false,
  isNumberedList = false,
  onIndent,
  onOutdent,
  onChecklist,
  isChecklist = false,
}: WordToolbarProps) => {
  const { t } = useTranslation();
  const [fontSizeOpen, setFontSizeOpen] = useState(false);
  const [fontFamilyOpen, setFontFamilyOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [tableOpen, setTableOpen] = useState(false);
  const [textColorOpen, setTextColorOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [headingOpen, setHeadingOpen] = useState(false);
  const [alignOpen, setAlignOpen] = useState(false);
  const [selectedTextColor, setSelectedTextColor] = useState('#000000');
  const [selectedHighlight, setSelectedHighlight] = useState('transparent');
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const handleVisibilityChange = (event: CustomEvent<{ visibility: Record<ToolbarItemId, boolean> }>) => {
      setCachedToolbarVisibility(event.detail.visibility);
      forceUpdate(n => n + 1);
    };
    const handleOrderChange = (event: CustomEvent<{ order: ToolbarItemId[] }>) => {
      setCachedToolbarOrder(event.detail.order);
      forceUpdate(n => n + 1);
    };

    window.addEventListener('toolbarVisibilityChanged', handleVisibilityChange as EventListener);
    window.addEventListener('toolbarOrderChanged', handleOrderChange as EventListener);
    return () => {
      window.removeEventListener('toolbarVisibilityChanged', handleVisibilityChange as EventListener);
      window.removeEventListener('toolbarOrderChanged', handleOrderChange as EventListener);
    };
  }, []);

  const IconBtn = ({
    onClick,
    disabled,
    title,
    active = false,
    children,
  }: {
    onClick?: () => void;
    disabled?: boolean;
    title: string;
    active?: boolean;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => e.preventDefault()}
      disabled={disabled}
      title={title}
      className={cn(
        "h-11 w-11 flex items-center justify-center rounded transition-colors flex-shrink-0",
        "hover:bg-muted/80 active:bg-muted",
        active && "bg-primary/10 text-primary",
        disabled && "opacity-40 pointer-events-none"
      )}
    >
      {children}
    </button>
  );

  const Sep = () => <div className="w-px h-7 bg-border/50 mx-0.5 flex-shrink-0" />;

  const getItemOrder = (itemId: ToolbarItemId): number => {
    const idx = cachedToolbarOrder.indexOf(itemId);
    return idx >= 0 ? idx : 999;
  };

  const OrderedItem = ({ id, children }: { id: ToolbarItemId; children: React.ReactNode }) => (
    <div style={{ order: getItemOrder(id) }} className="flex items-center flex-shrink-0">
      {children}
    </div>
  );

  return (
    <div className={cn(
      "border-t border-border/40",
      isStickyNote ? "bg-background" : "bg-muted/20"
    )}>
      <div className="flex items-center gap-0 px-1 overflow-x-auto scrollbar-hide h-12" data-tour="word-toolbar">
        
        {isToolbarItemVisible('undo') && (
          <OrderedItem id="undo">
            <IconBtn onClick={onUndo} disabled={!canUndo} title={t('wordToolbar.undo')}>
              <Undo className="h-5 w-5" strokeWidth={2} />
            </IconBtn>
          </OrderedItem>
        )}
        {isToolbarItemVisible('redo') && (
          <OrderedItem id="redo">
            <IconBtn onClick={onRedo} disabled={!canRedo} title={t('wordToolbar.redo')}>
              <Redo className="h-5 w-5" strokeWidth={2} />
            </IconBtn>
          </OrderedItem>
        )}

        {onFontSize && isToolbarItemVisible('fontSize') && (
          <OrderedItem id="fontSize">
            <Popover open={fontSizeOpen} onOpenChange={setFontSizeOpen}>
              <PopoverTrigger asChild>
                <button type="button" title={t('wordToolbar.fontSize')} className="h-11 px-2.5 flex items-center gap-0.5 rounded hover:bg-muted/80 transition-colors flex-shrink-0 text-sm font-semibold">
                  {currentFontSize}
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" strokeWidth={2} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-20 p-1" align="start">
                <div className="max-h-48 overflow-y-auto">
                  {FONT_SIZES.map((size) => (
                    <button key={size} type="button" onClick={() => { onFontSize(size); setFontSizeOpen(false); }} className={cn("w-full px-2 py-1.5 text-sm text-left rounded hover:bg-muted transition-colors", currentFontSize === size && "bg-primary/10 text-primary font-medium")}>{size}</button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </OrderedItem>
        )}

        {onFontFamily && isToolbarItemVisible('fontFamily') && (
          <OrderedItem id="fontFamily">
            <Popover open={fontFamilyOpen} onOpenChange={setFontFamilyOpen}>
              <PopoverTrigger asChild>
                <button type="button" title={t('wordToolbar.font')} className="h-11 w-11 flex items-center justify-center rounded hover:bg-muted/80 transition-colors flex-shrink-0">
                  <Type className="h-5 w-5" strokeWidth={2} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-1" align="start">
                {FONT_FAMILIES.map((font) => (
                  <button key={font.value} type="button" onClick={() => { onFontFamily(font.value); setFontFamilyOpen(false); }} style={{ fontFamily: font.value }} className={cn("w-full px-2 py-1.5 text-sm text-left rounded hover:bg-muted transition-colors", currentFontFamily === font.value && "bg-primary/10 text-primary")}>{font.name}</button>
                ))}
              </PopoverContent>
            </Popover>
          </OrderedItem>
        )}

        {isToolbarItemVisible('bold') && (
          <OrderedItem id="bold">
            <IconBtn onClick={onBold} title={t('wordToolbar.bold')} active={isBold}>
              <Bold className="h-5 w-5" strokeWidth={isBold ? 2.5 : 2} />
            </IconBtn>
          </OrderedItem>
        )}
        {isToolbarItemVisible('italic') && (
          <OrderedItem id="italic">
            <IconBtn onClick={onItalic} title={t('wordToolbar.italic')} active={isItalic}>
              <Italic className="h-5 w-5" strokeWidth={isItalic ? 2.5 : 2} />
            </IconBtn>
          </OrderedItem>
        )}
        {isToolbarItemVisible('underline') && (
          <OrderedItem id="underline">
            <IconBtn onClick={onUnderline} title={t('wordToolbar.underline')} active={isUnderline}>
              <UnderlineIcon className="h-5 w-5" strokeWidth={isUnderline ? 2.5 : 2} />
            </IconBtn>
          </OrderedItem>
        )}
        {onStrikethrough && isToolbarItemVisible('strikethrough') && (
          <OrderedItem id="strikethrough">
            <IconBtn onClick={onStrikethrough} title={t('wordToolbar.strikethrough')} active={isStrikethrough}>
              <Strikethrough className="h-5 w-5" strokeWidth={isStrikethrough ? 2.5 : 2} />
            </IconBtn>
          </OrderedItem>
        )}

        {isToolbarItemVisible('textColor') && (
          <OrderedItem id="textColor">
            <Popover open={textColorOpen} onOpenChange={setTextColorOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  title={t('wordToolbar.textColor')}
                  onMouseDown={(e) => e.preventDefault()}
                  onPointerDown={(e) => e.preventDefault()}
                  className="h-11 w-11 flex flex-col items-center justify-center gap-0.5 rounded hover:bg-muted/80 transition-colors flex-shrink-0"
                >
                  <span className="text-base font-semibold leading-none">A</span>
                  <div className="h-1.5 w-5 rounded-full" style={{ backgroundColor: selectedTextColor }} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2 max-h-72 overflow-y-auto" align="start" onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}>
                <div className="grid grid-cols-10 gap-1">
                  {TEXT_COLORS.map((color) => (
                    <button key={color} type="button" onPointerDown={(e) => { e.preventDefault(); onTextColor(color); setSelectedTextColor(color); setTextColorOpen(false); }} className={cn("h-6 w-6 rounded border border-border/50 hover:scale-110 transition-transform", selectedTextColor === color && "ring-2 ring-primary ring-offset-1", color === '#FFFFFF' && "border-border")} style={{ backgroundColor: color }} title={color} />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </OrderedItem>
        )}

        {isToolbarItemVisible('highlight') && (
          <OrderedItem id="highlight">
            <Popover open={highlightOpen} onOpenChange={setHighlightOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  title={t('wordToolbar.highlight')}
                  onMouseDown={(e) => e.preventDefault()}
                  onPointerDown={(e) => e.preventDefault()}
                  className="h-11 w-11 flex items-center justify-center rounded hover:bg-muted/80 transition-colors flex-shrink-0"
                >
                  <Highlighter className="h-5 w-5" strokeWidth={2} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2 max-h-64 overflow-y-auto" align="start" onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}>
                <div className="grid grid-cols-6 gap-1">
                  {HIGHLIGHT_COLORS.map((color) => (
                    <button key={color} type="button" onPointerDown={(e) => { e.preventDefault(); onHighlight(color); setSelectedHighlight(color); setHighlightOpen(false); }} className={cn("h-6 w-6 rounded border border-border/50 hover:scale-110 transition-transform", color === 'transparent' && "bg-[repeating-linear-gradient(45deg,#ccc,#ccc_2px,#fff_2px,#fff_4px)]", selectedHighlight === color && "ring-2 ring-primary ring-offset-1")} style={{ backgroundColor: color === 'transparent' ? undefined : color }} title={color === 'transparent' ? 'None' : color} />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </OrderedItem>
        )}

        {isToolbarItemVisible('bulletList') && (
          <OrderedItem id="bulletList">
            <IconBtn onClick={onBulletList} title={t('wordToolbar.bulletList')} active={isBulletList}>
              <List className="h-5 w-5" strokeWidth={2} />
            </IconBtn>
          </OrderedItem>
        )}
        {isToolbarItemVisible('numberedList') && (
          <OrderedItem id="numberedList">
            <IconBtn onClick={onNumberedList} title={t('wordToolbar.numberedList')} active={isNumberedList}>
              <ListOrdered className="h-5 w-5" strokeWidth={2} />
            </IconBtn>
          </OrderedItem>
        )}
        {onChecklist && (
          <div style={{ order: getItemOrder('checklist' as ToolbarItemId) }} className="flex items-center flex-shrink-0">
            <IconBtn onClick={onChecklist} title={t('wordToolbar.checklist')} active={isChecklist}>
              <CheckSquare className="h-5 w-5" strokeWidth={2} />
            </IconBtn>
          </div>
        )}

        {(isToolbarItemVisible('alignLeft') || isToolbarItemVisible('alignCenter') || isToolbarItemVisible('alignRight') || isToolbarItemVisible('alignJustify')) && (
          <OrderedItem id="alignLeft">
            <Popover open={alignOpen} onOpenChange={setAlignOpen}>
              <PopoverTrigger asChild>
                <button type="button" title={t('wordToolbar.alignment')} className="h-11 w-11 flex items-center justify-center rounded hover:bg-muted/80 transition-colors flex-shrink-0">
                  {alignment === 'left' && <AlignLeft className="h-5 w-5" strokeWidth={2} />}
                  {alignment === 'center' && <AlignCenter className="h-5 w-5" strokeWidth={2} />}
                  {alignment === 'right' && <AlignRight className="h-5 w-5" strokeWidth={2} />}
                  {alignment === 'justify' && <AlignJustify className="h-5 w-5" strokeWidth={2} />}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-1" align="start">
                <div className="flex gap-0.5">
                  <IconBtn onClick={() => { onAlignLeft(); setAlignOpen(false); }} title={t('wordToolbar.left')} active={alignment === 'left'}><AlignLeft className="h-5 w-5" strokeWidth={2} /></IconBtn>
                  <IconBtn onClick={() => { onAlignCenter(); setAlignOpen(false); }} title={t('wordToolbar.center')} active={alignment === 'center'}><AlignCenter className="h-5 w-5" strokeWidth={2} /></IconBtn>
                  <IconBtn onClick={() => { onAlignRight(); setAlignOpen(false); }} title={t('wordToolbar.right')} active={alignment === 'right'}><AlignRight className="h-5 w-5" strokeWidth={2} /></IconBtn>
                  <IconBtn onClick={() => { onAlignJustify(); setAlignOpen(false); }} title={t('wordToolbar.justify')} active={alignment === 'justify'}><AlignJustify className="h-5 w-5" strokeWidth={2} /></IconBtn>
                </div>
              </PopoverContent>
            </Popover>
          </OrderedItem>
        )}

        {onOutdent && (
          <div style={{ order: 998 }} className="flex items-center flex-shrink-0">
            <IconBtn onClick={onOutdent} title={t('wordToolbar.decreaseIndent')}><Outdent className="h-5 w-5" strokeWidth={2} /></IconBtn>
          </div>
        )}
        {onIndent && (
          <div style={{ order: 998 }} className="flex items-center flex-shrink-0">
            <IconBtn onClick={onIndent} title={t('wordToolbar.increaseIndent')}><Indent className="h-5 w-5" strokeWidth={2} /></IconBtn>
          </div>
        )}

        {showTable && isToolbarItemVisible('table') && (
          <OrderedItem id="table">
            <Popover open={tableOpen} onOpenChange={setTableOpen}>
              <PopoverTrigger asChild>
                <button type="button" title={t('wordToolbar.insertTable')} className="h-11 w-11 flex items-center justify-center rounded hover:bg-muted/80 transition-colors flex-shrink-0">
                  <Table className="h-5 w-5" strokeWidth={2} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-3" align="start">
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">{t('wordToolbar.insertTable')}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span>{t('wordToolbar.rows')}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setTableRows(Math.max(1, tableRows - 1))} className="h-6 w-6 flex items-center justify-center rounded border hover:bg-muted"><Minus className="h-3 w-3" /></button>
                      <span className="w-6 text-center font-semibold">{tableRows}</span>
                      <button type="button" onClick={() => setTableRows(Math.min(10, tableRows + 1))} className="h-6 w-6 flex items-center justify-center rounded border hover:bg-muted"><Plus className="h-3 w-3" /></button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>{t('wordToolbar.cols')}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setTableCols(Math.max(1, tableCols - 1))} className="h-6 w-6 flex items-center justify-center rounded border hover:bg-muted"><Minus className="h-3 w-3" /></button>
                      <span className="w-6 text-center font-semibold">{tableCols}</span>
                      <button type="button" onClick={() => setTableCols(Math.min(8, tableCols + 1))} className="h-6 w-6 flex items-center justify-center rounded border hover:bg-muted"><Plus className="h-3 w-3" /></button>
                    </div>
                  </div>
                  <button type="button" onClick={() => { onTableInsert(tableRows, tableCols); setTableOpen(false); }} className="w-full h-8 text-sm font-semibold bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors">{t('wordToolbar.insert')}</button>
                </div>
              </PopoverContent>
            </Popover>
          </OrderedItem>
        )}

        {allowImages && isToolbarItemVisible('image') && (
          <OrderedItem id="image">
            <IconBtn onClick={onImageUpload} title={t('wordToolbar.insertImage')}><ImageIcon className="h-5 w-5" strokeWidth={2} /></IconBtn>
          </OrderedItem>
        )}

        {onHorizontalRule && isToolbarItemVisible('horizontalRule') && (
          <OrderedItem id="horizontalRule">
            <IconBtn onClick={onHorizontalRule} title={t('wordToolbar.horizontalLine')}><Minus className="h-5 w-5" strokeWidth={2} /></IconBtn>
          </OrderedItem>
        )}

        {isToolbarItemVisible('headings') && (
          <OrderedItem id="headings">
            <Popover open={headingOpen} onOpenChange={setHeadingOpen}>
              <PopoverTrigger asChild>
                <button type="button" title={t('wordToolbar.headings')} className="h-11 w-11 flex items-center justify-center rounded hover:bg-muted/80 transition-colors flex-shrink-0">
                  <Heading1 className="h-5 w-5" strokeWidth={2} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-32 p-1" align="start">
                <button type="button" onClick={() => { onHeading(1); setHeadingOpen(false); }} className="w-full px-2 py-1.5 text-left text-lg font-bold rounded hover:bg-muted">{t('wordToolbar.heading1')}</button>
                <button type="button" onClick={() => { onHeading(2); setHeadingOpen(false); }} className="w-full px-2 py-1.5 text-left text-base font-bold rounded hover:bg-muted">{t('wordToolbar.heading2')}</button>
                <button type="button" onClick={() => { onHeading(3); setHeadingOpen(false); }} className="w-full px-2 py-1.5 text-left text-sm font-semibold rounded hover:bg-muted">{t('wordToolbar.heading3')}</button>
                <button type="button" onClick={() => { onHeading('p'); setHeadingOpen(false); }} className="w-full px-2 py-1.5 text-left text-sm rounded hover:bg-muted">{t('wordToolbar.normal')}</button>
              </PopoverContent>
            </Popover>
          </OrderedItem>
        )}

        {onSubscript && isToolbarItemVisible('subscript') && (
          <OrderedItem id="subscript">
            <IconBtn onClick={onSubscript} title={t('wordToolbar.subscript')} active={isSubscript}><Subscript className="h-5 w-5" strokeWidth={2} /></IconBtn>
          </OrderedItem>
        )}
        {onSuperscript && isToolbarItemVisible('superscript') && (
          <OrderedItem id="superscript">
            <IconBtn onClick={onSuperscript} title={t('wordToolbar.superscript')} active={isSuperscript}><Superscript className="h-5 w-5" strokeWidth={2} /></IconBtn>
          </OrderedItem>
        )}

        {onClearFormatting && isToolbarItemVisible('clearFormatting') && (
          <OrderedItem id="clearFormatting">
            <IconBtn onClick={onClearFormatting} title={t('wordToolbar.clearFormatting')}><RemoveFormatting className="h-5 w-5" strokeWidth={2} /></IconBtn>
          </OrderedItem>
        )}

        {onCodeBlock && isToolbarItemVisible('codeBlock') && (
          <OrderedItem id="codeBlock">
            <IconBtn onClick={onCodeBlock} title={t('wordToolbar.codeBlock')}><Code className="h-5 w-5" strokeWidth={2} /></IconBtn>
          </OrderedItem>
        )}

        {onBlockquote && isToolbarItemVisible('blockquote') && (
          <OrderedItem id="blockquote">
            <IconBtn onClick={onBlockquote} title={t('wordToolbar.blockquote')}><Quote className="h-5 w-5" strokeWidth={2} /></IconBtn>
          </OrderedItem>
        )}

        {onEmojiInsert && isToolbarItemVisible('emoji') && (
          <OrderedItem id="emoji">
            <EmojiPicker onEmojiSelect={onEmojiInsert} />
          </OrderedItem>
        )}

        {onInsertLink && isToolbarItemVisible('link') && (
          <OrderedItem id="link">
            <IconBtn onClick={onInsertLink} title={t('wordToolbar.insertLink')}><LinkIcon className="h-5 w-5" strokeWidth={2} /></IconBtn>
          </OrderedItem>
        )}

        {onInsertNoteLink && isToolbarItemVisible('noteLink') && (
          <OrderedItem id="noteLink">
            <IconBtn onClick={onInsertNoteLink} title={t('wordToolbar.linkToNote')}><Link2 className="h-5 w-5" strokeWidth={2} /></IconBtn>
          </OrderedItem>
        )}

        {onAttachment && isToolbarItemVisible('attachment') && (
          <OrderedItem id="attachment">
            <IconBtn onClick={onAttachment} title={t('wordToolbar.attachFile')}><Paperclip className="h-5 w-5" strokeWidth={2} /></IconBtn>
          </OrderedItem>
        )}

        {onComment && isToolbarItemVisible('comment') && (
          <OrderedItem id="comment">
            <IconBtn onClick={onComment} title={t('wordToolbar.comment')}><span className="text-xs font-bold">💬</span></IconBtn>
          </OrderedItem>
        )}

        {onVoiceRecord && (
          <div style={{ order: 999 }} className="flex items-center flex-shrink-0">
            <IconBtn onClick={onVoiceRecord} title={t('wordToolbar.voiceRecording')}><Mic className="h-5 w-5" strokeWidth={2} /></IconBtn>
          </div>
        )}

        {onTextDirection && isToolbarItemVisible('textDirection') && (
          <OrderedItem id="textDirection">
            <IconBtn onClick={() => onTextDirection('ltr')} title={t('wordToolbar.leftToRight')} active={textDirection === 'ltr'}><PilcrowLeft className="h-5 w-5" strokeWidth={2} /></IconBtn>
            <IconBtn onClick={() => onTextDirection('rtl')} title={t('wordToolbar.rightToLeft')} active={textDirection === 'rtl'}><PilcrowRight className="h-5 w-5" strokeWidth={2} /></IconBtn>
          </OrderedItem>
        )}

        {isToolbarItemVisible('zoom') && (
          <OrderedItem id="zoom">
            <div className="flex items-center gap-0 flex-shrink-0">
              <IconBtn onClick={() => onZoomChange(Math.max(50, zoom - 10))} disabled={zoom <= 50} title={t('wordToolbar.zoomOut')}><ZoomOut className="h-5 w-5" strokeWidth={2} /></IconBtn>
              <span className="text-sm font-semibold w-12 text-center tabular-nums">{zoom}%</span>
              <IconBtn onClick={() => onZoomChange(Math.min(200, zoom + 10))} disabled={zoom >= 200} title={t('wordToolbar.zoomIn')}><ZoomIn className="h-5 w-5" strokeWidth={2} /></IconBtn>
            </div>
          </OrderedItem>
        )}
      </div>
    </div>
  );
};
