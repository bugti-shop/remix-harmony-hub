import { useState, useRef, useEffect } from 'react';
import { Trash2, Play, Pause, Share2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { createPlayableUrl, revokePlayableUrl, isDataUrl, isBlobUrl } from '@/utils/audioStorage';

interface VoicePlaybackSheetProps {
  isOpen: boolean;
  onClose: () => void;
  audioUrl: string;
  duration: number;
  onDelete: () => void;
}

export const VoicePlaybackSheet = ({ 
  isOpen, 
  onClose, 
  audioUrl, 
  duration,
  onDelete 
}: VoicePlaybackSheetProps) => {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const playableUrlRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration);
  const [waveformBars, setWaveformBars] = useState<number[]>([]);
  const [hasError, setHasError] = useState(false);
  
  // Generate random waveform and setup playable URL on mount
  useEffect(() => {
    if (isOpen) {
      const bars: number[] = [];
      for (let i = 0; i < 60; i++) {
        bars.push(0.2 + Math.random() * 0.8);
      }
      setWaveformBars(bars);
      setCurrentTime(0);
      setIsPlaying(false);
      setHasError(false);
      
      // Create playable URL
      try {
        playableUrlRef.current = createPlayableUrl(audioUrl);
      } catch (error) {
        console.error('[VoicePlaybackSheet] Failed to create playable URL:', error);
        setHasError(true);
      }
    }
    
    return () => {
      // Cleanup playable URL
      if (playableUrlRef.current && playableUrlRef.current !== audioUrl) {
        revokePlayableUrl(playableUrlRef.current);
        playableUrlRef.current = null;
      }
    };
  }, [isOpen, audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setAudioDuration(audio.duration);
      }
    };
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {
      // Ignore
    }

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleDelete = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (e) {
      // Ignore
    }
    onDelete();
    onClose();
  };

  const handleShare = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
      
      // Try native share first
      await Share.share({
        title: t('voice.shareRecording', 'Voice Recording'),
        text: t('voice.shareMessage', 'Check out this voice recording'),
        url: audioUrl,
        dialogTitle: t('voice.shareWith', 'Share with'),
      });
    } catch (e) {
      // Fallback: copy URL
      try {
        await navigator.clipboard.writeText(audioUrl);
        toast.success(t('voice.linkCopied', 'Recording link copied'));
      } catch {
        toast.error(t('voice.shareFailed', 'Could not share recording'));
      }
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = audioDuration > 0 ? (currentTime / audioDuration) : 0;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-[60]"
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-[70] bg-card rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="p-6 pb-8">
          {/* Hidden audio element with playable URL */}
          <audio 
            ref={audioRef} 
            src={playableUrlRef.current || audioUrl} 
            preload="metadata" 
            onError={() => setHasError(true)}
          />
          
          {/* Title */}
          <h2 className="text-xl font-semibold text-center text-foreground mb-6">
            {t('voice.playRecording', 'Play Recording')}
          </h2>
          
          {/* Waveform Visualization with Progress */}
          <div className="h-24 bg-muted/50 rounded-xl mb-4 flex items-center justify-center px-2 overflow-hidden relative">
            <div className="flex items-center justify-center gap-[2px] h-full w-full">
              {waveformBars.map((value, index) => {
                const barProgress = index / waveformBars.length;
                const isPlayed = barProgress <= progress;
                
                return (
                  <div
                    key={index}
                    className={cn(
                      "rounded-full transition-colors duration-100",
                      isPlayed ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                    style={{
                      width: '3px',
                      height: `${Math.max(8, value * 70)}px`,
                    }}
                  />
                );
              })}
            </div>
          </div>
          
          {/* Time Display */}
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-sm text-muted-foreground">
              {formatTime(currentTime)}
            </span>
            <span className="text-2xl font-bold text-foreground">
              {formatTime(currentTime)}
            </span>
            <span className="text-sm text-muted-foreground">
              {formatTime(audioDuration)}
            </span>
          </div>
          
          {/* Control Buttons */}
          <div className="flex items-center justify-center gap-8 mt-6">
            {/* Delete Button */}
            <button
              onClick={handleDelete}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-14 h-14 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-orange-500" />
              </div>
              <span className="text-sm text-muted-foreground">
                {t('voice.delete', 'Delete')}
              </span>
            </button>
            
            {/* Play/Pause Button */}
            <button
              onClick={togglePlay}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                {isPlaying ? (
                  <Pause className="w-7 h-7 text-primary-foreground" />
                ) : (
                  <Play className="w-7 h-7 text-primary-foreground ml-1" />
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                {isPlaying ? t('voice.pause', 'Pause') : t('voice.play', 'Play')}
              </span>
            </button>
            
            {/* Share Button */}
            <button
              onClick={handleShare}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Share2 className="w-6 h-6 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">
                {t('voice.share', 'Share')}
              </span>
            </button>
          </div>
        </div>
        
        {/* Safe area padding */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </>
  );
};
