import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Zap } from 'lucide-react';

interface ComboEvent {
  combo: number;
  multiplier: number;
  bonusXp: number;
  isNewCombo: boolean;
}

const COMBO_COLORS: Record<number, string> = {
  2: 'text-info',
  3: 'text-success',
  4: 'text-warning',
  5: 'text-streak',
};

const COMBO_GLOW: Record<number, string> = {
  2: 'hsl(var(--info))',
  3: 'hsl(var(--success))',
  4: 'hsl(var(--warning))',
  5: 'hsl(var(--streak))',
};

export const ComboOverlay = () => {
  const [comboData, setComboData] = useState<ComboEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: CustomEvent<ComboEvent>) => {
      setComboData(e.detail);
      setVisible(true);
      // Auto-hide after 1.5s
      setTimeout(() => setVisible(false), 1500);
    };

    window.addEventListener('comboHit', handler as EventListener);
    return () => window.removeEventListener('comboHit', handler as EventListener);
  }, []);

  const multiplier = comboData?.multiplier ?? 2;
  const colorClass = COMBO_COLORS[multiplier] || COMBO_COLORS[5];
  const glowColor = COMBO_GLOW[multiplier] || COMBO_GLOW[5];

  return (
    <AnimatePresence>
      {visible && comboData && (
        <motion.div
          key={`combo-${comboData.combo}-${Date.now()}`}
          initial={{ opacity: 0, scale: 0.3, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.5, y: -60 }}
          transition={{
            type: 'spring',
            damping: 10,
            stiffness: 300,
          }}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-[90] pointer-events-none flex flex-col items-center"
        >
          {/* Glow pulse */}
          <motion.div
            className="absolute inset-0 rounded-full blur-2xl"
            style={{ backgroundColor: glowColor, opacity: 0.3 }}
            animate={{ scale: [1, 2, 1.5], opacity: [0.3, 0.5, 0] }}
            transition={{ duration: 1.2 }}
          />

          {/* Main combo text */}
          <motion.div
            className="relative flex items-center gap-2"
            animate={{
              scale: [1, 1.15, 1],
              rotate: [0, -2, 2, 0],
            }}
            transition={{ duration: 0.5 }}
          >
            <Zap className={cn("h-8 w-8 fill-current", colorClass)} />
            <span className={cn(
              "text-4xl font-black tracking-tight drop-shadow-lg",
              colorClass
            )}>
              COMBO x{multiplier}!
            </span>
            <Zap className={cn("h-8 w-8 fill-current", colorClass)} />
          </motion.div>

          {/* Bonus XP badge */}
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-2 bg-card/90 backdrop-blur-sm border rounded-full px-3 py-1 shadow-md"
          >
            <span className={cn("text-xs font-bold", colorClass)}>
              +{comboData.bonusXp} bonus XP
            </span>
          </motion.div>

          {/* Flying particles */}
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={i}
              className={cn("absolute w-2 h-2 rounded-full", colorClass.replace('text-', 'bg-'))}
              initial={{ x: 0, y: 0, opacity: 1 }}
              animate={{
                x: (Math.random() - 0.5) * 150,
                y: (Math.random() - 0.5) * 100 - 30,
                opacity: 0,
                scale: 0,
              }}
              transition={{ duration: 0.8, delay: i * 0.05, ease: 'easeOut' }}
              style={{ top: '50%', left: '50%' }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
