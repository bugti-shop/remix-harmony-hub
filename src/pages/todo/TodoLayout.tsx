import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Search, Sun, Moon, X, Crown } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { TodoBottomNavigation } from '@/components/TodoBottomNavigation';
import { SyncStatusButton } from '@/components/SyncStatusButton';
import { useDarkMode } from '@/hooks/useDarkMode';
import appLogo from '@/assets/app-logo.png';
import { triggerHaptic } from '@/utils/haptics';

interface TodoLayoutProps {
  children: ReactNode;
  title: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}

export const TodoLayout = ({ children, title, searchValue, onSearchChange }: TodoLayoutProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const { openPaywall, isPro } = useSubscription();


  return (
    <div className="min-h-screen bg-background">
      <header 
        className="border-b sticky top-0 bg-background z-30"
        style={{
          WebkitTransform: 'translateZ(0)',
          transform: 'translateZ(0)',
          paddingTop: 'calc(env(safe-area-inset-top) + 12px)',
        }}
      >
        <div className="container mx-auto px-3 sm:px-4 py-2">
          <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
              <img src={appLogo} alt="Npd" className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0" style={{ minWidth: '28px', minHeight: '28px' }} />
              <h1 className="text-lg sm:text-xl font-bold truncate">{title}</h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <SyncStatusButton size="sm" />
              {!isPro && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => openPaywall('pro')}
                  className="h-8 w-8 sm:h-9 sm:w-9 hover:bg-transparent active:bg-transparent"
                  title={t('common.goPro')}
                  data-tour="todo-pro-button"
                >
                  <Crown className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: '#3c78f0' }} />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  if (!isPro) { openPaywall('dark_mode'); return; }
                  toggleDarkMode();
                }}
                className="h-8 w-8 sm:h-9 sm:w-9 hover:bg-transparent active:bg-transparent"
                title={t('common.toggleDarkMode')}
                data-tour="todo-dark-mode"
              >
                {isDarkMode ? <Sun className="h-4 w-4 sm:h-5 sm:w-5" /> : <Moon className="h-4 w-4 sm:h-5 sm:w-5" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  triggerHaptic('heavy').catch(() => {});
                  navigate('/');
                }}
                className="h-8 w-8 sm:h-9 sm:w-9 hover:bg-transparent active:bg-transparent"
                title={t('common.switchToNotes')}
                data-tour="switch-to-notes"
              >
                <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
              </Button>
            </div>
          </div>

          <div className="relative" data-tour="todo-search-bar">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('tasks.searchTasks', 'Search tasks')}
              className="pl-10 pr-10 bg-secondary/50 border-none text-sm sm:text-base"
              value={searchValue || ''}
              onChange={(e) => onSearchChange?.(e.target.value)}
            />
            {searchValue && (
              <button
                onClick={() => onSearchChange?.('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="pb-16 sm:pb-20">
        {children}
      </main>
      <TodoBottomNavigation />
    </div>
  );
};
