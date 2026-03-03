import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, Shield, Sparkles, Star, Trophy, Crown, Share2, Edit3, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TodoLayout } from './TodoLayout';
import {
  ALL_JOURNEYS,
  loadJourneyData,
  getJourneyBadges,
  JourneyBadge,
  BadgeRarity,
  RARITY_CONFIG,
  VirtualJourneyData,
} from '@/utils/virtualJourneyStorage';
import { format } from 'date-fns';
import Confetti from 'react-confetti';
import { playAchievementSound } from '@/utils/gamificationSounds';
import { useUserProfile } from '@/hooks/useUserProfile';
import { shareImageBlob } from '@/utils/shareImage';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';

const RARITY_ORDER: BadgeRarity[] = ['legendary', 'epic', 'rare', 'uncommon', 'common'];

const RarityIcon = ({ rarity }: { rarity: BadgeRarity }) => {
  const size = 'h-3.5 w-3.5';
  switch (rarity) {
    case 'legendary': return <Crown className={cn(size, 'text-warning')} />;
    case 'epic': return <Sparkles className={cn(size, 'text-primary')} />;
    case 'rare': return <Star className={cn(size, 'text-primary')} />;
    case 'uncommon': return <Shield className={cn(size, 'text-success')} />;
    default: return <Award className={cn(size, 'text-muted-foreground')} />;
  }
};

// Medal-style badge colors inspired by rarity
const MEDAL_COLORS: Record<BadgeRarity, { ring: string; bg: string; ribbon: string; inner: string; text: string }> = {
  legendary: { ring: 'from-yellow-400 via-amber-500 to-yellow-600', bg: 'bg-gradient-to-br from-yellow-500/20 to-amber-600/20', ribbon: 'bg-gradient-to-b from-amber-500 to-amber-700', inner: 'bg-gradient-to-br from-slate-800 to-slate-900', text: 'text-amber-400' },
  epic: { ring: 'from-purple-400 via-violet-500 to-purple-600', bg: 'bg-gradient-to-br from-purple-500/20 to-violet-600/20', ribbon: 'bg-gradient-to-b from-violet-500 to-violet-700', inner: 'bg-gradient-to-br from-slate-800 to-slate-900', text: 'text-violet-400' },
  rare: { ring: 'from-blue-400 via-cyan-500 to-blue-600', bg: 'bg-gradient-to-br from-blue-500/20 to-cyan-600/20', ribbon: 'bg-gradient-to-b from-blue-500 to-blue-700', inner: 'bg-gradient-to-br from-slate-800 to-slate-900', text: 'text-blue-400' },
  uncommon: { ring: 'from-emerald-400 via-green-500 to-emerald-600', bg: 'bg-gradient-to-br from-emerald-500/20 to-green-600/20', ribbon: 'bg-gradient-to-b from-emerald-500 to-emerald-700', inner: 'bg-gradient-to-br from-slate-800 to-slate-900', text: 'text-emerald-400' },
  common: { ring: 'from-zinc-300 via-zinc-400 to-zinc-500', bg: 'bg-gradient-to-br from-zinc-400/20 to-zinc-500/20', ribbon: 'bg-gradient-to-b from-zinc-400 to-zinc-600', inner: 'bg-gradient-to-br from-slate-800 to-slate-900', text: 'text-zinc-300' },
};

// Medal badge component - looks like the gold/navy award badge
const MedalBadge = ({ badge, size = 'md', userName }: { badge: JourneyBadge; size?: 'sm' | 'md' | 'lg'; userName?: string }) => {
  const medal = MEDAL_COLORS[badge.rarity];
  const dims = size === 'lg' ? 'w-40 h-40' : size === 'md' ? 'w-20 h-20' : 'w-14 h-14';
  const iconSize = size === 'lg' ? 'text-5xl' : size === 'md' ? 'text-2xl' : 'text-lg';
  const ribbonW = size === 'lg' ? 'w-6' : size === 'md' ? 'w-3' : 'w-2';
  const ribbonH = size === 'lg' ? 'h-8' : size === 'md' ? 'h-4' : 'h-3';

  return (
    <div className="flex flex-col items-center">
      {/* Medal */}
      <div className="relative">
        {/* Ribbon tails */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-0">
          <div className={cn(ribbonW, ribbonH, medal.ribbon, 'rounded-b-sm -rotate-12')} />
          <div className={cn(ribbonW, ribbonH, medal.ribbon, 'rounded-b-sm rotate-12')} />
        </div>
        {/* Outer ring (gold/colored) */}
        <div className={cn(dims, 'rounded-full p-[3px] bg-gradient-to-br relative z-10', medal.ring)}>
          {/* Scalloped edge effect */}
          <div className="w-full h-full rounded-full p-[3px] bg-gradient-to-br from-white/20 to-transparent">
            {/* Inner dark circle */}
            <div className={cn('w-full h-full rounded-full flex items-center justify-center', medal.inner)}>
              <span className={iconSize}>{badge.icon}</span>
            </div>
          </div>
        </div>
      </div>
      {/* Name on medal */}
      {userName && size === 'lg' && (
        <p className={cn('text-xs font-bold mt-3 tracking-wide', medal.text)}>{userName}</p>
      )}
    </div>
  );
};

const JourneyBadges = () => {
  const [data, setData] = useState<VirtualJourneyData | null>(null);
  const [filter, setFilter] = useState<'all' | string>('all');
  const [selectedBadge, setSelectedBadge] = useState<JourneyBadge | null>(null);
  const [celebratingBadge, setCelebratingBadge] = useState<JourneyBadge | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [badgeName, setBadgeName] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const badgeCardRef = useRef<HTMLDivElement>(null);
  const { profile } = useUserProfile();

  const reload = () => setData(loadJourneyData());

  // Init badge name from profile
  useEffect(() => {
    if (profile.name) setBadgeName(profile.name);
  }, [profile.name]);

  useEffect(() => {
    reload();

    const milestoneHandler = (e: CustomEvent) => {
      const oldData = loadJourneyData();
      setTimeout(() => {
        const newData = loadJourneyData();
        const oldBadges = getJourneyBadges(oldData);
        const newBadges = getJourneyBadges(newData);

        if (newBadges.length > oldBadges.length) {
          const newBadge = newBadges.find(nb => !oldBadges.some(ob => ob.id === nb.id));
          if (newBadge) {
            setCelebratingBadge(newBadge);
            setShowConfetti(true);
            playAchievementSound();
            setTimeout(() => setShowConfetti(false), 4000);
            setTimeout(() => setCelebratingBadge(null), 5000);
          }
        }
        setData(newData);
      }, 100);
    };

    const tasksHandler = () => setTimeout(reload, 150);
    window.addEventListener('journeyMilestoneReached', milestoneHandler as EventListener);
    window.addEventListener('tasksUpdated', tasksHandler);
    return () => {
      window.removeEventListener('journeyMilestoneReached', milestoneHandler as EventListener);
      window.removeEventListener('tasksUpdated', tasksHandler);
    };
  }, []);

  const allBadges = useMemo(() => (data ? getJourneyBadges(data) : []), [data]);
  const filteredBadges = useMemo(() => filter === 'all' ? allBadges : allBadges.filter(b => b.journeyId === filter), [allBadges, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, JourneyBadge[]>();
    for (const badge of filteredBadges) {
      if (!map.has(badge.journeyId)) map.set(badge.journeyId, []);
      map.get(badge.journeyId)!.push(badge);
    }
    return map;
  }, [filteredBadges]);

  const rarityCounts = useMemo(() => {
    const counts: Record<BadgeRarity, number> = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    allBadges.forEach(b => counts[b.rarity]++);
    return counts;
  }, [allBadges]);

  const journeysWithBadges = useMemo(() => {
    const ids = new Set(allBadges.map(b => b.journeyId));
    return ALL_JOURNEYS.filter(j => ids.has(j.id));
  }, [allBadges]);

  const handleShareBadge = useCallback(async () => {
    if (!badgeCardRef.current || !selectedBadge) return;
    setIsSharing(true);
    try {
      const canvas = await html2canvas(badgeCardRef.current, {
        backgroundColor: null,
        scale: 3,
        useCORS: true,
      });
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Failed')), 'image/png');
      });
      await shareImageBlob({
        blob,
        fileName: `badge-${selectedBadge.id}.png`,
        title: `${selectedBadge.label} Badge`,
        text: `I earned the "${selectedBadge.label}" badge on my ${selectedBadge.journeyName} journey! 🏅`,
        dialogTitle: 'Share Badge',
      });
    } catch (err) {
      if ((err as Error)?.message !== 'Share canceled') {
        toast.error('Failed to share badge');
      }
    } finally {
      setIsSharing(false);
    }
  }, [selectedBadge]);

  if (!data) return null;

  return (
    <TodoLayout title="Journey Badges">
      {/* Confetti overlay */}
      {showConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={250}
          gravity={0.15}
          style={{ position: 'fixed', top: 0, left: 0, zIndex: 120, pointerEvents: 'none' }}
        />
      )}

      {/* Badge unlock celebration overlay */}
      <AnimatePresence>
        {celebratingBadge && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[115] flex items-center justify-center bg-background/80 backdrop-blur-sm"
            onClick={() => setCelebratingBadge(null)}
          >
            <motion.div
              initial={{ scale: 0, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 12 }}
              className="flex flex-col items-center gap-4 p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative">
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 0.8, repeat: 2 }}
                >
                  <MedalBadge badge={celebratingBadge} size="lg" userName={badgeName} />
                </motion.div>
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0.5, opacity: 0.8 }}
                    animate={{ scale: 2.5, opacity: 0 }}
                    transition={{ duration: 1.5, delay: i * 0.3, repeat: Infinity }}
                    className="absolute inset-0 rounded-full border-2 border-warning"
                    style={{ margin: '-20%' }}
                  />
                ))}
              </div>

              <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-2xl font-bold text-foreground">
                {celebratingBadge.type === 'journey_complete' ? '🏆 Journey Conquered!' : '🎖️ New Badge!'}
              </motion.h2>
              <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="text-lg font-semibold text-warning">
                {celebratingBadge.label}
              </motion.p>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-sm text-muted-foreground text-center max-w-[280px]">
                {celebratingBadge.description}
              </motion.p>
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.75 }}>
                {(() => {
                  const config = RARITY_CONFIG[celebratingBadge.rarity];
                  return (
                    <span className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold', config.bg, config.color)}>
                      <RarityIcon rarity={celebratingBadge.rarity} />
                      {config.label} Badge
                    </span>
                  );
                })()}
              </motion.div>
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} onClick={() => setCelebratingBadge(null)} className="mt-2 text-xs text-muted-foreground">
                Tap to continue
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-6 space-y-5">
        {/* Header Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl p-5 border shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center">
              <Award className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-base">Badge Collection</h2>
              <p className="text-xs text-muted-foreground">{allBadges.length} badges earned</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {RARITY_ORDER.map(r => {
              const count = rarityCounts[r];
              if (count === 0) return null;
              const config = RARITY_CONFIG[r];
              return (
                <div key={r} className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold', config.bg, config.color)}>
                  <RarityIcon rarity={r} />
                  <span>{count} {config.label}</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Journey filter chips */}
        {journeysWithBadges.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button onClick={() => setFilter('all')} className={cn('flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all', filter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border')}>All</button>
            {journeysWithBadges.map(j => (
              <button key={j.id} onClick={() => setFilter(j.id)} className={cn('flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5', filter === j.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border')}>
                <span>{j.emoji}</span><span>{j.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {allBadges.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card rounded-2xl p-8 border text-center">
            <Award className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="font-semibold text-sm text-muted-foreground">No badges yet</h3>
            <p className="text-xs text-muted-foreground/70 mt-1">Start a virtual journey and complete milestones to earn badges!</p>
          </motion.div>
        )}

        {/* Grouped badges - medal style grid */}
        {Array.from(grouped.entries()).map(([journeyId, badges]) => {
          const journey = ALL_JOURNEYS.find(j => j.id === journeyId);
          if (!journey) return null;
          const sorted = [...badges].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));

          return (
            <motion.div key={journeyId} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              {filter === 'all' && (
                <div className="flex items-center gap-2">
                  <span className="text-lg">{journey.emoji}</span>
                  <h3 className="font-bold text-sm text-foreground">{journey.name}</h3>
                  <span className="text-[10px] text-muted-foreground ml-auto">{badges.length} badge{badges.length !== 1 ? 's' : ''}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {sorted.map((badge, i) => {
                  const config = RARITY_CONFIG[badge.rarity];
                  const medalColors = MEDAL_COLORS[badge.rarity];
                  const isNewlyEarned = celebratingBadge?.id === badge.id;
                  return (
                    <motion.button
                      key={badge.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: isNewlyEarned ? [1, 1.05, 1] : 1 }}
                      transition={{ delay: i * 0.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => { setSelectedBadge(badge); setEditingName(false); }}
                      className={cn(
                        'relative text-center rounded-2xl p-4 border shadow-sm transition-all hover:shadow-md overflow-hidden',
                        medalColors.bg,
                        badge.type === 'journey_complete' && 'border-warning/40',
                        isNewlyEarned && 'ring-2 ring-warning/50'
                      )}
                    >
                      {/* Medal */}
                      <div className="flex justify-center mb-2.5">
                        <MedalBadge badge={badge} size="md" />
                      </div>
                      <p className="font-bold text-xs text-foreground truncate">{badge.label}</p>
                      <div className={cn('flex items-center justify-center gap-1 mt-1 text-[9px] font-bold', config.color)}>
                        <RarityIcon rarity={badge.rarity} />
                        {config.label}
                      </div>
                      {badge.earnedAt && (
                        <p className="text-[9px] text-muted-foreground/60 mt-1.5">{format(new Date(badge.earnedAt), 'MMM d, yyyy')}</p>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Badge Detail Modal with name + share */}
      <AnimatePresence>
        {selectedBadge && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
            onClick={() => setSelectedBadge(null)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 30 }}
              transition={{ type: 'spring', damping: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm"
            >
              {/* Shareable badge card */}
              <div
                ref={badgeCardRef}
                className={cn(
                  'rounded-2xl p-6 border shadow-lg text-center relative overflow-hidden',
                  MEDAL_COLORS[selectedBadge.rarity].bg,
                  'bg-card'
                )}
                style={{ background: 'linear-gradient(145deg, hsl(var(--card)) 0%, hsl(var(--card)) 60%, hsl(var(--muted)) 100%)' }}
              >
                {/* Decorative corner accents */}
                <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-warning/20 rounded-tl-2xl" />
                <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-warning/20 rounded-tr-2xl" />
                <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-warning/20 rounded-bl-2xl" />
                <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-warning/20 rounded-br-2xl" />

                {/* Medal */}
                <div className="flex justify-center mb-4">
                  <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.5, repeat: Infinity, repeatType: 'reverse' }}>
                    <MedalBadge badge={selectedBadge} size="lg" userName={badgeName || undefined} />
                  </motion.div>
                </div>

                <h3 className="font-bold text-lg text-foreground mb-1">{selectedBadge.label}</h3>

                <div className="flex items-center justify-center gap-1.5 mb-3">
                  {(() => {
                    const config = RARITY_CONFIG[selectedBadge.rarity];
                    return (
                      <span className={cn('flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold', config.bg, config.color)}>
                        <RarityIcon rarity={selectedBadge.rarity} />
                        {config.label}
                      </span>
                    );
                  })()}
                </div>

                <p className="text-sm text-muted-foreground mb-2">{selectedBadge.description}</p>

                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/70">
                  <span>{ALL_JOURNEYS.find(j => j.id === selectedBadge.journeyId)?.emoji}</span>
                  <span>{selectedBadge.journeyName}</span>
                </div>

                {/* User name on badge */}
                <div className="mt-4 pt-3 border-t border-border/40">
                  {editingName ? (
                    <div className="flex items-center gap-2 justify-center">
                      <input
                        type="text"
                        value={badgeName}
                        onChange={(e) => setBadgeName(e.target.value)}
                        placeholder="Enter your name"
                        className="bg-muted/50 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground text-center w-44 outline-none focus:ring-1 focus:ring-primary"
                        autoFocus
                        maxLength={30}
                        onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}
                      />
                      <button onClick={() => setEditingName(false)} className="p-1.5 rounded-lg bg-primary/10 text-primary">
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setEditingName(true)} className="flex items-center gap-1.5 mx-auto text-sm text-foreground/80 hover:text-foreground transition-colors">
                      <span className="font-semibold">{badgeName || 'Add your name'}</span>
                      <Edit3 className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>

                {selectedBadge.earnedAt && (
                  <p className="text-[10px] text-muted-foreground/50 mt-3">
                    Earned {format(new Date(selectedBadge.earnedAt), 'MMMM d, yyyy')}
                  </p>
                )}
              </div>

              {/* Action buttons outside card (not captured in screenshot) */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleShareBadge}
                  disabled={isSharing}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
                >
                  <Share2 className="h-4 w-4" />
                  {isSharing ? 'Sharing...' : 'Share Badge'}
                </button>
                <button
                  onClick={() => setSelectedBadge(null)}
                  className="flex-1 py-2.5 rounded-xl bg-muted text-sm font-semibold text-foreground"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </TodoLayout>
  );
};

export default JourneyBadges;
