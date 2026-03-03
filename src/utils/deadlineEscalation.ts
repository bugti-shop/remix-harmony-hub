/**
 * Deadline Escalation Checker
 * Checks tasks approaching deadlines and triggers escalation alerts
 */

import { TodoItem, EscalationTiming } from '@/types/note';
import { differenceInMinutes, subMinutes } from 'date-fns';

/** Convert escalation timing preset to minutes */
export const escalationTimingToMinutes = (timing: EscalationTiming): number => {
  const map: Record<EscalationTiming, number> = {
    '30min': 30,
    '1hour': 60,
    '2hours': 120,
    '4hours': 240,
    '1day': 1440,
  };
  return map[timing] || 60;
};

/** Label for escalation timing */
export const escalationTimingLabel = (timing: EscalationTiming): string => {
  const map: Record<EscalationTiming, string> = {
    '30min': '30 minutes',
    '1hour': '1 hour',
    '2hours': '2 hours',
    '4hours': '4 hours',
    '1day': '1 day',
  };
  return map[timing] || timing;
};

export interface EscalationAlert {
  task: TodoItem;
  minutesUntilDeadline: number;
  isOverdue: boolean;
}

/**
 * Check all tasks for deadline escalation triggers
 */
export const checkDeadlineEscalations = (tasks: TodoItem[]): EscalationAlert[] => {
  const now = new Date();
  const alerts: EscalationAlert[] = [];

  for (const task of tasks) {
    if (task.completed || !task.dueDate || !task.escalationRule?.enabled) continue;

    const deadline = new Date(task.dueDate);
    const minutesUntil = differenceInMinutes(deadline, now);
    const escalationMinutes = task.escalationRule.customMinutes 
      || escalationTimingToMinutes(task.escalationRule.timing);

    // Check if we're within the escalation window
    if (minutesUntil <= escalationMinutes && minutesUntil > -1440) {
      // Avoid duplicate alerts: check lastTriggeredAt
      const lastTriggered = task.escalationRule.lastTriggeredAt
        ? new Date(task.escalationRule.lastTriggeredAt)
        : null;

      const repeatInterval = task.escalationRule.repeat 
        ? (task.escalationRule.repeatIntervalMinutes || 30) 
        : escalationMinutes;

      // Should fire if never triggered, or enough time has passed since last trigger
      const shouldFire = !lastTriggered 
        || differenceInMinutes(now, lastTriggered) >= repeatInterval;

      if (shouldFire) {
        alerts.push({
          task,
          minutesUntilDeadline: minutesUntil,
          isOverdue: minutesUntil <= 0,
        });
      }
    }
  }

  return alerts;
};

/**
 * Calculate the notification schedule date for an escalation
 */
export const getEscalationNotificationDate = (
  dueDate: Date,
  timing: EscalationTiming,
  customMinutes?: number
): Date => {
  const minutes = customMinutes || escalationTimingToMinutes(timing);
  return subMinutes(dueDate, minutes);
};
