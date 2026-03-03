/**
 * Task Order Storage - Persists custom task ordering to IndexedDB
 */

import { getSetting, setSetting } from './settingsStorage';

const TASK_ORDER_KEY = 'taskCustomOrder';

interface TaskOrderMap {
  [sectionId: string]: string[]; // sectionId -> array of taskIds in order
}

// In-memory cache for synchronous access
let orderCache: TaskOrderMap | null = null;

/**
 * Load custom task order (sync version using cache)
 */
export const loadTaskOrder = (): TaskOrderMap => {
  return orderCache || {};
};

/**
 * Initialize order cache from IndexedDB (call on app startup)
 */
export const initializeTaskOrder = async (): Promise<void> => {
  orderCache = await getSetting<TaskOrderMap>(TASK_ORDER_KEY, {});
};

/**
 * Save custom task order to IndexedDB
 */
export const saveTaskOrder = (order: TaskOrderMap): void => {
  orderCache = order;
  setSetting(TASK_ORDER_KEY, order);
};

/**
 * Update order for a specific section
 */
export const updateSectionOrder = (sectionId: string, taskIds: string[]): void => {
  const currentOrder = loadTaskOrder();
  currentOrder[sectionId] = taskIds;
  saveTaskOrder(currentOrder);
};

/**
 * Get order for a specific section
 */
export const getSectionOrder = (sectionId: string): string[] => {
  const order = loadTaskOrder();
  return order[sectionId] || [];
};

/**
 * Apply saved order to tasks within a section
 */
export const applyTaskOrder = <T extends { id: string }>(
  tasks: T[], 
  sectionId: string
): T[] => {
  const savedOrder = getSectionOrder(sectionId);
  if (savedOrder.length === 0) return tasks;
  
  const orderedTasks: T[] = [];
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  
  // First, add tasks in saved order
  for (const taskId of savedOrder) {
    const task = taskMap.get(taskId);
    if (task) {
      orderedTasks.push(task);
      taskMap.delete(taskId);
    }
  }
  
  // Then add any remaining tasks (new tasks not in saved order)
  for (const task of taskMap.values()) {
    orderedTasks.push(task);
  }
  
  return orderedTasks;
};

/**
 * Clear all saved task orders
 */
export const clearAllTaskOrders = (): void => {
  orderCache = {};
  setSetting(TASK_ORDER_KEY, {});
};

/**
 * Remove a specific task from all orders (when task is deleted)
 */
export const removeTaskFromOrders = (taskId: string): void => {
  const order = loadTaskOrder();
  let changed = false;
  
  for (const sectionId of Object.keys(order)) {
    const idx = order[sectionId].indexOf(taskId);
    if (idx !== -1) {
      order[sectionId].splice(idx, 1);
      changed = true;
    }
  }
  
  if (changed) {
    saveTaskOrder(order);
  }
};