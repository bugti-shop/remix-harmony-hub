import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { RARITY_CONFIG, BadgeRarity } from '@/utils/virtualJourneyStorage';
import { RarityIcon, MEDAL_COLORS } from '@/components/MedalBadge';

interface BadgeUnlockToastProps {
  icon: string;
  label: string;
  journeyName: string;
  rarity: BadgeRarity;
  isJourneyComplete?: boolean;
}

export const BadgeUnlockToast = ({ icon, label, journeyName, rarity, isJourneyComplete }: BadgeUnlockToastProps) => {
  const config = RARITY_CONFIG[rarity];
  const medal = MEDAL_COLORS[rarity];

  return (
    <div className="flex items-center gap-3">
      {/* Medal-style badge */}
      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: [0, 1.3, 1], rotate: [-30, 10, 0] }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative flex-shrink-0"
      >
        {/* Ribbon tails */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5 z-0">
          <div className={cn('w-1.5 h-2.5 rounded-b-sm -rotate-12 bg-gradient-to-b', medal.ring)} />
          <div className={cn('w-1.5 h-2.5 rounded-b-sm rotate-12 bg-gradient-to-b', medal.ring)} />
        </div>
        {/* Medal circle */}
        <div className={cn('w-11 h-11 rounded-full p-[2px] bg-gradient-to-br relative z-10', medal.ring)}>
          <div className="w-full h-full rounded-full p-[2px] bg-gradient-to-br from-white/20 to-transparent">
            <div className="w-full h-full rounded-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-lg">
              {icon}
            </div>
          </div>
        </div>
        {/* Sparkle ring */}
        <motion.div
          initial={{ scale: 0.8, opacity: 1 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className={cn(
            'absolute inset-0 rounded-full border-2 z-20',
            isJourneyComplete ? 'border-warning' : 'border-primary'
          )}
        />
      </motion.div>

      <div className="flex-1 min-w-0">
        <motion.p
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="font-bold text-sm text-foreground truncate"
        >
          {isJourneyComplete ? '🏆 Journey Complete!' : 'Badge Unlocked!'}
        </motion.p>
        <motion.p
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="text-xs text-muted-foreground truncate"
        >
          {label}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="flex items-center gap-1.5 mt-1"
        >
          <span className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold', config.bg, config.color)}>
            <RarityIcon rarity={rarity} size="h-3 w-3" />
            {config.label}
          </span>
          <span className="text-[10px] text-muted-foreground/60">{journeyName}</span>
        </motion.div>
      </div>
    </div>
  );
};
