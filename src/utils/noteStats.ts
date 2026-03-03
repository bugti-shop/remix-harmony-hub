export interface NoteStats {
  wordCount: number;
  characterCount: number;
  characterCountNoSpaces: number;
  readingTimeMinutes: number;
}

export function calculateNoteStats(content: string, title: string = ''): NoteStats {
  // Strip HTML tags and decode HTML entities
  const strippedContent = content
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

  const fullText = title ? `${title} ${strippedContent}` : strippedContent;

  // Word count - split by whitespace and filter empty strings
  const words = fullText.split(/\s+/).filter(word => word.length > 0);
  const wordCount = words.length;

  // Character counts
  const characterCount = fullText.length;
  const characterCountNoSpaces = fullText.replace(/\s/g, '').length;

  // Reading time - average reading speed is ~200-250 words per minute
  const wordsPerMinute = 200;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / wordsPerMinute));

  return {
    wordCount,
    characterCount,
    characterCountNoSpaces,
    readingTimeMinutes,
  };
}

export function formatReadingTime(minutes: number): string {
  if (minutes < 1) return 'Less than 1 min read';
  if (minutes === 1) return '1 min read';
  return `${minutes} min read`;
}
