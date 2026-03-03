import { ReactNode, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App } from '@capacitor/app';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';

// Navigation history stack for proper back navigation
const navigationHistory: string[] = [];

// Home screens that should exit app when back is pressed
const HOME_SCREENS = ['/', '/todo/today'];

// Note: Sheet handling is now done via useHardwareBackButton with priority='sheet'
// These exports are kept for backward compatibility but are no longer used
export const hasOpenSheets = () => false;
export const registerSheetHandler = (_id: string, _callback: () => void) => {};
export const unregisterSheetHandler = (_id: string) => {};
export const closeTopSheet = () => false;

interface NavigationBackProviderProps {
  children: ReactNode;
}

export const NavigationBackProvider = ({ children }: NavigationBackProviderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const previousPathRef = useRef<string | null>(null);

  // Track navigation history - only add if different from last entry
  useEffect(() => {
    if (previousPathRef.current !== currentPath) {
      // Don't add duplicates at the end
      if (navigationHistory[navigationHistory.length - 1] !== currentPath) {
        navigationHistory.push(currentPath);
        // Keep history manageable
        if (navigationHistory.length > 50) {
          navigationHistory.shift();
        }
      }
      previousPathRef.current = currentPath;
    }
  }, [currentPath]);

  const handleBackButton = useCallback(() => {
    // If on home screen and it's the only/first entry, exit the app
    if (HOME_SCREENS.includes(currentPath)) {
      // Check if there's any history to go back to
      if (navigationHistory.length <= 1) {
        App.exitApp();
        return;
      }
      
      // If we have history, go back to the previous non-home screen
      // Pop current from history
      navigationHistory.pop();
      const previousRoute = navigationHistory[navigationHistory.length - 1];
      
      if (previousRoute && !HOME_SCREENS.includes(previousRoute)) {
        navigate(previousRoute);
        return;
      }
      
      // If previous was also a home screen, exit app
      App.exitApp();
      return;
    }

    // Not on home screen - go back in history
    if (navigationHistory.length > 1) {
      // Pop current route
      navigationHistory.pop();
      // Get previous route
      const previousRoute = navigationHistory[navigationHistory.length - 1];
      if (previousRoute) {
        navigate(previousRoute);
        return;
      }
    }

    // Fallback: go to appropriate home based on current section
    if (currentPath.startsWith('/todo')) {
      navigate('/todo/today');
    } else {
      navigate('/');
    }
  }, [currentPath, navigate]);

  // Default navigation back handler (lowest priority; screens can override)
  useHardwareBackButton({
    onBack: handleBackButton,
    enabled: true,
    priority: 'navigation',
  });

  return <>{children}</>;
};

export default NavigationBackProvider;
