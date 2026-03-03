// Comprehensive data backup/restore utilities
// Handles all app data types with proper JSON serialization

import { Note } from '@/types/note';
import { TodoItem } from '@/types/note';
import { loadNotesFromDB, saveNotesToDB } from '@/utils/noteStorage';
import { loadTodoItems, saveTodoItems } from '@/utils/todoItemsStorage';
import { getSetting, setSetting, getAllSettings } from '@/utils/settingsStorage';

// Backup data structure
export interface BackupData {
  version: number;
  timestamp: string;
  notes?: Note[];
  tasks?: TodoItem[];
  folders?: any[];
  todoFolders?: any[];
  todoSections?: any[];
  settings?: Record<string, any>;
}

// Version for backup format - increment when structure changes
const BACKUP_VERSION = 2;

// Keys that should be backed up from settings
const BACKUP_SETTING_KEYS = [
  'folders',
  'todoFolders',
  'todoSections',
  'theme',
  'darkMode',
  'npd_language',
  'haptic_intensity',
  'onboardingAnswers',
  'todoShowCompleted',
  'todoDateFilter',
  'todoPriorityFilter',
  'todoStatusFilter',
  'todoTagFilter',
  'todoViewMode',
  'todoHideDetailsOptions',
  'todoSortBy',
  'todoSmartList',
  'todoSelectedFolder',
  'todoDefaultSectionId',
  'todoTaskAddPosition',
  'todoShowStatusBadge',
  'todoCompactMode',
  'todoGroupByOption',
  'taskRemindersEnabled',
  'noteRemindersEnabled',
  'dailyDigestEnabled',
  'overdueAlertsEnabled',
];

/**
 * Create a complete backup of all app data
 */
export const createBackup = async (): Promise<BackupData> => {
  // Load all data in parallel
  const [notes, tasks, allSettings] = await Promise.all([
    loadNotesFromDB(),
    loadTodoItems(),
    getAllSettings(),
  ]);

  // Extract only relevant settings
  const settings: Record<string, any> = {};
  for (const key of BACKUP_SETTING_KEYS) {
    if (allSettings[key] !== undefined) {
      settings[key] = allSettings[key];
    }
  }

  // Extract special folder/section data
  const folders = allSettings['folders'] || [];
  const todoFolders = allSettings['todoFolders'] || [];
  const todoSections = allSettings['todoSections'] || [];

  return {
    version: BACKUP_VERSION,
    timestamp: new Date().toISOString(),
    notes,
    tasks,
    folders,
    todoFolders,
    todoSections,
    settings,
  };
};

/**
 * Download backup as JSON file
 */
export const downloadBackup = async (filename?: string): Promise<void> => {
  const backup = await createBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `npd-backup-${Date.now()}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
};

/**
 * Download just the user data (notes, tasks) for export
 */
export const downloadData = async (filename?: string): Promise<void> => {
  const [notes, tasks] = await Promise.all([
    loadNotesFromDB(),
    loadTodoItems(),
  ]);

  const data = {
    version: BACKUP_VERSION,
    timestamp: new Date().toISOString(),
    notes,
    tasks,
    exportedAt: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `npd-data-${Date.now()}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
};

/**
 * Hydrate note dates from JSON
 */
const hydrateNote = (raw: any): Note => ({
  ...raw,
  createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
  updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date(),
  archivedAt: raw.archivedAt ? new Date(raw.archivedAt) : undefined,
  deletedAt: raw.deletedAt ? new Date(raw.deletedAt) : undefined,
  reminderTime: raw.reminderTime ? new Date(raw.reminderTime) : undefined,
  lastSyncedAt: raw.lastSyncedAt ? new Date(raw.lastSyncedAt) : undefined,
  voiceRecordings: raw.voiceRecordings?.map((r: any) => ({
    ...r,
    timestamp: r.timestamp ? new Date(r.timestamp) : new Date(),
  })) || [],
});

/**
 * Hydrate task dates from JSON
 */
const hydrateTask = (raw: any): TodoItem => ({
  ...raw,
  dueDate: raw.dueDate ? new Date(raw.dueDate) : undefined,
  reminderTime: raw.reminderTime ? new Date(raw.reminderTime) : undefined,
  voiceRecording: raw.voiceRecording
    ? {
        ...raw.voiceRecording,
        timestamp: raw.voiceRecording.timestamp ? new Date(raw.voiceRecording.timestamp) : new Date(),
      }
    : undefined,
  subtasks: Array.isArray(raw.subtasks) ? raw.subtasks.map(hydrateTask) : undefined,
});

/**
 * Parse backup data from various formats (legacy and new)
 */
const parseBackupData = (content: string): BackupData => {
  const parsed = JSON.parse(content);
  
  // Handle legacy format (version 1 or no version)
  if (!parsed.version || parsed.version === 1) {
    // Legacy format had double-stringified notes/folders
    let notes: Note[] = [];
    let folders: any[] = [];
    
    if (parsed.notes) {
      // Check if notes is a string (double-stringified) or array
      const notesData = typeof parsed.notes === 'string' ? JSON.parse(parsed.notes) : parsed.notes;
      notes = notesData.map(hydrateNote);
    }
    
    if (parsed.folders) {
      // Check if folders is a string (double-stringified) or array
      folders = typeof parsed.folders === 'string' ? JSON.parse(parsed.folders) : parsed.folders;
    }
    
    return {
      version: 1,
      timestamp: parsed.timestamp || new Date().toISOString(),
      notes,
      folders,
      tasks: parsed.tasks?.map(hydrateTask) || [],
    };
  }
  
  // Current format (version 2+)
  return {
    version: parsed.version,
    timestamp: parsed.timestamp,
    notes: parsed.notes?.map(hydrateNote) || [],
    tasks: parsed.tasks?.map(hydrateTask) || [],
    folders: parsed.folders || [],
    todoFolders: parsed.todoFolders || [],
    todoSections: parsed.todoSections || [],
    settings: parsed.settings || {},
  };
};

/**
 * Merge notes: keep existing, add new, update if backup is newer
 */
const mergeNotes = (existing: Note[], incoming: Note[]): Note[] => {
  const merged = new Map<string, Note>();
  
  // Add all existing notes first
  existing.forEach(note => merged.set(note.id, note));
  
  // Merge incoming notes
  incoming.forEach(incomingNote => {
    const existingNote = merged.get(incomingNote.id);
    
    if (!existingNote) {
      // New note - add it
      merged.set(incomingNote.id, incomingNote);
    } else {
      // Duplicate - keep the newer one based on updatedAt
      const existingTime = existingNote.updatedAt?.getTime() || 0;
      const incomingTime = incomingNote.updatedAt?.getTime() || 0;
      
      if (incomingTime > existingTime) {
        merged.set(incomingNote.id, incomingNote);
      }
      // Otherwise keep existing (don't overwrite)
    }
  });
  
  return Array.from(merged.values());
};

/**
 * Merge tasks: keep existing, add new, update if backup is newer
 */
const mergeTasks = (existing: TodoItem[], incoming: TodoItem[]): TodoItem[] => {
  const merged = new Map<string, TodoItem>();
  
  // Add all existing tasks first
  existing.forEach(task => merged.set(task.id, task));
  
  // Merge incoming tasks
  incoming.forEach(incomingTask => {
    const existingTask = merged.get(incomingTask.id);
    
    if (!existingTask) {
      // New task - add it
      merged.set(incomingTask.id, incomingTask);
    } else {
      // Duplicate - keep the newer one based on updatedAt or id comparison
      const existingTime = (existingTask as any).updatedAt?.getTime() || 0;
      const incomingTime = (incomingTask as any).updatedAt?.getTime() || 0;
      
      if (incomingTime > existingTime) {
        merged.set(incomingTask.id, incomingTask);
      }
      // Otherwise keep existing (don't overwrite)
    }
  });
  
  return Array.from(merged.values());
};

/**
 * Merge folders: keep existing, add new, update if backup is newer
 */
const mergeFolders = (existing: any[], incoming: any[]): any[] => {
  const merged = new Map<string, any>();
  
  // Add all existing folders first
  existing.forEach(folder => merged.set(folder.id, folder));
  
  // Merge incoming folders
  incoming.forEach(incomingFolder => {
    const existingFolder = merged.get(incomingFolder.id);
    
    if (!existingFolder) {
      // New folder - add it
      merged.set(incomingFolder.id, incomingFolder);
    } else {
      // Duplicate - keep the newer one based on updatedAt
      const existingTime = new Date(existingFolder.updatedAt || 0).getTime();
      const incomingTime = new Date(incomingFolder.updatedAt || 0).getTime();
      
      if (incomingTime > existingTime) {
        merged.set(incomingFolder.id, incomingFolder);
      }
      // Otherwise keep existing (don't overwrite)
    }
  });
  
  return Array.from(merged.values());
};

/**
 * Restore data from a backup file - MERGES with existing data (no overwriting)
 */
export const restoreFromBackup = async (file: File): Promise<{ 
  success: boolean; 
  error?: string;
  stats?: { notes: number; tasks: number; folders: number; added: { notes: number; tasks: number; folders: number } };
}> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onerror = () => {
      resolve({ success: false, error: 'Failed to read file' });
    };
    
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        
        if (!content || content.trim().length === 0) {
          resolve({ success: false, error: 'File is empty' });
          return;
        }
        
        // Validate it's JSON
        if (!content.trim().startsWith('{') && !content.trim().startsWith('[')) {
          resolve({ success: false, error: 'Invalid file format - not valid JSON' });
          return;
        }
        
        const backup = parseBackupData(content);
        
        // Load existing data first
        const [existingNotes, existingTasks, allSettings] = await Promise.all([
          loadNotesFromDB(),
          loadTodoItems(),
          getAllSettings(),
        ]);
        
        const existingFolders = allSettings['folders'] || [];
        const existingTodoFolders = allSettings['todoFolders'] || [];
        const existingTodoSections = allSettings['todoSections'] || [];
        
        let addedNotes = 0;
        let addedTasks = 0;
        let addedFolders = 0;
        
        // Merge notes (don't overwrite existing)
        if (backup.notes && backup.notes.length > 0) {
          const beforeCount = existingNotes.length;
          const mergedNotes = mergeNotes(existingNotes, backup.notes);
          addedNotes = mergedNotes.length - beforeCount;
          await saveNotesToDB(mergedNotes);
          window.dispatchEvent(new Event('notesUpdated'));
        }
        
        // Merge tasks (don't overwrite existing)
        if (backup.tasks && backup.tasks.length > 0) {
          const beforeCount = existingTasks.length;
          const mergedTasks = mergeTasks(existingTasks, backup.tasks);
          addedTasks = mergedTasks.length - beforeCount;
          await saveTodoItems(mergedTasks);
          window.dispatchEvent(new Event('tasksUpdated'));
        }
        
        // Merge folders (don't overwrite existing)
        if (backup.folders && backup.folders.length > 0) {
          const beforeCount = existingFolders.length;
          const mergedFolders = mergeFolders(existingFolders, backup.folders);
          addedFolders += mergedFolders.length - beforeCount;
          await setSetting('folders', mergedFolders);
          window.dispatchEvent(new Event('foldersUpdated'));
        }
        
        // Merge todo folders
        if (backup.todoFolders && backup.todoFolders.length > 0) {
          const beforeCount = existingTodoFolders.length;
          const mergedTodoFolders = mergeFolders(existingTodoFolders, backup.todoFolders);
          addedFolders += mergedTodoFolders.length - beforeCount;
          await setSetting('todoFolders', mergedTodoFolders);
        }
        
        // Merge todo sections
        if (backup.todoSections && backup.todoSections.length > 0) {
          const mergedTodoSections = mergeFolders(existingTodoSections, backup.todoSections);
          await setSetting('todoSections', mergedTodoSections);
        }
        
        // Restore other settings (these can be overwritten as they're preferences)
        if (backup.settings) {
          for (const [key, value] of Object.entries(backup.settings)) {
            // Skip folders as they're handled above with merge
            if (key !== 'folders' && key !== 'todoFolders' && key !== 'todoSections') {
              await setSetting(key, value);
            }
          }
        }
        
        resolve({
          success: true,
          stats: {
            notes: backup.notes?.length || 0,
            tasks: backup.tasks?.length || 0,
            folders: (backup.folders?.length || 0) + (backup.todoFolders?.length || 0),
            added: {
              notes: addedNotes,
              tasks: addedTasks,
              folders: addedFolders,
            },
          },
        });
      } catch (error) {
        console.error('Restore error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        
        // Provide helpful error messages
        if (message.includes('Unexpected token')) {
          resolve({ success: false, error: 'Invalid JSON format - file may be corrupted' });
        } else if (message.includes('Unexpected end')) {
          resolve({ success: false, error: 'JSON file is truncated or incomplete' });
        } else {
          resolve({ success: false, error: `Restore failed: ${message}` });
        }
      }
    };
    
    reader.readAsText(file);
  });
};

/**
 * Validate a backup file without restoring
 */
export const validateBackupFile = async (file: File): Promise<{
  valid: boolean;
  error?: string;
  stats?: { notes: number; tasks: number; folders: number };
}> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onerror = () => {
      resolve({ valid: false, error: 'Failed to read file' });
    };
    
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const backup = parseBackupData(content);
        
        resolve({
          valid: true,
          stats: {
            notes: backup.notes?.length || 0,
            tasks: backup.tasks?.length || 0,
            folders: (backup.folders?.length || 0) + (backup.todoFolders?.length || 0),
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        resolve({ valid: false, error: message });
      }
    };
    
    reader.readAsText(file);
  });
};
