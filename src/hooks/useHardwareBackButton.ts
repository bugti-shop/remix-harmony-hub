import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

interface UseHardwareBackButtonOptions {
  onBack: () => void | Promise<void>;
  enabled?: boolean;
  priority?: 'sheet' | 'navigation'; // sheets take priority over navigation
}

// Global stack to manage multiple back button handlers
const backHandlerStack: Array<{
  id: string;
  callback: () => void | Promise<void>;
  priority: 'sheet' | 'navigation';
}> = [];
let globalListenerSetup = false;

const setupGlobalListener = () => {
  if (globalListenerSetup || !Capacitor.isNativePlatform()) return;

  globalListenerSetup = true;

  App.addListener('backButton', () => {
    if (backHandlerStack.length === 0) return;

    // Find the most recent sheet handler (highest priority)
    const mostRecentSheet = [...backHandlerStack]
      .reverse()
      .find((h) => h.priority === 'sheet');

    // If a sheet is open, close it instead of navigating
    if (mostRecentSheet) {
      Promise.resolve(mostRecentSheet.callback()).catch((err) => {
        console.error('Hardware back handler failed:', err);
      });
      return;
    }

    // No sheets open, use the most recent navigation handler
    const handler = backHandlerStack[backHandlerStack.length - 1];
    if (handler) {
      Promise.resolve(handler.callback()).catch((err) => {
        console.error('Hardware back handler failed:', err);
      });
    }
  });
};

/**
 * Hook to handle Android hardware back button press
 * Handlers are stacked - most recently enabled handler gets called first
 * Sheets and modals take priority over navigation handlers
 */
export const useHardwareBackButton = ({
  onBack,
  enabled = true,
  priority = 'navigation',
}: UseHardwareBackButtonOptions) => {
  const handlerId = useRef(`handler-${Date.now()}-${Math.random()}`);
  const callbackRef = useRef(onBack);
  
  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    
    setupGlobalListener();
    
    const id = handlerId.current;
    
    if (enabled) {
      backHandlerStack.push({
        id,
        callback: () => callbackRef.current(),
        priority,
      });
    }

    return () => {
      // Remove from stack
      const index = backHandlerStack.findIndex(h => h.id === id);
      if (index !== -1) {
        backHandlerStack.splice(index, 1);
      }
    };
  }, [enabled, priority]);
};

export default useHardwareBackButton;
