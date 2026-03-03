import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Note } from '@/types/note';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Loader2, ExternalLink } from 'lucide-react';
import { stripHtml } from '@/lib/sanitize';

// Maximum lengths for URL parameters to prevent DoS/abuse
const MAX_LENGTHS = {
  title: 200,
  url: 2048,
  content: 50000,
  selection: 10000
};

/**
 * Validates and sanitizes URL strings to only allow http/https protocols
 */
const validateUrl = (urlString: string): string => {
  if (!urlString) return '';
  
  try {
    const parsed = new URL(urlString);
    // Only allow http/https protocols - reject javascript:, data:, etc.
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }
    return parsed.toString();
  } catch {
    // Invalid URL format
    return '';
  }
};

/**
 * Escape Markdown special characters to prevent injection
 */
const escapeMarkdown = (text: string): string => {
  return text.replace(/[[\]()]/g, '\\$&');
};

/**
 * Sanitize and truncate a text parameter
 */
const sanitizeParam = (value: string | null, maxLength: number): string => {
  if (!value) return '';
  // Strip any HTML tags and truncate to max length
  return stripHtml(value).substring(0, maxLength);
};

const WebClipper = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Validate and sanitize all URL parameters
  const title = sanitizeParam(searchParams.get('title'), MAX_LENGTHS.title) || 'Untitled Clip';
  const url = validateUrl(sanitizeParam(searchParams.get('url'), MAX_LENGTHS.url));
  const content = sanitizeParam(searchParams.get('content'), MAX_LENGTHS.content);
  const selection = sanitizeParam(searchParams.get('selection'), MAX_LENGTHS.selection);

  useEffect(() => {
    if (title || url || content || selection) {
      handleSaveClip();
    }
  }, []);

  const handleSaveClip = async () => {
    setSaving(true);

    try {
      // Build note content with escaped Markdown characters to prevent injection
      let noteContent = '';
      
      if (url) {
        // Escape URL to prevent Markdown link injection
        const escapedUrl = escapeMarkdown(url);
        noteContent += `**Source:** ${escapedUrl}\n\n`;
      }
      
      if (selection) {
        // Escape selection to prevent Markdown injection in blockquotes
        const escapedSelection = escapeMarkdown(selection);
        noteContent += `> ${escapedSelection}\n\n`;
      }
      
      if (content) {
        // Escape content to prevent any Markdown injection
        noteContent += escapeMarkdown(content);
      }

      // Create new note
      const newNote: Note = {
        id: crypto.randomUUID(),
        type: 'regular',
        title: title,
        content: noteContent,
        voiceRecordings: [],
        syncVersion: 1,
        syncStatus: 'pending' as const,
        isDirty: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save note to IndexedDB
      const { loadNotesFromDB, saveNotesToDB } = await import('@/utils/noteStorage');
      const existingNotes = await loadNotesFromDB();
      const updatedNotes = [newNote, ...existingNotes];
      await saveNotesToDB(updatedNotes);

      setSaved(true);
      toast({
        title: t('toasts.webClipSaved'),
        description: t('toasts.clipSavedDesc', { title }),
      });

      // Redirect to notes after short delay
      setTimeout(() => {
        navigate('/notes');
      }, 1500);
    } catch (error) {
      console.error('Error saving clip:', error);
      toast({
        title: t('toasts.errorSavingClip'),
        description: t('toasts.somethingWentWrong'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {t('webClipper.savingClip')}
              </>
            ) : saved ? (
              <>
                <Check className="h-5 w-5 text-success" />
                {t('webClipper.clipSaved')}
              </>
            ) : (
              t('webClipper.title')
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(title || url) && (
            <div className="space-y-2">
              <p className="font-medium text-sm text-muted-foreground">{t('webClipper.clipping')}</p>
              <p className="font-semibold">{title}</p>
              {url && (
                <a 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-primary flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {url.length > 50 ? url.substring(0, 50) + '...' : url}
                </a>
              )}
            </div>
          )}

          {selection && (
            <div className="space-y-2">
              <p className="font-medium text-sm text-muted-foreground">{t('webClipper.selectedText')}</p>
              <blockquote className="border-l-2 border-primary pl-3 text-sm italic text-muted-foreground">
                {selection.length > 200 ? selection.substring(0, 200) + '...' : selection}
              </blockquote>
            </div>
          )}

          {saved && (
            <Button 
              onClick={() => navigate('/notes')} 
              className="w-full"
            >
              {t('webClipper.viewNotes')}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WebClipper;
