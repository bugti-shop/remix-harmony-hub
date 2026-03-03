import { Capacitor } from '@capacitor/core';

interface ShareImageOptions {
  blob: Blob;
  fileName: string;
  title: string;
  text?: string;
  dialogTitle?: string;
}

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image blob'));
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || '');
    };
    reader.readAsDataURL(blob);
  });

export const shareImageBlob = async ({
  blob,
  fileName,
  title,
  text,
  dialogTitle,
}: ShareImageOptions): Promise<void> => {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');

    const base64Data = await blobToBase64(blob);
    await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true,
    });

    const fileUri = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Cache,
    });

    try {
      await Share.share({
        title,
        text,
        files: [fileUri.uri],
        dialogTitle,
      });
      return;
    } catch {
      await Share.share({
        title,
        text,
        url: fileUri.uri,
        dialogTitle,
      });
      return;
    }
  }

  const file = new File([blob], fileName, { type: blob.type || 'image/png' });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title, text, files: [file] });
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};
