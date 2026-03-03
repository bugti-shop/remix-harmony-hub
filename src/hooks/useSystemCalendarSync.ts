import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { performFullCalendarSync, isCalendarSyncEnabled, initializeCalendarSync } from '@/utils/systemCalendarSync';
import { loadTasksFromDB } from '@/utils/taskStorage';
import { getSetting } from '@/utils/settingsStorage';
import { CalendarEvent } from '@/types/note';
import { toast } from 'sonner';

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Automatically syncs app tasks/events with the device's native calendar.
 * Runs on app focus and periodically.
 */
export const useSystemCalendarSync = () => {
  const lastSyncRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const toastIdRef = useRef<string | number | undefined>();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Initialize permissions on mount
    initializeCalendarSync().catch((e) => {
      if (String(e).includes('not implemented')) return;
      console.warn('Calendar sync init:', e);
    });

    const doSync = async () => {
      try {
        const enabled = await isCalendarSyncEnabled();
        if (!enabled) return;

        const now = Date.now();
        if (now - lastSyncRef.current < 60_000) return; // 1 min cooldown
        lastSyncRef.current = now;

        const tasks = await loadTasksFromDB();
        const events = await getSetting<CalendarEvent[]>('calendarEvents', []);

        // Show initial sync toast
        toastIdRef.current = toast.loading('📅 Syncing calendar...', { duration: Infinity });

        const result = await performFullCalendarSync(tasks, events, ({ phase, current, total }) => {
          if (toastIdRef.current && total > 0) {
            toast.loading(`📅 ${phase}: ${current}/${total}`, { id: toastIdRef.current, duration: Infinity });
          }
        });

        // Show completion toast
        if (result.pushed > 0 || result.pulled > 0) {
          toast.success(`📅 Sync complete: ${result.pushed} pushed, ${result.pulled} pulled`, {
            id: toastIdRef.current,
            duration: 3000,
          });
        } else {
          toast.dismiss(toastIdRef.current);
        }

        if (result.errors.length > 0) {
          console.warn('Calendar sync errors:', result.errors);
        }
      } catch (e) {
        if (toastIdRef.current) toast.dismiss(toastIdRef.current);
        const msg = String(e);
        if (!msg.includes('not implemented') && !msg.includes('UNIMPLEMENTED')) {
          console.warn('Calendar sync failed:', e);
        }
      }
    };

    // Sync on visibility change (app foreground)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') doSync();
    };

    // Sync when tasks or events change
    const handleDataChange = () => {
      setTimeout(doSync, 3000); // 3s debounce
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('tasksUpdated', handleDataChange);
    window.addEventListener('calendarEventsUpdated', handleDataChange);

    // Initial sync
    doSync();

    // Periodic sync
    intervalRef.current = setInterval(doSync, SYNC_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('tasksUpdated', handleDataChange);
      window.removeEventListener('calendarEventsUpdated', handleDataChange);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
};
