// Gamification system: Achievements, Daily Challenges
// XP system has been removed

import { getSetting, setSetting } from './settingsStorage';
import { format } from 'date-fns';

// ==================== ACHIEVEMENTS/BADGES ====================

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'streak' | 'tasks' | 'consistency' | 'special';
  requirement: number;
  unlockedAt?: string;
}

export interface AchievementsData {
  unlockedAchievements: string[];
  achievementDates: Record<string, string>;
}

const ACHIEVEMENTS_STORAGE_KEY = 'npd_achievements';

export const ALL_ACHIEVEMENTS: Achievement[] = [
  // Streak achievements
  { id: 'streak_3', name: 'Getting Started', description: 'Maintain a 3-day streak', icon: '🌱', category: 'streak', requirement: 3 },
  { id: 'streak_7', name: 'Week Warrior', description: 'Maintain a 7-day streak', icon: '🔥', category: 'streak', requirement: 7 },
  { id: 'streak_14', name: 'Two Week Champion', description: 'Maintain a 14-day streak', icon: '⚡', category: 'streak', requirement: 14 },
  { id: 'streak_30', name: 'Monthly Master', description: 'Maintain a 30-day streak', icon: '🏆', category: 'streak', requirement: 30 },
  { id: 'streak_60', name: 'Unstoppable', description: 'Maintain a 60-day streak', icon: '💎', category: 'streak', requirement: 60 },
  { id: 'streak_100', name: 'Century Club', description: 'Maintain a 100-day streak', icon: '👑', category: 'streak', requirement: 100 },
  { id: 'streak_365', name: 'Year of Dedication', description: 'Maintain a 365-day streak', icon: '🌟', category: 'streak', requirement: 365 },
  
  // Task completion achievements
  { id: 'tasks_10', name: 'First Steps', description: 'Complete 10 tasks', icon: '📝', category: 'tasks', requirement: 10 },
  { id: 'tasks_50', name: 'Task Tackler', description: 'Complete 50 tasks', icon: '✅', category: 'tasks', requirement: 50 },
  { id: 'tasks_100', name: 'Century Achiever', description: 'Complete 100 tasks', icon: '💯', category: 'tasks', requirement: 100 },
  { id: 'tasks_500', name: 'Task Machine', description: 'Complete 500 tasks', icon: '🚀', category: 'tasks', requirement: 500 },
  { id: 'tasks_1000', name: 'Task Legend', description: 'Complete 1000 tasks', icon: '🏅', category: 'tasks', requirement: 1000 },
  
  // Daily productivity
  { id: 'daily_5', name: 'Productive Day', description: 'Complete 5 tasks in one day', icon: '⭐', category: 'consistency', requirement: 5 },
  { id: 'daily_10', name: 'Super Productive', description: 'Complete 10 tasks in one day', icon: '🌟', category: 'consistency', requirement: 10 },
  { id: 'daily_20', name: 'Productivity Beast', description: 'Complete 20 tasks in one day', icon: '🔮', category: 'consistency', requirement: 20 },
  
  // Special achievements
  { id: 'early_bird', name: 'Early Bird', description: 'Complete a task before 6 AM', icon: '🌅', category: 'special', requirement: 1 },
  { id: 'night_owl', name: 'Night Owl', description: 'Complete a task after midnight', icon: '🦉', category: 'special', requirement: 1 },
  { id: 'weekend_warrior', name: 'Weekend Warrior', description: 'Complete tasks on both Saturday and Sunday', icon: '🎮', category: 'special', requirement: 1 },
  { id: 'freeze_collector', name: 'Freeze Collector', description: 'Earn 5 streak freezes', icon: '❄️', category: 'special', requirement: 5 },
];

const getDefaultAchievementsData = (): AchievementsData => ({
  unlockedAchievements: [],
  achievementDates: {},
});

export const loadAchievementsData = async (): Promise<AchievementsData> => {
  return getSetting<AchievementsData>(ACHIEVEMENTS_STORAGE_KEY, getDefaultAchievementsData());
};

export const unlockAchievement = async (achievementId: string): Promise<{ unlocked: boolean; achievement: Achievement | null }> => {
  const data = await loadAchievementsData();
  const achievement = ALL_ACHIEVEMENTS.find(a => a.id === achievementId);
  
  if (!achievement || data.unlockedAchievements.includes(achievementId)) {
    return { unlocked: false, achievement: null };
  }
  
  data.unlockedAchievements.push(achievementId);
  data.achievementDates[achievementId] = new Date().toISOString();
  await setSetting(ACHIEVEMENTS_STORAGE_KEY, data);
  
  window.dispatchEvent(new CustomEvent('achievementUnlocked', { detail: { achievement } }));
  
  return { unlocked: true, achievement };
};

export const checkAndUnlockAchievements = async (stats: {
  currentStreak?: number;
  totalTasks?: number;
  dailyTasks?: number;
  streakFreezes?: number;
  completionHour?: number;
  isWeekend?: boolean;
}): Promise<Achievement[]> => {
  const newlyUnlocked: Achievement[] = [];
  
  // Check streak achievements
  if (stats.currentStreak) {
    const streakAchievements = ['streak_3', 'streak_7', 'streak_14', 'streak_30', 'streak_60', 'streak_100', 'streak_365'];
    for (const id of streakAchievements) {
      const achievement = ALL_ACHIEVEMENTS.find(a => a.id === id);
      if (achievement && stats.currentStreak >= achievement.requirement) {
        const result = await unlockAchievement(id);
        if (result.unlocked && result.achievement) {
          newlyUnlocked.push(result.achievement);
        }
      }
    }
  }
  
  // Check task achievements
  if (stats.totalTasks) {
    const taskAchievements = ['tasks_10', 'tasks_50', 'tasks_100', 'tasks_500', 'tasks_1000'];
    for (const id of taskAchievements) {
      const achievement = ALL_ACHIEVEMENTS.find(a => a.id === id);
      if (achievement && stats.totalTasks >= achievement.requirement) {
        const result = await unlockAchievement(id);
        if (result.unlocked && result.achievement) {
          newlyUnlocked.push(result.achievement);
        }
      }
    }
  }
  
  // Check daily achievements
  if (stats.dailyTasks) {
    const dailyAchievements = ['daily_5', 'daily_10', 'daily_20'];
    for (const id of dailyAchievements) {
      const achievement = ALL_ACHIEVEMENTS.find(a => a.id === id);
      if (achievement && stats.dailyTasks >= achievement.requirement) {
        const result = await unlockAchievement(id);
        if (result.unlocked && result.achievement) {
          newlyUnlocked.push(result.achievement);
        }
      }
    }
  }
  
  // Check special achievements
  if (stats.completionHour !== undefined) {
    if (stats.completionHour < 6) {
      const result = await unlockAchievement('early_bird');
      if (result.unlocked && result.achievement) newlyUnlocked.push(result.achievement);
    }
    if (stats.completionHour >= 0 && stats.completionHour < 5) {
      const result = await unlockAchievement('night_owl');
      if (result.unlocked && result.achievement) newlyUnlocked.push(result.achievement);
    }
  }
  
  if (stats.streakFreezes && stats.streakFreezes >= 5) {
    const result = await unlockAchievement('freeze_collector');
    if (result.unlocked && result.achievement) newlyUnlocked.push(result.achievement);
  }
  
  return newlyUnlocked;
};

// ==================== DAILY CHALLENGES ====================

export interface DailyChallenge {
  id: string;
  type: 'complete_tasks' | 'early_completion' | 'streak_maintain' | 'speed_run' | 'no_skip';
  title: string;
  description: string;
  target: number;
  current: number;
  xpReward: number; // kept for data compat but not used
  completed: boolean;
  icon: string;
}

export interface DailyChallengesData {
  date: string;
  challenges: DailyChallenge[];
  refreshCount: number;
}

const CHALLENGES_STORAGE_KEY = 'npd_daily_challenges';

const CHALLENGE_TEMPLATES = [
  { type: 'complete_tasks', title: 'Task Blitz', description: 'Complete {target} tasks today', targets: [3, 5, 7, 10], xpRewards: [0, 0, 0, 0], icon: '🎯' },
  { type: 'early_completion', title: 'Early Bird Challenge', description: 'Complete {target} tasks before noon', targets: [2, 3, 5], xpRewards: [0, 0, 0], icon: '🌅' },
  { type: 'streak_maintain', title: 'Streak Guardian', description: 'Maintain your streak for another day', targets: [1], xpRewards: [0], icon: '🔥' },
  { type: 'speed_run', title: 'Speed Runner', description: 'Complete {target} tasks within an hour', targets: [3, 5], xpRewards: [0, 0], icon: '⚡' },
  { type: 'no_skip', title: 'No Task Left Behind', description: 'Complete all tasks you start today', targets: [1], xpRewards: [0], icon: '✨' },
];

const generateDailyChallenges = (): DailyChallenge[] => {
  const challenges: DailyChallenge[] = [];
  const shuffled = [...CHALLENGE_TEMPLATES].sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < 3 && i < shuffled.length; i++) {
    const template = shuffled[i];
    const targetIndex = Math.floor(Math.random() * template.targets.length);
    const target = template.targets[targetIndex];
    
    challenges.push({
      id: `${template.type}_${Date.now()}_${i}`,
      type: template.type as DailyChallenge['type'],
      title: template.title,
      description: template.description.replace('{target}', target.toString()),
      target,
      current: 0,
      xpReward: 0,
      completed: false,
      icon: template.icon,
    });
  }
  
  return challenges;
};

export const loadDailyChallenges = async (): Promise<DailyChallengesData> => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const data = await getSetting<DailyChallengesData>(CHALLENGES_STORAGE_KEY, {
    date: today,
    challenges: generateDailyChallenges(),
    refreshCount: 0,
  });
  
  if (data.date !== today) {
    const newData: DailyChallengesData = {
      date: today,
      challenges: generateDailyChallenges(),
      refreshCount: 0,
    };
    await setSetting(CHALLENGES_STORAGE_KEY, newData);
    return newData;
  }
  
  return data;
};

export const updateChallengeProgress = async (
  type: DailyChallenge['type'],
  increment: number = 1
): Promise<{ completed: DailyChallenge | null; data: DailyChallengesData }> => {
  const data = await loadDailyChallenges();
  let completedChallenge: DailyChallenge | null = null;
  
  for (const challenge of data.challenges) {
    if (challenge.type === type && !challenge.completed) {
      challenge.current += increment;
      
      if (challenge.current >= challenge.target) {
        challenge.completed = true;
        completedChallenge = challenge;
        
        window.dispatchEvent(new CustomEvent('challengeCompleted', { detail: { challenge } }));
      }
    }
  }
  
  await setSetting(CHALLENGES_STORAGE_KEY, data);
  
  // Check if all daily challenges completed → update weekly + monthly
  if (data.challenges.every(c => c.completed)) {
    try {
      const { updateWeeklyChallengeProgress } = await import('./weeklyChallengeStorage');
      await updateWeeklyChallengeProgress('daily_challenges', 1);
    } catch (e) { /* ignore */ }
    try {
      const { updateMonthlyChallengeProgress } = await import('./monthlyChallengeStorage');
      await updateMonthlyChallengeProgress('daily_challenges', 1);
    } catch (e) { /* ignore */ }
  }
  
  return { completed: completedChallenge, data };
};

export const refreshChallenges = async (): Promise<DailyChallengesData> => {
  const data = await loadDailyChallenges();
  
  if (data.refreshCount >= 1) {
    return data;
  }
  
  const newData: DailyChallengesData = {
    date: data.date,
    challenges: generateDailyChallenges(),
    refreshCount: data.refreshCount + 1,
  };
  
  await setSetting(CHALLENGES_STORAGE_KEY, newData);
  return newData;
};
