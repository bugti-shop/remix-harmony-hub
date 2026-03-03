import { z } from 'zod';
import i18n from '@/i18n';
import { toast } from 'sonner';

// ─── User-Friendly Error Messages ───

export const getUserFriendlyError = (error: any): string => {
  const t = i18n.t.bind(i18n);
  const message = error?.message || error?.toString() || '';

  // Auth errors
  if (message.includes('Invalid login credentials')) return t('authErrors.invalidCredentials');
  if (message.includes('Email not confirmed')) return t('authErrors.emailNotConfirmed');
  if (message.includes('User already registered')) return t('authErrors.userAlreadyRegistered');
  if (message.includes('Password should be')) return t('authErrors.passwordRequirements');

  // Rate limiting
  if (message.includes('rate limit') || message.includes('Too many requests')) {
    return t('errors.rateLimit', 'Too many attempts. Please wait a moment and try again.');
  }

  // Network errors
  if (message.includes('network') || message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('ERR_INTERNET_DISCONNECTED')) {
    return t('errors.network', 'Network error. Please check your internet connection and try again.');
  }

  // Storage errors
  if (message.includes('QuotaExceededError') || message.includes('storage quota') || message.includes('QUOTA_BYTES')) {
    return t('errors.storageFull', 'Storage is full. Please free up space by deleting old notes or tasks.');
  }
  if (message.includes('IndexedDB') || message.includes('IDBDatabase')) {
    return t('errors.storageError', 'Failed to save data. Please try again.');
  }

  // Purchase errors
  if (message.includes('PURCHASE_CANCELLED') || message.includes('userCancelled')) {
    return t('errors.purchaseCancelled', 'Purchase was cancelled.');
  }
  if (message.includes('No offerings available') || message.includes('Package not found')) {
    return t('errors.purchaseUnavailable', 'This plan is currently unavailable. Please try again later.');
  }

  // Permission errors
  if (message.includes('permission') || message.includes('Permission denied') || message.includes('NotAllowedError')) {
    return t('errors.permissionDenied', 'Permission denied. Please check your app settings.');
  }

  // Sync/backup errors
  if (message.includes('sync') || message.includes('Google Drive')) {
    return t('errors.syncFailed', 'Sync failed. Please check your connection and try again.');
  }
  if (message.includes('backup') || message.includes('Backup')) {
    return t('errors.backupFailed', 'Backup failed. Please try again.');
  }

  // File errors
  if (message.includes('file') && (message.includes('too large') || message.includes('size'))) {
    return t('errors.fileTooLarge', 'File is too large. Please use a smaller file.');
  }

  // Generic fallback - don't show raw technical errors to users
  if (message.length > 100 || message.includes('Error:') || message.includes('TypeError') || message.includes('undefined')) {
    return t('errors.generic', 'Something went wrong. Please try again.');
  }

  return message || t('errors.generic', 'Something went wrong. Please try again.');
};

export const getValidationError = (error: z.ZodError): string => {
  const t = i18n.t.bind(i18n);
  const firstError = error.errors[0];
  return firstError?.message || t('authErrors.validationError');
};

// ─── Error Toast Utility ───

type ErrorSeverity = 'error' | 'warning' | 'info';

interface ShowErrorOptions {
  /** Error severity - determines toast style */
  severity?: ErrorSeverity;
  /** Custom title override */
  title?: string;
  /** Duration in ms (default: 4000) */
  duration?: number;
  /** Whether to log to console (default: true) */
  log?: boolean;
}

/**
 * Show a user-friendly error toast. Converts technical errors to readable messages.
 * Use this instead of console.error for user-facing errors.
 */
export const showErrorToast = (error: any, options: ShowErrorOptions = {}) => {
  const { severity = 'error', title, duration = 4000, log = true } = options;
  const message = getUserFriendlyError(error);

  if (log) {
    console.error('[App Error]', error);
  }

  const toastTitle = title || (severity === 'warning' ? '⚠️ Warning' : '❌ Error');

  if (severity === 'warning') {
    toast.warning(message, { duration });
  } else if (severity === 'info') {
    toast.info(message, { duration });
  } else {
    toast.error(message, { duration });
  }

  return message;
};

/**
 * Wraps an async function with error handling. Shows toast on failure.
 */
export const withErrorHandling = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: ShowErrorOptions = {}
): ((...args: Parameters<T>) => Promise<ReturnType<T> | undefined>) => {
  return async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      showErrorToast(error, options);
      return undefined;
    }
  };
};
