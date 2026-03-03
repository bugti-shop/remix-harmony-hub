// Import parsers for Todoist, Notion, and Evernote exports
// Converts external formats into app-native TodoItem and Note types

import { TodoItem, Note, Priority } from '@/types/note';

export type ImportSource = 'todoist' | 'notion' | 'evernote';

export interface ImportResult {
  success: boolean;
  tasks: TodoItem[];
  notes: Note[];
  error?: string;
  stats: { tasks: number; notes: number };
}

const generateId = () => `imported-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// ─── CSV Parser ────────────────────────────────────────────
const parseCSV = (text: string): Record<string, string>[] => {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.toLowerCase().trim()] = (values[i] || '').trim(); });
    return row;
  });
};

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
};

// ─── Todoist CSV Import ────────────────────────────────────
// Todoist CSV columns: TYPE, CONTENT, DESCRIPTION, PRIORITY, INDENT, AUTHOR, RESPONSIBLE, DATE, DATE_LANG, TIMEZONE
const parseTodoistCSV = (text: string): ImportResult => {
  try {
    const rows = parseCSV(text);
    if (rows.length === 0) return { success: false, tasks: [], notes: [], error: 'No data found in CSV', stats: { tasks: 0, notes: 0 } };

    const tasks: TodoItem[] = [];

    for (const row of rows) {
      const type = row['type'] || '';
      const content = row['content'] || '';
      if (!content || type === 'section') continue;

      const priorityMap: Record<string, Priority> = { '1': 'none', '2': 'low', '3': 'medium', '4': 'high' };
      const rawPriority = row['priority'] || '1';

      const task: TodoItem = {
        id: generateId(),
        text: content,
        completed: false,
        priority: priorityMap[rawPriority] || 'none',
        description: row['description'] || undefined,
        dueDate: row['date'] ? new Date(row['date']) : undefined,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };

      // Indent > 1 means subtask — but without parent tracking, just add flat
      tasks.push(task);
    }

    return { success: true, tasks, notes: [], stats: { tasks: tasks.length, notes: 0 } };
  } catch (e) {
    return { success: false, tasks: [], notes: [], error: `Todoist parse error: ${e instanceof Error ? e.message : 'Unknown'}`, stats: { tasks: 0, notes: 0 } };
  }
};

// ─── Notion CSV/JSON Import ────────────────────────────────
const parseNotionCSV = (text: string): ImportResult => {
  try {
    const rows = parseCSV(text);
    if (rows.length === 0) return { success: false, tasks: [], notes: [], error: 'No data found', stats: { tasks: 0, notes: 0 } };

    const tasks: TodoItem[] = [];
    const notes: Note[] = [];

    // Detect if it's a tasks database or notes/pages
    const headers = Object.keys(rows[0]);
    const hasStatus = headers.some(h => ['status', 'done', 'completed', 'checkbox'].includes(h));
    const hasName = headers.some(h => ['name', 'title', 'task', 'to-do', 'todo'].includes(h));

    for (const row of rows) {
      const title = row['name'] || row['title'] || row['task'] || row['to-do'] || row['todo'] || Object.values(row)[0] || '';
      if (!title) continue;

      if (hasStatus || hasName) {
        // Treat as task
        const isDone = ['true', 'yes', 'done', 'completed', '1', 'x'].includes(
          (row['status'] || row['done'] || row['completed'] || row['checkbox'] || '').toLowerCase()
        );

        const priorityVal = (row['priority'] || '').toLowerCase();
        let priority: Priority = 'none';
        if (priorityVal.includes('high') || priorityVal.includes('urgent')) priority = 'high';
        else if (priorityVal.includes('medium') || priorityVal.includes('mid')) priority = 'medium';
        else if (priorityVal.includes('low')) priority = 'low';

        tasks.push({
          id: generateId(),
          text: title,
          completed: isDone,
          priority,
          description: row['notes'] || row['description'] || row['details'] || undefined,
          dueDate: row['due'] || row['due date'] || row['date'] ? new Date(row['due'] || row['due date'] || row['date']) : undefined,
          tags: row['tags'] ? row['tags'].split(',').map(t => t.trim()).filter(Boolean) : undefined,
          createdAt: row['created'] ? new Date(row['created']) : new Date(),
          modifiedAt: new Date(),
        });
      } else {
        // Treat as note
        notes.push({
          id: generateId(),
          type: 'regular',
          title,
          content: row['content'] || row['body'] || row['notes'] || '',
          voiceRecordings: [],
          syncVersion: 0,
          syncStatus: 'synced',
          isDirty: false,
          createdAt: row['created'] ? new Date(row['created']) : new Date(),
          updatedAt: new Date(),
        });
      }
    }

    return { success: true, tasks, notes, stats: { tasks: tasks.length, notes: notes.length } };
  } catch (e) {
    return { success: false, tasks: [], notes: [], error: `Notion parse error: ${e instanceof Error ? e.message : 'Unknown'}`, stats: { tasks: 0, notes: 0 } };
  }
};

const parseNotionJSON = (text: string): ImportResult => {
  try {
    const data = JSON.parse(text);
    const items = Array.isArray(data) ? data : data.results || data.pages || [data];
    const tasks: TodoItem[] = [];
    const notes: Note[] = [];

    for (const item of items) {
      const props = item.properties || item;
      const title = extractNotionTitle(props);
      if (!title) continue;

      // If it has checkbox/status, treat as task
      const hasCheckbox = Object.values(props).some((v: any) => v?.type === 'checkbox' || v?.checkbox !== undefined);

      if (hasCheckbox) {
        const checkboxProp = Object.values(props).find((v: any) => v?.type === 'checkbox' || v?.checkbox !== undefined) as any;
        tasks.push({
          id: generateId(),
          text: title,
          completed: checkboxProp?.checkbox || false,
          priority: 'none',
          createdAt: item.created_time ? new Date(item.created_time) : new Date(),
          modifiedAt: new Date(),
        });
      } else {
        notes.push({
          id: generateId(),
          type: 'regular',
          title,
          content: '',
          voiceRecordings: [],
          syncVersion: 0,
          syncStatus: 'synced',
          isDirty: false,
          createdAt: item.created_time ? new Date(item.created_time) : new Date(),
          updatedAt: new Date(),
        });
      }
    }

    return { success: true, tasks, notes, stats: { tasks: tasks.length, notes: notes.length } };
  } catch (e) {
    return { success: false, tasks: [], notes: [], error: `Notion JSON parse error: ${e instanceof Error ? e.message : 'Unknown'}`, stats: { tasks: 0, notes: 0 } };
  }
};

const extractNotionTitle = (props: any): string => {
  for (const val of Object.values(props)) {
    const v = val as any;
    if (v?.type === 'title' && Array.isArray(v.title)) {
      return v.title.map((t: any) => t.plain_text || t.text?.content || '').join('');
    }
    if (typeof v === 'string') return v;
  }
  return props.name || props.title || props.Name || props.Title || '';
};

// ─── Evernote ENEX/HTML Import ──────────────────────────────
const parseEvernoteExport = (text: string): ImportResult => {
  try {
    const notes: Note[] = [];

    // Handle ENEX (XML) format
    if (text.includes('<en-export') || text.includes('<note>')) {
      const noteMatches = text.match(/<note>([\s\S]*?)<\/note>/g) || [];

      for (const noteXml of noteMatches) {
        const title = noteXml.match(/<title>([\s\S]*?)<\/title>/)?.[1] || 'Untitled';
        const contentMatch = noteXml.match(/<content>([\s\S]*?)<\/content>/)?.[1] || '';
        const createdMatch = noteXml.match(/<created>([\s\S]*?)<\/created>/)?.[1];

        // Strip ENML/HTML tags for plain text
        const plainContent = contentMatch
          .replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '')
          .replace(/<[^>]+>/g, '\n')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        const createdAt = createdMatch
          ? new Date(createdMatch.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'))
          : new Date();

        notes.push({
          id: generateId(),
          type: 'regular',
          title: title.trim(),
          content: plainContent,
          voiceRecordings: [],
          syncVersion: 0,
          syncStatus: 'synced',
          isDirty: false,
          createdAt,
          updatedAt: new Date(),
        });
      }
    } else {
      // Treat as plain HTML — single note
      const titleMatch = text.match(/<title>(.*?)<\/title>/i);
      const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const plainContent = (bodyMatch?.[1] || text)
        .replace(/<[^>]+>/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      notes.push({
        id: generateId(),
        type: 'regular',
        title: titleMatch?.[1] || 'Imported Note',
        content: plainContent,
        voiceRecordings: [],
        syncVersion: 0,
        syncStatus: 'synced',
        isDirty: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return { success: true, tasks: [], notes, stats: { tasks: 0, notes: notes.length } };
  } catch (e) {
    return { success: false, tasks: [], notes: [], error: `Evernote parse error: ${e instanceof Error ? e.message : 'Unknown'}`, stats: { tasks: 0, notes: 0 } };
  }
};

// ─── Main Import Function ──────────────────────────────────
export const importFromFile = (text: string, source: ImportSource, fileType: string): ImportResult => {
  switch (source) {
    case 'todoist':
      return parseTodoistCSV(text);
    case 'notion':
      return fileType === 'json' ? parseNotionJSON(text) : parseNotionCSV(text);
    case 'evernote':
      return parseEvernoteExport(text);
    default:
      return { success: false, tasks: [], notes: [], error: 'Unknown source', stats: { tasks: 0, notes: 0 } };
  }
};

export const getAcceptedFileTypes = (source: ImportSource): string => {
  switch (source) {
    case 'todoist': return '.csv';
    case 'notion': return '.csv,.json';
    case 'evernote': return '.enex,.html,.htm';
  }
};
