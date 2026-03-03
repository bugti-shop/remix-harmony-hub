/**
 * Recurring Task Intelligence
 * Skip/defer, per-task streak tracking, and auto-adjust based on completion patterns
 */

import { TodoItem, RecurringStats, RecurringCompletionEntry } from '@/types/note';
import { getNextOccurrence } from './recurringTasks';
import { format, startOfDay, isSameDay, differenceInDays, getHours } from 'date-fns';

const MAX_HISTORY_ENTRIES = 90; // Keep 90 days of history

/**
 * Initialize recurring stats for a task
 */
export const initRecurringStats = (): RecurringStats => ({
  completionHistory: [],
  currentStreak: 0,
  bestStreak: 0,
  totalCompleted: 0,
  totalSkipped: 0,
  totalDeferred: 0,
});

/**
 * Record a completion for a recurring task
 */
export const recordRecurringCompletion = (task: TodoItem): RecurringStats => {
  const stats = task.recurringStats || initRecurringStats();
  const today = format(new Date(), 'yyyy-MM-dd');
  const hour = getHours(new Date());

  // Add completion entry
  const entry: RecurringCompletionEntry = {
    date: today,
    completed: true,
  };

  const history = [...stats.completionHistory.filter(e => e.date !== today), entry]
    .slice(-MAX_HISTORY_ENTRIES);

  // Calculate streak
  const { currentStreak, bestStreak } = calculateStreak(history);

  // Calculate average completion hour
  const completedEntries = history.filter(e => e.completed);
  const avgHour = stats.averageCompletionHour
    ? Math.round((stats.averageCompletionHour * (completedEntries.length - 1) + hour) / completedEntries.length)
    : hour;

  return {
    completionHistory: history,
    currentStreak,
    bestStreak: Math.max(bestStreak, stats.bestStreak),
    totalCompleted: stats.totalCompleted + 1,
    totalSkipped: stats.totalSkipped,
    totalDeferred: stats.totalDeferred,
    averageCompletionHour: avgHour,
    lastCompletedAt: new Date(),
    suggestedTimeAdjustment: generateTimeSuggestion(history, avgHour),
  };
};

/**
 * Record a skip for a recurring task and advance to next occurrence
 */
export const skipRecurringOccurrence = (task: TodoItem): TodoItem | null => {
  if (!task.repeatType || task.repeatType === 'none') return null;
  if (!task.dueDate) return null;

  const stats = task.recurringStats || initRecurringStats();
  const today = format(new Date(), 'yyyy-MM-dd');

  const entry: RecurringCompletionEntry = {
    date: today,
    completed: false,
    skipped: true,
  };

  const history = [...stats.completionHistory.filter(e => e.date !== today), entry]
    .slice(-MAX_HISTORY_ENTRIES);

  const { currentStreak, bestStreak } = calculateStreak(history);

  // Get next occurrence
  const currentDueDate = new Date(task.dueDate);
  const nextDate = getNextOccurrence(
    currentDueDate,
    task.repeatType,
    task.repeatDays,
    task.advancedRepeat,
    true
  );

  if (!nextDate) return null;

  // Calculate new reminder time
  let newReminderTime: Date | undefined;
  if (task.reminderTime && task.dueDate) {
    const offset = new Date(task.reminderTime).getTime() - new Date(task.dueDate).getTime();
    newReminderTime = new Date(nextDate.getTime() + offset);
  }

  return {
    ...task,
    dueDate: nextDate,
    reminderTime: newReminderTime,
    recurringStats: {
      ...stats,
      completionHistory: history,
      currentStreak: 0, // Skip breaks streak
      bestStreak: Math.max(bestStreak, stats.bestStreak),
      totalSkipped: stats.totalSkipped + 1,
      suggestedTimeAdjustment: generateTimeSuggestion(history, stats.averageCompletionHour),
    },
  };
};

/**
 * Defer a recurring task to a specific date
 */
export const deferRecurringOccurrence = (task: TodoItem, deferTo: Date): TodoItem | null => {
  if (!task.repeatType || task.repeatType === 'none') return null;

  const stats = task.recurringStats || initRecurringStats();
  const today = format(new Date(), 'yyyy-MM-dd');

  const entry: RecurringCompletionEntry = {
    date: today,
    completed: false,
    deferred: true,
    deferredTo: format(deferTo, 'yyyy-MM-dd'),
  };

  const history = [...stats.completionHistory.filter(e => e.date !== today), entry]
    .slice(-MAX_HISTORY_ENTRIES);

  // Calculate new reminder time
  let newReminderTime: Date | undefined;
  if (task.reminderTime && task.dueDate) {
    const offset = new Date(task.reminderTime).getTime() - new Date(task.dueDate).getTime();
    newReminderTime = new Date(deferTo.getTime() + offset);
  }

  return {
    ...task,
    dueDate: deferTo,
    reminderTime: newReminderTime,
    recurringStats: {
      ...stats,
      completionHistory: history,
      currentStreak: stats.currentStreak, // Defer doesn't break streak
      bestStreak: stats.bestStreak,
      totalDeferred: stats.totalDeferred + 1,
    },
  };
};

/**
 * Calculate streak from completion history
 */
const calculateStreak = (history: RecurringCompletionEntry[]): { currentStreak: number; bestStreak: number } => {
  if (history.length === 0) return { currentStreak: 0, bestStreak: 0 };

  // Sort by date descending
  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));

  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;

  for (const entry of sorted) {
    if (entry.completed) {
      tempStreak++;
      if (tempStreak === currentStreak + 1) {
        currentStreak = tempStreak;
      }
      bestStreak = Math.max(bestStreak, tempStreak);
    } else if (entry.skipped) {
      // Skip breaks streak
      if (currentStreak === tempStreak) {
        // We were still counting current streak
      }
      tempStreak = 0;
    } else {
      tempStreak = 0;
    }
  }

  // Recalculate current streak from most recent
  currentStreak = 0;
  for (const entry of sorted) {
    if (entry.completed) {
      currentStreak++;
    } else if (entry.deferred) {
      // Defer doesn't break streak, just skip this entry
      continue;
    } else {
      break;
    }
  }

  return { currentStreak, bestStreak };
};

/**
 * Generate a time adjustment suggestion based on completion patterns
 */
const generateTimeSuggestion = (
  history: RecurringCompletionEntry[],
  avgHour?: number
): string | undefined => {
  if (history.length < 7) return undefined; // Need at least a week of data

  const completed = history.filter(e => e.completed);
  const skipped = history.filter(e => e.skipped);
  const total = history.length;

  const completionRate = completed.length / total;
  const skipRate = skipped.length / total;

  // Low completion rate suggestion
  if (completionRate < 0.4 && total >= 14) {
    return `Only ${Math.round(completionRate * 100)}% completion rate. Consider reducing frequency or removing this recurring task.`;
  }

  // High skip rate
  if (skipRate > 0.3) {
    return `You skip this ${Math.round(skipRate * 100)}% of the time. Consider changing to a less frequent schedule.`;
  }

  // Time-based suggestion
  if (avgHour !== undefined) {
    if (avgHour < 10) {
      return `You usually complete this in the morning (avg ${avgHour}:00). Keep it as a morning task!`;
    } else if (avgHour > 20) {
      return `You usually complete this late at night (avg ${avgHour}:00). Consider moving to an earlier time.`;
    }
  }

  // Excellent performance
  if (completionRate > 0.9 && total >= 14) {
    return `🔥 ${Math.round(completionRate * 100)}% completion rate! You're crushing this habit.`;
  }

  return undefined;
};

/**
 * Get completion rate for a recurring task
 */
export const getCompletionRate = (stats: RecurringStats | undefined, days: number = 30): number => {
  if (!stats || stats.completionHistory.length === 0) return 0;

  const cutoff = format(
    new Date(Date.now() - days * 24 * 60 * 60 * 1000),
    'yyyy-MM-dd'
  );

  const recent = stats.completionHistory.filter(e => e.date >= cutoff);
  if (recent.length === 0) return 0;

  return recent.filter(e => e.completed).length / recent.length;
};

/**
 * Get weekly completion data for visualization
 */
export const getWeeklyCompletionData = (
  stats: RecurringStats | undefined
): Array<{ day: string; completed: boolean; skipped: boolean; deferred: boolean }> => {
  if (!stats) return [];

  const days: Array<{ day: string; completed: boolean; skipped: boolean; deferred: boolean }> = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const entry = stats.completionHistory.find(e => e.date === dateStr);

    days.push({
      day: dayNames[date.getDay()],
      completed: entry?.completed || false,
      skipped: entry?.skipped || false,
      deferred: entry?.deferred || false,
    });
  }

  return days;
};
