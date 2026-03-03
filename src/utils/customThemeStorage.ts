import { getSetting, setSetting } from './settingsStorage';

export interface CustomTheme {
  id: string;
  name: string;
  colors: {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    border: string;
    input: string;
  };
  createdAt: number;
}

const STORAGE_KEY = 'custom_themes';
const ACTIVE_KEY = 'active_custom_theme';

export const getCustomThemes = async (): Promise<CustomTheme[]> => {
  return getSetting<CustomTheme[]>(STORAGE_KEY, []);
};

export const saveCustomTheme = async (theme: CustomTheme): Promise<void> => {
  const themes = await getCustomThemes();
  const existingIndex = themes.findIndex(t => t.id === theme.id);
  if (existingIndex >= 0) {
    themes[existingIndex] = theme;
  } else {
    themes.push(theme);
  }
  await setSetting(STORAGE_KEY, themes);
};

export const deleteCustomTheme = async (id: string): Promise<void> => {
  const themes = await getCustomThemes();
  await setSetting(STORAGE_KEY, themes.filter(t => t.id !== id));
  const active = await getActiveCustomThemeId();
  if (active === id) {
    await setSetting(ACTIVE_KEY, null);
  }
};

export const getActiveCustomThemeId = async (): Promise<string | null> => {
  return getSetting<string | null>(ACTIVE_KEY, null);
};

export const setActiveCustomThemeId = async (id: string | null): Promise<void> => {
  await setSetting(ACTIVE_KEY, id);
};

export const applyCustomTheme = (theme: CustomTheme) => {
  const root = document.documentElement;
  const c = theme.colors;
  root.style.setProperty('--background', c.background);
  root.style.setProperty('--foreground', c.foreground);
  root.style.setProperty('--card', c.card);
  root.style.setProperty('--card-foreground', c.cardForeground);
  root.style.setProperty('--popover', c.card);
  root.style.setProperty('--popover-foreground', c.cardForeground);
  root.style.setProperty('--primary', c.primary);
  root.style.setProperty('--primary-foreground', c.primaryForeground);
  root.style.setProperty('--secondary', c.secondary);
  root.style.setProperty('--secondary-foreground', c.secondaryForeground);
  root.style.setProperty('--muted', c.muted);
  root.style.setProperty('--muted-foreground', c.mutedForeground);
  root.style.setProperty('--accent', c.accent);
  root.style.setProperty('--accent-foreground', c.accentForeground);
  root.style.setProperty('--border', c.border);
  root.style.setProperty('--input', c.input);
};

export const clearCustomThemeStyles = () => {
  const root = document.documentElement;
  const props = [
    '--background', '--foreground', '--card', '--card-foreground',
    '--popover', '--popover-foreground', '--primary', '--primary-foreground',
    '--secondary', '--secondary-foreground', '--muted', '--muted-foreground',
    '--accent', '--accent-foreground', '--border', '--input',
  ];
  props.forEach(p => root.style.removeProperty(p));
};

// Preset starter palettes for inspiration
export const themePresets: Omit<CustomTheme, 'id' | 'createdAt'>[] = [
  {
    name: 'Cherry Blossom',
    colors: {
      background: '350 30% 12%',
      foreground: '350 20% 95%',
      card: '350 28% 14%',
      cardForeground: '350 20% 95%',
      primary: '340 75% 65%',
      primaryForeground: '0 0% 100%',
      secondary: '350 20% 18%',
      secondaryForeground: '350 20% 95%',
      muted: '350 18% 18%',
      mutedForeground: '350 15% 70%',
      accent: '340 60% 25%',
      accentForeground: '350 20% 95%',
      border: '350 15% 22%',
      input: '350 15% 22%',
    },
  },
  {
    name: 'Arctic Aurora',
    colors: {
      background: '200 40% 8%',
      foreground: '180 20% 95%',
      card: '200 38% 10%',
      cardForeground: '180 20% 95%',
      primary: '160 80% 50%',
      primaryForeground: '0 0% 5%',
      secondary: '200 30% 14%',
      secondaryForeground: '180 20% 95%',
      muted: '200 25% 14%',
      mutedForeground: '190 15% 65%',
      accent: '170 50% 20%',
      accentForeground: '180 20% 95%',
      border: '200 20% 18%',
      input: '200 20% 18%',
    },
  },
  {
    name: 'Golden Hour',
    colors: {
      background: '35 30% 10%',
      foreground: '40 30% 95%',
      card: '35 28% 12%',
      cardForeground: '40 30% 95%',
      primary: '40 90% 55%',
      primaryForeground: '0 0% 5%',
      secondary: '35 20% 16%',
      secondaryForeground: '40 30% 95%',
      muted: '35 18% 16%',
      mutedForeground: '35 15% 65%',
      accent: '30 50% 22%',
      accentForeground: '40 30% 95%',
      border: '35 15% 20%',
      input: '35 15% 20%',
    },
  },
  {
    name: 'Lavender Dream',
    colors: {
      background: '265 25% 12%',
      foreground: '260 20% 95%',
      card: '265 23% 14%',
      cardForeground: '260 20% 95%',
      primary: '265 70% 65%',
      primaryForeground: '0 0% 100%',
      secondary: '265 18% 18%',
      secondaryForeground: '260 20% 95%',
      muted: '265 15% 18%',
      mutedForeground: '260 12% 65%',
      accent: '270 40% 25%',
      accentForeground: '260 20% 95%',
      border: '265 12% 22%',
      input: '265 12% 22%',
    },
  },
  {
    name: 'Cream Light',
    colors: {
      background: '40 30% 96%',
      foreground: '30 20% 15%',
      card: '40 25% 98%',
      cardForeground: '30 20% 15%',
      primary: '25 85% 55%',
      primaryForeground: '0 0% 100%',
      secondary: '40 20% 90%',
      secondaryForeground: '30 20% 15%',
      muted: '40 15% 92%',
      mutedForeground: '30 10% 50%',
      accent: '35 30% 88%',
      accentForeground: '30 20% 15%',
      border: '40 15% 85%',
      input: '40 15% 85%',
    },
  },
];
