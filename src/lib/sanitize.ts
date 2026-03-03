/**
 * HTML Sanitization utilities using DOMPurify
 * Provides defense-in-depth against XSS attacks
 */
import DOMPurify from 'dompurify';

// Configure DOMPurify with allowed tags and attributes for rich text editing
const RICH_TEXT_CONFIG = {
  ALLOWED_TAGS: [
    'b', 'i', 'u', 'a', 'img', 'p', 'br', 'div', 'span',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'strong', 'em', 'code', 'pre', 'mark',
    'blockquote', 'hr', 'sub', 'sup', 's', 'strike',
    'font', 'small', 'big',
    'audio', 'source', // Allow audio elements for voice recordings
    'button', // Allow buttons for inline voice player controls
    'svg', 'polygon', 'rect', 'path', 'circle', 'line', 'polyline', 'g', // Allow SVG icons in voice player
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'class', 'style', 'id',
    'target', 'rel', 'width', 'height', 'colspan', 'rowspan',
    'data-id', 'data-type', 'data-find-highlight',
    'data-recording-id', 'data-audio-src', // Allow audio data attributes
    'data-file-name', 'data-file-type', 'data-file-size', 'data-file-url', 'data-click-attached', // Allow file attachment attributes
    'color', 'size', 'face', 'contenteditable', 'draggable',
    'controls', 'type', // Allow audio controls
    'aria-label', 'role', 'tabindex', // Accessibility attrs for voice player
    'viewBox', 'xmlns', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', // SVG attrs
    'points', 'x', 'y', 'rx', 'ry', 'd', 'cx', 'cy', 'r', // SVG geometry attrs
  ],
  ALLOW_DATA_ATTR: true,
  // Allow safe URLs only
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  // Return string instead of TrustedHTML
  RETURN_TRUSTED_TYPE: false,
};

// Stricter config for code highlighting (only span tags with specific attributes)
const CODE_HIGHLIGHT_CONFIG = {
  ALLOWED_TAGS: ['span', 'br'],
  ALLOWED_ATTR: ['class', 'style'],
  ALLOW_DATA_ATTR: false,
  RETURN_TRUSTED_TYPE: false,
};

/**
 * Sanitize HTML content for rich text editing
 * Use this for editor innerHTML operations
 */
export const sanitizeHtml = (html: string): string => {
  return DOMPurify.sanitize(html, RICH_TEXT_CONFIG) as string;
};

/**
 * Sanitize code highlighting output
 * Use this for syntax-highlighted code display
 */
export const sanitizeCodeHtml = (html: string): string => {
  return DOMPurify.sanitize(html, CODE_HIGHLIGHT_CONFIG) as string;
};

/**
 * Sanitize HTML for read-only display
 * Slightly more permissive for viewing content
 */
export const sanitizeForDisplay = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ...RICH_TEXT_CONFIG,
    ADD_ATTR: ['loading'], // Allow lazy loading for images
  }) as string;
};

/**
 * Strip all HTML tags and return plain text
 * Useful for extracting text content safely
 */
export const stripHtml = (html: string): string => {
  return DOMPurify.sanitize(html, { 
    ALLOWED_TAGS: [], 
    ALLOWED_ATTR: [],
    RETURN_TRUSTED_TYPE: false,
  }) as string;
};
