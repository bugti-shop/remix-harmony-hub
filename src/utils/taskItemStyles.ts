// Shared task item styling constants
// Single source of truth for circle, layout, and spacing across TaskItem and Today.tsx

export const TASK_CIRCLE = {
  /** Circle size classes */
  size: 'h-6 w-6',
  sizeCompact: 'h-5 w-5',
  /** Vertical offset for circle alignment relative to task title */
  marginTop: '-mt-0.5',
  /** Base circle classes */
  base: 'flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-all duration-300',
  /** Completed state */
  completed: 'border-0 bg-muted-foreground/30',
  /** Pending complete state */
  pending: 'border-0 scale-110',
  /** Blocked state */
  blocked: 'opacity-50 cursor-not-allowed',
} as const;

export const TASK_CHECK_ICON = {
  size: 'h-3.5 w-3.5',
  sizeCompact: 'h-2.5 w-2.5',
  base: 'transition-all duration-200',
  pendingAnimation: 'animate-in zoom-in-50',
  pendingColor: '#fff',
  completedColor: 'hsl(var(--muted-foreground) / 0.5)',
  strokeWidth: 3,
} as const;

export const TASK_LAYOUT = {
  /** Main task row classes */
  row: 'flex items-start gap-3',
  rowCompact: 'flex items-start gap-2',
  /** Padding */
  padding: 'py-2.5 px-2',
  paddingCompact: 'py-1.5 px-1.5',
} as const;

export const TASK_TEXT = {
  size: 'text-sm',
  sizeCompact: 'text-xs',
  completed: 'text-muted-foreground line-through',
  base: 'transition-all duration-300',
} as const;

export const TASK_IMAGE = {
  size: 'w-10 h-10',
  sizeCompact: 'w-7 h-7',
  base: 'rounded-full overflow-hidden border-2 border-border flex-shrink-0 cursor-pointer hover:border-primary transition-colors',
} as const;

export const TASK_SWIPE = {
  actionWidth: 60,
  threshold: 60,
} as const;

export const TASK_COMPLETION_DELAY = 760;
export const TASK_HAPTIC_DOUBLE_TAP_DELAY = 100;
