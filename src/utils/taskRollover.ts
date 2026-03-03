/**
 * Automatic Repeat Task Rollover
 * When scheduled time passes without task completion, automatically switch to next occurrence
 */

import { TodoItem } from '@/types/note';
import { getNextOccurrence } from './recurringTasks';
import { isBefore, startOfDay } from 'date-fns';

/**
 * Check if a task's due date has passed and it should be rolled over
 */
export const shouldRolloverTask = (task: TodoItem): boolean => {
  if (task.completed) return false;
  if (!task.dueDate) return false;
  if (!task.repeatType || task.repeatType === 'none') return false;

  const now = new Date();
  const dueDate = new Date(task.dueDate);
  
  // Task is overdue and has a repeat pattern
  return isBefore(dueDate, now);
};

/**
 * Rollover a single task to its next occurrence
 */
export const rolloverTask = (task: TodoItem): TodoItem | null => {
  if (!shouldRolloverTask(task)) return null;

  const currentDueDate = new Date(task.dueDate!);
  
  // Get next occurrence with preserved time
  const nextDate = getNextOccurrence(
    currentDueDate,
    task.repeatType!,
    task.repeatDays,
    task.advancedRepeat,
    true // Preserve time
  );

  if (!nextDate) return null;

  // Make sure next date is in the future
  const now = new Date();
  let adjustedNextDate = nextDate;
  
  // Keep advancing until we get a future date
  while (isBefore(adjustedNextDate, now)) {
    const furtherNext = getNextOccurrence(
      adjustedNextDate,
      task.repeatType!,
      task.repeatDays,
      task.advancedRepeat,
      true
    );
    if (!furtherNext) break;
    adjustedNextDate = furtherNext;
  }

  // Calculate new reminder time if exists
  let newReminderTime: Date | undefined;
  if (task.reminderTime && task.dueDate) {
    const reminderOffset = new Date(task.reminderTime).getTime() - new Date(task.dueDate).getTime();
    newReminderTime = new Date(adjustedNextDate.getTime() + reminderOffset);
  }

  return {
    ...task,
    dueDate: adjustedNextDate,
    reminderTime: newReminderTime,
  };
};

/**
 * Process all tasks and rollover any that need it
 * Returns updated tasks array and count of rolled over tasks
 */
export const processTaskRollovers = (tasks: TodoItem[]): { tasks: TodoItem[]; rolledOverCount: number } => {
  let rolledOverCount = 0;
  
  const updatedTasks = tasks.map(task => {
    const rolledOver = rolloverTask(task);
    if (rolledOver) {
      rolledOverCount++;
      return rolledOver;
    }
    return task;
  });

  return { tasks: updatedTasks, rolledOverCount };
};

/**
 * Check and process task rollovers periodically
 * Call this on app startup and periodically
 */
export const checkAndRolloverTasks = async (
  tasks: TodoItem[],
  onUpdate: (tasks: TodoItem[]) => Promise<void>
): Promise<number> => {
  const { tasks: updatedTasks, rolledOverCount } = processTaskRollovers(tasks);
  
  if (rolledOverCount > 0) {
    await onUpdate(updatedTasks);
  }
  
  return rolledOverCount;
};
