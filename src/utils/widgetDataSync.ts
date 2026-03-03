import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { loadNotesFromDB } from './noteStorage';
import { loadTodoItems } from './todoItemsStorage';
import { getSetting, setSetting } from './settingsStorage';
import { Note, NoteType, TodoItem, Folder } from '@/types/note';

// Widget configuration types
export interface WidgetConfig {
  id: string;
  type: WidgetType;
  enabled: boolean;
  noteId?: string; // For specific note widgets
  sectionId?: string; // For section widgets
  noteType?: NoteType; // For note type widgets
}

export type WidgetType = 
  | 'section_tasks' 
  | 'specific_note';

// Widget data structures for native widgets
export interface TaskWidgetData {
  tasks: {
    id: string;
    text: string;
    completed: boolean;
    priority: string;
    dueDate?: string;
  }[];
  lastUpdated: string;
}

export interface NoteWidgetData {
  id: string;
  title: string;
  content: string; // Plain text preview
  type: NoteType;
  color?: string;
  lastUpdated: string;
}

export interface SectionWidgetData {
  sectionId: string;
  sectionName: string;
  tasks: TaskWidgetData['tasks'];
  lastUpdated: string;
}

export interface NotesListWidgetData {
  notes: {
    id: string;
    title: string;
    type: NoteType;
    preview: string;
  }[];
  lastUpdated: string;
}

// SharedPreferences keys for native widgets
const WIDGET_PREFS_PREFIX = 'npd_widget_';
const WIDGET_TASKS_KEY = `${WIDGET_PREFS_PREFIX}tasks`;
const WIDGET_NOTES_KEY = `${WIDGET_PREFS_PREFIX}notes`;
const WIDGET_SECTIONS_KEY = `${WIDGET_PREFS_PREFIX}sections`;
const WIDGET_CONFIG_KEY = `${WIDGET_PREFS_PREFIX}config`;
const WIDGET_NOTES_BY_TYPE_KEY = `${WIDGET_PREFS_PREFIX}notes_by_type`;

/**
 * Widget Data Sync Manager
 * Syncs app data to SharedPreferences for native Android widgets to read
 */
class WidgetDataSyncManager {
  private static instance: WidgetDataSyncManager;
  private syncInProgress = false;

  private constructor() {}

  static getInstance(): WidgetDataSyncManager {
    if (!WidgetDataSyncManager.instance) {
      WidgetDataSyncManager.instance = new WidgetDataSyncManager();
    }
    return WidgetDataSyncManager.instance;
  }

  /**
   * Initialize widget data sync - call on app start
   */
  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('[WidgetSync] Not on native platform, skipping');
      return;
    }

    // Initial sync
    await this.syncAllData();

    // Listen for data changes
    window.addEventListener('notesUpdated', () => this.syncNotes());
    window.addEventListener('todoItemsChanged', () => this.syncTasks());
    window.addEventListener('tasksUpdated', () => this.syncTasks());
    window.addEventListener('sectionsUpdated', () => this.syncSections());

    console.log('[WidgetSync] Initialized successfully');
  }

  /**
   * Sync all data to SharedPreferences
   */
  async syncAllData(): Promise<void> {
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    try {
      await Promise.all([
        this.syncTasks(),
        this.syncNotes(),
        this.syncSections(),
      ]);
      console.log('[WidgetSync] All data synced');
    } catch (error) {
      console.error('[WidgetSync] Sync error:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync tasks to SharedPreferences
   */
  async syncTasks(): Promise<void> {
    try {
      const tasks = await loadTodoItems();
      
      // Get today's and upcoming tasks (limit for widget performance)
      const now = new Date();
      const relevantTasks = tasks
        .filter(t => !t.completed)
        .slice(0, 20) // Limit for widget
        .map(t => ({
          id: t.id,
          text: t.text,
          completed: t.completed,
          priority: t.priority || 'none',
          dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : undefined,
          sectionId: t.sectionId,
        }));

      const taskData: TaskWidgetData = {
        tasks: relevantTasks,
        lastUpdated: now.toISOString(),
      };

      await Preferences.set({
        key: WIDGET_TASKS_KEY,
        value: JSON.stringify(taskData),
      });

      // Notify native widgets to refresh
      this.notifyWidgetUpdate('tasks');
    } catch (error) {
      console.error('[WidgetSync] Task sync error:', error);
    }
  }

  /**
   * Sync notes to SharedPreferences
   */
  async syncNotes(): Promise<void> {
    try {
      const notes = await loadNotesFromDB();
      const now = new Date();

      // Group notes by type
      const notesByType: Record<NoteType, NoteWidgetData[]> = {
        regular: [],
        sticky: [],
        lined: [],
        code: [],
        
        voice: [],
        textformat: [],
        linkedin: [],
        sketch: [],
      };

      // Process notes (limit per type for widget performance)
      notes.slice(0, 50).forEach(note => {
        const widgetNote: NoteWidgetData = {
          id: note.id,
          title: note.title || 'Untitled',
          content: this.stripHtml(note.content).slice(0, 200),
          type: note.type,
          color: note.color,
          lastUpdated: new Date(note.updatedAt).toISOString(),
        };

        if (notesByType[note.type].length < 10) {
          notesByType[note.type].push(widgetNote);
        }
      });

      await Preferences.set({
        key: WIDGET_NOTES_BY_TYPE_KEY,
        value: JSON.stringify(notesByType),
      });

      // Also save a flat list for dropdown widget
      const notesList: NotesListWidgetData = {
        notes: notes.slice(0, 30).map(n => ({
          id: n.id,
          title: n.title || 'Untitled',
          type: n.type,
          preview: this.stripHtml(n.content).slice(0, 100),
        })),
        lastUpdated: now.toISOString(),
      };

      await Preferences.set({
        key: WIDGET_NOTES_KEY,
        value: JSON.stringify(notesList),
      });

      this.notifyWidgetUpdate('notes');
    } catch (error) {
      console.error('[WidgetSync] Notes sync error:', error);
    }
  }

  /**
   * Sync sections with tasks to SharedPreferences
   */
  async syncSections(): Promise<void> {
    try {
      const sections = await getSetting<any[]>('task_sections', []);
      const tasks = await loadTodoItems();
      const now = new Date();

      const sectionData: SectionWidgetData[] = sections.slice(0, 10).map(section => ({
        sectionId: section.id,
        sectionName: section.name,
        tasks: tasks
          .filter(t => t.sectionId === section.id && !t.completed)
          .slice(0, 5)
          .map(t => ({
            id: t.id,
            text: t.text,
            completed: t.completed,
            priority: t.priority || 'none',
            dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : undefined,
          })),
        lastUpdated: now.toISOString(),
      }));

      await Preferences.set({
        key: WIDGET_SECTIONS_KEY,
        value: JSON.stringify(sectionData),
      });

      this.notifyWidgetUpdate('sections');
    } catch (error) {
      console.error('[WidgetSync] Sections sync error:', error);
    }
  }

  /**
   * Save widget configuration
   */
  async saveWidgetConfig(configs: WidgetConfig[]): Promise<void> {
    await setSetting('widget_configs', configs);
    await Preferences.set({
      key: WIDGET_CONFIG_KEY,
      value: JSON.stringify(configs),
    });
    console.log('[WidgetSync] Widget config saved');
  }

  /**
   * Get widget configurations
   */
  async getWidgetConfigs(): Promise<WidgetConfig[]> {
    return await getSetting<WidgetConfig[]>('widget_configs', []);
  }

  /**
   * Sync a specific note for a widget
   */
  async syncSpecificNote(noteId: string): Promise<void> {
    try {
      const notes = await loadNotesFromDB();
      const note = notes.find(n => n.id === noteId);
      
      if (note) {
        const noteData: NoteWidgetData = {
          id: note.id,
          title: note.title || 'Untitled',
          content: this.stripHtml(note.content),
          type: note.type,
          color: note.color,
          lastUpdated: new Date(note.updatedAt).toISOString(),
        };

        await Preferences.set({
          key: `${WIDGET_PREFS_PREFIX}note_${noteId}`,
          value: JSON.stringify(noteData),
        });

        this.notifyWidgetUpdate('specific_note');
      }
    } catch (error) {
      console.error('[WidgetSync] Specific note sync error:', error);
    }
  }

  /**
   * Notify native widgets to refresh (Android AppWidgetManager)
   */
  private notifyWidgetUpdate(type: string): void {
    // Dispatch event that can be caught by native bridge if needed
    window.dispatchEvent(new CustomEvent('widgetDataUpdated', {
      detail: { type, timestamp: Date.now() }
    }));
  }

  /**
   * Strip HTML tags from content
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }
}

export const widgetDataSync = WidgetDataSyncManager.getInstance();

/**
 * Available widget types for settings UI
 */
export const WIDGET_TYPES: { type: WidgetType; label: string; icon: string; description: string }[] = [
  { type: 'specific_note', label: 'Notes Widget', icon: '📝', description: 'Display any note you created on home screen' },
  { type: 'section_tasks', label: 'Section Tasks', icon: '📋', description: 'Show all tasks from a section with checkboxes' },
];
