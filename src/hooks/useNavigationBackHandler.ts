import { useEffect, useRef } from 'react';
import { 
  hasOpenSheets, 
  closeTopSheet, 
  registerSheetHandler, 
  unregisterSheetHandler 
} from '@/components/NavigationBackProvider';

// Re-export for convenience
export { hasOpenSheets, closeTopSheet, registerSheetHandler, unregisterSheetHandler };

/**
 * Hook for sheets/modals to register their own back handler
 * When a sheet is open, back button should close the sheet instead of navigating
 */
export const useSheetBackHandler = (
  isOpen: boolean,
  onClose: () => void
) => {
  const handlerId = useRef(`sheet-${Date.now()}-${Math.random()}`);

  useEffect(() => {
    if (!isOpen) return;

    const id = handlerId.current;
    
    registerSheetHandler(id, onClose);

    return () => {
      unregisterSheetHandler(id);
    };
  }, [isOpen, onClose]);
};

export default useSheetBackHandler;
