import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Mic, Check, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { blobToDataUrl } from '@/utils/audioStorage';

interface VoiceRecordingSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingComplete: (audioBlob: Blob, audioUrl: string, duration: number) => void;
}

export const VoiceRecordingSheet = ({ isOpen, onClose, onRecordingComplete }: VoiceRecordingSheetProps) => {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);

  const triggerHaptic = useCallback(async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (e) {
      // Ignore - not on native
    }
  }, []);

  // Cleanup on unmount or close
  useEffect(() => {
    if (!isOpen) {
      cleanup();
    }
    return () => cleanup();
  }, [isOpen]);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {
        // Already closed, ignore
      }
    }
    audioContextRef.current = null;
    setIsRecording(false);
    setIsPaused(false);
    setRecordingTime(0);
    setWaveformData([]);
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      setIsPaused(true);
      triggerHaptic();
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      
      // Resume timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // Resume waveform
      const updateWaveform = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const samples: number[] = [];
          for (let i = 0; i < 50; i++) {
            const index = Math.floor(i * dataArray.length / 50);
            samples.push(dataArray[index] / 255);
          }
          setWaveformData(samples);
        }
        animationRef.current = requestAnimationFrame(updateWaveform);
      };
      updateWaveform();
      
      setIsPaused(false);
      triggerHaptic();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Setup audio context for waveform
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 128;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // Start waveform animation
      const updateWaveform = () => {
        if (analyserRef.current) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          
          // Sample every few values for visualization
          const samples: number[] = [];
          for (let i = 0; i < 50; i++) {
            const index = Math.floor(i * dataArray.length / 50);
            samples.push(dataArray[index] / 255);
          }
          setWaveformData(samples);
        }
        animationRef.current = requestAnimationFrame(updateWaveform);
      };
      updateWaveform();
      
      triggerHaptic();
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const finishRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      const currentRecordingTime = recordingTime;
      
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        try {
          // Convert to persistent data URL instead of temporary blob URL
          const dataUrl = await blobToDataUrl(audioBlob);
          console.log('[VoiceRecording] Converted to data URL, length:', dataUrl.length);
          onRecordingComplete(audioBlob, dataUrl, currentRecordingTime);
        } catch (error) {
          console.error('[VoiceRecording] Failed to convert to data URL:', error);
          // Fallback to blob URL (won't survive page reload but at least works in session)
          const blobUrl = URL.createObjectURL(audioBlob);
          onRecordingComplete(audioBlob, blobUrl, currentRecordingTime);
        }
        
        cleanup();
        onClose();
      };
      
      mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      triggerHaptic();
    }
  };

  const cancelRecording = () => {
    cleanup();
    onClose();
    triggerHaptic();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-[60]"
        onClick={cancelRecording}
      />
      
      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-[70] bg-card rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="p-6 pb-8">
          {/* Duration Display */}
          <div className="text-center mb-6">
            <span className="text-4xl font-bold text-foreground">
              {formatTime(recordingTime)}
            </span>
          </div>
          
          {/* Waveform Visualization */}
          <div className="h-24 bg-muted/50 rounded-xl mb-8 flex items-center justify-center px-2 overflow-hidden">
            <div className="flex items-center justify-center gap-[2px] h-full w-full">
              {(waveformData.length > 0 ? waveformData : Array(50).fill(0.05)).map((value, index) => (
                <div
                  key={index}
                  className="bg-muted-foreground/40 rounded-full transition-all duration-75"
                  style={{
                    width: '3px',
                    height: `${Math.max(4, value * 80)}px`,
                  }}
                />
              ))}
            </div>
          </div>
          
          {/* Control Buttons */}
          <div className="flex items-center justify-center gap-8">
            {/* Cancel Button */}
            <button
              onClick={cancelRecording}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-14 h-14 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <X className="w-6 h-6 text-orange-500" />
              </div>
              <span className="text-sm text-muted-foreground">
                {t('voice.cancel', 'Cancel')}
              </span>
            </button>
            
            {/* Record/Pause/Resume Button */}
            <button
              onClick={() => {
                if (!isRecording) {
                  startRecording();
                } else if (isPaused) {
                  resumeRecording();
                } else {
                  pauseRecording();
                }
              }}
              className="flex flex-col items-center gap-2"
            >
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center transition-all",
                isPaused ? "bg-primary/80" : "bg-primary"
              )}>
                {isRecording && !isPaused ? (
                  <Pause className="w-7 h-7 text-primary-foreground" />
                ) : (
                  <Mic className="w-7 h-7 text-primary-foreground" />
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                {!isRecording 
                  ? t('voice.record', 'Record')
                  : isPaused 
                    ? t('voice.resume', 'Resume')
                    : t('voice.pause', 'Pause')
                }
              </span>
            </button>
            
            {/* Finish Button */}
            <button
              onClick={finishRecording}
              disabled={!isRecording || recordingTime === 0}
              className="flex flex-col items-center gap-2"
            >
              <div className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center",
                isRecording && recordingTime > 0
                  ? "bg-primary/10"
                  : "bg-muted"
              )}>
                <Check className={cn(
                  "w-6 h-6",
                  isRecording && recordingTime > 0
                    ? "text-primary"
                    : "text-muted-foreground"
                )} />
              </div>
              <span className="text-sm text-muted-foreground">
                {t('voice.finish', 'Finish')}
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
