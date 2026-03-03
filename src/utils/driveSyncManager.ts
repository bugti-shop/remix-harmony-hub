// Google Drive Sync Manager
// Orchestrates sync between local IndexedDB and Google Drive
// Uses aggregate JSON files: notes.json, tasks.json, settings.json, sync-meta.json

import { getValidAccessToken, getStoredGoogleUser } from './googleAuth';
import { SyncConflict, addConflicts } from './syncConflicts';
import {
  getOrCreateAppFolder,
  listDriveFiles,
  uploadJsonFile,
  downloadFileContent,
  getStartPageToken,
  getChanges,
  DriveFile,
} from './googleDriveSync';
import { loadNotesFromDB, saveNotesToDB } from './noteStorage';
import { loadTodoItems, saveTodoItems } from './todoItemsStorage';
import { getAllSettings, setSetting, getSetting } from './settingsStorage';
import { Note, TodoItem } from '@/types/note';

// ── Types ──────────────────────────────────────────────────────────────────

export type SyncState = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncMeta {
  lastSyncAt: string;
  deviceId: string;
  changeToken?: string;
  notesVersion: number;
  tasksVersion: number;
  settingsVersion: number;
}

interface SyncDataFile<T> {
  _type: string;
  _version: number;
  _lastModified: string;
  _deviceId: string;
  data: T;
}

// File names in Google Drive
const FILES = {
  NOTES: 'npd-notes.json',
  TASKS: 'npd-tasks.json',
  SETTINGS: 'npd-settings.json',
  META: 'npd-sync-meta.json',
} as const;

// Settings keys to sync
const SYNC_SETTING_KEYS = [
  'folders', 'todoFolders', 'todoSections',
  'theme', 'darkMode', 'npd_language', 'haptic_intensity',
  'todoShowCompleted', 'todoViewMode', 'todoSortBy',
  'todoCompactMode', 'todoGroupByOption',
  'todoSelectedFolder', 'todoDefaultSectionId',
  'todoTaskAddPosition', 'todoShowStatusBadge',
];

// ── Device ID ──────────────────────────────────────────────────────────────

const getDeviceId = async (): Promise<string> => {
  let deviceId = await getSetting<string>('npd_device_id', '');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await setSetting('npd_device_id', deviceId);
  }
  return deviceId;
};

// ── Serializers ────────────────────────────────────────────────────────────

const serializeNotes = (notes: Note[]): any[] =>
  notes.map(n => ({
    ...n,
    createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt,
    updatedAt: n.updatedAt instanceof Date ? n.updatedAt.toISOString() : n.updatedAt,
    archivedAt: n.archivedAt instanceof Date ? n.archivedAt.toISOString() : n.archivedAt,
    deletedAt: n.deletedAt instanceof Date ? n.deletedAt.toISOString() : n.deletedAt,
    reminderTime: n.reminderTime instanceof Date ? n.reminderTime.toISOString() : n.reminderTime,
    lastSyncedAt: n.lastSyncedAt instanceof Date ? n.lastSyncedAt.toISOString() : n.lastSyncedAt,
    voiceRecordings: n.voiceRecordings?.map(r => ({
      ...r,
      timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : r.timestamp,
    })) || [],
  }));

/** Safely parse any value into a Date or return fallback */
const safeDate = (v: any, fallback?: Date): Date | undefined => {
  if (!v) return fallback;
  if (v instanceof Date) return isNaN(v.getTime()) ? fallback : v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? fallback : d;
};

const safeDateRequired = (v: any): Date => safeDate(v, new Date()) as Date;

const hydrateNotes = (raw: any[]): Note[] =>
  raw.map(n => ({
    ...n,
    createdAt: safeDateRequired(n.createdAt),
    updatedAt: safeDateRequired(n.updatedAt),
    archivedAt: safeDate(n.archivedAt),
    deletedAt: safeDate(n.deletedAt),
    reminderTime: safeDate(n.reminderTime),
    lastSyncedAt: safeDate(n.lastSyncedAt),
    voiceRecordings: n.voiceRecordings?.map((r: any) => ({
      ...r,
      timestamp: safeDateRequired(r.timestamp),
    })) || [],
    syncVersion: n.syncVersion ?? 1,
    syncStatus: n.syncStatus ?? 'synced',
    isDirty: false,
    deviceId: n.deviceId,
  }));

const hydrateTasks = (raw: any[]): TodoItem[] =>
  raw.map(function hydrateTask(t: any): TodoItem {
    return {
      ...t,
      dueDate: safeDate(t.dueDate),
      reminderTime: safeDate(t.reminderTime),
      createdAt: safeDate(t.createdAt),
      modifiedAt: safeDate(t.modifiedAt),
      completedAt: safeDate(t.completedAt),
      voiceRecording: t.voiceRecording
        ? { ...t.voiceRecording, timestamp: safeDateRequired(t.voiceRecording.timestamp) }
        : undefined,
      subtasks: Array.isArray(t.subtasks) ? t.subtasks.map(hydrateTask) : undefined,
    };
  });

// ── Merge Logic (last-write-wins with conflict copies) ─────────────────────

const toTime = (d: any): number => {
  if (!d) return 0;
  if (d instanceof Date) return d.getTime();
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const mergeNotes = (local: Note[], remote: Note[]): { merged: Note[]; conflictItems: SyncConflict[] } => {
  const map = new Map<string, Note>();
  const conflictItems: SyncConflict[] = [];

  // Start with local
  local.forEach(n => map.set(n.id, n));

  // Merge remote
  remote.forEach(remoteNote => {
    const localNote = map.get(remoteNote.id);
    if (!localNote) {
      map.set(remoteNote.id, remoteNote);
    } else {
      const localTime = toTime(localNote.updatedAt);
      const remoteTime = toTime(remoteNote.updatedAt);

      if (remoteTime > localTime) {
        map.set(remoteNote.id, remoteNote);
      } else if (localTime > remoteTime) {
        // Local is newer — keep it
      } else if (localNote.syncVersion !== remoteNote.syncVersion) {
        // Same timestamp, different versions — real conflict
        conflictItems.push({
          id: remoteNote.id,
          type: 'note',
          localItem: localNote,
          remoteItem: remoteNote,
          localUpdatedAt: localNote.updatedAt,
          remoteUpdatedAt: remoteNote.updatedAt,
          detectedAt: new Date(),
        });
        // Keep local for now; user will resolve
        map.set(remoteNote.id, { ...localNote, hasConflict: true });
      }
    }
  });

  const merged = Array.from(map.values());
  return { merged, conflictItems };
};

const mergeTasks = (local: TodoItem[], remote: TodoItem[]): { merged: TodoItem[]; conflictItems: SyncConflict[] } => {
  const map = new Map<string, TodoItem>();
  const conflictItems: SyncConflict[] = [];

  local.forEach(t => map.set(t.id, t));

  remote.forEach(remoteTask => {
    const localTask = map.get(remoteTask.id);
    if (!localTask) {
      map.set(remoteTask.id, remoteTask);
    } else {
      const localTime = toTime(localTask.modifiedAt || localTask.createdAt);
      const remoteTime = toTime(remoteTask.modifiedAt || remoteTask.createdAt);

      if (remoteTime > localTime) {
        map.set(remoteTask.id, remoteTask);
      } else if (localTime === remoteTime && JSON.stringify(localTask) !== JSON.stringify(remoteTask)) {
        // Same timestamp but different content — conflict
        conflictItems.push({
          id: remoteTask.id,
          type: 'task',
          localItem: localTask,
          remoteItem: remoteTask,
          localUpdatedAt: localTask.modifiedAt || localTask.createdAt || new Date(),
          remoteUpdatedAt: remoteTask.modifiedAt || remoteTask.createdAt || new Date(),
          detectedAt: new Date(),
        });
        // Keep local for now
      }
      // Otherwise keep local
    }
  });

  return { merged: Array.from(map.values()), conflictItems };
};

const mergeSettings = (local: Record<string, any>, remote: Record<string, any>): Record<string, any> => {
  // For array-type settings (folders, sections), merge by ID
  const arrayKeys = ['folders', 'todoFolders', 'todoSections'];
  const merged = { ...local };

  for (const key of Object.keys(remote)) {
    if (arrayKeys.includes(key)) {
      // Merge arrays by ID
      const localArr = Array.isArray(local[key]) ? local[key] : [];
      const remoteArr = Array.isArray(remote[key]) ? remote[key] : [];
      const map = new Map<string, any>();
      localArr.forEach((item: any) => map.set(item.id, item));
      remoteArr.forEach((item: any) => {
        const existing = map.get(item.id);
        if (!existing) {
          map.set(item.id, item);
        } else {
          const existingTime = new Date(existing.updatedAt || 0).getTime();
          const remoteTime = new Date(item.updatedAt || 0).getTime();
          if (remoteTime > existingTime) {
            map.set(item.id, item);
          }
        }
      });
      merged[key] = Array.from(map.values());
    } else if (!(key in local)) {
      // New setting from remote
      merged[key] = remote[key];
    }
    // For scalar settings, keep local (user's current device preference)
  }

  return merged;
};

// ── Drive File Helpers ─────────────────────────────────────────────────────

const findDriveFile = (files: DriveFile[], name: string): DriveFile | undefined =>
  files.find(f => f.name === name);

// ── Main Sync Function ─────────────────────────────────────────────────────

export interface SyncResult {
  success: boolean;
  error?: string;
  stats?: {
    notesUploaded: number;
    notesDownloaded: number;
    tasksUploaded: number;
    tasksDownloaded: number;
    conflicts: number;
  };
}

let isSyncing = false;
const syncListeners: Set<(state: SyncState) => void> = new Set();

export const addSyncListener = (listener: (state: SyncState) => void): (() => void) => {
  syncListeners.add(listener);
  return () => { syncListeners.delete(listener); };
};

const notifyListeners = (state: SyncState) => {
  syncListeners.forEach(fn => fn(state));
};

export const performSync = async (): Promise<SyncResult> => {
  if (isSyncing) return { success: false, error: 'Sync already in progress' };

  const user = await getStoredGoogleUser();
  if (!user) return { success: false, error: 'Not signed in' };

  const token = await getValidAccessToken();
  if (!token) return { success: false, error: 'Token expired, please sign in again' };

  isSyncing = true;
  notifyListeners('syncing');

  try {
    const deviceId = await getDeviceId();
    const folderId = await getOrCreateAppFolder();

    // List existing files in Drive + load all local data IN PARALLEL
    const [{ files }, localNotes, localTasks, allSettings] = await Promise.all([
      listDriveFiles(folderId),
      loadNotesFromDB(),
      loadTodoItems(),
      getAllSettings(),
    ]);

    // Extract sync-relevant settings
    const localSettings: Record<string, any> = {};
    for (const key of SYNC_SETTING_KEYS) {
      if (allSettings[key] !== undefined) {
        localSettings[key] = allSettings[key];
      }
    }

    const notesFile = findDriveFile(files, FILES.NOTES);
    const tasksFile = findDriveFile(files, FILES.TASKS);
    const settingsFile = findDriveFile(files, FILES.SETTINGS);

    // ── Download ALL remote files IN PARALLEL ─────────────────────────
    const [remoteNotesData, remoteTasksData, remoteSettingsData] = await Promise.all([
      notesFile ? downloadFileContent<SyncDataFile<any[]>>(notesFile.id).catch(() => null) : Promise.resolve(null),
      tasksFile ? downloadFileContent<SyncDataFile<any[]>>(tasksFile.id).catch(() => null) : Promise.resolve(null),
      settingsFile ? downloadFileContent<SyncDataFile<Record<string, any>>>(settingsFile.id).catch(() => null) : Promise.resolve(null),
    ]);

    let notesDownloaded = 0;
    let tasksDownloaded = 0;
    let totalConflicts = 0;
    let allConflictItems: import('./syncConflicts').SyncConflict[] = [];

    // ── Merge Notes ───────────────────────────────────────────────────
    let finalNotes = localNotes;
    if (remoteNotesData) {
      const remoteNotes = hydrateNotes(remoteNotesData.data || []);
      const { merged, conflictItems } = mergeNotes(localNotes, remoteNotes);
      finalNotes = merged;
      totalConflicts += conflictItems.length;
      allConflictItems.push(...conflictItems);
      notesDownloaded = remoteNotes.length;
    }

    // ── Merge Tasks ───────────────────────────────────────────────────
    let finalTasks = localTasks;
    if (remoteTasksData) {
      const remoteTasks = hydrateTasks(remoteTasksData.data || []);
      const taskMerge = mergeTasks(localTasks, remoteTasks);
      finalTasks = taskMerge.merged;
      totalConflicts += taskMerge.conflictItems.length;
      allConflictItems.push(...taskMerge.conflictItems);
      tasksDownloaded = remoteTasks.length;
    }

    // ── Merge Settings ────────────────────────────────────────────────
    if (remoteSettingsData) {
      const merged = mergeSettings(localSettings, remoteSettingsData.data || {});
      // Apply merged settings in parallel
      await Promise.all(
        Object.entries(merged).map(([key, value]) => setSetting(key, value))
      );
    }

    // ── Save merged local data + dispatch events IN PARALLEL ──────────
    await Promise.all([
      remoteNotesData ? saveNotesToDB(finalNotes) : Promise.resolve(),
      remoteTasksData ? saveTodoItems(finalTasks) : Promise.resolve(),
    ]);

    if (remoteNotesData) window.dispatchEvent(new Event('notesUpdated'));
    if (remoteTasksData) window.dispatchEvent(new Event('tasksUpdated'));
    if (remoteSettingsData) window.dispatchEvent(new Event('foldersUpdated'));

    // ── Upload ALL files to Drive IN PARALLEL ─────────────────────────
    const notesVersion = (await getSetting<number>('sync_notes_version', 0)) + 1;
    const tasksVersion = (await getSetting<number>('sync_tasks_version', 0)) + 1;
    const settingsVersion = (await getSetting<number>('sync_settings_version', 0)) + 1;

    const notesPayload: SyncDataFile<any[]> = {
      _type: 'notes', _version: notesVersion,
      _lastModified: new Date().toISOString(), _deviceId: deviceId,
      data: serializeNotes(finalNotes),
    };
    const tasksPayload: SyncDataFile<any[]> = {
      _type: 'tasks', _version: tasksVersion,
      _lastModified: new Date().toISOString(), _deviceId: deviceId,
      data: finalTasks,
    };
    const settingsPayload: SyncDataFile<Record<string, any>> = {
      _type: 'settings', _version: settingsVersion,
      _lastModified: new Date().toISOString(), _deviceId: deviceId,
      data: localSettings,
    };

    let changeToken: string | undefined;
    try { changeToken = await getStartPageToken(); } catch { }

    const meta: SyncMeta = {
      lastSyncAt: new Date().toISOString(), deviceId, changeToken,
      notesVersion, tasksVersion, settingsVersion,
    };
    const metaFile = findDriveFile(files, FILES.META);

    // Upload all 4 files + save version numbers IN PARALLEL
    await Promise.all([
      uploadJsonFile(folderId, FILES.NOTES, notesPayload, notesFile?.id),
      uploadJsonFile(folderId, FILES.TASKS, tasksPayload, tasksFile?.id),
      uploadJsonFile(folderId, FILES.SETTINGS, settingsPayload, settingsFile?.id),
      uploadJsonFile(folderId, FILES.META, meta, metaFile?.id),
      setSetting('sync_notes_version', notesVersion),
      setSetting('sync_tasks_version', tasksVersion),
      setSetting('sync_settings_version', settingsVersion),
      setSetting('npd_last_sync', meta),
    ]);

    // Surface conflicts to UI
    if (allConflictItems.length > 0) {
      addConflicts(allConflictItems);
    }

    isSyncing = false;
    notifyListeners('success');

    return {
      success: true,
      stats: {
        notesUploaded: finalNotes.length,
        notesDownloaded,
        tasksUploaded: finalTasks.length,
        tasksDownloaded,
        conflicts: totalConflicts,
      },
    };
  } catch (error: any) {
    console.error('Sync failed:', error);
    isSyncing = false;
    notifyListeners('error');

    return {
      success: false,
      error: error?.message || 'Sync failed',
    };
  }
};

// ── Get last sync info ─────────────────────────────────────────────────────

export const getLastSyncInfo = async (): Promise<SyncMeta | null> => {
  return getSetting<SyncMeta | null>('npd_last_sync', null);
};

// ── Check if sync is available ─────────────────────────────────────────────

export const isSyncAvailable = async (): Promise<boolean> => {
  const user = await getStoredGoogleUser();
  return !!user;
};

// ── Incremental Sync (change-token based) ──────────────────────────────────

export const performIncrementalSync = async (): Promise<SyncResult> => {
  // Check if we have a stored change token
  const lastSync = await getLastSyncInfo();
  const storedToken = lastSync?.changeToken;

  if (!storedToken) {
    // No token yet — do a full sync
    return performSync();
  }

  const user = await getStoredGoogleUser();
  if (!user) return { success: false, error: 'Not signed in' };

  const token = await getValidAccessToken();
  if (!token) return { success: false, error: 'Token expired' };

  try {
    // Check for remote changes since last token
    const { changes, newStartPageToken } = await getChanges(storedToken);

    if (!changes || changes.length === 0) {
      // No remote changes — check if local data is dirty
      const hasDirty = await hasLocalChanges();
      if (!hasDirty) {
        // Nothing changed anywhere — skip sync
        return { success: true, stats: { notesUploaded: 0, notesDownloaded: 0, tasksUploaded: 0, tasksDownloaded: 0, conflicts: 0 } };
      }
    }

    // There are changes (remote or local) — do a full sync
    const result = await performSync();

    // Update the change token if we got a new one
    if (result.success && newStartPageToken) {
      const meta = await getLastSyncInfo();
      if (meta) {
        meta.changeToken = newStartPageToken;
        await setSetting('npd_last_sync', meta);
      }
    }

    return result;
  } catch (error: any) {
    // If change detection fails, fall back to full sync
    console.warn('Incremental check failed, falling back to full sync:', error);
    return performSync();
  }
};

// Check if local data has been modified since last sync
const hasLocalChanges = async (): Promise<boolean> => {
  const lastSync = await getLastSyncInfo();
  if (!lastSync) return true;

  const lastSyncTime = new Date(lastSync.lastSyncAt).getTime();
  const notes = await loadNotesFromDB();
  const tasks = await loadTodoItems();

  const notesDirty = notes.some(n => {
    const t = n.updatedAt instanceof Date ? n.updatedAt.getTime() : new Date(n.updatedAt).getTime();
    return t > lastSyncTime;
  });

  if (notesDirty) return true;

  const tasksDirty = tasks.some(t => {
    const mod = t.modifiedAt || t.createdAt;
    if (!mod) return false;
    const time = mod instanceof Date ? mod.getTime() : new Date(mod as any).getTime();
    return time > lastSyncTime;
  });

  return tasksDirty;
};
