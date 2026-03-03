/**
 * Bidirectional sync between app tasks/events and the device's native calendar.
 * Uses @ebarooni/capacitor-calendar (v8) for Capacitor 8.
 *
 * ── Outbound (App → System Calendar) ──
 *   • Every task with a dueDate or event is pushed to the native calendar.
 *   • The native event ID is stored in the task/event's `googleCalendarEventId` field.
 *
 * ── Inbound (System Calendar → App) ──
 *   • Events fetched from the native calendar that don't already exist in the app
 *     are surfaced as CalendarEvent objects.
 */

import { Capacitor } from '@capacitor/core';
import { CapacitorCalendar, CalendarPermissionScope } from '@ebarooni/capacitor-calendar';
import { TodoItem, CalendarEvent as AppCalendarEvent } from '@/types/note';
import { getSetting, setSetting } from './settingsStorage';

// ─── Types ───────────────────────────────────────────────────────
export interface SystemCalendarSyncResult {
  pushed: number;
  pulled: number;
  errors: string[];
}

// ─── Guard: only run on native ──────────────────────────────────
const isNative = () => Capacitor.isNativePlatform();

// ─── Permissions ─────────────────────────────────────────────────
export const requestCalendarPermissions = async (): Promise<boolean> => {
  if (!isNative()) return false;
  try {
    const cal = CapacitorCalendar;
    const platform = Capacitor.getPlatform();
    
    if (platform === 'android') {
      try {
        const read = await Promise.resolve(cal.requestReadOnlyCalendarAccess());
        const write = await Promise.resolve(cal.requestWriteOnlyCalendarAccess());
        return read?.result === 'granted' && write?.result === 'granted';
      } catch (e) {
        console.warn('Android calendar permission request failed:', e);
        return false;
      }
    } else {
      const { result } = await Promise.resolve(cal.requestFullCalendarAccess());
      return result === 'granted';
    }
  } catch (e) {
    console.error('Calendar permission error:', e);
    return false;
  }
};

export const checkCalendarPermissions = async (): Promise<boolean> => {
  if (!isNative()) return false;
  try {
    const cal = CapacitorCalendar;
    const read = await Promise.resolve(cal.checkPermission({ scope: CalendarPermissionScope.READ_CALENDAR }));
    const write = await Promise.resolve(cal.checkPermission({ scope: CalendarPermissionScope.WRITE_CALENDAR }));
    return read?.result === 'granted' && write?.result === 'granted';
  } catch {
    return false;
  }
};

// ─── Sync enable/disable setting ─────────────────────────────────
const SYNC_ENABLED_KEY = 'systemCalendarSyncEnabled';
const SYNC_MAP_KEY = 'systemCalendarSyncMap'; // maps app id → native event id
const SYNC_STATUS_KEY = 'systemCalendarSyncStatus';

export interface CalendarSyncStatus {
  lastSyncedAt: string | null; // ISO date
  pushed: number;
  pulled: number;
  totalSynced: number;
  errors: string[];
}

export const isCalendarSyncEnabled = () => getSetting<boolean>(SYNC_ENABLED_KEY, false);
export const setCalendarSyncEnabled = (v: boolean) => setSetting(SYNC_ENABLED_KEY, v);
export const getCalendarSyncStatus = () => getSetting<CalendarSyncStatus>(SYNC_STATUS_KEY, {
  lastSyncedAt: null, pushed: 0, pulled: 0, totalSynced: 0, errors: [],
});

const saveSyncStatus = (s: CalendarSyncStatus) => {
  setSetting(SYNC_STATUS_KEY, s);
  window.dispatchEvent(new CustomEvent('calendarSyncStatusUpdated'));
};

type SyncMap = Record<string, string>; // appId → nativeEventId
const loadSyncMap = () => getSetting<SyncMap>(SYNC_MAP_KEY, {});
const saveSyncMap = (m: SyncMap) => setSetting(SYNC_MAP_KEY, m);

// ─── Reminder offset helper ─────────────────────────────────────
const reminderToMinutes = (reminder?: string): number[] => {
  switch (reminder) {
    case '5min': return [-5];
    case '10min': return [-10];
    case '15min': return [-15];
    case '30min': return [-30];
    case '1hour': return [-60];
    case '1day': return [-1440];
    default: return [-15]; // default 15 min before
  }
};

// ─── Push a single task to native calendar ───────────────────────
export const pushTaskToNativeCalendar = async (task: TodoItem): Promise<string | null> => {
  if (!isNative() || !task.dueDate) return null;
  try {
    const cal = CapacitorCalendar;
    const syncMap = await loadSyncMap();
    const existingId = syncMap[task.id];

    const startDate = new Date(task.dueDate).getTime();
    const endDate = startDate + 60 * 60 * 1000; // 1 hour default duration

    const eventData = {
      title: task.text,
      startDate,
      endDate,
      description: task.description || '',
      location: task.location || '',
      isAllDay: false,
      alerts: task.reminderTime ? reminderToMinutes() : [-15],
    };

    if (existingId) {
      // Update existing event
      try {
        await Promise.resolve(cal.modifyEvent({ id: existingId, ...eventData }));
      } catch {
        // If modify fails (event deleted externally), create new
        const { id } = await Promise.resolve(cal.createEvent(eventData));
        syncMap[task.id] = id;
        await saveSyncMap(syncMap);
        return id;
      }
      return existingId;
    } else {
      // Create new event
      const { id } = await Promise.resolve(cal.createEvent(eventData));
      syncMap[task.id] = id;
      await saveSyncMap(syncMap);
      return id;
    }
  } catch (e) {
    console.error('Failed to push task to native calendar:', e);
    return null;
  }
};

// ─── Push an app CalendarEvent to native calendar ────────────────
export const pushEventToNativeCalendar = async (event: AppCalendarEvent): Promise<string | null> => {
  if (!isNative()) return null;
  try {
    const cal = CapacitorCalendar;
    const syncMap = await loadSyncMap();
    const existingId = syncMap[event.id];

    const eventData = {
      title: event.title,
      startDate: new Date(event.startDate).getTime(),
      endDate: new Date(event.endDate).getTime(),
      description: event.description || '',
      location: event.location || '',
      isAllDay: event.allDay,
      alerts: reminderToMinutes(event.reminder),
    };

    if (existingId) {
      try {
        await Promise.resolve(cal.modifyEvent({ id: existingId, ...eventData }));
      } catch {
        const { id } = await Promise.resolve(cal.createEvent(eventData));
        syncMap[event.id] = id;
        await saveSyncMap(syncMap);
        return id;
      }
      return existingId;
    } else {
      const { id } = await Promise.resolve(cal.createEvent(eventData));
      syncMap[event.id] = id;
      await saveSyncMap(syncMap);
      return id;
    }
  } catch (e) {
    console.error('Failed to push event to native calendar:', e);
    return null;
  }
};

// ─── Remove a task/event from native calendar ────────────────────
export const removeFromNativeCalendar = async (appId: string): Promise<void> => {
  if (!isNative()) return;
  try {
    const cal = CapacitorCalendar;
    const syncMap = await loadSyncMap();
    const nativeId = syncMap[appId];
    if (nativeId) {
      await Promise.resolve(cal.deleteEvent({ id: nativeId })).catch(() => {});
      delete syncMap[appId];
      await saveSyncMap(syncMap);
    }
  } catch (e) {
    console.error('Failed to remove from native calendar:', e);
  }
};

// ─── Pull events from native calendar into app ──────────────────
export const pullFromNativeCalendar = async (
  daysAhead = 30,
  daysBehind = 7,
): Promise<AppCalendarEvent[]> => {
  if (!isNative()) return [];
  try {
    const cal = CapacitorCalendar;
    const now = Date.now();
    const from = now - daysBehind * 24 * 60 * 60 * 1000;
    const to = now + daysAhead * 24 * 60 * 60 * 1000;

    let nativeEvents: any[] = [];
    try {
      const response = await Promise.resolve(cal.listEventsInRange({ from, to }));
      nativeEvents = response?.result ?? [];
    } catch (listErr) {
      // listEventsInRange may not be implemented on some Android versions
      const msg = String(listErr);
      if (msg.includes('not implemented') || msg.includes('UNIMPLEMENTED')) {
        console.warn('listEventsInRange not supported on this device');
        return [];
      }
      throw listErr;
    }

    if (!Array.isArray(nativeEvents) || nativeEvents.length === 0) return [];

    const syncMap = await loadSyncMap();
    const nativeIdSet = new Set(Object.values(syncMap));

    // Filter out events that we pushed ourselves
    const externalEvents = nativeEvents.filter(e => e?.id && !nativeIdSet.has(e.id));

    return externalEvents
      .map(e => {
        try {
          const startTs = typeof e.startDate === 'number' ? e.startDate : Date.now();
          const endTs = typeof e.endDate === 'number' ? e.endDate : startTs + 3600000;
          const startDate = new Date(startTs);
          const endDate = new Date(endTs);

          // Skip events with invalid dates
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;

          return {
            id: `native_${e.id}`,
            title: e.title || 'Untitled',
            description: e.description || undefined,
            location: e.location || undefined,
            allDay: e.isAllDay ?? false,
            startDate,
            endDate,
            timezone: e.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            repeat: 'never' as const,
            reminder: 'at_time' as const,
            createdAt: e.creationDate ? new Date(e.creationDate) : new Date(),
            updatedAt: e.lastModifiedDate ? new Date(e.lastModifiedDate) : new Date(),
          };
        } catch {
          return null;
        }
      })
      .filter((e): e is NonNullable<typeof e> => e !== null) as AppCalendarEvent[];
  } catch (e) {
    console.error('Failed to pull from native calendar:', e);
    return [];
  }
};

// ─── Yield to UI thread to prevent freezing ─────────────────────
const yieldToUI = () => new Promise(resolve => setTimeout(resolve, 0));

// ─── Batch processing helper ────────────────────────────────────
const BATCH_SIZE = 25;

export type SyncProgressCallback = (info: { phase: string; current: number; total: number }) => void;

const processBatch = async <T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  onProgress?: (processed: number, total: number) => void,
): Promise<{ processed: number; errors: string[] }> => {
  let processed = 0;
  const errors: string[] = [];
  const total = items.length;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    
    for (const item of batch) {
      try {
        await processor(item);
        processed++;
      } catch (e: any) {
        const msg = e?.message || String(e);
        if (!msg.includes('not implemented') && !msg.includes('UNIMPLEMENTED')) {
          errors.push(msg);
        }
      }
    }

    onProgress?.(processed, total);
    // Yield to UI thread between batches to keep app responsive
    await yieldToUI();
  }

  return { processed, errors };
};

// ─── Full bidirectional sync ─────────────────────────────────────
export const performFullCalendarSync = async (
  tasks: TodoItem[],
  appEvents: AppCalendarEvent[],
  onProgress?: SyncProgressCallback,
): Promise<SystemCalendarSyncResult> => {
  const result: SystemCalendarSyncResult = { pushed: 0, pulled: 0, errors: [] };

  if (!isNative()) return result;

  try {
    const enabled = await isCalendarSyncEnabled();
    if (!enabled) return result;

    const hasPermission = await checkCalendarPermissions();
    if (!hasPermission) {
      result.errors.push('Calendar permissions not granted');
      return result;
    }

    // ── Push tasks with due dates (batched) ──
    const tasksWithDates = (tasks || []).filter(t => t?.dueDate && !t?.completed);
    onProgress?.({ phase: 'Pushing tasks', current: 0, total: tasksWithDates.length });
    const taskResult = await processBatch(tasksWithDates, async (task) => {
      await pushTaskToNativeCalendar(task);
    }, (cur, tot) => {
      result.pushed = cur;
      onProgress?.({ phase: 'Pushing tasks', current: cur, total: tot });
    });
    result.pushed = taskResult.processed;
    result.errors.push(...taskResult.errors.map(e => `Task push: ${e}`));

    // ── Push app calendar events (batched) ──
    const eventsArr = appEvents || [];
    onProgress?.({ phase: 'Pushing events', current: 0, total: eventsArr.length });
    const eventResult = await processBatch(eventsArr, async (event) => {
      await pushEventToNativeCalendar(event);
    }, (cur, tot) => {
      onProgress?.({ phase: 'Pushing events', current: result.pushed + cur, total: result.pushed + tot });
    });
    result.pushed += eventResult.processed;
    result.errors.push(...eventResult.errors.map(e => `Event push: ${e}`));

    // ── Pull from native calendar ──
    onProgress?.({ phase: 'Pulling events', current: 0, total: 0 });
    try {
      const pulledEvents = await pullFromNativeCalendar();
      const existingAppEvents = await getSetting<AppCalendarEvent[]>('calendarEvents', []);
      const existingIds = new Set(existingAppEvents.map(e => e.id));

      const newEvents = pulledEvents.filter(e => !existingIds.has(e.id));
      if (newEvents.length > 0) {
        const merged = [...existingAppEvents, ...newEvents];
        await setSetting('calendarEvents', merged);
        result.pulled = newEvents.length;
        window.dispatchEvent(new CustomEvent('calendarEventsUpdated'));
      }
      onProgress?.({ phase: 'Pulling events', current: result.pulled, total: result.pulled });
    } catch (pullErr) {
      const msg = String(pullErr);
      if (!msg.includes('not implemented') && !msg.includes('UNIMPLEMENTED')) {
        result.errors.push(`Pull failed: ${msg}`);
      }
    }

    // ── Save sync status ──
    try {
      const syncMap = await loadSyncMap();
      await saveSyncStatus({
        lastSyncedAt: new Date().toISOString(),
        pushed: result.pushed,
        pulled: result.pulled,
        totalSynced: Object.keys(syncMap).length,
        errors: result.errors,
      });
    } catch {}
  } catch (outerErr) {
    const msg = String(outerErr);
    if (!msg.includes('not implemented') && !msg.includes('UNIMPLEMENTED')) {
      result.errors.push(`Sync error: ${msg}`);
    }
  }

  onProgress?.({ phase: 'Done', current: result.pushed + result.pulled, total: result.pushed + result.pulled });
  return result;
};

// ─── Initialize: request permissions + initial sync ──────────────
export const initializeCalendarSync = async (): Promise<void> => {
  if (!isNative()) return;

  const enabled = await isCalendarSyncEnabled();
  if (!enabled) return;

  const granted = await requestCalendarPermissions();
  if (!granted) {
    console.warn('Calendar permissions not granted, disabling sync');
    return;
  }

  console.log('System calendar sync initialized');
};
