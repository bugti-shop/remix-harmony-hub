/**
 * Smart Auto-Scheduler
 * Distributes undated tasks across available days based on priority and estimated effort
 */

import { TodoItem } from '@/types/note';
import { addDays, startOfDay, format } from 'date-fns';

export interface ScheduleConfig {
  /** Maximum effort hours per day */
  maxHoursPerDay: number;
  /** How many days ahead to schedule */
  daysAhead: number;
  /** Default estimated hours if task has no estimate */
  defaultEstimateHours: number;
  /** Whether to skip weekends */
  skipWeekends: boolean;
  /** Start scheduling from this date */
  startDate: Date;
}

export interface ScheduledTask {
  task: TodoItem;
  scheduledDate: Date;
  estimatedHours: number;
}

export interface ScheduleDay {
  date: Date;
  dateStr: string;
  tasks: ScheduledTask[];
  totalHours: number;
  remainingHours: number;
}

export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  maxHoursPerDay: 6,
  daysAhead: 7,
  defaultEstimateHours: 1,
  skipWeekends: false,
  startDate: new Date(),
};

/** Priority weights for sorting (higher = scheduled first) */
const PRIORITY_WEIGHTS: Record<string, number> = {
  high: 4,
  medium: 3,
  low: 2,
  none: 1,
};

/**
 * Get priority weight for sorting
 */
const getPriorityWeight = (priority?: string): number => {
  return PRIORITY_WEIGHTS[priority || 'none'] || 1;
};

/**
 * Find undated, incomplete tasks eligible for scheduling
 */
export const getUndatedTasks = (tasks: TodoItem[]): TodoItem[] => {
  return tasks.filter(t => 
    !t.completed && 
    !t.dueDate && 
    t.text.trim().length > 0
  );
};

/**
 * Generate available schedule days
 */
const generateScheduleDays = (config: ScheduleConfig): ScheduleDay[] => {
  const days: ScheduleDay[] = [];
  let currentDate = startOfDay(config.startDate);

  for (let i = 0; i < config.daysAhead; i++) {
    const date = addDays(currentDate, i);
    const dayOfWeek = date.getDay();

    // Skip weekends if configured
    if (config.skipWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
      continue;
    }

    days.push({
      date,
      dateStr: format(date, 'yyyy-MM-dd'),
      tasks: [],
      totalHours: 0,
      remainingHours: config.maxHoursPerDay,
    });
  }

  return days;
};

/**
 * Account for already-scheduled tasks on each day
 */
const accountForExistingTasks = (
  days: ScheduleDay[], 
  allTasks: TodoItem[], 
  config: ScheduleConfig
): void => {
  for (const task of allTasks) {
    if (!task.dueDate || task.completed) continue;
    const taskDateStr = format(startOfDay(new Date(task.dueDate)), 'yyyy-MM-dd');
    const day = days.find(d => d.dateStr === taskDateStr);
    if (day) {
      const hours = task.estimatedHours || config.defaultEstimateHours;
      day.totalHours += hours;
      day.remainingHours = Math.max(0, config.maxHoursPerDay - day.totalHours);
    }
  }
};

/**
 * Auto-schedule undated tasks across available days
 */
export const autoScheduleTasks = (
  allTasks: TodoItem[], 
  config: ScheduleConfig = DEFAULT_SCHEDULE_CONFIG
): { schedule: ScheduleDay[]; unscheduled: TodoItem[] } => {
  // Get undated tasks sorted by priority (high first), then by creation order
  const undated = getUndatedTasks(allTasks).sort((a, b) => {
    const priorityDiff = getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
    if (priorityDiff !== 0) return priorityDiff;
    // Smaller estimated effort first within same priority (fill gaps efficiently)
    const aHours = a.estimatedHours || config.defaultEstimateHours;
    const bHours = b.estimatedHours || config.defaultEstimateHours;
    return aHours - bHours;
  });

  // Generate available days and account for existing tasks
  const days = generateScheduleDays(config);
  accountForExistingTasks(days, allTasks, config);

  const unscheduled: TodoItem[] = [];

  // Distribute tasks using first-fit decreasing approach
  for (const task of undated) {
    const hours = task.estimatedHours || config.defaultEstimateHours;
    
    // Find first day with enough remaining capacity
    const availableDay = days.find(d => d.remainingHours >= hours);
    
    if (availableDay) {
      availableDay.tasks.push({
        task,
        scheduledDate: availableDay.date,
        estimatedHours: hours,
      });
      availableDay.totalHours += hours;
      availableDay.remainingHours = Math.max(0, config.maxHoursPerDay - availableDay.totalHours);
    } else {
      // Try to fit in any day with at least some remaining capacity
      const anyDay = days.find(d => d.remainingHours > 0);
      if (anyDay) {
        anyDay.tasks.push({
          task,
          scheduledDate: anyDay.date,
          estimatedHours: hours,
        });
        anyDay.totalHours += hours;
        anyDay.remainingHours = Math.max(0, config.maxHoursPerDay - anyDay.totalHours);
      } else {
        unscheduled.push(task);
      }
    }
  }

  return { schedule: days, unscheduled };
};

/**
 * Apply schedule to tasks (set due dates)
 */
export const applySchedule = (
  allTasks: TodoItem[], 
  schedule: ScheduleDay[]
): TodoItem[] => {
  // Build a map of task ID -> scheduled date
  const scheduledMap = new Map<string, Date>();
  for (const day of schedule) {
    for (const st of day.tasks) {
      scheduledMap.set(st.task.id, st.scheduledDate);
    }
  }

  return allTasks.map(task => {
    const scheduledDate = scheduledMap.get(task.id);
    if (scheduledDate) {
      return { ...task, dueDate: scheduledDate };
    }
    return task;
  });
};
