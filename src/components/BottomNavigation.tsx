import { startTransition, useCallback } from 'react';
import { Home, FileText, Calendar, User, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/utils/haptics';
import { useTranslation } from 'react-i18next';
import { useCustomNavigation, NavItem } from './CustomizeNavigationSheet';

const triggerNavHaptic = () => {
  triggerHaptic('heavy').catch(() => {});
};

// Icon mapping
const ICON_COMPONENTS: Record<string, React.ComponentType<{ className?: string }>> = {
  Home,
  FileText,
  Calendar,
  Settings,
  User,
};

// Main pages are eagerly loaded - no preloading needed

export const BottomNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const customNavItems = useCustomNavigation();

  // Get display label - use custom label if set, otherwise translate
  const getDisplayLabel = (item: NavItem) => {
    return item.customLabel || t(`nav.${item.id}`, item.label);
  };


  // Use startTransition for non-blocking navigation
  const handleNavigation = useCallback((path: string) => {
    triggerNavHaptic();
    startTransition(() => {
      navigate(path);
    });
  }, [navigate]);

  // Calculate grid columns based on visible items
  const gridCols = customNavItems.length <= 3 ? 'grid-cols-3' 
    : customNavItems.length === 4 ? 'grid-cols-4' 
    : 'grid-cols-5';

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-40"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
        WebkitTransform: 'translateZ(0)',
        transform: 'translateZ(0)',
      }}
    >
      <div className={cn("grid h-14 max-w-screen-lg mx-auto px-1", gridCols)}>
        {customNavItems.map((item) => {
          const Icon = ICON_COMPONENTS[item.icon] || Home;
          const isActive = location.pathname === item.path;

          return (
            <button
              key={item.id}
              type="button"
              data-tour={`${item.id}-link`}
              onClick={() => handleNavigation(item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 transition-colors min-w-0 px-0.5 touch-target touch-manipulation select-none",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              aria-label={getDisplayLabel(item)}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="text-[9px] xs:text-[10px] sm:text-xs font-medium truncate max-w-full">
                {getDisplayLabel(item)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
