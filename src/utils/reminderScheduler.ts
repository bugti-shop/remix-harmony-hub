/**
 * Fresh Reminder Scheduler
 * Clean implementation using @capacitor/local-notifications
 * Handles scheduling/cancelling reminders for tasks and notes
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// Generate a stable numeric ID from a string ID
const hashStringToId = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) % 2147483647; // Keep within safe int range
};

/**
 * Request notification permission (call once on app start)
 */
export const requestReminderPermission = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  
  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display === 'granted') return true;
    
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  } catch (e) {
    console.warn('[Reminder] Permission request failed:', e);
    return false;
  }
};

/**
 * Schedule a task reminder
 */
export const scheduleTaskReminder = async (
  taskId: string,
  taskText: string,
  reminderTime: Date
): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    console.log('[Reminder] Web: would schedule task reminder for', taskText, 'at', reminderTime);
    return;
  }

  const now = new Date();
  if (reminderTime <= now) {
    console.log('[Reminder] Skipping past reminder for task:', taskText);
    return;
  }

  const notifId = hashStringToId(`task-${taskId}`);

  try {
    // Cancel existing reminder for this task first
    await cancelTaskReminder(taskId);

    await LocalNotifications.schedule({
      notifications: [{
        id: notifId,
        title: '📋 Task Reminder',
        body: taskText,
        schedule: { at: reminderTime, allowWhileIdle: true },
        channelId: 'task-reminders',
        extra: { type: 'task', taskId },
      }],
    });

    console.log('[Reminder] Scheduled task reminder:', taskText, 'at', reminderTime.toLocaleString());
  } catch (e) {
    console.error('[Reminder] Failed to schedule task reminder:', e);
  }
};

/**
 * Cancel a task reminder
 */
export const cancelTaskReminder = async (taskId: string): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  const notifId = hashStringToId(`task-${taskId}`);
  try {
    await LocalNotifications.cancel({ notifications: [{ id: notifId }] });
  } catch (e) {
    console.warn('[Reminder] Cancel task reminder failed:', e);
  }
};

/**
 * Schedule a note reminder
 */
export const scheduleNoteReminder = async (
  noteId: string,
  noteTitle: string,
  reminderTime: Date
): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    console.log('[Reminder] Web: would schedule note reminder for', noteTitle, 'at', reminderTime);
    return;
  }

  const now = new Date();
  if (reminderTime <= now) {
    console.log('[Reminder] Skipping past reminder for note:', noteTitle);
    return;
  }

  const notifId = hashStringToId(`note-${noteId}`);

  try {
    await cancelNoteReminder(noteId);

    await LocalNotifications.schedule({
      notifications: [{
        id: notifId,
        title: '📝 Note Reminder',
        body: noteTitle || 'You have a note reminder',
        schedule: { at: reminderTime, allowWhileIdle: true },
        channelId: 'note-reminders',
        extra: { type: 'note', noteId },
      }],
    });

    console.log('[Reminder] Scheduled note reminder:', noteTitle, 'at', reminderTime.toLocaleString());
  } catch (e) {
    console.error('[Reminder] Failed to schedule note reminder:', e);
  }
};

/**
 * Cancel a note reminder
 */
export const cancelNoteReminder = async (noteId: string): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  const notifId = hashStringToId(`note-${noteId}`);
  try {
    await LocalNotifications.cancel({ notifications: [{ id: notifId }] });
  } catch (e) {
    console.warn('[Reminder] Cancel note reminder failed:', e);
  }
};

/**
 * Create notification channels (call once on app init, Android only)
 */
export const createReminderChannels = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  if (Capacitor.getPlatform() !== 'android') return;

  try {
    await LocalNotifications.createChannel({
      id: 'task-reminders',
      name: 'Task Reminders',
      description: 'Reminders for your tasks',
      importance: 4, // HIGH
      visibility: 1, // PUBLIC
      vibration: true,
      sound: 'default',
    });

    await LocalNotifications.createChannel({
      id: 'note-reminders',
      name: 'Note Reminders',
      description: 'Reminders for your notes',
      importance: 4,
      visibility: 1,
      vibration: true,
      sound: 'default',
    });

    console.log('[Reminder] Notification channels created');
  } catch (e) {
    console.warn('[Reminder] Channel creation failed:', e);
  }
};

/**
 * Initialize the reminder system (call once on app start)
 */
export const initializeReminders = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  await createReminderChannels();
  
  // Request permission after a short delay
  setTimeout(async () => {
    await requestReminderPermission();
  }, 1500);
};
