export type HabitFrequency = 'daily' | 'weekly';

export interface HabitReminder {
  enabled: boolean;
  /** Time of day in HH:mm format */
  time: string;
  /** Notification IDs for cancellation */
  notificationIds?: number[];
}

export interface HabitCompletionRecord {
  date: string; // YYYY-MM-DD
  completed: boolean;
}

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: string; // HSL string for theming
  frequency: HabitFrequency;
  /** For weekly habits: which days (0=Sun, 6=Sat) */
  weeklyDays?: number[];
  /** Target streak to aim for */
  targetStreak?: number;
  /** Daily reminder configuration */
  reminder?: HabitReminder;
  /** Completion history keyed by date */
  completions: HabitCompletionRecord[];
  /** Current streak count */
  currentStreak: number;
  /** Best streak ever */
  bestStreak: number;
  isArchived: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}
