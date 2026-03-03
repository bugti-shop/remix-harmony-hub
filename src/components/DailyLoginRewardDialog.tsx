import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { triggerHaptic } from '@/utils/haptics';
import Confetti from 'react-confetti';
import {
  DAILY_REWARDS,
  checkDailyReward,
  claimDailyReward,
  type DailyRewardData,
} from '@/utils/dailyRewardStorage';

interface DailyLoginRewardDialogProps {
  forceOpen?: boolean;
  onForceOpenHandled?: () => void;
}

export const DailyLoginRewardDialog = ({ forceOpen, onForceOpenHandled }: DailyLoginRewardDialogProps = {}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentDay, setCurrentDay] = useState(1);
  const [data, setData] = useState<DailyRewardData | null>(null);
  const [claimed, setClaimed] = useState(false);
  

  const loadRewardState = useCallback(async () => {
    try {
      const result = await checkDailyReward();
      setCurrentDay(result.currentDay);
      setData(result.data);
      return result;
    } catch (e) {
      console.error('Daily reward check failed:', e);
      return null;
    }
  }, []);

  useEffect(() => {
    const check = async () => {
      const result = await loadRewardState();
      if (result?.canClaim) {
        setTimeout(() => setIsOpen(true), 800);
      }
    };
    check();
  }, [loadRewardState]);

  // Handle forceOpen from parent or global event
  useEffect(() => {
    if (forceOpen) {
      loadRewardState().then(() => setIsOpen(true));
      onForceOpenHandled?.();
    }
  }, [forceOpen, loadRewardState, onForceOpenHandled]);

  // Listen for global open event
  useEffect(() => {
    const handler = () => {
      loadRewardState().then(() => setIsOpen(true));
    };
    window.addEventListener('openDailyReward', handler);
    return () => window.removeEventListener('openDailyReward', handler);
  }, [loadRewardState]);

  const handleClaim = useCallback(async () => {
    triggerHaptic(currentDay === 7 ? 'heavy' : 'medium').catch(() => {});
    await claimDailyReward();
    setClaimed(true);
    window.dispatchEvent(new Event('dailyRewardClaimed'));
    setTimeout(() => setIsOpen(false), currentDay === 7 ? 3500 : 2000);
  }, [currentDay]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          onClick={handleClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" />

          {/* Day 7 Confetti */}
          {claimed && currentDay === 7 && (
            <Confetti
              width={window.innerWidth}
              height={window.innerHeight}
              recycle={false}
              numberOfPieces={300}
              gravity={0.2}
              colors={['#FFD700', '#FF6B35', '#FF4444', '#44FF44', '#4488FF', '#FF44FF', '#FFFFFF']}
            />
          )}

          {/* Dialog */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-card border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            {/* Header */}
            <div className="bg-primary/10 px-6 pt-6 pb-4 text-center">
              <motion.div
                animate={{ rotate: [0, -8, 8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                className="inline-block mb-2"
              >
                <Gift className="h-10 w-10 text-primary" />
              </motion.div>
              <h2 className="text-xl font-black text-foreground">Daily Reward</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Log in every day to earn rewards!
              </p>
            </div>

            {/* Day Grid */}
            <div className="px-5 py-5">
              <div className="grid grid-cols-7 gap-1.5">
                {DAILY_REWARDS.map((reward) => {
                  const isPast = data?.lastClaimDate
                    ? reward.day < currentDay
                    : reward.day < currentDay;
                  const isCurrent = reward.day === currentDay;
                  const isFuture = reward.day > currentDay;
                  const justClaimed = claimed && isCurrent;

                  return (
                    <motion.div
                      key={reward.day}
                      initial={isCurrent ? { scale: 0.9 } : {}}
                      animate={
                        isCurrent
                          ? { scale: [1, 1.05, 1] }
                          : justClaimed
                          ? { scale: 1.1 }
                          : {}
                      }
                      transition={
                        isCurrent && !justClaimed
                          ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
                          : {}
                      }
                      className={cn(
                        'flex flex-col items-center rounded-xl p-2 border-2 transition-all relative',
                        isPast && 'bg-success/10 border-success/30',
                        isCurrent && !justClaimed && 'bg-primary/10 border-primary shadow-sm',
                        justClaimed && 'bg-success/20 border-success',
                        isFuture && 'bg-muted/50 border-muted opacity-50'
                      )}
                    >
                      {/* Checkmark for past days */}
                      {isPast && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-success-foreground" />
                        </div>
                      )}
                      {justClaimed && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full flex items-center justify-center"
                        >
                          <Check className="h-2.5 w-2.5 text-success-foreground" />
                        </motion.div>
                      )}

                      <span className="text-lg leading-none">{reward.icon}</span>
                      <span className="text-[9px] font-bold text-muted-foreground mt-1">
                        D{reward.day}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Today's reward highlight */}
            <div className="px-5 pb-2">
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">
                  Today's Reward
                </p>
                <p className="text-2xl font-black text-primary mt-0.5">
                  {DAILY_REWARDS[currentDay - 1].icon} Day {currentDay}
                </p>
                {currentDay === 7 && (
                  <p className="text-[10px] text-warning font-semibold mt-1">
                    🎉 Day 7 Bonus!
                  </p>
                )}
              </div>
            </div>

            {/* Claim Button */}
            <div className="px-5 pb-5 pt-2">
              {!claimed ? (
                <Button
                  onClick={handleClaim}
                  size="lg"
                  className="w-full font-bold"
                >
                  Claim Reward 🎁
                </Button>
              ) : (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center py-2"
                >
                  {currentDay === 7 ? (
                    <>
                      <motion.p
                        className="text-2xl font-black text-warning"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        🏆 7-Day Cycle Complete! 🏆
                      </motion.p>
                      <p className="text-xs text-warning/80 font-semibold mt-1">
                        You're amazing! Keep it up!
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-black text-success">
                        Reward Claimed! ✨
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Come back tomorrow for more!
                      </p>
                    </>
                  )}
                </motion.div>
              )}
            </div>

            {/* Miss warning */}
            <div className="bg-muted/30 px-5 py-3 border-t">
              <p className="text-[10px] text-muted-foreground text-center">
                ⚠️ Missing a day resets your reward cycle
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
