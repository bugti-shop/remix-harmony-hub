import { useEffect, useRef, useCallback } from 'react';
import { useGoogleAuth } from '@/contexts/GoogleAuthContext';
import { performIncrementalSync } from '@/utils/driveSyncManager';

const FOCUS_DEBOUNCE_MS = 5000; // 5s debounce after focus
const DATA_CHANGE_DEBOUNCE_MS = 30_000; // 30s debounce after data changes
const MIN_SYNC_INTERVAL_MS = 60_000; // Don't sync more than once per minute

/**
 * Auto-syncs with Google Drive:
 * 1. When the app regains focus (5s debounce)
 * 2. When notes or tasks are modified locally (30s debounce)
 */
export const useAutoSync = () => {
  const { user } = useGoogleAuth();
  const lastSyncRef = useRef<number>(0);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const dataTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const scheduleSync = useCallback((delayMs: number, timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | undefined>) => {
    if (!user) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      const now = Date.now();
      if (now - lastSyncRef.current < MIN_SYNC_INTERVAL_MS) return;

      lastSyncRef.current = now;
      try {
        await performIncrementalSync();
      } catch (e) {
        console.warn('Auto-sync failed:', e);
      }
    }, delayMs);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // ── Focus / visibility triggers ──
    const handleFocus = () => scheduleSync(FOCUS_DEBOUNCE_MS, focusTimerRef);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') scheduleSync(FOCUS_DEBOUNCE_MS, focusTimerRef);
    };
    const handleResume = () => scheduleSync(FOCUS_DEBOUNCE_MS, focusTimerRef);

    // ── Data-change triggers (dispatched by app code after saves) ──
    const handleDataChange = () => scheduleSync(DATA_CHANGE_DEBOUNCE_MS, dataTimerRef);

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('appResume', handleResume);
    window.addEventListener('notesUpdated', handleDataChange);
    window.addEventListener('tasksUpdated', handleDataChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('appResume', handleResume);
      window.removeEventListener('notesUpdated', handleDataChange);
      window.removeEventListener('tasksUpdated', handleDataChange);
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
      if (dataTimerRef.current) clearTimeout(dataTimerRef.current);
    };
  }, [user, scheduleSync]);
};
