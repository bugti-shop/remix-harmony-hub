import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Target, RefreshCw, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DailyChallengesData,
  DailyChallenge,
  loadDailyChallenges,
  refreshChallenges,
} from '@/utils/gamificationStorage';
import { playChallengeCompleteSound } from '@/utils/gamificationSounds';

export const DailyChallenges = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<DailyChallengesData | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [completedChallenge, setCompletedChallenge] = useState<DailyChallenge | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const challengeData = await loadDailyChallenges();
      setData(challengeData);
    };
    loadData();

    const handleComplete = (e: CustomEvent<{ challenge: DailyChallenge }>) => {
      setCompletedChallenge(e.detail.challenge);
      
      // Play celebration sound
      playChallengeCompleteSound();
      
      setTimeout(() => setCompletedChallenge(null), 3000);
      loadData();
    };

    const handleUpdate = () => loadData();

    window.addEventListener('challengeCompleted', handleComplete as EventListener);
    return () => {
      window.removeEventListener('challengeCompleted', handleComplete as EventListener);
    };
  }, []);

  const handleRefresh = async () => {
    if (!data || data.refreshCount >= 1) return;
    setIsRefreshing(true);
    const newData = await refreshChallenges();
    setData(newData);
    setIsRefreshing(false);
  };

  if (!data) return null;

  const completedCount = data.challenges.filter(c => c.completed).length;
  const canRefresh = data.refreshCount < 1;

  return (
    <>
      {/* Challenge Completed Celebration */}
      <AnimatePresence>
        {completedChallenge && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-warning to-streak text-warning-foreground px-6 py-3 rounded-full shadow-xl flex items-center gap-2"
          >
            <Sparkles className="h-5 w-5" />
            <span className="font-semibold">{completedChallenge.title} Complete!</span>
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">Done!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl p-4 border"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-info" />
            <h3 className="font-semibold">{t('challenges.title', 'Daily Challenges')}</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {completedCount}/{data.challenges.length}
            </span>
            {canRefresh && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {data.challenges.map((challenge) => (
            <motion.div
              key={challenge.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "relative p-3 rounded-lg border-2 transition-all",
                challenge.completed
                  ? "bg-green-500/10 border-green-500/30"
                  : "bg-muted/50 border-transparent hover:border-primary/20"
              )}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                 <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0",
                  challenge.completed
                    ? "bg-success text-success-foreground"
                    : "bg-muted"
                )}>
                  {challenge.completed ? <Check className="h-5 w-5" /> : challenge.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className={cn(
                      "font-medium text-sm",
                      challenge.completed && "line-through text-muted-foreground"
                    )}>
                      {challenge.title}
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {challenge.description}
                  </p>

                  {/* Progress Bar */}
                  {!challenge.completed && (
                    <div className="mt-2">
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>{challenge.current}/{challenge.target}</span>
                        <span>{Math.round((challenge.current / challenge.target) * 100)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(challenge.current / challenge.target) * 100}%` }}
                         className="h-1.5 rounded-full bg-info"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* All Completed Message */}
        {completedCount === data.challenges.length && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
             className="mt-4 p-3 bg-gradient-to-r from-success/20 to-success/10 rounded-lg text-center"
          >
            <Sparkles className="h-6 w-6 text-success mx-auto mb-1" />
            <p className="text-sm font-medium text-success">
              {t('challenges.allComplete', 'All challenges completed! 🎉')}
            </p>
          </motion.div>
        )}
      </motion.div>
    </>
  );
};
