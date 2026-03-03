import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Trophy, MapPin, ChevronRight, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TodoLayout } from './TodoLayout';
import {
  ALL_JOURNEYS,
  Journey,
  JourneyProgress,
  loadJourneyData,
  VirtualJourneyData,
} from '@/utils/virtualJourneyStorage';
import { JourneyCertificate } from '@/components/JourneyCertificate';
import { format } from 'date-fns';

const JourneyHistory = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<VirtualJourneyData | null>(null);
  const [selectedJourney, setSelectedJourney] = useState<{ journey: Journey; progress: JourneyProgress } | null>(null);

  useEffect(() => {
    setData(loadJourneyData());
  }, []);

  if (!data) return null;

  // Get all journeys that have progress (completed or in-progress)
  const journeysWithProgress = ALL_JOURNEYS
    .filter(j => data.journeyProgress[j.id])
    .map(j => ({ journey: j, progress: data.journeyProgress[j.id] }))
    .sort((a, b) => {
      // Completed first, then by date
      if (a.progress.completedAt && !b.progress.completedAt) return -1;
      if (!a.progress.completedAt && b.progress.completedAt) return 1;
      return new Date(b.progress.startedAt).getTime() - new Date(a.progress.startedAt).getTime();
    });

  const completedCount = data.completedJourneys.length;
  const totalTasks = data.totalTasksEver;

  return (
    <TodoLayout title="Journey History">
      <div className="container mx-auto px-4 py-6 space-y-5">

        {/* Stats Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-5 border shadow-sm"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full bg-warning/15 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h2 className="font-bold text-base">Your Adventures</h2>
              <p className="text-xs text-muted-foreground">Every task is a step forward</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-foreground">{completedCount}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Completed</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-foreground">{journeysWithProgress.length}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Attempted</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-foreground">{totalTasks}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Total Steps</p>
            </div>
          </div>
        </motion.div>

        {/* Journey List */}
        {journeysWithProgress.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card rounded-2xl p-8 border text-center"
          >
            <Compass className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="font-semibold text-sm text-muted-foreground">No journeys yet</h3>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Start a virtual journey from the Progress page to begin your adventure!
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {journeysWithProgress.map(({ journey, progress }, index) => {
              const isComplete = !!progress.completedAt;
              const percent = Math.min((progress.tasksCompleted / journey.totalTasks) * 100, 100);
              const milestonesReached = progress.milestonesReached.length;

              return (
                <motion.button
                  key={journey.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => isComplete ? setSelectedJourney({ journey, progress }) : null}
                  className={cn(
                    "w-full text-left bg-card rounded-2xl p-4 border shadow-sm transition-all",
                    isComplete && "cursor-pointer active:bg-muted/50",
                    !isComplete && "cursor-default opacity-80"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Journey icon */}
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0",
                      isComplete ? "bg-success/10" : "bg-muted"
                    )}>
                      {journey.emoji}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Title row */}
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-sm truncate">{journey.name}</h4>
                        {isComplete && (
                          <span className="text-[9px] bg-success/15 text-success px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
                            ✓ Complete
                          </span>
                        )}
                        {!isComplete && (
                          <span className="text-[9px] bg-warning/15 text-warning px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
                            In Progress
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-2">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            isComplete ? "bg-success" : "bg-primary"
                          )}
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      {/* Meta info */}
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5" />
                          {progress.tasksCompleted}/{journey.totalTasks} tasks
                        </span>
                        <span>{milestonesReached}/{journey.milestones.length} milestones</span>
                        {progress.completedAt && (
                          <span>{format(new Date(progress.completedAt), 'MMM d, yyyy')}</span>
                        )}
                      </div>

                      {/* Milestone icons */}
                      <div className="flex items-center gap-1.5 mt-2">
                        {journey.milestones.map((ms) => {
                          const reached = progress.milestonesReached.includes(ms.id);
                          return (
                            <span
                              key={ms.id}
                              className={cn("text-sm", !reached && "opacity-25 grayscale")}
                              title={ms.name}
                            >
                              {ms.icon}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Chevron for completed */}
                    {isComplete && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* Certificate Modal */}
      {selectedJourney && (
        <JourneyCertificate
          open={!!selectedJourney}
          onClose={() => setSelectedJourney(null)}
          journey={selectedJourney.journey}
          progress={selectedJourney.progress}
        />
      )}
    </TodoLayout>
  );
};

export default JourneyHistory;
