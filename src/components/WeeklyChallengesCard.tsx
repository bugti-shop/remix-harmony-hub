import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Clock, Trophy, Sparkles, Check } from 'lucide-react';
import { 
  loadWeeklyChallenges, 
  getWeekDeadline, 
  type WeeklyChallengesData, 
  type WeeklyChallenge 
} from '@/utils/weeklyChallengeStorage';
import { Progress } from '@/components/ui/progress';
import { playChallengeCompleteSound } from '@/utils/gamificationSounds';
import Confetti from 'react-confetti';

export const WeeklyChallengesCard = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<WeeklyChallengesData | null>(null);
  const [deadline, setDeadline] = useState(getWeekDeadline());
  const [celebratingChallenge, setCelebratingChallenge] = useState<WeeklyChallenge | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const load = async () => {
      const d = await loadWeeklyChallenges();
      setData(d);
      setDeadline(getWeekDeadline());
    };
    load();

    const handler = () => load();
    const handleComplete = (e: CustomEvent<{ challenge: WeeklyChallenge }>) => {
      setCelebratingChallenge(e.detail.challenge);
      playChallengeCompleteSound();
      setShowConfetti(true);
      setTimeout(() => setCelebratingChallenge(null), 3000);
      setTimeout(() => setShowConfetti(false), 4000);
      load();
    };

    window.addEventListener('weeklyChallengesUpdated', handler);
    window.addEventListener('weeklyChallengeCompleted', handleComplete as EventListener);

    const timer = setInterval(() => setDeadline(getWeekDeadline()), 60000);

    return () => {
      window.removeEventListener('weeklyChallengesUpdated', handler);
      window.removeEventListener('weeklyChallengeCompleted', handleComplete as EventListener);
      clearInterval(timer);
    };
  }, []);

  if (!data) return null;

  const completedCount = data.challenges.filter(c => c.completed).length;

  return (
    <>
      {/* Confetti on challenge completion */}
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

      {/* Celebration toast */}
      <AnimatePresence>
        {celebratingChallenge && (
          <motion.div
            initial={{ opacity: 0, y: -30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-[95] bg-card border border-success/30 shadow-lg rounded-2xl px-5 py-3 flex items-center gap-3 pointer-events-none"
          >
            <span className="text-2xl">{celebratingChallenge.icon}</span>
            <div>
              <p className="text-sm font-bold text-success">Weekly Challenge Complete!</p>
              <p className="text-xs text-muted-foreground">{celebratingChallenge.title}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    <div className="bg-card rounded-2xl p-5 border shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Trophy className="h-4 w-4 text-warning" />
          Weekly Challenges
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span className={cn(
            "font-medium",
            deadline.daysLeft <= 1 && "text-destructive"
          )}>
            {deadline.daysLeft <= 0
              ? 'Ends today!'
              : deadline.daysLeft === 1
                ? `${deadline.hoursLeft}h left`
                : `${deadline.daysLeft}d left`}
          </span>
        </div>
      </div>

      {/* Completion summary */}
      <div className="flex items-center gap-2 mb-4">
        <Progress 
          value={(completedCount / data.challenges.length) * 100} 
          className="h-2 flex-1" 
        />
        <span className="text-xs font-medium text-muted-foreground">
          {completedCount}/{data.challenges.length}
        </span>
      </div>

      {/* Challenge list */}
      <div className="space-y-3">
        <AnimatePresence>
          {data.challenges.map((challenge, i) => (
            <motion.div
              key={challenge.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border transition-all",
                challenge.completed
                  ? "bg-success/10 border-success/25"
                  : "bg-muted/30 border-transparent"
              )}
            >
              {/* Icon */}
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-lg",
                challenge.completed ? "bg-success/20" : "bg-muted"
              )}>
                {challenge.completed ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <span>{challenge.icon}</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-medium truncate",
                  challenge.completed && "line-through text-muted-foreground"
                )}>
                  {challenge.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {challenge.description}
                </p>
                {!challenge.completed && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 bg-muted rounded-full h-1.5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((challenge.current / challenge.target) * 100, 100)}%` }}
                        className="bg-primary h-1.5 rounded-full"
                      />
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {challenge.current}/{challenge.target}
                    </span>
                  </div>
                )}
              </div>

            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* All completed celebration */}
      {data.allCompleted && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center justify-center gap-2 mt-4 pt-3 border-t"
        >
          <Sparkles className="h-4 w-4 text-warning" />
          <span className="text-sm font-semibold text-warning">
            All weekly challenges completed! 🏆
          </span>
        </motion.div>
      )}

      {!data.allCompleted && (
        <p className="text-[10px] text-muted-foreground text-center mt-3">
          Resets every Saturday
        </p>
      )}
    </div>
    </>
  );
};
