import { useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { CertificateUnlockToast } from '@/components/CertificateUnlockToast';
import { Shield, Star, Award, Crown, Gem } from 'lucide-react';
import React from 'react';

/**
 * Simplified certificate definitions for toast display (avoids importing the full component).
 */
const CERT_META: Record<string, { title: string; subtitle: string; accent: string; icon: React.ReactNode }> = {
  beginner:  { title: 'Beginner', subtitle: 'First Steps', accent: 'hsl(200, 70%, 55%)', icon: React.createElement(Shield, { className: 'h-5 w-5' }) },
  achiever:  { title: 'Achiever', subtitle: 'Building Momentum', accent: 'hsl(142, 71%, 50%)', icon: React.createElement(Star, { className: 'h-5 w-5' }) },
  expert:    { title: 'Expert', subtitle: 'Proven Discipline', accent: 'hsl(220, 85%, 60%)', icon: React.createElement(Award, { className: 'h-5 w-5' }) },
  champion:  { title: 'Champion', subtitle: 'Elite Performer', accent: 'hsl(271, 70%, 60%)', icon: React.createElement(Crown, { className: 'h-5 w-5' }) },
  master:    { title: 'Master', subtitle: 'Legendary Status', accent: 'hsl(43, 100%, 55%)', icon: React.createElement(Gem, { className: 'h-5 w-5' }) },
  legend:    { title: '365 Days', subtitle: 'Year-Long Discipline', accent: 'hsl(20, 100%, 55%)', icon: React.createElement(Crown, { className: 'h-5 w-5' }) },
  immortal:  { title: '1000 Days', subtitle: 'Immortal Productivity', accent: 'hsl(345, 100%, 60%)', icon: React.createElement(Gem, { className: 'h-5 w-5' }) },
};

/**
 * Global hook: after each task completion, checks if any certificate was newly unlocked
 * and shows an animated toast. Runs at the App level.
 */
export const useCertificateToasts = () => {
  const checking = useRef(false);

  useEffect(() => {
    const handler = async () => {
      if (checking.current) return;
      checking.current = true;

      try {
        const [{ loadTodoItems }, { loadNotesFromDB }, { loadFolders }, { getSetting, setSetting }] = await Promise.all([
          import('@/utils/todoItemsStorage'),
          import('@/utils/noteStorage'),
          import('@/utils/folderStorage'),
          import('@/utils/settingsStorage'),
        ]);

        const [tasks, notes, folders, seenCerts, streakRaw, adminBypass] = await Promise.all([
          loadTodoItems(),
          loadNotesFromDB(),
          loadFolders(),
          getSetting<string[]>('npd_seen_certificates', []),
          getSetting<any>('npd_streak_data', null),
          getSetting<boolean>('npd_admin_bypass', false),
        ]);

        const completedTasks = tasks.filter((t: any) => t.completed).length;
        const longestStreak = streakRaw?.longestStreak || 0;
        const usedFolderIds = new Set([
          ...notes.filter((n: any) => n.folderId).map((n: any) => n.folderId),
          ...tasks.filter((t: any) => t.sectionId).map((t: any) => t.sectionId),
        ]);

        const progress = {
          tasksCompleted: completedTasks,
          longestStreak,
          notesCreated: notes.length,
          foldersUsed: usedFolderIds.size,
          isAdmin: !!adminBypass,
        };

        // Certificate requirements (mirrored from GamificationCertificates)
        const CERT_REQS: Record<string, { tasksCompleted: number; streakDays: number; notesCreated: number; foldersUsed: number }> = {
          beginner: { tasksCompleted: 10, streakDays: 3, notesCreated: 3, foldersUsed: 1 },
          achiever: { tasksCompleted: 50, streakDays: 7, notesCreated: 10, foldersUsed: 2 },
          expert: { tasksCompleted: 200, streakDays: 14, notesCreated: 30, foldersUsed: 3 },
          champion: { tasksCompleted: 500, streakDays: 30, notesCreated: 75, foldersUsed: 5 },
          master: { tasksCompleted: 1000, streakDays: 60, notesCreated: 150, foldersUsed: 8 },
          legend: { tasksCompleted: 2000, streakDays: 365, notesCreated: 300, foldersUsed: 10 },
          immortal: { tasksCompleted: 5000, streakDays: 1000, notesCreated: 500, foldersUsed: 15 },
        };

        const isUnlocked = (certId: string) => {
          if (progress.isAdmin) return true;
          const r = CERT_REQS[certId];
          if (!r) return false;
          return (
            progress.tasksCompleted >= r.tasksCompleted &&
            progress.longestStreak >= r.streakDays &&
            progress.notesCreated >= r.notesCreated &&
            progress.foldersUsed >= r.foldersUsed
          );
        };

        const newlyUnlocked = Object.keys(CERT_REQS).filter(
          id => isUnlocked(id) && !seenCerts.includes(id)
        );

        if (newlyUnlocked.length > 0) {
          // Mark as seen
          await setSetting('npd_seen_certificates', [...seenCerts, ...newlyUnlocked]);

          // Show toast for the highest level unlocked
          const sorted = newlyUnlocked.sort((a, b) => {
            const order = Object.keys(CERT_REQS);
            return order.indexOf(b) - order.indexOf(a);
          });
          const top = sorted[0];
          const meta = CERT_META[top];
          if (meta) {
            const { playAchievementSound } = await import('@/utils/gamificationSounds');
            playAchievementSound();

            toast({
              description: CertificateUnlockToast({
                icon: meta.icon,
                title: meta.title,
                subtitle: meta.subtitle,
                accentColor: meta.accent,
              }),
              duration: 5000,
            });
          }
        }
      } catch (e) {
        console.warn('Certificate toast check failed:', e);
      } finally {
        checking.current = false;
      }
    };

    window.addEventListener('tasksUpdated', handler);
    return () => window.removeEventListener('tasksUpdated', handler);
  }, []);
};
