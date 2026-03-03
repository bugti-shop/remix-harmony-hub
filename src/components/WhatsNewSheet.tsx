import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Sparkles, Star, Zap, Shield, Palette, Bell, Moon, ListTodo, Map } from 'lucide-react';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import { useTranslation } from 'react-i18next';
import { FeatureTour, TourStep } from './FeatureTour';




// ─── Changelog: update this array with each release ───
export const APP_VERSION = '2.5.0';

interface ChangelogEntry {
  version: string;
  date: string;
  highlights: { icon: React.ReactNode; title: string; description: string }[];
}

const changelog: ChangelogEntry[] = [
  {
    version: '2.5.0',
    date: 'February 2025',
    highlights: [
      { icon: <Star className="h-4 w-4 text-warning" />, title: 'Free Google Sign-in & Sync', description: 'Google account sync is now completely free for all users.' },
      { icon: <Shield className="h-4 w-4 text-success" />, title: 'Cross-Device Subscription', description: 'Your Pro subscription now follows your Google account across devices.' },
      { icon: <Bell className="h-4 w-4 text-info" />, title: 'In-App Review Prompt', description: 'Rate the app directly without leaving — appears after 10 completed tasks.' },
      { icon: <Zap className="h-4 w-4 text-streak" />, title: 'Account Management', description: 'New account deletion option in Settings for full data control.' },
      { icon: <Palette className="h-4 w-4 text-accent-purple" />, title: 'Performance Improvements', description: 'Faster load times and smoother animations throughout the app.' },
    ],
  },
];

// ─── Comprehensive Full-App Tour Steps ───
const tourSteps: TourStep[] = [
  {
    target: '[data-tour="switch-to-todo"]',
    placement: 'bottom',
    title: 'Switch to Tasks',
    icon: <ListTodo className="h-5 w-5 text-primary" />,
    description: 'Tap here to jump to your To-Do dashboard where you can manage tasks, folders, and sections.',
    navigateTo: '/',
  },
  {
    target: '[data-tour="dark-mode-toggle"]',
    placement: 'bottom',
    title: 'Dark Mode',
    icon: <Moon className="h-5 w-5 text-primary" />,
    description: 'Switch between light and dark themes to match your preference. Multiple theme options available in Settings.',
    navigateTo: '/',
  },
];

const LAST_SEEN_VERSION_KEY = 'npd_last_seen_version';

export const WhatsNewSheet = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [unseenEntries, setUnseenEntries] = useState<ChangelogEntry[]>([]);

  useEffect(() => {
    const check = async () => {
      const lastSeen = await getSetting<string>(LAST_SEEN_VERSION_KEY, '0.0.0');
      if (lastSeen !== APP_VERSION) {
        const unseen = changelog.filter(e => e.version > lastSeen);
        if (unseen.length > 0) {
          setUnseenEntries(unseen);
          setOpen(true);
        }
      }
    };
    const timer = setTimeout(check, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Listen for replay event from Settings
  useEffect(() => {
    const handleReplay = () => {
      setTimeout(() => setShowTour(true), 500);
    };
    window.addEventListener('replayFeatureTour', handleReplay);
    return () => window.removeEventListener('replayFeatureTour', handleReplay);
  }, []);

  // Listen for "show What's New" event from Settings
  useEffect(() => {
    const handleShow = () => {
      setUnseenEntries(changelog);
      setOpen(true);
    };
    window.addEventListener('showWhatsNew', handleShow);
    return () => window.removeEventListener('showWhatsNew', handleShow);
  }, []);

  const handleClose = async () => {
    await setSetting(LAST_SEEN_VERSION_KEY, APP_VERSION);
    setOpen(false);
  };

  const handleStartTour = async () => {
    await setSetting(LAST_SEEN_VERSION_KEY, APP_VERSION);
    setOpen(false);
    setTimeout(() => setShowTour(true), 400);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh]">
          <SheetHeader className="pb-2">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              {t('whatsNew.title', "What's New")}
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="max-h-[60vh] pr-2">
            <div className="space-y-6 pb-4">
              {unseenEntries.map((entry) => (
                <div key={entry.version}>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-sm font-bold text-primary">v{entry.version}</span>
                    <span className="text-xs text-muted-foreground">{entry.date}</span>
                  </div>
                  <div className="space-y-3">
                    {entry.highlights.map((item, idx) => (
                      <div key={idx} className="flex gap-3 items-start">
                        <div className="mt-0.5 flex-shrink-0 h-7 w-7 rounded-lg bg-muted flex items-center justify-center">
                          {item.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="flex gap-2 mt-2">
            <Button variant="outline" onClick={handleStartTour} className="flex-1 gap-2">
              <Map className="h-4 w-4" />
              {t('whatsNew.takeTour', 'Take a Tour')}
            </Button>
            <Button onClick={handleClose} className="flex-1">
              {t('whatsNew.gotIt', 'Got it!')}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {showTour && (
        <FeatureTour
          steps={tourSteps}
          tourId={`full-app-v${APP_VERSION}`}
          onComplete={() => setShowTour(false)}
          onSkip={() => setShowTour(false)}
        />
      )}
    </>
  );
};
