/**
 * Activity Logger - Tracks all user activities in IndexedDB
 */

import { getSetting, setSetting } from './settingsStorage';

export interface UserActivity {
  id: string;
  type: ActivityType;
  action: string;
  details?: Record<string, any>;
  timestamp: Date;
  entityId?: string;
  entityType?: 'note' | 'task' | 'folder' | 'section' | 'tag' | 'setting';
}

export type ActivityType = 
  // Notes
  | 'note_create'
  | 'note_update'
  | 'note_delete'
  | 'note_archive'
  | 'note_restore'
  | 'note_pin'
  | 'note_unpin'
  | 'note_favorite'
  | 'note_unfavorite'
  | 'note_move'
  | 'note_duplicate'
  | 'note_hide'
  | 'note_protect'
  // Tasks
  | 'task_create'
  | 'task_update'
  | 'task_delete'
  | 'task_complete'
  | 'task_uncomplete'
  | 'task_move'
  | 'task_duplicate'
  | 'task_priority_change'
  | 'task_date_change'
  | 'task_reminder_set'
  | 'task_tag_add'
  | 'task_tag_remove'
  | 'task_section_move'
  | 'task_status_change'
  // Folders
  | 'folder_create'
  | 'folder_update'
  | 'folder_delete'
  | 'folder_select'
  // Sections
  | 'section_create'
  | 'section_update'
  | 'section_delete'
  | 'section_reorder'
  // View & Filter Changes
  | 'view_mode_change'
  | 'filter_change'
  | 'sort_change'
  | 'smart_list_change'
  | 'group_by_change'
  | 'compact_mode_toggle'
  | 'hide_completed_toggle'
  | 'hide_details_toggle'
  | 'grid_view_toggle'
  // Settings
  | 'setting_change'
  | 'theme_change'
  | 'language_change'
  // Other
  | 'search'
  | 'app_open'
  | 'navigation';

const ACTIVITY_LOG_KEY = 'userActivityLog';
const MAX_ACTIVITIES = 1000; // Keep last 1000 activities

// In-memory cache for quick access
let activityCache: UserActivity[] | null = null;

/**
 * Initialize activity cache from IndexedDB
 */
export const initializeActivityLogger = async (): Promise<void> => {
  activityCache = await getSetting<UserActivity[]>(ACTIVITY_LOG_KEY, []);
};

/**
 * Log a user activity
 */
export const logActivity = async (
  type: ActivityType,
  action: string,
  options?: {
    details?: Record<string, any>;
    entityId?: string;
    entityType?: UserActivity['entityType'];
  }
): Promise<void> => {
  const activity: UserActivity = {
    id: `activity-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    type,
    action,
    details: options?.details,
    entityId: options?.entityId,
    entityType: options?.entityType,
    timestamp: new Date(),
  };

  // Load cache if not initialized
  if (activityCache === null) {
    activityCache = await getSetting<UserActivity[]>(ACTIVITY_LOG_KEY, []);
  }

  // Add new activity at the beginning
  activityCache = [activity, ...activityCache].slice(0, MAX_ACTIVITIES);
  
  // Save to IndexedDB (debounced internally by settingsStorage)
  await setSetting(ACTIVITY_LOG_KEY, activityCache);
};

/**
 * Get all activities
 */
export const getActivities = async (): Promise<UserActivity[]> => {
  if (activityCache === null) {
    activityCache = await getSetting<UserActivity[]>(ACTIVITY_LOG_KEY, []);
  }
  return activityCache;
};

/**
 * Get activities by type
 */
export const getActivitiesByType = async (type: ActivityType): Promise<UserActivity[]> => {
  const activities = await getActivities();
  return activities.filter(a => a.type === type);
};

/**
 * Get activities for a specific entity
 */
export const getEntityActivities = async (entityId: string): Promise<UserActivity[]> => {
  const activities = await getActivities();
  return activities.filter(a => a.entityId === entityId);
};

/**
 * Get recent activities (last N)
 */
export const getRecentActivities = async (count: number = 50): Promise<UserActivity[]> => {
  const activities = await getActivities();
  return activities.slice(0, count);
};

/**
 * Clear all activity logs
 */
export const clearActivityLog = async (): Promise<void> => {
  activityCache = [];
  await setSetting(ACTIVITY_LOG_KEY, []);
};

/**
 * Get activity statistics
 */
export const getActivityStats = async (): Promise<{
  totalActivities: number;
  activitiesByType: Record<string, number>;
  recentActivityCount: number;
}> => {
  const activities = await getActivities();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  const activitiesByType: Record<string, number> = {};
  let recentCount = 0;
  
  for (const activity of activities) {
    activitiesByType[activity.type] = (activitiesByType[activity.type] || 0) + 1;
    if (new Date(activity.timestamp) > dayAgo) {
      recentCount++;
    }
  }
  
  return {
    totalActivities: activities.length,
    activitiesByType,
    recentActivityCount: recentCount,
  };
};
