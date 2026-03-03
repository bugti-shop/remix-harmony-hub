/**
 * Rich Text Copy Utility
 * Copies content with all formatting preserved (fonts, colors, bold, italic, etc.)
 * Works across all platforms - WhatsApp, Docs, Social Media, etc.
 */

import { toast } from 'sonner';

/**
 * Converts inline styles to computed styles for better cross-platform compatibility
 */
const getComputedStyleString = (element: HTMLElement): string => {
  const computedStyle = window.getComputedStyle(element);
  const relevantStyles = [
    'font-family',
    'font-size', 
    'font-weight',
    'font-style',
    'text-decoration',
    'color',
    'background-color',
    'letter-spacing',
    'line-height',
    'text-align',
  ];
  
  return relevantStyles
    .map(prop => {
      const value = computedStyle.getPropertyValue(prop);
      if (value && value !== 'normal' && value !== 'none' && value !== 'auto') {
        return `${prop}: ${value}`;
      }
      return null;
    })
    .filter(Boolean)
    .join('; ');
};

/**
 * Deep clone an element with all computed styles inlined
 */
const cloneWithInlineStyles = (element: HTMLElement): HTMLElement => {
  const clone = element.cloneNode(true) as HTMLElement;
  
  // Process the clone and all its children
  const processElement = (el: HTMLElement, originalEl: HTMLElement) => {
    // Get computed styles and inline them
    const styles = getComputedStyleString(originalEl);
    if (styles) {
      el.setAttribute('style', styles);
    }
    
    // Process children
    const children = el.children;
    const originalChildren = originalEl.children;
    for (let i = 0; i < children.length; i++) {
      if (children[i] instanceof HTMLElement && originalChildren[i] instanceof HTMLElement) {
        processElement(children[i] as HTMLElement, originalChildren[i] as HTMLElement);
      }
    }
  };
  
  processElement(clone, element);
  return clone;
};

/**
 * Copy content with full formatting preserved
 * Uses ClipboardItem API for rich text copy
 */
export const copyWithFormatting = async (
  editorElement: HTMLElement | null,
  fontFamily?: string,
  fontSize?: string,
  fontWeight?: string,
  lineHeight?: string,
  letterSpacing?: string
): Promise<boolean> => {
  if (!editorElement) {
    toast.error('No content to copy');
    return false;
  }
  
  try {
    // Get the content area
    const contentDiv = editorElement.querySelector('[contenteditable="true"]') as HTMLElement || editorElement;
    
    // Create a wrapper with the note's font settings
    const wrapper = document.createElement('div');
    wrapper.style.fontFamily = fontFamily || 'inherit';
    wrapper.style.fontSize = fontSize || 'inherit';
    wrapper.style.fontWeight = fontWeight || 'inherit';
    wrapper.style.lineHeight = lineHeight || 'inherit';
    wrapper.style.letterSpacing = letterSpacing || 'inherit';
    
    // Clone content with all inline styles
    const clonedContent = cloneWithInlineStyles(contentDiv);
    wrapper.appendChild(clonedContent);
    
    // Generate HTML with inline styles
    const htmlContent = wrapper.innerHTML;
    
    // Generate plain text fallback
    const plainText = contentDiv.innerText || contentDiv.textContent || '';
    
    // Use modern Clipboard API with ClipboardItem for rich text
    if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      try {
        const clipboardItem = new ClipboardItem({
          'text/html': new Blob([htmlContent], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        });
        
        await navigator.clipboard.write([clipboardItem]);
        toast.success('Copied with formatting!', {
          description: 'Paste anywhere to keep your styles'
        });
        return true;
      } catch (clipboardError) {
        console.warn('ClipboardItem failed, falling back:', clipboardError);
      }
    }
    
    // Fallback: Use execCommand (older but widely supported)
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = htmlContent;
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.contentEditable = 'true';
    document.body.appendChild(tempContainer);
    
    // Select the content
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(tempContainer);
    selection?.removeAllRanges();
    selection?.addRange(range);
    
    // Copy using execCommand
    const success = document.execCommand('copy');
    
    // Cleanup
    document.body.removeChild(tempContainer);
    selection?.removeAllRanges();
    
    if (success) {
      toast.success('Copied with formatting!', {
        description: 'Paste anywhere to keep your styles'
      });
      return true;
    }
    
    // Final fallback: plain text only
    await navigator.clipboard.writeText(plainText);
    toast.info('Copied as plain text', {
      description: 'Rich formatting not supported in this browser'
    });
    return true;
    
  } catch (error) {
    console.error('Copy failed:', error);
    toast.error('Failed to copy content');
    return false;
  }
};

/**
 * Copy selected text with formatting
 */
export const copySelectionWithFormatting = async (): Promise<boolean> => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    toast.error('No text selected');
    return false;
  }
  
  try {
    const range = selection.getRangeAt(0);
    const container = document.createElement('div');
    container.appendChild(range.cloneContents());
    
    // Get the common ancestor to capture styling
    const ancestor = range.commonAncestorContainer;
    const parentElement = ancestor.nodeType === Node.ELEMENT_NODE 
      ? ancestor as HTMLElement 
      : ancestor.parentElement;
    
    if (parentElement) {
      const styles = getComputedStyleString(parentElement);
      if (styles) {
        container.setAttribute('style', styles);
      }
    }
    
    const htmlContent = container.innerHTML;
    const plainText = selection.toString();
    
    // Try modern API first
    if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      try {
        const clipboardItem = new ClipboardItem({
          'text/html': new Blob([htmlContent], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        });
        
        await navigator.clipboard.write([clipboardItem]);
        toast.success('Selection copied with formatting!');
        return true;
      } catch (err) {
        console.warn('ClipboardItem failed:', err);
      }
    }
    
    // Fallback
    await navigator.clipboard.writeText(plainText);
    toast.info('Copied as plain text');
    return true;
    
  } catch (error) {
    console.error('Copy selection failed:', error);
    toast.error('Failed to copy selection');
    return false;
  }
};
