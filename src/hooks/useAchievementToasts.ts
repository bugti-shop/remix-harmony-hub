import { useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { AchievementUnlockToast } from '@/components/CertificateUnlockToast';

/**
 * Global hook that listens for achievement unlocks and shows animated toasts.
 * Mounted once at the App level.
 */
export const useAchievementToasts = () => {
  useEffect(() => {
    const handler = (e: CustomEvent<{ achievement: { icon: string; name: string; description: string; category: string } }>) => {
      const { achievement } = e.detail;
      toast({
        description: AchievementUnlockToast({
          icon: achievement.icon,
          name: achievement.name,
          description: achievement.description,
          category: achievement.category,
        }),
        duration: 4000,
      });
    };

    window.addEventListener('achievementUnlocked', handler as EventListener);
    return () => window.removeEventListener('achievementUnlocked', handler as EventListener);
  }, []);
};
