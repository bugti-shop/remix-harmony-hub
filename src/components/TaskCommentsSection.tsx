import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { TaskComment } from '@/types/note';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Send, Image as ImageIcon, Trash2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { compressImage } from '@/utils/receiptStorage';

interface TaskCommentsSectionProps {
  comments: TaskComment[];
  onAddComment: (comment: TaskComment) => void;
  onDeleteComment: (commentId: string) => void;
}

export const TaskCommentsSection = ({
  comments,
  onAddComment,
  onDeleteComment,
}: TaskCommentsSectionProps) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(comments.length > 0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!text.trim() && !imagePreview) return;

    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}

    const comment: TaskComment = {
      id: Date.now().toString(),
      text: text.trim(),
      imageUrl: imagePreview || undefined,
      createdAt: new Date(),
    };

    onAddComment(comment);
    setText('');
    setImagePreview(null);
    toast.success(t('comments.added'));
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file, 800, 0.7);
      setImagePreview(compressed);
    } catch {
      // Fallback without compression
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch {}
    onDeleteComment(commentId);
    toast.success(t('comments.deleted'));
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const d = new Date(date);
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('comments.justNow');
    if (diffMins < 60) return t('comments.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('comments.hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('comments.daysAgo', { count: diffDays });
    return format(d, 'MMM d, yyyy');
  };

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground w-full"
      >
        <MessageSquare className="h-4 w-4" />
        {t('comments.title')}
        {comments.length > 0 && (
          <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {comments.length}
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="space-y-3">
          {/* Comments list */}
          {comments.length > 0 && (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {[...comments]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((comment) => (
                <div
                  key={comment.id}
                  className="group relative p-3 rounded-xl bg-muted/30 border border-border/50 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {comment.text && (
                        <p className="text-sm whitespace-pre-wrap break-words">{comment.text}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity flex-shrink-0"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>

                  {comment.imageUrl && (
                    <img
                      src={comment.imageUrl}
                      alt={t('comments.attachment')}
                      className="rounded-lg max-h-48 w-auto object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(comment.imageUrl, '_blank')}
                    />
                  )}

                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{getRelativeTime(comment.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {comments.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">
              {t('comments.noComments')}
            </p>
          )}

          {/* Image preview */}
          {imagePreview && (
            <div className="relative inline-block">
              <img
                src={imagePreview}
                alt="Preview"
                className="h-20 rounded-lg border border-border object-cover"
              />
              <button
                onClick={() => setImagePreview(null)}
                className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Input area */}
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('comments.placeholder')}
                className="pr-10 rounded-xl"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded transition-colors"
              >
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <Button
              size="icon"
              className="h-9 w-9 rounded-xl flex-shrink-0"
              onClick={handleSubmit}
              disabled={!text.trim() && !imagePreview}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />
        </div>
      )}
    </div>
  );
};
