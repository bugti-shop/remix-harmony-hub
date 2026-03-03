import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Trophy, Lock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ALL_ACHIEVEMENTS,
  Achievement,
  loadAchievementsData,
  AchievementsData,
} from '@/utils/gamificationStorage';
import { playAchievementSound } from '@/utils/gamificationSounds';

import Confetti from 'react-confetti';

interface AchievementBadgesProps {
  compact?: boolean;
}

export const AchievementBadges = ({ compact = false }: AchievementBadgesProps) => {
  const { t } = useTranslation();
  const [achievementsData, setAchievementsData] = useState<AchievementsData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'streak' | 'tasks' | 'consistency' | 'special'>('all');
  const [unlockedAchievement, setUnlockedAchievement] = useState<Achievement | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const data = await loadAchievementsData();
      setAchievementsData(data);
    };
    loadData();

    const handleUnlock = async (e: CustomEvent<{ achievement: Achievement }>) => {
      const achievement = e.detail.achievement;
      
      // Show celebration
      setUnlockedAchievement(achievement);
      setShowConfetti(true);
      
      // Play sound
      playAchievementSound();
      
      // Achievement unlocked!
      
      setTimeout(() => {
        setUnlockedAchievement(null);
        setShowConfetti(false);
      }, 4000);
      
      loadData();
    };
    
    window.addEventListener('achievementUnlocked', handleUnlock as EventListener);
    return () => window.removeEventListener('achievementUnlocked', handleUnlock as EventListener);
  }, []);

  // Achievement unlock celebration overlay
  const renderUnlockCelebration = () => {
    if (!unlockedAchievement) return null;
    
    return (
      <>
        {showConfetti && (
          <Confetti
            width={windowSize.width}
            height={windowSize.height}
            recycle={false}
            numberOfPieces={200}
            gravity={0.3}
            colors={['#fbbf24', '#f59e0b', '#d97706', '#10b981', '#6366f1']}
          />
        )}
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 50, rotateY: -90 }}
              animate={{ y: 0, rotateY: 0 }}
              transition={{ type: 'spring', damping: 12 }}
              className="text-center"
            >
              {/* Sparkle effects */}
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ 
                    opacity: [0, 1, 0], 
                    scale: [0, 1.2, 0],
                    x: [0, (Math.random() - 0.5) * 150],
                    y: [0, (Math.random() - 0.5) * 150],
                  }}
                  transition={{ duration: 1, delay: i * 0.15, repeat: 2 }}
                  className="absolute top-1/2 left-1/2"
                >
                  <Sparkles className="h-5 w-5 text-warning" />
                </motion.div>
              ))}
              
              <motion.div
                animate={{ 
                  scale: [1, 1.15, 1],
                  rotate: [0, -5, 5, 0],
                }}
                transition={{ duration: 0.6, repeat: 2 }}
                className="w-28 h-28 rounded-full bg-gradient-to-br from-warning to-streak flex items-center justify-center text-5xl shadow-2xl mx-auto"
              >
                {unlockedAchievement.icon}
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h2 className="text-3xl font-bold mt-6 text-foreground">
                  {t('achievements.unlocked', 'Achievement Unlocked!')}
                </h2>
                <p className="text-xl font-semibold mt-2 text-warning">
                  {unlockedAchievement.name}
                </p>
                <p className="text-muted-foreground mt-1">
                  {unlockedAchievement.description}
                </p>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: 'spring' }}
                  className="mt-3 inline-block bg-success/20 text-success px-4 py-1 rounded-full font-semibold"
                >
                  Unlocked! 🎉
                </motion.div>
              </motion.div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </>
    );
  };

  if (!achievementsData) return null;

  const categories = [
    { id: 'all', label: t('achievements.all', 'All') },
    { id: 'streak', label: t('achievements.streak', 'Streak') },
    { id: 'tasks', label: t('achievements.tasks', 'Tasks') },
    { id: 'consistency', label: t('achievements.consistency', 'Daily') },
    { id: 'special', label: t('achievements.special', 'Special') },
  ] as const;

  const filteredAchievements = selectedCategory === 'all' 
    ? ALL_ACHIEVEMENTS 
    : ALL_ACHIEVEMENTS.filter(a => a.category === selectedCategory);

  const unlockedCount = achievementsData.unlockedAchievements.length;
  const totalCount = ALL_ACHIEVEMENTS.length;

  if (compact) {
    // Compact view for dashboard
    const recentUnlocked = ALL_ACHIEVEMENTS
      .filter(a => achievementsData.unlockedAchievements.includes(a.id))
      .slice(0, 5);

    return (
      <>
        {renderUnlockCelebration()}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl p-4 border"
        >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-warning" />
            <h3 className="font-semibold text-sm">{t('achievements.title', 'Achievements')}</h3>
          </div>
          <span className="text-xs text-muted-foreground">{unlockedCount}/{totalCount}</span>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {recentUnlocked.length > 0 ? (
            recentUnlocked.map((achievement) => (
              <motion.div
                key={achievement.id}
                whileHover={{ scale: 1.1 }}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-warning to-streak flex items-center justify-center text-lg shadow-md"
                title={achievement.name}
              >
                {achievement.icon}
              </motion.div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">{t('achievements.noneYet', 'Complete tasks to unlock badges!')}</p>
          )}
          {recentUnlocked.length > 0 && unlockedCount > 5 && (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
              +{unlockedCount - 5}
            </div>
          )}
        </div>
        </motion.div>
      </>
    );
  }

  return (
    <>
      {renderUnlockCelebration()}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl p-4 border"
      >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-warning" />
          <h3 className="font-semibold">{t('achievements.title', 'Achievements')}</h3>
        </div>
        <span className="text-sm text-muted-foreground">{unlockedCount}/{totalCount}</span>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
              selectedCategory === cat.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Achievements Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
        {filteredAchievements.map((achievement) => {
          const isUnlocked = achievementsData.unlockedAchievements.includes(achievement.id);
          
          return (
            <motion.div
              key={achievement.id}
              whileHover={{ scale: 1.05 }}
              className={cn(
                "relative flex flex-col items-center gap-1 p-2 rounded-lg transition-all",
                isUnlocked 
                  ? "bg-gradient-to-br from-warning/20 to-streak/20 border border-warning/30" 
                  : "bg-muted/50 opacity-50"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center text-xl",
                isUnlocked 
                  ? "bg-gradient-to-br from-warning to-streak shadow-lg" 
                  : "bg-muted"
              )}>
                {isUnlocked ? achievement.icon : <Lock className="h-5 w-5 text-muted-foreground" />}
              </div>
              <span className="text-[10px] font-medium text-center line-clamp-2 leading-tight">
                {achievement.name}
              </span>
            </motion.div>
          );
        })}
      </div>
      </motion.div>
    </>
  );
};
