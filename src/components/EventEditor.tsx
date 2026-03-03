import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarEvent, EventRepeatType, EventReminderType } from '@/types/note';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowLeft, Calendar as CalendarIcon, Clock, MapPin, Repeat, Bell, Globe, Save } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EventEditorProps {
  event?: CalendarEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  defaultDate?: Date;
}

const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (ET) - New York' },
  { value: 'America/Chicago', label: 'Central Time (CT) - Chicago' },
  { value: 'America/Denver', label: 'Mountain Time (MT) - Denver' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT) - Los Angeles' },
  { value: 'America/Anchorage', label: 'Alaska Time - Anchorage' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time - Honolulu' },
  { value: 'America/Toronto', label: 'Eastern Time - Toronto' },
  { value: 'America/Vancouver', label: 'Pacific Time - Vancouver' },
  { value: 'America/Mexico_City', label: 'Central Time - Mexico City' },
  { value: 'America/Sao_Paulo', label: 'Brasília Time - São Paulo' },
  { value: 'America/Buenos_Aires', label: 'Argentina Time - Buenos Aires' },
  { value: 'Europe/London', label: 'GMT - London' },
  { value: 'Europe/Paris', label: 'CET - Paris' },
  { value: 'Europe/Berlin', label: 'CET - Berlin' },
  { value: 'Europe/Rome', label: 'CET - Rome' },
  { value: 'Europe/Madrid', label: 'CET - Madrid' },
  { value: 'Europe/Amsterdam', label: 'CET - Amsterdam' },
  { value: 'Europe/Brussels', label: 'CET - Brussels' },
  { value: 'Europe/Vienna', label: 'CET - Vienna' },
  { value: 'Europe/Warsaw', label: 'CET - Warsaw' },
  { value: 'Europe/Stockholm', label: 'CET - Stockholm' },
  { value: 'Europe/Oslo', label: 'CET - Oslo' },
  { value: 'Europe/Copenhagen', label: 'CET - Copenhagen' },
  { value: 'Europe/Helsinki', label: 'EET - Helsinki' },
  { value: 'Europe/Athens', label: 'EET - Athens' },
  { value: 'Europe/Moscow', label: 'MSK - Moscow' },
  { value: 'Europe/Istanbul', label: 'TRT - Istanbul' },
  { value: 'Asia/Dubai', label: 'GST - Dubai' },
  { value: 'Asia/Karachi', label: 'PKT - Karachi' },
  { value: 'Asia/Kolkata', label: 'IST - Mumbai/Delhi' },
  { value: 'Asia/Dhaka', label: 'BST - Dhaka' },
  { value: 'Asia/Bangkok', label: 'ICT - Bangkok' },
  { value: 'Asia/Singapore', label: 'SGT - Singapore' },
  { value: 'Asia/Hong_Kong', label: 'HKT - Hong Kong' },
  { value: 'Asia/Shanghai', label: 'CST - Shanghai/Beijing' },
  { value: 'Asia/Tokyo', label: 'JST - Tokyo' },
  { value: 'Asia/Seoul', label: 'KST - Seoul' },
  { value: 'Asia/Manila', label: 'PHT - Manila' },
  { value: 'Asia/Jakarta', label: 'WIB - Jakarta' },
  { value: 'Asia/Kuala_Lumpur', label: 'MYT - Kuala Lumpur' },
  { value: 'Asia/Riyadh', label: 'AST - Riyadh' },
  { value: 'Asia/Tehran', label: 'IRST - Tehran' },
  { value: 'Asia/Jerusalem', label: 'IST - Jerusalem' },
  { value: 'Africa/Cairo', label: 'EET - Cairo' },
  { value: 'Africa/Lagos', label: 'WAT - Lagos' },
  { value: 'Africa/Johannesburg', label: 'SAST - Johannesburg' },
  { value: 'Africa/Nairobi', label: 'EAT - Nairobi' },
  { value: 'Australia/Sydney', label: 'AEST - Sydney' },
  { value: 'Australia/Melbourne', label: 'AEST - Melbourne' },
  { value: 'Australia/Brisbane', label: 'AEST - Brisbane' },
  { value: 'Australia/Perth', label: 'AWST - Perth' },
  { value: 'Pacific/Auckland', label: 'NZST - Auckland' },
  { value: 'Pacific/Fiji', label: 'FJT - Fiji' },
];

const REPEAT_OPTIONS: { value: EventRepeatType; label: string }[] = [
  { value: 'never', label: 'Never' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const REMINDER_OPTIONS: { value: EventReminderType; label: string }[] = [
  { value: 'at_time', label: 'At exact time of event' },
  { value: '5min', label: '5 minutes before' },
  { value: '10min', label: '10 minutes before' },
  { value: '15min', label: '15 minutes before' },
  { value: '30min', label: '30 minutes before' },
  { value: '1hour', label: '1 hour before' },
  { value: '1day', label: '1 day before' },
];

export const EventEditor = ({ event, isOpen, onClose, onSave, defaultDate }: EventEditorProps) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState<Date>(defaultDate || new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState<Date>(defaultDate || new Date());
  const [endTime, setEndTime] = useState('10:00');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [repeat, setRepeat] = useState<EventRepeatType>('never');
  const [reminder, setReminder] = useState<EventReminderType>('15min');

  useHardwareBackButton({ onBack: onClose, enabled: isOpen, priority: 'sheet' });

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || '');
      setLocation(event.location || '');
      setAllDay(event.allDay);
      setStartDate(new Date(event.startDate));
      setStartTime(format(new Date(event.startDate), 'HH:mm'));
      setEndDate(new Date(event.endDate));
      setEndTime(format(new Date(event.endDate), 'HH:mm'));
      setTimezone(event.timezone);
      setRepeat(event.repeat);
      setReminder(event.reminder);
    } else {
      // Reset for new event
      setTitle('');
      setDescription('');
      setLocation('');
      setAllDay(false);
      setStartDate(defaultDate || new Date());
      setStartTime('09:00');
      setEndDate(defaultDate || new Date());
      setEndTime('10:00');
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
      setRepeat('never');
      setReminder('15min');
    }
  }, [event, defaultDate, isOpen]);

  const handleSave = () => {
    if (!title.trim()) {
      toast.error(t('events.enterTitle'));
      return;
    }

    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const finalStartDate = new Date(startDate);
    finalStartDate.setHours(startHour, startMinute, 0, 0);

    const finalEndDate = new Date(endDate);
    finalEndDate.setHours(endHour, endMinute, 0, 0);

    if (finalEndDate < finalStartDate) {
      toast.error(t('events.endBeforeStart'));
      return;
    }

    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      allDay,
      startDate: finalStartDate,
      endDate: finalEndDate,
      timezone,
      repeat,
      reminder,
    });

    onClose();
    toast.success(event ? t('events.eventUpdated') : t('events.eventCreated'));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {/* Header */}
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onClose}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-lg font-semibold">{event ? t('events.editEvent') : t('events.newEvent')}</h1>
            </div>
            <Button onClick={handleSave} size="sm">
              <Save className="h-4 w-4 mr-2" />
              {t('common.save')}
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="container mx-auto px-4 py-6 max-w-lg space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-base font-medium">{t('editor.title')}</Label>
            <Input
              id="title"
              placeholder={t('events.eventTitle')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-base"
            />
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center justify-between py-2">
            <Label htmlFor="allDay" className="text-base font-medium">{t('events.allDay')}</Label>
            <Switch id="allDay" checked={allDay} onCheckedChange={setAllDay} />
          </div>

          {/* Start Date & Time */}
          <div className="space-y-2">
            <Label className="text-base font-medium flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              {t('events.starts')}
            </Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start">
                    {format(startDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-background" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {!allDay && (
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-32"
                />
              )}
            </div>
          </div>

          {/* End Date & Time */}
          <div className="space-y-2">
            <Label className="text-base font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t('events.ends')}
            </Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start">
                    {format(endDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-background" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {!allDay && (
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-32"
                />
              )}
            </div>
          </div>

          {/* Repeat */}
          <div className="space-y-2">
            <Label className="text-base font-medium flex items-center gap-2">
              <Repeat className="h-4 w-4" />
              {t('events.repeat')}
            </Label>
            <Select value={repeat} onValueChange={(v) => setRepeat(v as EventRepeatType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="never">{t('events.repeatNever')}</SelectItem>
                <SelectItem value="daily">{t('events.repeatDaily')}</SelectItem>
                <SelectItem value="weekly">{t('events.repeatWeekly')}</SelectItem>
                <SelectItem value="monthly">{t('events.repeatMonthly')}</SelectItem>
                <SelectItem value="yearly">{t('events.repeatYearly')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reminder */}
          <div className="space-y-2">
            <Label className="text-base font-medium flex items-center gap-2">
              <Bell className="h-4 w-4" />
              {t('events.reminder')}
            </Label>
            <Select value={reminder} onValueChange={(v) => setReminder(v as EventReminderType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="at_time">{t('events.reminderAtTime')}</SelectItem>
                <SelectItem value="5min">{t('events.reminder5min')}</SelectItem>
                <SelectItem value="10min">{t('events.reminder10min')}</SelectItem>
                <SelectItem value="15min">{t('events.reminder15min')}</SelectItem>
                <SelectItem value="30min">{t('events.reminder30min')}</SelectItem>
                <SelectItem value="1hour">{t('events.reminder1hour')}</SelectItem>
                <SelectItem value="1day">{t('events.reminder1day')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label className="text-base font-medium flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {t('events.timeZone')}
            </Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background max-h-60">
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label className="text-base font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {t('events.location')}
            </Label>
            <Input
              placeholder={t('events.addLocation')}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="text-base font-medium">{t('events.description')}</Label>
            <Textarea
              placeholder={t('events.addDescription')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
