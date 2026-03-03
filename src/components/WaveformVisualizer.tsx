import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface WaveformVisualizerProps {
  audioData?: Float32Array | null;
  isActive: boolean;
  className?: string;
  barCount?: number;
  color?: string;
}

export const WaveformVisualizer = ({
  audioData,
  isActive,
  className,
  barCount = 20,
  color = 'currentColor'
}: WaveformVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const barsRef = useRef<number[]>(new Array(barCount).fill(0.1));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const barWidth = width / barCount - 2;
      const maxBarHeight = height * 0.9;

      if (isActive && audioData) {
        // Calculate RMS for each segment
        const segmentSize = Math.floor(audioData.length / barCount);
        for (let i = 0; i < barCount; i++) {
          let sum = 0;
          const start = i * segmentSize;
          for (let j = start; j < start + segmentSize && j < audioData.length; j++) {
            sum += audioData[j] * audioData[j];
          }
          const rms = Math.sqrt(sum / segmentSize);
          // Smooth transition
          barsRef.current[i] = barsRef.current[i] * 0.7 + (rms * 3 + 0.1) * 0.3;
        }
      } else if (isActive) {
        // Animated idle state when active but no data
        for (let i = 0; i < barCount; i++) {
          const time = Date.now() / 200;
          const wave = Math.sin(time + i * 0.5) * 0.3 + 0.4;
          barsRef.current[i] = barsRef.current[i] * 0.8 + wave * 0.2;
        }
      } else {
        // Decay to minimum when inactive
        for (let i = 0; i < barCount; i++) {
          barsRef.current[i] = barsRef.current[i] * 0.9 + 0.1 * 0.1;
        }
      }

      // Draw bars
      for (let i = 0; i < barCount; i++) {
        const barHeight = Math.max(4, barsRef.current[i] * maxBarHeight);
        const x = i * (barWidth + 2) + 1;
        const y = (height - barHeight) / 2;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioData, isActive, barCount, color]);

  return (
    <canvas
      ref={canvasRef}
      width={barCount * 6}
      height={32}
      className={cn("", className)}
    />
  );
};
