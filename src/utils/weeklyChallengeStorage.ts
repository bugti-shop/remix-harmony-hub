// Weekly Challenge System
// Generates 3 weekly challenges with 3x daily challenge XP rewards

import { getSetting, setSetting } from './settingsStorage';
import { format, startOfWeek, endOfWeek, differenceInHours } from 'date-fns';

export interface WeeklyChallenge {
  id: string;
  type: 'complete_tasks' | 'maintain_streak' | 'daily_challenges' | 'earn_xp' | 'complete_subtasks';
  title: string;
  description: string;
  target: number;
  current: number;
  xpReward: number;
  completed: boolean;
  icon: string;
}

export interface WeeklyChallengesData {
  weekStart: string; // ISO date string (Saturday)
  challenges: WeeklyChallenge[];
  allCompleted: boolean;
}

const STORAGE_KEY = 'npd_weekly_challenges';

const WEEKLY_CHALLENGE_TEMPLATES = [
  { type: 'complete_tasks', title: 'Task Conqueror', description: 'Complete {target} tasks this week', targets: [15, 20, 25, 30], xpBase: [0, 0, 0, 0], icon: '🎯' },
  { type: 'maintain_streak', title: 'Streak Guardian', description: 'Maintain a {target}-day streak', targets: [5, 7], xpBase: [0, 0], icon: '🔥' },
  { type: 'daily_challenges', title: 'Challenge Champion', description: 'Complete all daily challenges for {target} days', targets: [3, 5], xpBase: [0, 0], icon: '⭐' },
  { type: 'complete_subtasks', title: 'Detail Master', description: 'Complete {target} subtasks this week', targets: [10, 20, 30], xpBase: [0, 0, 0], icon: '✅' },
];

const generateWeeklyChallenges = (): WeeklyChallenge[] => {
  const shuffled = [...WEEKLY_CHALLENGE_TEMPLATES].sort(() => Math.random() - 0.5);
  const challenges: WeeklyChallenge[] = [];

  for (let i = 0; i < 3 && i < shuffled.length; i++) {
    const template = shuffled[i];
    const targetIndex = Math.floor(Math.random() * template.targets.length);
    const target = template.targets[targetIndex];
    const xpReward = template.xpBase[targetIndex];

    challenges.push({
      id: `weekly_${template.type}_${Date.now()}_${i}`,
      type: template.type as WeeklyChallenge['type'],
      title: template.title,
      description: template.description.replace('{target}', target.toString()),
      target,
      current: 0,
      xpReward,
      completed: false,
      icon: template.icon,
    });
  }

  return challenges;
};

export const loadWeeklyChallenges = async (): Promise<WeeklyChallengesData> => {
  const currentWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 6 }), 'yyyy-MM-dd');

  const data = await getSetting<WeeklyChallengesData>(STORAGE_KEY, {
    weekStart: currentWeekStart,
    challenges: generateWeeklyChallenges(),
    allCompleted: false,
  });

  // New week → reset
  if (data.weekStart !== currentWeekStart) {
    const newData: WeeklyChallengesData = {
      weekStart: currentWeekStart,
      challenges: generateWeeklyChallenges(),
      allCompleted: false,
    };
    await setSetting(STORAGE_KEY, newData);
    return newData;
  }

  return data;
};

export const updateWeeklyChallengeProgress = async (
  type: WeeklyChallenge['type'],
  increment: number = 1
): Promise<{ completed: WeeklyChallenge | null; data: WeeklyChallengesData }> => {
  const data = await loadWeeklyChallenges();
  let completedChallenge: WeeklyChallenge | null = null;

  for (const challenge of data.challenges) {
    if (challenge.type === type && !challenge.completed) {
      challenge.current = Math.min(challenge.current + increment, challenge.target);

      if (challenge.current >= challenge.target) {
        challenge.completed = true;
        completedChallenge = challenge;


        window.dispatchEvent(new CustomEvent('weeklyChallengeCompleted', { detail: { challenge } }));
      }
    }
  }

  data.allCompleted = data.challenges.every(c => c.completed);
  await setSetting(STORAGE_KEY, data);
  window.dispatchEvent(new Event('weeklyChallengesUpdated'));

  return { completed: completedChallenge, data };
};

export const getWeekDeadline = (): { hoursLeft: number; daysLeft: number; endDate: Date } => {
  const now = new Date();
  const weekEnd = endOfWeek(now, { weekStartsOn: 6 }); // Friday end
  const hoursLeft = Math.max(0, differenceInHours(weekEnd, now));
  const daysLeft = Math.ceil(hoursLeft / 24);
  return { hoursLeft, daysLeft, endDate: weekEnd };
};
