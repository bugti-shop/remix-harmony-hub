import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Play, Bookmark, Clock, ChevronDown, ChevronUp, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export interface VideoBookmark {
  id: string;
  timestamp: number; // seconds
  label: string;
  createdAt: Date;
}

interface SketchVideoPanelProps {
  onClose: () => void;
  bookmarks: VideoBookmark[];
  onBookmarksChange: (bookmarks: VideoBookmark[]) => void;
  videoUrl: string;
  onVideoUrlChange: (url: string) => void;
}

const getYouTubeId = (url: string): string | null => {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
};

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

type PanelView = 'search' | 'player';

export const SketchVideoPanel = memo(({
  onClose,
  bookmarks,
  onBookmarksChange,
  videoUrl,
  onVideoUrlChange,
}: SketchVideoPanelProps) => {
  const { t } = useTranslation();
  const [view, setView] = useState<PanelView>(videoUrl ? 'player' : 'search');
  const [urlInput, setUrlInput] = useState(videoUrl);
  const [collapsed, setCollapsed] = useState(false);
  const [bookmarkLabel, setBookmarkLabel] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const playerRef = useRef<any>(null);
  const timeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const videoId = getYouTubeId(videoUrl);

  // YouTube IFrame API integration
  useEffect(() => {
    if (!videoId || view !== 'player') return;

    // Load YouTube IFrame API if not loaded
    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }

    const initPlayer = () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
      playerRef.current = new (window as any).YT.Player(`yt-player-${videoId}`, {
        videoId,
        playerVars: {
          autoplay: 1,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            // Start tracking time
            if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
            timeIntervalRef.current = setInterval(() => {
              if (playerRef.current?.getCurrentTime) {
                setCurrentTime(Math.floor(playerRef.current.getCurrentTime()));
              }
            }, 500);
          },
        },
      });
    };

    if ((window as any).YT?.Player) {
      // Small delay to ensure DOM is ready
      setTimeout(initPlayer, 100);
    } else {
      (window as any).onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
    };
  }, [videoId, view]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
      if (playerRef.current?.destroy) playerRef.current.destroy();
    };
  }, []);

  const handleAddVideo = useCallback((url: string) => {
    const id = getYouTubeId(url);
    if (!id) {
      toast.error(t('sketchVideo.invalidYoutubeUrl'));
      return;
    }
    onVideoUrlChange(url);
    setView('player');
  }, [onVideoUrlChange, t]);

  const handleRemoveVideo = useCallback(() => {
    if (playerRef.current?.destroy) playerRef.current.destroy();
    playerRef.current = null;
    onVideoUrlChange('');
    setUrlInput('');
    setView('search');
    onBookmarksChange([]);
  }, [onVideoUrlChange, onBookmarksChange]);

  const handleAddBookmark = useCallback(() => {
    const newBookmark: VideoBookmark = {
      id: `bm-${Date.now()}`,
      timestamp: currentTime,
      label: bookmarkLabel || t('sketchVideo.bookmarkAtTime', { time: formatTime(currentTime) }),
      createdAt: new Date(),
    };
    onBookmarksChange([...bookmarks, newBookmark]);
    setBookmarkLabel('');
    toast.success(t('sketchVideo.bookmarkAdded', { time: formatTime(currentTime) }));
  }, [currentTime, bookmarkLabel, bookmarks, onBookmarksChange, t]);

  const handleSeekToBookmark = useCallback((timestamp: number) => {
    if (playerRef.current?.seekTo) {
      playerRef.current.seekTo(timestamp, true);
      setCurrentTime(timestamp);
    }
  }, []);

  const handleDeleteBookmark = useCallback((id: string) => {
    onBookmarksChange(bookmarks.filter(b => b.id !== id));
  }, [bookmarks, onBookmarksChange]);


  if (collapsed) {
    return (
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40">
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/95 backdrop-blur-sm border border-border/50 shadow-lg text-xs font-medium hover:bg-card transition-colors"
        >
          <Video className="h-3.5 w-3.5 text-destructive" />
          {videoId ? t('sketchVideo.showVideo') : t('sketchVideo.addVideo')}
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-[420px]">
      <div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4 text-destructive" />
            <span className="text-xs font-semibold">{t('sketchVideo.video')}</span>
            {videoId && (
              <span className="text-[10px] text-muted-foreground font-mono">
                {formatTime(currentTime)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCollapsed(true)}
              className="p-1 rounded-md hover:bg-muted/80 transition-colors"
            >
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-muted/80 transition-colors"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content */}
        {view === 'search' ? (
          <div className="p-3 space-y-3">
            {/* URL Input */}
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder={t('sketchVideo.pasteYoutubeUrl')}
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddVideo(urlInput);
                }}
                className="text-xs h-8 flex-1"
              />
              <Button
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => handleAddVideo(urlInput)}
                disabled={!urlInput.trim()}
              >
                {t('sketchVideo.add')}
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground text-center">
              {t('sketchVideo.pasteDescription')}
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {/* Video Player */}
            {videoId && (
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <div
                  id={`yt-player-${videoId}`}
                  className="absolute inset-0 w-full h-full"
                />
              </div>
            )}

            {/* Bookmark Controls */}
            <div className="p-2 border-t border-border/30">
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 text-[10px] font-mono text-muted-foreground flex-shrink-0">
                  <Clock className="h-3 w-3" />
                  {formatTime(currentTime)}
                </div>
                <Input
                  placeholder={t('sketchVideo.bookmarkLabel')}
                  value={bookmarkLabel}
                  onChange={(e) => setBookmarkLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddBookmark();
                  }}
                  className="text-[11px] h-7 flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-[10px] gap-1"
                  onClick={handleAddBookmark}
                >
                  <Bookmark className="h-3 w-3" />
                  {t('sketchVideo.add')}
                </Button>
              </div>

              {/* Bookmarks List */}
              {bookmarks.length > 0 && (
                <div className="mt-2 max-h-24 overflow-y-auto space-y-1">
                  {bookmarks
                    .sort((a, b) => a.timestamp - b.timestamp)
                    .map((bm) => (
                      <div
                        key={bm.id}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted/50 cursor-pointer group transition-colors"
                        onClick={() => handleSeekToBookmark(bm.timestamp)}
                      >
                        <Bookmark className="h-3 w-3 text-primary flex-shrink-0" />
                        <span className="text-[10px] font-mono text-primary flex-shrink-0 w-10">
                          {formatTime(bm.timestamp)}
                        </span>
                        <span className="text-[11px] truncate flex-1">{bm.label}</span>
                        <button
                          className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/20 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBookmark(bm.id);
                          }}
                        >
                          <X className="h-2.5 w-2.5 text-destructive" />
                        </button>
                      </div>
                    ))}
                </div>
              )}

              {/* Remove Video */}
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] text-destructive hover:text-destructive px-2"
                  onClick={handleRemoveVideo}
                >
                  {t('sketchVideo.removeVideo')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

SketchVideoPanel.displayName = 'SketchVideoPanel';
