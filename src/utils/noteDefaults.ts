import { Note, SyncStatus } from '@/types/note';
import { getSetting } from '@/utils/settingsStorage';

// Get or create device ID for this device
let cachedDeviceId: string | null = null;

export const getDeviceId = async (): Promise<string> => {
  if (cachedDeviceId) return cachedDeviceId;
  
  let deviceId = await getSetting<string>('device_id', '');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { setSetting } = await import('@/utils/settingsStorage');
    await setSetting('device_id', deviceId);
  }
  cachedDeviceId = deviceId;
  return deviceId;
};

// Synchronously get cached device ID (for use in note creation)
export const getDeviceIdSync = (): string => {
  if (cachedDeviceId) return cachedDeviceId;
  // Generate temp ID, will be replaced on next async call
  return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Default sync fields for new notes
export const getDefaultSyncFields = (): Pick<Note, 'syncVersion' | 'syncStatus' | 'isDirty' | 'deviceId'> => ({
  syncVersion: 1,
  syncStatus: 'pending' as SyncStatus,
  isDirty: true,
  deviceId: getDeviceIdSync(),
});

// Create a new note with all required fields including sync fields
export const createNote = (partialNote: Omit<Note, 'syncVersion' | 'syncStatus' | 'isDirty'> & Partial<Pick<Note, 'syncVersion' | 'syncStatus' | 'isDirty'>>): Note => {
  const defaults = getDefaultSyncFields();
  return {
    ...partialNote,
    syncVersion: partialNote.syncVersion ?? defaults.syncVersion,
    syncStatus: partialNote.syncStatus ?? defaults.syncStatus,
    isDirty: partialNote.isDirty ?? defaults.isDirty,
    deviceId: partialNote.deviceId ?? defaults.deviceId,
  };
};

// Update note and increment version (marks as dirty)
export const updateNoteWithVersion = (note: Note, updates: Partial<Note>): Note => {
  return {
    ...note,
    ...updates,
    syncVersion: note.syncVersion + 1,
    syncStatus: 'pending' as SyncStatus,
    isDirty: true,
    updatedAt: new Date(),
    deviceId: getDeviceIdSync(),
  };
};

// Mark note as synced
export const markNoteSynced = (note: Note): Note => {
  return {
    ...note,
    syncStatus: 'synced' as SyncStatus,
    isDirty: false,
    lastSyncedAt: new Date(),
  };
};

// Mark note as having conflict
export const markNoteConflict = (note: Note, conflictCopyId?: string): Note => {
  return {
    ...note,
    syncStatus: 'conflict' as SyncStatus,
    hasConflict: true,
    conflictCopyId,
  };
};

// Resolve conflict and mark as synced
export const resolveNoteConflict = (note: Note): Note => {
  return {
    ...note,
    syncStatus: 'synced' as SyncStatus,
    hasConflict: false,
    conflictCopyId: undefined,
    isDirty: false,
    lastSyncedAt: new Date(),
  };
};

// Migrate existing note to include sync fields (for backward compatibility)
export const migrateNoteToSyncable = (note: any): Note => {
  return {
    ...note,
    syncVersion: note.syncVersion ?? 1,
    syncStatus: note.syncStatus ?? ('synced' as SyncStatus),
    isDirty: note.isDirty ?? false,
    deviceId: note.deviceId ?? getDeviceIdSync(),
    createdAt: note.createdAt instanceof Date ? note.createdAt : new Date(note.createdAt),
    updatedAt: note.updatedAt instanceof Date ? note.updatedAt : new Date(note.updatedAt),
    lastSyncedAt: note.lastSyncedAt ? (note.lastSyncedAt instanceof Date ? note.lastSyncedAt : new Date(note.lastSyncedAt)) : undefined,
    voiceRecordings: note.voiceRecordings?.map((r: any) => ({
      ...r,
      timestamp: r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp),
    })) || [],
  };
};
