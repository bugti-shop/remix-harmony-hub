import { Crown, Sparkles, Star, Shield, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BadgeRarity, JourneyBadge, RARITY_CONFIG } from '@/utils/virtualJourneyStorage';

export const MEDAL_COLORS: Record<BadgeRarity, { ring: string; bg: string; ribbon: string; inner: string; text: string }> = {
  legendary: { ring: 'from-yellow-400 via-amber-500 to-yellow-600', bg: 'bg-gradient-to-br from-yellow-500/20 to-amber-600/20', ribbon: 'bg-gradient-to-b from-amber-500 to-amber-700', inner: 'bg-gradient-to-br from-slate-800 to-slate-900', text: 'text-amber-400' },
  epic: { ring: 'from-purple-400 via-violet-500 to-purple-600', bg: 'bg-gradient-to-br from-purple-500/20 to-violet-600/20', ribbon: 'bg-gradient-to-b from-violet-500 to-violet-700', inner: 'bg-gradient-to-br from-slate-800 to-slate-900', text: 'text-violet-400' },
  rare: { ring: 'from-blue-400 via-cyan-500 to-blue-600', bg: 'bg-gradient-to-br from-blue-500/20 to-cyan-600/20', ribbon: 'bg-gradient-to-b from-blue-500 to-blue-700', inner: 'bg-gradient-to-br from-slate-800 to-slate-900', text: 'text-blue-400' },
  uncommon: { ring: 'from-emerald-400 via-green-500 to-emerald-600', bg: 'bg-gradient-to-br from-emerald-500/20 to-green-600/20', ribbon: 'bg-gradient-to-b from-emerald-500 to-emerald-700', inner: 'bg-gradient-to-br from-slate-800 to-slate-900', text: 'text-emerald-400' },
  common: { ring: 'from-zinc-300 via-zinc-400 to-zinc-500', bg: 'bg-gradient-to-br from-zinc-400/20 to-zinc-500/20', ribbon: 'bg-gradient-to-b from-zinc-400 to-zinc-600', inner: 'bg-gradient-to-br from-slate-800 to-slate-900', text: 'text-zinc-300' },
};

export const RarityIcon = ({ rarity, size = 'h-3.5 w-3.5' }: { rarity: BadgeRarity; size?: string }) => {
  switch (rarity) {
    case 'legendary': return <Crown className={cn(size, 'text-warning')} />;
    case 'epic': return <Sparkles className={cn(size, 'text-primary')} />;
    case 'rare': return <Star className={cn(size, 'text-primary')} />;
    case 'uncommon': return <Shield className={cn(size, 'text-success')} />;
    default: return <Award className={cn(size, 'text-muted-foreground')} />;
  }
};

export const MedalBadge = ({ badge, size = 'md', userName }: { badge: JourneyBadge; size?: 'sm' | 'md' | 'lg'; userName?: string }) => {
  const medal = MEDAL_COLORS[badge.rarity];
  const dims = size === 'lg' ? 'w-40 h-40' : size === 'md' ? 'w-20 h-20' : 'w-14 h-14';
  const iconSize = size === 'lg' ? 'text-5xl' : size === 'md' ? 'text-2xl' : 'text-lg';
  const ribbonW = size === 'lg' ? 'w-6' : size === 'md' ? 'w-3' : 'w-2';
  const ribbonH = size === 'lg' ? 'h-8' : size === 'md' ? 'h-4' : 'h-3';

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {/* Ribbon tails */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-0">
          <div className={cn(ribbonW, ribbonH, medal.ribbon, 'rounded-b-sm -rotate-12')} />
          <div className={cn(ribbonW, ribbonH, medal.ribbon, 'rounded-b-sm rotate-12')} />
        </div>
        {/* Outer ring */}
        <div className={cn(dims, 'rounded-full p-[3px] bg-gradient-to-br relative z-10', medal.ring)}>
          <div className="w-full h-full rounded-full p-[3px] bg-gradient-to-br from-white/20 to-transparent">
            <div className={cn('w-full h-full rounded-full flex items-center justify-center', medal.inner)}>
              <span className={iconSize}>{badge.icon}</span>
            </div>
          </div>
        </div>
      </div>
      {userName && size === 'lg' && (
        <p className={cn('text-xs font-bold mt-3 tracking-wide', medal.text)}>{userName}</p>
      )}
    </div>
  );
};

export const MiniMedalBadge = ({ badge }: { badge: JourneyBadge }) => {
  const config = RARITY_CONFIG[badge.rarity];
  const medal = MEDAL_COLORS[badge.rarity];
  return (
    <div className="flex flex-col items-center gap-1 w-14" title={`${badge.label} • ${badge.description}`}>
      <div className="relative">
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5 z-0">
          <div className={cn('w-1.5 h-2.5 rounded-b-sm -rotate-12 bg-gradient-to-b', medal.ring)} />
          <div className={cn('w-1.5 h-2.5 rounded-b-sm rotate-12 bg-gradient-to-b', medal.ring)} />
        </div>
        <div className={cn('w-11 h-11 rounded-full p-[2px] bg-gradient-to-br relative z-10', medal.ring)}>
          <div className="w-full h-full rounded-full p-[2px] bg-gradient-to-br from-white/20 to-transparent">
            <div className="w-full h-full rounded-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
              <span className="text-base">{badge.icon}</span>
            </div>
          </div>
        </div>
      </div>
      <span className="text-[8px] font-bold text-center leading-tight line-clamp-2 text-foreground">{badge.label}</span>
    </div>
  );
};
