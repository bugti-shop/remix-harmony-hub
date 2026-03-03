/**
 * Streak Challenge Dialog
 * Appears after completing the first task of the day
 * Shows mascot, campfire, week view, and challenge text
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format, subDays, addDays, startOfWeek } from 'date-fns';
import appLogo from '@/assets/npd-reminder-logo.png';
import { getSetting, setSetting } from '@/utils/settingsStorage';

interface StreakChallengeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentStreak: number;
  weekData: Array<{ day: string; date: string; completed: boolean; isToday: boolean }>;
}

const DAY_LABELS = ['Fr', 'Sa', 'Su', 'Mo', 'Tu', 'We', 'Th'];

/** Build a 7-day rolling window centered around today */
const buildWeekView = (
  weekData: Array<{ day: string; date: string; completed: boolean; isToday: boolean }>
) => {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const dayAbbrs = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Build 7 days: 3 past, today, 3 future
  const days = [];
  for (let i = -3; i <= 3; i++) {
    const d = addDays(today, i);
    const dateStr = format(d, 'yyyy-MM-dd');
    const dayOfWeek = d.getDay();
    const abbr = dayAbbrs[dayOfWeek];
    const matchedDay = weekData.find(w => w.date === dateStr);
    const completed = matchedDay?.completed || false;
    const isToday = dateStr === todayStr;
    const isPast = i < 0;
    const isFuture = i > 0;
    days.push({ abbr, dateStr, completed, isToday, isPast, isFuture });
  }
  return days;
};

export const StreakChallengeDialog = ({ isOpen, onClose, currentStreak, weekData }: StreakChallengeDialogProps) => {
  if (!isOpen) return null;

  const days = buildWeekView(weekData);
  const nextTarget = currentStreak + 1;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-6"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-sm rounded-3xl overflow-hidden border border-border shadow-2xl"
            style={{ background: 'hsl(var(--card))' }}
          >
            {/* Campfire top section */}
            <div
              className="relative pt-8 pb-6 flex flex-col items-center"
              style={{
                background: 'linear-gradient(180deg, hsl(25, 80%, 12%), hsl(20, 60%, 8%), hsl(var(--card)))',
              }}
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4" style={{ color: 'hsl(0,0%,60%)' }} />
              </button>

              {/* Campfire glow */}
              <div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-32 rounded-full blur-3xl opacity-30"
                style={{ background: 'hsl(25, 95%, 50%)' }}
              />

              {/* Fire embers (animated dots) */}
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width: 3 + Math.random() * 3,
                    height: 3 + Math.random() * 3,
                    background: `hsl(${20 + Math.random() * 20}, 100%, ${55 + Math.random() * 20}%)`,
                    left: `${40 + Math.random() * 20}%`,
                    bottom: `${30 + Math.random() * 30}%`,
                  }}
                  animate={{
                    y: [0, -30 - Math.random() * 40],
                    opacity: [0.8, 0],
                    scale: [1, 0.3],
                  }}
                  transition={{
                    duration: 1.5 + Math.random(),
                    repeat: Infinity,
                    delay: Math.random() * 2,
                    ease: 'easeOut',
                  }}
                />
              ))}

              {/* Campfire illustration */}
              <div className="relative z-10 mb-3">
                {/* Fire */}
                <motion.div
                  animate={{ scale: [1, 1.08, 1], rotate: [0, -2, 2, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="text-4xl text-center leading-none"
                >
                  🔥
                </motion.div>
                {/* Logs */}
                <div className="flex items-center justify-center gap-0.5 -mt-1">
                  <div className="w-8 h-2 rounded-full rotate-12" style={{ background: 'hsl(25, 40%, 30%)' }} />
                  <div className="w-8 h-2 rounded-full -rotate-12" style={{ background: 'hsl(25, 35%, 25%)' }} />
                </div>
              </div>

              {/* Mascot */}
              <motion.img
                src={appLogo}
                alt="Npd Mascot"
                className="relative z-10 w-16 h-16 rounded-2xl shadow-lg"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                style={{ border: '2px solid hsl(25, 95%, 53%, 0.3)' }}
              />
            </div>

            {/* Content */}
            <div className="px-6 pb-6 pt-2 text-center">
              {/* Challenge question */}
              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-lg font-bold text-foreground mb-1"
              >
                Can you make it to a
              </motion.h3>
              <motion.p
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25, type: 'spring', stiffness: 300 }}
                className="text-4xl font-black mb-1"
                style={{ color: 'hsl(var(--streak))' }}
              >
                {nextTarget}-day streak?
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-xs text-muted-foreground mb-5"
              >
                You're on fire! Keep the momentum going.
              </motion.p>

              {/* 7-day week view */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="flex justify-between items-center gap-1 mb-5 px-2"
              >
                {days.map((day, i) => (
                  <motion.div
                    key={day.dateStr}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4 + i * 0.05, type: 'spring', stiffness: 400 }}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <span
                      className={cn(
                        "text-[10px] font-bold",
                        day.isToday ? "text-streak" : "text-muted-foreground"
                      )}
                    >
                      {day.abbr}
                    </span>
                    <div
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                        day.completed
                          ? "bg-streak text-streak-foreground shadow-sm"
                          : day.isToday
                          ? "border-2 border-streak bg-streak/10"
                          : day.isPast
                          ? "border-2 border-muted-foreground/20 bg-muted/50"
                          : "border-2 border-dashed border-muted-foreground/20"
                      )}
                      style={
                        day.completed
                          ? { boxShadow: '0 2px 8px hsl(25, 95%, 53%, 0.3)' }
                          : {}
                      }
                    >
                      {day.completed ? (
                        <Check className="h-4 w-4" />
                      ) : day.isToday ? (
                        <Check className="h-4 w-4 text-streak" />
                      ) : (
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          day.isPast ? "bg-muted-foreground/20" : "bg-muted-foreground/15"
                        )} />
                      )}
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {/* Tip */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex items-start gap-2 bg-warning/10 border border-warning/20 rounded-xl px-3 py-2.5 mb-5 text-left"
              >
                <Info className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-warning leading-relaxed font-medium">
                  Your streak will reset if you don't complete a task tomorrow!
                </p>
              </motion.div>

              {/* Continue button */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
              >
                <Button onClick={onClose} className="w-full" size="lg">
                  Continue 🔥
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Hook to manage showing the streak challenge dialog once per day
 * after the first task completion that increments the streak
 */
export const useStreakChallengeDialog = () => {
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    const handleStreakChallenge = async (e: CustomEvent<{ currentStreak: number }>) => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const lastShown = await getSetting<string | null>('streakChallengeLastShown', null);

      // Only show once per day
      if (lastShown === today) return;

      await setSetting('streakChallengeLastShown', today);
      setShowDialog(true);
    };

    window.addEventListener('streakChallengeShow', handleStreakChallenge as EventListener);
    return () => window.removeEventListener('streakChallengeShow', handleStreakChallenge as EventListener);
  }, []);

  return { showDialog, closeDialog: () => setShowDialog(false) };
};
