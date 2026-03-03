import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Calendar, Check, Crown, Sparkles, Lock, Trophy } from 'lucide-react';
import {
  loadMonthlyChallenges,
  getMonthDeadline,
  loadEarnedMonthlyBadges,
  type MonthlyChallengesData,
  type MonthlyBadge,
  type MonthlyChallenge,
} from '@/utils/monthlyChallengeStorage';
import { Progress } from '@/components/ui/progress';
import { playChallengeCompleteSound } from '@/utils/gamificationSounds';
import Confetti from 'react-confetti';

export const MonthlyChallengeBoard = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<MonthlyChallengesData | null>(null);
  const [earnedBadges, setEarnedBadges] = useState<MonthlyBadge[]>([]);
  const [deadline, setDeadline] = useState(getMonthDeadline());
  const [showBadges, setShowBadges] = useState(false);
  const [celebratingChallenge, setCelebratingChallenge] = useState<MonthlyChallenge | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showBoardConfetti, setShowBoardConfetti] = useState(false);
  const [showBadgeUnlock, setShowBadgeUnlock] = useState(false);
  const [unlockedBadge, setUnlockedBadge] = useState<MonthlyBadge | null>(null);

  useEffect(() => {
    const load = async () => {
      const d = await loadMonthlyChallenges();
      setData(d);
      setDeadline(getMonthDeadline());
      const badges = await loadEarnedMonthlyBadges();
      setEarnedBadges(badges);
    };
    load();

    const handler = () => load();
    const handleComplete = (e: CustomEvent<{ challenge: MonthlyChallenge }>) => {
      setCelebratingChallenge(e.detail.challenge);
      playChallengeCompleteSound();
      setShowConfetti(true);
      setTimeout(() => setCelebratingChallenge(null), 3000);
      setTimeout(() => setShowConfetti(false), 4000);
      load();
    };
    const handleBoardComplete = (e: CustomEvent<{ badge: MonthlyBadge }>) => {
      setShowBoardConfetti(true);
      setUnlockedBadge(e.detail.badge);
      setShowBadgeUnlock(true);
      playChallengeCompleteSound();
      setTimeout(() => setShowBoardConfetti(false), 8000);
      load();
    };

    window.addEventListener('monthlyChallengesUpdated', handler);
    window.addEventListener('monthlyChallengeCompleted', handleComplete as EventListener);
    window.addEventListener('monthlyBoardCompleted', handleBoardComplete);

    const timer = setInterval(() => setDeadline(getMonthDeadline()), 60000 * 60);

    return () => {
      window.removeEventListener('monthlyChallengesUpdated', handler);
      window.removeEventListener('monthlyChallengeCompleted', handleComplete as EventListener);
      window.removeEventListener('monthlyBoardCompleted', handleBoardComplete);
      clearInterval(timer);
    };
  }, []);

  if (!data) return null;

  const completedCount = data.challenges.filter(c => c.completed).length;
  const totalChallenges = data.challenges.length;
  const overallPercent = (completedCount / totalChallenges) * 100;

  return (
    <>
      {/* Confetti on individual challenge completion */}
      {showConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={150}
          gravity={0.3}
          style={{ position: 'fixed', top: 0, left: 0, zIndex: 100, pointerEvents: 'none' }}
        />
      )}

      {/* Big confetti on ALL challenges completed */}
      {showBoardConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={400}
          gravity={0.2}
          colors={['#FFD700', '#FFA500', '#FF6347', '#8B5CF6', '#3B82F6']}
          style={{ position: 'fixed', top: 0, left: 0, zIndex: 100, pointerEvents: 'none' }}
        />
      )}

      {/* Full-screen badge unlock celebration */}
      <AnimatePresence>
        {showBadgeUnlock && unlockedBadge && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-background/80 backdrop-blur-sm"
            onClick={() => setShowBadgeUnlock(false)}
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 12, stiffness: 150, delay: 0.2 }}
              className="flex flex-col items-center gap-4 p-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Glowing ring */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="relative"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                  className="absolute -inset-4 rounded-full border-2 border-dashed border-warning/40"
                />
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-24 h-24 rounded-full bg-gradient-to-br from-warning/30 to-primary/20 flex items-center justify-center shadow-lg border-2 border-warning/30"
                >
                  <span className="text-5xl">{unlockedBadge.icon}</span>
                </motion.div>
              </motion.div>

              {/* Trophy icon */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Trophy className="h-6 w-6 text-warning" />
              </motion.div>

              {/* Text */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="text-center"
              >
                <p className="text-lg font-black text-warning">Badge Unlocked!</p>
                <p className="text-sm font-bold text-foreground mt-1">{unlockedBadge.name}</p>
                <p className="text-xs text-muted-foreground mt-1">All monthly challenges completed! 🎉</p>
              </motion.div>

              {/* Dismiss button */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                onClick={() => setShowBadgeUnlock(false)}
                className="mt-2 px-6 py-2 rounded-full bg-warning/15 text-warning text-xs font-bold border border-warning/30 hover:bg-warning/25 transition-colors"
              >
                Awesome!
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Celebration toast */}
      <AnimatePresence>
        {celebratingChallenge && (
          <motion.div
            initial={{ opacity: 0, y: -30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-[95] bg-card border border-warning/30 shadow-lg rounded-2xl px-5 py-3 flex items-center gap-3 pointer-events-none"
          >
            <span className="text-2xl">{celebratingChallenge.icon}</span>
            <div>
              <p className="text-sm font-bold text-warning">Monthly Challenge Complete! 🏆</p>
              <p className="text-xs text-muted-foreground">{celebratingChallenge.title}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
      {/* Theme header */}
      <div className={cn(
        "px-5 py-4 border-b",
        data.allCompleted
          ? "bg-gradient-to-r from-warning/15 to-primary/15"
          : "bg-gradient-to-r from-primary/10 to-accent/10"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{data.themeEmoji}</span>
            <div>
              <h3 className="font-bold text-sm">{data.theme}</h3>
              <p className="text-[10px] text-muted-foreground">Monthly Challenge Board</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span className={cn(
              "font-medium",
              deadline.daysLeft <= 3 && "text-destructive"
            )}>
              {deadline.daysLeft === 0
                ? 'Last day!'
                : `${deadline.daysLeft}d left`}
            </span>
          </div>
        </div>

        {/* Overall progress */}
        <div className="mt-3 flex items-center gap-2.5">
          <Progress value={overallPercent} className="h-2.5 flex-1" />
          <span className="text-xs font-bold text-muted-foreground">
            {completedCount}/{totalChallenges}
          </span>
        </div>
      </div>

      {/* Challenge list */}
      <div className="p-4 space-y-2.5">
        <AnimatePresence>
          {data.challenges.map((challenge, i) => {
            const percent = Math.min((challenge.current / challenge.target) * 100, 100);
            return (
              <motion.div
                key={challenge.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={cn(
                  "rounded-xl border p-3 transition-all",
                  challenge.completed
                    ? "bg-success/8 border-success/20"
                    : "bg-muted/20 border-transparent"
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base",
                    challenge.completed ? "bg-success/15" : "bg-muted"
                  )}>
                    {challenge.completed ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <span>{challenge.icon}</span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn(
                        "text-xs font-semibold truncate",
                        challenge.completed && "line-through text-muted-foreground"
                      )}>
                        {challenge.title}
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {challenge.description}
                    </p>
                    {!challenge.completed && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 bg-muted rounded-full h-1.5">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percent}%` }}
                            className="bg-primary h-1.5 rounded-full transition-all"
                          />
                        </div>
                        <span className="text-[9px] font-medium text-muted-foreground">
                          {challenge.current}/{challenge.target}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Badge reward preview / unlock */}
      <div className={cn(
        "mx-4 mb-4 rounded-xl border-2 border-dashed p-4 flex items-center gap-3 transition-all",
        data.allCompleted
          ? "border-warning/40 bg-warning/8"
          : "border-muted-foreground/15 bg-muted/20"
      )}>
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center text-xl flex-shrink-0 transition-all",
          data.allCompleted
            ? "bg-warning/20 shadow-sm"
            : "bg-muted/60"
        )}>
          {data.allCompleted ? (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.5 }}
            >
              {data.badge.icon}
            </motion.span>
          ) : (
            <Lock className="h-5 w-5 text-muted-foreground/50" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-xs font-bold",
            data.allCompleted ? "text-warning" : "text-muted-foreground"
          )}>
            {data.allCompleted ? data.badge.name : 'Exclusive Badge'}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {data.allCompleted
              ? 'Badge unlocked! 🎉'
              : `Complete all ${totalChallenges} challenges to unlock`}
          </p>
        </div>
        {data.allCompleted && (
          <Crown className="h-5 w-5 text-warning flex-shrink-0" />
        )}
      </div>

      {/* Past badges */}
      {earnedBadges.length > 0 && (
        <div className="px-4 pb-4">
          <button
            onClick={() => setShowBadges(!showBadges)}
            className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 mb-2"
          >
            <Sparkles className="h-3 w-3" />
            {earnedBadges.length} badge{earnedBadges.length !== 1 ? 's' : ''} earned
          </button>
          <AnimatePresence>
            {showBadges && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex flex-wrap gap-2 overflow-hidden"
              >
                {earnedBadges.map((badge) => (
                  <div
                    key={badge.month}
                    className="flex items-center gap-1.5 bg-warning/10 border border-warning/20 rounded-full px-2.5 py-1"
                  >
                    <span className="text-sm">{badge.icon}</span>
                    <span className="text-[9px] font-medium text-warning">{badge.name}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
    </>
  );
};
