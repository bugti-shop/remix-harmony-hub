import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

interface ClockTimePickerProps {
  hour: string;
  minute: string;
  period: 'AM' | 'PM';
  onHourChange: (hour: string) => void;
  onMinuteChange: (minute: string) => void;
  onPeriodChange: (period: 'AM' | 'PM') => void;
  onConfirm?: () => void;
  showConfirmButton?: boolean;
}

type Mode = 'hour' | 'minute';

const triggerHaptic = async () => {
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (error) {
    // Haptics not available (web browser)
  }
};

export const ClockTimePicker = ({
  hour,
  minute,
  period,
  onHourChange,
  onMinuteChange,
  onPeriodChange,
  onConfirm,
  showConfirmButton = true,
}: ClockTimePickerProps) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('hour');
  const [isDragging, setIsDragging] = useState(false);
  const clockRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef<number>(-1);

  const hours = Array.from({ length: 12 }, (_, i) => i === 0 ? 12 : i);
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const getPosition = (value: number, total: number) => {
    const angle = ((value * 360) / total - 90) * (Math.PI / 180);
    return {
      x: Math.cos(angle) * 50,
      y: Math.sin(angle) * 50,
    };
  };

  const calculateValue = useCallback((clientX: number, clientY: number) => {
    if (!clockRef.current) return null;

    const rect = clockRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const x = clientX - centerX;
    const y = clientY - centerY;

    // Calculate angle from 12 o'clock position (top)
    let angle = Math.atan2(x, -y) * (180 / Math.PI);
    if (angle < 0) angle += 360;

    if (mode === 'hour') {
      const hourValue = Math.round(angle / 30) % 12;
      return hourValue === 0 ? 12 : hourValue;
    } else {
      // Snap to nearest 5-minute interval for better UX, or allow any minute
      const rawMinute = Math.round(angle / 6) % 60;
      return rawMinute;
    }
  }, [mode]);

  const updateValue = useCallback((value: number) => {
    if (value === lastValueRef.current) return;
    
    lastValueRef.current = value;
    triggerHaptic();

    if (mode === 'hour') {
      onHourChange(value.toString());
    } else {
      onMinuteChange(value.toString().padStart(2, '0'));
    }
  }, [mode, onHourChange, onMinuteChange]);

  const handleStart = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true);
    const value = calculateValue(clientX, clientY);
    if (value !== null) {
      updateValue(value);
    }
  }, [calculateValue, updateValue]);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;
    const value = calculateValue(clientX, clientY);
    if (value !== null) {
      updateValue(value);
    }
  }, [isDragging, calculateValue, updateValue]);

  const handleEnd = useCallback(() => {
    setIsDragging(false);
    lastValueRef.current = -1;
  }, []);

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    handleMove(e.clientX, e.clientY);
  }, [handleMove]);

  const handleMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  };

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  }, [handleMove]);

  const handleTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // Add/remove global event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  const currentValue = mode === 'hour' ? parseInt(hour) : parseInt(minute);
  // Hand starts pointing UP after translate, so no need to subtract 90
  const handAngle = mode === 'hour' 
    ? (currentValue % 12) * 30 
    : currentValue * 6;

  const handleModeSwitch = (newMode: Mode) => {
    setMode(newMode);
    triggerHaptic();
  };

  const handlePeriodSwitch = (newPeriod: 'AM' | 'PM') => {
    onPeriodChange(newPeriod);
    triggerHaptic();
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xs mx-auto">
      {/* Time Display */}
      <div className="flex items-center justify-center">
        <button
          onClick={() => handleModeSwitch('hour')}
          className={cn(
            "text-5xl font-medium transition-colors",
            mode === 'hour' ? "text-primary" : "text-muted-foreground"
          )}
        >
          {hour.padStart(2, '0')}
        </button>
        <span className="text-5xl font-medium text-muted-foreground mx-1">:</span>
        <button
          onClick={() => handleModeSwitch('minute')}
          className={cn(
            "text-5xl font-medium transition-colors",
            mode === 'minute' ? "text-primary" : "text-muted-foreground"
          )}
        >
          {minute.padStart(2, '0')}
        </button>
        <div className="flex flex-col ml-3 gap-0.5">
          <button
            onClick={() => handlePeriodSwitch('AM')}
            className={cn(
              "text-sm font-semibold px-1.5 py-0.5 rounded transition-colors",
              period === 'AM' ? "text-primary" : "text-muted-foreground"
            )}
          >
            AM
          </button>
          <button
            onClick={() => handlePeriodSwitch('PM')}
            className={cn(
              "text-sm font-semibold px-1.5 py-0.5 rounded transition-colors",
              period === 'PM' ? "text-primary" : "text-muted-foreground"
            )}
          >
            PM
          </button>
        </div>
      </div>

      {/* Clock Face */}
      <div
        ref={clockRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className="relative w-full aspect-square max-w-[280px] rounded-full bg-muted/50 cursor-pointer select-none"
        style={{ touchAction: 'none' }}
      >
        {/* Inner circle background */}
        <div className="absolute inset-[12%] rounded-full bg-muted/30" />
        
        {/* Clock Center Dot */}
        <div className="absolute top-1/2 left-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary z-20" />

        {/* Clock Hand */}
        <div
          className={cn(
            "absolute top-1/2 left-1/2 origin-center z-10",
            isDragging ? "transition-none" : "transition-transform duration-200 ease-out"
          )}
          style={{
            width: '2px',
            height: '40%',
            backgroundColor: 'hsl(var(--primary))',
            transform: `translate(-50%, -100%) rotate(${handAngle}deg)`,
            transformOrigin: 'bottom center',
          }}
        >
          {/* Hand tip circle */}
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-primary" />
        </div>

        {/* Hour Numbers or Minute Numbers */}
        {mode === 'hour' ? (
          hours.map((h, index) => {
            const pos = getPosition(index === 0 ? 12 : index, 12);
            const isSelected = parseInt(hour) === h || (parseInt(hour) === 0 && h === 12);
            return (
              <button
                key={h}
                onClick={(e) => {
                  e.stopPropagation();
                  onHourChange(h.toString());
                  triggerHaptic();
                }}
                className={cn(
                  "absolute w-10 h-10 flex items-center justify-center rounded-full text-base font-medium transition-all z-30",
                  isSelected ? "text-primary-foreground" : "text-foreground hover:bg-accent/50"
                )}
                style={{
                  left: `calc(50% + ${pos.x}% - 20px)`,
                  top: `calc(50% + ${pos.y}% - 20px)`,
                }}
              >
                {h}
              </button>
            );
          })
        ) : (
          minutes.map((m) => {
            const pos = getPosition(m, 60);
            const isSelected = parseInt(minute) === m;
            return (
              <button
                key={m}
                onClick={(e) => {
                  e.stopPropagation();
                  onMinuteChange(m.toString().padStart(2, '0'));
                  triggerHaptic();
                }}
                className={cn(
                  "absolute w-10 h-10 flex items-center justify-center rounded-full text-base font-medium transition-all z-30",
                  isSelected ? "text-primary-foreground" : "text-foreground hover:bg-accent/50"
                )}
                style={{
                  left: `calc(50% + ${pos.x}% - 20px)`,
                  top: `calc(50% + ${pos.y}% - 20px)`,
                }}
              >
                {m.toString().padStart(2, '0')}
              </button>
            );
          })
        )}
      </div>

      {/* Mode Indicator */}
      <p className="text-xs text-muted-foreground">
        {mode === 'hour' ? t('dateTime.selectHour') : t('dateTime.selectMinutes')}
      </p>

      {/* Confirm Button */}
      {showConfirmButton && onConfirm && (
        <Button 
          onClick={() => {
            triggerHaptic();
            onConfirm();
          }}
          className="w-full max-w-[200px] gap-2"
        >
          <Check className="w-4 h-4" />
          {t('dateTime.confirmTime')}
        </Button>
      )}
    </div>
  );
};
