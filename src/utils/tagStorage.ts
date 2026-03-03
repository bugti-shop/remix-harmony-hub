// Global Tags/Labels system with IndexedDB persistence
// Cross-cutting tags that work across both notes and tasks

export interface AppTag {
  id: string;
  name: string;
  color: string; // HSL color string
  icon?: string; // emoji icon
  createdAt: Date;
  usageCount: number;
}

const DB_NAME = 'nota-tags-db';
const DB_VERSION = 1;
const STORE_NAME = 'tags';

let db: IDBDatabase | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      db.onclose = () => { db = null; };
      resolve(db);
    };
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

// Default tag colors (HSL)
export const TAG_COLORS = [
  '220 85% 59%',   // Blue (primary)
  '0 84% 60%',     // Red
  '142 70% 45%',   // Green
  '280 65% 60%',   // Purple
  '25 95% 53%',    // Orange
  '330 80% 60%',   // Pink
  '180 60% 45%',   // Teal
  '45 90% 50%',    // Amber
  '200 80% 50%',   // Sky
  '350 65% 50%',   // Rose
];

export const getAllTags = async (): Promise<AppTag[]> => {
  try {
    const database = await openDB();
    return new Promise((resolve) => {
      const tx = database.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const tags = (request.result || []).map((t: any) => ({
          ...t,
          createdAt: new Date(t.createdAt),
        }));
        // Sort by usage count (most used first)
        tags.sort((a: AppTag, b: AppTag) => b.usageCount - a.usageCount);
        resolve(tags);
      };
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
};

export const saveTag = async (tag: AppTag): Promise<void> => {
  try {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({ ...tag, createdAt: tag.createdAt.toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('Failed to save tag:', e);
  }
};

export const deleteTag = async (tagId: string): Promise<void> => {
  try {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(tagId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('Failed to delete tag:', e);
  }
};

export const incrementTagUsage = async (tagId: string): Promise<void> => {
  try {
    const tags = await getAllTags();
    const tag = tags.find(t => t.id === tagId);
    if (tag) {
      tag.usageCount++;
      await saveTag(tag);
    }
  } catch (e) {
    console.error('Failed to increment tag usage:', e);
  }
};

export const createTag = async (name: string, color: string, icon?: string): Promise<AppTag> => {
  const tag: AppTag = {
    id: `tag_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    color,
    icon,
    createdAt: new Date(),
    usageCount: 0,
  };
  await saveTag(tag);
  return tag;
};
