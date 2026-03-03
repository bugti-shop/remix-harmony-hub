/**
 * Smart Adaptive Notification System
 * 
 * Tracks user behavior patterns (active hours, completion frequency)
 * and schedules notifications at optimal times with escalating urgency:
 *   1. Gentle reminder at user's usual active time
 *   2. Urgent reminder at 8 PM
 *   3. Last chance at 10 PM
 * 
 * Cancels all pending smart notifications once the user completes a task.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { getSetting, setSetting } from './settingsStorage';
import { loadStreakData, isCompletedToday, TASK_STREAK_KEY } from './streakStorage';
import { format } from 'date-fns';

// ─── Notification IDs ────────────────────────────────────────
const SMART_GENTLE_ID = 998001;
const SMART_URGENT_ID = 998002;
const SMART_LAST_CHANCE_ID = 998003;
const CHANNEL_GENTLE = 'smart-gentle';
const CHANNEL_URGENT = 'smart-urgent';

// ─── Behavior Data ──────────────────────────────────────────
export interface UserBehaviorData {
  /** Hour (0-23) → number of completions at that hour */
  completionHours: Record<number, number>;
  /** Total completions tracked */
  totalTracked: number;
  /** Computed preferred hour (most frequent) */
  preferredHour: number | null;
  /** Last date behavior was analyzed */
  lastAnalyzed: string | null;
}

const BEHAVIOR_KEY = 'npd_smart_notif_behavior';

const getDefaultBehavior = (): UserBehaviorData => ({
  completionHours: {},
  totalTracked: 0,
  preferredHour: null,
  lastAnalyzed: null,
});

// ─── Behavior Tracking ─────────────────────────────────────

/**
 * Record a task completion event to learn user patterns.
 * Call this every time a task is completed.
 */
export const recordCompletionEvent = async (): Promise<void> => {
  const hour = new Date().getHours();
  const data = await getSetting<UserBehaviorData>(BEHAVIOR_KEY, getDefaultBehavior());

  data.completionHours[hour] = (data.completionHours[hour] || 0) + 1;
  data.totalTracked += 1;

  // Recompute preferred hour after every 5 completions
  if (data.totalTracked % 5 === 0) {
    data.preferredHour = computePreferredHour(data.completionHours);
    data.lastAnalyzed = new Date().toISOString();
  }

  await setSetting(BEHAVIOR_KEY, data);
};

/**
 * Find the hour with the most completions.
 * Falls back to 9 AM if no data.
 */
const computePreferredHour = (hours: Record<number, number>): number => {
  let maxCount = 0;
  let bestHour = 9; // default morning
  for (const [h, count] of Object.entries(hours)) {
    if (count > maxCount) {
      maxCount = count;
      bestHour = parseInt(h, 10);
    }
  }
  return bestHour;
};

export const getUserPreferredHour = async (): Promise<number> => {
  const data = await getSetting<UserBehaviorData>(BEHAVIOR_KEY, getDefaultBehavior());
  return data.preferredHour ?? 9;
};

export const getUserBehaviorData = async (): Promise<UserBehaviorData> => {
  return getSetting<UserBehaviorData>(BEHAVIOR_KEY, getDefaultBehavior());
};

// ─── Android Channels ──────────────────────────────────────

const createSmartChannels = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  if (Capacitor.getPlatform() !== 'android') return;

  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_GENTLE,
      name: 'Smart Reminders',
      description: 'Gentle reminders at your usual active time',
      importance: 3, // DEFAULT
      visibility: 1,
      vibration: false,
      sound: 'default',
    });

    await LocalNotifications.createChannel({
      id: CHANNEL_URGENT,
      name: 'Urgent Streak Alerts',
      description: 'Urgent notifications when your streak is at risk',
      importance: 5, // MAX
      visibility: 1,
      vibration: true,
      sound: 'default',
    });
  } catch (e) {
    console.warn('[SmartNotif] Channel creation failed:', e);
  }
};

// ─── Scheduling ────────────────────────────────────────────

/**
 * Cancel all pending smart notifications.
 */
export const cancelSmartNotifications = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await LocalNotifications.cancel({
      notifications: [
        { id: SMART_GENTLE_ID },
        { id: SMART_URGENT_ID },
        { id: SMART_LAST_CHANCE_ID },
      ],
    });
  } catch (e) {
    console.warn('[SmartNotif] Cancel failed:', e);
  }
};

/**
 * Schedule smart adaptive notifications for today.
 * 
 * Tier 1: Gentle at user's preferred hour
 * Tier 2: Urgent at 8 PM
 * Tier 3: Last chance at 10 PM
 * 
 * Skips any time that's already past. Skips all if task already completed today.
 */
export const scheduleSmartNotifications = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    console.log('[SmartNotif] Web: skipping smart notifications');
    return;
  }

  try {
    await cancelSmartNotifications();

    const streakData = await loadStreakData(TASK_STREAK_KEY);

    // No streak to protect — still send gentle reminder if user has history
    const hasStreak = streakData.currentStreak > 0;

    // Already completed today — no need
    if (isCompletedToday(streakData)) return;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const streak = streakData.currentStreak;
    const preferredHour = await getUserPreferredHour();
    const notifications: any[] = [];

    // ── Tier 1: Gentle at preferred hour ──
    const gentleTime = new Date(today);
    gentleTime.setHours(preferredHour, 0, 0, 0);
    // If preferred hour already passed, try preferred + 1h
    if (now >= gentleTime) {
      gentleTime.setHours(preferredHour + 1, 0, 0, 0);
    }
    if (now < gentleTime && gentleTime.getHours() < 20) {
      notifications.push({
        id: SMART_GENTLE_ID,
        title: hasStreak
          ? `Good ${gentleTime.getHours() < 12 ? 'morning' : 'afternoon'}! Keep your ${streak}-day streak going ☀️`
          : 'Time to get productive! ☀️',
        body: hasStreak
          ? 'Complete one task to maintain your streak today.'
          : 'Open the app and tackle your tasks for today.',
        schedule: { at: gentleTime, allowWhileIdle: true },
        channelId: CHANNEL_GENTLE,
        smallIcon: 'npd_notification_icon',
        iconColor: '#3B82F6',
        sound: 'default',
      });
    }

    // ── Tier 2: Urgent at 8 PM (only if streak at risk) ──
    if (hasStreak) {
      const urgentTime = new Date(today);
      urgentTime.setHours(20, 0, 0, 0);
      if (now < urgentTime) {
        notifications.push({
          id: SMART_URGENT_ID,
          title: `⚠️ Your ${streak}-day streak is at risk!`,
          body: 'Complete one task before midnight to keep your streak alive. Don\'t lose your progress!',
          schedule: { at: urgentTime, allowWhileIdle: true },
          channelId: CHANNEL_URGENT,
          smallIcon: 'npd_notification_icon',
          iconColor: '#F97316',
          sound: 'default',
        });
      }
    }

    // ── Tier 3: Last chance at 10 PM (only if streak at risk) ──
    if (hasStreak) {
      const lastChanceTime = new Date(today);
      lastChanceTime.setHours(22, 0, 0, 0);
      if (now < lastChanceTime) {
        notifications.push({
          id: SMART_LAST_CHANCE_ID,
          title: `🚨 Last chance! ${streak} days end at midnight`,
          body: `You've been consistent for ${streak} days — don't let it end now! Just one task.`,
          schedule: { at: lastChanceTime, allowWhileIdle: true },
          channelId: CHANNEL_URGENT,
          smallIcon: 'npd_notification_icon',
          iconColor: '#EF4444',
          sound: 'default',
        });
      }
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
      console.log(`[SmartNotif] Scheduled ${notifications.length} smart notification(s) — preferred hour: ${preferredHour}`);
    }
  } catch (e) {
    console.warn('[SmartNotif] Schedule failed:', e);
  }
};

// ─── Streak Buddy + Re-engagement Notifications ───────────

const BUDDY_SAD_ID = 998008;
const BUDDY_ANGRY_ID = 998009;
const REENGAGEMENT_2D_ID = 998010;
const REENGAGEMENT_5D_ID = 998011;
const REENGAGEMENT_7D_ID = 998012;
const LAST_OPEN_KEY = 'npd_last_app_open';

/**
 * Record that the user opened the app right now.
 * Cancels and reschedules all re-engagement + buddy notifications.
 */
export const recordAppOpen = async (): Promise<void> => {
  await setSetting(LAST_OPEN_KEY, new Date().toISOString());

  if (!Capacitor.isNativePlatform()) return;
  await cancelReengagementNotifications();
  await scheduleReengagementNotifications();
};

const cancelReengagementNotifications = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({
      notifications: [
        { id: BUDDY_SAD_ID },
        { id: BUDDY_ANGRY_ID },
        { id: REENGAGEMENT_2D_ID },
        { id: REENGAGEMENT_5D_ID },
        { id: REENGAGEMENT_7D_ID },
      ],
    });
  } catch (e) {
    console.warn('[SmartNotif] Cancel re-engagement failed:', e);
  }
};

/**
 * Schedule Streak Buddy + re-engagement notifications.
 * 
 * Streak Buddy (logo-aware):
 *   1 day:  😢 sad notification
 *   2 days: 😠 angry notification
 * 
 * Re-engagement:
 *   2 days, 5 days, 7 days
 */
const scheduleReengagementNotifications = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const now = new Date();
    const preferredHour = await getUserPreferredHour();

    const makeDate = (daysFromNow: number): Date => {
      const d = new Date(now);
      d.setDate(d.getDate() + daysFromNow);
      d.setHours(preferredHour, 0, 0, 0);
      return d;
    };

    const notifications = [
      // Streak Buddy — 1 day (sad)
      {
        id: BUDDY_SAD_ID,
        title: 'I miss you 😢',
        body: "It's been a whole day! Your tasks are getting lonely. Come back and check on them!",
        schedule: { at: makeDate(1), allowWhileIdle: true },
        channelId: CHANNEL_GENTLE,
        smallIcon: 'npd_notification_icon',
        iconColor: '#60A5FA',
        sound: 'default',
      },
      // Streak Buddy — 2 days (angry)
      {
        id: BUDDY_ANGRY_ID,
        title: "I'm not happy 😠",
        body: "2 days without you! Your streak buddy is upset. Open the app before it's too late!",
        schedule: { at: makeDate(2), allowWhileIdle: true },
        channelId: CHANNEL_URGENT,
        smallIcon: 'npd_notification_icon',
        iconColor: '#EF4444',
        sound: 'default',
      },
      // Re-engagement — 2 days
      {
        id: REENGAGEMENT_2D_ID,
        title: 'Your tasks miss you! 📝',
        body: 'Come back and keep your productivity going. Your to-do list is waiting!',
        schedule: { at: makeDate(2), allowWhileIdle: true },
        channelId: CHANNEL_GENTLE,
        smallIcon: 'npd_notification_icon',
        iconColor: '#3B82F6',
        sound: 'default',
      },
      // Re-engagement — 5 days
      {
        id: REENGAGEMENT_5D_ID,
        title: "It's been a while! 🔥",
        body: 'Your streak is waiting to be rebuilt. Jump back in and start fresh today!',
        schedule: { at: makeDate(5), allowWhileIdle: true },
        channelId: CHANNEL_URGENT,
        smallIcon: 'npd_notification_icon',
        iconColor: '#F97316',
        sound: 'default',
      },
      // Re-engagement — 7 days
      {
        id: REENGAGEMENT_7D_ID,
        title: 'We saved everything for you ✨',
        body: 'Pick up where you left off — all your tasks, notes, and progress are right here.',
        schedule: { at: makeDate(7), allowWhileIdle: true },
        channelId: CHANNEL_GENTLE,
        smallIcon: 'npd_notification_icon',
        iconColor: '#8B5CF6',
        sound: 'default',
      },
    ];

    await LocalNotifications.schedule({ notifications });
    console.log('[SmartNotif] Scheduled 5 buddy + re-engagement notifications');
  } catch (e) {
    console.warn('[SmartNotif] Re-engagement schedule failed:', e);
  }
};

// ─── Initialization ────────────────────────────────────────

/**
 * Initialize the smart notification system.
 * Call once on app start.
 */
export const initializeSmartNotifications = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  await createSmartChannels();
  await scheduleSmartNotifications();

  // Record app open and schedule re-engagement notifications
  await recordAppOpen();

  // When streak is updated (task completed), cancel smart notifs and record behavior
  window.addEventListener('streakUpdated', async () => {
    try {
      const data = await loadStreakData(TASK_STREAK_KEY);
      if (isCompletedToday(data)) {
        await cancelSmartNotifications();
        await recordCompletionEvent();
      }
    } catch (e) {
      console.warn('[SmartNotif] streakUpdated handler failed:', e);
    }
  });
};
