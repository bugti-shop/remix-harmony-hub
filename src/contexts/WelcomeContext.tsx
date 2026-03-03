import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getSetting, setSetting, removeSetting } from '@/utils/settingsStorage';

interface WelcomeContextType {
  hasSeenWelcome: boolean;
  isLoading: boolean;
  completeWelcome: () => void;
  resetWelcome: () => void;
}

const WelcomeContext = createContext<WelcomeContextType | undefined>(undefined);

// Check if app was launched from a notification action (skip welcome/loading)
const isNotificationLaunch = (): boolean => {
  // Check sessionStorage for pending notification action
  const pendingAction = sessionStorage.getItem('pendingNotificationAction');
  if (pendingAction) return true;
  
  // Check URL for notification launch parameter
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.has('fromNotification');
};

export function WelcomeProvider({ children }: { children: ReactNode }) {
  // If launched from notification, assume welcome is seen (fast path)
  const notificationLaunch = isNotificationLaunch();
  const [hasSeenWelcome, setHasSeenWelcome] = useState<boolean>(notificationLaunch);
  const [isLoading, setIsLoading] = useState(!notificationLaunch);

  useEffect(() => {
    // If notification launch, skip the async check entirely
    if (notificationLaunch) {
      // Still save that welcome was seen (in case it wasn't)
      setSetting('hasSeenWelcome', true);
      return;
    }
    
    const loadWelcomeState = async () => {
      const seen = await getSetting<boolean>('hasSeenWelcome', false);
      setHasSeenWelcome(seen);
      setIsLoading(false);
    };
    loadWelcomeState();
  }, [notificationLaunch]);

  const completeWelcome = () => {
    setHasSeenWelcome(true);
    setSetting('hasSeenWelcome', true);
  };

  const resetWelcome = async () => {
    setHasSeenWelcome(false);
    await removeSetting('hasSeenWelcome');
    await removeSetting('npd_admin_bypass');
    await removeSetting('npd_trial_start');
    sessionStorage.removeItem('npd_trial_warning_shown');
  };

  return (
    <WelcomeContext.Provider value={{ hasSeenWelcome, isLoading, completeWelcome, resetWelcome }}>
      {children}
    </WelcomeContext.Provider>
  );
}

export function useWelcome() {
  const context = useContext(WelcomeContext);
  if (context === undefined) {
    throw new Error('useWelcome must be used within a WelcomeProvider');
  }
  return context;
}
