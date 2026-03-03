// IndexedDB storage for task media (images + voice recordings)
// Uses IndexedDB with persistent storage for unlimited capacity on native devices
// Optimized for handling unlimited media with chunked storage and LRU caching

import { 
  storeLargeMedia, 
  retrieveLargeMedia, 
  deleteLargeMedia, 
  requestUnlimitedStorage,
  getStorageStats,
  clearMemoryCaches,
  LRUCache
} from './unlimitedStorage';

export type TaskMediaKind = 'image' | 'audio' | 'file';

export interface TaskAttachment {
  id: string;
  name: string;
  type: string; // MIME type
  size: number;
  ref: string; // idb:file:id reference
}

// LRU cache for resolved URLs with memory limit
const cache = new LRUCache<string, string>(50);

// Track pending saves to prevent duplicate operations
const pendingSaves = new Set<string>();

// ============ Persistent Storage (Unlimited Quota) ============

// Request persistent storage for unlimited quota (removes browser restrictions)
const requestPersistentStorage = async (): Promise<boolean> => {
  return requestUnlimitedStorage();
};

// Initialize persistent storage on module load for unlimited capacity
requestPersistentStorage().then(granted => {
  if (granted) {
    console.log('Persistent storage granted - unlimited capacity available');
  }
});

// ============ Reference Helpers ============

export const makeTaskMediaRef = (kind: TaskMediaKind, id: string) => `idb:${kind}:${id}`;

export const parseTaskMediaRef = (
  ref: string
): { kind: TaskMediaKind; id: string } | null => {
  // Support both idb: and legacy fs: refs
  if (!ref.startsWith('idb:') && !ref.startsWith('fs:')) return null;
  const parts = ref.split(':');
  if (parts.length < 3) return null;
  const kind = parts[1] as TaskMediaKind;
  if (kind !== 'image' && kind !== 'audio' && kind !== 'file') return null;
  const id = parts.slice(2).join(':');
  if (!id) return null;
  return { kind, id };
};

export const isTaskMediaRef = (ref?: string | null) => {
  if (!ref) return false;
  return !!parseTaskMediaRef(ref);
};

// ============ IndexedDB with Chunked Storage for Large Media ============

const DB_NAME = 'nota-task-media-db';
const DB_VERSION = 3; // Bumped for file store
const STORES: Record<TaskMediaKind, string> = {
  image: 'task-images',
  audio: 'task-audio',
  file: 'task-files',
};

interface MediaRecord {
  id: string;
  dataUrl: string;
  createdAt: string;
  size?: number;
}

// Use connection pooling for better performance
let dbConnection: IDBDatabase | null = null;
let dbConnectionPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (dbConnection) {
    return Promise.resolve(dbConnection);
  }
  
  if (dbConnectionPromise) {
    return dbConnectionPromise;
  }

  dbConnectionPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbConnectionPromise = null;
      reject(request.error);
    };
    
    request.onsuccess = () => {
      dbConnection = request.result;
      
      // Handle connection close
      dbConnection.onclose = () => {
        dbConnection = null;
        dbConnectionPromise = null;
      };
      
      resolve(dbConnection);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      (Object.keys(STORES) as TaskMediaKind[]).forEach((kind) => {
        const storeName = STORES[kind];
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      });
    };
  });

  return dbConnectionPromise;
};

// Determine if data should use chunked storage (> 1MB)
const shouldUseChunkedStorage = (dataUrl: string): boolean => {
  return dataUrl.length > 1024 * 1024; // > 1MB
};

const saveToIndexedDB = async (kind: TaskMediaKind, id: string, dataUrl: string): Promise<void> => {
  const fullId = `${kind}_${id}`;
  
  // Prevent duplicate saves
  if (pendingSaves.has(fullId)) {
    return;
  }
  pendingSaves.add(fullId);

  try {
    // Use chunked storage for large media
    if (shouldUseChunkedStorage(dataUrl)) {
      await storeLargeMedia(fullId, dataUrl, kind === 'image' ? 'image' : 'audio');
      return;
    }

    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES[kind], 'readwrite');
      const store = transaction.objectStore(STORES[kind]);

      const record: MediaRecord = {
        id,
        dataUrl,
        createdAt: new Date().toISOString(),
        size: dataUrl.length,
      };

      const request = store.put(record);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } finally {
    pendingSaves.delete(fullId);
  }
};

const getFromIndexedDB = async (kind: TaskMediaKind, id: string): Promise<string | null> => {
  const fullId = `${kind}_${id}`;
  
  // Try chunked storage first
  const chunkedData = await retrieveLargeMedia(fullId);
  if (chunkedData) {
    return chunkedData;
  }

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES[kind], 'readonly');
      const store = transaction.objectStore(STORES[kind]);

      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const record = request.result as MediaRecord | undefined;
        resolve(record?.dataUrl || null);
      };
    });
  } catch (e) {
    console.error('Failed to get from IndexedDB:', e);
    return null;
  }
};

const deleteFromIndexedDB = async (kind: TaskMediaKind, id: string): Promise<void> => {
  const fullId = `${kind}_${id}`;
  
  // Delete from chunked storage
  await deleteLargeMedia(fullId);

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES[kind], 'readwrite');
      const store = transaction.objectStore(STORES[kind]);

      const request = store.delete(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (e) {
    console.error('Failed to delete from IndexedDB:', e);
  }
};

// ============ Public API (Uses IndexedDB for all platforms) ============

export const saveTaskMedia = async (kind: TaskMediaKind, id: string, dataUrl: string): Promise<void> => {
  await saveToIndexedDB(kind, id, dataUrl);
  cache.set(makeTaskMediaRef(kind, id), dataUrl);
};

export const getTaskMedia = async (kind: TaskMediaKind, id: string): Promise<string | null> => {
  const ref = makeTaskMediaRef(kind, id);
  const cached = cache.get(ref);
  if (cached) return cached;

  const dataUrl = await getFromIndexedDB(kind, id);

  if (dataUrl) {
    cache.set(ref, dataUrl);
  }
  return dataUrl;
};

export const deleteTaskMedia = async (kind: TaskMediaKind, id: string): Promise<void> => {
  await deleteFromIndexedDB(kind, id);
  cache.delete(makeTaskMediaRef(kind, id));
};

export const resolveTaskMediaUrl = async (refOrUrl: string): Promise<string> => {
  const parsed = parseTaskMediaRef(refOrUrl);
  if (!parsed) return refOrUrl;

  const dataUrl = await getTaskMedia(parsed.kind, parsed.id);
  return dataUrl || '';
};

// ============ Storage Info ============

export const getStorageInfo = async (): Promise<{ used: number; available: number; persistent: boolean } | null> => {
  const stats = await getStorageStats();
  return {
    used: stats.used,
    available: stats.available,
    persistent: stats.persistent
  };
};

// Force request persistent storage (call during app init if needed)
export const ensureUnlimitedStorage = requestPersistentStorage;

// Clear memory caches when memory is low
export const clearMediaCaches = (): void => {
  cache.clear();
  clearMemoryCaches();
};
