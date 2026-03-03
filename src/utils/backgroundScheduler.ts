/**
 * Background Task Scheduler
 * Handles periodic checks for task rollovers and deadline escalations
 * Notification scheduling handled via Capacitor Local Notifications
 */

import { loadTodoItems, saveTodoItems } from './todoItemsStorage';
import { processTaskRollovers } from './taskRollover';
import { checkDeadlineEscalations } from './deadlineEscalation';

// Rollover check interval (1 hour in milliseconds)
const ROLLOVER_CHECK_INTERVAL = 60 * 60 * 1000;
// Escalation check interval (15 minutes)
const ESCALATION_CHECK_INTERVAL = 15 * 60 * 1000;

let rolloverIntervalId: ReturnType<typeof setInterval> | null = null;
let escalationIntervalId: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

export const checkAndRolloverTasks = async (): Promise<number> => {
  if (isRunning) return 0;
  isRunning = true;
  
  try {
    const items = await loadTodoItems();
    const { tasks: updatedTasks, rolledOverCount } = processTaskRollovers(items);
    
    if (rolledOverCount > 0) {
      await saveTodoItems(updatedTasks);
      console.log(`Auto-rolled over ${rolledOverCount} recurring task(s)`);
    }
    
    return rolledOverCount;
  } catch (e) {
    console.error('Task rollover check failed:', e);
    return 0;
  } finally {
    isRunning = false;
  }
};

export const checkDeadlineAlerts = async (): Promise<number> => {
  try {
    const items = await loadTodoItems();
    const alerts = checkDeadlineEscalations(items);

    if (alerts.length === 0) return 0;

    let updated = false;
    const updatedItems = [...items];

    for (const alert of alerts) {
      const idx = updatedItems.findIndex(t => t.id === alert.task.id);
      if (idx === -1) continue;

      const minutesLeft = Math.max(0, Math.round(alert.minutesUntilDeadline));
      const timeLabel = alert.isOverdue
        ? 'OVERDUE'
        : minutesLeft < 60
          ? `${minutesLeft}min left`
          : `${Math.round(minutesLeft / 60)}h left`;

      // Web fallback: dispatch event for in-app toast
      window.dispatchEvent(new CustomEvent('deadlineEscalation', {
        detail: { taskId: alert.task.id, text: alert.task.text, timeLabel },
      }));

      updatedItems[idx] = {
        ...updatedItems[idx],
        escalationRule: {
          ...updatedItems[idx].escalationRule!,
          lastTriggeredAt: new Date(),
        },
      };
      updated = true;
    }

    if (updated) {
      await saveTodoItems(updatedItems);
    }

    console.log(`Triggered ${alerts.length} deadline escalation(s)`);
    return alerts.length;
  } catch (e) {
    console.error('Deadline escalation check failed:', e);
    return 0;
  }
};

export const startBackgroundScheduler = (): void => {
  if (rolloverIntervalId) {
    console.log('Background scheduler already running');
    return;
  }
  
  checkAndRolloverTasks();
  checkDeadlineAlerts();
  
  rolloverIntervalId = setInterval(checkAndRolloverTasks, ROLLOVER_CHECK_INTERVAL);
  escalationIntervalId = setInterval(checkDeadlineAlerts, ESCALATION_CHECK_INTERVAL);
  console.log('Background task scheduler started (hourly rollovers, 15min escalation checks)');
};

export const stopBackgroundScheduler = (): void => {
  if (rolloverIntervalId) {
    clearInterval(rolloverIntervalId);
    rolloverIntervalId = null;
  }
  if (escalationIntervalId) {
    clearInterval(escalationIntervalId);
    escalationIntervalId = null;
  }
  console.log('Background task scheduler stopped');
};

export const isSchedulerRunning = (): boolean => {
  return rolloverIntervalId !== null;
};
