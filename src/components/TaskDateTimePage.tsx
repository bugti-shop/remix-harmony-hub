import { useState, useEffect } from 'react';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, addDays, startOfWeek, addWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight, X, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClockTimePicker } from '@/components/ClockTimePicker';

export type RepeatFrequency = 'hour' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type RepeatEndsType = 'never' | 'on_date' | 'after_occurrences';

export interface RepeatSettings {
  frequency: RepeatFrequency;
  interval: number;
  endsType: RepeatEndsType;
  endsOnDate?: Date;
  endsAfterOccurrences?: number;
  weeklyDays?: number[]; // 0-6 for Sun-Sat
  monthlyDay?: number; // 1-30
}

interface TaskDateTimePageProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    selectedDate?: Date;
    selectedTime?: { hour: number; minute: number; period: 'AM' | 'PM' };
    reminder?: string;
    repeatSettings?: RepeatSettings;
  }) => void;
  initialDate?: Date;
  initialTime?: { hour: number; minute: number; period: 'AM' | 'PM' };
  initialReminder?: string;
  initialRepeatSettings?: RepeatSettings;
  hideRepeat?: boolean;
}

export const TaskDateTimePage = ({
  isOpen,
  onClose,
  onSave,
  initialDate,
  initialTime,
  initialReminder,
  initialRepeatSettings,
  hideRepeat = false,
}: TaskDateTimePageProps) => {
  const { t } = useTranslation();
  const today = new Date();
  const [currentMonthOffset, setCurrentMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate);
  
  // Time state
  const [selectedHour, setSelectedHour] = useState<string>(initialTime?.hour?.toString() || '12');
  const [selectedMinute, setSelectedMinute] = useState<string>(initialTime?.minute?.toString().padStart(2, '0') || '00');
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>(initialTime?.period || 'AM');
  
  // Reminder state
  // Default reminder to 'instant' (at exact time) when no initial value or empty string
  const [reminder, setReminder] = useState<string>(() => {
    if (!initialReminder || initialReminder === '' || initialReminder === 'none' || initialReminder === 'exact') {
      return 'instant';
    }
    return initialReminder;
  });
  
  // Repeat state
  const [repeatFrequency, setRepeatFrequency] = useState<RepeatFrequency | null>(
    initialRepeatSettings?.frequency || null
  );
  const [repeatInterval, setRepeatInterval] = useState<string>(
    initialRepeatSettings?.interval?.toString() || '1'
  );
  const [repeatEndsType, setRepeatEndsType] = useState<RepeatEndsType>(
    initialRepeatSettings?.endsType || 'never'
  );
  const [repeatEndsDate, setRepeatEndsDate] = useState<Date | undefined>(
    initialRepeatSettings?.endsOnDate
  );
  const [repeatEndsOccurrences, setRepeatEndsOccurrences] = useState<string>(
    initialRepeatSettings?.endsAfterOccurrences?.toString() || '5'
  );
  const [weeklyDays, setWeeklyDays] = useState<number[]>(
    initialRepeatSettings?.weeklyDays || []
  );
  const [monthlyDay, setMonthlyDay] = useState<string>(
    initialRepeatSettings?.monthlyDay?.toString() || '1'
  );

  // Hardware back button support - use 'sheet' priority to close sheet before navigation
  useHardwareBackButton({
    onBack: onClose,
    enabled: isOpen,
    priority: 'sheet',
  });

  useEffect(() => {
    if (isOpen) {
      setSelectedDate(initialDate);
      setSelectedHour(initialTime?.hour?.toString() || '12');
      setSelectedMinute(initialTime?.minute?.toString().padStart(2, '0') || '00');
      setSelectedPeriod(initialTime?.period || 'AM');
      // Normalize reminder to 'instant' for empty/none/exact values
      const normalizedReminder = (!initialReminder || initialReminder === '' || initialReminder === 'none' || initialReminder === 'exact') 
        ? 'instant' 
        : initialReminder;
      setReminder(normalizedReminder);
      setRepeatFrequency(initialRepeatSettings?.frequency || null);
      setRepeatInterval(initialRepeatSettings?.interval?.toString() || '1');
      setRepeatEndsType(initialRepeatSettings?.endsType || 'never');
      setRepeatEndsDate(initialRepeatSettings?.endsOnDate);
      setRepeatEndsOccurrences(initialRepeatSettings?.endsAfterOccurrences?.toString() || '5');
      setWeeklyDays(initialRepeatSettings?.weeklyDays || []);
      setMonthlyDay(initialRepeatSettings?.monthlyDay?.toString() || '1');
    }
  }, [isOpen, initialDate, initialTime, initialReminder, initialRepeatSettings]);

  // Calendar calculations
  const startingMonth = startOfMonth(today);
  const displayMonth = addMonths(startingMonth, currentMonthOffset);
  const monthStart = startOfMonth(displayMonth);
  const monthEnd = endOfMonth(displayMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart);
  const weekDays = [t('dateTime.weekDays.sun'), t('dateTime.weekDays.mon'), t('dateTime.weekDays.tue'), t('dateTime.weekDays.wed'), t('dateTime.weekDays.thu'), t('dateTime.weekDays.fri'), t('dateTime.weekDays.sat')];

  const handlePrevMonth = () => setCurrentMonthOffset(prev => prev - 1);
  const handleNextMonth = () => setCurrentMonthOffset(prev => prev + 1);

  const handleSave = () => {
    const repeatSettings: RepeatSettings | undefined = repeatFrequency ? {
      frequency: repeatFrequency,
      interval: parseInt(repeatInterval) || 1,
      endsType: repeatEndsType,
      endsOnDate: repeatEndsType === 'on_date' ? repeatEndsDate : undefined,
      endsAfterOccurrences: repeatEndsType === 'after_occurrences' ? parseInt(repeatEndsOccurrences) : undefined,
      weeklyDays: repeatFrequency === 'weekly' ? weeklyDays : undefined,
      monthlyDay: repeatFrequency === 'monthly' ? parseInt(monthlyDay) : undefined,
    } : undefined;

    onSave({
      selectedDate,
      selectedTime: {
        hour: parseInt(selectedHour),
        minute: parseInt(selectedMinute),
        period: selectedPeriod,
      },
      // Convert 'no_reminder' back to empty/undefined for compatibility
      reminder: reminder === 'no_reminder' ? undefined : reminder,
      repeatSettings,
    });
  };

  const toggleWeeklyDay = (day: number) => {
    setWeeklyDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const reminderOptions = [
    { value: 'instant', label: t('dateTime.reminderOptions.instant') },
    { value: 'no_reminder', label: t('dateTime.reminderOptions.noReminder') },
    { value: '5min', label: t('dateTime.reminderOptions.5min') },
    { value: '10min', label: t('dateTime.reminderOptions.10min') },
    { value: '15min', label: t('dateTime.reminderOptions.15min') },
    { value: '30min', label: t('dateTime.reminderOptions.30min') },
    { value: '1hour', label: t('dateTime.reminderOptions.1hour') },
    { value: '2hours', label: t('dateTime.reminderOptions.2hours') },
    { value: 'morning', label: t('dateTime.reminderOptions.morning') },
    { value: 'evening_before', label: t('dateTime.reminderOptions.eveningBefore') },
    { value: '1day_9am', label: t('dateTime.reminderOptions.1day9am') },
    { value: '1day', label: t('dateTime.reminderOptions.1day') },
    { value: '2days', label: t('dateTime.reminderOptions.2days') },
    { value: '1week', label: t('dateTime.reminderOptions.1week') },
  ];

  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  if (!isOpen) return null;

  return (
    <div 
      className={cn(
        "fixed inset-0 bg-background z-[100] flex flex-col transition-transform duration-300",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-5 w-5 mr-1" />
          {t('dateTime.cancel')}
        </Button>
        <h2 className="text-lg font-semibold">{t('dateTime.title')}</h2>
        <Button variant="default" size="default" onClick={handleSave} className="min-w-[90px] min-h-[44px] z-50">
          <Check className="h-5 w-5 mr-1" />
          {t('dateTime.save')}
        </Button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Quick Date Buttons */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedDate(today)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                selectedDate && isSameDay(selectedDate, today)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {t('dateTime.today')}
            </button>
            <button
              onClick={() => setSelectedDate(addDays(today, 1))}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                selectedDate && isSameDay(selectedDate, addDays(today, 1))
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {t('dateTime.tomorrow')}
            </button>
            <button
              onClick={() => setSelectedDate(startOfWeek(addWeeks(today, 1), { weekStartsOn: 6 }))}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                selectedDate && isSameDay(selectedDate, startOfWeek(addWeeks(today, 1), { weekStartsOn: 6 }))
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {t('dateTime.thisWeekend')}
            </button>
            <button
              onClick={() => setSelectedDate(addWeeks(today, 1))}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                selectedDate && isSameDay(selectedDate, addWeeks(today, 1))
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {t('dateTime.nextWeek')}
            </button>
          </div>
        </div>

        {/* Calendar Section */}
        <div className="px-6 pb-6 bg-card">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-accent rounded-full transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-foreground" />
            </button>
            <h3 className="text-base font-normal text-foreground text-center">
              {format(displayMonth, 'MMMM yyyy')}
            </h3>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-accent rounded-full transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-foreground" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-3">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-normal text-muted-foreground h-8 flex items-center justify-center"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: startPadding }).map((_, index) => (
              <div key={`empty-${index}`} className="aspect-square" />
            ))}

            {daysInMonth.map((day) => {
              const isToday = isSameDay(day, today);
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <button
                  key={day.toString()}
                  onClick={() => setSelectedDate(day)}
                  style={isSelected ? { backgroundColor: '#a3dbf6' } : {}}
                  className={cn(
                    "aspect-square w-full flex items-center justify-center rounded-lg text-xs font-normal transition-all focus:outline-none cursor-pointer",
                    isSelected ? "text-foreground" : "text-foreground hover:bg-muted",
                    isToday && !isSelected ? "ring-2 ring-primary" : ""
                  )}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Section */}
        <div className="px-6 py-6 border-t border-border">
          <h4 className="text-sm font-medium mb-4">{t('dateTime.time')}</h4>
          <ClockTimePicker
            hour={selectedHour}
            minute={selectedMinute}
            period={selectedPeriod}
            onHourChange={setSelectedHour}
            onMinuteChange={setSelectedMinute}
            onPeriodChange={setSelectedPeriod}
          />
        </div>

        {/* Reminder Section */}
        <div className="px-6 py-4 border-t border-border">
          <h4 className="text-sm font-medium mb-3">{t('dateTime.reminder')}</h4>
          <Select value={reminder} onValueChange={setReminder}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {reminderOptions.find(o => o.value === reminder)?.label || t('dateTime.reminderOptions.instant')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-popover z-[9999]" position="popper" sideOffset={4}>
              {reminderOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Repeat Section - only show if hideRepeat is false */}
        {!hideRepeat && (
          <div className="px-6 py-4 border-t border-border">
            <h4 className="text-sm font-medium mb-4">{t('dateTime.setRepeatTask')}</h4>
            
            {/* Frequency Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {(['hour', 'daily', 'weekly', 'monthly', 'yearly'] as RepeatFrequency[]).map((freq) => (
                <button
                  key={freq}
                  onClick={() => setRepeatFrequency(repeatFrequency === freq ? null : freq)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                    repeatFrequency === freq
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {t(`dateTime.frequency.${freq}`)}
                </button>
              ))}
            </div>

            {/* Repeat Options */}
            {repeatFrequency && (
              <div className="space-y-4 animate-in slide-in-from-top-2">
                {/* Repeat Every */}
                <div className="flex items-center justify-between">
                  <span className="text-sm">{t('dateTime.repeatEvery')}</span>
                  <Select value={repeatInterval} onValueChange={setRepeatInterval}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover max-h-60">
                      {repeatFrequency === 'hour' && (
                        Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n > 1 ? t('dateTime.units.hours', { count: n }) : t('dateTime.units.hour', { count: n })}
                          </SelectItem>
                        ))
                      )}
                      {repeatFrequency === 'daily' && (
                        Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n > 1 ? t('dateTime.units.days', { count: n }) : t('dateTime.units.day', { count: n })}
                          </SelectItem>
                        ))
                      )}
                      {repeatFrequency === 'weekly' && (
                        Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n > 1 ? t('dateTime.units.weeks', { count: n }) : t('dateTime.units.week', { count: n })}
                          </SelectItem>
                        ))
                      )}
                      {repeatFrequency === 'monthly' && (
                        Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n > 1 ? t('dateTime.units.months', { count: n }) : t('dateTime.units.month', { count: n })}
                          </SelectItem>
                        ))
                      )}
                      {repeatFrequency === 'yearly' && (
                        Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n > 1 ? t('dateTime.units.years', { count: n }) : t('dateTime.units.year', { count: n })}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Weekly: Repeat On Days */}
                {repeatFrequency === 'weekly' && (
                  <div className="space-y-2">
                    <span className="text-sm">{t('dateTime.repeatOn')}</span>
                    <div className="flex gap-2 flex-wrap">
                      {[t('dateTime.weekDays.sun'), t('dateTime.weekDays.mon'), t('dateTime.weekDays.tue'), t('dateTime.weekDays.wed'), t('dateTime.weekDays.thu'), t('dateTime.weekDays.fri'), t('dateTime.weekDays.sat')].map((day, index) => (
                        <button
                          key={day}
                          onClick={() => toggleWeeklyDay(index)}
                          className={cn(
                            "w-10 h-10 rounded-full text-xs font-medium transition-colors",
                            weeklyDays.includes(index)
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          )}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Monthly: Repeat On Day */}
                {repeatFrequency === 'monthly' && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{t('dateTime.repeatOn')}</span>
                    <Select value={monthlyDay} onValueChange={setMonthlyDay}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover max-h-60">
                        {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {t('dateTime.dayN', { count: n })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Repeat Ends At */}
                <div className="space-y-3">
                  <span className="text-sm">{t('dateTime.repeatEndsAt')}</span>
                  <Select value={repeatEndsType} onValueChange={(v) => setRepeatEndsType(v as RepeatEndsType)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="never">{t('dateTime.never')}</SelectItem>
                      <SelectItem value="on_date">{t('dateTime.onSpecificDate')}</SelectItem>
                      <SelectItem value="after_occurrences">{t('dateTime.afterXOccurrences')}</SelectItem>
                    </SelectContent>
                  </Select>

                  {repeatEndsType === 'after_occurrences' && (
                    <Select value={repeatEndsOccurrences} onValueChange={setRepeatEndsOccurrences}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover max-h-60">
                        {[5, 10, 15, 20, 25, 30, 50, 100].map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {t('dateTime.afterNTimes', { count: n })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {repeatEndsType === 'on_date' && (
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="flex items-center justify-between mb-4">
                        <button onClick={() => {}} className="p-1">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-medium">
                          {repeatEndsDate ? format(repeatEndsDate, 'MMMM yyyy') : format(today, 'MMMM yyyy')}
                        </span>
                        <button onClick={() => {}} className="p-1">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                          <div key={i} className="text-center text-xs text-muted-foreground py-1">{d}</div>
                        ))}
                        {Array.from({ length: 35 }, (_, i) => {
                          const day = i - getDay(startOfMonth(repeatEndsDate || today)) + 1;
                          const daysInCurrentMonth = endOfMonth(repeatEndsDate || today).getDate();
                          if (day < 1 || day > daysInCurrentMonth) {
                            return <div key={i} className="aspect-square" />;
                          }
                          const date = new Date((repeatEndsDate || today).getFullYear(), (repeatEndsDate || today).getMonth(), day);
                          const isSelected = repeatEndsDate && isSameDay(date, repeatEndsDate);
                          return (
                            <button
                              key={i}
                              onClick={() => setRepeatEndsDate(date)}
                              className={cn(
                                "aspect-square flex items-center justify-center rounded text-xs",
                                isSelected ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                              )}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Safe area padding */}
      <div style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }} />
    </div>
  );
};
