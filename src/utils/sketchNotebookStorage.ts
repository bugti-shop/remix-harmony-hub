import { getSetting, setSetting } from '@/utils/settingsStorage';

export interface SketchPage {
  id: string;
  title: string;
  noteId: string; // maps to the Note.id in the notes system
  thumbnail?: string; // base64 data URL
  createdAt: Date;
  updatedAt: Date;
  order: number;
}

export interface SketchNotebook {
  id: string;
  name: string;
  description?: string;
  coverThumbnail?: string; // first page thumbnail
  folderId?: string; // parent folder
  pages: SketchPage[];
  createdAt: Date;
  updatedAt: Date;
  order: number;
  color?: string;
  icon?: string;
}

export interface SketchFolder {
  id: string;
  name: string;
  parentId?: string; // for nesting
  color?: string;
  icon?: string;
  createdAt: Date;
  order: number;
}

const NOTEBOOKS_KEY = 'sketch_notebooks';
const FOLDERS_KEY = 'sketch_folders';

// --- Notebooks ---
export async function loadNotebooks(): Promise<SketchNotebook[]> {
  const raw = await getSetting<SketchNotebook[] | null>(NOTEBOOKS_KEY, null);
  if (!raw) return [];
  return raw.map(nb => ({
    ...nb,
    createdAt: new Date(nb.createdAt),
    updatedAt: new Date(nb.updatedAt),
    pages: (nb.pages || []).map(p => ({
      ...p,
      createdAt: new Date(p.createdAt),
      updatedAt: new Date(p.updatedAt),
    })),
  }));
}

export async function saveNotebooks(notebooks: SketchNotebook[]): Promise<void> {
  await setSetting(NOTEBOOKS_KEY, notebooks);
}

export function createNotebook(name: string, folderId?: string, color?: string): SketchNotebook {
  return {
    id: `nb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    folderId,
    pages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    order: Date.now(),
    color: color || '#3C78F0',
  };
}

export function addPageToNotebook(
  notebook: SketchNotebook,
  noteId: string,
  title: string,
  thumbnail?: string
): SketchNotebook {
  const page: SketchPage = {
    id: `pg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    noteId,
    thumbnail,
    createdAt: new Date(),
    updatedAt: new Date(),
    order: notebook.pages.length,
  };
  return {
    ...notebook,
    pages: [...notebook.pages, page],
    coverThumbnail: notebook.pages.length === 0 ? thumbnail : notebook.coverThumbnail,
    updatedAt: new Date(),
  };
}

// --- Folders ---
export async function loadSketchFolders(): Promise<SketchFolder[]> {
  const raw = await getSetting<SketchFolder[] | null>(FOLDERS_KEY, null);
  if (!raw) return [];
  return raw.map(f => ({
    ...f,
    createdAt: new Date(f.createdAt),
  }));
}

export async function saveSketchFolders(folders: SketchFolder[]): Promise<void> {
  await setSetting(FOLDERS_KEY, folders);
}

export function createSketchFolder(name: string, parentId?: string, color?: string): SketchFolder {
  return {
    id: `sf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    parentId,
    color: color || '#10b981',
    createdAt: new Date(),
    order: Date.now(),
  };
}

// --- Helpers ---
export function getNotebooksInFolder(notebooks: SketchNotebook[], folderId: string | null): SketchNotebook[] {
  if (folderId === null) return notebooks.filter(nb => !nb.folderId);
  return notebooks.filter(nb => nb.folderId === folderId);
}

export function getSubFolders(folders: SketchFolder[], parentId: string | null): SketchFolder[] {
  if (parentId === null) return folders.filter(f => !f.parentId);
  return folders.filter(f => f.parentId === parentId);
}

export function getFolderPath(folders: SketchFolder[], folderId: string): SketchFolder[] {
  const path: SketchFolder[] = [];
  let current = folders.find(f => f.id === folderId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? folders.find(f => f.id === current!.parentId) : undefined;
  }
  return path;
}
