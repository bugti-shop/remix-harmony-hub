import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { ArrowLeft, Copy, Check, ChevronDown, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import { sanitizeCodeHtml } from '@/lib/sanitize';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface VirtualizedCodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  language: string;
  onLanguageChange: (language: string) => void;
  title: string;
  onTitleChange: (title: string) => void;
  onClose: () => void;
}

const LANGUAGES = [
  { value: 'auto', label: 'Auto Detect' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'csharp', label: 'C#' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'dart', label: 'Dart' },
  { value: 'sql', label: 'SQL' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'xml', label: 'XML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'bash', label: 'Bash' },
  { value: 'shell', label: 'Shell' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'dockerfile', label: 'Dockerfile' },
  { value: 'plaintext', label: 'Plain Text' },
];

const DEFAULT_FONT_SIZE = 11;
const MIN_FONT_SIZE = 9;
const MAX_FONT_SIZE = 16;
const DEBOUNCE_MS = 100;
const VISIBLE_BUFFER = 50;

export const VirtualizedCodeEditor = ({
  code,
  onChange,
  language,
  onLanguageChange,
  title,
  onTitleChange,
  onClose,
}: VirtualizedCodeEditorProps) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<string>('plaintext');
  const [highlightedLines, setHighlightedLines] = useState<string[]>([]);
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 100 });
  const [currentLine, setCurrentLine] = useState(1);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load font size from IndexedDB
  useEffect(() => {
    import('@/utils/settingsStorage').then(({ getSetting }) => {
      getSetting<number>('code-editor-font-size', DEFAULT_FONT_SIZE).then(size => {
        setFontSize(size);
        setIsLoaded(true);
      });
    });
  }, []);

  // Save font size to IndexedDB
  useEffect(() => {
    if (isLoaded) {
      import('@/utils/settingsStorage').then(({ setSetting }) => {
        setSetting('code-editor-font-size', fontSize);
      });
    }
  }, [fontSize, isLoaded]);

  const lineHeight = useMemo(() => Math.round(fontSize * 1.6), [fontSize]);
  const fontSizePx = `${fontSize}px`;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollPosRef = useRef({ top: 0, left: 0 });

  const lines = useMemo(() => code.split('\n'), [code]);
  const lineNumberWidth = Math.max(50, String(lines.length).length * 10 + 32);

  const maxLineWidth = useMemo(() => {
    const maxChars = Math.max(...lines.map(line => line.length), 100);
    return Math.max(maxChars * 7 + 150, 800);
  }, [lines]);

  const updateCurrentLine = useCallback(() => {
    if (textareaRef.current) {
      const cursorPos = textareaRef.current.selectionStart;
      const textBeforeCursor = code.substring(0, cursorPos);
      const lineNumber = textBeforeCursor.split('\n').length;
      setCurrentLine(lineNumber);
    }
  }, [code]);

  const highlightCode = useCallback((codeToHighlight: string, lang: string) => {
    const highlightAsync = () => {
      setIsHighlighting(true);

      try {
        let result: string;
        let detected = lang;

        if (lang === 'auto' || !lang) {
          const sample = codeToHighlight.substring(0, 2000);
          const autoResult = hljs.highlightAuto(sample);
          detected = autoResult.language || 'plaintext';
          setDetectedLanguage(detected);

          if (detected !== 'plaintext') {
            result = hljs.highlight(codeToHighlight, { language: detected, ignoreIllegals: true }).value;
          } else {
            result = codeToHighlight.replace(/</g, '&lt;').replace(/>/g, '&gt;');
          }
        } else if (lang === 'plaintext') {
          result = codeToHighlight.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        } else {
          result = hljs.highlight(codeToHighlight, { language: lang, ignoreIllegals: true }).value;
        }

        setHighlightedLines(result.split('\n'));
      } catch {
        setHighlightedLines(code.split('\n').map(l => l.replace(/</g, '&lt;').replace(/>/g, '&gt;')));
      }

      setIsHighlighting(false);
    };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(highlightAsync, { timeout: 500 });
    } else {
      setTimeout(highlightAsync, 0);
    }
  }, []);

  useEffect(() => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    highlightTimeoutRef.current = setTimeout(() => {
      highlightCode(code, language);
    }, DEBOUNCE_MS);

    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, [code, language, highlightCode]);

  const effectiveLanguage = language === 'auto' ? detectedLanguage : language;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(t('codeEditor.codeCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('codeEditor.copyFailed'));
    }
  }, [code]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = code.substring(0, start) + '  ' + code.substring(end);
      onChange(newValue);
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      });
    }
  }, [code, onChange]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    const scrollTop = target.scrollTop;
    const scrollLeft = target.scrollLeft;

    scrollPosRef.current = { top: scrollTop, left: scrollLeft };

    requestAnimationFrame(() => {
      if (codeContainerRef.current) {
        codeContainerRef.current.style.transform = `translate(${-scrollLeft}px, ${-scrollTop}px)`;
      }
      if (lineNumbersRef.current) {
        lineNumbersRef.current.style.transform = `translateY(${-scrollTop}px)`;
      }
    });

    const startLine = Math.max(0, Math.floor(scrollTop / lineHeight) - VISIBLE_BUFFER);
    const viewportLines = Math.ceil(target.clientHeight / lineHeight);
    const endLine = Math.min(lines.length, startLine + viewportLines + VISIBLE_BUFFER * 2);

    setVisibleRange({ start: startLine, end: endLine });
  }, [lines.length, lineHeight]);

  const handleSelect = useCallback(() => {
    updateCurrentLine();
  }, [updateCurrentLine]);

  const visibleLines = useMemo(() => {
    const result: { number: number; html: string; offset: number; isCurrentLine: boolean }[] = [];
    let currentOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const isCurrentLineFlag = (i + 1) === currentLine;

      if (currentOffset >= (visibleRange.start * lineHeight) - (VISIBLE_BUFFER * lineHeight) &&
          currentOffset <= (visibleRange.end * lineHeight) + (VISIBLE_BUFFER * lineHeight)) {
        result.push({
          number: i + 1,
          html: highlightedLines[i] || lines[i]?.replace(/</g, '&lt;').replace(/>/g, '&gt;') || '',
          offset: currentOffset,
          isCurrentLine: isCurrentLineFlag,
        });
      }

      currentOffset += lineHeight;
    }

    return result;
  }, [visibleRange, highlightedLines, lines, currentLine, lineHeight]);

  const totalHeight = useMemo(() => lines.length * lineHeight, [lines.length, lineHeight]);

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0d1117] z-50" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] flex-shrink-0 bg-[#161b22]">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-gray-300 hover:text-white hover:bg-[#30363d]">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder={t('codeEditor.untitledCode')}
            className="h-8 w-[180px] sm:w-[240px] bg-[#0d1117] border-[#30363d] text-white text-sm placeholder:text-gray-500 focus-visible:ring-1 focus-visible:ring-[#58a6ff]"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {isHighlighting && <span className="text-xs text-[#58a6ff] animate-pulse">{t('codeEditor.highlighting')}</span>}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 px-2 text-xs text-gray-300 hover:text-white hover:bg-[#30363d] gap-1">
                {LANGUAGES.find(l => l.value === language)?.label || 'Auto Detect'}
                {language === 'auto' && detectedLanguage !== 'plaintext' && (
                  <span className="text-[#58a6ff]">({detectedLanguage})</span>
                )}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#161b22] border-[#30363d] max-h-[300px] overflow-y-auto">
              {LANGUAGES.map((lang) => (
                <DropdownMenuItem
                  key={lang.value}
                  onClick={() => onLanguageChange(lang.value)}
                  className={`text-gray-300 hover:text-white hover:bg-[#30363d] text-xs ${language === lang.value ? 'bg-[#30363d] text-white' : ''}`}
                >
                  {lang.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" onClick={handleCopy} className="h-8 w-8 text-gray-300 hover:text-white hover:bg-[#30363d]">
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-hidden relative flex">
        {/* Line numbers */}
        <div className="flex-shrink-0 bg-[#0d1117] border-r border-[#30363d] select-none overflow-hidden sticky left-0 z-20" style={{ width: lineNumberWidth }}>
          <div ref={lineNumbersRef} className="relative py-3 will-change-transform" style={{ height: totalHeight + 24 }}>
            {visibleLines.map((line) => (
              <div
                key={line.number}
                className={`absolute flex items-center pl-3 transition-colors duration-75 ${line.isCurrentLine ? 'text-white bg-[#1f2428]' : 'text-[#6e7681]'}`}
                style={{
                  top: line.offset + 12,
                  height: lineHeight,
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                  fontSize: fontSizePx,
                  lineHeight: `${lineHeight}px`,
                  width: lineNumberWidth,
                }}
              >
                <span className="min-w-[2ch]">{line.number}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Code area */}
        <div className="flex-1 relative overflow-auto">
          <div
            className="absolute pointer-events-none z-0 transition-transform duration-75"
            style={{
              top: 12 + ((currentLine - 1) * lineHeight) - scrollPosRef.current.top,
              left: 0,
              right: 0,
              height: lineHeight,
              backgroundColor: 'rgba(56, 139, 253, 0.1)',
              borderLeft: '2px solid #58a6ff',
              minWidth: maxLineWidth,
            }}
          />

          <div ref={codeContainerRef} className="absolute top-0 left-0 overflow-visible pointer-events-none will-change-transform" style={{ minWidth: maxLineWidth }}>
            <div className="relative py-3 px-4" style={{ height: totalHeight + 24, minWidth: maxLineWidth }}>
              {visibleLines.map((line) => (
                <div
                  key={line.number}
                  className={`absolute whitespace-pre ${line.isCurrentLine ? 'bg-[rgba(56,139,253,0.1)]' : ''}`}
                  style={{
                    top: line.offset + 12,
                    height: lineHeight,
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                    fontSize: fontSizePx,
                    lineHeight: `${lineHeight}px`,
                    color: '#c9d1d9',
                    minWidth: maxLineWidth,
                  }}
                >
                  <span dangerouslySetInnerHTML={{ __html: sanitizeCodeHtml(line.html || '&nbsp;') }} />
                </div>
              ))}
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={code}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onKeyUp={handleSelect}
            onClick={handleSelect}
            onScroll={handleScroll}
            placeholder={t('codeEditor.pasteOrType')}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="absolute inset-0 py-3 px-4 bg-transparent text-transparent caret-white resize-none outline-none z-10"
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
              fontSize: fontSizePx,
              lineHeight: `${lineHeight}px`,
              WebkitTextFillColor: 'transparent',
              overflow: 'auto',
              width: '100%',
              height: '100%',
              minWidth: maxLineWidth,
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-[#30363d] bg-[#161b22] text-xs text-gray-500 gap-3">
        <span className="flex-shrink-0">Ln {currentLine}, Col {(() => {
          if (!textareaRef.current) return 1;
          const cursorPos = textareaRef.current.selectionStart;
          const textBeforeCursor = code.substring(0, cursorPos);
          const lastNewline = textBeforeCursor.lastIndexOf('\n');
          return cursorPos - lastNewline;
        })()}</span>

        <div className="flex items-center gap-2 flex-1 max-w-[200px]">
          <ZoomOut className="h-3 w-3 text-gray-500" />
          <Slider value={[fontSize]} min={MIN_FONT_SIZE} max={MAX_FONT_SIZE} step={1} onValueChange={(value) => setFontSize(value[0])} className="flex-1" />
          <ZoomIn className="h-3 w-3 text-gray-500" />
          <span className="text-[10px] w-8 text-center">{fontSize}px</span>
        </div>

        <span className="flex-shrink-0">{t('codeEditor.lines')}: {lines.length.toLocaleString()} | {t('codeEditor.chars')}: {code.length.toLocaleString()}</span>
      </div>
    </div>
  );
};
