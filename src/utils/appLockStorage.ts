// IndexedDB storage for App Lock feature
// Stores PIN, security questions, biometric settings, and lock timing

import { getSetting, setSetting, removeSetting } from './settingsStorage';

// Types
export interface SecurityQuestion {
  question: string;
  answer: string;
}

export type LockTiming = 'immediately' | '30seconds' | '1minute' | '5minutes' | '15minutes' | '30minutes';

export interface AppLockSettings {
  isEnabled: boolean;
  pinHash: string | null;
  securityQuestions: SecurityQuestion[];
  biometricEnabled: boolean;
  lockTiming: LockTiming;
  lastUnlockTime: number | null;
}

const DEFAULT_SETTINGS: AppLockSettings = {
  isEnabled: false,
  pinHash: null,
  securityQuestions: [],
  biometricEnabled: false,
  lockTiming: 'immediately',
  lastUnlockTime: null,
};

// Simple hash function for PIN (not cryptographically secure, but sufficient for local app lock)
export const hashPin = async (pin: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'npd-salt-2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Verify PIN
export const verifyPin = async (pin: string, storedHash: string): Promise<boolean> => {
  const inputHash = await hashPin(pin);
  return inputHash === storedHash;
};

// Get lock settings
export const getAppLockSettings = async (): Promise<AppLockSettings> => {
  return getSetting<AppLockSettings>('appLockSettings', DEFAULT_SETTINGS);
};

// Save lock settings
export const saveAppLockSettings = async (settings: AppLockSettings): Promise<void> => {
  await setSetting('appLockSettings', settings);
  // Dispatch event for sync
  window.dispatchEvent(new CustomEvent('appLockUpdated'));
};

// Enable app lock with PIN
export const enableAppLock = async (pin: string, securityQuestions: SecurityQuestion[]): Promise<void> => {
  const pinHash = await hashPin(pin);
  const settings = await getAppLockSettings();
  await saveAppLockSettings({
    ...settings,
    isEnabled: true,
    pinHash,
    securityQuestions,
    lastUnlockTime: Date.now(),
  });
};

// Disable app lock
export const disableAppLock = async (): Promise<void> => {
  await saveAppLockSettings(DEFAULT_SETTINGS);
};

// Update biometric setting
export const setBiometricEnabled = async (enabled: boolean): Promise<void> => {
  const settings = await getAppLockSettings();
  await saveAppLockSettings({
    ...settings,
    biometricEnabled: enabled,
  });
};

// Update lock timing
export const setLockTiming = async (timing: LockTiming): Promise<void> => {
  const settings = await getAppLockSettings();
  await saveAppLockSettings({
    ...settings,
    lockTiming: timing,
  });
};

// Update last unlock time
export const updateLastUnlockTime = async (): Promise<void> => {
  const settings = await getAppLockSettings();
  await saveAppLockSettings({
    ...settings,
    lastUnlockTime: Date.now(),
  });
};

// Check if app should be locked based on timing
export const shouldAppBeLocked = async (): Promise<boolean> => {
  const settings = await getAppLockSettings();
  
  if (!settings.isEnabled || !settings.pinHash) {
    return false;
  }
  
  if (!settings.lastUnlockTime) {
    return true;
  }
  
  const now = Date.now();
  const elapsed = now - settings.lastUnlockTime;
  
  const timingMs: Record<LockTiming, number> = {
    'immediately': 0,
    '30seconds': 30 * 1000,
    '1minute': 60 * 1000,
    '5minutes': 5 * 60 * 1000,
    '15minutes': 15 * 60 * 1000,
    '30minutes': 30 * 60 * 1000,
  };
  
  return elapsed >= timingMs[settings.lockTiming];
};

// Verify security question answer
export const verifySecurityAnswer = async (questionIndex: number, answer: string): Promise<boolean> => {
  const settings = await getAppLockSettings();
  if (!settings.securityQuestions[questionIndex]) {
    return false;
  }
  return settings.securityQuestions[questionIndex].answer.toLowerCase().trim() === answer.toLowerCase().trim();
};

// Reset PIN using security questions
export const resetPinWithSecurityQuestions = async (newPin: string): Promise<void> => {
  const settings = await getAppLockSettings();
  const pinHash = await hashPin(newPin);
  await saveAppLockSettings({
    ...settings,
    pinHash,
    lastUnlockTime: Date.now(),
  });
};

// Change PIN (requires verification of old PIN first)
export const changePin = async (oldPin: string, newPin: string): Promise<boolean> => {
  const settings = await getAppLockSettings();
  if (!settings.pinHash) return false;
  
  const isValid = await verifyPin(oldPin, settings.pinHash);
  if (!isValid) return false;
  
  const newPinHash = await hashPin(newPin);
  await saveAppLockSettings({
    ...settings,
    pinHash: newPinHash,
    lastUnlockTime: Date.now(),
  });
  
  return true;
};

// Predefined security questions
export const SECURITY_QUESTIONS = [
  "appLock.questionMother",
  "appLock.questionPet",
  "appLock.questionCity",
  "appLock.questionMovie",
  "appLock.questionNickname",
  "appLock.questionTeacher",
  "appLock.questionCar",
  "appLock.questionFood",
];

// Lock timing options with i18n keys
export const LOCK_TIMING_OPTIONS: { value: LockTiming; label: string }[] = [
  { value: 'immediately', label: 'appLock.timingImmediately' },
  { value: '30seconds', label: 'appLock.timing30seconds' },
  { value: '1minute', label: 'appLock.timing1minute' },
  { value: '5minutes', label: 'appLock.timing5minutes' },
  { value: '15minutes', label: 'appLock.timing15minutes' },
  { value: '30minutes', label: 'appLock.timing30minutes' },
];
