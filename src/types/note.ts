export type NoteType = 'sticky' | 'lined' | 'regular' | 'code' | 'voice' | 'textformat' | 'linkedin' | 'sketch';

// Calendar Event Types
export type EventRepeatType = 'never' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type EventReminderType = 'at_time' | '5min' | '10min' | '15min' | '30min' | '1hour' | '1day';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  allDay: boolean;
  startDate: Date;
  endDate: Date;
  timezone: string;
  repeat: EventRepeatType;
  reminder: EventReminderType;
  createdAt: Date;
  updatedAt: Date;
}




export type Priority = 'high' | 'medium' | 'low' | 'none' | (string & {});
export type RepeatType = 'none' | 'hourly' | 'daily' | 'weekly' | 'weekdays' | 'weekends' | 'monthly' | 'yearly' | 'custom';
export type TaskStatus = 'not_started' | 'in_progress' | 'almost_done' | 'completed';


export interface AdvancedRepeatPattern {
  frequency: RepeatType;
  interval?: number; // every X hours/days/weeks/months
  weeklyDays?: number[]; // 0-6 for Sunday-Saturday
  monthlyType?: 'date' | 'weekday'; // "on the 15th" vs "on the 2nd Tuesday"
  monthlyWeek?: 1 | 2 | 3 | 4 | -1; // 1st, 2nd, 3rd, 4th, or last (-1)
  monthlyDay?: number; // 0-6 for weekday, or 1-31 for date
}

export interface TimeTracking {
  totalSeconds: number;
  isRunning: boolean;
  lastStarted?: Date;
  sessions?: { start: Date; end: Date; duration: number }[];
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

export interface ColoredTag {
  name: string;
  color: string;
}

// Multi-reminder configuration
export type ReminderIntervalType = '30min' | '1hour' | '2hours' | '4hours' | 'custom';

export interface MultiReminder {
  enabled: boolean;
  intervalType: ReminderIntervalType;
  customIntervalMinutes?: number; // For custom interval
  activeHoursStart?: string; // e.g., "06:00"
  activeHoursEnd?: string; // e.g., "17:00"
  daysOfWeek?: number[]; // 0-6 for Sunday-Saturday, empty means all days
}

// Location-based reminder configuration
export interface LocationReminder {
  enabled: boolean;
  latitude: number;
  longitude: number;
  address: string;
  radius: number; // in meters
  triggerOnEnter: boolean;
  triggerOnExit: boolean;
}

// Deadline escalation rule
export type EscalationTiming = '30min' | '1hour' | '2hours' | '4hours' | '1day';

export interface EscalationRule {
  enabled: boolean;
  /** How long before deadline to send escalation alert */
  timing: EscalationTiming;
  /** Custom minutes (if timing isn't a preset) */
  customMinutes?: number;
  /** Whether to repeat the escalation alert */
  repeat?: boolean;
  /** Repeat interval in minutes */
  repeatIntervalMinutes?: number;
  /** Last time an escalation was triggered (to avoid duplicates) */
  lastTriggeredAt?: Date;
}

// Recurring task intelligence
export interface RecurringCompletionEntry {
  date: string; // ISO date string
  completed: boolean;
  skipped?: boolean;
  deferred?: boolean;
  deferredTo?: string; // ISO date
}

export interface RecurringStats {
  completionHistory: RecurringCompletionEntry[];
  currentStreak: number;
  bestStreak: number;
  totalCompleted: number;
  totalSkipped: number;
  totalDeferred: number;
  averageCompletionHour?: number; // avg hour of day task gets done
  lastCompletedAt?: Date;
  suggestedTimeAdjustment?: string; // e.g. "Move to mornings - you complete 80% before noon"
}

export interface TaskAttachment {
  id: string;
  name: string;
  type: string; // MIME type
  size: number;
  ref: string; // idb:file:id reference
}

export interface TaskComment {
  id: string;
  text: string;
  imageUrl?: string; // base64 or idb ref
  createdAt: Date;
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  priority?: Priority;
  status?: TaskStatus; // Task status (not started, in progress, almost done, completed)
  isPinned?: boolean; // Pin task to top
  dueDate?: Date;
  reminderTime?: Date;
  multiReminder?: MultiReminder; // Support for multiple reminders throughout the day
  locationReminder?: LocationReminder; // Location-based reminder
  repeatType?: RepeatType;
  repeatDays?: number[];
  advancedRepeat?: AdvancedRepeatPattern;
  tags?: string[];
  coloredTags?: ColoredTag[]; // @deprecated - use tagIds with global tag system
  tagIds?: string[]; // Global tag IDs from tagStorage
  folderId?: string;
  sectionId?: string;
  imageUrl?: string;
  description?: string;
  location?: string;
  subtasks?: TodoItem[];
  categoryId?: string;
  googleCalendarEventId?: string;
  notificationIds?: number[];
  voiceRecording?: VoiceRecording;
  attachments?: TaskAttachment[]; // File attachments
  comments?: TaskComment[]; // Comments/activity thread
  dependsOn?: string[]; // IDs of tasks that must be completed first
  timeTracking?: TimeTracking;
  estimatedHours?: number; // Effort estimation in hours
  escalationRule?: EscalationRule; // Deadline escalation alerts
  // Recurring task intelligence
  recurringStats?: RecurringStats;
  // Timestamp fields
  createdAt?: Date;
  modifiedAt?: Date;
  completedAt?: Date;
}

export interface TaskTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  taskText: string;
  priority?: Priority;
  categoryId?: string;
  subtasks?: string[];
}

export interface TaskSection {
  id: string;
  name: string;
  color: string;
  isCollapsed: boolean;
  order: number;
}

export interface CornellSection {
  id: string;
  title: string;
  content: string;
  color: string;
}

export type StickyColor = 'yellow' | 'blue' | 'green' | 'pink' | 'orange';

export interface VoiceRecording {
  id: string;
  audioUrl: string;
  duration: number;
  timestamp: Date;
}

// Sync status for tracking local changes
export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'error';

// Conflict copy created when versions diverge
export interface NoteConflictCopy {
  id: string;
  noteId: string;
  content: string;
  title: string;
  version: number;
  deviceId: string;
  timestamp: Date;
  resolved: boolean;
}

export interface FloatingImage {
  id: string;
  src: string; // base64 data URL
  x: number;
  y: number;
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
}

export interface Note {
  id: string;
  type: NoteType;
  title: string;
  content: string;
  color?: StickyColor;
  customColor?: string; // Custom background color for non-sticky notes (hex)
  images?: string[];
  floatingImages?: FloatingImage[];
  voiceRecordings: VoiceRecording[];
  folderId?: string;
  todoItems?: TodoItem[];
  todoSections?: TaskSection[];
  todoName?: string;
  todoDate?: string;
  todoNotes?: string;
  cornellSections?: CornellSection[];
  meetingTitle?: string;
  meetingDate?: string;
  meetingTime?: string;
  meetingLocation?: string;
  isPinned?: boolean;
  isFavorite?: boolean;
  tagIds?: string[]; // Global tag IDs from tagStorage
  pinnedOrder?: number;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  letterSpacing?: string;
  isItalic?: boolean;
  lineHeight?: string;
  reminderEnabled?: boolean;
  reminderTime?: Date;
  reminderRecurring?: 'none' | 'daily' | 'weekly' | 'monthly';
  reminderSound?: string;
  reminderVibration?: boolean;
  notificationId?: number;
  notificationIds?: number[];
  codeContent?: string;
  codeLanguage?: string;
  isArchived?: boolean;
  archivedAt?: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
  // Hidden/Protected note properties
  isHidden?: boolean;
  isProtected?: boolean;
  // Meta description for note
  metaDescription?: string;
  // Sync versioning fields
  syncVersion: number; // Increments on every edit
  lastSyncedAt?: Date; // When last successfully synced
  syncStatus: SyncStatus; // Current sync state
  isDirty: boolean; // Has unsaved changes since last sync
  deviceId?: string; // Device that made last edit
  hasConflict?: boolean; // True if conflict detected
  conflictCopyId?: string; // Reference to conflict copy if any
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface Folder {
  id: string;
  name: string;
  noteType?: NoteType;
  isDefault: boolean;
  isFavorite?: boolean;
  createdAt: Date;
  color?: string;
}
