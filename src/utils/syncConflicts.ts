// Sync conflict types and management

export interface SyncConflict {
  id: string;
  type: 'note' | 'task';
  localItem: any;
  remoteItem: any;
  localUpdatedAt: Date;
  remoteUpdatedAt: Date;
  detectedAt?: Date;
  resolved?: boolean;
  resolution?: 'local' | 'remote';
}

type ConflictListener = (conflicts: SyncConflict[]) => void;
const listeners: ConflictListener[] = [];
let pendingConflicts: SyncConflict[] = [];

export const addConflicts = (conflicts: SyncConflict[]) => {
  pendingConflicts = [...pendingConflicts, ...conflicts];
  listeners.forEach(fn => fn(pendingConflicts));
};

export const getPendingConflicts = (): SyncConflict[] => {
  return pendingConflicts.filter(c => !c.resolved);
};

export const addConflictListener = (fn: ConflictListener): (() => void) => {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
};

export const resolveConflict = (id: string, resolution?: 'local' | 'remote'): SyncConflict | undefined => {
  const conflict = pendingConflicts.find(c => c.id === id);
  if (conflict) {
    conflict.resolved = true;
    if (resolution) conflict.resolution = resolution;
    listeners.forEach(fn => fn(pendingConflicts));
  }
  return conflict;
};
