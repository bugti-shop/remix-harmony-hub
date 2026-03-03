// Unified IndexedDB storage for all app settings (replacing localStorage)

const DB_NAME = 'nota-settings-db';
const DB_VERSION = 1;
const STORE_NAME = 'settings';

let db: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase> | null = null;

const isDbHealthy = (database: IDBDatabase): boolean => {
  try {
    if (!database.objectStoreNames.contains(STORE_NAME)) return false;
    const tx = database.transaction([STORE_NAME], 'readonly');
    tx.abort();
    return true;
  } catch {
    return false;
  }
};

const resetDb = () => {
  if (db) {
    try { db.close(); } catch {}
  }
  db = null;
  dbInitPromise = null;
};

const openDB = (): Promise<IDBDatabase> => {
  if (db && isDbHealthy(db)) return Promise.resolve(db);
  if (dbInitPromise) return dbInitPromise;

  if (db) resetDb();

  dbInitPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open settings database:', request.error);
      dbInitPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      db.onclose = () => { db = null; dbInitPromise = null; };
      db.onversionchange = () => { resetDb(); };
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
  });

  return dbInitPromise;
};

const withRetry = async <T>(operation: (database: IDBDatabase) => Promise<T>): Promise<T> => {
  try {
    const database = await openDB();
    return await operation(database);
  } catch (error) {
    console.warn('Settings IndexedDB operation failed, retrying...', error);
    resetDb();
    const database = await openDB();
    return await operation(database);
  }
};

// Core get/set functions
export const getSetting = async <T>(key: string, defaultValue: T): Promise<T> => {
  try {
    return await withRetry((database) => new Promise<T>((resolve) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result !== undefined ? (request.result.value as T) : defaultValue);
      };

      request.onerror = () => {
        console.error('Failed to get setting:', key, request.error);
        resolve(defaultValue);
      };
    }));
  } catch (error) {
    console.error('Error getting setting:', key, error);
    return defaultValue;
  }
};

export const setSetting = async <T>(key: string, value: T): Promise<void> => {
  try {
    await withRetry((database) => new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.put({ key, value });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    }));
  } catch (error) {
    console.error('Error saving setting:', key, error);
  }
};

export const removeSetting = async (key: string): Promise<void> => {
  try {
    await withRetry((database) => new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.delete(key);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    }));
  } catch (error) {
    console.error('Error removing setting:', key, error);
  }
};

export const getAllSettings = async (): Promise<Record<string, any>> => {
  try {
    return await withRetry((database) => new Promise<Record<string, any>>((resolve) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const result: Record<string, any> = {};
        request.result.forEach((item: { key: string; value: any }) => {
          result[item.key] = item.value;
        });
        resolve(result);
      };

      request.onerror = () => {
        console.error('Failed to get all settings:', request.error);
        resolve({});
      };
    }));
  } catch (error) {
    console.error('Error getting all settings:', error);
    return {};
  }
};

export const clearAllSettings = async (): Promise<void> => {
  try {
    await withRetry((database) => new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    }));
  } catch (error) {
    console.error('Error clearing settings:', error);
  }
};

// Migrate all localStorage data to IndexedDB
export const migrateLocalStorageToIndexedDB = async (): Promise<boolean> => {
  try {
    const migrated = await getSetting('_localStorage_migrated', false);
    if (migrated) return false;

    // List of all known localStorage keys to migrate
    const keysToMigrate = [
      'theme', 'darkMode', 'npd_language', 'haptic_intensity',
      'hasSeenWelcome', 'npd_admin_bypass', 'npd_trial_start',
      'onboardingAnswers', 'folders',
      'todoFolders', 'todoSections', 'todoShowCompleted',
      'todoDateFilter', 'todoPriorityFilter', 'todoStatusFilter', 'todoTagFilter',
      'todoViewMode', 'todoHideDetailsOptions', 'todoSortBy', 'todoSmartList',
      'todoSelectedFolder', 'todoDefaultSectionId', 'todoTaskAddPosition',
      'todoShowStatusBadge', 'todoCompactMode', 'todoGroupByOption',
      'googleAccessToken', 'googleCalendarEnabled',
      'npd-cloud-sync-settings', 'npd-calendar-settings', 
      'npd-integration-tokens', 'npd-connections', 'npd-last-sync',
      'nota-sync-enabled', 'nota-last-sync',
      'note_versions', 'mapbox_token',
      'notes_migrated_to_indexeddb',
    ];

    // Also migrate encryption keys (dynamic keys)
    const allKeys = Object.keys(localStorage);
    const encryptionKeys = allKeys.filter(k => k.startsWith('npd_enc_'));
    
    for (const key of [...keysToMigrate, ...encryptionKeys]) {
      try {
        const value = localStorage.getItem(key);
        if (value !== null) {
          // Try to parse JSON, otherwise store as string
          try {
            const parsed = JSON.parse(value);
            await setSetting(key, parsed);
          } catch {
            await setSetting(key, value);
          }
        }
      } catch (e) {
        console.warn(`Failed to migrate key: ${key}`, e);
      }
    }

    await setSetting('_localStorage_migrated', true);
    
    // Clear localStorage after successful migration
    for (const key of [...keysToMigrate, ...encryptionKeys]) {
      try {
        localStorage.removeItem(key);
      } catch {}
    }

    console.log('Successfully migrated localStorage to IndexedDB');
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
};

// Hook-friendly synchronous cache for frequently accessed settings
const settingsCache: Map<string, any> = new Map();

export const preloadSettings = async (keys: string[]): Promise<void> => {
  for (const key of keys) {
    const value = await getSetting(key, undefined);
    if (value !== undefined) {
      settingsCache.set(key, value);
    }
  }
};

export const getCachedSetting = <T>(key: string, defaultValue: T): T => {
  if (settingsCache.has(key)) {
    return settingsCache.get(key) as T;
  }
  return defaultValue;
};

export const setCachedSetting = <T>(key: string, value: T): void => {
  settingsCache.set(key, value);
  setSetting(key, value).catch(console.error);
};
