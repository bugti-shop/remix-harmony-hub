import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { List, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface NoteTableOfContentsProps {
  content: string;
  onJumpTo: (id: string) => void;
}

export const NoteTableOfContents = ({ content, onJumpTo }: NoteTableOfContentsProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const tocItems = useMemo(() => {
    const items: TocItem[] = [];
    
    // Parse HTML content for headings
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.charAt(1));
      const text = heading.textContent?.trim() || '';
      const id = `toc-heading-${index}`;
      
      if (text) {
        items.push({ id, text, level });
      }
    });
    
    return items;
  }, [content]);

  const handleJumpTo = (id: string, index: number) => {
    onJumpTo(`toc-heading-${index}`);
    setIsOpen(false);
  };

  if (tocItems.length === 0) {
    return null;
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <List className="h-4 w-4" />
          <span className="text-xs">{t('tableOfContents.contents')}</span>
          <span className="text-xs text-muted-foreground">({tocItems.length})</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <List className="h-5 w-5" />
            {t('tableOfContents.title')}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-1 max-h-[70vh] overflow-y-auto">
          {tocItems.map((item, index) => (
            <button
              key={item.id}
              onClick={() => handleJumpTo(item.id, index)}
              className={cn(
                "w-full text-left py-2 px-3 rounded-md hover:bg-muted transition-colors text-sm",
                "flex items-center gap-2"
              )}
              style={{ paddingLeft: `${(item.level - 1) * 12 + 12}px` }}
            >
              <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="truncate">{item.text}</span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};

// Helper function to inject IDs into content headings
export const injectHeadingIds = (content: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');
  const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
  
  headings.forEach((heading, index) => {
    heading.id = `toc-heading-${index}`;
  });
  
  return doc.body.innerHTML;
};
