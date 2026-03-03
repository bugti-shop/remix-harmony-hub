import { useState, useEffect } from 'react';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import defaultLogo from '@/assets/app-logo.png';
import sadLogo from '@/assets/sad-logo.png';
import angryLogo from '@/assets/angry-logo.png';

const LAST_OPEN_KEY = 'lastAppOpenTime';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TWO_DAYS_MS = 2 * ONE_DAY_MS;

export type RetentionMood = 'default' | 'sad' | 'angry';

export interface RetentionLogoResult {
  logo: string;
  mood: RetentionMood;
  /** How many days the user was absent (0 = active) */
  daysAway: number;
  /** True on this session if the user was away 1+ days */
  isReturning: boolean;
  /** Call to dismiss the returning state and reset to default */
  acknowledgeReturn: () => void;
}

/**
 * Retention logos:
 * - 1 day away → sad logo shown until user opens app (then resets to default)
 * - 2+ days away → angry/crash logo shown until user opens app (then resets to default)
 * - Active user → default logo
 */
export const useRetentionLogo = (): RetentionLogoResult => {
  const [logo, setLogo] = useState(defaultLogo);
  const [mood, setMood] = useState<RetentionMood>('default');
  const [daysAway, setDaysAway] = useState(0);
  const [isReturning, setIsReturning] = useState(false);

  useEffect(() => {
    const check = async () => {
      const lastOpen = await getSetting<number | null>(LAST_OPEN_KEY, null);
      const now = Date.now();

      if (lastOpen) {
        const elapsed = now - lastOpen;
        const days = Math.floor(elapsed / ONE_DAY_MS);
        setDaysAway(days);

        if (elapsed >= TWO_DAYS_MS) {
          setLogo(angryLogo);
          setMood('angry');
          setIsReturning(true);
        } else if (elapsed >= ONE_DAY_MS) {
          setLogo(sadLogo);
          setMood('sad');
          setIsReturning(true);
        }
      }

      await setSetting(LAST_OPEN_KEY, now);
    };

    check();
  }, []);

  const acknowledgeReturn = () => {
    setLogo(defaultLogo);
    setMood('default');
    setIsReturning(false);
    setDaysAway(0);
  };

  return { logo, mood, daysAway, isReturning, acknowledgeReturn };
};
