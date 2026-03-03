import { Habit } from '@/types/habit';
import { format, subDays, parseISO, isAfter, isBefore, startOfDay } from 'date-fns';

const DB_NAME = 'nota-habits-db';
const DB_VERSION = 1;
const STORE_NAME = 'habits';

let db: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (db) return Promise.resolve(db);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => { dbPromise = null; reject(req.error); };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onupgradeneeded = (e) => {
      const database = (e.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
  return dbPromise;
};

export const loadHabits = async (): Promise<Habit[]> => {
  const database = await openDB();
  return new Promise((resolve) => {
    const tx = database.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
};

export const saveHabit = async (habit: Habit): Promise<void> => {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction([STORE_NAME], 'readwrite');
    tx.objectStore(STORE_NAME).put(habit);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const deleteHabit = async (id: string): Promise<void> => {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction([STORE_NAME], 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

/** Calculate current streak for a habit */
export const calculateStreak = (habit: Habit): { current: number; best: number } => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const completedDates = new Set(
    habit.completions.filter(c => c.completed).map(c => c.date)
  );

  let current = 0;
  let checkDate = today;

  // If today isn't completed yet, start checking from yesterday
  if (!completedDates.has(today)) {
    checkDate = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  }

  // Count backwards
  for (let i = 0; i < 365; i++) {
    const dateStr = format(subDays(parseISO(checkDate), i === 0 ? 0 : 1), 'yyyy-MM-dd');
    if (i > 0) checkDate = dateStr;
    
    if (habit.frequency === 'weekly' && habit.weeklyDays?.length) {
      const dayOfWeek = parseISO(dateStr).getDay();
      if (!habit.weeklyDays.includes(dayOfWeek)) continue;
    }

    if (completedDates.has(dateStr)) {
      current++;
    } else {
      break;
    }
  }

  const best = Math.max(current, habit.bestStreak);
  return { current, best };
};

/** Get completion rate for last N days */
export const getCompletionRate = (habit: Habit, days: number): number => {
  const completedDates = new Set(
    habit.completions.filter(c => c.completed).map(c => c.date)
  );

  let applicable = 0;
  let completed = 0;

  for (let i = 0; i < days; i++) {
    const dateStr = format(subDays(new Date(), i), 'yyyy-MM-dd');
    const dayOfWeek = subDays(new Date(), i).getDay();

    if (habit.frequency === 'weekly' && habit.weeklyDays?.length) {
      if (!habit.weeklyDays.includes(dayOfWeek)) continue;
    }

    applicable++;
    if (completedDates.has(dateStr)) completed++;
  }

  return applicable > 0 ? Math.round((completed / applicable) * 100) : 0;
};

/** Get weekly chart data (last 7 weeks of completion rates) */
export const getWeeklyChartData = (habit: Habit): { week: string; rate: number }[] => {
  const data: { week: string; rate: number }[] = [];

  for (let w = 6; w >= 0; w--) {
    const weekStart = subDays(new Date(), w * 7 + 6);
    const weekEnd = subDays(new Date(), w * 7);
    const label = format(weekStart, 'MMM d');

    const completedDates = new Set(
      habit.completions.filter(c => c.completed).map(c => c.date)
    );

    let applicable = 0;
    let completed = 0;

    for (let d = 0; d < 7; d++) {
      const date = subDays(weekEnd, d);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayOfWeek = date.getDay();

      if (habit.frequency === 'weekly' && habit.weeklyDays?.length) {
        if (!habit.weeklyDays.includes(dayOfWeek)) continue;
      }

      if (!isBefore(date, startOfDay(parseISO(habit.createdAt)))) {
        applicable++;
        if (completedDates.has(dateStr)) completed++;
      }
    }

    data.push({
      week: label,
      rate: applicable > 0 ? Math.round((completed / applicable) * 100) : 0,
    });
  }

  return data;
};
