import { TodoItem } from '@/types/note';
import {
  isTaskMediaRef,
  makeTaskMediaRef,
  resolveTaskMediaUrl,
  saveTaskMedia,
} from '@/utils/taskMediaStorage';
import { compressImage, isCompressibleImage } from '@/utils/imageCompression';
import { 
  loadTasksFromDB, 
  saveTasksToDB, 
  migrateFromLocalStorage 
} from '@/utils/taskStorage';

const TODO_ITEMS_KEY = 'todoItems';

const looksLikeDataUrl = (value: string) => value.startsWith('data:');

const hydrateItem = (raw: any): TodoItem => {
  const hydrated: TodoItem = {
    ...raw,
    dueDate: raw?.dueDate ? new Date(raw.dueDate) : undefined,
    reminderTime: raw?.reminderTime ? new Date(raw.reminderTime) : undefined,
    voiceRecording: raw?.voiceRecording
      ? {
          ...raw.voiceRecording,
          timestamp: raw.voiceRecording.timestamp ? new Date(raw.voiceRecording.timestamp) : new Date(),
        }
      : undefined,
    subtasks: Array.isArray(raw?.subtasks) ? raw.subtasks.map(hydrateItem) : undefined,
  };
  return hydrated;
};

// Migration flag to track if we've attempted migration
let migrationAttempted = false;

export const loadTodoItems = async (): Promise<TodoItem[]> => {
  // First, attempt migration from localStorage to IndexedDB (once)
  if (!migrationAttempted) {
    migrationAttempted = true;
    try {
      const { migrated, count } = await migrateFromLocalStorage();
      if (migrated) {
        console.log(`Migrated ${count} tasks to IndexedDB for better performance`);
      }
    } catch (e) {
      console.warn('Migration check failed:', e);
    }
  }

  try {
    // Load from IndexedDB (primary storage)
    const items = await loadTasksFromDB();
    
    // Offload any base64 media to IndexedDB
    const { items: migrated, changed } = await offloadTodoItemsMedia(items);
    if (changed) {
      await saveTasksToDB(migrated);
    }
    return migrated;
  } catch (e) {
    console.error('Failed to load todoItems:', e);
    return [];
  }
};

// Debounce save operations for performance
let saveTimeout: NodeJS.Timeout | null = null;
let pendingSaveItems: TodoItem[] | null = null;

export const saveTodoItems = async (
  items: TodoItem[]
): Promise<{ items: TodoItem[]; changed: boolean; persisted: boolean }> => {
  const { items: migrated, changed } = await offloadTodoItemsMedia(items);

  // Debounce saves for performance (especially with 600k+ items)
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  
  pendingSaveItems = migrated;
  
  return new Promise((resolve) => {
    saveTimeout = setTimeout(async () => {
      try {
        const itemsToSave = pendingSaveItems || migrated;
        await saveTasksToDB(itemsToSave);
        resolve({ items: itemsToSave, changed, persisted: true });
      } catch (e) {
        console.error('Failed to save tasks:', e);
        resolve({ items: migrated, changed, persisted: false });
      }
    }, 100); // 100ms debounce
  });
};

export const offloadTodoItemsMedia = async (
  items: TodoItem[]
): Promise<{ items: TodoItem[]; changed: boolean }> => {
  let changed = false;

  const offloadOne = async (item: TodoItem): Promise<TodoItem> => {
    let next: TodoItem = item;

    // Image - compress before saving
    if (item.imageUrl && looksLikeDataUrl(item.imageUrl) && !isTaskMediaRef(item.imageUrl)) {
      const id = `task-${item.id}-img`;
      let imageData = item.imageUrl;
      
      // Compress if it's an image
      if (isCompressibleImage(imageData)) {
        try {
          imageData = await compressImage(imageData, { quality: 0.7, maxWidth: 1920, maxHeight: 1920 });
        } catch (e) {
          console.warn('Image compression failed, saving original:', e);
        }
      }
      
      await saveTaskMedia('image', id, imageData);
      next = { ...next, imageUrl: makeTaskMediaRef('image', id) };
      changed = true;
    }

    // Voice recording
    if (item.voiceRecording?.audioUrl && looksLikeDataUrl(item.voiceRecording.audioUrl) && !isTaskMediaRef(item.voiceRecording.audioUrl)) {
      const id = `task-${item.id}-audio`;
      await saveTaskMedia('audio', id, item.voiceRecording.audioUrl);
      next = {
        ...next,
        voiceRecording: {
          ...item.voiceRecording,
          audioUrl: makeTaskMediaRef('audio', id),
        },
      };
      changed = true;
    }

    if (next.subtasks && next.subtasks.length > 0) {
      const newSubtasks = await Promise.all(next.subtasks.map(offloadOne));
      // shallow compare
      if (newSubtasks.some((st, idx) => st !== next.subtasks![idx])) {
        next = { ...next, subtasks: newSubtasks };
        changed = true;
      }
    }

    return next;
  };

  const migrated = await Promise.all(items.map(offloadOne));
  return { items: migrated, changed };
};

// Re-export for convenience in UI (play/open)
export { resolveTaskMediaUrl };
