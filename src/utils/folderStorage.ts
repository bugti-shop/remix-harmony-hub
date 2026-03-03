// Folder storage utilities for notes and tasks

export interface Folder {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  type: 'notes' | 'tasks' | 'both';
  createdAt: Date;
  updatedAt: Date;
}

const FOLDERS_KEY = 'nota_folders';

export const loadFolders = async (): Promise<Folder[]> => {
  try {
    const stored = localStorage.getItem(FOLDERS_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    return parsed.map((folder: any) => ({
      ...folder,
      createdAt: new Date(folder.createdAt),
      updatedAt: new Date(folder.updatedAt),
    }));
  } catch (error) {
    console.error('Error loading folders:', error);
    return [];
  }
};

export const saveFolders = async (folders: Folder[]): Promise<void> => {
  try {
    const serialized = folders.map(folder => ({
      ...folder,
      createdAt: folder.createdAt instanceof Date ? folder.createdAt.toISOString() : folder.createdAt,
      updatedAt: folder.updatedAt instanceof Date ? folder.updatedAt.toISOString() : folder.updatedAt,
    }));
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(serialized));
  } catch (error) {
    console.error('Error saving folders:', error);
  }
};

export const createFolder = async (folder: Omit<Folder, 'id' | 'createdAt' | 'updatedAt'>): Promise<Folder> => {
  const newFolder: Folder = {
    ...folder,
    id: crypto.randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  const folders = await loadFolders();
  folders.push(newFolder);
  await saveFolders(folders);
  
  return newFolder;
};

export const updateFolder = async (id: string, updates: Partial<Folder>): Promise<Folder | null> => {
  const folders = await loadFolders();
  const index = folders.findIndex(f => f.id === id);
  
  if (index === -1) return null;
  
  folders[index] = {
    ...folders[index],
    ...updates,
    updatedAt: new Date(),
  };
  
  await saveFolders(folders);
  return folders[index];
};

export const deleteFolder = async (id: string): Promise<boolean> => {
  const folders = await loadFolders();
  const filtered = folders.filter(f => f.id !== id);

  if (filtered.length === folders.length) return false;

  await saveFolders(filtered);
  return true;
};
