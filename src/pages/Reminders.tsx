import { BottomNavigation } from '@/components/BottomNavigation';
import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Reminders = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b sticky top-0 bg-card z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center gap-2">
            <img src="/src/assets/app-logo.png" alt="Npd" className="h-8 w-8" />
            <h1 className="text-xl font-bold">{t('remindersPage.title')}</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="text-center py-20">
          <Bell className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">{t('remindersPage.noUpcoming')}</h2>
          <p className="text-muted-foreground">
            {t('remindersPage.noUpcomingDesc')}
          </p>
        </div>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default Reminders;