// Image compression utility for reducing storage usage

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1, default 0.7
  mimeType?: 'image/jpeg' | 'image/webp';
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 0.8,
  mimeType: 'image/jpeg',
};

/**
 * Compress an image data URL to reduce file size
 * Returns a smaller data URL in JPEG/WebP format
 */
export const compressImage = async (
  dataUrl: string,
  options: CompressionOptions = {}
): Promise<string> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        // Calculate new dimensions
        let { width, height } = img;
        
        if (width > opts.maxWidth || height > opts.maxHeight) {
          const ratio = Math.min(opts.maxWidth / width, opts.maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Use better quality scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to compressed format
        const compressed = canvas.toDataURL(opts.mimeType, opts.quality);
        
        console.log(`Image compressed: ${Math.round(dataUrl.length / 1024)}KB -> ${Math.round(compressed.length / 1024)}KB`);
        
        resolve(compressed);
      } catch (e) {
        reject(e);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.src = dataUrl;
  });
};

/**
 * Check if a data URL is an image that can be compressed
 */
export const isCompressibleImage = (dataUrl: string): boolean => {
  return dataUrl.startsWith('data:image/');
};

/**
 * Get approximate size of a data URL in bytes
 */
export const getDataUrlSize = (dataUrl: string): number => {
  // Base64 is ~33% larger than binary, so estimate actual size
  const base64Part = dataUrl.split(',')[1] || '';
  return Math.round(base64Part.length * 0.75);
};
