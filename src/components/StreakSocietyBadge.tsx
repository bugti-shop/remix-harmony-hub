import { useStreak } from '@/hooks/useStreak';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface StreakTier {
  id: string;
  name: string;
  minStreak: number;
  icon: string;
  color: string;       // tailwind text color
  glowColor: string;   // HSL for glow
  bgColor: string;     // tailwind bg
  borderColor: string; // tailwind border
}

const TIERS: StreakTier[] = [
  { id: 'diamond',  name: 'Diamond',  minStreak: 100, icon: '💎', color: 'text-info',     glowColor: 'hsl(var(--info))',     bgColor: 'bg-info/15',     borderColor: 'border-info/30' },
  { id: 'platinum', name: 'Platinum', minStreak: 30,  icon: '👑', color: 'text-foreground', glowColor: 'hsl(var(--foreground))', bgColor: 'bg-muted',       borderColor: 'border-foreground/20' },
  { id: 'gold',     name: 'Gold',     minStreak: 14,  icon: '🏆', color: 'text-warning',   glowColor: 'hsl(var(--warning))',   bgColor: 'bg-warning/15',  borderColor: 'border-warning/30' },
  { id: 'silver',   name: 'Silver',   minStreak: 7,   icon: '🥈', color: 'text-muted-foreground', glowColor: 'hsl(var(--muted-foreground))', bgColor: 'bg-muted/60', borderColor: 'border-muted-foreground/20' },
  { id: 'bronze',   name: 'Bronze',   minStreak: 3,   icon: '🥉', color: 'text-streak',   glowColor: 'hsl(var(--streak))',   bgColor: 'bg-streak/15',   borderColor: 'border-streak/30' },
];

export const getStreakTier = (streak: number): StreakTier | null => {
  for (const tier of TIERS) {
    if (streak >= tier.minStreak) return tier;
  }
  return null;
};

export const getAllTiers = () => TIERS;

interface StreakSocietyBadgeProps {
  streak?: number;
  compact?: boolean;
}

export const StreakSocietyBadge = ({ streak, compact = false }: StreakSocietyBadgeProps) => {
  const { data } = useStreak();
  const currentStreak = streak ?? (data?.currentStreak || 0);
  const tier = getStreakTier(currentStreak);

  if (!tier) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <div className="w-16 h-16 rounded-full bg-muted/60 border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
          <span className="text-2xl opacity-40">🔒</span>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Reach a 3-day streak to join the Streak Society
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full border", tier.bgColor, tier.borderColor)}>
        <span className="text-sm">{tier.icon}</span>
        <span className={cn("text-xs font-bold", tier.color)}>{tier.name}</span>
      </div>
    );
  }

  // Next tier info
  const nextTier = TIERS.slice().reverse().find(t => t.minStreak > currentStreak);
  const progressToNext = nextTier
    ? ((currentStreak - tier.minStreak) / (nextTier.minStreak - tier.minStreak)) * 100
    : 100;

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      {/* Badge with glow */}
      <motion.div
        className="relative"
        animate={{
          scale: [1, 1.04, 1],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Glow rings */}
        <motion.div
          className="absolute inset-0 rounded-full blur-lg"
          style={{ backgroundColor: tier.glowColor, opacity: 0.25 }}
          animate={{ scale: [1, 1.35, 1], opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute inset-0 rounded-full blur-md"
          style={{ backgroundColor: tier.glowColor, opacity: 0.15 }}
          animate={{ scale: [1.1, 1.5, 1.1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
        />

        <div className={cn(
          "relative w-20 h-20 rounded-full flex items-center justify-center border-3",
          tier.bgColor, tier.borderColor
        )}>
          <span className="text-3xl drop-shadow-sm">{tier.icon}</span>
        </div>
      </motion.div>

      {/* Label */}
      <div className="text-center">
        <p className={cn("text-sm font-bold", tier.color)}>
          {tier.name}
        </p>
        <p className="text-[10px] text-muted-foreground font-medium">
          Streak Society · {currentStreak} days
        </p>
      </div>

      {/* Progress to next tier */}
      {nextTier && (
        <div className="w-full max-w-[200px]">
          <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
            <span>{tier.name}</span>
            <span>{nextTier.name} ({nextTier.minStreak}d)</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progressToNext, 100)}%` }}
              className="h-1.5 rounded-full"
              style={{ backgroundColor: tier.glowColor }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
