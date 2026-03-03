import { useState, useCallback, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sanitizeHtml } from '@/lib/sanitize';
import { useTranslation } from 'react-i18next';

interface InlineFindReplaceProps {
  isOpen: boolean;
  onClose: () => void;
  editorRef: React.RefObject<HTMLDivElement>;
  onContentChange: (content: string) => void;
  content?: string; // Current editor content to detect changes
}

// Highlight colors - blue theme as requested
const HIGHLIGHT_TEXT_COLOR = '#FFFFFF';
const HIGHLIGHT_BG_COLOR = '#3c78f0'; // Blue highlight for all matches
const CURRENT_HIGHLIGHT_BG = '#1d4ed8'; // Darker blue for current match
const CURRENT_HIGHLIGHT_TEXT = '#FFFFFF';

export const InlineFindReplace = ({
  isOpen,
  onClose,
  editorRef,
  onContentChange,
  content,
}: InlineFindReplaceProps) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [showReplace, setShowReplace] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastSearchRef = useRef<string>(''); // Track last search to re-apply after content changes
  const isApplyingHighlightsRef = useRef(false); // Prevent recursive updates

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Clear highlights when closed
  useEffect(() => {
    if (!isOpen) {
      clearHighlights();
      setSearchTerm('');
      setReplaceTerm('');
      setMatchCount(0);
      setCurrentMatchIndex(0);
      setShowReplace(false);
    }
  }, [isOpen]);

  // Auto-search as user types
  useEffect(() => {
    if (isOpen && searchTerm.trim()) {
      lastSearchRef.current = searchTerm;
      performSearch();
    } else if (isOpen && !searchTerm.trim()) {
      lastSearchRef.current = '';
      clearHighlights();
      setMatchCount(0);
      setCurrentMatchIndex(0);
    }
  }, [searchTerm, isOpen]);

  // Re-apply highlights when content changes externally (but only if we have a search term)
  useEffect(() => {
    if (!isOpen || !lastSearchRef.current || isApplyingHighlightsRef.current) return;
    
    // Check if highlights still exist
    const existingHighlights = editorRef.current?.querySelectorAll('mark[data-find-highlight]');
    if (!existingHighlights || existingHighlights.length === 0) {
      // Highlights were removed (content changed), re-apply them
      const timeoutId = setTimeout(() => {
        if (lastSearchRef.current) {
          performSearch();
        }
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [content, isOpen]);

  // Clear all highlights from the editor
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

  // Escape special regex characters
  const escapeRegex = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // Build regex pattern
  const buildSearchRegex = useCallback((term: string) => {
    if (!term.trim()) return null;
    const pattern = escapeRegex(term);
    try {
      return new RegExp(pattern, 'gi');
    } catch {
      return null;
    }
  }, []);

  // Perform search and highlight
  const performSearch = useCallback(() => {
    if (!editorRef.current || !searchTerm.trim()) return;
    
    isApplyingHighlightsRef.current = true;

    clearHighlights();

    const searchRegex = buildSearchRegex(searchTerm);
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
      const countRegex = buildSearchRegex(searchTerm);
      if (countRegex) {
        const matches = text.match(countRegex);
        if (matches) {
          count += matches.length;
        }
      }

      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      const regex = buildSearchRegex(searchTerm);
      if (!regex) return;

      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }

        const mark = document.createElement('mark');
        mark.setAttribute('data-find-highlight', 'true');
        mark.style.backgroundColor = HIGHLIGHT_BG_COLOR;
        mark.style.color = HIGHLIGHT_TEXT_COLOR;
        mark.style.borderRadius = '3px';
        mark.style.padding = '1px 3px';
        mark.style.boxShadow = '0 1px 2px rgba(0,0,0,0.2)';
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
    
    if (count > 0) {
      setCurrentMatchIndex(1);
      highlightCurrentMatch(0);
    } else {
      setCurrentMatchIndex(0);
    }
    
    // Allow content change detection again after a brief delay
    setTimeout(() => {
      isApplyingHighlightsRef.current = false;
    }, 100);
  }, [searchTerm, editorRef, clearHighlights, buildSearchRegex]);

  // Highlight specific match as current
  const highlightCurrentMatch = useCallback((index: number) => {
    if (!editorRef.current) return;
    
    const highlights = editorRef.current.querySelectorAll('mark[data-find-highlight]');
    
    highlights.forEach((mark, i) => {
      const el = mark as HTMLElement;
      if (i === index) {
        el.style.backgroundColor = CURRENT_HIGHLIGHT_BG;
        el.style.color = CURRENT_HIGHLIGHT_TEXT;
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        el.style.backgroundColor = HIGHLIGHT_BG_COLOR;
        el.style.color = HIGHLIGHT_TEXT_COLOR;
        el.style.boxShadow = '0 1px 2px rgba(0,0,0,0.2)';
      }
    });
  }, [editorRef]);

  // Navigate to next match
  const goToNextMatch = useCallback(() => {
    if (matchCount === 0) return;
    const newIndex = currentMatchIndex >= matchCount ? 1 : currentMatchIndex + 1;
    setCurrentMatchIndex(newIndex);
    highlightCurrentMatch(newIndex - 1);
  }, [matchCount, currentMatchIndex, highlightCurrentMatch]);

  // Navigate to previous match
  const goToPrevMatch = useCallback(() => {
    if (matchCount === 0) return;
    const newIndex = currentMatchIndex <= 1 ? matchCount : currentMatchIndex - 1;
    setCurrentMatchIndex(newIndex);
    highlightCurrentMatch(newIndex - 1);
  }, [matchCount, currentMatchIndex, highlightCurrentMatch]);

  // Replace current match
  const handleReplace = useCallback(() => {
    if (!editorRef.current || matchCount === 0) return;

    const highlights = editorRef.current.querySelectorAll('mark[data-find-highlight]');
    const currentMark = highlights[currentMatchIndex - 1] as HTMLElement;

    if (currentMark) {
      const textNode = document.createTextNode(replaceTerm);
      currentMark.parentNode?.replaceChild(textNode, currentMark);
      
      if (editorRef.current) {
        onContentChange(editorRef.current.innerHTML);
      }

      const newCount = matchCount - 1;
      setMatchCount(newCount);

      if (newCount > 0) {
        const newIndex = currentMatchIndex > newCount ? 1 : currentMatchIndex;
        setCurrentMatchIndex(newIndex);
        
        setTimeout(() => {
          const remainingHighlights = editorRef.current?.querySelectorAll('mark[data-find-highlight]');
          if (remainingHighlights && remainingHighlights.length > 0) {
            highlightCurrentMatch(newIndex - 1);
          }
        }, 10);
        
        toast.success(t('findReplace.replaced', 'Replaced'));
      } else {
        setCurrentMatchIndex(0);
        toast.success(t('findReplace.allReplaced', 'All replaced'));
      }
    }
  }, [editorRef, matchCount, currentMatchIndex, replaceTerm, onContentChange, highlightCurrentMatch, t]);

  // Replace all matches
  const handleReplaceAll = useCallback(() => {
    if (!editorRef.current || matchCount === 0) return;

    clearHighlights();

    const currentContent = editorRef.current.innerHTML;
    const searchRegex = buildSearchRegex(searchTerm);
    if (!searchRegex) return;
    
    const newContent = currentContent.replace(searchRegex, replaceTerm);

    editorRef.current.innerHTML = sanitizeHtml(newContent);
    onContentChange(newContent);

    const replacedCount = matchCount;
    setMatchCount(0);
    setCurrentMatchIndex(0);

    toast.success(t('findReplace.replacedCount', { count: replacedCount, defaultValue: `Replaced ${replacedCount}` }));
  }, [editorRef, matchCount, searchTerm, replaceTerm, onContentChange, clearHighlights, buildSearchRegex, t]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    clearHighlights();
    onClose();
  }, [clearHighlights, onClose]);

  if (!isOpen) return null;

  return (
    <div className="bg-background border-b border-border shadow-sm">
      {/* Search Row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Input
          ref={searchInputRef}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t('findReplace.searchPlaceholder', 'Find...')}
          className="flex-1 h-9 text-sm bg-muted/50 border-0"
          autoFocus
        />
        
        {/* Match count */}
        {searchTerm && (
          <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[50px] text-center">
            {matchCount > 0 ? `${currentMatchIndex} of ${matchCount}` : '0'}
          </span>
        )}
        
        {/* Navigation arrows */}
        <button
          onClick={goToPrevMatch}
          disabled={matchCount === 0}
          className="p-1.5 rounded hover:bg-muted disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={goToNextMatch}
          disabled={matchCount === 0}
          className="p-1.5 rounded hover:bg-muted disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        
        {/* Toggle Replace */}
        <button
          onClick={() => setShowReplace(!showReplace)}
          className="p-1.5 rounded hover:bg-muted"
        >
          {showReplace ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        
        {/* Cancel */}
        <button
          onClick={handleCancel}
          className="text-sm font-medium px-2 py-1"
          style={{ color: '#ef4444' }}
        >
          {t('common.cancel', 'Cancel')}
        </button>
      </div>

      {/* Replace Row (expandable) */}
      {showReplace && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50">
          <Input
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            placeholder={t('findReplace.replacePlaceholder', 'Replace with...')}
            className="flex-1 h-9 text-sm bg-muted/50 border-0"
          />
          
          {/* Replace buttons */}
          <button
            onClick={handleReplace}
            disabled={matchCount === 0}
            className="text-sm font-medium px-3 py-1.5 disabled:opacity-30"
            style={{ color: matchCount > 0 ? '#22c55e' : undefined }}
          >
            {t('findReplace.replace', 'Replace')}
          </button>
          <button
            onClick={handleReplaceAll}
            disabled={matchCount === 0}
            className="text-sm font-medium px-3 py-1.5 disabled:opacity-30"
            style={{ color: matchCount > 0 ? '#22c55e' : undefined }}
          >
            {t('findReplace.replaceAll', 'Replace All')}
          </button>
        </div>
      )}
    </div>
  );
};
