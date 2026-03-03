import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause, Trash2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createPlayableUrl, revokePlayableUrl, isDataUrl, isBlobUrl } from '@/utils/audioStorage';

interface NoteVoicePlayerProps {
  audioUrl: string;
  duration: number;
  onDelete?: () => void;
  className?: string;
}

export const NoteVoicePlayer = ({ 
  audioUrl, 
  duration, 
  onDelete,
  className 
}: NoteVoicePlayerProps) => {
  const { t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playableUrlRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (!audioUrl) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    // Create a playable URL (converts data URL to blob URL for better performance)
    try {
      const playableUrl = createPlayableUrl(audioUrl);
      playableUrlRef.current = playableUrl;
      
      const audio = new Audio(playableUrl);
      audioRef.current = audio;
      
      const handleCanPlay = () => {
        setIsLoading(false);
        setHasError(false);
      };
      
      const handleTimeUpdate = () => {
        setCurrentTime(audio.currentTime);
      };
      
      const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };
      
      const handleError = () => {
        console.error('[NoteVoicePlayer] Audio playback error for URL type:', 
          isDataUrl(audioUrl) ? 'data URL' : isBlobUrl(audioUrl) ? 'blob URL' : 'other'
        );
        setHasError(true);
        setIsLoading(false);
      };
      
      audio.addEventListener('canplay', handleCanPlay);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);
      
      // Attempt to load
      audio.load();
      
      return () => {
        audio.removeEventListener('canplay', handleCanPlay);
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
        audio.pause();
        audio.src = '';
        
        // Revoke the playable URL to free memory
        if (playableUrlRef.current && playableUrlRef.current !== audioUrl) {
          revokePlayableUrl(playableUrlRef.current);
        }
      };
    } catch (error) {
      console.error('[NoteVoicePlayer] Failed to create playable URL:', error);
      setHasError(true);
      setIsLoading(false);
    }
  }, [audioUrl]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current || hasError) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((error) => {
        console.error('[NoteVoicePlayer] Play failed:', error);
        setHasError(true);
      });
    }
    setIsPlaying(!isPlaying);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.pause();
    }
    onDelete?.();
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Show error state
  if (hasError) {
    return (
      <div 
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20",
          className
        )}
      >
        <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
        <span className="flex-1 text-sm text-destructive">{t('voicePlayer.recordingUnavailable')}</span>
        {onDelete && (
          <button
            onClick={handleDelete}
            className="w-7 h-7 rounded-full hover:bg-destructive/20 flex items-center justify-center shrink-0 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/60 border border-border/40",
        className
      )}
    >
      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        disabled={isLoading}
        className={cn(
          "w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 transition-colors",
          isLoading ? "opacity-50" : "hover:bg-primary/90"
        )}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 text-primary-foreground" />
        ) : (
          <Play className="w-4 h-4 text-primary-foreground ml-0.5" />
        )}
      </button>
      
      {/* Progress Bar */}
      <div className="flex-1 h-1.5 bg-muted-foreground/20 rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Duration */}
      <span className="text-xs font-medium text-muted-foreground shrink-0 min-w-[32px] text-right">
        {formatTime(isPlaying ? currentTime : duration)}
      </span>
      
      {/* Delete Button */}
      {onDelete && (
        <button
          onClick={handleDelete}
          className="w-7 h-7 rounded-full hover:bg-destructive/10 flex items-center justify-center shrink-0 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
        </button>
      )}
    </div>
  );
};
