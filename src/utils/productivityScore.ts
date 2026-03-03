/**
 * Productivity Score Calculator
 *
 * Computes a single 0-100 score from:
 *   - Streak length (30%)        → 30-day streak = full marks
 *   - Tasks completed this week (25%) → 25 tasks = full marks
 *   - Daily challenge completion (20%) → all 3 done today = full marks
 *   - Habit consistency (15%)    → based on streak continuity
 *   - App usage days (10%)       → 30 unique days in last 60 = full marks
 */

import { loadStreakData, TASK_STREAK_KEY } from './streakStorage';
import { loadTodoItems } from './todoItemsStorage';
import { loadDailyChallenges } from './gamificationStorage';
import { startOfWeek, endOfWeek } from 'date-fns';

export interface ProductivityScore {
  total: number; // 0-100
  breakdown: {
    streak: number;      // 0-30
    weeklyTasks: number; // 0-25
    challenges: number;  // 0-20
    consistency: number; // 0-15
    usage: number;       // 0-10
  };
  grade: string;
  gradeColor: string;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const calculateProductivityScore = async (): Promise<ProductivityScore> => {
  // ── Streak (30%) ──
  let streakScore = 0;
  try {
    const streakData = await loadStreakData(TASK_STREAK_KEY);
    // 30-day streak = full score
    streakScore = clamp((streakData.currentStreak / 30) * 30, 0, 30);
  } catch { /* default 0 */ }

  // ── Weekly tasks (25%) ──
  let weeklyTasksScore = 0;
  try {
    const tasks = await loadTodoItems();
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
    const completedThisWeek = tasks.filter(t => {
      if (!t.completedAt) return false;
      const d = new Date(t.completedAt);
      return d >= weekStart && d <= weekEnd;
    }).length;
    // 25 tasks = full score
    weeklyTasksScore = clamp((completedThisWeek / 25) * 25, 0, 25);
  } catch { /* default 0 */ }

  // ── Daily challenges (20%) ──
  let challengesScore = 0;
  try {
    const challenges = await loadDailyChallenges();
    const completed = challenges.challenges.filter(c => c.completed).length;
    const total = challenges.challenges.length || 3;
    challengesScore = (completed / total) * 20;
  } catch { /* default 0 */ }

  // ── Consistency / habit (15%) ──
  let consistencyScore = 0;
  try {
    const streakData = await loadStreakData(TASK_STREAK_KEY);
    const longest = streakData.longestStreak || 0;
    const current = streakData.currentStreak || 0;
    // Ratio of current to longest shows consistency; 14-day current = full
    const ratio = longest > 0 ? current / longest : 0;
    const streakComponent = clamp(current / 14, 0, 1);
    consistencyScore = ((ratio * 0.5) + (streakComponent * 0.5)) * 15;
  } catch { /* default 0 */ }

  // ── App usage days (10%) — based on streak history ──
  let usageScore = 0;
  try {
    const streakData2 = await loadStreakData(TASK_STREAK_KEY);
    const activeDays = Object.keys(streakData2.weekHistory || {}).length;
    usageScore = clamp((activeDays / 30) * 10, 0, 10);
  } catch { /* default 0 */ }

  const total = Math.round(streakScore + weeklyTasksScore + challengesScore + consistencyScore + usageScore);

  const { grade, gradeColor } = getGrade(total);

  return {
    total: clamp(total, 0, 100),
    breakdown: {
      streak: Math.round(streakScore),
      weeklyTasks: Math.round(weeklyTasksScore),
      challenges: Math.round(challengesScore),
      consistency: Math.round(consistencyScore),
      usage: Math.round(usageScore),
    },
    grade,
    gradeColor,
  };
};

const getGrade = (score: number): { grade: string; gradeColor: string } => {
  if (score >= 90) return { grade: 'S', gradeColor: 'text-warning' };
  if (score >= 80) return { grade: 'A', gradeColor: 'text-success' };
  if (score >= 65) return { grade: 'B', gradeColor: 'text-info' };
  if (score >= 50) return { grade: 'C', gradeColor: 'text-primary' };
  if (score >= 30) return { grade: 'D', gradeColor: 'text-muted-foreground' };
  return { grade: 'F', gradeColor: 'text-destructive' };
};
