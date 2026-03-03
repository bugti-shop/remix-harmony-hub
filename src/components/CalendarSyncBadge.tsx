import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, Calendar, ChevronDown, ChevronUp, Clock, MapPin, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  getCalendarSyncStatus,
  isCalendarSyncEnabled,
  setCalendarSyncEnabled,
  performFullCalendarSync,
  requestCalendarPermissions,
  CalendarSyncStatus,
} from '@/utils/systemCalendarSync';
import { loadTasksFromDB } from '@/utils/taskStorage';
import { getSetting } from '@/utils/settingsStorage';
import { CalendarEvent } from '@/types/note';
import { formatDistanceToNow, format, isToday, isTomorrow } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { setSetting } from '@/utils/settingsStorage';
import { EventEditor } from '@/components/EventEditor';
import { Capacitor } from '@capacitor/core';

interface CalendarSyncBadgeProps {
  alwaysVisible?: boolean;
}

export const CalendarSyncBadge = ({ alwaysVisible = false }: CalendarSyncBadgeProps) => {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<CalendarSyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pulledEvents, setPulledEvents] = useState<CalendarEvent[]>([]);
  const [showPulledList, setShowPulledList] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const [syncEnabled, syncStatus, allEvents] = await Promise.all([
        isCalendarSyncEnabled(),
        getCalendarSyncStatus(),
        getSetting<CalendarEvent[]>('calendarEvents', []),
      ]);
      setEnabled(syncEnabled);
      setStatus(syncStatus);
      setPulledEvents(
        allEvents
          .filter(e => e.id.startsWith('native_'))
          .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      );
    } catch (e) {
      console.warn('Failed to load calendar sync status:', e);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    const handler = () => loadStatus();
    window.addEventListener('calendarSyncStatusUpdated', handler);
    window.addEventListener('calendarEventsUpdated', handler);
    return () => {
      window.removeEventListener('calendarSyncStatusUpdated', handler);
      window.removeEventListener('calendarEventsUpdated', handler);
    };
  }, [loadStatus]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      // If not enabled yet, enable and request permissions first
      if (!enabled) {
        if (Capacitor.isNativePlatform()) {
          const granted = await requestCalendarPermissions();
          if (!granted) {
            toast.error(t('calendarSync.permissionDenied', 'Calendar permission denied'));
            setIsSyncing(false);
            return;
          }
        }
        await setCalendarSyncEnabled(true);
        setEnabled(true);
      }

      const [tasks, events] = await Promise.all([
        loadTasksFromDB().catch(() => []),
        getSetting<CalendarEvent[]>('calendarEvents', []).catch(() => []),
      ]);
      const result = await performFullCalendarSync(tasks, events);
      toast.success(
        t('calendarSync.syncedResult', { pushed: result.pushed, pulled: result.pulled })
      );
      await loadStatus();
    } catch (e) {
      console.error('Calendar sync error:', e);
      toast.error(t('calendarSync.syncFailed', 'Sync failed. Please try again.'));
    } finally {
      setIsSyncing(false);
    }
  };

  // If not alwaysVisible and not enabled, hide
  if (!alwaysVisible && !enabled) return null;

  const lastSynced = status?.lastSyncedAt
    ? formatDistanceToNow(new Date(status.lastSyncedAt), { addSuffix: true })
    : null;

  const hasErrors = (status?.errors?.length ?? 0) > 0;

  const formatEventDate = (date: Date | string) => {
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return '';
      if (isToday(d)) return `${t('common.today', 'Today')} ${format(d, 'h:mm a')}`;
      if (isTomorrow(d)) return `${t('common.tomorrow', 'Tomorrow')} ${format(d, 'h:mm a')}`;
      return format(d, 'MMM dd, h:mm a');
    } catch {
      return '';
    }
  };

  // Always-visible full-width button mode
  if (alwaysVisible) {
    return (
      <>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full flex items-center justify-between gap-2 h-10"
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {t('settings.calendarSync', 'Sync Calendar')}
                </span>
                {enabled && status?.lastSyncedAt && (
                  <span className="text-[10px] text-muted-foreground">
                    ({lastSynced})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {isSyncing && <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />}
                {!isSyncing && enabled && !hasErrors && status?.lastSyncedAt && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                )}
                {!isSyncing && hasErrors && (
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                )}
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="center">
            <div className="p-3 border-b border-border">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-primary" />
                  {t('settings.calendarSync', 'Sync Calendar')}
                </h4>
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="h-7 px-3 text-xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? t('calendarSync.syncing', 'Syncing...') : t('calendarSync.syncNow', 'Sync Now')}
                </Button>
              </div>
              {lastSynced && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('calendarSync.lastSynced', { time: lastSynced })}
                </p>
              )}
              {!enabled && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('calendarSync.tapToEnable', 'Tap "Sync Now" to enable two-way calendar sync')}
                </p>
              )}
            </div>

            <div className="p-3 space-y-2">
              {/* Stats */}
              {enabled && status?.lastSyncedAt && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-lg font-bold text-foreground">{status?.totalSynced ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('calendarSync.total', 'Total')}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-lg font-bold text-primary">{status?.pushed ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('calendarSync.pushed', 'Pushed')}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <p className="text-lg font-bold text-primary">{status?.pulled ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('calendarSync.pulled', 'Pulled')}</p>
                  </div>
                </div>
              )}

              {/* Pulled Events Section */}
              {pulledEvents.length > 0 && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => setShowPulledList(!showPulledList)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 text-primary" />
                      {t('calendarSync.pulledEvents', 'Pulled Events')}
                      <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {pulledEvents.length}
                      </span>
                    </span>
                    {showPulledList ? (
                      <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>

                  {showPulledList && (
                    <ScrollArea className="max-h-48">
                      <div className="divide-y divide-border">
                        {pulledEvents.map((event) => (
                          <button
                            key={event.id}
                            onClick={() => setSelectedEvent(event)}
                            className="w-full text-left px-3 py-2 hover:bg-muted/40 transition-colors cursor-pointer flex items-center gap-2"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">
                                {event.title}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <Clock className="h-2.5 w-2.5" />
                                  {formatEventDate(event.startDate)}
                                </span>
                                {event.location && (
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 truncate max-w-[120px]">
                                    <MapPin className="h-2.5 w-2.5 shrink-0" />
                                    {event.location}
                                  </span>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              )}

              {/* Status message */}
              {hasErrors ? (
                <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-2">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{status!.errors[0]}</span>
                </div>
              ) : enabled && status?.lastSyncedAt ? (
                <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 rounded-lg p-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span>{t('calendarSync.allInSync', 'All in sync')}</span>
                </div>
              ) : !enabled ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span>{t('calendarSync.twoWayDesc', 'Two-way sync between your app and system calendar')}</span>
                </div>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>

        {/* Event Detail Editor */}
        <EventEditor
          event={selectedEvent}
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onSave={async (updatedEvent) => {
            try {
              if (!selectedEvent) return;
              const allEvents = await getSetting<CalendarEvent[]>('calendarEvents', []);
              const updated = allEvents.map(e =>
                e.id === selectedEvent.id
                  ? { ...e, ...updatedEvent, updatedAt: new Date() }
                  : e
              );
              await setSetting('calendarEvents', updated);
              window.dispatchEvent(new CustomEvent('calendarEventsUpdated'));
              setSelectedEvent(null);
              toast.success(t('common.saved', 'Event updated'));
              loadStatus();
            } catch (e) {
              console.error('Failed to save event:', e);
              toast.error(t('common.error', 'Failed to save'));
            }
          }}
        />
      </>
    );
  }

  // Original compact icon mode
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span
            className={`absolute top-1 right-1 h-2 w-2 rounded-full ${
              hasErrors
                ? 'bg-destructive'
                : status?.lastSyncedAt
                  ? 'bg-primary'
                  : 'bg-muted-foreground'
            }`}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-primary" />
              {t('settings.calendarSync', 'Calendar Sync')}
            </h4>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="h-7 px-2 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? t('calendarSync.syncing') : t('calendarSync.syncNow')}
            </Button>
          </div>
          {lastSynced && (
            <p className="text-xs text-muted-foreground mt-1">
              {t('calendarSync.lastSynced', { time: lastSynced })}
            </p>
          )}
        </div>

        <div className="p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted/50 rounded-lg p-2">
              <p className="text-lg font-bold text-foreground">{status?.totalSynced ?? 0}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('calendarSync.total')}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2">
              <p className="text-lg font-bold text-primary">{status?.pushed ?? 0}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('calendarSync.pushed')}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2">
              <p className="text-lg font-bold text-primary">{status?.pulled ?? 0}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('calendarSync.pulled')}</p>
            </div>
          </div>

          {pulledEvents.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setShowPulledList(!showPulledList)}
                className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 text-primary" />
                  {t('calendarSync.pulledEvents', 'Pulled Events')}
                  <span className="bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {pulledEvents.length}
                  </span>
                </span>
                {showPulledList ? (
                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>

              {showPulledList && (
                <ScrollArea className="max-h-48">
                  <div className="divide-y divide-border">
                    {pulledEvents.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className="w-full text-left px-3 py-2 hover:bg-muted/40 transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {event.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              {formatEventDate(event.startDate)}
                            </span>
                            {event.location && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 truncate max-w-[120px]">
                                <MapPin className="h-2.5 w-2.5 shrink-0" />
                                {event.location}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {pulledEvents.length === 0 && status?.lastSyncedAt && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-2">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>{t('calendarSync.noPulledEvents', 'No events pulled from device calendar')}</span>
            </div>
          )}

          {hasErrors ? (
            <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{status!.errors[0]}</span>
            </div>
          ) : status?.lastSyncedAt ? (
            <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 rounded-lg p-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>{t('calendarSync.allInSync')}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
              <RefreshCw className="h-3.5 w-3.5 shrink-0" />
              <span>{t('calendarSync.notSyncedYet')}</span>
            </div>
          )}
        </div>
      </PopoverContent>

      <EventEditor
        event={selectedEvent}
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onSave={async (updatedEvent) => {
          try {
            if (!selectedEvent) return;
            const allEvents = await getSetting<CalendarEvent[]>('calendarEvents', []);
            const updated = allEvents.map(e =>
              e.id === selectedEvent.id
                ? { ...e, ...updatedEvent, updatedAt: new Date() }
                : e
            );
            await setSetting('calendarEvents', updated);
            window.dispatchEvent(new CustomEvent('calendarEventsUpdated'));
            setSelectedEvent(null);
            toast.success(t('common.saved', 'Event updated'));
            loadStatus();
          } catch (e) {
            console.error('Failed to save event:', e);
            toast.error(t('common.error', 'Failed to save'));
          }
        }}
      />
    </Popover>
  );
};