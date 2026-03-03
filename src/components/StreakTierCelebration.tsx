import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { Crown } from 'lucide-react';
import { type StreakTier } from '@/components/StreakSocietyBadge';
import { playChallengeCompleteSound } from '@/utils/gamificationSounds';
import { cn } from '@/lib/utils';

export const StreakTierCelebration = () => {
  const [tier, setTier] = useState<StreakTier | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const handler = (e: CustomEvent<{ tier: StreakTier }>) => {
      setTier(e.detail.tier);
      setShowConfetti(true);
      playChallengeCompleteSound();
      setTimeout(() => setShowConfetti(false), 6000);
    };

    window.addEventListener('streakTierUp', handler as EventListener);
    return () => window.removeEventListener('streakTierUp', handler as EventListener);
  }, []);

  if (!tier && !showConfetti) return null;

  return (
    <>
      {showConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={350}
          gravity={0.2}
          colors={['#FFD700', '#FFA500', '#FF6347', '#8B5CF6', '#3B82F6', '#10B981']}
          style={{ position: 'fixed', top: 0, left: 0, zIndex: 120, pointerEvents: 'none' }}
        />
      )}

      <AnimatePresence>
        {tier && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[115] flex items-center justify-center bg-background/80 backdrop-blur-sm"
            onClick={() => setTier(null)}
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 12, stiffness: 150, delay: 0.2 }}
              className="flex flex-col items-center gap-5 p-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Animated badge with glow */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.3, 1] }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="relative"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                  className={cn("absolute -inset-5 rounded-full border-2 border-dashed", tier.borderColor)}
                />
                <motion.div
                  animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className={cn("absolute -inset-3 rounded-full blur-xl", tier.bgColor)}
                />
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                  className={cn(
                    "relative w-28 h-28 rounded-full flex items-center justify-center border-3 shadow-lg",
                    tier.bgColor, tier.borderColor
                  )}
                >
                  <span className="text-6xl drop-shadow-md">{tier.icon}</span>
                </motion.div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Crown className={cn("h-6 w-6", tier.color)} />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="text-center"
              >
                <p className="text-lg font-black text-warning">Tier Up!</p>
                <p className={cn("text-xl font-bold mt-1", tier.color)}>{tier.name}</p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  You've joined the {tier.name} tier of the Streak Society! 🔥
                </p>
              </motion.div>

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                onClick={() => setTier(null)}
                className={cn(
                  "mt-2 px-6 py-2 rounded-full text-xs font-bold border transition-colors",
                  tier.bgColor, tier.borderColor, tier.color,
                  "hover:opacity-80"
                )}
              >
                Let's go!
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
