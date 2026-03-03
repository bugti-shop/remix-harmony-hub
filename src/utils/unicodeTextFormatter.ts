// Unicode text formatting utilities for LinkedIn-style text styling

export type UnicodeStyle = 'bold' | 'italic' | 'boldItalic' | 'monospace' | 'script' | 'scriptBold' | 'fraktur' | 'frakturBold' | 'doubleStruck' | 'sansSerif' | 'sansSerifBold' | 'sansSerifItalic' | 'sansSerifBoldItalic' | 'circled' | 'squared' | 'squaredNeg' | 'parenthesized' | 'fullwidth' | 'smallCaps' | 'sansNormal' | 'boldSans' | 'italicSans' | 'boldItalicSans' | 'underline';

interface StyleDefinition {
  id: UnicodeStyle;
  name: string;
  sample: string;
  example?: string;
}

const UNICODE_OFFSETS: Record<string, { upper: number; lower: number; digit?: number }> = {
  bold: { upper: 0x1D400, lower: 0x1D41A, digit: 0x1D7CE },
  italic: { upper: 0x1D434, lower: 0x1D44E },
  boldItalic: { upper: 0x1D468, lower: 0x1D482 },
  monospace: { upper: 0x1D670, lower: 0x1D68A, digit: 0x1D7F6 },
  script: { upper: 0x1D49C, lower: 0x1D4B6 },
  scriptBold: { upper: 0x1D4D0, lower: 0x1D4EA },
  fraktur: { upper: 0x1D504, lower: 0x1D51E },
  frakturBold: { upper: 0x1D56C, lower: 0x1D586 },
  doubleStruck: { upper: 0x1D538, lower: 0x1D552, digit: 0x1D7D8 },
  sansSerif: { upper: 0x1D5A0, lower: 0x1D5BA, digit: 0x1D7E2 },
  sansSerifBold: { upper: 0x1D5D4, lower: 0x1D5EE, digit: 0x1D7EC },
  sansSerifItalic: { upper: 0x1D608, lower: 0x1D622 },
  sansSerifBoldItalic: { upper: 0x1D63C, lower: 0x1D656 },
};

const convertChar = (char: string, style: UnicodeStyle): string => {
  const offsets = UNICODE_OFFSETS[style];
  if (!offsets) return char;
  
  const code = char.charCodeAt(0);
  if (code >= 65 && code <= 90) return String.fromCodePoint(offsets.upper + (code - 65));
  if (code >= 97 && code <= 122) return String.fromCodePoint(offsets.lower + (code - 97));
  if (code >= 48 && code <= 57 && offsets.digit) return String.fromCodePoint(offsets.digit + (code - 48));
  return char;
};

export const toUnicodeStyle = (text: string, style: UnicodeStyle): string => {
  if (style === 'smallCaps') {
    const smallCaps = 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ';
    return text.split('').map(c => {
      const code = c.charCodeAt(0);
      if (code >= 97 && code <= 122) return smallCaps[code - 97] || c;
      return c;
    }).join('');
  }
  
  if (['circled', 'squared', 'squaredNeg', 'parenthesized', 'fullwidth'].includes(style)) {
    return text; // Simplified - return as-is for rare styles
  }
  
  return text.split('').map(c => convertChar(c, style)).join('');
};

export const toBulletList = (text: string): string => {
  return text.split('\n').filter(l => l.trim()).map(l => `• ${l.trim()}`).join('\n');
};

export const toNumberedList = (text: string): string => {
  return text.split('\n').filter(l => l.trim()).map((l, i) => `${i + 1}. ${l.trim()}`).join('\n');
};

export const toCheckboxList = (text: string): string => {
  return text.split('\n').filter(l => l.trim()).map(l => `☐ ${l.trim()}`).join('\n');
};

export const removeUnicodeFormatting = (text: string, keepSpecial = false): string => {
  // Simple approach: normalize to NFKC which converts many Unicode styled chars back
  try {
    let result = text.normalize('NFKC');
    if (!keepSpecial) {
      result = result.replace(/[•☐☑✓✗]/g, '');
    }
    return result;
  } catch {
    return text;
  }
};

export const copyStyledText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  }
};

export const convertPreservingEmphasis = (text: string, style: UnicodeStyle): string => {
  return toUnicodeStyle(text, style);
};

export const availableStyles: StyleDefinition[] = [
  { id: 'bold', name: 'Bold', sample: '𝐁𝐨𝐥𝐝' },
  { id: 'italic', name: 'Italic', sample: '𝐼𝑡𝑎𝑙𝑖𝑐' },
  { id: 'boldItalic', name: 'Bold Italic', sample: '𝑩𝒐𝒍𝒅 𝑰𝒕𝒂𝒍𝒊𝒄' },
  { id: 'monospace', name: 'Monospace', sample: '𝙼𝚘𝚗𝚘' },
  { id: 'script', name: 'Script', sample: '𝒮𝒸𝓇𝒾𝓅𝓉' },
  { id: 'scriptBold', name: 'Script Bold', sample: '𝓢𝓬𝓻𝓲𝓹𝓽' },
  { id: 'fraktur', name: 'Fraktur', sample: '𝔉𝔯𝔞𝔨𝔱𝔲𝔯' },
  { id: 'doubleStruck', name: 'Double-Struck', sample: '𝔻𝕠𝕦𝕓𝕝𝕖' },
  { id: 'sansSerif', name: 'Sans-Serif', sample: '𝖲𝖺𝗇𝗌' },
  { id: 'sansSerifBold', name: 'Sans Bold', sample: '𝗦𝗮𝗻𝘀' },
  { id: 'smallCaps', name: 'Small Caps', sample: 'sᴍᴀʟʟ ᴄᴀᴘs' },
  { id: 'circled', name: 'Circled', sample: 'Ⓒⓘⓡⓒⓛⓔⓓ' },
];
