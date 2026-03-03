/**
 * Full-Screen Streak Milestone Celebration
 * Appears globally when users hit 3, 7, 14, 30, 60, 100, 365 day streaks
 * Animated logo, confetti, and Instagram Stories share card
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, X, Instagram, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { triggerHaptic, triggerNotificationHaptic } from '@/utils/haptics';
import Confetti from 'react-confetti';
import appLogo from '@/assets/npd-reminder-logo.png';
import html2canvas from 'html2canvas';
import { useUserProfile } from '@/hooks/useUserProfile';
import { CardBrandingFooterLarge } from '@/components/CardBranding';

const MILESTONE_CONFIG: Record<number, { emoji: string; title: string; subtitle: string; gradient: string; glow: string }> = {
  3: {
    emoji: '⚡',
    title: 'Spark Ignited',
    subtitle: 'The habit is forming!',
    gradient: 'linear-gradient(160deg, hsl(200, 80%, 12%), hsl(210, 70%, 18%), hsl(220, 60%, 22%))',
    glow: 'hsl(200, 80%, 50%)',
  },
  7: {
    emoji: '🔥',
    title: 'One Week Strong',
    subtitle: 'You\'re building something real.',
    gradient: 'linear-gradient(160deg, hsl(25, 80%, 10%), hsl(15, 70%, 15%), hsl(5, 60%, 18%))',
    glow: 'hsl(25, 95%, 53%)',
  },
  14: {
    emoji: '💪',
    title: 'Two Weeks of Power',
    subtitle: 'Discipline is becoming identity.',
    gradient: 'linear-gradient(160deg, hsl(142, 60%, 8%), hsl(150, 50%, 12%), hsl(160, 45%, 16%))',
    glow: 'hsl(142, 71%, 45%)',
  },
  30: {
    emoji: '👑',
    title: 'Monthly Champion',
    subtitle: 'One full month. Unstoppable.',
    gradient: 'linear-gradient(160deg, hsl(270, 60%, 10%), hsl(280, 55%, 15%), hsl(290, 50%, 18%))',
    glow: 'hsl(271, 70%, 60%)',
  },
  60: {
    emoji: '💎',
    title: 'Diamond Discipline',
    subtitle: 'Two months of pure consistency.',
    gradient: 'linear-gradient(160deg, hsl(200, 70%, 8%), hsl(210, 65%, 12%), hsl(220, 60%, 16%))',
    glow: 'hsl(217, 91%, 60%)',
  },
  100: {
    emoji: '🏆',
    title: 'Century Legend',
    subtitle: '100 days. Top 1% productivity.',
    gradient: 'linear-gradient(160deg, hsl(40, 70%, 8%), hsl(35, 65%, 12%), hsl(30, 60%, 15%))',
    glow: 'hsl(43, 100%, 55%)',
  },
  365: {
    emoji: '🌟',
    title: 'Year of Mastery',
    subtitle: '365 days. Absolute legend.',
    gradient: 'linear-gradient(160deg, hsl(45, 100%, 10%), hsl(40, 90%, 15%), hsl(35, 80%, 18%))',
    glow: 'hsl(43, 100%, 60%)',
  },
};

export const StreakMilestoneCelebration = () => {
  const [milestone, setMilestone] = useState<number | null>(null);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [isSharing, setIsSharing] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const { profile } = useUserProfile();

  // Listen for milestone events globally
  useEffect(() => {
    const handleMilestone = (e: CustomEvent<{ milestone: number }>) => {
      const m = e.detail.milestone;
      if (MILESTONE_CONFIG[m]) {
        setMilestone(m);
        triggerNotificationHaptic('success').catch(() => {});
      }
    };

    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });

    window.addEventListener('streakMilestone', handleMilestone as EventListener);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('streakMilestone', handleMilestone as EventListener);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleClose = useCallback(() => {
    setMilestone(null);
  }, []);

  const handleShare = useCallback(async () => {
    if (!shareCardRef.current) return;
    setIsSharing(true);
    triggerHaptic('medium').catch(() => {});

    try {
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: null,
        scale: 3,
        useCORS: true,
        logging: false,
      });

      canvas.toBlob(async (blob) => {
        if (!blob) { setIsSharing(false); return; }
        const file = new File([blob], `npd-streak-${milestone}.png`, { type: 'image/png' });

        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({
              title: `${milestone}-Day Streak on Npd!`,
              text: `I'm on a ${milestone} day productivity streak on Npd! 🔥`,
              files: [file],
            });
          } catch { /* user cancelled */ }
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `npd-streak-${milestone}-days.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
        setIsSharing(false);
      }, 'image/png');
    } catch {
      setIsSharing(false);
    }
  }, [milestone]);

  if (!milestone) return null;

  const config = MILESTONE_CONFIG[milestone];
  if (!config) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={milestone}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center"
        style={{ background: config.gradient }}
      >
        {/* Confetti */}
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={true}
          numberOfPieces={250}
          gravity={0.15}
          colors={['#FF6B35', '#FFD700', '#FF4444', '#44FF44', '#4488FF', '#FF44FF', '#FFFFFF']}
        />

        {/* Radial glow behind logo */}
        <motion.div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{ width: 300, height: 300, background: config.glow, opacity: 0.15 }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.25, 0.1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-white/10 transition-colors"
          style={{ color: 'hsl(0,0%,60%)' }}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Main content */}
        <div className="relative z-10 flex flex-col items-center text-center px-6 w-full max-w-sm">
          {/* Emoji burst */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            className="text-5xl mb-4"
          >
            {config.emoji}
          </motion.div>

          {/* Animated Npd Logo */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 150, damping: 12, delay: 0.2 }}
            className="relative mb-6"
          >
            {/* Glow ring */}
            <motion.div
              className="absolute inset-0 rounded-3xl"
              style={{ boxShadow: `0 0 40px 10px ${config.glow}50, 0 0 80px 20px ${config.glow}25` }}
              animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.img
              src={appLogo}
              alt="Npd"
              className="w-24 h-24 rounded-3xl relative z-10 shadow-2xl"
              animate={{
                y: [0, -8, 0],
                rotate: [0, -3, 3, 0],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{ border: `3px solid ${config.glow}60` }}
            />
          </motion.div>

          {/* Streak Number */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 180, delay: 0.4 }}
          >
            <motion.p
              className="font-black leading-none"
              style={{
                fontSize: milestone >= 100 ? '6rem' : '7rem',
                color: 'hsl(0,0%,100%)',
                textShadow: `0 0 40px ${config.glow}60, 0 0 80px ${config.glow}30`,
              }}
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              {milestone}
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="text-xl font-bold -mt-2"
              style={{ color: config.glow }}
            >
              day streak
            </motion.p>
          </motion.div>

          {/* Title & Subtitle */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-4 mb-8"
          >
            <h2 className="text-2xl font-black" style={{ color: 'hsl(0,0%,100%)' }}>
              {config.title}
            </h2>
            <p className="text-sm mt-1" style={{ color: 'hsl(0,0%,100%,0.6)' }}>
              {config.subtitle}
            </p>
          </motion.div>

          {/* Share Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="w-full space-y-3"
          >
            <Button
              onClick={handleShare}
              disabled={isSharing}
              size="lg"
              className="w-full text-sm"
              style={{
                background: config.glow,
                borderColor: config.glow,
                color: 'hsl(0,0%,5%)',
              }}
            >
              <Share2 className="h-4 w-4 mr-2" />
              {isSharing ? 'Generating...' : 'Share to Instagram Stories'}
            </Button>

            <button
              onClick={handleClose}
              className="w-full py-3 text-sm font-medium rounded-xl transition-colors"
              style={{ color: 'hsl(0,0%,100%,0.5)' }}
            >
              Continue
            </button>
          </motion.div>
        </div>

        {/* Hidden shareable card for html2canvas */}
        <div className="fixed -left-[9999px] top-0">
          <div ref={shareCardRef}>
            <ShareCard milestone={milestone} config={config} userName={profile.name} userAvatar={profile.avatarUrl} />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

/* ============================================
   SHAREABLE IMAGE CARD
   ============================================ */

const ShareCard = ({
  milestone,
  config,
  userName,
  userAvatar,
}: {
  milestone: number;
  config: typeof MILESTONE_CONFIG[number];
  userName?: string;
  userAvatar?: string;
}) => (
  <div
    className="w-[1080px] h-[1920px] relative overflow-hidden flex flex-col items-center justify-center"
    style={{ background: config.gradient }}
  >
    {/* Glow orbs */}
    <div
      className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl"
      style={{ background: config.glow, opacity: 0.12 }}
    />
    <div
      className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full blur-3xl"
      style={{ background: config.glow, opacity: 0.08 }}
    />

    {/* Content */}
    <div className="relative z-10 flex flex-col items-center text-center px-16">
      {/* Emoji */}
      <div style={{ fontSize: '80px', marginBottom: '40px' }}>{config.emoji}</div>

      {/* Logo */}
      <img
        src={appLogo}
        alt="Npd"
        style={{
          width: '160px',
          height: '160px',
          borderRadius: '40px',
          border: `4px solid ${config.glow}60`,
          marginBottom: '60px',
        }}
      />

      {/* Streak text */}
      <p
        style={{
          fontSize: milestone >= 100 ? '220px' : '260px',
          fontWeight: 900,
          color: 'white',
          lineHeight: 0.9,
          textShadow: `0 0 60px ${config.glow}40`,
        }}
      >
        {milestone}
      </p>
      <p
        style={{
          fontSize: '48px',
          fontWeight: 700,
          color: config.glow,
          marginTop: '-10px',
          marginBottom: '40px',
        }}
      >
        day streak
      </p>

      {/* Message */}
      <p
        style={{
          fontSize: '42px',
          fontWeight: 800,
          color: 'white',
          lineHeight: 1.3,
          maxWidth: '700px',
        }}
      >
        I'm on a {milestone} day productivity streak!
      </p>
      <p
        style={{
          fontSize: '28px',
          color: 'rgba(255,255,255,0.5)',
          marginTop: '20px',
        }}
      >
        {config.title}
      </p>

      {/* User profile + Branding */}
      <CardBrandingFooterLarge color="rgba(255,255,255,0.4)" userName={userName} userAvatar={userAvatar} />
    </div>
  </div>
);
