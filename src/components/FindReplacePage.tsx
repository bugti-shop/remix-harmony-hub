import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Replace, X, ArrowLeft, Eraser, Trash2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sanitizeHtml } from '@/lib/sanitize';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';

interface FindReplacePageProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  onContentChange: (content: string) => void;
  editorRef: React.RefObject<HTMLDivElement>;
}

const HIGHLIGHT_COLOR = '#3c78f0';
const HIGHLIGHT_BG_COLOR = 'rgba(60, 120, 240, 0.3)';

export const FindReplacePage = ({
  isOpen,
  onClose,
  content,
  onContentChange,
  editorRef,
}: FindReplacePageProps) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const clearHighlights = useCallback(() => {
    if (editorRef.current) {
      const highlights = editorRef.current.querySelectorAll('mark[data-find-highlight]');
      highlights.forEach((mark) => {
        const parent = mark.parentNode;
        if (parent) {
          const textNode = document.createTextNode(mark.textContent || '');
          parent.replaceChild(textNode, mark);
          parent.normalize();
        }
      });
    }
  }, [editorRef]);

  const handleClear = useCallback(() => {
    clearHighlights();
    setSearchTerm('');
    setReplaceTerm('');
    setMatchCount(0);
    setCurrentMatchIndex(0);
    toast.success(t('findReplace.cleared'));
  }, [clearHighlights, t]);

  const escapeRegex = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const buildSearchRegex = useCallback((term: string, forGlobal: boolean = false) => {
    if (!term.trim()) return null;
    const pattern = escapeRegex(term);
    const flags = forGlobal ? 'gi' : 'gi';
    try {
      return new RegExp(pattern, flags);
    } catch {
      return null;
    }
  }, []);

  const handleFind = useCallback(() => {
    if (!editorRef.current || !searchTerm.trim()) {
      clearHighlights();
      setMatchCount(0);
      toast.error(t('findReplace.enterSearchTerm'));
      return;
    }

    clearHighlights();

    const searchRegex = buildSearchRegex(searchTerm, true);
    if (!searchRegex) {
      setMatchCount(0);
      return;
    }

    let count = 0;

    const walker = document.createTreeWalker(
      editorRef.current,
      NodeFilter.SHOW_TEXT,
      null
    );

    const textNodes: Text[] = [];
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (node.textContent && searchRegex.test(node.textContent)) {
        textNodes.push(node);
      }
      searchRegex.lastIndex = 0;
    }

    textNodes.forEach((textNode) => {
      const text = textNode.textContent || '';
      const countRegex = buildSearchRegex(searchTerm, true);
      if (countRegex) {
        const matches = text.match(countRegex);
        if (matches) {
          count += matches.length;
        }
      }

      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      const regex = buildSearchRegex(searchTerm, true);
      if (!regex) return;

      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }

        const mark = document.createElement('mark');
        mark.setAttribute('data-find-highlight', 'true');
        mark.style.backgroundColor = HIGHLIGHT_BG_COLOR;
        mark.style.color = HIGHLIGHT_COLOR;
        mark.style.borderRadius = '2px';
        mark.style.padding = '0 2px';
        mark.textContent = match[0];
        fragment.appendChild(mark);

        lastIndex = regex.lastIndex;
      }

      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      textNode.parentNode?.replaceChild(fragment, textNode);
    });

    setMatchCount(count);
    setCurrentMatchIndex(count > 0 ? 1 : 0);

    if (count > 0) {
      const firstMatch = editorRef.current?.querySelector('mark[data-find-highlight]') as HTMLElement;
      if (firstMatch) {
        firstMatch.style.backgroundColor = HIGHLIGHT_COLOR;
        firstMatch.style.color = 'white';
        firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      toast.success(t('findReplace.foundMatches', { count }));
    } else {
      toast.error(t('findReplace.noMatchesFound'));
    }
  }, [searchTerm, editorRef, clearHighlights, buildSearchRegex, t]);

  const handleReplace = useCallback(() => {
    if (!editorRef.current || !searchTerm.trim()) {
      toast.error(t('findReplace.enterSearchFirst'));
      return;
    }

    if (matchCount === 0) {
      toast.error(t('findReplace.noMatchesToReplace'));
      return;
    }

    clearHighlights();

    const currentContent = editorRef.current.innerHTML;
    const searchRegex = buildSearchRegex(searchTerm, true);
    if (!searchRegex) return;
    
    const newContent = currentContent.replace(searchRegex, replaceTerm);

    editorRef.current.innerHTML = sanitizeHtml(newContent);
    onContentChange(newContent);

    const replacedCount = matchCount;
    setMatchCount(0);
    setCurrentMatchIndex(0);

    toast.success(t('findReplace.replacedOccurrences', { count: replacedCount }));
  }, [editorRef, matchCount, searchTerm, replaceTerm, onContentChange, clearHighlights, buildSearchRegex, t]);

  const handleReplaceNext = useCallback(() => {
    if (!editorRef.current || !searchTerm.trim()) {
      toast.error(t('findReplace.enterSearchFirst'));
      return;
    }

    if (matchCount === 0) {
      toast.error(t('findReplace.noMatchesToReplace'));
      return;
    }

    const highlights = editorRef.current.querySelectorAll('mark[data-find-highlight]');
    if (highlights.length === 0) return;

    let currentMark: HTMLElement | null = null;
    let currentIndex = 0;
    
    highlights.forEach((mark, index) => {
      const el = mark as HTMLElement;
      if (el.style.backgroundColor === HIGHLIGHT_COLOR || el.style.backgroundColor === 'rgb(60, 120, 240)') {
        currentMark = el;
        currentIndex = index;
      }
    });

    if (!currentMark && highlights.length > 0) {
      currentMark = highlights[0] as HTMLElement;
      currentIndex = 0;
    }

    if (currentMark) {
      const textNode = document.createTextNode(replaceTerm);
      currentMark.parentNode?.replaceChild(textNode, currentMark);
      
      if (editorRef.current) {
        onContentChange(editorRef.current.innerHTML);
      }

      const newCount = matchCount - 1;
      setMatchCount(newCount);

      if (newCount > 0) {
        const remainingHighlights = editorRef.current?.querySelectorAll('mark[data-find-highlight]');
        if (remainingHighlights && remainingHighlights.length > 0) {
          remainingHighlights.forEach((mark) => {
            const el = mark as HTMLElement;
            el.style.backgroundColor = HIGHLIGHT_BG_COLOR;
            el.style.color = HIGHLIGHT_COLOR;
          });
          
          const nextIndex = currentIndex >= remainingHighlights.length ? 0 : currentIndex;
          const nextMark = remainingHighlights[nextIndex] as HTMLElement;
          if (nextMark) {
            nextMark.style.backgroundColor = HIGHLIGHT_COLOR;
            nextMark.style.color = 'white';
            nextMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          
          setCurrentMatchIndex(nextIndex + 1);
        }
        toast.success(t('findReplace.replacedOneRemaining', { count: newCount }));
      } else {
        setCurrentMatchIndex(0);
        toast.success(t('findReplace.replacedLastMatch'));
      }
    }
  }, [editorRef, matchCount, searchTerm, replaceTerm, onContentChange, t]);

  const handleRemove = useCallback(() => {
    if (!editorRef.current || !searchTerm.trim()) {
      toast.error(t('findReplace.enterSearchFirst'));
      return;
    }

    if (matchCount === 0) {
      toast.error(t('findReplace.noMatchesToRemove'));
      return;
    }

    clearHighlights();

    const currentContent = editorRef.current.innerHTML;
    const searchRegex = buildSearchRegex(searchTerm, true);
    if (!searchRegex) return;
    
    const newContent = currentContent.replace(searchRegex, '');

    editorRef.current.innerHTML = sanitizeHtml(newContent);
    onContentChange(newContent);

    const removedCount = matchCount;
    setMatchCount(0);
    setCurrentMatchIndex(0);
    setSearchTerm('');

    toast.success(t('findReplace.removedOccurrences', { count: removedCount }));
  }, [editorRef, matchCount, searchTerm, onContentChange, clearHighlights, buildSearchRegex, t]);

  if (!isOpen) return null;

  return (
    <div 
      className={cn(
        "fixed inset-0 bg-background z-50 flex flex-col transition-transform duration-300",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <Button variant="ghost" size="sm" onClick={handleClose}>
          <ArrowLeft className="h-5 w-5 mr-1" />
          {t('findReplace.back')}
        </Button>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Search className="h-5 w-5" style={{ color: HIGHLIGHT_COLOR }} />
          {t('findReplace.title')}
        </h2>
        <div className="w-16" />
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="space-y-2">
            <Label className="text-base font-medium" style={{ color: HIGHLIGHT_COLOR }}>
              {t('findReplace.find')}
            </Label>
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('findReplace.findPlaceholder')}
              className="h-12 text-base"
              autoFocus
            />
            {matchCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {t('findReplace.matchOf', { current: currentMatchIndex, total: matchCount })}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-base font-medium" style={{ color: HIGHLIGHT_COLOR }}>
              {t('findReplace.replaceWith')}
            </Label>
            <Input
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              placeholder={t('findReplace.replacePlaceholder')}
              className="h-12 text-base"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleFind}
              className="flex-1 h-12 text-base"
              style={{ backgroundColor: HIGHLIGHT_COLOR }}
            >
              <Search className="h-5 w-5 mr-2" />
              {t('findReplace.find')}
            </Button>
            <Button
              onClick={handleReplaceNext}
              disabled={matchCount === 0}
              variant="outline"
              className="flex-1 h-12 text-base"
              style={{ 
                borderColor: HIGHLIGHT_COLOR,
                color: matchCount > 0 ? HIGHLIGHT_COLOR : undefined,
              }}
            >
              <ChevronRight className="h-5 w-5 mr-1" />
              {t('findReplace.replaceNext')}
            </Button>
          </div>

          <Button
            onClick={handleReplace}
            disabled={matchCount === 0}
            variant="outline"
            className="w-full h-12 text-base"
            style={{ 
              borderColor: HIGHLIGHT_COLOR,
              color: matchCount > 0 ? HIGHLIGHT_COLOR : undefined,
            }}
          >
            <Replace className="h-5 w-5 mr-2" />
            {t('findReplace.replaceAll')}
          </Button>

          <Button
            onClick={handleRemove}
            disabled={matchCount === 0}
            variant="outline"
            className="w-full h-12 text-base border-destructive text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-5 w-5 mr-2" />
            {t('findReplace.removeAllMatches')}
          </Button>

          <Button
            onClick={handleClear}
            variant="ghost"
            className="w-full h-12 text-base text-muted-foreground"
          >
            <Eraser className="h-5 w-5 mr-2" />
            {t('findReplace.clear')}
          </Button>
        </div>
      </div>
    </div>
  );
};