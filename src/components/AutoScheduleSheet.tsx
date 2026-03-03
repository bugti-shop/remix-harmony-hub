import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Calendar, Clock, ChevronRight, 
  Flag, AlertTriangle, Check, Hourglass, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { TodoItem } from '@/types/note';
import { 
  autoScheduleTasks, 
  applySchedule, 
  getUndatedTasks, 
  ScheduleConfig, 
  DEFAULT_SCHEDULE_CONFIG,
  ScheduleDay
} from '@/utils/autoScheduler';
import { usePriorities } from '@/hooks/usePriorities';

interface AutoScheduleSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: TodoItem[];
  onApply: (updatedTasks: TodoItem[]) => void;
}

export const AutoScheduleSheet = ({ isOpen, onClose, tasks, onApply }: AutoScheduleSheetProps) => {
  const { getPriorityColor } = usePriorities();
  const [config, setConfig] = useState<ScheduleConfig>({ ...DEFAULT_SCHEDULE_CONFIG, startDate: new Date() });
  const [showPreview, setShowPreview] = useState(false);

  const undatedCount = useMemo(() => getUndatedTasks(tasks).length, [tasks]);

  const { schedule, unscheduled } = useMemo(() => {
    if (!showPreview) return { schedule: [], unscheduled: [] };
    return autoScheduleTasks(tasks, { ...config, startDate: new Date() });
  }, [tasks, config, showPreview]);

  const scheduledCount = schedule.reduce((sum, d) => sum + d.tasks.length, 0);

  const handleApply = () => {
    const updatedTasks = applySchedule(tasks, schedule);
    onApply(updatedTasks);
    onClose();
  };

  const handleGenerate = () => {
    setConfig(prev => ({ ...prev, startDate: new Date() }));
    setShowPreview(true);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-hidden rounded-t-2xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Smart Auto-Schedule
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 pt-2 pb-6">
            {/* Status */}
            <div className="bg-muted/50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {undatedCount} undated task{undatedCount !== 1 ? 's' : ''} found
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tasks without due dates will be distributed across upcoming days
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
              </div>
            </div>

            {/* Config */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm">Max hours per day</Label>
                  <span className="text-sm font-medium text-primary">{config.maxHoursPerDay}h</span>
                </div>
                <Slider
                  value={[config.maxHoursPerDay]}
                  onValueChange={([v]) => { setConfig(prev => ({ ...prev, maxHoursPerDay: v })); setShowPreview(false); }}
                  min={2}
                  max={12}
                  step={1}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm">Days ahead</Label>
                  <span className="text-sm font-medium text-primary">{config.daysAhead} days</span>
                </div>
                <Slider
                  value={[config.daysAhead]}
                  onValueChange={([v]) => { setConfig(prev => ({ ...prev, daysAhead: v })); setShowPreview(false); }}
                  min={3}
                  max={30}
                  step={1}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm">Default estimate (no estimate set)</Label>
                  <span className="text-sm font-medium text-primary">{config.defaultEstimateHours}h</span>
                </div>
                <Slider
                  value={[config.defaultEstimateHours]}
                  onValueChange={([v]) => { setConfig(prev => ({ ...prev, defaultEstimateHours: v })); setShowPreview(false); }}
                  min={0.5}
                  max={4}
                  step={0.5}
                  className="w-full"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">Skip weekends</Label>
                <Switch
                  checked={config.skipWeekends}
                  onCheckedChange={(v) => { setConfig(prev => ({ ...prev, skipWeekends: v })); setShowPreview(false); }}
                />
              </div>
            </div>

            {/* Generate / Preview */}
            {!showPreview ? (
              <Button 
                onClick={handleGenerate} 
                disabled={undatedCount === 0} 
                className="w-full gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Generate Schedule
              </Button>
            ) : (
              <>
                {/* Schedule Preview */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Preview</h3>
                    <Badge variant="secondary" className="text-xs">
                      {scheduledCount} task{scheduledCount !== 1 ? 's' : ''} scheduled
                    </Badge>
                  </div>

                  <AnimatePresence mode="popLayout">
                    {schedule.filter(d => d.tasks.length > 0).map((day, i) => (
                      <ScheduleDayCard 
                        key={day.dateStr} 
                        day={day} 
                        index={i} 
                        maxHours={config.maxHoursPerDay}
                        getPriorityColor={getPriorityColor}
                      />
                    ))}
                  </AnimatePresence>

                  {unscheduled.length > 0 && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span className="text-xs font-medium text-destructive">
                          {unscheduled.length} task{unscheduled.length !== 1 ? 's' : ''} couldn't fit
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Increase days ahead or max hours per day to fit remaining tasks.
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowPreview(false)} className="flex-1">
                    Reconfigure
                  </Button>
                  <Button onClick={handleApply} disabled={scheduledCount === 0} className="flex-1 gap-2">
                    <Check className="h-4 w-4" />
                    Apply ({scheduledCount})
                  </Button>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

const ScheduleDayCard = ({ 
  day, 
  index, 
  maxHours,
  getPriorityColor 
}: { 
  day: ScheduleDay; 
  index: number; 
  maxHours: number;
  getPriorityColor: (p: string) => string;
}) => {
  const loadPercent = Math.min(100, (day.totalHours / maxHours) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-xl border border-border bg-card p-3"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {format(day.date, 'EEE, MMM d')}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {day.totalHours.toFixed(1)}h / {maxHours}h
          </span>
        </div>
      </div>

      {/* Load bar */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-2.5">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            loadPercent > 90 ? "bg-destructive" : loadPercent > 70 ? "bg-warning" : "bg-primary"
          )}
          style={{ width: `${loadPercent}%` }}
        />
      </div>

      {/* Tasks */}
      <div className="space-y-1.5">
        {day.tasks.map(({ task, estimatedHours }) => (
          <div key={task.id} className="flex items-center gap-2 text-xs">
            {task.priority && task.priority !== 'none' && (
              <Flag className="h-3 w-3 flex-shrink-0" style={{ color: getPriorityColor(task.priority) }} />
            )}
            <span className="flex-1 truncate text-foreground">{task.text}</span>
            <span className="flex items-center gap-0.5 text-muted-foreground flex-shrink-0">
              <Hourglass className="h-2.5 w-2.5" />
              {estimatedHours}h
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
