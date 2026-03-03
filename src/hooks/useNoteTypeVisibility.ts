import { useState, useEffect, useCallback } from 'react';
import { NoteType } from '@/types/note';
import { getVisibleNoteTypes, ALL_NOTE_TYPES } from '@/utils/noteTypeVisibility';

export const useNoteTypeVisibility = () => {
  const [visibleTypes, setVisibleTypes] = useState<NoteType[]>(ALL_NOTE_TYPES);
  const [isLoading, setIsLoading] = useState(true);

  const loadVisibleTypes = useCallback(async () => {
    const types = await getVisibleNoteTypes();
    setVisibleTypes(types);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadVisibleTypes();

    // Listen for visibility changes
    const handleVisibilityChange = (event: CustomEvent<{ types: NoteType[] }>) => {
      setVisibleTypes(event.detail.types);
    };

    window.addEventListener('noteTypesVisibilityChanged', handleVisibilityChange as EventListener);
    return () => {
      window.removeEventListener('noteTypesVisibilityChanged', handleVisibilityChange as EventListener);
    };
  }, [loadVisibleTypes]);

  const isTypeVisible = useCallback((type: NoteType): boolean => {
    return visibleTypes.includes(type);
  }, [visibleTypes]);

  const filterNotesByVisibility = useCallback(<T extends { type: NoteType }>(notes: T[]): T[] => {
    return notes.filter(note => visibleTypes.includes(note.type));
  }, [visibleTypes]);

  return {
    visibleTypes,
    isLoading,
    isTypeVisible,
    filterNotesByVisibility,
    refreshVisibility: loadVisibleTypes,
  };
};
