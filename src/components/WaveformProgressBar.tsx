import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface WaveformProgressBarProps {
  audioUrl: string;
  progress: number;
  duration: number;
  isPlaying: boolean;
  onSeek?: (percentage: number) => void;
  className?: string;
  height?: number;
}

export const WaveformProgressBar = ({
  audioUrl,
  progress,
  duration,
  isPlaying,
  onSeek,
  className,
  height = 24
}: WaveformProgressBarProps) => {
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const BAR_COUNT = 40;

  // Extract waveform data from audio
  useEffect(() => {
    const extractWaveform = async () => {
      if (!audioUrl) return;
      
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
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
        const normalized = bars.map(v => Math.max(0.15, v / max)); // Min height
        setWaveformData(normalized);
        
        audioContext.close();
      } catch (error) {
        console.error('Error extracting waveform:', error);
        // Fallback waveform
        const fallback = Array.from({ length: BAR_COUNT }, () => Math.random() * 0.5 + 0.25);
        setWaveformData(fallback);
      }
    };
    
    extractWaveform();
  }, [audioUrl]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    const { width, height: canvasHeight } = canvas.getBoundingClientRect();
    
    canvas.width = width * dpr;
    canvas.height = canvasHeight * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.clearRect(0, 0, width, canvasHeight);
    
    const barWidth = width / BAR_COUNT - 1;
    const progressPercent = progress / 100;
    
    for (let i = 0; i < BAR_COUNT; i++) {
      const barPercent = i / BAR_COUNT;
      const barHeight = Math.max(3, waveformData[i] * canvasHeight * 0.85);
      const x = i * (barWidth + 1);
      const y = (canvasHeight - barHeight) / 2;
      
      // Color based on progress
      if (barPercent <= progressPercent) {
        ctx.fillStyle = 'hsl(var(--primary))';
      } else {
        ctx.fillStyle = 'hsl(var(--primary) / 0.25)';
      }
      
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1.5);
      ctx.fill();
    }
    
  }, [waveformData, progress]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = (clickX / rect.width) * 100;
    onSeek(Math.max(0, Math.min(100, percentage)));
  }, [onSeek]);

  if (waveformData.length === 0) {
    // Fallback progress bar while loading
    return (
      <div 
        ref={containerRef}
        className={cn("relative rounded-full overflow-hidden cursor-pointer", className)}
        style={{ height }}
        onClick={handleClick}
      >
        <div className="absolute inset-0 bg-primary/20" />
        <div 
          className="absolute h-full bg-primary rounded-full transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={cn("relative rounded-md overflow-hidden cursor-pointer", className)}
      style={{ height }}
      onClick={handleClick}
    >
      <canvas 
        ref={canvasRef}
        className="w-full h-full"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};
