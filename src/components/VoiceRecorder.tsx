import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Play, Pause, Trash2, Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { blobToDataUrl } from '@/utils/audioStorage';

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, audioUrl: string, duration: number) => void;
  className?: string;
  autoStart?: boolean;
}

export const VoiceRecorder = ({ onRecordingComplete, className, autoStart = false }: VoiceRecorderProps) => {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);

  const triggerHaptic = useCallback(async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (e) {
      // Ignore - not on native
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Auto-start recording if enabled
  useEffect(() => {
    if (autoStart && !isRecording && !audioUrl) {
      startRecording();
    }
  }, [autoStart]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioBlobRef.current = audioBlob;
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      triggerHaptic();
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      triggerHaptic();
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  };

  const playRecording = () => {
    if (audioUrl && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const discardRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    audioBlobRef.current = null;
    setRecordingTime(0);
    setPlaybackTime(0);
    triggerHaptic();
  };

  const confirmRecording = async () => {
    if (audioBlobRef.current && audioUrl) {
      try {
        // Convert to persistent data URL
        const dataUrl = await blobToDataUrl(audioBlobRef.current);
        console.log('[VoiceRecorder] Converted to data URL, length:', dataUrl.length);
        onRecordingComplete(audioBlobRef.current, dataUrl, recordingTime);
      } catch (error) {
        console.error('[VoiceRecorder] Failed to convert to data URL:', error);
        // Fallback to existing blob URL
        onRecordingComplete(audioBlobRef.current, audioUrl, recordingTime);
      }
      triggerHaptic();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Audio element event handlers
  useEffect(() => {
    if (audioRef.current) {
      const audio = audioRef.current;
      
      const handleTimeUpdate = () => setPlaybackTime(audio.currentTime);
      const handleEnded = () => setIsPlaying(false);
      
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('ended', handleEnded);
      
      return () => {
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('ended', handleEnded);
      };
    }
  }, [audioUrl]);

  return (
    <div className={cn("flex flex-col items-center gap-6 p-6", className)}>
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="metadata" />}
      
      {/* Recording visualizer / timer */}
      <div className="flex flex-col items-center gap-4">
        <div className={cn(
          "w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300",
          isRecording && !isPaused 
            ? "bg-destructive animate-pulse shadow-lg shadow-destructive/50" 
            : audioUrl 
              ? "bg-primary/20"
              : "bg-muted"
        )}>
          {isRecording ? (
            <div className="text-center">
              <Mic className={cn("h-12 w-12 mx-auto mb-2", isRecording && !isPaused ? "text-white" : "text-muted-foreground")} />
              <span className={cn("text-2xl font-mono font-bold", isRecording && !isPaused ? "text-white" : "text-foreground")}>
                {formatTime(recordingTime)}
              </span>
            </div>
          ) : audioUrl ? (
            <div className="text-center">
              {isPlaying ? (
                <Pause className="h-12 w-12 text-primary mx-auto mb-2" />
              ) : (
                <Play className="h-12 w-12 text-primary mx-auto mb-2" />
              )}
              <span className="text-2xl font-mono font-bold text-foreground">
                {formatTime(recordingTime)}
              </span>
            </div>
          ) : (
            <Mic className="h-12 w-12 text-muted-foreground" />
          )}
        </div>
        
        {/* Status text */}
        <p className="text-sm text-muted-foreground">
          {isRecording && !isPaused && t('voice.recording', 'Recording...')}
          {isRecording && isPaused && t('voice.paused', 'Paused')}
          {!isRecording && !audioUrl && t('voice.tapToRecord', 'Tap to start recording')}
          {!isRecording && audioUrl && t('voice.recordingComplete', 'Recording complete')}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {!isRecording && !audioUrl && (
          <Button
            size="lg"
            onClick={startRecording}
            className="h-16 w-16 rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            <Mic className="h-8 w-8" />
          </Button>
        )}
        
        {isRecording && (
          <>
            <Button
              size="icon"
              variant="outline"
              onClick={isPaused ? resumeRecording : pauseRecording}
              className="h-14 w-14 rounded-full"
            >
              {isPaused ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
            </Button>
            
            <Button
              size="lg"
              onClick={stopRecording}
              className="h-16 w-16 rounded-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              <Square className="h-6 w-6 fill-current" />
            </Button>
          </>
        )}
        
        {!isRecording && audioUrl && (
          <>
            <Button
              size="icon"
              variant="outline"
              onClick={discardRecording}
              className="h-14 w-14 rounded-full text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-6 w-6" />
            </Button>
            
            <Button
              size="lg"
              onClick={playRecording}
              variant="outline"
              className="h-16 w-16 rounded-full"
            >
              {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8 ml-1" />}
            </Button>
            
            <Button
              size="icon"
              onClick={confirmRecording}
              className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90"
            >
              <Check className="h-6 w-6" />
            </Button>
          </>
        )}
      </div>
      
      {/* Re-record option */}
      {!isRecording && audioUrl && (
        <Button
          variant="ghost"
          onClick={discardRecording}
          className="text-muted-foreground"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          {t('voice.recordAgain', 'Record again')}
        </Button>
      )}
    </div>
  );
};