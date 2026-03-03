import { useEffect, useState } from 'react';
import { resolveTaskMediaUrl } from '@/utils/todoItemsStorage';

export const useResolvedTaskMedia = (refOrUrl?: string | null) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!refOrUrl) {
        setResolvedUrl(null);
        return;
      }

      const resolved = await resolveTaskMediaUrl(refOrUrl);
      if (!cancelled) setResolvedUrl(resolved || null);
    })().catch((e) => {
      console.error('Failed to resolve media url:', e);
      if (!cancelled) setResolvedUrl(null);
    });

    return () => {
      cancelled = true;
    };
  }, [refOrUrl]);

  return resolvedUrl;
};
