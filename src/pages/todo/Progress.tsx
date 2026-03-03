import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TodoLayout } from './TodoLayout';
import { useStreak } from '@/hooks/useStreak';
import { cn } from '@/lib/utils';
import { Flame, Check, Snowflake, Trophy, Zap, TrendingUp, Calendar, Gift, Clock, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { loadTodoItems } from '@/utils/todoItemsStorage';
import { startOfWeek, endOfWeek, format } from 'date-fns';
import { checkDailyReward, loadDailyRewardData, type DailyRewardData } from '@/utils/dailyRewardStorage';



import { GamificationCertificates, hasNewCertificates } from '@/components/GamificationCertificates';
import { StreakDetailSheet } from '@/components/StreakDetailSheet';
import { VirtualJourneyCard } from '@/components/VirtualJourneyCard';

import { StreakSocietyBadge } from '@/components/StreakSocietyBadge';

const Progress = () => {
  const { t } = useTranslation();
  const { data, isLoading, completedToday, atRisk, status, weekData, gracePeriodRemaining } = useStreak();
  const [weekStats, setWeekStats] = useState({ completed: 0, total: 0 });
  
  
  const [showCertificates, setShowCertificates] = useState(false);
  const [showStreakDetail, setShowStreakDetail] = useState(false);
  const [rewardDay, setRewardDay] = useState(1);
  const [rewardClaimed, setRewardClaimed] = useState(false);
  const [hasNewCerts, setHasNewCerts] = useState(false);
  const [completedCycles, setCompletedCycles] = useState(0);
  
  const [isPersonalBest, setIsPersonalBest] = useState(false);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const tasks = await loadTodoItems();
        const now = new Date();
        const weekStart = startOfWeek(now, { weekStartsOn: 0 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 0 });

        // Week stats
        const thisWeekTasks = tasks.filter(task => {
          if (!task.completedAt) return false;
          const completedDate = new Date(task.completedAt);
          return completedDate >= weekStart && completedDate <= weekEnd;
        });
        setWeekStats({
          completed: thisWeekTasks.length,
          total: tasks.filter(t => t.completed).length,
        });

        // Load daily reward state
        const rewardResult = await checkDailyReward();
        setRewardDay(rewardResult.currentDay);
        setRewardClaimed(!rewardResult.canClaim);

        // Load completed cycles
        const rewardData = await loadDailyRewardData();
        setCompletedCycles(rewardData.completedCycles || 0);

        // Check for new certificate badges
        const newCerts = await hasNewCertificates(data?.longestStreak || 0);
        setHasNewCerts(newCerts);

        // Check if weekly report has unseen data

        // Check for personal best streak
        const currentStreak = data?.currentStreak || 0;
        const longestStreak = data?.longestStreak || 0;
        const lastSharedBest = parseInt(localStorage.getItem('npd_last_shared_best_streak') || '0', 10);
        setIsPersonalBest(currentStreak > 0 && currentStreak >= longestStreak && currentStreak > lastSharedBest);
      } catch (error) {
        console.error('Failed to load stats:', error);
      }
    };
    loadStats();

    const handler = () => loadStats();
    window.addEventListener('tasksUpdated', handler);
    window.addEventListener('dailyRewardClaimed', handler);
    return () => {
      window.removeEventListener('tasksUpdated', handler);
      window.removeEventListener('dailyRewardClaimed', handler);
    };
  }, []);

  // Get encouraging message based on status
  const getMessage = () => {
    if (completedToday) {
      if (data?.currentStreak === 1) {
        return t('streak.firstDayComplete', "Great start! Let's keep going tomorrow.");
      }
      return t('streak.continueMessage', "I knew you'd come back! Let's do this again tomorrow.");
    }
    
    if (status === 'grace_period') {
      return t('streak.gracePeriodMessage', `You have ${gracePeriodRemaining} hours to save your streak!`);
    }
    
    if (status === 'lost' || status === 'new') {
      return t('streak.newStreakMessage', 'New streaks start today. Complete one task to begin!');
    }
    
    if (atRisk) {
      return t('streak.atRiskMessage', 'Complete one task today to keep your streak going!');
    }
    
    return t('streak.keepGoingMessage', 'You\'re on a roll! Keep it up.');
  };

  // Milestone badges - using semantic color classes
  const milestones = [
    { value: 3, icon: Zap, label: '3 days', color: 'text-warning' },
    { value: 7, icon: Trophy, label: '1 week', color: 'text-info' },
    { value: 14, icon: TrendingUp, label: '2 weeks', color: 'text-success' },
    { value: 30, icon: Flame, label: '1 month', color: 'text-streak' },
  ];

  if (isLoading) {
    return (
      <TodoLayout title={t('nav.progress', 'Progress')}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </TodoLayout>
    );
  }

  // Calculate freeze progress
  const TASKS_FOR_FREEZE = 5;
  const dailyTaskCount = data?.dailyTaskCount || 0;
  const freezeProgress = Math.min(dailyTaskCount, TASKS_FOR_FREEZE);
  const freezeProgressPercent = (freezeProgress / TASKS_FOR_FREEZE) * 100;

  return (
    <TodoLayout title={t('nav.progress', 'Progress')}>

      <div className="container mx-auto px-4 py-6 space-y-6">
        
        {/* Tappable Streak Counter Widget */}
        <motion.button
          onClick={() => setShowStreakDetail(true)}
          whileTap={{ scale: 0.97 }}
          className="w-full bg-card rounded-2xl p-6 border shadow-sm text-left active:bg-muted/50 transition-colors"
        >
          {/* Message Bubble */}
          <div className="relative bg-muted rounded-xl p-4 mb-6">
            <p className="text-sm text-foreground">{getMessage()}</p>
            <div className="absolute -bottom-2 left-8 w-4 h-4 bg-muted rotate-45" />
          </div>
          
          {/* Animated Fire + Streak Count */}
          <div className="flex flex-col items-center py-6">
            <motion.div
              className="relative"
              animate={{
                scale: completedToday ? [1, 1.12, 1] : [1, 1.04, 1],
                rotate: completedToday ? [0, -2, 2, 0] : 0,
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              {/* Glow behind flame */}
              {completedToday && (
                <motion.div
                  className="absolute inset-0 rounded-full blur-xl bg-streak/30"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              <Flame 
                className={cn(
                  "h-24 w-24 transition-colors relative z-10",
                  completedToday ? "text-streak fill-streak/80" : "text-muted-foreground/30"
                )} 
              />
              {data?.currentStreak !== undefined && data.currentStreak > 0 && (
                <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-streak-foreground drop-shadow-md mt-2 z-20">
                  {data.currentStreak}
                </span>
              )}
            </motion.div>
            
            <motion.div 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="text-center mt-4"
            >
                <h2 className={cn(
                  "text-5xl font-bold",
                  completedToday ? "text-streak" : "text-muted-foreground"
                )}>
                  {data?.currentStreak || 0}
                </h2>
                <p className={cn(
                  "text-lg font-medium",
                  completedToday ? "text-streak" : "text-muted-foreground"
                )}>
                  {t('streak.dayStreak', 'day streak')}
                </p>
                <div className="flex justify-center mt-2">
                  <StreakSocietyBadge streak={data?.currentStreak || 0} compact />
                </div>
              {(data?.currentStreak || 0) > 0 && (data?.currentStreak || 0) >= (data?.longestStreak || 0) ? (
                <motion.p
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-xs font-bold text-warning mt-1"
                >
                  New Personal Best! 🎉
                </motion.p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('streak.tapForDetails', 'Tap for details')}
                </p>
              )}
            </motion.div>
          </div>
        </motion.button>

        {/* Week Progress & Freeze Info Card */}
        <div className="bg-card rounded-2xl p-6 border shadow-sm">
          {/* Week Progress */}
          <div className="flex justify-between items-center gap-1 overflow-hidden">
            {weekData.map((day, index) => (
              <div key={day.date} className="flex flex-col items-center gap-2 min-w-0 flex-1">
                <span className={cn(
                  "text-xs font-medium truncate",
                  day.isToday ? "text-primary" : "text-muted-foreground"
                )}>
                  {day.day}
                </span>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all flex-shrink-0",
                    day.completed 
                      ? "bg-streak border-streak text-streak-foreground" 
                      : day.isToday 
                        ? "border-primary bg-primary/10" 
                        : "border-muted bg-muted/50"
                  )}
                >
                  {day.completed && <Check className="h-4 w-4 sm:h-5 sm:w-5" />}
                </motion.div>
              </div>
            ))}
          </div>
          
          {/* Grace Period Indicator */}
          {status === 'grace_period' && gracePeriodRemaining > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-2 mt-6 pt-4 border-t bg-warning/10 -mx-6 -mb-6 px-6 py-4 rounded-b-2xl"
            >
              <Clock className="h-5 w-5 text-warning" />
              <span className="text-sm text-warning font-medium">
                {t('streak.gracePeriodActive', '{{hours}}h grace period remaining - complete a task to save your streak!', { hours: gracePeriodRemaining })}
              </span>
            </motion.div>
          )}
          
          {/* Streak Freezes */}
          {status !== 'grace_period' && data?.streakFreezes !== undefined && data.streakFreezes > 0 && (
            <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t">
              <Snowflake className="h-5 w-5 text-info" />
              <span className="text-sm text-muted-foreground">
                {data.streakFreezes} {t('streak.freezesAvailable', 'streak freeze(s) available')}
              </span>
            </div>
          )}
          
          {/* Freeze Progress */}
          {!data?.freezesEarnedToday && (
            <div className="mt-6 pt-4 border-t">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="h-4 w-4 text-info" />
                <span className="text-sm text-muted-foreground">
                  {t('streak.earnFreeze', 'Complete {{remaining}} more tasks today to earn a freeze', { remaining: TASKS_FOR_FREEZE - freezeProgress })}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${freezeProgressPercent}%` }}
                  className="bg-info h-2 rounded-full"
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-muted-foreground">{freezeProgress}/{TASKS_FOR_FREEZE}</span>
              </div>
            </div>
          )}
          
          {data?.freezesEarnedToday && (
            <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t">
              <Gift className="h-5 w-5 text-success" />
              <span className="text-sm text-success">
                {t('streak.freezeEarnedToday', 'Freeze earned today! 🎉')}
              </span>
            </div>
          )}
        </div>
        
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card rounded-xl p-4 border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Trophy className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">{t('streak.longestStreak', 'Longest Streak')}</span>
            </div>
            <p className="text-2xl font-bold">{data?.longestStreak || 0} <span className="text-sm font-normal text-muted-foreground">{t('streak.days', 'days')}</span></p>
          </div>
          
          <div className="bg-card rounded-xl p-4 border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Check className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">{t('streak.totalCompleted', 'Total Completed')}</span>
            </div>
            <p className="text-2xl font-bold">{data?.totalCompletions || 0} <span className="text-sm font-normal text-muted-foreground">{t('streak.tasks', 'tasks')}</span></p>
          </div>
          
          <div className="bg-card rounded-xl p-4 border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Calendar className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">{t('streak.thisWeek', 'This Week')}</span>
            </div>
            <p className="text-2xl font-bold">{weekStats.completed} <span className="text-sm font-normal text-muted-foreground">{t('streak.tasks', 'tasks')}</span></p>
          </div>
          
          <div className="bg-card rounded-xl p-4 border">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Snowflake className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">{t('streak.freezes', 'Freezes')}</span>
            </div>
            <p className="text-2xl font-bold">{data?.streakFreezes || 0}</p>
          </div>
        </div>

        {/* Milestones */}
        <div className="bg-card rounded-xl p-4 border">
          <h3 className="font-semibold mb-4">{t('streak.milestones', 'Milestones')}</h3>
          <div className="grid grid-cols-4 gap-3">
            {milestones.map((milestone) => {
              const achieved = data?.milestones?.includes(milestone.value);
              const Icon = milestone.icon;
              
              return (
                <div 
                  key={milestone.value}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                    achieved 
                      ? "border-primary/50 bg-primary/5" 
                      : "border-muted bg-muted/30 opacity-50"
                  )}
                >
                  <Icon className={cn("h-6 w-6", achieved ? milestone.color : "text-muted-foreground")} />
                  <span className="text-xs font-medium text-center">{milestone.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Certificates Button */}
        <div>
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setShowCertificates(true)}
            className="relative w-full bg-warning/10 border border-warning/20 rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 text-warning font-semibold text-[10px] active:scale-[0.98] transition-transform"
          >
            {hasNewCerts && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-destructive animate-pulse shadow-sm" />
            )}
            <Award className="h-4 w-4" />
            Certificates
          </motion.button>
        </div>

        {/* Virtual Journey */}
        <VirtualJourneyCard />

        {/* At Risk Warning */}
        <AnimatePresence>
          {atRisk && !completedToday && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-streak/10 border border-streak/30 rounded-xl p-4 flex items-center gap-3"
            >
              <Flame className="h-5 w-5 text-streak flex-shrink-0" />
              <p className="text-sm text-streak">
                {t('streak.atRiskWarning', 'Complete one task today to keep your streak going!')}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>



      {/* Certificates Modal */}
      <GamificationCertificates
        isOpen={showCertificates}
        onClose={() => { setShowCertificates(false); setHasNewCerts(false); }}
        streakData={data}
      />

      {/* Streak Detail Sheet */}
      <StreakDetailSheet
        isOpen={showStreakDetail}
        onClose={() => setShowStreakDetail(false)}
        currentStreak={data?.currentStreak || 0}
        longestStreak={data?.longestStreak || 0}
        streakFreezes={data?.streakFreezes || 0}
        totalCompletions={data?.totalCompletions || 0}
        weekData={weekData}
        completedToday={completedToday}
      />
    </TodoLayout>
  );
};

export default Progress;
