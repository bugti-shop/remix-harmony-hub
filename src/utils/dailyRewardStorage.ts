import { getSetting, setSetting } from './settingsStorage';
import { format, differenceInCalendarDays, startOfDay } from 'date-fns';

const STORAGE_KEY = 'npd_daily_login_reward';

export interface DailyRewardData {
  currentDay: number;       // 1-7
  lastClaimDate: string | null; // 'yyyy-MM-dd'
  totalClaimed: number;
  completedCycles: number;  // full 7-day cycles completed
}

export const DAILY_REWARDS = [
  { day: 1, icon: '💎', label: 'Gem' },
  { day: 2, icon: '🎁', label: 'Treasure' },
  { day: 3, icon: '⚡', label: 'Energy' },
  { day: 4, icon: '🔮', label: 'Crystal' },
  { day: 5, icon: '🏅', label: 'Medal' },
  { day: 6, icon: '👑', label: 'Crown' },
  { day: 7, icon: '🏆', label: 'Trophy' },
] as const;

const getDefault = (): DailyRewardData => ({
  currentDay: 1,
  lastClaimDate: null,
  totalClaimed: 0,
  completedCycles: 0,
});

export const loadDailyRewardData = async (): Promise<DailyRewardData> => {
  return getSetting<DailyRewardData>(STORAGE_KEY, getDefault());
};

export const checkDailyReward = async (): Promise<{
  canClaim: boolean;
  currentDay: number;
  data: DailyRewardData;
}> => {
  const data = await loadDailyRewardData();
  const today = format(new Date(), 'yyyy-MM-dd');

  // Already claimed today
  if (data.lastClaimDate === today) {
    return { canClaim: false, currentDay: data.currentDay, data };
  }

  // Check if they missed a day → reset
  if (data.lastClaimDate) {
    const daysDiff = differenceInCalendarDays(
      startOfDay(new Date()),
      startOfDay(new Date(data.lastClaimDate))
    );
    if (daysDiff > 1) {
      // Missed a day, reset cycle
      data.currentDay = 1;
    } else if (daysDiff === 1) {
      // Consecutive day, advance (or wrap after day 7)
      data.currentDay = data.currentDay >= 7 ? 1 : data.currentDay + 1;
    }
  }

  return { canClaim: true, currentDay: data.currentDay, data };
};

export const claimDailyReward = async (): Promise<{
  day: number;
  data: DailyRewardData;
}> => {
  const { canClaim, currentDay, data } = await checkDailyReward();
  if (!canClaim) {
    return { day: data.currentDay, data };
  }

  
  data.currentDay = currentDay;
  data.lastClaimDate = format(new Date(), 'yyyy-MM-dd');
  data.totalClaimed += 1;

  // Track completed cycles when Day 7 is claimed
  if (currentDay === 7) {
    data.completedCycles = (data.completedCycles || 0) + 1;
  }

  await setSetting(STORAGE_KEY, data);

  return { day: currentDay, data };
};
