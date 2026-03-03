import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * Configure the Android/iOS status bar to blend seamlessly with the app
 */
export const configureStatusBar = async (isDarkMode: boolean) => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    // Make status bar overlay the WebView (transparent background)
    await StatusBar.setOverlaysWebView({ overlay: true });
    
    // Set status bar icons to contrast with app background
    // Dark mode = light icons, Light mode = dark icons
    await StatusBar.setStyle({
      style: isDarkMode ? Style.Dark : Style.Light,
    });

    // Set background color to transparent
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#00000000' });
    }

    console.log('[StatusBar] Configured successfully for', isDarkMode ? 'dark' : 'light', 'mode');
  } catch (error) {
    console.warn('[StatusBar] Configuration failed:', error);
  }
};

/**
 * Update status bar style when theme changes
 */
export const updateStatusBarStyle = async (isDarkMode: boolean) => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await StatusBar.setStyle({
      style: isDarkMode ? Style.Dark : Style.Light,
    });
  } catch (error) {
    console.warn('[StatusBar] Style update failed:', error);
  }
};
