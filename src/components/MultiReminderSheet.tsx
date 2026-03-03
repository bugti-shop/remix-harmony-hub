import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Clock, Calendar } from 'lucide-react';
import { MultiReminder, ReminderIntervalType } from '@/types/note';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { cn } from '@/lib/utils';

interface MultiReminderSheetProps {
  isOpen: boolean;
  onClose: () => void;
  multiReminder?: MultiReminder;
  onSave: (reminder: MultiReminder | undefined) => void;
}

const INTERVAL_OPTIONS: { value: ReminderIntervalType; label: string }[] = [
  { value: '30min', label: 'Every 30 minutes' },
  { value: '1hour', label: 'Every 1 hour' },
  { value: '2hours', label: 'Every 2 hours' },
  { value: '4hours', label: 'Every 4 hours' },
  { value: 'custom', label: 'Custom interval' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

export const MultiReminderSheet = ({
  isOpen,
  onClose,
  multiReminder,
  onSave,
}: MultiReminderSheetProps) => {
  const [enabled, setEnabled] = useState(multiReminder?.enabled ?? false);
  const [intervalType, setIntervalType] = useState<ReminderIntervalType>(multiReminder?.intervalType ?? '1hour');
  const [customInterval, setCustomInterval] = useState(multiReminder?.customIntervalMinutes ?? 60);
  const [activeHoursStart, setActiveHoursStart] = useState(multiReminder?.activeHoursStart ?? '06:00');
  const [activeHoursEnd, setActiveHoursEnd] = useState(multiReminder?.activeHoursEnd ?? '17:00');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(multiReminder?.daysOfWeek ?? []);

  useHardwareBackButton({ onBack: onClose, enabled: isOpen, priority: 'sheet' });

  useEffect(() => {
    if (multiReminder) {
      setEnabled(multiReminder.enabled);
      setIntervalType(multiReminder.intervalType);
      setCustomInterval(multiReminder.customIntervalMinutes ?? 60);
      setActiveHoursStart(multiReminder.activeHoursStart ?? '06:00');
      setActiveHoursEnd(multiReminder.activeHoursEnd ?? '17:00');
      setDaysOfWeek(multiReminder.daysOfWeek ?? []);
    } else {
      setEnabled(false);
      setIntervalType('1hour');
      setCustomInterval(60);
      setActiveHoursStart('06:00');
      setActiveHoursEnd('17:00');
      setDaysOfWeek([]);
    }
  }, [multiReminder, isOpen]);

  const toggleDay = (day: number) => {
    setDaysOfWeek(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSave = () => {
    if (!enabled) {
      onSave(undefined);
    } else {
      onSave({
        enabled,
        intervalType,
        customIntervalMinutes: intervalType === 'custom' ? customInterval : undefined,
        activeHoursStart,
        activeHoursEnd,
        daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : undefined,
      });
    }
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Recurring Reminders
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enabled" className="text-base font-medium">Enable Multiple Reminders</Label>
              <p className="text-sm text-muted-foreground">Get reminded multiple times a day</p>
            </div>
            <Switch id="enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {enabled && (
            <>
              {/* Interval selection */}
              <div className="space-y-2">
                <Label className="text-base font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Reminder Interval
                </Label>
                <Select value={intervalType} onValueChange={(v) => setIntervalType(v as ReminderIntervalType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    {INTERVAL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {intervalType === 'custom' && (
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      type="number"
                      value={customInterval}
                      onChange={(e) => setCustomInterval(Math.max(5, parseInt(e.target.value) || 60))}
                      className="w-24"
                      min={5}
                    />
                    <span className="text-sm text-muted-foreground">minutes</span>
                  </div>
                )}
              </div>

              {/* Active hours */}
              <div className="space-y-2">
                <Label className="text-base font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Active Hours
                </Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Only send reminders during these hours
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={activeHoursStart}
                    onChange={(e) => setActiveHoursStart(e.target.value)}
                    className="flex-1"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="time"
                    value={activeHoursEnd}
                    onChange={(e) => setActiveHoursEnd(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Days of week */}
              <div className="space-y-2">
                <Label className="text-base font-medium">Active Days</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Leave empty for all days
                </p>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day.value}
                      onClick={() => toggleDay(day.value)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        daysOfWeek.includes(day.value)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Preview</h4>
                <p className="text-sm text-muted-foreground">
                  You'll receive reminders every{' '}
                  <span className="font-medium text-foreground">
                    {intervalType === 'custom' 
                      ? `${customInterval} minutes`
                      : intervalType === '30min' 
                        ? '30 minutes'
                        : intervalType === '1hour'
                          ? 'hour'
                          : intervalType === '2hours'
                            ? '2 hours'
                            : '4 hours'
                    }
                  </span>
                  {' '}between{' '}
                  <span className="font-medium text-foreground">{activeHoursStart}</span>
                  {' '}and{' '}
                  <span className="font-medium text-foreground">{activeHoursEnd}</span>
                  {daysOfWeek.length > 0 && (
                    <>
                      {' '}on{' '}
                      <span className="font-medium text-foreground">
                        {daysOfWeek.sort().map(d => DAYS_OF_WEEK.find(day => day.value === d)?.label).join(', ')}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </>
          )}

          <Button onClick={handleSave} className="w-full">
            Save Reminder Settings
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
