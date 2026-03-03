import { addDays, addWeeks, addMonths, addHours, addMinutes, setHours, setMinutes, startOfDay, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday, nextSaturday, nextSunday, isMonday, isTuesday, isWednesday, isThursday, isFriday, isSaturday, isSunday, getDay, setDate, lastDayOfMonth, getDate } from 'date-fns';
import { RepeatType, AdvancedRepeatPattern, ColoredTag } from '@/types/note';

export interface ParsedTask {
  text: string;
  dueDate?: Date;
  reminderTime?: Date;
  reminderOffset?: string; // 'exact', '5min', '10min', '15min', '30min', '1hour', '1day'
  priority?: 'high' | 'medium' | 'low';
  repeatType?: RepeatType;
  repeatDays?: number[]; // 0-6 for Sunday-Saturday
  advancedRepeat?: AdvancedRepeatPattern;
  location?: string;
  tags?: string[]; // Parsed from #tag syntax
  folderName?: string; // Parsed from @folder syntax
  description?: string; // Parsed from // or -- syntax
  estimatedHours?: number; // Parsed from ~2h, ~30m syntax
}

// ─── Time patterns ───────────────────────────────────────────────
const timePatterns = [
  /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
  /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
  /\b(\d{1,2}):(\d{2})\b/,
  /\bin the (morning|afternoon|evening|night)\b/i,
];

// ─── Relative time patterns ─────────────────────────────────────
const relativeTimePatterns: { pattern: RegExp; getDate: (match: RegExpMatchArray) => Date }[] = [
  { pattern: /\bin\s+(\d+)\s*(?:min(?:ute)?s?)\b/i, getDate: (m) => addMinutes(new Date(), parseInt(m[1])) },
  { pattern: /\bin\s+(\d+)\s*(?:hour?s?|hr?s?)\b/i, getDate: (m) => addHours(new Date(), parseInt(m[1])) },
  { pattern: /\bin\s+(?:half\s+an?\s+hour|30\s*min)/i, getDate: () => addMinutes(new Date(), 30) },
  { pattern: /\bin\s+an?\s+hour\b/i, getDate: () => addHours(new Date(), 1) },
];

// ─── Recurring patterns ─────────────────────────────────────────
const recurringPatterns: { pattern: RegExp; getRepeat: (match: RegExpMatchArray) => { type: RepeatType; days?: number[] } }[] = [
  { pattern: /\b(?:every\s*hour|hourly)\b/i, getRepeat: () => ({ type: 'hourly' }) },
  { pattern: /\b(?:every\s*day|daily)\b/i, getRepeat: () => ({ type: 'daily' }) },
  { pattern: /\b(?:every\s*week|weekly)\b/i, getRepeat: () => ({ type: 'weekly' }) },
  { pattern: /\b(?:every\s*month|monthly)\b/i, getRepeat: () => ({ type: 'monthly' }) },
  { pattern: /\b(?:every\s*year|yearly|annually)\b/i, getRepeat: () => ({ type: 'yearly' }) },
  { pattern: /\b(?:every\s*weekday|weekdays|on\s*weekdays)\b/i, getRepeat: () => ({ type: 'weekdays' }) },
  { pattern: /\b(?:every\s*weekend|weekends|on\s*weekends)\b/i, getRepeat: () => ({ type: 'weekends' }) },
  { pattern: /\bevery\s*(monday|mon)\b/i, getRepeat: () => ({ type: 'custom', days: [1] }) },
  { pattern: /\bevery\s*(tuesday|tue|tues)\b/i, getRepeat: () => ({ type: 'custom', days: [2] }) },
  { pattern: /\bevery\s*(wednesday|wed)\b/i, getRepeat: () => ({ type: 'custom', days: [3] }) },
  { pattern: /\bevery\s*(thursday|thu|thurs)\b/i, getRepeat: () => ({ type: 'custom', days: [4] }) },
  { pattern: /\bevery\s*(friday|fri)\b/i, getRepeat: () => ({ type: 'custom', days: [5] }) },
  { pattern: /\bevery\s*(saturday|sat)\b/i, getRepeat: () => ({ type: 'custom', days: [6] }) },
  { pattern: /\bevery\s*(sunday|sun)\b/i, getRepeat: () => ({ type: 'custom', days: [0] }) },
  { pattern: /\bevery\s+((?:(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\s*(?:,|and|&)\s*)+(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?))\b/i, 
    getRepeat: (m) => {
      const dayMap: { [key: string]: number } = {
        sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
        wed: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4,
        fri: 5, friday: 5, sat: 6, saturday: 6
      };
      const days = m[1].toLowerCase().match(/\b(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/gi) || [];
      const dayNumbers = [...new Set(days.map(d => dayMap[d.toLowerCase().replace(/day$/, '')] ?? dayMap[d.toLowerCase()]))];
      return { type: 'custom', days: dayNumbers.sort() };
    }
  },
];

// ─── Location patterns ──────────────────────────────────────────
const locationPatterns = [
  /\bat\s+(?:the\s+)?(office|home|work|gym|school|store|market|mall|hospital|clinic|bank|library|cafe|restaurant|airport|station)\b/i,
  /\bat\s+([A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+)*)\b/,
];

// ─── Date patterns ──────────────────────────────────────────────
const datePatterns: { pattern: RegExp; getDate: (match: RegExpMatchArray) => Date }[] = [
  { pattern: /\btoday\b/i, getDate: () => startOfDay(new Date()) },
  { pattern: /\btonight\b/i, getDate: () => setHours(startOfDay(new Date()), 21) },
  { pattern: /\btomorrow\b/i, getDate: () => startOfDay(addDays(new Date(), 1)) },
  { pattern: /\btmr\b/i, getDate: () => startOfDay(addDays(new Date(), 1)) },
  { pattern: /\btmrw\b/i, getDate: () => startOfDay(addDays(new Date(), 1)) },
  { pattern: /\bday after tomorrow\b/i, getDate: () => startOfDay(addDays(new Date(), 2)) },
  { pattern: /\byesterday\b/i, getDate: () => startOfDay(addDays(new Date(), -1)) },
  // End of day / end of week / end of month shortcuts
  { pattern: /\b(?:eod|end of (?:the )?day)\b/i, getDate: () => setHours(startOfDay(new Date()), 23) },
  { pattern: /\b(?:eow|end of (?:the )?week)\b/i, getDate: () => {
    const today = new Date();
    const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7;
    return setHours(startOfDay(addDays(today, daysUntilFriday)), 17);
  }},
  { pattern: /\b(?:eom|end of (?:the )?month)\b/i, getDate: () => {
    return setHours(lastDayOfMonth(new Date()), 17);
  }},
  // "this morning/afternoon/evening"
  { pattern: /\bthis\s+morning\b/i, getDate: () => setHours(startOfDay(new Date()), 9) },
  { pattern: /\bthis\s+afternoon\b/i, getDate: () => setHours(startOfDay(new Date()), 14) },
  { pattern: /\bthis\s+evening\b/i, getDate: () => setHours(startOfDay(new Date()), 18) },
  { pattern: /\bthis weekend\b/i, getDate: () => {
    const today = new Date();
    const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7;
    return startOfDay(addDays(today, daysUntilSaturday));
  }},
  { pattern: /\bnext week\b/i, getDate: () => startOfDay(addWeeks(new Date(), 1)) },
  { pattern: /\bnext month\b/i, getDate: () => startOfDay(addMonths(new Date(), 1)) },
  { pattern: /\bin (\d+) days?\b/i, getDate: (m) => startOfDay(addDays(new Date(), parseInt(m[1]))) },
  { pattern: /\bin (\d+) weeks?\b/i, getDate: (m) => startOfDay(addWeeks(new Date(), parseInt(m[1]))) },
  { pattern: /\bin (\d+) months?\b/i, getDate: (m) => startOfDay(addMonths(new Date(), parseInt(m[1]))) },
  // Days of the week
  { pattern: /\b(next\s+)?monday\b/i, getDate: (m) => {
    const today = new Date();
    if (m[1] || isMonday(today)) return nextMonday(addDays(today, 1));
    return nextMonday(today);
  }},
  { pattern: /\b(next\s+)?tuesday\b/i, getDate: (m) => {
    const today = new Date();
    if (m[1] || isTuesday(today)) return nextTuesday(addDays(today, 1));
    return nextTuesday(today);
  }},
  { pattern: /\b(next\s+)?wednesday\b/i, getDate: (m) => {
    const today = new Date();
    if (m[1] || isWednesday(today)) return nextWednesday(addDays(today, 1));
    return nextWednesday(today);
  }},
  { pattern: /\b(next\s+)?thursday\b/i, getDate: (m) => {
    const today = new Date();
    if (m[1] || isThursday(today)) return nextThursday(addDays(today, 1));
    return nextThursday(today);
  }},
  { pattern: /\b(next\s+)?friday\b/i, getDate: (m) => {
    const today = new Date();
    if (m[1] || isFriday(today)) return nextFriday(addDays(today, 1));
    return nextFriday(today);
  }},
  { pattern: /\b(next\s+)?saturday\b/i, getDate: (m) => {
    const today = new Date();
    if (m[1] || isSaturday(today)) return nextSaturday(addDays(today, 1));
    return nextSaturday(today);
  }},
  { pattern: /\b(next\s+)?sunday\b/i, getDate: (m) => {
    const today = new Date();
    if (m[1] || isSunday(today)) return nextSunday(addDays(today, 1));
    return nextSunday(today);
  }},
  // Specific date formats: "Dec 25", "December 25", "25th December"
  { pattern: /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i, 
    getDate: (m) => {
      const monthMap: { [key: string]: number } = {
        jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
        may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
        sep: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
      };
      const month = monthMap[m[1].toLowerCase()];
      const day = parseInt(m[2]);
      const date = new Date();
      date.setMonth(month, day);
      date.setHours(0, 0, 0, 0);
      if (date < new Date()) date.setFullYear(date.getFullYear() + 1);
      return date;
    }
  },
  { pattern: /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i,
    getDate: (m) => {
      const monthMap: { [key: string]: number } = {
        jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
        may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
        sep: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
      };
      const day = parseInt(m[1]);
      const month = monthMap[m[2].toLowerCase()];
      const date = new Date();
      date.setMonth(month, day);
      date.setHours(0, 0, 0, 0);
      if (date < new Date()) date.setFullYear(date.getFullYear() + 1);
      return date;
    }
  },
  // MM/DD and DD/MM formats
  { pattern: /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, getDate: (m) => {
    const month = parseInt(m[1]) - 1;
    const day = parseInt(m[2]);
    const date = new Date();
    if (m[3]) {
      let year = parseInt(m[3]);
      if (year < 100) year += 2000;
      date.setFullYear(year);
    }
    date.setMonth(month, day);
    date.setHours(0, 0, 0, 0);
    if (!m[3] && date < new Date()) date.setFullYear(date.getFullYear() + 1);
    return date;
  }},
  // YYYY-MM-DD format
  { pattern: /\b(\d{4})-(\d{2})-(\d{2})\b/, getDate: (m) => {
    const date = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
    date.setHours(0, 0, 0, 0);
    return date;
  }},
];

// ─── Priority patterns ──────────────────────────────────────────
const priorityPatterns: { pattern: RegExp; priority: 'high' | 'medium' | 'low' }[] = [
  { pattern: /\b(high priority|urgent|important|asap|critical|!{2,})\b/i, priority: 'high' },
  { pattern: /\b(medium priority|normal|moderate)\b/i, priority: 'medium' },
  { pattern: /\b(low priority|later|whenever|someday)\b/i, priority: 'low' },
  { pattern: /!{3,}/, priority: 'high' },
  { pattern: /!!/, priority: 'medium' },
  // Priority shortcuts: p1, p2, p3
  { pattern: /\bp1\b/i, priority: 'high' },
  { pattern: /\bp2\b/i, priority: 'medium' },
  { pattern: /\bp3\b/i, priority: 'low' },
  // Quick add syntax: !high, !medium, !low
  { pattern: /!high\b/i, priority: 'high' },
  { pattern: /!med(?:ium)?\b/i, priority: 'medium' },
  { pattern: /!low\b/i, priority: 'low' },
  // Star/bang priority: *, **
  { pattern: /\*{2,}/, priority: 'high' },
  { pattern: /\*(?!\*)/, priority: 'medium' },
];

// ─── Advanced recurring patterns ────────────────────────────────
const advancedRecurringPatterns: { pattern: RegExp; getRepeat: (match: RegExpMatchArray) => { advancedRepeat: AdvancedRepeatPattern; firstOccurrence?: Date } }[] = [
  { 
    pattern: /\bevery\s+(1st|2nd|3rd|4th|last|first|second|third|fourth)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i,
    getRepeat: (m) => {
      const weekMap: { [key: string]: 1 | 2 | 3 | 4 | -1 } = {
        '1st': 1, 'first': 1, '2nd': 2, 'second': 2, '3rd': 3, 'third': 3, '4th': 4, 'fourth': 4, 'last': -1
      };
      const dayMap: { [key: string]: number } = {
        sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tuesday: 2,
        wed: 3, wednesday: 3, thu: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6
      };
      const weekNum = weekMap[m[1].toLowerCase()];
      const dayNum = dayMap[m[2].toLowerCase()];
      const firstOccurrence = getNthWeekdayOfMonth(new Date(), weekNum, dayNum);
      return {
        advancedRepeat: { frequency: 'monthly', monthlyType: 'weekday', monthlyWeek: weekNum, monthlyDay: dayNum },
        firstOccurrence,
      };
    }
  },
  {
    pattern: /\bevery\s+(\d+)\s*(?:hour?s?|hr?s?)\b/i,
    getRepeat: (m) => ({
      advancedRepeat: { frequency: 'hourly', interval: parseInt(m[1]) },
    })
  },
  {
    pattern: /\bevery\s+(\d+)\s+(day|week|month)s?\b/i,
    getRepeat: (m) => {
      const freqMap: { [key: string]: RepeatType } = { day: 'daily', week: 'weekly', month: 'monthly' };
      return {
        advancedRepeat: { frequency: freqMap[m[2].toLowerCase()], interval: parseInt(m[1]) },
      };
    }
  },
  {
    pattern: /\b(?:every\s+)?last\s+day\s+(?:of\s+(?:the\s+)?)?month\b/i,
    getRepeat: () => {
      const today = new Date();
      const lastDay = lastDayOfMonth(today);
      return {
        advancedRepeat: { frequency: 'monthly', monthlyType: 'date', monthlyDay: getDate(lastDay) },
        firstOccurrence: lastDay,
      };
    }
  },
];

// ─── Reminder patterns ──────────────────────────────────────────
const reminderPatterns: { pattern: RegExp; getOffset: (match: RegExpMatchArray) => { offset: string; matched: string } }[] = [
  { pattern: /\b(?:remind(?:\s+me)?|notify(?:\s+me)?)\s+(?:at\s+)?(?:the\s+)?exact\s+time\b/i, getOffset: (m) => ({ offset: 'exact', matched: m[0] }) },
  { pattern: /\b(?:remind(?:\s+me)?|notify(?:\s+me)?)\s+(\d+)\s*(?:min(?:ute)?s?)\s*(?:before|earlier)?\b/i, getOffset: (m) => {
    const mins = parseInt(m[1]);
    if (mins <= 5) return { offset: '5min', matched: m[0] };
    if (mins <= 10) return { offset: '10min', matched: m[0] };
    if (mins <= 15) return { offset: '15min', matched: m[0] };
    if (mins <= 30) return { offset: '30min', matched: m[0] };
    return { offset: '1hour', matched: m[0] };
  }},
  { pattern: /\b(?:remind(?:\s+me)?|notify(?:\s+me)?)\s+(?:1|one|an?)\s*(?:hour?s?|hr?s?)\s*(?:before|earlier)?\b/i, getOffset: (m) => ({ offset: '1hour', matched: m[0] }) },
  { pattern: /\b(?:remind(?:\s+me)?|notify(?:\s+me)?)\s+(?:1|one|a)\s*(?:day)\s*(?:before|earlier)?\b/i, getOffset: (m) => ({ offset: '1day', matched: m[0] }) },
  { pattern: /\b(?:remind(?:\s+me)?|notify(?:\s+me)?)\b/i, getOffset: (m) => ({ offset: 'exact', matched: m[0] }) },
];

// ─── Estimated effort patterns ──────────────────────────────────
function parseEstimatedEffort(text: string): { hours: number; matched: string } | null {
  // ~2h, ~30m, ~1.5h, ~1h30m, est:2h, effort:30m
  let match = text.match(/(?:~|est(?:imate)?:|effort:)\s*(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?\s*(?:(\d+)\s*m(?:in(?:ute)?s?)?)?/i);
  if (match) {
    const hours = parseFloat(match[1]) + (match[2] ? parseInt(match[2]) / 60 : 0);
    return { hours, matched: match[0] };
  }
  match = text.match(/(?:~|est(?:imate)?:|effort:)\s*(\d+)\s*m(?:in(?:ute)?s?)?/i);
  if (match) {
    return { hours: parseInt(match[1]) / 60, matched: match[0] };
  }
  return null;
}

// ─── Inline description parsing ─────────────────────────────────
function parseInlineDescription(text: string): { description: string; cleanedText: string } | null {
  // Support "// description" or "-- description" or "| description" at end of text
  const match = text.match(/\s+(?:\/\/|--|[|])\s+(.+)$/);
  if (match) {
    const cleanedText = text.replace(match[0], '').trim();
    return { description: match[1].trim(), cleanedText };
  }
  return null;
}

// ─── Helper function for nth weekday ────────────────────────────
function getNthWeekdayOfMonth(baseDate: Date, weekNum: 1 | 2 | 3 | 4 | -1, dayOfWeek: number): Date {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  
  if (weekNum === -1) {
    const lastDay = lastDayOfMonth(baseDate);
    let date = new Date(year, month, getDate(lastDay));
    while (getDay(date) !== dayOfWeek) date = addDays(date, -1);
    if (date < baseDate) return getNthWeekdayOfMonth(addMonths(baseDate, 1), weekNum, dayOfWeek);
    return startOfDay(date);
  }
  
  let date = new Date(year, month, 1);
  while (getDay(date) !== dayOfWeek) date = addDays(date, 1);
  date = addDays(date, (weekNum - 1) * 7);
  if (date < baseDate) return getNthWeekdayOfMonth(addMonths(baseDate, 1), weekNum, dayOfWeek);
  return startOfDay(date);
}

// ─── Quick add syntax parsers ───────────────────────────────────
function parseTags(text: string): { tags: string[]; cleanedText: string } {
  const tags: string[] = [];
  // Support #tag and #"multi word tag"
  const quotedTagMatches = text.match(/#"([^"]+)"/g);
  if (quotedTagMatches) {
    quotedTagMatches.forEach(match => tags.push(match.slice(2, -1)));
  }
  const simpleTagMatches = text.replace(/#"[^"]+"/g, '').match(/#(\w[\w-]*)/g);
  if (simpleTagMatches) {
    simpleTagMatches.forEach(match => tags.push(match.substring(1)));
  }
  const cleanedText = text.replace(/#"[^"]+"/g, '').replace(/#\w[\w-]*/g, '').trim();
  return { tags, cleanedText };
}

function parseFolderName(text: string): { folderName?: string; cleanedText: string } {
  // Support @folder and @"multi word folder"
  let match = text.match(/@"([^"]+)"/);
  if (match) {
    return { folderName: match[1], cleanedText: text.replace(match[0], '').trim() };
  }
  match = text.match(/@(\w[\w-]*)/);
  if (match) {
    return { folderName: match[1], cleanedText: text.replace(match[0], '').trim() };
  }
  return { cleanedText: text };
}

// ─── Core parse functions ───────────────────────────────────────
function parseReminderOffset(text: string): { offset: string; matched: string } | null {
  for (const { pattern, getOffset } of reminderPatterns) {
    const match = text.match(pattern);
    if (match) return getOffset(match);
  }
  return null;
}

function parseTime(text: string): { hours: number; minutes: number; matched: string } | null {
  let match = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (match) {
    let hours = parseInt(match[1]);
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const period = match[3]?.toLowerCase();
    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    return { hours, minutes, matched: match[0] };
  }
  
  match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (match) {
    let hours = parseInt(match[1]);
    const minutes = match[2] ? parseInt(match[2]) : 0;
    const period = match[3].toLowerCase();
    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    return { hours, minutes, matched: match[0] };
  }
  
  match = text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (match) {
    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return { hours, minutes, matched: match[0] };
    }
  }
  
  match = text.match(/\bin the (morning|afternoon|evening|night)\b/i);
  if (match) {
    const timeOfDay = match[1].toLowerCase();
    let hours = 9;
    if (timeOfDay === 'afternoon') hours = 14;
    else if (timeOfDay === 'evening') hours = 18;
    else if (timeOfDay === 'night') hours = 21;
    return { hours, minutes: 0, matched: match[0] };
  }
  
  return null;
}

function parseRelativeTime(text: string): { date: Date; matched: string } | null {
  for (const { pattern, getDate } of relativeTimePatterns) {
    const match = text.match(pattern);
    if (match) return { date: getDate(match), matched: match[0] };
  }
  return null;
}

function parseAdvancedRecurring(text: string): { advancedRepeat: AdvancedRepeatPattern; firstOccurrence?: Date; matched: string } | null {
  for (const { pattern, getRepeat } of advancedRecurringPatterns) {
    const match = text.match(pattern);
    if (match) return { ...getRepeat(match), matched: match[0] };
  }
  return null;
}

function parseRecurring(text: string): { type: RepeatType; days?: number[]; matched: string } | null {
  for (const { pattern, getRepeat } of recurringPatterns) {
    const match = text.match(pattern);
    if (match) return { ...getRepeat(match), matched: match[0] };
  }
  return null;
}

function parseLocation(text: string): { location: string; matched: string } | null {
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) {
      const location = match[1]?.trim();
      if (location && location.length > 1) return { location, matched: match[0] };
    }
  }
  return null;
}

function parseDate(text: string): { date: Date; matched: string } | null {
  // Also support "due" and "by" prefixes: "due tomorrow", "by friday"
  const prefixed = text.match(/\b(?:due|by)\s+/i);
  const searchText = prefixed ? text : text;
  
  for (const { pattern, getDate } of datePatterns) {
    const match = searchText.match(pattern);
    if (match) {
      // Check if there's a "due" or "by" prefix directly before this match
      const matchIdx = searchText.indexOf(match[0]);
      const beforeMatch = searchText.substring(0, matchIdx).trimEnd();
      const hasDueBy = /\b(?:due|by)$/i.test(beforeMatch);
      const fullMatched = hasDueBy 
        ? searchText.substring(beforeMatch.lastIndexOf(beforeMatch.match(/\b(?:due|by)$/i)?.[0] || ''), matchIdx + match[0].length)
        : match[0];
      return { date: getDate(match), matched: fullMatched };
    }
  }
  return null;
}

function parsePriority(text: string): { priority: 'high' | 'medium' | 'low'; matched: string } | null {
  for (const { pattern, priority } of priorityPatterns) {
    const match = text.match(pattern);
    if (match) return { priority, matched: match[0] };
  }
  return null;
}

// ─── Main parse function ────────────────────────────────────────
export function parseNaturalLanguageTask(input: string): ParsedTask {
  let text = input.trim();
  let dueDate: Date | undefined;
  let reminderTime: Date | undefined;
  let reminderOffset: string | undefined;
  let priority: 'high' | 'medium' | 'low' | undefined;
  let repeatType: RepeatType | undefined;
  let repeatDays: number[] | undefined;
  let advancedRepeat: AdvancedRepeatPattern | undefined;
  let location: string | undefined;
  let tags: string[] | undefined;
  let folderName: string | undefined;
  let description: string | undefined;
  let estimatedHours: number | undefined;
  
  // 1. Parse inline description first (// or -- at end)
  const descResult = parseInlineDescription(text);
  if (descResult) {
    description = descResult.description;
    text = descResult.cleanedText;
  }
  
  // 2. Parse estimated effort (~2h, ~30m, est:1h)
  const effortResult = parseEstimatedEffort(text);
  if (effortResult) {
    estimatedHours = effortResult.hours;
    text = text.replace(effortResult.matched, '').trim();
  }
  
  // 3. Parse quick add syntax: #tags and @folder
  const tagsResult = parseTags(text);
  if (tagsResult.tags.length > 0) {
    tags = tagsResult.tags;
    text = tagsResult.cleanedText;
  }
  
  const folderResult = parseFolderName(text);
  if (folderResult.folderName) {
    folderName = folderResult.folderName;
    text = folderResult.cleanedText;
  }
  
  // 4. Parse reminder offset
  const reminderOffsetResult = parseReminderOffset(text);
  if (reminderOffsetResult) {
    reminderOffset = reminderOffsetResult.offset;
    text = text.replace(reminderOffsetResult.matched, '').trim();
  }
  
  // 5. Parse advanced recurring patterns first (e.g., "every 2nd Tuesday")
  const advancedRecurringResult = parseAdvancedRecurring(text);
  if (advancedRecurringResult) {
    advancedRepeat = advancedRecurringResult.advancedRepeat;
    if (advancedRecurringResult.firstOccurrence) dueDate = advancedRecurringResult.firstOccurrence;
    text = text.replace(advancedRecurringResult.matched, '').trim();
    repeatType = advancedRepeat.frequency;
  }
  
  // 6. Parse recurring pattern
  if (!advancedRepeat) {
    const recurringResult = parseRecurring(text);
    if (recurringResult) {
      repeatType = recurringResult.type;
      repeatDays = recurringResult.days;
      text = text.replace(recurringResult.matched, '').trim();
      
      if (repeatDays && repeatDays.length > 0) {
        const today = new Date();
        const currentDay = today.getDay();
        const nextDay = repeatDays.find(d => d > currentDay) ?? repeatDays[0];
        const daysUntil = (nextDay - currentDay + 7) % 7 || 7;
        dueDate = startOfDay(addDays(today, daysUntil));
      } else if (repeatType === 'weekdays') {
        const today = new Date();
        const currentDay = today.getDay();
        let daysUntil = 1;
        if (currentDay === 5) daysUntil = 3;
        else if (currentDay === 6) daysUntil = 2;
        dueDate = startOfDay(addDays(today, daysUntil));
      } else if (repeatType === 'weekends') {
        const today = new Date();
        const currentDay = today.getDay();
        const daysUntilSaturday = (6 - currentDay + 7) % 7 || 7;
        dueDate = startOfDay(addDays(today, daysUntilSaturday));
      }
    }
  }
  
  // 7. Parse relative time
  const relativeTimeResult = parseRelativeTime(text);
  if (relativeTimeResult) {
    dueDate = relativeTimeResult.date;
    reminderTime = relativeTimeResult.date;
    if (!reminderOffset) reminderOffset = 'exact';
    text = text.replace(relativeTimeResult.matched, '').trim();
  }
  
  // 8. Parse date
  if (!dueDate) {
    const dateResult = parseDate(text);
    if (dateResult) {
      dueDate = dateResult.date;
      text = text.replace(dateResult.matched, '').trim();
    }
  }
  
  // 9. Parse time
  const timeResult = parseTime(input);
  if (timeResult) {
    if (dueDate) {
      dueDate = setHours(setMinutes(dueDate, timeResult.minutes), timeResult.hours);
      reminderTime = new Date(dueDate);
    } else {
      dueDate = setHours(setMinutes(startOfDay(new Date()), timeResult.minutes), timeResult.hours);
      reminderTime = new Date(dueDate);
    }
    if (!reminderOffset) reminderOffset = 'exact';
    text = text.replace(timeResult.matched, '').trim();
  }
  
  // 10. Apply reminder offset
  if (reminderTime && reminderOffset && reminderOffset !== 'exact') {
    const offsetMinutes: { [key: string]: number } = {
      '5min': 5, '10min': 10, '15min': 15, '30min': 30, '1hour': 60, '1day': 1440,
    };
    const mins = offsetMinutes[reminderOffset];
    if (mins) reminderTime = addMinutes(reminderTime, -mins);
  }
  
  // 11. Parse priority
  const priorityResult = parsePriority(text);
  if (priorityResult) {
    priority = priorityResult.priority;
    text = text.replace(priorityResult.matched, '').trim();
  }
  
  // 12. Parse location (only from known places, not @folder conflicts)
  const locationResult = parseLocation(text);
  if (locationResult) {
    location = locationResult.location;
    text = text.replace(locationResult.matched, '').trim();
  }
  
  // 13. Clean up the text
  text = text
    .replace(/\s+/g, ' ')
    .replace(/^\s*,\s*/, '')
    .replace(/\s*,\s*$/, '')
    .replace(/\s+at\s*$/, '')
    .replace(/\s+on\s*$/, '')
    .replace(/\s+by\s*$/, '')
    .replace(/\s+in\s*$/, '')
    .replace(/\s+every\s*$/, '')
    .replace(/\s+due\s*$/, '')
    .replace(/\s+for\s*$/, '')
    .trim();
  
  return {
    text: text || input.trim(),
    dueDate,
    reminderTime,
    reminderOffset,
    priority,
    repeatType,
    repeatDays,
    advancedRepeat,
    location,
    tags,
    folderName,
    description,
    estimatedHours,
  };
}

// ─── Detection helper ───────────────────────────────────────────
export function hasNaturalLanguagePatterns(input: string): boolean {
  // Quick add syntax
  if (/#\w+/.test(input) || /#"[^"]+"/.test(input) || /@\w+/.test(input) || /!(?:high|med|low)\b/i.test(input)) return true;
  
  // Remind / notify
  if (/\b(?:remind(?:\s+me)?|notify(?:\s+me)?)\b/i.test(input)) return true;
  
  // Effort estimation
  if (/(?:~|est(?:imate)?:|effort:)\s*\d/i.test(input)) return true;
  
  // Inline description
  if (/\s+(?:\/\/|--|[|])\s+/.test(input)) return true;
  
  // Priority shortcuts p1/p2/p3
  if (/\bp[1-3]\b/i.test(input)) return true;
  
  // "due" or "by" + date word
  if (/\b(?:due|by)\s+(?:today|tomorrow|tmr|monday|tuesday|wednesday|thursday|friday|saturday|sunday|eod|eow|eom|next)\b/i.test(input)) return true;
  
  const allPatterns = [
    ...datePatterns.map(p => p.pattern),
    ...timePatterns,
    ...priorityPatterns.map(p => p.pattern),
    ...recurringPatterns.map(p => p.pattern),
    ...advancedRecurringPatterns.map(p => p.pattern),
    ...relativeTimePatterns.map(p => p.pattern),
    ...locationPatterns,
  ];
  
  return allPatterns.some(pattern => pattern.test(input));
}

// ─── Format parsed result for display ───────────────────────────
export function formatParsedResult(parsed: ParsedTask): string[] {
  const results: string[] = [];
  
  if (parsed.dueDate) {
    const now = new Date();
    const diffMs = parsed.dueDate.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    
    if (diffMins < 60) {
      results.push(`in ${diffMins} min`);
    } else if (diffHours < 24) {
      results.push(`in ${diffHours} hour${diffHours > 1 ? 's' : ''}`);
    }
  }
  
  if (parsed.reminderOffset) {
    const offsetLabels: { [key: string]: string } = {
      'exact': '🔔 At exact time',
      '5min': '🔔 5 min before',
      '10min': '🔔 10 min before',
      '15min': '🔔 15 min before',
      '30min': '🔔 30 min before',
      '1hour': '🔔 1 hour before',
      '1day': '🔔 1 day before',
    };
    results.push(offsetLabels[parsed.reminderOffset] || '🔔 Reminder set');
  }
  
  if (parsed.repeatType) {
    if (parsed.repeatType === 'custom' && parsed.repeatDays) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      results.push(`🔄 Every ${parsed.repeatDays.map(d => dayNames[d]).join(', ')}`);
    } else {
      results.push(`🔄 ${parsed.repeatType.charAt(0).toUpperCase() + parsed.repeatType.slice(1)}`);
    }
  }
  
  if (parsed.location) results.push(`📍 ${parsed.location}`);
  if (parsed.priority) results.push(`⚡ ${parsed.priority} priority`);
  if (parsed.estimatedHours) {
    const h = Math.floor(parsed.estimatedHours);
    const m = Math.round((parsed.estimatedHours - h) * 60);
    results.push(`⏱ ${h > 0 ? `${h}h` : ''}${m > 0 ? `${m}m` : ''}`);
  }
  if (parsed.description) results.push(`📝 ${parsed.description}`);
  
  return results;
}
