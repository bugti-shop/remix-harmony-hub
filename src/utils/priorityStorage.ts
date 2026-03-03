import { getSetting, setSetting } from './settingsStorage';

export interface CustomPriority {
  id: string;
  name: string;
  color: string;
  order: number;
  isDefault: boolean; // true for built-in priorities (high, medium, low, none)
}

// Default priorities that come with the app
export const DEFAULT_PRIORITIES: CustomPriority[] = [
  { id: 'high', name: 'High', color: '#EF4444', order: 0, isDefault: true },
  { id: 'medium', name: 'Medium', color: '#F97316', order: 1, isDefault: true },
  { id: 'low', name: 'Low', color: '#22C55E', order: 2, isDefault: true },
  { id: 'none', name: 'None', color: '#6B7280', order: 3, isDefault: true },
];

const STORAGE_KEY = 'customPriorities';

export const getPriorities = async (): Promise<CustomPriority[]> => {
  const saved = await getSetting<CustomPriority[] | null>(STORAGE_KEY, null);
  if (saved && saved.length > 0) {
    return saved;
  }
  return DEFAULT_PRIORITIES;
};

export const savePriorities = async (priorities: CustomPriority[]): Promise<void> => {
  // Prevent renaming existing priority IDs: only colors/order are mutable.
  const existing = await getPriorities();
  const existingNames = new Map(existing.map(p => [p.id, p.name] as const));

  const normalized = priorities.map(p =>
    existingNames.has(p.id) ? { ...p, name: existingNames.get(p.id)! } : p
  );

  await setSetting(STORAGE_KEY, normalized);
  // Dispatch event to notify components
  window.dispatchEvent(new CustomEvent('prioritiesChanged', { detail: normalized }));
};

export const addPriority = async (name: string, color: string): Promise<CustomPriority> => {
  const priorities = await getPriorities();
  const newPriority: CustomPriority = {
    id: `custom_${Date.now()}`,
    name,
    color,
    order: priorities.length,
    isDefault: false,
  };
  const updated = [...priorities, newPriority];
  await savePriorities(updated);
  return newPriority;
};

export const updatePriority = async (
  id: string,
  updates: Partial<Omit<CustomPriority, 'id' | 'isDefault'>>
): Promise<void> => {
  // Disallow renaming - ignore 'name' in updates
  const safeUpdates: Partial<Omit<CustomPriority, 'id' | 'isDefault'>> = { ...updates };
  delete (safeUpdates as any).name;

  const priorities = await getPriorities();
  const updated = priorities.map(p =>
    p.id === id ? { ...p, ...safeUpdates } : p
  );
  await savePriorities(updated);
};

export const deletePriority = async (id: string): Promise<void> => {
  const priorities = await getPriorities();
  // Only allow deleting custom priorities
  const priority = priorities.find(p => p.id === id);
  if (priority?.isDefault) {
    throw new Error('Cannot delete default priorities');
  }
  const updated = priorities.filter(p => p.id !== id);
  await savePriorities(updated);
};

export const reorderPriorities = async (priorities: CustomPriority[]): Promise<void> => {
  const updated = priorities.map((p, index) => ({ ...p, order: index }));
  await savePriorities(updated);
};

// Helper to get priority color by ID
export const getPriorityColorById = (priorities: CustomPriority[], id: string): string => {
  const priority = priorities.find(p => p.id === id);
  return priority?.color || '#6B7280';
};

// Helper to get priority name by ID
export const getPriorityNameById = (priorities: CustomPriority[], id: string): string => {
  const priority = priorities.find(p => p.id === id);
  return priority?.name || 'None';
};
