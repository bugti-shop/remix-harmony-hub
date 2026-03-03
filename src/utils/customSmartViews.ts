import { getSetting, setSetting } from './settingsStorage';
import { DateFilter, PriorityFilter, StatusFilter } from '@/components/TaskFilterSheet';

export interface CustomSmartView {
  id: string;
  name: string;
  icon: string; // emoji
  color: string;
  filters: {
    dateFilter: DateFilter;
    priorityFilter: PriorityFilter;
    statusFilter: StatusFilter;
    tags: string[];
    folderId: string | null;
  };
  createdAt: string;
}

const STORAGE_KEY = 'customSmartViews';

export const loadCustomSmartViews = async (): Promise<CustomSmartView[]> => {
  return getSetting<CustomSmartView[]>(STORAGE_KEY, []);
};

export const saveCustomSmartViews = async (views: CustomSmartView[]): Promise<void> => {
  await setSetting(STORAGE_KEY, views);
};

export const addCustomSmartView = async (view: Omit<CustomSmartView, 'id' | 'createdAt'>): Promise<CustomSmartView> => {
  const views = await loadCustomSmartViews();
  const newView: CustomSmartView = {
    ...view,
    id: `csv_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  await saveCustomSmartViews([...views, newView]);
  return newView;
};

export const deleteCustomSmartView = async (viewId: string): Promise<void> => {
  const views = await loadCustomSmartViews();
  await saveCustomSmartViews(views.filter(v => v.id !== viewId));
};
