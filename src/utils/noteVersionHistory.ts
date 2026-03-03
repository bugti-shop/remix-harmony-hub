import { Note } from '@/types/note';
import { getSetting, setSetting } from '@/utils/settingsStorage';

export interface NoteVersion {
  id: string;
  noteId: string;
  content: string;
  title: string;
  timestamp: Date;
  changeType: 'create' | 'edit' | 'restore';
}

const STORAGE_KEY = 'note_versions';
const MAX_VERSIONS_PER_NOTE = 50;

export const getNoteVersions = async (noteId: string): Promise<NoteVersion[]> => {
  const allVersions = await getSetting<NoteVersion[]>(STORAGE_KEY, []);
  return allVersions
    .filter(v => v.noteId === noteId)
    .map(v => ({ ...v, timestamp: new Date(v.timestamp) }))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

export const saveNoteVersion = async (note: Note, changeType: 'create' | 'edit' | 'restore' = 'edit'): Promise<void> => {
  const allVersions = await getSetting<NoteVersion[]>(STORAGE_KEY, []);
  
  // Check if content actually changed
  const existingVersions = allVersions.filter(v => v.noteId === note.id);
  const latestVersion = existingVersions[0];
  
  if (latestVersion && 
      latestVersion.content === note.content && 
      latestVersion.title === note.title) {
    return; // No changes, don't save
  }
  
  const newVersion: NoteVersion = {
    id: `${note.id}_${Date.now()}`,
    noteId: note.id,
    content: note.content,
    title: note.title,
    timestamp: new Date(),
    changeType,
  };
  
  // Add new version
  allVersions.unshift(newVersion);
  
  // Keep only MAX_VERSIONS_PER_NOTE per note
  const noteVersions = allVersions.filter(v => v.noteId === note.id);
  if (noteVersions.length > MAX_VERSIONS_PER_NOTE) {
    const toRemove = noteVersions.slice(MAX_VERSIONS_PER_NOTE);
    const toRemoveIds = new Set(toRemove.map(v => v.id));
    const filtered = allVersions.filter(v => !toRemoveIds.has(v.id));
    await setSetting(STORAGE_KEY, filtered);
  } else {
    await setSetting(STORAGE_KEY, allVersions);
  }
};

export const restoreNoteVersion = (version: NoteVersion): Partial<Note> => {
  return {
    content: version.content,
    title: version.title,
  };
};

export const deleteNoteVersions = async (noteId: string): Promise<void> => {
  const allVersions = await getSetting<NoteVersion[]>(STORAGE_KEY, []);
  const filtered = allVersions.filter(v => v.noteId !== noteId);
  await setSetting(STORAGE_KEY, filtered);
};

export const formatVersionTimestamp = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};
