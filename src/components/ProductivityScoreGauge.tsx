import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { calculateProductivityScore, type ProductivityScore } from '@/utils/productivityScore';

const GAUGE_SIZE = 160;
const STROKE_WIDTH = 10;
const RADIUS = (GAUGE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const BREAKDOWN_LABELS: { key: keyof ProductivityScore['breakdown']; label: string; max: number; color: string }[] = [
  { key: 'streak', label: 'Streak', max: 30, color: 'bg-streak' },
  { key: 'weeklyTasks', label: 'Weekly Tasks', max: 25, color: 'bg-info' },
  { key: 'challenges', label: 'Challenges', max: 20, color: 'bg-success' },
  { key: 'consistency', label: 'Consistency', max: 15, color: 'bg-warning' },
  { key: 'usage', label: 'App Usage', max: 10, color: 'bg-primary' },
];

export const ProductivityScoreGauge = () => {
  const [score, setScore] = useState<ProductivityScore | null>(null);
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    const load = async () => {
      const s = await calculateProductivityScore();
      setScore(s);
      // Animate the value up
      let current = 0;
      const step = s.total / 40;
      const interval = setInterval(() => {
        current += step;
        if (current >= s.total) {
          current = s.total;
          clearInterval(interval);
        }
        setAnimatedValue(Math.round(current));
      }, 25);
    };
    load();
  }, []);

  if (!score) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-10 h-10 rounded-full border-2 border-muted-foreground/20 border-t-primary animate-spin" />
      </div>
    );
  }

  const offset = CIRCUMFERENCE - (animatedValue / 100) * CIRCUMFERENCE;

  const getStrokeColor = (val: number): string => {
    if (val >= 80) return 'hsl(var(--success))';
    if (val >= 60) return 'hsl(var(--info))';
    if (val >= 40) return 'hsl(var(--warning))';
    return 'hsl(var(--destructive))';
  };

  return (
    <div className="w-full bg-card rounded-2xl border shadow-sm p-5">
      {/* Header */}
      <h3 className="text-sm font-semibold text-center mb-4">Productivity Score</h3>

      {/* Circular gauge */}
      <div className="flex justify-center mb-5">
        <div className="relative" style={{ width: GAUGE_SIZE, height: GAUGE_SIZE }}>
          <svg
            width={GAUGE_SIZE}
            height={GAUGE_SIZE}
            className="transform -rotate-90"
          >
            {/* Background track */}
            <circle
              cx={GAUGE_SIZE / 2}
              cy={GAUGE_SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth={STROKE_WIDTH}
            />
            {/* Animated progress */}
            <motion.circle
              cx={GAUGE_SIZE / 2}
              cy={GAUGE_SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={getStrokeColor(animatedValue)}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              initial={{ strokeDashoffset: CIRCUMFERENCE }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              className="text-4xl font-black"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            >
              {animatedValue}
            </motion.span>
            <motion.span
              className={cn("text-lg font-bold -mt-1", score.gradeColor)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              {score.grade}
            </motion.span>
          </div>
        </div>
      </div>

      {/* Breakdown bars */}
      <div className="space-y-2.5">
        {BREAKDOWN_LABELS.map((item, i) => {
          const val = score.breakdown[item.key];
          const pct = (val / item.max) * 100;
          return (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.08 }}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-medium text-muted-foreground">{item.label}</span>
                <span className="text-[10px] font-bold text-muted-foreground">{val}/{item.max}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <motion.div
                  className={cn("h-1.5 rounded-full", item.color)}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, delay: 0.5 + i * 0.08, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="text-[9px] text-muted-foreground text-center mt-3">
        Updated daily · Keep improving your score!
      </p>
    </div>
  );
};
