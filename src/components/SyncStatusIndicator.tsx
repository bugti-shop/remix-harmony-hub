import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SyncStatusIndicatorProps {
  isOnline: boolean;
  isSyncing: boolean;
  lastSync: Date | null;
  hasError?: boolean;
  hasConflicts?: boolean;
  conflictCount?: number;
  pendingCount?: number;
  className?: string;
  showLabel?: boolean;
}

export const SyncStatusIndicator = ({
  isOnline,
  isSyncing,
  lastSync,
  hasError = false,
  hasConflicts = false,
  conflictCount = 0,
  pendingCount = 0,
  className,
  showLabel = true,
}: SyncStatusIndicatorProps) => {
  const getStatus = () => {
    if (!isOnline) {
      return {
        icon: CloudOff,
        label: pendingCount > 0 ? `Offline (${pendingCount} pending)` : 'Offline',
        color: 'text-muted-foreground',
        bgColor: 'bg-muted',
      };
    }

    if (hasConflicts && conflictCount > 0) {
      return {
        icon: AlertTriangle,
        label: `${conflictCount} conflict${conflictCount > 1 ? 's' : ''}`,
        color: 'text-warning',
        bgColor: 'bg-warning/10',
      };
    }

    if (hasError) {
      return {
        icon: AlertCircle,
        label: 'Sync Error',
        color: 'text-destructive',
        bgColor: 'bg-destructive/10',
      };
    }

    if (isSyncing) {
      return {
        icon: RefreshCw,
        label: pendingCount > 0 ? `Syncing (${pendingCount})...` : 'Syncing...',
        color: 'text-primary',
        bgColor: 'bg-primary/10',
        animate: true,
      };
    }

    if (lastSync) {
      const timeSinceSync = Date.now() - lastSync.getTime();
      const minutes = Math.floor(timeSinceSync / 60000);

      if (minutes < 1) {
        return {
          icon: CheckCircle2,
          label: 'Synced',
          color: 'text-accent',
          bgColor: 'bg-accent/10',
        };
      }

      return {
        icon: Cloud,
        label: `Synced ${minutes}m ago`,
        color: 'text-accent',
        bgColor: 'bg-accent/10',
      };
    }

    return {
      icon: Cloud,
      label: 'Ready',
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
    };
  };

  const status = getStatus();
  const Icon = status.icon;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full transition-all',
        status.bgColor,
        className
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4',
          status.color,
          status.animate && 'animate-spin'
        )}
      />
      {showLabel && (
        <span className={cn('text-xs font-medium', status.color)}>
          {status.label}
        </span>
      )}
    </div>
  );
};

export const SyncBadge = ({
  isOnline,
  isSyncing,
  lastSync,
  hasError,
  hasConflicts,
  conflictCount,
  pendingCount,
}: Omit<SyncStatusIndicatorProps, 'className' | 'showLabel'>) => {
  return (
    <SyncStatusIndicator
      isOnline={isOnline}
      isSyncing={isSyncing}
      lastSync={lastSync}
      hasError={hasError}
      hasConflicts={hasConflicts}
      conflictCount={conflictCount}
      pendingCount={pendingCount}
      showLabel={false}
      className="px-2 py-1"
    />
  );
};
