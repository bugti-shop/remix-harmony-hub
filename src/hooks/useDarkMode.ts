import { useState, useEffect } from 'react';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import { updateStatusBarStyle } from '@/utils/statusBar';
import { clearCustomThemeStyles, setActiveCustomThemeId } from '@/utils/customThemeStorage';
export type ThemeId = 'light' | 'dark' | 'ocean' | 'forest' | 'sunset' | 'rose' | 'midnight' | 'minimal' | 'nebula' | 'obsidian' | 'graphite' | 'onyx' | 'charcoal' | 'custom';

export const themes = [
  { id: 'light' as const, name: 'Light Mode', preview: 'bg-white border border-border' },
  { id: 'dark' as const, name: 'Default Dark', preview: 'bg-gray-900' },
  { id: 'ocean' as const, name: 'Ocean Blue', preview: 'bg-gradient-to-br from-blue-900 to-cyan-700' },
  { id: 'forest' as const, name: 'Forest Green', preview: 'bg-gradient-to-br from-green-900 to-emerald-700' },
  { id: 'sunset' as const, name: 'Sunset Orange', preview: 'bg-gradient-to-br from-orange-900 to-rose-700' },
  { id: 'rose' as const, name: 'Rose Gold', preview: 'bg-gradient-to-br from-rose-900 to-pink-700' },
  { id: 'midnight' as const, name: 'Midnight Purple', preview: 'bg-gradient-to-br from-purple-900 to-indigo-700' },
  { id: 'minimal' as const, name: 'Minimal Gray', preview: 'bg-gradient-to-br from-gray-800 to-slate-700' },
  { id: 'nebula' as const, name: 'Nebula', preview: 'bg-gradient-to-br from-purple-950 to-pink-800' },
  { id: 'obsidian' as const, name: 'Obsidian', preview: 'bg-gradient-to-br from-slate-950 to-blue-950' },
  { id: 'graphite' as const, name: 'Graphite', preview: 'bg-gradient-to-br from-slate-900 to-slate-700' },
  { id: 'onyx' as const, name: 'Onyx', preview: 'bg-gradient-to-br from-black to-gray-900' },
  { id: 'charcoal' as const, name: 'Charcoal', preview: 'bg-gradient-to-br from-stone-900 to-stone-700' },
];

const allThemeClasses: ThemeId[] = ['light', 'dark', 'ocean', 'forest', 'sunset', 'rose', 'midnight', 'minimal', 'nebula', 'obsidian', 'graphite', 'onyx', 'charcoal', 'custom'];
const darkThemes: ThemeId[] = ['dark', 'ocean', 'forest', 'sunset', 'rose', 'midnight', 'minimal', 'nebula', 'obsidian', 'graphite', 'onyx', 'charcoal'];

export const useDarkMode = () => {
  const [currentTheme, setCurrentTheme] = useState<ThemeId>('light');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load theme from IndexedDB on mount
  useEffect(() => {
    const loadTheme = async () => {
      const saved = await getSetting<string>('theme', 'light');
      if (saved && allThemeClasses.includes(saved as ThemeId)) {
        setCurrentTheme(saved as ThemeId);
      } else {
        // Check for old darkMode setting
        const oldDarkMode = await getSetting<boolean>('darkMode', false);
        setCurrentTheme(oldDarkMode ? 'dark' : 'light');
      }
      setIsLoaded(true);
    };
    loadTheme();
  }, []);

  const isDarkMode = currentTheme !== 'light';

  useEffect(() => {
    if (!isLoaded) return;
    
    setSetting('theme', currentTheme);
    
    // Remove all theme classes first
    allThemeClasses.forEach(cls => {
      document.documentElement.classList.remove(cls);
    });
    
    // Add the current theme class (only add if not light)
    if (currentTheme !== 'light') {
      document.documentElement.classList.add(currentTheme);
    }
    
    // Update status bar to match theme
    updateStatusBarStyle(currentTheme !== 'light');
  }, [currentTheme, isLoaded]);

  // Cycle through all dark themes on toggle
  const toggleDarkMode = () => {
    setCurrentTheme(prev => {
      // If currently light, go to first dark theme
      if (prev === 'light') {
        return 'dark';
      }
      // Find current dark theme index and go to next
      const currentIndex = darkThemes.indexOf(prev);
      const nextIndex = (currentIndex + 1) % (darkThemes.length + 1);
      // If we've cycled through all dark themes, go back to light
      if (nextIndex === darkThemes.length) {
        return 'light';
      }
      return darkThemes[nextIndex];
    });
  };

  const setTheme = (themeId: ThemeId) => {
    if (themeId !== 'custom') {
      clearCustomThemeStyles();
      setActiveCustomThemeId(null);
    }
    setCurrentTheme(themeId);
  };

  return { isDarkMode, toggleDarkMode, currentTheme, setTheme, themes };
};
