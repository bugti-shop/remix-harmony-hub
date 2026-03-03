import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw, Clock } from 'lucide-react';
import { TimeTracking } from '@/types/note';
import { cn } from '@/lib/utils';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface TaskTimeTrackerProps {
  timeTracking?: TimeTracking;
  onUpdate: (tracking: TimeTracking) => void;
  compact?: boolean;
}

export const TaskTimeTracker = ({ timeTracking, onUpdate, compact = false }: TaskTimeTrackerProps) => {
  const { requireFeature } = useSubscription();
  const { t } = useTranslation();
  const [displayTime, setDisplayTime] = useState(timeTracking?.totalSeconds || 0);
  const [isRunning, setIsRunning] = useState(timeTracking?.isRunning || false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  useEffect(() => {
    if (timeTracking) {
      setDisplayTime(timeTracking.totalSeconds || 0);
      setIsRunning(timeTracking.isRunning || false);
      
      // If timer was running, calculate elapsed time since last started
      if (timeTracking.isRunning && timeTracking.lastStarted) {
        const lastStarted = new Date(timeTracking.lastStarted);
        const elapsed = Math.floor((Date.now() - lastStarted.getTime()) / 1000);
        setDisplayTime((timeTracking.totalSeconds || 0) + elapsed);
        startTimeRef.current = lastStarted;
      }
    }
  }, [timeTracking]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setDisplayTime(prev => prev + 1);
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    if (!requireFeature('time_tracking')) return;
    const now = new Date();
    startTimeRef.current = now;
    setIsRunning(true);
    
    onUpdate({
      totalSeconds: displayTime,
      isRunning: true,
      lastStarted: now,
      sessions: timeTracking?.sessions || [],
    });
  };

  const handlePause = () => {
    if (!requireFeature('time_tracking')) return;
    setIsRunning(false);
    
    const sessions = [...(timeTracking?.sessions || [])];
    if (startTimeRef.current) {
      const end = new Date();
      const duration = Math.floor((end.getTime() - startTimeRef.current.getTime()) / 1000);
      sessions.push({
        start: startTimeRef.current,
        end,
        duration,
      });
    }
    
    onUpdate({
      totalSeconds: displayTime,
      isRunning: false,
      lastStarted: undefined,
      sessions,
    });
    
    startTimeRef.current = null;
  };

  const handleReset = () => {
    if (!requireFeature('time_tracking')) return;
    setDisplayTime(0);
    setIsRunning(false);
    startTimeRef.current = null;
    
    onUpdate({
      totalSeconds: 0,
      isRunning: false,
      lastStarted: undefined,
      sessions: [],
    });
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={isRunning ? handlePause : handleStart}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {isRunning ? (
            <Pause className="h-3.5 w-3.5 text-amber-500" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          <span className={cn("font-mono", isRunning && "text-amber-500")}>
            {formatTime(displayTime)}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
      <Clock className="h-5 w-5 text-muted-foreground" />
      <div className="flex-1">
        <span className={cn(
          "font-mono text-lg",
          isRunning && "text-amber-500"
        )}>
          {formatTime(displayTime)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {isRunning ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handlePause}
            className="h-8"
          >
            <Pause className="h-4 w-4 mr-1" />
            Pause
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleStart}
            className="h-8"
          >
            <Play className="h-4 w-4 mr-1" />
            Start
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleReset}
          className="h-8 w-8"
          title={t('common.reset')}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
