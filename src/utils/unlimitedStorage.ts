// Unlimited storage utilities for IndexedDB media and task storage

const MEDIA_DB_NAME = 'nota-media-db';
const MEDIA_DB_VERSION = 1;
const MEDIA_STORE = 'media';

let mediaDb: IDBDatabase | null = null;

const openMediaDB = (): Promise<IDBDatabase> => {
  if (mediaDb) return Promise.resolve(mediaDb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(MEDIA_DB_NAME, MEDIA_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        db.createObjectStore(MEDIA_STORE);
      }
    };
    req.onsuccess = () => { mediaDb = req.result; resolve(mediaDb); };
    req.onerror = () => reject(req.error);
  });
};

export const requestUnlimitedStorage = async (): Promise<boolean> => {
  try {
    if (navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {}
  return false;
};

export const storeLargeMedia = async (key: string, data: Blob | ArrayBuffer | string, _type?: string): Promise<void> => {
  const db = await openMediaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    tx.objectStore(MEDIA_STORE).put(data, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const retrieveLargeMedia = async (key: string): Promise<string | null> => {
  const db = await openMediaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readonly');
    const req = tx.objectStore(MEDIA_STORE).get(key);
    req.onsuccess = () => resolve((req.result as string) ?? null);
    req.onerror = () => reject(req.error);
  });
};

export const deleteLargeMedia = async (key: string): Promise<void> => {
  const db = await openMediaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    tx.objectStore(MEDIA_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getStorageStats = async (): Promise<{ used: number; available: number; quota: number; persistent: boolean }> => {
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      const persistent = navigator.storage?.persist ? await navigator.storage.persisted() : false;
      return { used: est.usage || 0, available: (est.quota || 0) - (est.usage || 0), quota: est.quota || 0, persistent };
    }
  } catch {}
  return { used: 0, available: 0, quota: 0, persistent: false };
};

export const clearMemoryCaches = (): void => {
  // No-op for simplified version
};

export class LRUCache<K, V> {
  private map = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const val = this.map.get(key);
    if (val !== undefined) {
      this.map.delete(key);
      this.map.set(key, val);
    }
    return val;
  }

  set(key: K, value: V): void {
    this.map.delete(key);
    if (this.map.size >= this.maxSize) {
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) this.map.delete(firstKey);
    }
    this.map.set(key, value);
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}
