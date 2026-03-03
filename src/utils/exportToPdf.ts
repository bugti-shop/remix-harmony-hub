/**
 * Export note content to PDF with proper page break handling
 * Using jsPDF 4.0.0 (patched for CVE-2025-68428) and html2canvas
 * Supports note-specific styling (sticky notes, lined paper, etc.)
 */
import { sanitizeHtml } from '@/lib/sanitize';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import type { NoteType, StickyColor } from '@/types/note';

export interface PdfExportOptions {
  title?: string;
  filename?: string;
  pageSize?: 'a4' | 'letter' | 'legal' | 'a5';
  orientation?: 'portrait' | 'landscape';
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  preserveStyles?: boolean;
  includeTitle?: boolean;
  includeDate?: boolean;
  includePageNumbers?: boolean;
  headerText?: string;
  footerText?: string;
  fontSize?: number;
  // Note-specific styling
  noteType?: NoteType;
  stickyColor?: StickyColor;
  customColor?: string;
  preserveNoteStyle?: boolean;
}

export interface PdfExportResult {
  success: boolean;
  filePath?: string;
  base64Data?: string;
  filename: string;
}

// Sticky note color mappings
const STICKY_COLORS: Record<string, string> = {
  yellow: '#fef3c7',
  blue: '#dbeafe',
  green: '#d1fae5',
  pink: '#fce7f3',
  orange: '#fed7aa',
};

// Lined paper styles
const LINED_PAPER_CSS = `
  background-image: repeating-linear-gradient(
    transparent,
    transparent 31px,
    #e5e7eb 31px,
    #e5e7eb 32px
  );
  background-size: 100% 32px;
  padding-top: 8px;
`;

// Get computed styles and convert to inline styles
const getComputedStylesAsInline = (element: HTMLElement): string => {
  const computedStyle = window.getComputedStyle(element);
  const styleProperties = [
    'color', 'background-color', 'font-family', 'font-size', 'font-weight',
    'font-style', 'text-decoration', 'text-align', 'line-height', 'letter-spacing',
    'padding', 'margin', 'border', 'border-radius', 'width', 'height',
    'display', 'flex-direction', 'justify-content', 'align-items', 'gap'
  ];
  
  return styleProperties
    .map(prop => `${prop}: ${computedStyle.getPropertyValue(prop)}`)
    .join('; ');
};

// Clone element with computed styles preserved
const cloneWithStyles = (source: HTMLElement): HTMLElement => {
  const clone = source.cloneNode(true) as HTMLElement;
  
  // Apply computed styles to all elements
  const applyStyles = (sourceEl: HTMLElement, cloneEl: HTMLElement) => {
    const computedStyle = window.getComputedStyle(sourceEl);
    
    // Apply key style properties
    cloneEl.style.color = computedStyle.color;
    cloneEl.style.backgroundColor = computedStyle.backgroundColor;
    cloneEl.style.fontFamily = computedStyle.fontFamily;
    cloneEl.style.fontSize = computedStyle.fontSize;
    cloneEl.style.fontWeight = computedStyle.fontWeight;
    cloneEl.style.fontStyle = computedStyle.fontStyle;
    cloneEl.style.textDecoration = computedStyle.textDecoration;
    cloneEl.style.textAlign = computedStyle.textAlign;
    cloneEl.style.lineHeight = computedStyle.lineHeight;
    cloneEl.style.letterSpacing = computedStyle.letterSpacing;
    cloneEl.style.padding = computedStyle.padding;
    cloneEl.style.margin = computedStyle.margin;
    cloneEl.style.border = computedStyle.border;
    cloneEl.style.borderRadius = computedStyle.borderRadius;
    
    // Recurse through children
    const sourceChildren = sourceEl.children;
    const cloneChildren = cloneEl.children;
    
    for (let i = 0; i < sourceChildren.length; i++) {
      if (sourceChildren[i] instanceof HTMLElement && cloneChildren[i] instanceof HTMLElement) {
        applyStyles(sourceChildren[i] as HTMLElement, cloneChildren[i] as HTMLElement);
      }
    }
  };
  
  applyStyles(source, clone);
  return clone;
};

export const exportNoteToPdf = async (
  content: string,
  options: PdfExportOptions = {}
): Promise<PdfExportResult> => {
  const {
    title = 'Untitled Note',
    filename = 'note.pdf',
    pageSize = 'a4',
    orientation = 'portrait',
    marginTop = 15,
    marginBottom = 15,
    marginLeft = 15,
    marginRight = 15,
    preserveStyles = true,
    includeTitle = true,
    includeDate = true,
    includePageNumbers = true,
    headerText = '',
    footerText = '',
    fontSize = 12,
    noteType,
    stickyColor,
    customColor,
    preserveNoteStyle = true,
  } = options;

  // Dynamically import jsPDF and html2canvas
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;

  // Page dimensions in mm based on page size
  const pageDimensions: Record<string, { width: number; height: number }> = {
    a4: { width: 210, height: 297 },
    letter: { width: 215.9, height: 279.4 },
    legal: { width: 215.9, height: 355.6 },
    a5: { width: 148, height: 210 },
  };
  
  const dims = pageDimensions[pageSize] || pageDimensions.a4;
  let pageWidth = orientation === 'landscape' ? dims.height : dims.width;
  let pageHeight = orientation === 'landscape' ? dims.width : dims.height;
  
  const contentWidth = pageWidth - marginLeft - marginRight;
  const contentHeight = pageHeight - marginTop - marginBottom;

  // Determine background based on note type
  let backgroundColor = 'white';
  let additionalStyles = '';
  
  if (preserveNoteStyle) {
    // Sticky note - use sticky color
    if (noteType === 'sticky' && stickyColor) {
      backgroundColor = STICKY_COLORS[stickyColor] || '#fef3c7';
    } 
    // Custom background color
    else if (customColor) {
      backgroundColor = customColor;
    }
    // Lined notes - add lined paper pattern
    if (noteType === 'lined') {
      additionalStyles = LINED_PAPER_CSS;
    }
  }

  // Create a container for the PDF content
  const container = document.createElement('div');
  container.style.cssText = `
    width: ${contentWidth}mm;
    padding: 20px;
    background: ${backgroundColor};
    color: black;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: ${fontSize}pt;
    line-height: 1.6;
    box-sizing: border-box;
    ${additionalStyles}
  `;

  // Add custom header if provided
  if (headerText) {
    const headerElement = document.createElement('div');
    headerElement.style.cssText = `
      font-size: ${fontSize - 2}pt;
      color: #666;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 1px solid #ddd;
      text-align: center;
    `;
    headerElement.textContent = headerText;
    container.appendChild(headerElement);
  }

  // Add title with styling (if enabled)
  if (includeTitle && title) {
    const titleElement = document.createElement('h1');
    titleElement.style.cssText = `
      font-size: ${fontSize + 12}pt;
      font-weight: bold;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #333;
      color: #1a1a1a;
    `;
    titleElement.textContent = title;
    container.appendChild(titleElement);
  }

  // Create content container
  const contentDiv = document.createElement('div');
  contentDiv.className = 'pdf-content';
  
  // Process content to preserve styles and handle special elements
  let processedContent = content;
  
  // Convert page-break-container divs to proper page breaks
  processedContent = processedContent.replace(
    /<div class="page-break-container"[^>]*>[\s\S]*?<\/div>\s*<div[^>]*><\/div>/gi,
    '<div style="page-break-after: always; height: 0;"></div>'
  );
  
  // Handle old style page breaks
  processedContent = processedContent.replace(
    /<div[^>]*page-break-after:\s*always[^>]*>[\s\S]*?<\/div>/gi,
    '<div style="page-break-after: always; height: 0;"></div>'
  );

  // Ensure hr elements are visible
  processedContent = processedContent.replace(
    /<hr[^>]*>/gi,
    '<hr style="border: none; border-top: 2px solid #333; margin: 16px 0;" />'
  );

  // Style tables properly
  processedContent = processedContent.replace(
    /<table([^>]*)>/gi,
    '<table$1 style="width: 100%; border-collapse: collapse; margin: 16px 0;">'
  );
  processedContent = processedContent.replace(
    /<td([^>]*)>/gi,
    '<td$1 style="border: 1px solid #ddd; padding: 8px; text-align: left;">'
  );
  processedContent = processedContent.replace(
    /<th([^>]*)>/gi,
    '<th$1 style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f5f5f5; font-weight: bold;">'
  );

  // Handle images - ensure they fit within page
  processedContent = processedContent.replace(
    /<img([^>]*)>/gi,
    (match, attrs) => {
      if (attrs.includes('style=')) {
        return match.replace(/style="([^"]*)"/i, 'style="$1; max-width: 100%; height: auto;"');
      }
      return `<img${attrs} style="max-width: 100%; height: auto;">`;
    }
  );

  // Preserve colored text and backgrounds
  // Convert CSS variables to actual colors for PDF
  processedContent = processedContent.replace(
    /hsl\(var\(--([^)]+)\)\)/g,
    (match, varName) => {
      // Map common CSS variables to actual colors
      const colorMap: Record<string, string> = {
        'primary': '#3b82f6',
        'secondary': '#6b7280',
        'accent': '#8b5cf6',
        'muted': '#9ca3af',
        'destructive': '#ef4444',
        'foreground': '#1a1a1a',
        'background': '#ffffff',
      };
      return colorMap[varName] || '#333333';
    }
  );

  // Sanitize and set content
  contentDiv.innerHTML = sanitizeHtml(processedContent);
  
  // Apply additional inline styles for common formatting
  const styledElements = contentDiv.querySelectorAll('*');
  styledElements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    
    // Ensure colored spans preserve their color
    if (htmlEl.style.color && !htmlEl.style.color.includes('var(')) {
      // Color is already set, keep it
    }
    
    // Ensure bold text stays bold
    if (htmlEl.tagName === 'STRONG' || htmlEl.tagName === 'B') {
      htmlEl.style.fontWeight = 'bold';
    }
    
    // Ensure italic text stays italic
    if (htmlEl.tagName === 'EM' || htmlEl.tagName === 'I') {
      htmlEl.style.fontStyle = 'italic';
    }
    
    // Ensure underlined text stays underlined
    if (htmlEl.tagName === 'U') {
      htmlEl.style.textDecoration = 'underline';
    }
    
    // Style code blocks
    if (htmlEl.tagName === 'CODE' || htmlEl.tagName === 'PRE') {
      htmlEl.style.fontFamily = 'monospace';
      htmlEl.style.backgroundColor = '#f5f5f5';
      htmlEl.style.padding = '2px 6px';
      htmlEl.style.borderRadius = '4px';
    }
    
    // Style blockquotes
    if (htmlEl.tagName === 'BLOCKQUOTE') {
      htmlEl.style.borderLeft = '4px solid #ddd';
      htmlEl.style.paddingLeft = '16px';
      htmlEl.style.marginLeft = '0';
      htmlEl.style.color = '#666';
      htmlEl.style.fontStyle = 'italic';
    }
    
    // Style lists
    if (htmlEl.tagName === 'UL' || htmlEl.tagName === 'OL') {
      htmlEl.style.paddingLeft = '24px';
      htmlEl.style.margin = '8px 0';
    }
    
    // Style headings
    if (htmlEl.tagName.match(/^H[1-6]$/)) {
      htmlEl.style.fontWeight = 'bold';
      htmlEl.style.marginTop = '16px';
      htmlEl.style.marginBottom = '8px';
    }
  });

  container.appendChild(contentDiv);

  // Add custom footer or timestamp footer
  if (footerText || includeDate) {
    const footer = document.createElement('div');
    footer.style.cssText = `
      margin-top: 30px;
      padding-top: 10px;
      border-top: 1px solid #ddd;
      font-size: ${fontSize - 2}pt;
      color: #666;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    
    if (footerText) {
      const footerTextEl = document.createElement('span');
      footerTextEl.textContent = footerText;
      footer.appendChild(footerTextEl);
    }
    
    if (includeDate) {
      const dateEl = document.createElement('span');
      dateEl.style.marginLeft = 'auto';
      dateEl.textContent = `Exported: ${new Date().toLocaleString()}`;
      footer.appendChild(dateEl);
    }
    
    container.appendChild(footer);
  }

  // Temporarily add to DOM for rendering
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  document.body.appendChild(container);

  const finalFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

  try {
    // Render HTML to canvas with high quality
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      allowTaint: true,
      imageTimeout: 15000,
    });

    // Calculate dimensions
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Create PDF
    const pdf = new jsPDF({
      unit: 'mm',
      format: pageSize === 'a5' ? 'a5' : pageSize === 'legal' ? 'legal' : pageSize,
      orientation: orientation
    });

    // Add page numbers function
    const addPageNumber = (pageNum: number, totalPages: number) => {
      if (includePageNumbers) {
        pdf.setFontSize(10);
        pdf.setTextColor(128, 128, 128);
        pdf.text(
          `Page ${pageNum} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 5,
          { align: 'center' }
        );
      }
    };

    // Add image to PDF, handling multiple pages if needed
    let heightLeft = imgHeight;
    let position = marginTop;
    const imgData = canvas.toDataURL('image/png', 1.0);
    let pageNum = 1;

    // Calculate total pages
    const totalPages = Math.ceil(imgHeight / contentHeight);

    // Add first page
    pdf.addImage(imgData, 'PNG', marginLeft, position, imgWidth, imgHeight);
    addPageNumber(pageNum, totalPages);
    heightLeft -= contentHeight;

    // Add additional pages if content overflows
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + marginTop;
      pdf.addPage();
      pageNum++;
      pdf.addImage(imgData, 'PNG', marginLeft, position, imgWidth, imgHeight);
      addPageNumber(pageNum, totalPages);
      heightLeft -= contentHeight;
    }

    // Get base64 data for all platforms
    const pdfBase64 = pdf.output('datauristring').split(',')[1];

    // Check if we're on native platform
    if (Capacitor.isNativePlatform()) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        
        // Try multiple directories for Android compatibility
        const directories = [
          { dir: Directory.Documents, path: finalFilename },
          { dir: Directory.External, path: `Documents/${finalFilename}` },
          { dir: Directory.Cache, path: finalFilename },
        ];
        
        let savedUri: string | null = null;
        
        for (const { dir, path } of directories) {
          try {
            const result = await Filesystem.writeFile({
              path,
              data: pdfBase64,
              directory: dir,
              recursive: true,
            });
            savedUri = result.uri;
            break;
          } catch (e) {
            console.log(`Failed to save to ${dir}, trying next...`);
          }
        }
        
        if (savedUri) {
          return {
            success: true,
            filePath: savedUri,
            base64Data: pdfBase64,
            filename: finalFilename
          };
        }
        
        // If all filesystem attempts fail, use Share API as fallback
        console.log('All filesystem saves failed, using Share API...');
        const { Share } = await import('@capacitor/share');
        
        // Save to cache for sharing
        const tempResult = await Filesystem.writeFile({
          path: `share_${Date.now()}_${finalFilename}`,
          data: pdfBase64,
          directory: Directory.Cache,
        });
        
        await Share.share({
          title: finalFilename.replace('.pdf', ''),
          url: tempResult.uri,
          dialogTitle: 'Save or Share PDF',
        });
        
        return {
          success: true,
          base64Data: pdfBase64,
          filename: finalFilename
        };
      } catch (fsError) {
        console.error('Native save failed completely:', fsError);
        // Return with base64 data so success dialog can still share
        return {
          success: true,
          base64Data: pdfBase64,
          filename: finalFilename
        };
      }
    }
    
    // Browser/web fallback - trigger download
    pdf.save(finalFilename);
    
    return {
      success: true,
      filename: finalFilename,
      base64Data: pdfBase64
    };
  } finally {
    // Clean up
    document.body.removeChild(container);
  }
};

// Share PDF file using native share
export const sharePdf = async (base64Data: string, filename: string): Promise<boolean> => {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import('@capacitor/share');
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      
      // Save temporarily for sharing
      const tempPath = `temp_${Date.now()}_${filename}`;
      const writeResult = await Filesystem.writeFile({
        path: tempPath,
        data: base64Data,
        directory: Directory.Cache,
      });
      
      await Share.share({
        title: filename.replace('.pdf', ''),
        url: writeResult.uri,
        dialogTitle: 'Share PDF',
      });
      
      // Clean up temp file after a delay
      setTimeout(async () => {
        try {
          await Filesystem.deleteFile({
            path: tempPath,
            directory: Directory.Cache,
          });
        } catch (e) {
          // Ignore cleanup errors
        }
      }, 60000);
      
      return true;
    } else {
      // Web fallback - create blob and use Web Share API
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const file = new File([blob], filename, { type: 'application/pdf' });
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename.replace('.pdf', ''),
        });
        return true;
      } else {
        // Fallback to download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.info('PDF downloaded - check your downloads folder');
        return true;
      }
    }
  } catch (error) {
    console.error('Share failed:', error);
    return false;
  }
};

// View PDF file
export const viewPdf = async (base64Data: string, filename: string): Promise<boolean> => {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Browser } = await import('@capacitor/browser');
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      
      // Save to temp for viewing
      const tempPath = `view_${Date.now()}_${filename}`;
      const writeResult = await Filesystem.writeFile({
        path: tempPath,
        data: base64Data,
        directory: Directory.Cache,
      });
      
      // Open in browser/pdf viewer
      await Browser.open({
        url: writeResult.uri,
        presentationStyle: 'popover',
      });
      
      return true;
    } else {
      // Web - open in new tab
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      // Clean up after delay
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      
      return true;
    }
  } catch (error) {
    console.error('View failed:', error);
    return false;
  }
};

// Get page count based on page breaks in content
export const getPageBreakCount = (content: string): number => {
  const pageBreakPattern = /page-break-container|page-break-after:\s*always/gi;
  const matches = content.match(pageBreakPattern);
  return matches ? matches.length + 1 : 1;
};

// Get current page based on scroll position
export const getCurrentPage = (
  scrollTop: number,
  scrollHeight: number,
  pageCount: number
): number => {
  if (pageCount <= 1) return 1;
  const pageHeight = scrollHeight / pageCount;
  return Math.min(Math.floor(scrollTop / pageHeight) + 1, pageCount);
};
