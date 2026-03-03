import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Check, X, Scissors, RotateCcw, Sparkles, Volume2, AudioWaveform } from 'lucide-react';
import { cn } from '@/lib/utils';
import { applyAudioEffects, AUDIO_PRESETS } from '@/utils/audioEffects';
import { toast } from 'sonner';

interface VoiceTrimmerProps {
  audioUrl: string;
  duration: number;
  onSave: (trimmedAudioUrl: string, newDuration: number) => void;
  onCancel: () => void;
}

export const VoiceTrimmer = ({ audioUrl, duration, onSave, onCancel }: VoiceTrimmerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [startTrim, setStartTrim] = useState(0);
  const [endTrim, setEndTrim] = useState(duration);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [actualDuration, setActualDuration] = useState(duration);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'playhead' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Audio effects state
  const [noiseReduction, setNoiseReduction] = useState(false);
  const [normalize, setNormalize] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const BAR_COUNT = 60;

  // Extract waveform data from audio
  useEffect(() => {
    const extractWaveform = async () => {
      try {
        // Fetch audio data
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Update duration from actual audio
        setActualDuration(audioBuffer.duration);
        setEndTrim(audioBuffer.duration);
        
        // Get audio channel data
        const channelData = audioBuffer.getChannelData(0);
        const samplesPerBar = Math.floor(channelData.length / BAR_COUNT);
        
        const bars: number[] = [];
        for (let i = 0; i < BAR_COUNT; i++) {
          let sum = 0;
          const start = i * samplesPerBar;
          for (let j = start; j < start + samplesPerBar && j < channelData.length; j++) {
            sum += Math.abs(channelData[j]);
          }
          const avg = sum / samplesPerBar;
          bars.push(avg);
        }
        
        // Normalize
        const max = Math.max(...bars, 0.01);
        const normalized = bars.map(v => v / max);
        setWaveformData(normalized);
        
        audioContext.close();
      } catch (error) {
        console.error('Error extracting waveform:', error);
        // Fallback to random waveform
        const fallback = Array.from({ length: BAR_COUNT }, () => Math.random() * 0.5 + 0.2);
        setWaveformData(fallback);
      }
    };
    
    extractWaveform();
  }, [audioUrl]);

  // Draw waveform with trim indicators
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    
    const barWidth = width / BAR_COUNT - 1;
    const startPercent = startTrim / actualDuration;
    const endPercent = endTrim / actualDuration;
    const currentPercent = currentTime / actualDuration;
    
    // Draw bars
    for (let i = 0; i < BAR_COUNT; i++) {
      const barPercent = i / BAR_COUNT;
      const barHeight = Math.max(4, waveformData[i] * height * 0.85);
      const x = i * (barWidth + 1);
      const y = (height - barHeight) / 2;
      
      // Determine color based on trim region
      if (barPercent < startPercent || barPercent > endPercent) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.3)'; // Trimmed region - red/faded
      } else {
        ctx.fillStyle = 'hsl(var(--primary))'; // Active region
      }
      
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);
      ctx.fill();
    }
    
    // Draw playhead
    const playheadX = currentPercent * width;
    ctx.fillStyle = 'hsl(var(--foreground))';
    ctx.fillRect(playheadX - 1, 0, 2, height);
    
  }, [waveformData, startTrim, endTrim, currentTime, actualDuration]);

  // Setup audio element
  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    
    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setActualDuration(audio.duration);
        setEndTrim(audio.duration);
      }
    };
    
    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
      // Stop at end trim
      if (audio.currentTime >= endTrim) {
        audio.pause();
        audio.currentTime = startTrim;
        setIsPlaying(false);
      }
    };
    
    audio.onended = () => {
      setIsPlaying(false);
      audio.currentTime = startTrim;
    };
    
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [audioUrl, startTrim, endTrim]);

  const togglePlayback = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // Start from start trim if before it
      if (audioRef.current.currentTime < startTrim) {
        audioRef.current.currentTime = startTrim;
      }
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!waveformContainerRef.current || !audioRef.current) return;
    
    const rect = waveformContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * actualDuration;
    
    // Clamp to trim region
    const clampedTime = Math.max(startTrim, Math.min(endTrim, newTime));
    audioRef.current.currentTime = clampedTime;
    setCurrentTime(clampedTime);
  };

  const handleTrimHandleMouseDown = (handle: 'start' | 'end') => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(handle);
  };

  useEffect(() => {
    if (!isDragging) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!waveformContainerRef.current) return;
      
      const rect = waveformContainerRef.current.getBoundingClientRect();
      const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const newTime = percentage * actualDuration;
      
      if (isDragging === 'start') {
        setStartTrim(Math.min(newTime, endTrim - 0.5));
      } else if (isDragging === 'end') {
        setEndTrim(Math.max(newTime, startTrim + 0.5));
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(null);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, startTrim, endTrim, actualDuration]);

  // Touch handling for mobile
  const handleTouchStart = (handle: 'start' | 'end') => (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(handle);
  };

  useEffect(() => {
    if (!isDragging) return;
    
    const handleTouchMove = (e: TouchEvent) => {
      if (!waveformContainerRef.current) return;
      
      const rect = waveformContainerRef.current.getBoundingClientRect();
      const touch = e.touches[0];
      const percentage = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
      const newTime = percentage * actualDuration;
      
      if (isDragging === 'start') {
        setStartTrim(Math.min(newTime, endTrim - 0.5));
      } else if (isDragging === 'end') {
        setEndTrim(Math.max(newTime, startTrim + 0.5));
      }
    };
    
    const handleTouchEnd = () => {
      setIsDragging(null);
    };
    
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, startTrim, endTrim, actualDuration]);

  const resetTrim = () => {
    setStartTrim(0);
    setEndTrim(actualDuration);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    setCurrentTime(0);
  };

  const handleSave = async () => {
    setIsProcessing(true);
    try {
      // Fetch and decode audio
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Calculate sample positions
      const sampleRate = audioBuffer.sampleRate;
      const startSample = Math.floor(startTrim * sampleRate);
      const endSample = Math.floor(endTrim * sampleRate);
      const newLength = endSample - startSample;
      
      // Create new buffer with trimmed audio
      const trimmedBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        newLength,
        sampleRate
      );
      
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const sourceData = audioBuffer.getChannelData(channel);
        const destData = trimmedBuffer.getChannelData(channel);
        for (let i = 0; i < newLength; i++) {
          destData[i] = sourceData[startSample + i];
        }
      }
      
      // Convert to WAV blob first
      const wavBlob = audioBufferToWav(trimmedBuffer);
      
      // Convert to base64
      const trimmedBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(wavBlob);
      });
      
      audioContext.close();
      
      // Apply audio effects if any are enabled
      let finalAudioUrl = trimmedBase64;
      
      if (noiseReduction || normalize) {
        toast.loading('Applying audio effects...', { id: 'audio-effects' });
        
        try {
          finalAudioUrl = await applyAudioEffects(trimmedBase64, {
            noiseReduction,
            noiseThreshold: 0.02,
            normalize,
            targetPeak: 0.9,
            compressor: noiseReduction, // Apply compressor with noise reduction
            highPassFilter: noiseReduction, // Apply high-pass with noise reduction
            highPassFrequency: 80,
          });
          
          toast.success('Audio effects applied!', { id: 'audio-effects' });
        } catch (effectError) {
          console.error('Error applying effects:', effectError);
          toast.error('Failed to apply effects, saving original', { id: 'audio-effects' });
        }
      }
      
      const newDuration = Math.round(endTrim - startTrim);
      onSave(finalAudioUrl, newDuration);
      
    } catch (error) {
      console.error('Error processing audio:', error);
      toast.error('Failed to process audio');
      // Fallback - just save original
      onSave(audioUrl, Math.round(endTrim - startTrim));
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-xl border border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scissors className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Trim Recording</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={resetTrim}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Waveform with trim handles */}
      <div 
        ref={waveformContainerRef}
        className="relative h-16 bg-background rounded-lg overflow-hidden cursor-pointer"
        onClick={handleWaveformClick}
      >
        <canvas 
          ref={canvasRef}
          width={300}
          height={64}
          className="w-full h-full"
        />
        
        {/* Start trim handle */}
        <div
          className="absolute top-0 bottom-0 w-3 bg-destructive/80 cursor-ew-resize flex items-center justify-center rounded-l-md hover:bg-destructive transition-colors touch-none"
          style={{ left: `${(startTrim / actualDuration) * 100}%` }}
          onMouseDown={handleTrimHandleMouseDown('start')}
          onTouchStart={handleTouchStart('start')}
        >
          <div className="w-0.5 h-6 bg-white rounded-full" />
        </div>
        
        {/* End trim handle */}
        <div
          className="absolute top-0 bottom-0 w-3 bg-destructive/80 cursor-ew-resize flex items-center justify-center rounded-r-md hover:bg-destructive transition-colors touch-none"
          style={{ left: `calc(${(endTrim / actualDuration) * 100}% - 12px)` }}
          onMouseDown={handleTrimHandleMouseDown('end')}
          onTouchStart={handleTouchStart('end')}
        >
          <div className="w-0.5 h-6 bg-white rounded-full" />
        </div>
        
        {/* Trim overlay - start */}
        <div 
          className="absolute top-0 bottom-0 left-0 bg-destructive/20 pointer-events-none"
          style={{ width: `${(startTrim / actualDuration) * 100}%` }}
        />
        
        {/* Trim overlay - end */}
        <div 
          className="absolute top-0 bottom-0 right-0 bg-destructive/20 pointer-events-none"
          style={{ width: `${((actualDuration - endTrim) / actualDuration) * 100}%` }}
        />
      </div>
      
      {/* Time display */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatTime(startTrim)}</span>
        <span className="text-foreground font-medium">
          Selection: {formatTime(endTrim - startTrim)}
        </span>
        <span>{formatTime(endTrim)}</span>
      </div>
      
      {/* Audio Effects */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Effects:</span>
        <button
          onClick={() => setNoiseReduction(!noiseReduction)}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
            noiseReduction 
              ? "bg-primary text-primary-foreground" 
              : "bg-muted hover:bg-muted/80 text-muted-foreground"
          )}
        >
          <AudioWaveform className="h-3.5 w-3.5" />
          Noise Reduction
        </button>
        <button
          onClick={() => setNormalize(!normalize)}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
            normalize 
              ? "bg-primary text-primary-foreground" 
              : "bg-muted hover:bg-muted/80 text-muted-foreground"
          )}
        >
          <Volume2 className="h-3.5 w-3.5" />
          Normalize Volume
        </button>
      </div>
      
      {/* Controls */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={togglePlayback} className="gap-2">
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          Preview
        </Button>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={isProcessing}>
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isProcessing} className="gap-1">
            {isProcessing ? (
              <>
                <Sparkles className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Apply
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Helper function to convert AudioBuffer to WAV Blob
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;
  
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  
  // RIFF header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  
  // fmt chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  
  // data chunk
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);
  
  // Interleave channels and write samples
  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }
  
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
