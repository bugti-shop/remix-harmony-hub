import { useEffect } from 'react';
import { advanceJourney, getActiveJourney } from '@/utils/virtualJourneyStorage';
import { playAchievementSound } from '@/utils/gamificationSounds';

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
        // Dispatch a custom event so VirtualJourneyCard (if mounted) can show celebrations
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
