/**
 * Extract a short plain-text preview from (potentially huge) HTML content.
 *
 * IMPORTANT: This is designed for performance with very large notes.
 * It stops as soon as `maxChars` characters are collected.
 */

const decodeEntity = (entity: string): string => {
  switch (entity) {
    case '&nbsp;':
      return ' ';
    case '&amp;':
      return '&';
    case '&lt;':
      return '<';
    case '&gt;':
      return '>';
    case '&quot;':
      return '"';
    case '&#39;':
      return "'";
    default:
      return ' ';
  }
};

export const getTextPreviewFromHtml = (html: string, maxChars = 200): string => {
  if (!html) return '';

  let out = '';
  let inTag = false;

  for (let i = 0; i < html.length && out.length < maxChars; i++) {
    const ch = html[i];

    if (inTag) {
      if (ch === '>') inTag = false;
      continue;
    }

    if (ch === '<') {
      inTag = true;
      continue;
    }

    if (ch === '&') {
      const semi = html.indexOf(';', i + 1);
      // Keep entity scanning bounded to avoid work on huge strings
      if (semi !== -1 && semi - i <= 12) {
        const entity = html.slice(i, semi + 1);
        out += decodeEntity(entity);
        i = semi;
        continue;
      }
    }

    out += ch;
  }

  // Normalize whitespace (string is tiny: <= maxChars)
  return out.replace(/\s+/g, ' ').trim();
};
