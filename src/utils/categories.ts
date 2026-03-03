import { Category } from '@/types/note';

export const DEFAULT_CATEGORIES: Category[] = [];

export const getCategoryById = (categoryId?: string): Category | undefined => {
  if (!categoryId) return undefined;
  return DEFAULT_CATEGORIES.find(cat => cat.id === categoryId);
};

export const getCategoryColor = (categoryId?: string): string => {
  const category = getCategoryById(categoryId);
  return category?.color || 'bg-gray-500';
};
