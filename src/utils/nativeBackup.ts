// Native backup utilities for Android/iOS using Capacitor Filesystem
import { Capacitor } from '@capacitor/core';
import { createBackup } from './dataBackup';

export interface NativeBackupResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

/**
 * Check if running on native platform
 */
export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Get the backup directory path based on platform
 */
const getBackupDirectory = (): string => {
  return 'Npd/backup';
};

/**
 * Generate backup filename with timestamp
 */
const generateBackupFilename = (): string => {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '')
    .split('.')[0];
  return `npd_backup_${timestamp}.json`;
};

/**
 * Dynamically import Filesystem only when on native platform
 */
const getFilesystem = async () => {
  if (!isNativePlatform()) {
    throw new Error('Filesystem is only available on native platforms');
  }
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  return { Filesystem, Directory, Encoding };
};

/**
 * Ensure the backup directory exists
 */
const ensureBackupDirectory = async (): Promise<void> => {
  const { Filesystem, Directory } = await getFilesystem();
  const backupDir = getBackupDirectory();
  const parts = backupDir.split('/');
  let currentPath = '';
  
  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    try {
      await Filesystem.mkdir({
        path: currentPath,
        directory: Directory.Documents,
        recursive: false,
      });
    } catch (e) {
      // Directory may already exist, ignore error
    }
  }
};

/**
 * Create and save backup to native filesystem (for Android/iOS)
 */
export const createNativeBackup = async (): Promise<NativeBackupResult> => {
  try {
    if (!isNativePlatform()) {
      return {
        success: false,
        error: 'Native backup is only available on mobile devices',
      };
    }

    const { Filesystem, Directory, Encoding } = await getFilesystem();
    
    // Create the backup data
    const backup = await createBackup();
    const backupJson = JSON.stringify(backup, null, 2);
    
    // Ensure backup directory exists
    await ensureBackupDirectory();
    
    // Generate filename
    const filename = generateBackupFilename();
    const backupDir = getBackupDirectory();
    const filePath = `${backupDir}/${filename}`;
    
    // Write the file
    await Filesystem.writeFile({
      path: filePath,
      data: backupJson,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
    
    // Get the full display path
    const displayPath = `Documents/${filePath}`;
    
    return {
      success: true,
      filePath: displayPath,
    };
  } catch (error) {
    console.error('Native backup error:', error);
    
    // Check for parent directory missing error
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.toLowerCase().includes('parent') || 
        errorMessage.toLowerCase().includes('directory') ||
        errorMessage.toLowerCase().includes('missing')) {
      return {
        success: false,
        error: 'Please create a "Documents" folder in your File Manager first',
      };
    }
    
    return {
      success: false,
      error: errorMessage || 'Failed to create backup',
    };
  }
};

/**
 * List available backup files
 */
export const listBackupFiles = async (): Promise<string[]> => {
  try {
    if (!isNativePlatform()) {
      return [];
    }

    const { Filesystem, Directory } = await getFilesystem();
    const backupDir = getBackupDirectory();
    const result = await Filesystem.readdir({
      path: backupDir,
      directory: Directory.Documents,
    });
    
    return result.files
      .filter(file => file.name.endsWith('.json'))
      .map(file => file.name)
      .sort()
      .reverse(); // Most recent first
  } catch (error) {
    console.error('Error listing backup files:', error);
    return [];
  }
};

/**
 * Read a backup file from native filesystem
 */
export const readNativeBackup = async (filename: string): Promise<string | null> => {
  try {
    if (!isNativePlatform()) {
      return null;
    }

    const { Filesystem, Directory, Encoding } = await getFilesystem();
    const backupDir = getBackupDirectory();
    const result = await Filesystem.readFile({
      path: `${backupDir}/${filename}`,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
    
    return result.data as string;
  } catch (error) {
    console.error('Error reading backup file:', error);
    return null;
  }
};
