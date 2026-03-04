import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MapPin, ChevronRight, Trophy, Compass, RotateCcw, Award, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ALL_JOURNEYS,
  Journey,
  JourneyMilestone,
  JourneyBadge,
  BadgeRarity,
  RARITY_CONFIG,
  loadJourneyData,
  startJourney,
  getActiveJourney,
  abandonJourney,
  VirtualJourneyData,
  getJourneyBadges,
} from '@/utils/virtualJourneyStorage';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import Confetti from 'react-confetti';
import { playAchievementSound } from '@/utils/gamificationSounds';
import { JourneyCertificate } from '@/components/JourneyCertificate';
import { MiniMedalBadge } from '@/components/MedalBadge';

/** Helper to get translated journey name */
const useJourneyT = () => {
  const { t } = useTranslation();
  return {
    journeyName: (journey: Journey) => t(`journey.${journey.id}.name`, journey.name),
    journeyDesc: (journey: Journey) => t(`journey.${journey.id}.description`, journey.description),
    milestoneName: (journey: Journey, ms: JourneyMilestone) => t(`journey.${journey.id}.${ms.id}`, ms.name),
    milestoneDesc: (journey: Journey, ms: JourneyMilestone) => t(`journey.${journey.id}.${ms.id}_desc`, ms.description),
  };
};

export const VirtualJourneyCard = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const jt = useJourneyT();
  const [data, setData] = useState<VirtualJourneyData | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [celebration, setCelebration] = useState<{ milestone?: JourneyMilestone; completed?: boolean } | null>(null);
  const [showCertificate, setShowCertificate] = useState(false);

  const reload = () => setData(loadJourneyData());

  useEffect(() => {
    reload();

    const milestoneHandler = (e: CustomEvent<{ milestone?: JourneyMilestone; completed?: boolean }>) => {
      const { milestone, completed } = e.detail;
      setCelebration({ milestone, completed });
      if (completed) {
        setTimeout(() => { setCelebration(null); setShowCertificate(true); }, 4000);
      } else {
        setTimeout(() => setCelebration(null), 4000);
      }
      reload();
    };

    const tasksHandler = () => reload();

    window.addEventListener('journeyMilestoneReached', milestoneHandler as EventListener);
    window.addEventListener('tasksUpdated', tasksHandler);
    return () => {
      window.removeEventListener('journeyMilestoneReached', milestoneHandler as EventListener);
      window.removeEventListener('tasksUpdated', tasksHandler);
    };
  }, []);

  const active = data ? getActiveJourney() : null;
  const journeyBadges = data ? getJourneyBadges(data) : [];

  const handleStart = (journeyId: string) => {
    startJourney(journeyId);
    setShowPicker(false);
    reload();
  };

  const handleAbandon = () => {
    abandonJourney();
    reload();
  };

  // Progress card for active journey
  if (active) {
    const { journey, progress } = active;
    const totalJourneyTasks = journey.milestones.reduce((sum, ms) => sum + ms.tasksRequired, 0);
    const totalDone = journey.milestones.reduce((sum, ms, i) => {
      if (i < (progress.currentMilestoneIndex ?? 0)) return sum + ms.tasksRequired;
      if (i === (progress.currentMilestoneIndex ?? 0)) return sum + (progress.currentMilestoneTasks ?? 0);
      return sum;
    }, 0);
    const percent = Math.min((totalDone / totalJourneyTasks) * 100, 100);
    const isComplete = !!progress.completedAt;

    const currentMsIndex = progress.currentMilestoneIndex ?? 0;
    const nextMilestone = currentMsIndex < journey.milestones.length ? journey.milestones[currentMsIndex] : undefined;
    const lastReached = [...journey.milestones].reverse().find(m => progress.milestonesReached.includes(m.id));

    return (
      <>
        {/* Milestone Celebration */}
        <AnimatePresence>
          {celebration && (
            <>
              {celebration.completed && (
                <Confetti
                  width={window.innerWidth}
                  height={window.innerHeight}
                  recycle={false}
                  numberOfPieces={300}
                  style={{ position: 'fixed', top: 0, left: 0, zIndex: 120, pointerEvents: 'none' }}
                />
              )}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[115] flex items-center justify-center bg-background/80 backdrop-blur-sm"
                onClick={() => setCelebration(null)}
              >
                <motion.div
                  initial={{ scale: 0, y: 50 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', damping: 12 }}
                  className="flex flex-col items-center gap-4 p-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 0.6, repeat: 2 }}
                    className="text-7xl"
                  >
                    {celebration.completed ? '🏆' : celebration.milestone?.icon}
                  </motion.div>
                  <h2 className="text-2xl font-bold text-foreground">
                    {celebration.completed
                      ? t('journey.journeyComplete', 'Journey Complete! 🎉')
                      : t('journey.milestoneReached', 'Milestone Reached!')}
                  </h2>
                  <p className="text-lg font-semibold text-warning">
                    {celebration.completed ? jt.journeyName(journey) : celebration.milestone ? jt.milestoneName(journey, celebration.milestone) : ''}
                  </p>
                  <p className="text-sm text-muted-foreground text-center max-w-[280px]">
                    {celebration.completed
                      ? t('journey.completedEntireJourney', { name: jt.journeyName(journey), defaultValue: 'You completed the entire {{name}} journey!' })
                      : celebration.milestone ? jt.milestoneDesc(journey, celebration.milestone) : ''}
                  </p>
                </motion.div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-5 border shadow-sm"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">{journey.emoji}</span>
              <div>
                <h3 className="font-bold text-sm">{jt.journeyName(journey)}</h3>
                <p className="text-xs text-muted-foreground">
                  {`${totalDone}/${totalJourneyTasks} ${t('common.tasks', 'tasks')}`}
                </p>
              </div>
            </div>
            {isComplete ? (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { handleAbandon(); setShowPicker(true); }}
                className="text-xs font-medium text-primary flex items-center gap-1"
              >
                {t('journey.newJourney', 'New Journey')} <ChevronRight className="h-3 w-3" />
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleAbandon}
                className="text-xs text-muted-foreground flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" /> {t('journey.change', 'Change')}
              </motion.button>
            )}
          </div>

          {/* Visual Journey Map */}
          <div className="relative mb-3">
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={cn(
                  "h-full rounded-full",
                  isComplete
                    ? "bg-gradient-to-r from-warning to-success"
                    : `bg-${journey.color}`
                )}
                style={{
                  background: isComplete
                    ? undefined
                    : `hsl(var(--${journey.color}))`,
                }}
              />
            </div>

            <div className="absolute top-0 left-0 right-0 h-3 flex items-center">
              {journey.milestones.map((ms, i) => {
                const cumulative = journey.milestones.slice(0, i + 1).reduce((s, m) => s + m.tasksRequired, 0);
                const msPercent = (cumulative / totalJourneyTasks) * 100;
                const reached = progress.milestonesReached.includes(ms.id);
                return (
                  <div
                    key={ms.id}
                    className="absolute -translate-x-1/2"
                    style={{ left: `${msPercent}%` }}
                    title={jt.milestoneName(journey, ms)}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center text-[8px] -mt-1",
                        reached
                          ? "bg-warning border-warning text-warning-foreground"
                          : "bg-card border-muted-foreground/30"
                      )}
                    >
                      {reached ? ms.icon : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current location label */}
          <div className="flex items-center gap-1.5 mt-4">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium">
              {isComplete
                ? `🏆 ${t('journey.journeyComplete', 'Journey Complete! 🎉')}`
                : nextMilestone
                  ? t('journey.nextMilestone', { name: jt.milestoneName(journey, nextMilestone), count: nextMilestone.tasksRequired - (progress.currentMilestoneTasks ?? 0), defaultValue: 'Next: {{name}} ({{count}} tasks away)' })
                  : lastReached ? jt.milestoneName(journey, lastReached) : t('journey.startingPoint', 'Starting point')}
            </span>
          </div>

          {/* Milestones list - compact */}
          <div className="mt-4 space-y-1.5">
            {journey.milestones.map((ms, i) => {
              const reached = progress.milestonesReached.includes(ms.id);
              const isCurrent = i === (progress.currentMilestoneIndex ?? 0) && !isComplete;
              const currentTasks = isCurrent ? (progress.currentMilestoneTasks ?? 0) : reached ? ms.tasksRequired : 0;
              return (
                <div
                  key={ms.id}
                  className={cn(
                    "flex items-center gap-2.5 py-1.5 px-2 rounded-lg text-xs transition-all",
                    reached && "bg-success/10",
                    isCurrent && "bg-primary/10 border border-primary/20"
                  )}
                >
                  <span className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0",
                    reached ? "bg-success/20" : "bg-muted"
                  )}>
                    {reached ? ms.icon : (i + 1)}
                  </span>
                  <span className={cn(
                    "font-medium flex-1",
                    reached ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {jt.milestoneName(journey, ms)}
                  </span>
                  <span className="text-muted-foreground text-[10px]">
                    {currentTasks}/{ms.tasksRequired} {t('common.tasks', 'tasks')}
                  </span>
                  {reached && <span className="text-success text-xs">✓</span>}
                </div>
              );
            })}
          </div>
          {/* Journey badges */}
          {journeyBadges.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">{t('journey.journeyBadges', 'Journey Badges')}</p>
                <button
                  onClick={() => navigate('/todo/journey-badges')}
                  className="text-[10px] text-primary font-semibold flex items-center gap-0.5"
                >
                  {t('journey.viewAll', 'View All')} <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {journeyBadges.slice(-6).reverse().map((badge) => (
                  <button key={badge.id} onClick={() => navigate('/todo/journey-badges')} className="hover:opacity-80 transition-opacity">
                    <MiniMedalBadge badge={badge} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            {isComplete && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowCertificate(true)}
                className="flex-1 bg-warning/10 border border-warning/20 rounded-xl py-2.5 flex items-center justify-center gap-2 text-warning font-semibold text-xs"
              >
                <Award className="h-4 w-4" />
                {t('journey.certificate', 'Certificate')}
              </motion.button>
            )}
            {data && (data.completedJourneys.length > 0 || Object.keys(data.journeyProgress).length > 1) && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/todo/journey-history')}
                className="flex-1 bg-muted border border-border rounded-xl py-2.5 flex items-center justify-center gap-2 text-muted-foreground font-semibold text-xs"
              >
                <History className="h-4 w-4" />
                {t('journey.history', 'History')}
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* Certificate Modal */}
        {isComplete && (
          <JourneyCertificate
            open={showCertificate}
            onClose={() => setShowCertificate(false)}
            journey={journey}
            progress={progress}
          />
        )}

        <JourneyPickerSheet
          open={showPicker}
          onClose={() => setShowPicker(false)}
          onSelect={handleStart}
          completedJourneys={data?.completedJourneys || []}
        />
      </>
    );
  }

  // No active journey - show start card
  return (
    <>
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setShowPicker(true)}
        className="w-full bg-card rounded-2xl p-5 border shadow-sm text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Compass className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm">{t('journey.title', 'Virtual Journey')}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('journey.startDescription', 'Complete tasks to travel the world! Pick an adventure.')}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
        {data && (data.completedJourneys.length > 0 || journeyBadges.length > 0) && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-warning" />
                <span className="text-xs text-muted-foreground">
                  {t('journey.journeysCompleted', { count: data.completedJourneys.length, defaultValue: '{{count}} journey(s) completed' })}
                </span>
              </div>
              {journeyBadges.length > 0 && (
                <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                  {t('journey.badgesCount', { count: journeyBadges.length, defaultValue: '{{count}} badges' })}
                </span>
              )}
            </div>
            <span
              onClick={(e) => { e.stopPropagation(); navigate('/todo/journey-history'); }}
              className="text-[10px] text-primary font-semibold flex items-center gap-0.5"
            >
              {t('journey.viewAll', 'View All')} <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        )}
      </motion.button>

      <JourneyPickerSheet
        open={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handleStart}
        completedJourneys={data?.completedJourneys || []}
      />
    </>
  );
};

// Journey selection sheet
const JourneyPickerSheet = ({
  open,
  onClose,
  onSelect,
  completedJourneys,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  completedJourneys: string[];
}) => {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" />
            {t('journey.chooseAdventure', 'Choose Your Adventure')}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-3 pb-6">
          {ALL_JOURNEYS.map((journey) => {
            const completed = completedJourneys.includes(journey.id);
            return (
              <motion.button
                key={journey.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => onSelect(journey.id)}
                className={cn(
                  "w-full text-left p-4 rounded-xl border transition-all",
                  completed
                    ? "bg-success/5 border-success/30"
                    : "bg-card border-border hover:border-primary/40"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{journey.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm">{t(`journey.${journey.id}.name`, journey.name)}</h4>
                      {completed && (
                        <span className="text-[10px] bg-success/20 text-success px-2 py-0.5 rounded-full font-semibold">
                          {t('journey.completedCheck', 'Completed ✓')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{t(`journey.${journey.id}.description`, journey.description)}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {`${journey.totalTasks} ${t('common.tasks', 'tasks')}`}
                      </span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {`${journey.milestones.length} ${t('journey.milestonesCount', 'milestones')}`}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </motion.button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};
