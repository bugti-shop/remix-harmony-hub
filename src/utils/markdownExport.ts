import { Note } from '@/types/note';

// Convert HTML to Markdown
const htmlToMarkdown = (html: string): string => {
  let markdown = html;
  
  // Handle tables first
  markdown = markdown.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (match, tableContent) => {
    const rows: string[][] = [];
    const rowMatches = tableContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    
    rowMatches.forEach((row: string) => {
      const cells: string[] = [];
      const cellMatches = row.match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi) || [];
      cellMatches.forEach((cell: string) => {
        const content = cell.replace(/<t[hd][^>]*>|<\/t[hd]>/gi, '').replace(/<[^>]*>/g, '').trim();
        cells.push(content);
      });
      if (cells.length > 0) rows.push(cells);
    });
    
    if (rows.length === 0) return '';
    
    const maxCols = Math.max(...rows.map(r => r.length));
    let table = '\n';
    
    rows.forEach((row, idx) => {
      const paddedRow = [...row, ...Array(maxCols - row.length).fill('')];
      table += '| ' + paddedRow.join(' | ') + ' |\n';
      if (idx === 0) {
        table += '| ' + Array(maxCols).fill('---').join(' | ') + ' |\n';
      }
    });
    
    return table + '\n';
  });
  
  // Headers
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
  
  // Bold and italic
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
  markdown = markdown.replace(/<u[^>]*>(.*?)<\/u>/gi, '_$1_');
  
  // Links
  markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  
  // Note links [[note title]]
  markdown = markdown.replace(/<a[^>]*class="note-link"[^>]*data-note-id="[^"]*"[^>]*>📝\s*(.*?)<\/a>/gi, '[[$1]]');
  
  // Images
  markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, '![$2]($1)');
  markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '![]($1)');
  
  // Lists
  markdown = markdown.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match, content) => {
    return content.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n') + '\n';
  });
  markdown = markdown.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, content) => {
    let index = 1;
    return content.replace(/<li[^>]*>(.*?)<\/li>/gi, () => `${index++}. $1\n`) + '\n';
  });
  
  // Line breaks and paragraphs
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  markdown = markdown.replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n');
  
  // Code blocks
  markdown = markdown.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n');
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  
  // Blockquotes
  markdown = markdown.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (match, content) => {
    return content.split('\n').map((line: string) => `> ${line}`).join('\n') + '\n';
  });
  
  // Strip remaining HTML tags
  markdown = markdown.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities
  markdown = markdown.replace(/&nbsp;/g, ' ');
  markdown = markdown.replace(/&amp;/g, '&');
  markdown = markdown.replace(/&lt;/g, '<');
  markdown = markdown.replace(/&gt;/g, '>');
  markdown = markdown.replace(/&quot;/g, '"');
  
  // Clean up extra whitespace
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  markdown = markdown.trim();
  
  return markdown;
};

export const exportNoteToMarkdown = (note: Note): void => {
  let content = '';
  
  // Add title
  if (note.title) {
    content += `# ${note.title}\n\n`;
  }
  
  // Add metadata
  content += `---\n`;
  content += `Created: ${new Date(note.createdAt).toISOString()}\n`;
  content += `Updated: ${new Date(note.updatedAt).toISOString()}\n`;
  content += `Type: ${note.type}\n`;
  if (note.folderId) {
    content += `Folder: ${note.folderId}\n`;
  }
  content += `---\n\n`;
  
  // Add main content
  if (note.type === 'code' && note.codeContent) {
    content += `\`\`\`${note.codeLanguage || ''}\n${note.codeContent}\n\`\`\`\n`;
  } else if (note.content) {
    content += htmlToMarkdown(note.content);
  }
  
  // Create and download file
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${note.title || 'untitled'}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportAllNotesToMarkdown = (notes: Note[]): void => {
  notes.forEach(note => exportNoteToMarkdown(note));
};
