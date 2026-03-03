import { useState, useEffect, useCallback } from 'react';
import { AppTag, getAllTags } from '@/utils/tagStorage';

// Cache tags in memory to avoid repeated IndexedDB reads
let cachedTags: AppTag[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5000; // 5 seconds

export const useGlobalTags = () => {
  const [tags, setTags] = useState<AppTag[]>(cachedTags || []);

  const refresh = useCallback(async () => {
    const now = Date.now();
    if (cachedTags && now - cacheTimestamp < CACHE_TTL) {
      setTags(cachedTags);
      return;
    }
    const all = await getAllTags();
    cachedTags = all;
    cacheTimestamp = now;
    setTags(all);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const resolveTagIds = useCallback((tagIds?: string[]): AppTag[] => {
    if (!tagIds || tagIds.length === 0) return [];
    return tagIds
      .map(id => tags.find(t => t.id === id))
      .filter(Boolean) as AppTag[];
  }, [tags]);

  const invalidateCache = useCallback(() => {
    cachedTags = null;
    cacheTimestamp = 0;
    refresh();
  }, [refresh]);

  return { tags, resolveTagIds, refresh, invalidateCache };
};
