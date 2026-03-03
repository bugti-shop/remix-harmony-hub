import { useEffect } from 'react';
import { advanceJourney, getActiveJourney, getRarityFromJourney } from '@/utils/virtualJourneyStorage';
import { playAchievementSound } from '@/utils/gamificationSounds';
import { toast } from '@/hooks/use-toast';
import { BadgeUnlockToast } from '@/components/BadgeUnlockToast';

/**
 * Global hook that listens for task completions and advances the active journey.
 * Must be mounted once at the App level so it works regardless of which page the user is on.
 */
export const useJourneyAdvancement = () => {
  useEffect(() => {
    const handler = () => {
      const active = getActiveJourney();
      if (!active || active.progress.completedAt) return;

      const result = advanceJourney();
      if (result.newMilestone || result.journeyCompleted) {
        playAchievementSound();

        const journey = active.journey;

        if (result.journeyCompleted) {
          const rarity = getRarityFromJourney(journey, 'journey_complete');
          toast({
            description: BadgeUnlockToast({
              icon: '🏆',
              label: `${journey.name} Conqueror`,
              journeyName: journey.name,
              rarity,
              isJourneyComplete: true,
            }),
            duration: 5000,
          });
        } else if (result.newMilestone) {
          const msIndex = journey.milestones.findIndex(m => m.id === result.newMilestone!.id);
          const rarity = getRarityFromJourney(journey, 'milestone', msIndex);
          toast({
            description: BadgeUnlockToast({
              icon: result.newMilestone.icon,
              label: result.newMilestone.name,
              journeyName: journey.name,
              rarity,
            }),
            duration: 4000,
          });
        }

        window.dispatchEvent(
          new CustomEvent('journeyMilestoneReached', {
            detail: { milestone: result.newMilestone, completed: result.journeyCompleted },
          })
        );
      }
    };

    window.addEventListener('tasksUpdated', handler);
    return () => window.removeEventListener('tasksUpdated', handler);
  }, []);
};
