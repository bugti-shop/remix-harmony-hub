import { useEffect } from 'react';
import { advanceJourney, getActiveJourney } from '@/utils/virtualJourneyStorage';
import { playAchievementSound } from '@/utils/gamificationSounds';
import { toast } from '@/hooks/use-toast';

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

        // Show toast so user gets feedback on any page
        if (result.journeyCompleted) {
          toast({
            title: '🏆 Journey Complete!',
            description: `You finished the ${active.journey.name} journey!`,
          });
        } else if (result.newMilestone) {
          toast({
            title: `${result.newMilestone.icon} Milestone Reached!`,
            description: result.newMilestone.name,
          });
        }

        // Dispatch event so VirtualJourneyCard (if mounted) can show celebrations
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
