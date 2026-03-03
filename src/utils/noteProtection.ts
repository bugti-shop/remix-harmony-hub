import { Capacitor } from '@capacitor/core';
import i18n from '@/i18n';
import { getSetting, setSetting, removeSetting } from './settingsStorage';

const HIDDEN_NOTES_PASSWORD_KEY = 'npd_hidden_notes_password';
const HIDDEN_NOTES_SALT_KEY = 'npd_hidden_notes_salt';
const HIDDEN_NOTES_USE_BIOMETRIC_KEY = 'npd_hidden_notes_use_biometric';
const SECURITY_QUESTION_KEY = 'npd_security_question';
const SECURITY_ANSWER_KEY = 'npd_security_answer';
const SECURITY_ANSWER_SALT_KEY = 'npd_security_answer_salt';

// In-memory cache for sync access to settings
let settingsCache: Record<string, any> = {};

export const initializeProtectionSettings = async (): Promise<void> => {
  settingsCache = {
    [HIDDEN_NOTES_PASSWORD_KEY]: await getSetting<string | null>(HIDDEN_NOTES_PASSWORD_KEY, null),
    [HIDDEN_NOTES_SALT_KEY]: await getSetting<string | null>(HIDDEN_NOTES_SALT_KEY, null),
    [HIDDEN_NOTES_USE_BIOMETRIC_KEY]: await getSetting<boolean>(HIDDEN_NOTES_USE_BIOMETRIC_KEY, false),
    [SECURITY_QUESTION_KEY]: await getSetting<string | null>(SECURITY_QUESTION_KEY, null),
    [SECURITY_ANSWER_KEY]: await getSetting<string | null>(SECURITY_ANSWER_KEY, null),
    [SECURITY_ANSWER_SALT_KEY]: await getSetting<string | null>(SECURITY_ANSWER_SALT_KEY, null),
  };
};

export interface BiometricStatus {
  isAvailable: boolean;
  biometryType: 'fingerprint' | 'face' | 'iris' | 'none';
}

// Check if biometric authentication is available
// Note: Biometric plugin was removed - always returns unavailable
export const checkBiometricAvailability = async (): Promise<BiometricStatus> => {
  // Biometric authentication is not currently available
  // The capacitor-native-biometric plugin was removed due to compatibility issues
  console.log('Biometric authentication not available - plugin removed');
  return { isAvailable: false, biometryType: 'none' };
};

// Authenticate using biometrics
// Note: Biometric plugin was removed - always returns false
export const authenticateWithBiometric = async (reason?: string): Promise<boolean> => {
  // Biometric authentication is not currently available
  // The capacitor-native-biometric plugin was removed due to compatibility issues
  console.log('Biometric authentication not available - plugin removed');
  return false;
};

// Generate a random salt for password hashing
const generateSalt = (): string => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Convert ArrayBuffer to hex string
const bufferToHex = (buffer: ArrayBuffer): string => {
  return Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

// Hash password using Web Crypto API with PBKDF2
const hashPasswordAsync = async (password: string, salt: string): Promise<string> => {
  try {
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);
    const saltData = encoder.encode(salt);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordData,
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltData,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );

    return bufferToHex(derivedBits);
  } catch (error) {
    console.error('Error hashing password:', error);
    return fallbackHash(password + salt);
  }
};

// Fallback hash for environments without Web Crypto API
const fallbackHash = (input: string): string => {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'fallback_' + Math.abs(hash).toString(36);
};

// Synchronous hash for backward compatibility
export const hashPassword = (password: string): string => {
  const existingSalt = settingsCache[HIDDEN_NOTES_SALT_KEY];
  if (existingSalt) {
    console.warn('hashPassword called with new salt format - use hashPasswordSecure instead');
  }
  
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36) + password.length.toString(36);
};

// Async secure password hashing
export const hashPasswordSecure = async (password: string, salt?: string): Promise<{ hash: string; salt: string }> => {
  const useSalt = salt || generateSalt();
  const hash = await hashPasswordAsync(password, useSalt);
  return { hash, salt: useSalt };
};

// Verify password (supports both legacy and new format)
export const verifyPassword = async (password: string, hashedPassword: string, salt?: string): Promise<boolean> => {
  if (salt) {
    const { hash } = await hashPasswordSecure(password, salt);
    return hash === hashedPassword;
  }
  return hashPassword(password) === hashedPassword;
};

// Get hidden notes password settings
export const getHiddenNotesSettings = (): { hasPassword: boolean; useBiometric: boolean } => {
  const password = settingsCache[HIDDEN_NOTES_PASSWORD_KEY];
  const useBiometric = settingsCache[HIDDEN_NOTES_USE_BIOMETRIC_KEY] === true;
  return {
    hasPassword: !!password,
    useBiometric,
  };
};

// Set hidden notes password (async, secure)
export const setHiddenNotesPassword = async (password: string): Promise<void> => {
  const { hash, salt } = await hashPasswordSecure(password);
  settingsCache[HIDDEN_NOTES_PASSWORD_KEY] = hash;
  settingsCache[HIDDEN_NOTES_SALT_KEY] = salt;
  await setSetting(HIDDEN_NOTES_PASSWORD_KEY, hash);
  await setSetting(HIDDEN_NOTES_SALT_KEY, salt);
};

// Verify hidden notes password (async)
export const verifyHiddenNotesPassword = async (password: string): Promise<boolean> => {
  const storedHash = settingsCache[HIDDEN_NOTES_PASSWORD_KEY];
  const storedSalt = settingsCache[HIDDEN_NOTES_SALT_KEY];
  
  if (!storedHash) return false;
  
  return verifyPassword(password, storedHash, storedSalt || undefined);
};

// Enable/disable biometric for hidden notes
export const setHiddenNotesBiometric = async (enabled: boolean): Promise<void> => {
  settingsCache[HIDDEN_NOTES_USE_BIOMETRIC_KEY] = enabled;
  await setSetting(HIDDEN_NOTES_USE_BIOMETRIC_KEY, enabled);
};

// Clear hidden notes protection
export const clearHiddenNotesProtection = async (): Promise<void> => {
  settingsCache[HIDDEN_NOTES_PASSWORD_KEY] = null;
  settingsCache[HIDDEN_NOTES_SALT_KEY] = null;
  settingsCache[HIDDEN_NOTES_USE_BIOMETRIC_KEY] = false;
  await removeSetting(HIDDEN_NOTES_PASSWORD_KEY);
  await removeSetting(HIDDEN_NOTES_SALT_KEY);
  await removeSetting(HIDDEN_NOTES_USE_BIOMETRIC_KEY);
};

// Security Question functions
export const setSecurityQuestion = async (question: string, answer: string): Promise<void> => {
  const normalized = answer.toLowerCase().trim();
  const { hash, salt } = await hashPasswordSecure(normalized);
  settingsCache[SECURITY_QUESTION_KEY] = question;
  settingsCache[SECURITY_ANSWER_KEY] = hash;
  settingsCache[SECURITY_ANSWER_SALT_KEY] = salt;
  await setSetting(SECURITY_QUESTION_KEY, question);
  await setSetting(SECURITY_ANSWER_KEY, hash);
  await setSetting(SECURITY_ANSWER_SALT_KEY, salt);
};

export const getSecurityQuestion = (): string | null => {
  return settingsCache[SECURITY_QUESTION_KEY] || null;
};

export const verifySecurityAnswer = async (answer: string): Promise<boolean> => {
  const storedHash = settingsCache[SECURITY_ANSWER_KEY];
  const storedSalt = settingsCache[SECURITY_ANSWER_SALT_KEY];
  
  if (!storedHash) return false;
  
  const normalized = answer.toLowerCase().trim();
  return verifyPassword(normalized, storedHash, storedSalt || undefined);
};

export const hasSecurityQuestion = (): boolean => {
  return !!settingsCache[SECURITY_QUESTION_KEY] && !!settingsCache[SECURITY_ANSWER_KEY];
};

export const clearSecurityQuestion = async (): Promise<void> => {
  settingsCache[SECURITY_QUESTION_KEY] = null;
  settingsCache[SECURITY_ANSWER_KEY] = null;
  settingsCache[SECURITY_ANSWER_SALT_KEY] = null;
  await removeSetting(SECURITY_QUESTION_KEY);
  await removeSetting(SECURITY_ANSWER_KEY);
  await removeSetting(SECURITY_ANSWER_SALT_KEY);
};

// Authenticate for hidden notes access
export const authenticateForHiddenNotes = async (password?: string): Promise<boolean> => {
  const settings = getHiddenNotesSettings();
  const t = i18n.t.bind(i18n);
  
  if (!settings.hasPassword && !settings.useBiometric) {
    return true;
  }

  if (settings.useBiometric) {
    const biometricResult = await authenticateWithBiometric(t('biometric.accessHiddenNotes'));
    if (biometricResult) return true;
  }

  if (password && settings.hasPassword) {
    return verifyHiddenNotesPassword(password);
  }

  return false;
};

// Per-note protection
export interface NoteProtection {
  hasPassword: boolean;
  useBiometric: boolean;
}

const getNoteProtectionKey = (noteId: string) => `npd_note_protection_${noteId}`;
const getNotePasswordKey = (noteId: string) => `npd_note_password_${noteId}`;
const getNoteSaltKey = (noteId: string) => `npd_note_salt_${noteId}`;

export const getNoteProtection = async (noteId: string): Promise<NoteProtection> => {
  const data = await getSetting<NoteProtection | null>(getNoteProtectionKey(noteId), null);
  if (!data) return { hasPassword: false, useBiometric: false };
  return data;
};

export const setNoteProtection = async (noteId: string, protection: NoteProtection, password?: string): Promise<void> => {
  await setSetting(getNoteProtectionKey(noteId), protection);
  if (password) {
    const { hash, salt } = await hashPasswordSecure(password);
    await setSetting(getNotePasswordKey(noteId), hash);
    await setSetting(getNoteSaltKey(noteId), salt);
  } else if (!protection.hasPassword) {
    await removeSetting(getNotePasswordKey(noteId));
    await removeSetting(getNoteSaltKey(noteId));
  }
};

export const verifyNotePassword = async (noteId: string, password: string): Promise<boolean> => {
  const storedHash = await getSetting<string | null>(getNotePasswordKey(noteId), null);
  const storedSalt = await getSetting<string | null>(getNoteSaltKey(noteId), null);
  
  if (!storedHash) return false;
  
  return verifyPassword(password, storedHash, storedSalt || undefined);
};

export const authenticateForNote = async (noteId: string, password?: string): Promise<boolean> => {
  const protection = await getNoteProtection(noteId);
  const t = i18n.t.bind(i18n);
  
  if (!protection.hasPassword && !protection.useBiometric) {
    return true;
  }

  if (protection.useBiometric) {
    const biometricResult = await authenticateWithBiometric(t('biometric.unlockProtectedNote'));
    if (biometricResult) return true;
  }

  if (password && protection.hasPassword) {
    return verifyNotePassword(noteId, password);
  }

  return false;
};

export const removeNoteProtection = async (noteId: string): Promise<void> => {
  await removeSetting(getNoteProtectionKey(noteId));
  await removeSetting(getNotePasswordKey(noteId));
  await removeSetting(getNoteSaltKey(noteId));
};