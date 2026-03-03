// Weekly Goals Storage Utility
// Track and manage weekly completion targets

import { getSetting, setSetting } from './settingsStorage';
import { format, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';

export interface WeeklyGoal {
  id: string;
  title: string;
  target: number;
  current: number;
  type: 'tasks' | 'streak_days' | 'xp' | 'custom';
  completed: boolean;
  createdAt: string;
}

export interface WeeklyGoalsData {
  weekStart: string; // ISO date string
  goals: WeeklyGoal[];
  completedWeeks: number;
  totalGoalsCompleted: number;
}

const WEEKLY_GOALS_KEY = 'npd_weekly_goals';

const getDefaultWeeklyGoalsData = (): WeeklyGoalsData => {
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 6 }), 'yyyy-MM-dd'); // Start on Saturday
  return {
    weekStart,
    goals: getDefaultGoals(),
    completedWeeks: 0,
    totalGoalsCompleted: 0,
  };
};

const getDefaultGoals = (): WeeklyGoal[] => [
  {
    id: 'weekly_tasks',
    title: 'Complete Tasks',
    target: 20,
    current: 0,
    type: 'tasks',
    completed: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'weekly_streak',
    title: 'Maintain Streak',
    target: 7,
    current: 0,
    type: 'streak_days',
    completed: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'weekly_xp',
    title: 'Earn XP',
    target: 200,
    current: 0,
    type: 'xp',
    completed: false,
    createdAt: new Date().toISOString(),
  },
];

export const loadWeeklyGoals = async (): Promise<WeeklyGoalsData> => {
  const data = await getSetting<WeeklyGoalsData>(WEEKLY_GOALS_KEY, getDefaultWeeklyGoalsData());
  
  // Check if it's a new week (week starts on Saturday)
  const currentWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 6 }), 'yyyy-MM-dd');
  
  if (data.weekStart !== currentWeekStart) {
    // New week - check if previous week was completed and reset
    const previousWeekCompleted = data.goals.every(g => g.completed);
    
    const newData: WeeklyGoalsData = {
      weekStart: currentWeekStart,
      goals: getDefaultGoals(),
      completedWeeks: previousWeekCompleted ? data.completedWeeks + 1 : data.completedWeeks,
      totalGoalsCompleted: data.totalGoalsCompleted,
    };
    
    await setSetting(WEEKLY_GOALS_KEY, newData);
    return newData;
  }
  
  return data;
};

export const updateGoalProgress = async (
  goalId: string,
  increment: number = 1
): Promise<{ data: WeeklyGoalsData; goalCompleted: WeeklyGoal | null }> => {
  const data = await loadWeeklyGoals();
  let goalCompleted: WeeklyGoal | null = null;
  
  const goal = data.goals.find(g => g.id === goalId);
  if (goal && !goal.completed) {
    goal.current += increment;
    
    if (goal.current >= goal.target) {
      goal.current = goal.target;
      goal.completed = true;
      goalCompleted = goal;
      data.totalGoalsCompleted += 1;
      
      window.dispatchEvent(new CustomEvent('weeklyGoalCompleted', { detail: { goal } }));
    }
  }
  
  await setSetting(WEEKLY_GOALS_KEY, data);
  window.dispatchEvent(new CustomEvent('weeklyGoalsUpdated'));
  
  return { data, goalCompleted };
};

export const updateGoalTarget = async (goalId: string, newTarget: number): Promise<WeeklyGoalsData> => {
  const data = await loadWeeklyGoals();
  
  const goal = data.goals.find(g => g.id === goalId);
  if (goal) {
    goal.target = Math.max(1, newTarget);
    // Re-check completion status
    goal.completed = goal.current >= goal.target;
  }
  
  await setSetting(WEEKLY_GOALS_KEY, data);
  window.dispatchEvent(new CustomEvent('weeklyGoalsUpdated'));
  
  return data;
};

export const addCustomGoal = async (title: string, target: number): Promise<WeeklyGoalsData> => {
  const data = await loadWeeklyGoals();
  
  const newGoal: WeeklyGoal = {
    id: `custom_${Date.now()}`,
    title,
    target,
    current: 0,
    type: 'custom',
    completed: false,
    createdAt: new Date().toISOString(),
  };
  
  data.goals.push(newGoal);
  await setSetting(WEEKLY_GOALS_KEY, data);
  window.dispatchEvent(new CustomEvent('weeklyGoalsUpdated'));
  
  return data;
};

export const removeGoal = async (goalId: string): Promise<WeeklyGoalsData> => {
  const data = await loadWeeklyGoals();
  
  // Only allow removing custom goals
  data.goals = data.goals.filter(g => g.id !== goalId || g.type !== 'custom');
  
  await setSetting(WEEKLY_GOALS_KEY, data);
  window.dispatchEvent(new CustomEvent('weeklyGoalsUpdated'));
  
  return data;
};

export const getWeekProgress = (data: WeeklyGoalsData): { completed: number; total: number; percent: number } => {
  const completed = data.goals.filter(g => g.completed).length;
  const total = data.goals.length;
  const percent = total > 0 ? (completed / total) * 100 : 0;
  
  return { completed, total, percent };
};

export const getDaysRemainingInWeek = (): number => {
  const now = new Date();
  const weekEnd = endOfWeek(now, { weekStartsOn: 6 }); // Week ends on Friday
  const msRemaining = weekEnd.getTime() - now.getTime();
  return Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
};
