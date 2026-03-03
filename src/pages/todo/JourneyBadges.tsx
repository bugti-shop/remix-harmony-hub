import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, Shield, Sparkles, Star, Trophy, Crown } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';

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

const JourneyBadges = () => {
  const [data, setData] = useState<VirtualJourneyData | null>(null);
  const [filter, setFilter] = useState<'all' | string>('all');
  const [selectedBadge, setSelectedBadge] = useState<JourneyBadge | null>(null);

  useEffect(() => {
    setData(loadJourneyData());
  }, []);

  const allBadges = useMemo(() => (data ? getJourneyBadges(data) : []), [data]);

  const filteredBadges = useMemo(() => {
    if (filter === 'all') return allBadges;
    return allBadges.filter(b => b.journeyId === filter);
  }, [allBadges, filter]);

  // Group by journey
  const grouped = useMemo(() => {
    const map = new Map<string, JourneyBadge[]>();
    for (const badge of filteredBadges) {
      const key = badge.journeyId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(badge);
    }
    return map;
  }, [filteredBadges]);

  // Rarity stats
  const rarityCounts = useMemo(() => {
    const counts: Record<BadgeRarity, number> = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    allBadges.forEach(b => counts[b.rarity]++);
    return counts;
  }, [allBadges]);

  // Journeys that have progress
  const journeysWithBadges = useMemo(() => {
    const ids = new Set(allBadges.map(b => b.journeyId));
    return ALL_JOURNEYS.filter(j => ids.has(j.id));
  }, [allBadges]);

  if (!data) return null;

  return (
    <TodoLayout title="Journey Badges">
      <div className="container mx-auto px-4 py-6 space-y-5">

        {/* Header Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-5 border shadow-sm"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center">
              <Award className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-base">Badge Collection</h2>
              <p className="text-xs text-muted-foreground">{allBadges.length} badges earned</p>
            </div>
          </div>

          {/* Rarity breakdown */}
          <div className="flex gap-2 flex-wrap">
            {RARITY_ORDER.map(r => {
              const count = rarityCounts[r];
              if (count === 0) return null;
              const config = RARITY_CONFIG[r];
              return (
                <div
                  key={r}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold',
                    config.bg, config.color
                  )}
                >
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
            <button
              onClick={() => setFilter('all')}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                filter === 'all'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border'
              )}
            >
              All
            </button>
            {journeysWithBadges.map(j => (
              <button
                key={j.id}
                onClick={() => setFilter(j.id)}
                className={cn(
                  'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5',
                  filter === j.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border'
                )}
              >
                <span>{j.emoji}</span>
                <span>{j.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {allBadges.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card rounded-2xl p-8 border text-center"
          >
            <Award className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="font-semibold text-sm text-muted-foreground">No badges yet</h3>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Start a virtual journey and complete milestones to earn badges!
            </p>
          </motion.div>
        )}

        {/* Grouped badges */}
        {Array.from(grouped.entries()).map(([journeyId, badges]) => {
          const journey = ALL_JOURNEYS.find(j => j.id === journeyId);
          if (!journey) return null;

          // Sort by rarity (rarest first)
          const sorted = [...badges].sort((a, b) =>
            RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
          );

          return (
            <motion.div
              key={journeyId}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              {/* Journey header */}
              {filter === 'all' && (
                <div className="flex items-center gap-2">
                  <span className="text-lg">{journey.emoji}</span>
                  <h3 className="font-bold text-sm text-foreground">{journey.name}</h3>
                  <span className="text-[10px] text-muted-foreground ml-auto">{badges.length} badge{badges.length !== 1 ? 's' : ''}</span>
                </div>
              )}

              {/* Badge grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {sorted.map((badge, i) => {
                  const config = RARITY_CONFIG[badge.rarity];
                  return (
                    <motion.button
                      key={badge.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setSelectedBadge(badge)}
                      className={cn(
                        'text-left bg-card rounded-xl p-3.5 border shadow-sm transition-all hover:shadow-md',
                        badge.type === 'journey_complete' && 'border-warning/30 bg-warning/5'
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-2xl">{badge.icon}</span>
                        <div className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold', config.bg, config.color)}>
                          <RarityIcon rarity={badge.rarity} />
                          {config.label}
                        </div>
                      </div>
                      <p className="font-semibold text-xs text-foreground truncate">{badge.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{badge.description}</p>
                      {badge.earnedAt && (
                        <p className="text-[9px] text-muted-foreground/60 mt-2">
                          {format(new Date(badge.earnedAt), 'MMM d, yyyy')}
                        </p>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Badge Detail Modal */}
      <AnimatePresence>
        {selectedBadge && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6"
            onClick={() => setSelectedBadge(null)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 30 }}
              transition={{ type: 'spring', damping: 15 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'bg-card rounded-2xl p-6 border shadow-lg w-full max-w-sm text-center',
                selectedBadge.type === 'journey_complete' && 'border-warning/30'
              )}
            >
              <motion.div
                animate={{ scale: [1, 1.15, 1], rotate: [0, -5, 5, 0] }}
                transition={{ duration: 0.6 }}
                className="text-6xl mb-4"
              >
                {selectedBadge.icon}
              </motion.div>

              <h3 className="font-bold text-lg text-foreground mb-1">{selectedBadge.label}</h3>

              <div className="flex items-center justify-center gap-1.5 mb-3">
                {(() => {
                  const config = RARITY_CONFIG[selectedBadge.rarity];
                  return (
                    <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold', config.bg, config.color)}>
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

              {selectedBadge.earnedAt && (
                <p className="text-[10px] text-muted-foreground/50 mt-3">
                  Earned {format(new Date(selectedBadge.earnedAt), 'MMMM d, yyyy')}
                </p>
              )}

              <button
                onClick={() => setSelectedBadge(null)}
                className="mt-5 w-full py-2.5 rounded-xl bg-muted text-sm font-semibold text-foreground"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </TodoLayout>
  );
};

export default JourneyBadges;
