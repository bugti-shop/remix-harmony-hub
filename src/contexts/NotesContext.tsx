import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Note, SyncStatus } from '@/types/note';
import { loadNotesFromDB, saveNotesToDB, saveNoteToDBSingle, deleteNoteFromDB, migrateNotesToIndexedDB } from '@/utils/noteStorage';
import { getTextPreviewFromHtml } from '@/utils/contentPreview';
import { migrateNoteToSyncable, getDeviceIdSync } from '@/utils/noteDefaults';

// Lightweight note metadata for instant navigation
export interface NoteMeta {
  id: string;
  type: Note['type'];
  title: string;
  color?: Note['color'];
  customColor?: string;
  folderId?: string;
  isPinned?: boolean;
  isFavorite?: boolean;
  pinnedOrder?: number;
  isArchived?: boolean;
  archivedAt?: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
  isHidden?: boolean;
  isProtected?: boolean;
  metaDescription?: string;
  reminderEnabled?: boolean;
  reminderTime?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Content preview for search (first 200 chars only)
  contentPreview: string;
  // Full content loaded on demand
  hasFullContent: boolean;
}

// Extract metadata from full note
const extractNoteMeta = (note: Note): NoteMeta => ({
  id: note.id,
  type: note.type,
  title: note.title,
  color: note.color,
  customColor: note.customColor,
  folderId: note.folderId,
  isPinned: note.isPinned,
  isFavorite: note.isFavorite,
  pinnedOrder: note.pinnedOrder,
  isArchived: note.isArchived,
  archivedAt: note.archivedAt,
  isDeleted: note.isDeleted,
  deletedAt: note.deletedAt,
  isHidden: note.isHidden,
  isProtected: note.isProtected,
  metaDescription: note.metaDescription,
  reminderEnabled: note.reminderEnabled,
  reminderTime: note.reminderTime,
  createdAt: note.createdAt,
  updatedAt: note.updatedAt,
  // Only store first 200 chars for search.
  // IMPORTANT: this uses an early-exit extractor to avoid scanning 200k+ word notes.
  contentPreview: getTextPreviewFromHtml(note.content, 200),
  hasFullContent: true,
});

interface NotesContextType {
  notes: Note[];
  notesMeta: NoteMeta[];
  isLoading: boolean;
  isInitialized: boolean;
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
  saveNote: (note: Note) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  updateNote: (noteId: string, updates: Partial<Note>) => Promise<void>;
  bulkUpdateNotes: (noteIds: string[], updates: Partial<Note>) => Promise<void>;
  refreshNotes: () => Promise<void>;
  // Get full note content on demand
  getNoteById: (noteId: string) => Note | undefined;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export const NotesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>('');

  // Memoized metadata extraction - this is what makes navigation instant!
  // Use a stable reference check instead of building a massive string
  const notesVersionRef = useRef(0);
  const prevNotesRef = useRef<Note[]>([]);
  const cachedMetaRef = useRef<NoteMeta[]>([]);

  const notesMeta = useMemo(() => {
    // Quick reference check - if same array, skip entirely
    if (notes === prevNotesRef.current && cachedMetaRef.current.length > 0) {
      return cachedMetaRef.current;
    }
    prevNotesRef.current = notes;
    const result = notes.map(extractNoteMeta);
    cachedMetaRef.current = result;
    return result;
  }, [notes]);

  // Load notes once on mount
  useEffect(() => {
    let isMounted = true;

    const initializeNotes = async () => {
      try {
        console.log('[NotesContext] Initializing notes...');
        const startTime = performance.now();

        // Run migration once
        await migrateNotesToIndexedDB();

        // Load all notes from IndexedDB
        const loadedNotes = await loadNotesFromDB();

        if (isMounted) {
          setNotes(loadedNotes);
          setIsInitialized(true);
          setIsLoading(false);
          
          const duration = (performance.now() - startTime).toFixed(0);
          console.log(`[NotesContext] Loaded ${loadedNotes.length} notes in ${duration}ms`);
        }
      } catch (error) {
        console.error('[NotesContext] Error loading notes:', error);
        if (isMounted) {
          setIsLoading(false);
          setIsInitialized(true);
        }
      }
    };

    initializeNotes();

    // Listen for notes updates from other sources (e.g., NoteEditor)
    const handleNotesUpdated = () => {
      console.log('[NotesContext] External notes update detected, refreshing...');
      loadNotesFromDB().then(setNotes).catch(console.error);
    };

    // Listen for notes restored from cloud sync
    const handleNotesRestored = () => {
      console.log('[NotesContext] Notes restored from cloud, refreshing...');
      loadNotesFromDB().then(setNotes).catch(console.error);
    };

    window.addEventListener('notesUpdated', handleNotesUpdated);
    window.addEventListener('notesRestored', handleNotesRestored);

    return () => {
      isMounted = false;
      window.removeEventListener('notesUpdated', handleNotesUpdated);
      window.removeEventListener('notesRestored', handleNotesRestored);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Debounced save to IndexedDB when notes change
  const notesLengthRef = useRef(0);
  useEffect(() => {
    if (!isInitialized || notes.length === 0) return;

    // Simple length + reference check instead of building massive hash string
    const changed = notes !== prevNotesRef.current || notes.length !== notesLengthRef.current;
    notesLengthRef.current = notes.length;
    if (!changed) return;

    // Debounce saves to avoid too many writes
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveNotesToDB(notes);
        lastSavedRef.current = String(notes.length);
        console.log('[NotesContext] Notes saved to IndexedDB');
        window.dispatchEvent(new Event('notesUpdated'));
      } catch (error) {
        console.error('[NotesContext] Error saving notes:', error);
      }
    }, 500);
  }, [notes, isInitialized]);

  const saveNote = useCallback(async (note: Note) => {
    // Check if note already exists to determine action type
    let isUpdate = false;
    
    // Ensure note has sync fields
    const noteWithSync: Note = {
      ...note,
      syncVersion: (note.syncVersion ?? 0) + 1,
      syncStatus: 'pending' as SyncStatus,
      isDirty: true,
      deviceId: note.deviceId ?? getDeviceIdSync(),
    };
    
    setNotes(prev => {
      const existingIdx = prev.findIndex(n => n.id === noteWithSync.id);
      isUpdate = existingIdx >= 0;
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = noteWithSync;
        return updated;
      }
      return [noteWithSync, ...prev];
    });

    // Also save immediately for safety
    try {
      await saveNoteToDBSingle(noteWithSync);
    } catch (error) {
      console.error('[NotesContext] Error saving single note:', error);
    }
  }, []);

  const deleteNote = useCallback(async (noteId: string) => {
    setNotes(prev => prev.filter(n => n.id !== noteId));
    try {
      await deleteNoteFromDB(noteId);
    } catch (error) {
      console.error('[NotesContext] Error deleting note:', error);
    }
  }, []);

  const updateNote = useCallback(async (noteId: string, updates: Partial<Note>) => {
    let updatedNote: Note | null = null;

    setNotes(prev =>
      prev.map(n => {
        if (n.id !== noteId) return n;

        updatedNote = {
          ...n,
          ...updates,
          updatedAt: new Date(),
          syncVersion: (n.syncVersion ?? 0) + 1,
          syncStatus: 'pending' as SyncStatus,
          isDirty: true,
          deviceId: n.deviceId ?? getDeviceIdSync(),
        };

        return updatedNote;
      })
    );

    try {
      if (updatedNote) {
        await saveNoteToDBSingle(updatedNote);
      }
    } catch (error) {
      console.error('[NotesContext] Error persisting note update:', error);
    }
  }, []);

  const bulkUpdateNotes = useCallback(async (noteIds: string[], updates: Partial<Note>) => {
    const updatedNotes: Note[] = [];

    setNotes(prev =>
      prev.map(n => {
        if (!noteIds.includes(n.id)) return n;

        const next: Note = {
          ...n,
          ...updates,
          updatedAt: new Date(),
          syncVersion: (n.syncVersion ?? 0) + 1,
          syncStatus: 'pending' as SyncStatus,
          isDirty: true,
          deviceId: n.deviceId ?? getDeviceIdSync(),
        };

        updatedNotes.push(next);
        return next;
      })
    );

    try {
      await Promise.all(updatedNotes.map(n => saveNoteToDBSingle(n)));
    } catch (error) {
      console.error('[NotesContext] Error persisting bulk note update:', error);
    }
  }, []);

  const refreshNotes = useCallback(async () => {
    try {
      const loadedNotes = await loadNotesFromDB();
      setNotes(loadedNotes);
    } catch (error) {
      console.error('[NotesContext] Error refreshing notes:', error);
    }
  }, []);

  // Get full note by ID - for when user opens a note
  const getNoteById = useCallback((noteId: string): Note | undefined => {
    return notes.find(n => n.id === noteId);
  }, [notes]);

  const value: NotesContextType = {
    notes,
    notesMeta,
    isLoading,
    isInitialized,
    setNotes,
    saveNote,
    deleteNote,
    updateNote,
    bulkUpdateNotes,
    refreshNotes,
    getNoteById,
  };

  return (
    <NotesContext.Provider value={value}>
      {children}
    </NotesContext.Provider>
  );
};

export const useNotes = (): NotesContextType => {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotes must be used within a NotesProvider');
  }
  return context;
};

// Optional hook that returns empty state if context is not available
// Useful for components that might render outside the provider
export const useNotesOptional = (): NotesContextType | null => {
  return useContext(NotesContext) || null;
};
