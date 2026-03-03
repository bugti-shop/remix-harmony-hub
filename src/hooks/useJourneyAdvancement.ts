import { useEffect, useRef } from 'react';
import { advanceJourney, getActiveJourney, getRarityFromJourney } from '@/utils/virtualJourneyStorage';
import { playAchievementSound } from '@/utils/gamificationSounds';
import { toast } from '@/hooks/use-toast';
import { BadgeUnlockToast } from '@/components/BadgeUnlockToast';
import { loadTodoItems } from '@/utils/todoItemsStorage';
import { TodoItem } from '@/types/note';

/**
 * Global hook that listens for task updates and advances the active journey
 * only when the actual number of completed tasks increases.
 */
export const useJourneyAdvancement = () => {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCompletedCountRef = useRef<number | null>(null);
  const isProcessingRef = useRef(false);

  const countCompletedTasks = (items: TodoItem[]): number => {
    const walk = (list: TodoItem[]): number =>
      list.reduce((sum, item) => {
        const self = item.completed ? 1 : 0;
        const nested = item.subtasks?.length ? walk(item.subtasks) : 0;
        return sum + self + nested;
      }, 0);

    return walk(items);
  };

  useEffect(() => {
    const syncAndAdvance = async () => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      try {
        const items = await loadTodoItems();
        const completedCount = countCompletedTasks(items);

        // First sync: establish baseline without awarding progress
        if (lastCompletedCountRef.current === null) {
          lastCompletedCountRef.current = completedCount;
          return;
        }

        const delta = completedCount - lastCompletedCountRef.current;
        lastCompletedCountRef.current = completedCount;

        if (delta <= 0) return;

        for (let i = 0; i < delta; i++) {
          const active = getActiveJourney();
          if (!active || active.progress.completedAt) break;

          const result = advanceJourney();
          if (!result.newMilestone && !result.journeyCompleted) continue;

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
            const msIndex = journey.milestones.findIndex((m) => m.id === result.newMilestone!.id);
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
      } finally {
        isProcessingRef.current = false;
      }
    };

    // Initialize baseline once
    void syncAndAdvance();

    const handler = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void syncAndAdvance();
      }, 250);
    };

    window.addEventListener('tasksUpdated', handler);

    return () => {
      window.removeEventListener('tasksUpdated', handler);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);
};
