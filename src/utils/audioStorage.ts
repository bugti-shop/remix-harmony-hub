/**
 * Audio Storage Utilities
 * Handles conversion between audio blobs and persistent base64 data URLs
 */

/**
 * Convert ArrayBuffer to base64 in chunks to avoid call stack limits
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192; // Process 8KB at a time
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }

  return btoa(binary);
}

/**
 * Convert an audio Blob to a base64 data URL that persists across page reloads
 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);
    const mimeType = blob.type || 'audio/webm';
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('[AudioStorage] Failed to convert blob to data URL:', error);
    throw error;
  }
}

/**
 * Convert a base64 data URL back to a Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  try {
    const [header, base64Data] = dataUrl.split(',');
    const mimeMatch = header.match(/data:([^;]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'audio/webm';
    
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return new Blob([bytes], { type: mimeType });
  } catch (error) {
    console.error('[AudioStorage] Failed to convert data URL to blob:', error);
    throw error;
  }
}

/**
 * Check if a URL is a blob URL (temporary, won't survive reload)
 */
export function isBlobUrl(url: string): boolean {
  return url.startsWith('blob:');
}

/**
 * Check if a URL is a data URL (persistent, survives reload)
 */
export function isDataUrl(url: string): boolean {
  return url.startsWith('data:');
}

/**
 * Check if an audio URL is valid and playable
 */
export async function isAudioUrlValid(url: string): Promise<boolean> {
  if (!url) return false;
  
  // Data URLs are always valid
  if (isDataUrl(url)) return true;
  
  // Blob URLs need to be checked
  if (isBlobUrl(url)) {
    try {
      const response = await fetch(url);
      return response.ok;
    } catch {
      return false;
    }
  }
  
  return false;
}

/**
 * Create an object URL from a data URL for playback
 * This is useful when you need a URL that works better with audio elements
 */
export function createPlayableUrl(url: string): string {
  if (isBlobUrl(url)) {
    // Blob URL - may be invalid after reload, return as-is and let player handle error
    return url;
  }
  
  if (isDataUrl(url)) {
    // Data URL - convert to blob URL for better playback performance
    try {
      const blob = dataUrlToBlob(url);
      return URL.createObjectURL(blob);
    } catch {
      // Fall back to data URL if conversion fails
      return url;
    }
  }
  
  return url;
}

/**
 * Revoke a blob URL to free memory
 */
export function revokePlayableUrl(url: string): void {
  if (isBlobUrl(url)) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore errors
    }
  }
}
