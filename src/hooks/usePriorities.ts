import { useState, useEffect, useCallback } from 'react';
import { CustomPriority, getPriorities, DEFAULT_PRIORITIES } from '@/utils/priorityStorage';

export const usePriorities = () => {
  const [priorities, setPriorities] = useState<CustomPriority[]>(DEFAULT_PRIORITIES);
  const [isLoading, setIsLoading] = useState(true);

  const loadPriorities = useCallback(async () => {
    try {
      const loaded = await getPriorities();
      setPriorities(loaded);
    } catch (error) {
      console.error('Error loading priorities:', error);
      setPriorities(DEFAULT_PRIORITIES);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPriorities();

    // Listen for priority changes
    const handleChange = (e: CustomEvent<CustomPriority[]>) => {
      setPriorities(e.detail);
    };

    window.addEventListener('prioritiesChanged', handleChange as EventListener);
    return () => window.removeEventListener('prioritiesChanged', handleChange as EventListener);
  }, [loadPriorities]);

  const getPriorityColor = useCallback((priorityId: string): string => {
    const priority = priorities.find(p => p.id === priorityId);
    return priority?.color || '#6B7280';
  }, [priorities]);

  const getPriorityName = useCallback((priorityId: string): string => {
    const priority = priorities.find(p => p.id === priorityId);
    return priority?.name || 'None';
  }, [priorities]);

  const getPriorityTextClass = useCallback((priorityId: string): string => {
    // Return a style object instead of Tailwind class for dynamic colors
    return '';
  }, []);

  return {
    priorities,
    isLoading,
    getPriorityColor,
    getPriorityName,
    refresh: loadPriorities,
  };
};
