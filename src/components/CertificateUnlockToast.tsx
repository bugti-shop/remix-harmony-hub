import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Shield, Star, Award, Crown, Gem } from 'lucide-react';

interface CertificateUnlockToastProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accentColor: string;
}

export const CertificateUnlockToast = ({ icon, title, subtitle, accentColor }: CertificateUnlockToastProps) => {
  return (
    <div className="flex items-center gap-3">
      {/* Animated certificate icon */}
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: [0, 1.25, 1], rotate: [-20, 8, 0] }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 relative"
        style={{ backgroundColor: `${accentColor}20` }}
      >
        <span style={{ color: accentColor }}>{icon}</span>
        {/* Pulse ring */}
        <motion.div
          initial={{ scale: 0.8, opacity: 1 }}
          animate={{ scale: 2.2, opacity: 0 }}
          transition={{ duration: 0.9, delay: 0.2 }}
          className="absolute inset-0 rounded-xl border-2"
          style={{ borderColor: accentColor }}
        />
      </motion.div>

      <div className="flex-1 min-w-0">
        <motion.p
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="font-bold text-sm text-foreground"
        >
          🎓 Certificate Unlocked!
        </motion.p>
        <motion.p
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="text-xs text-muted-foreground truncate"
        >
          {title} — {subtitle}
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-[10px] text-muted-foreground/60 mt-0.5"
        >
          Tap Certificates to view & share
        </motion.p>
      </div>
    </div>
  );
};

interface AchievementUnlockToastProps {
  icon: string;
  name: string;
  description: string;
  category: string;
}

export const AchievementUnlockToast = ({ icon, name, description, category }: AchievementUnlockToastProps) => {
  const categoryColors: Record<string, string> = {
    streak: 'text-warning bg-warning/10',
    tasks: 'text-success bg-success/10',
    consistency: 'text-primary bg-primary/10',
    special: 'text-accent-foreground bg-accent',
  };

  return (
    <div className="flex items-center gap-3">
      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: [0, 1.3, 1], rotate: [-30, 10, 0] }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center text-2xl flex-shrink-0 relative"
      >
        {icon}
        <motion.div
          initial={{ scale: 0.8, opacity: 1 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute inset-0 rounded-xl border-2 border-warning"
        />
      </motion.div>

      <div className="flex-1 min-w-0">
        <motion.p
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="font-bold text-sm text-foreground"
        >
          🏅 Achievement Unlocked!
        </motion.p>
        <motion.p
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="text-xs text-muted-foreground truncate"
        >
          {name}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-1"
        >
          <span className={cn('px-1.5 py-0.5 rounded-md text-[9px] font-bold capitalize', categoryColors[category] || 'bg-muted text-muted-foreground')}>
            {category}
          </span>
        </motion.div>
      </div>
    </div>
  );
};
