import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

/**
 * Hook to detect keyboard height on mobile devices.
 * Uses Capacitor Keyboard plugin on native platforms for accurate detection.
 * Falls back to visualViewport API on web.
 * Updates CSS custom property --keyboard-inset for use in fixed position elements.
 */
export const useKeyboardHeight = () => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();

    // Native platform: Use Capacitor Keyboard plugin
    if (isNative) {
      let showListener: { remove: () => void } | null = null;
      let hideListener: { remove: () => void } | null = null;

      const setupNativeListeners = async () => {
        try {
          // Listen for keyboard show event
          showListener = await Keyboard.addListener('keyboardWillShow', (info) => {
            const height = info.keyboardHeight;
            setKeyboardHeight(height);
            document.documentElement.style.setProperty('--keyboard-inset', `${height}px`);
          });

          // Listen for keyboard hide event
          hideListener = await Keyboard.addListener('keyboardWillHide', () => {
            setKeyboardHeight(0);
            document.documentElement.style.setProperty('--keyboard-inset', '0px');
          });
        } catch (error) {
          console.error('[useKeyboardHeight] Failed to setup native keyboard listeners:', error);
        }
      };

      setupNativeListeners();

      return () => {
        showListener?.remove();
        hideListener?.remove();
        document.documentElement.style.setProperty('--keyboard-inset', '0px');
      };
    }

    // Web fallback: Use visualViewport API
    if (typeof window === 'undefined' || !window.visualViewport) {
      return;
    }

    const viewport = window.visualViewport;

    const handleResize = () => {
      // Calculate the difference between initial viewport and current viewport
      // When keyboard opens, visualViewport.height shrinks
      const currentHeight = viewport.height;
      const heightDiff = Math.max(0, window.innerHeight - currentHeight);
      
      // Only consider it a keyboard if the difference is significant (> 100px)
      const newKeyboardHeight = heightDiff > 100 ? heightDiff : 0;
      
      setKeyboardHeight(newKeyboardHeight);
      
      // Update CSS custom property for use in stylesheets
      document.documentElement.style.setProperty(
        '--keyboard-inset',
        `${newKeyboardHeight}px`
      );
    };

    // Initial check
    handleResize();

    viewport.addEventListener('resize', handleResize);
    viewport.addEventListener('scroll', handleResize);

    // Also listen for focus events on inputs to help detect keyboard
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Small delay to let keyboard animation start
        setTimeout(handleResize, 100);
        setTimeout(handleResize, 300);
      }
    };

    const handleBlur = () => {
      // Reset when input loses focus
      setTimeout(() => {
        setKeyboardHeight(0);
        document.documentElement.style.setProperty('--keyboard-inset', '0px');
      }, 100);
    };

    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);

    return () => {
      viewport.removeEventListener('resize', handleResize);
      viewport.removeEventListener('scroll', handleResize);
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
      document.documentElement.style.setProperty('--keyboard-inset', '0px');
    };
  }, []);

  return keyboardHeight;
};
