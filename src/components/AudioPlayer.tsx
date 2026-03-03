import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Pause, Volume2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { createPlayableUrl, revokePlayableUrl } from '@/utils/audioStorage';

interface AudioPlayerProps {
  src: string;
  className?: string;
}

const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2];

export const AudioPlayer = ({ src, className }: AudioPlayerProps) => {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const playableUrlRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [hasError, setHasError] = useState(false);

  // Create playable URL on mount
  useEffect(() => {
    if (!src) {
      setHasError(true);
      return;
    }

    try {
      playableUrlRef.current = createPlayableUrl(src);
    } catch (error) {
      console.error('[AudioPlayer] Failed to create playable URL:', error);
      setHasError(true);
    }

    return () => {
      if (playableUrlRef.current && playableUrlRef.current !== src) {
        revokePlayableUrl(playableUrlRef.current);
        playableUrlRef.current = null;
      }
    };
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    const handleError = () => {
      console.error('[AudioPlayer] Audio playback error');
      setHasError(true);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const cyclePlaybackSpeed = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    const newSpeed = PLAYBACK_SPEEDS[nextIndex];
    
    audio.playbackRate = newSpeed;
    setPlaybackSpeed(newSpeed);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Show error state
  if (hasError) {
    return (
      <div className={cn(
        "flex items-center gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20",
        className
      )}>
        <AlertCircle className="h-5 w-5 text-destructive" />
        <span className="text-sm text-destructive">{t('audioPlayer.audioUnavailable')}</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-xl bg-black/5 dark:bg-white/10",
      className
    )}>
      <audio ref={audioRef} src={playableUrlRef.current || src} preload="metadata" />
      
      {/* Play/Pause Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePlay}
        className="h-10 w-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5 ml-0.5" />
        )}
      </Button>

      {/* Time Display */}
      <span className="text-sm font-medium min-w-[70px] text-foreground/80">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      {/* Progress Bar */}
      <div className="flex-1 relative h-2 bg-black/10 dark:bg-white/20 rounded-full overflow-hidden">
        <div 
          className="absolute h-full bg-primary rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      {/* Volume Icon */}
      <Volume2 className="h-4 w-4 text-foreground/60 shrink-0" />

      {/* Playback Speed Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={cyclePlaybackSpeed}
        className="h-8 px-2 text-xs font-semibold min-w-[45px] shrink-0"
      >
        {playbackSpeed}x
      </Button>
    </div>
  );
};
