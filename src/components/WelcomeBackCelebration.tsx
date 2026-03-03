import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Heart, Sparkles } from 'lucide-react';
import type { RetentionMood } from '@/hooks/useRetentionLogo';
import defaultLogo from '@/assets/app-logo.png';
import sadLogo from '@/assets/sad-logo.png';
import angryLogo from '@/assets/angry-logo.png';
import { useState } from 'react';

interface WelcomeBackCelebrationProps {
  isOpen: boolean;
  mood: RetentionMood;
  daysAway: number;
  onDismiss: () => void;
}

const moodConfig: Record<Exclude<RetentionMood, 'default'>, {
  returningLogo: string;
  title: string;
  subtitle: string;
  accent: string;
  bgGradient: string;
}> = {
  sad: {
    returningLogo: sadLogo,
    title: 'Welcome back! 💙',
    subtitle: "We missed you! Your buddy was feeling a little lonely.",
    accent: 'text-info',
    bgGradient: 'from-info/20 to-primary/10',
  },
  angry: {
    returningLogo: angryLogo,
    title: "You're back! 😤➜😊",
    subtitle: "Your buddy was upset, but now they're happy to see you!",
    accent: 'text-streak',
    bgGradient: 'from-streak/20 to-warning/10',
  },
};

export const WelcomeBackCelebration = ({ isOpen, mood, daysAway, onDismiss }: WelcomeBackCelebrationProps) => {
  const [phase, setPhase] = useState<'sad' | 'happy'>('sad');

  if (mood === 'default') return null;

  const config = moodConfig[mood];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          onClick={() => {
            if (phase === 'happy') onDismiss();
          }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />

          {/* Content */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 30 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className={cn(
              "relative z-10 flex flex-col items-center gap-5 p-8 mx-6 rounded-3xl border shadow-lg bg-gradient-to-b",
              config.bgGradient,
              "bg-card"
            )}
          >
            {/* Animated logo transition */}
            <div className="relative w-28 h-28">
              {/* Glow */}
              <motion.div
                className="absolute inset-0 rounded-full blur-xl"
                animate={{
                  backgroundColor: phase === 'sad'
                    ? ['hsl(var(--muted))', 'hsl(var(--info) / 0.3)']
                    : ['hsl(var(--info) / 0.3)', 'hsl(var(--success) / 0.4)'],
                  scale: phase === 'happy' ? [1, 1.4, 1.2] : 1,
                }}
                transition={{ duration: 1 }}
              />

              <AnimatePresence mode="wait">
                {phase === 'sad' ? (
                  <motion.img
                    key="sad"
                    src={config.returningLogo}
                    alt="Sad buddy"
                    className="relative w-28 h-28 object-contain drop-shadow-md"
                    initial={{ scale: 0.8, rotate: -5 }}
                    animate={{
                      scale: [0.9, 1, 0.95, 1],
                      rotate: [-3, 3, -2, 0],
                    }}
                    exit={{ scale: 0, rotate: -180, opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    onAnimationComplete={() => {
                      setTimeout(() => setPhase('happy'), 1500);
                    }}
                  />
                ) : (
                  <motion.img
                    key="happy"
                    src={defaultLogo}
                    alt="Happy buddy"
                    className="relative w-28 h-28 object-contain drop-shadow-md"
                    initial={{ scale: 0, rotate: 180 }}
                    animate={{
                      scale: [0, 1.2, 1],
                      rotate: [180, 0],
                    }}
                    transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Sparkle particles when happy */}
            {phase === 'happy' && (
              <>
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute"
                    initial={{
                      x: 0,
                      y: 0,
                      opacity: 0,
                      scale: 0,
                    }}
                    animate={{
                      x: (Math.random() - 0.5) * 200,
                      y: (Math.random() - 0.5) * 200,
                      opacity: [0, 1, 0],
                      scale: [0, 1, 0.5],
                    }}
                    transition={{
                      duration: 1.5,
                      delay: i * 0.1,
                      ease: 'easeOut',
                    }}
                    style={{ top: '35%', left: '50%' }}
                  >
                    <Sparkles className="h-4 w-4 text-warning" />
                  </motion.div>
                ))}
              </>
            )}

            {/* Text */}
            <motion.div
              className="text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className={cn("text-2xl font-bold mb-1", config.accent)}>
                {phase === 'happy' ? config.title : (mood === 'angry' ? '😠' : '😢')}
              </h2>
              <p className="text-sm text-muted-foreground max-w-[250px]">
                {phase === 'happy'
                  ? config.subtitle
                  : `You've been away for ${daysAway} day${daysAway !== 1 ? 's' : ''}...`}
              </p>
            </motion.div>

            {/* Hearts */}
            {phase === 'happy' && (
              <motion.div
                className="flex items-center gap-1"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
              >
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 1, delay: i * 0.15, repeat: Infinity }}
                  >
                    <Heart className="h-4 w-4 text-destructive fill-destructive" />
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* CTA */}
            {phase === 'happy' && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                onClick={onDismiss}
                className="bg-primary text-primary-foreground font-semibold px-8 py-3 rounded-xl text-sm active:scale-95 transition-transform"
              >
                Let's get productive! 🚀
              </motion.button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
