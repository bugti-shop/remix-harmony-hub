import { TodoItem } from '@/types/note';
import { differenceInDays } from 'date-fns';
import { getSetting, setSetting } from '@/utils/settingsStorage';

const ARCHIVED_TASKS_KEY = 'archivedTasks';

/**
 * Gets the completion date of a task.
 */
const getTaskCompletionDate = (task: TodoItem): Date => {
  if (task.completedAt) return new Date(task.completedAt);
  if (task.dueDate) return new Date(task.dueDate);
  const timestamp = parseInt(task.id.split('-')[0]) || Date.now();
  return new Date(timestamp);
};

/**
 * Archives completed tasks older than the specified number of days.
 * Instead of deleting, moves them to a separate archived storage.
 */
export const archiveCompletedTasks = async (
  tasks: TodoItem[],
  daysThreshold: number = 3
): Promise<{ activeTasks: TodoItem[]; archivedCount: number }> => {
  const now = new Date();

  const toArchive: TodoItem[] = [];
  const activeTasks: TodoItem[] = [];

  for (const task of tasks) {
    if (!task.completed) {
      activeTasks.push(task);
      continue;
    }

    const completionDate = getTaskCompletionDate(task);
    const daysSinceCompletion = differenceInDays(now, completionDate);

    if (daysSinceCompletion >= daysThreshold) {
      toArchive.push({ ...task, modifiedAt: new Date() });
    } else {
      activeTasks.push(task);
    }
  }

  if (toArchive.length > 0) {
    const existing = await loadArchivedTasks();
    const existingIds = new Set(existing.map(t => t.id));
    const newArchived = toArchive.filter(t => !existingIds.has(t.id));
    await setSetting(ARCHIVED_TASKS_KEY, [...newArchived, ...existing]);
  }

  return { activeTasks, archivedCount: toArchive.length };
};

/**
 * Load all archived tasks from storage.
 */
export const loadArchivedTasks = async (): Promise<TodoItem[]> => {
  const raw = await getSetting<any[]>(ARCHIVED_TASKS_KEY, []);
  return raw.map(hydrate);
};

/**
 * Unarchive tasks — moves them back to active tasks.
 * Returns the unarchived tasks.
 */
export const unarchiveTasks = async (taskIds: string[]): Promise<TodoItem[]> => {
  const archived = await loadArchivedTasks();
  const idSet = new Set(taskIds);
  const toRestore = archived.filter(t => idSet.has(t.id)).map(t => ({ ...t, completed: false, completedAt: undefined }));
  const remaining = archived.filter(t => !idSet.has(t.id));
  await setSetting(ARCHIVED_TASKS_KEY, remaining);
  return toRestore;
};

/**
 * Permanently delete archived tasks.
 */
export const deleteArchivedTasks = async (taskIds: string[]): Promise<void> => {
  const archived = await loadArchivedTasks();
  const idSet = new Set(taskIds);
  await setSetting(ARCHIVED_TASKS_KEY, archived.filter(t => !idSet.has(t.id)));
};

/**
 * Clear all archived tasks.
 */
export const clearAllArchivedTasks = async (): Promise<number> => {
  const archived = await loadArchivedTasks();
  await setSetting(ARCHIVED_TASKS_KEY, []);
  return archived.length;
};

/**
 * Manually archive specific tasks by ID.
 */
export const archiveTasksById = async (
  tasks: TodoItem[],
  taskIds: string[]
): Promise<{ activeTasks: TodoItem[]; archivedCount: number }> => {
  const idSet = new Set(taskIds);
  const toArchive = tasks.filter(t => idSet.has(t.id));
  const activeTasks = tasks.filter(t => !idSet.has(t.id));

  if (toArchive.length > 0) {
    const existing = await loadArchivedTasks();
    const existingIds = new Set(existing.map(t => t.id));
    const newArchived = toArchive.filter(t => !existingIds.has(t.id));
    await setSetting(ARCHIVED_TASKS_KEY, [...newArchived, ...existing]);
  }

  return { activeTasks, archivedCount: toArchive.length };
};

// Hydrate dates from JSON
const hydrate = (raw: any): TodoItem => ({
  ...raw,
  dueDate: raw?.dueDate ? new Date(raw.dueDate) : undefined,
  reminderTime: raw?.reminderTime ? new Date(raw.reminderTime) : undefined,
  completedAt: raw?.completedAt ? new Date(raw.completedAt) : undefined,
  createdAt: raw?.createdAt ? new Date(raw.createdAt) : undefined,
  modifiedAt: raw?.modifiedAt ? new Date(raw.modifiedAt) : undefined,
  voiceRecording: raw?.voiceRecording
    ? { ...raw.voiceRecording, timestamp: raw.voiceRecording.timestamp ? new Date(raw.voiceRecording.timestamp) : new Date() }
    : undefined,
  subtasks: Array.isArray(raw?.subtasks) ? raw.subtasks.map(hydrate) : undefined,
});

// Legacy compat — re-export under old name for any missed references
export const cleanupCompletedTasks = async (
  tasks: TodoItem[],
  daysThreshold: number = 3
) => {
  const { activeTasks, archivedCount } = await archiveCompletedTasks(tasks, daysThreshold);
  return { cleanedTasks: activeTasks, deletedCount: archivedCount };
};

export const getTasksPendingDeletion = (
  tasks: TodoItem[],
  daysThreshold: number = 3
): { count: number; tasks: TodoItem[] } => {
  const now = new Date();
  const pendingTasks = tasks.filter(task => {
    if (!task.completed) return false;
    const completionDate = getTaskCompletionDate(task);
    const daysSinceCompletion = differenceInDays(now, completionDate);
    return daysSinceCompletion >= daysThreshold - 1 && daysSinceCompletion < daysThreshold;
  });
  return { count: pendingTasks.length, tasks: pendingTasks };
};
