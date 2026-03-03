/**
 * Streak Risk Notification Scheduler
 * Schedules local push notifications at 8 PM and 10 PM
 * when the user hasn't completed any task that day
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { loadStreakData, isCompletedToday, TASK_STREAK_KEY } from './streakStorage';

const STREAK_RISK_8PM_ID = 999001;
const STREAK_RISK_10PM_ID = 999002;
const CHANNEL_ID = 'streak-reminders';

/**
 * Create the streak reminder notification channel (Android)
 */
export const createStreakChannel = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  if (Capacitor.getPlatform() !== 'android') return;

  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Streak Reminders',
      description: 'Notifications when your streak is at risk',
      importance: 5, // MAX
      visibility: 1,
      vibration: true,
      sound: 'default',
    });
  } catch (e) {
    console.warn('[StreakNotif] Channel creation failed:', e);
  }
};

/**
 * Cancel any pending streak risk notifications
 */
export const cancelStreakRiskNotifications = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await LocalNotifications.cancel({
      notifications: [
        { id: STREAK_RISK_8PM_ID },
        { id: STREAK_RISK_10PM_ID },
      ],
    });
  } catch (e) {
    console.warn('[StreakNotif] Cancel failed:', e);
  }
};

/**
 * Schedule streak-at-risk notifications for today
 * Call this on app launch and after streak data changes
 *
 * - 8 PM: "Your X day streak is at risk! Complete one task to keep it alive 🔥"
 * - 10 PM: "Last chance! Your streak ends at midnight ⏰"
 *
 * If the user has already completed a task today, no notifications are scheduled.
 * If it's already past the notification times, those are skipped.
 */
export const scheduleStreakRiskNotifications = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    console.log('[StreakNotif] Web: skipping streak risk notifications');
    return;
  }

  try {
    // Always cancel existing ones first
    await cancelStreakRiskNotifications();

    const streakData = await loadStreakData(TASK_STREAK_KEY);

    // No streak to protect
    if (streakData.currentStreak <= 0) return;

    // Already completed today — no risk
    if (isCompletedToday(streakData)) return;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const streak = streakData.currentStreak;

    const notifications: any[] = [];

    // 8 PM notification
    const eightPm = new Date(today.getTime());
    eightPm.setHours(20, 0, 0, 0);
    if (now < eightPm) {
      notifications.push({
        id: STREAK_RISK_8PM_ID,
        title: `Your ${streak} day streak is at risk! 🔥`,
        body: 'Complete one task to keep it alive. Don\'t let your progress slip!',
        schedule: { at: eightPm, allowWhileIdle: true },
        channelId: CHANNEL_ID,
        smallIcon: 'npd_notification_icon',
        iconColor: '#F97316',
        sound: 'default',
      });
    }

    // 10 PM notification
    const tenPm = new Date(today.getTime());
    tenPm.setHours(22, 0, 0, 0);
    if (now < tenPm) {
      notifications.push({
        id: STREAK_RISK_10PM_ID,
        title: `Last chance! Your streak ends at midnight ⏰`,
        body: `${streak} days of consistency — don't break it now! Open Npd and complete one task.`,
        schedule: { at: tenPm, allowWhileIdle: true },
        channelId: CHANNEL_ID,
        smallIcon: 'npd_notification_icon',
        iconColor: '#EF4444',
        sound: 'default',
      });
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
      console.log(`[StreakNotif] Scheduled ${notifications.length} streak risk notification(s)`);
    }
  } catch (e) {
    console.warn('[StreakNotif] Schedule failed:', e);
  }
};

/**
 * Called when a task is completed — cancel risk notifications since streak is safe
 */
export const onTaskCompletedCancelRisk = async (): Promise<void> => {
  await cancelStreakRiskNotifications();
};

/**
 * Initialize streak notifications system
 * Call once on app start after reminder system is initialized
 */
export const initializeStreakNotifications = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  await createStreakChannel();
  await scheduleStreakRiskNotifications();

  // Re-schedule daily at midnight via a listener
  // (The app re-schedules on every launch, which covers most cases)

  // Listen for task completions to cancel risk notifications
  window.addEventListener('streakUpdated', () => {
    // Check if completed today, if so cancel
    loadStreakData(TASK_STREAK_KEY).then(data => {
      if (isCompletedToday(data)) {
        cancelStreakRiskNotifications();
      }
    }).catch(console.warn);
  });
};
