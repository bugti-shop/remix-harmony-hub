import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { RARITY_CONFIG, BadgeRarity, getRarityFromJourney, ALL_JOURNEYS } from '@/utils/virtualJourneyStorage';
import { Crown, Sparkles, Star, Shield, Award } from 'lucide-react';

interface BadgeUnlockToastProps {
  icon: string;
  label: string;
  journeyName: string;
  rarity: BadgeRarity;
  isJourneyComplete?: boolean;
}

const RarityIcon = ({ rarity }: { rarity: BadgeRarity }) => {
  const size = 'h-3 w-3';
  switch (rarity) {
    case 'legendary': return <Crown className={cn(size, 'text-warning')} />;
    case 'epic': return <Sparkles className={cn(size, 'text-primary')} />;
    case 'rare': return <Star className={cn(size, 'text-primary')} />;
    case 'uncommon': return <Shield className={cn(size, 'text-success')} />;
    default: return <Award className={cn(size, 'text-muted-foreground')} />;
  }
};

export const BadgeUnlockToast = ({ icon, label, journeyName, rarity, isJourneyComplete }: BadgeUnlockToastProps) => {
  const config = RARITY_CONFIG[rarity];

  return (
    <div className="flex items-center gap-3">
      {/* Animated badge icon */}
      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: [0, 1.3, 1], rotate: [-30, 10, 0] }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className={cn(
          'w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 relative',
          isJourneyComplete ? 'bg-warning/15' : config.bg
        )}
      >
        {icon}
        {/* Sparkle ring */}
        <motion.div
          initial={{ scale: 0.8, opacity: 1 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className={cn(
            'absolute inset-0 rounded-xl border-2',
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
            <RarityIcon rarity={rarity} />
            {config.label}
          </span>
          <span className="text-[10px] text-muted-foreground/60">{journeyName}</span>
        </motion.div>
      </div>
    </div>
  );
};
