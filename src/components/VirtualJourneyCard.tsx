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
  loadJourneyData,
  startJourney,
  getActiveJourney,
  abandonJourney,
  VirtualJourneyData,
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

export const VirtualJourneyCard = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [data, setData] = useState<VirtualJourneyData | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [celebration, setCelebration] = useState<{ milestone?: JourneyMilestone; completed?: boolean } | null>(null);
  const [showCertificate, setShowCertificate] = useState(false);

  const reload = () => setData(loadJourneyData());

  useEffect(() => {
    reload();

    // Listen for milestone events dispatched by the global useJourneyAdvancement hook
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

    // Also reload data when tasks update (even without milestones, progress bar should update)
    const tasksHandler = () => reload();

    window.addEventListener('journeyMilestoneReached', milestoneHandler as EventListener);
    window.addEventListener('tasksUpdated', tasksHandler);
    return () => {
      window.removeEventListener('journeyMilestoneReached', milestoneHandler as EventListener);
      window.removeEventListener('tasksUpdated', tasksHandler);
    };
  }, []);

  const active = data ? getActiveJourney() : null;

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
    const percent = Math.min((progress.tasksCompleted / journey.totalTasks) * 100, 100);
    const isComplete = !!progress.completedAt;

    // Find current segment
    const nextMilestone = journey.milestones.find(m => !progress.milestonesReached.includes(m.id));
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
                    {celebration.completed ? 'Journey Complete! 🎉' : 'Milestone Reached!'}
                  </h2>
                  <p className="text-lg font-semibold text-warning">
                    {celebration.completed ? journey.name : celebration.milestone?.name}
                  </p>
                  <p className="text-sm text-muted-foreground text-center max-w-[280px]">
                    {celebration.completed
                      ? `You completed the entire ${journey.name} journey!`
                      : celebration.milestone?.description}
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
                <h3 className="font-bold text-sm">{journey.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {progress.tasksCompleted}/{journey.totalTasks} tasks
                </p>
              </div>
            </div>
            {isComplete ? (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { handleAbandon(); setShowPicker(true); }}
                className="text-xs font-medium text-primary flex items-center gap-1"
              >
                New Journey <ChevronRight className="h-3 w-3" />
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleAbandon}
                className="text-xs text-muted-foreground flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" /> Change
              </motion.button>
            )}
          </div>

          {/* Visual Journey Map */}
          <div className="relative mb-3">
            {/* Progress bar background */}
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

            {/* Milestone dots on progress bar */}
            <div className="absolute top-0 left-0 right-0 h-3 flex items-center">
              {journey.milestones.map((ms) => {
                const msPercent = (ms.tasksRequired / journey.totalTasks) * 100;
                const reached = progress.milestonesReached.includes(ms.id);
                return (
                  <div
                    key={ms.id}
                    className="absolute -translate-x-1/2"
                    style={{ left: `${msPercent}%` }}
                    title={ms.name}
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
                ? '🏆 Journey Complete!'
                : nextMilestone
                  ? `Next: ${nextMilestone.name} (${nextMilestone.tasksRequired - progress.tasksCompleted} tasks away)`
                  : lastReached?.name || 'Starting point'}
            </span>
          </div>

          {/* Milestones list - compact */}
          <div className="mt-4 space-y-1.5">
            {journey.milestones.map((ms, i) => {
              const reached = progress.milestonesReached.includes(ms.id);
              const isNext = ms.id === nextMilestone?.id;
              return (
                <div
                  key={ms.id}
                  className={cn(
                    "flex items-center gap-2.5 py-1.5 px-2 rounded-lg text-xs transition-all",
                    reached && "bg-success/10",
                    isNext && "bg-primary/10 border border-primary/20"
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
                    {ms.name}
                  </span>
                  <span className="text-muted-foreground text-[10px]">
                    {ms.tasksRequired} tasks
                  </span>
                  {reached && <span className="text-success text-xs">✓</span>}
                </div>
              );
            })}
          </div>
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
                Certificate
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
                History
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
            <h3 className="font-bold text-sm">Virtual Journey</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Complete tasks to travel the world! Pick an adventure.
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
        {data && data.completedJourneys.length > 0 && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <div className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-warning" />
              <span className="text-xs text-muted-foreground">
                {data.completedJourneys.length} journey(s) completed
              </span>
            </div>
            <span
              onClick={(e) => { e.stopPropagation(); navigate('/todo/journey-history'); }}
              className="text-[10px] text-primary font-semibold flex items-center gap-0.5"
            >
              View All <ChevronRight className="h-3 w-3" />
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
            Choose Your Adventure
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
                      <h4 className="font-bold text-sm">{journey.name}</h4>
                      {completed && (
                        <span className="text-[10px] bg-success/20 text-success px-2 py-0.5 rounded-full font-semibold">
                          Completed ✓
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{journey.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {journey.totalTasks} tasks
                      </span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {journey.milestones.length} milestones
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
