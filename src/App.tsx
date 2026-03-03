import { useEffect, useState, lazy, Suspense, startTransition, useRef } from "react";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { WelcomeProvider, useWelcome } from "@/contexts/WelcomeContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { NotesProvider } from "@/contexts/NotesContext";
import { GoogleAuthProvider } from "@/contexts/GoogleAuthContext";
import { PremiumPaywall } from "@/components/PremiumPaywall";
import { NavigationLoader } from "@/components/NavigationLoader";
import { SyncConflictSheet } from "@/components/SyncConflictSheet";
import { NavigationBackProvider } from "@/components/NavigationBackProvider";
import { getSetting, setSetting } from "@/utils/settingsStorage";
import { shouldAppBeLocked, updateLastUnlockTime } from "@/utils/appLockStorage";
import { useJourneyAdvancement } from "@/hooks/useJourneyAdvancement";
import { AppLockScreen } from "@/components/AppLockScreen";
import { WhatsNewSheet } from "@/components/WhatsNewSheet";
import { StreakMilestoneCelebration } from "@/components/StreakMilestoneCelebration";
import { StreakTierCelebration } from "@/components/StreakTierCelebration";

import { WelcomeBackCelebration } from "@/components/WelcomeBackCelebration";
import { useRetentionLogo } from "@/hooks/useRetentionLogo";
import { ComboOverlay } from "@/components/ComboOverlay";
// Eager load only the two most critical pages for instant first render
import Index from "./pages/Index";
import Today from "./pages/todo/Today";

// Lazy load everything else - they load in background after first paint
const Notes = lazy(() => import("./pages/Notes"));
const NotesCalendar = lazy(() => import("./pages/NotesCalendar"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsAndConditions = lazy(() => import("./pages/TermsAndConditions"));
const Progress = lazy(() => import("./pages/todo/Progress"));
const JourneyHistory = lazy(() => import("./pages/todo/JourneyHistory"));
const TodoCalendar = lazy(() => import("./pages/todo/TodoCalendar"));
const TodoSettings = lazy(() => import("./pages/todo/TodoSettings"));
const WebClipper = lazy(() => import("./pages/WebClipper"));
const Reminders = lazy(() => import("./pages/Reminders"));
const NotFound = lazy(() => import("./pages/NotFound"));


const queryClient = new QueryClient();

// IMPORTANT: Only decide the initial dashboard once per app session.
// This prevents slow async IndexedDB reads every time the user taps "Home".
let hasResolvedInitialDashboard = false;

// No loading screen - render nothing for instant feel
const EmptyFallback = () => null;

// Global error handler for unhandled errors (prevents white screen on mobile)
if (typeof window !== 'undefined') {
  // Show user-friendly toast for unhandled errors instead of silent crashes
  const showGlobalError = async (error: any) => {
    try {
      const { showErrorToast } = await import('@/lib/errorHandling');
      showErrorToast(error, { title: '⚠️ Error', log: false });
    } catch {
      // Fallback if errorHandling module fails
      console.error('Unhandled error:', error);
    }
  };

  window.onerror = (message, source, lineno, colno, error) => {
    console.error('Global error:', { message, source, lineno, colno, error });
    showGlobalError(error || message);
    return false;
  };
  
  window.onunhandledrejection = (event) => {
    // Suppress "not implemented" errors from Capacitor plugins (web + android + ios)
    const msg = String(event?.reason?.message || event?.reason || '');
    if (msg.includes('not implemented') || msg.includes('UNIMPLEMENTED') || msg.includes('not available')) {
      event.preventDefault();
      return;
    }
    console.error('Unhandled promise rejection:', event.reason);
    showGlobalError(event.reason);
  };
}

// Component to track and save last visited dashboard
const DashboardTracker = () => {
  const location = useLocation();
  
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/todo')) {
      setSetting('lastDashboard', 'todo');
    } else if (path === '/' || path === '/notes' || path === '/calendar' || path === '/settings') {
      setSetting('lastDashboard', 'notes');
    }
  }, [location.pathname]);
  
  return null;
};

// Listen for tour navigation events and navigate accordingly
const TourNavigationListener = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    const handleTourNavigate = (e: CustomEvent<{ path: string }>) => {
      navigate(e.detail.path);
    };
    window.addEventListener('tourNavigate', handleTourNavigate as EventListener);
    return () => window.removeEventListener('tourNavigate', handleTourNavigate as EventListener);
  }, [navigate]);
  
  return null;
};

// Root redirect component that checks last dashboard and redirects accordingly
// Renders Index immediately - no loading screen, redirect happens seamlessly in background
const RootRedirect = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // If we've already resolved once, skip
    if (hasResolvedInitialDashboard) return;
    hasResolvedInitialDashboard = true;
    
    const checkLastDashboard = async () => {
      try {
        const lastDashboard = await getSetting<string>('lastDashboard', 'notes');
        if (lastDashboard === 'todo') {
          startTransition(() => {
            navigate('/todo/today', { replace: true });
          });
        }
      } catch (e) {
        console.warn('Failed to check last dashboard:', e);
      }
    };
    
    checkLastDashboard();
  }, [navigate]);
  
  // Always render Index immediately - no loading screen
  return <Index />;
};

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <NavigationBackProvider>
        <NavigationLoader />
        <DashboardTracker />
        <TourNavigationListener />
        <Suspense fallback={<EmptyFallback />}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/calendar" element={<NotesCalendar />} />
            <Route path="/clip" element={<WebClipper />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/todo/today" element={<Today />} />
            <Route path="/todo/calendar" element={<TodoCalendar />} />
            <Route path="/todo/settings" element={<TodoSettings />} />
            <Route path="/todo/progress" element={<Progress />} />
            <Route path="/todo/journey-history" element={<JourneyHistory />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            
            <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </NavigationBackProvider>
    </BrowserRouter>
  );
};

const AppContent = () => {
  const [isAppLocked, setIsAppLocked] = useState<boolean | null>(null);
  const { mood, daysAway, isReturning, acknowledgeReturn } = useRetentionLogo();
  
  // Initialize keyboard height detection for mobile toolbar positioning
  useKeyboardHeight();
  
  // Global journey advancement - listens for task completions from any page
  useJourneyAdvancement();

  // Defer non-critical sync hooks until after first paint
  const deferredInit = useRef(false);
  useEffect(() => {
    if (deferredInit.current) return;
    deferredInit.current = true;

    const init = async () => {
      const { widgetDataSync } = await import('@/utils/widgetDataSync');
      widgetDataSync.initialize().catch(console.error);
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => init(), { timeout: 2000 });
    } else {
      setTimeout(init, 200);
    }
  }, []);

  // App lock check
  useEffect(() => {
    const checkLock = async () => {
      const locked = await shouldAppBeLocked();
      setIsAppLocked(locked);
    };
    checkLock();
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Handle unlock
  const handleUnlock = async () => {
    await updateLastUnlockTime();
    setIsAppLocked(false);
  };

  // Show lock screen if locked (but not while checking)
  if (isAppLocked === true) {
    return (
      <>
        <Toaster />
        <Sonner />
        <AppLockScreen onUnlock={handleUnlock} />
      </>
    );
  }

  return (
    <>
      <Toaster />
      <Sonner />
      <SyncConflictSheet />
      <PremiumPaywall />
      <WhatsNewSheet />
      <StreakMilestoneCelebration />
      <StreakTierCelebration />
      
      <ComboOverlay />
      <WelcomeBackCelebration
        isOpen={isReturning}
        mood={mood}
        daysAway={daysAway}
        onDismiss={acknowledgeReturn}
      />
      <DeferredSyncInit />
      <AppRoutes />
    </>
  );
};

// Deferred sync hooks - lazy loaded after first paint
const DeferredSyncInit = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = 'requestIdleCallback' in window
      ? requestIdleCallback(() => setReady(true), { timeout: 2000 })
      : setTimeout(() => setReady(true), 200);
    return () => {
      if ('requestIdleCallback' in window) cancelIdleCallback(id as number);
      else clearTimeout(id as ReturnType<typeof setTimeout>);
    };
  }, []);

  if (!ready) return null;
  return <DeferredSyncHooks />;
};

const DeferredSyncHooks = lazy(() =>
  Promise.all([
    import('@/hooks/useAutoSync'),
    import('@/hooks/useSystemCalendarSync'),
  ]).then(([autoSync, calSync]) => ({
    default: () => {
      autoSync.useAutoSync();
      calSync.useSystemCalendarSync();
      return null;
    },
  }))
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <GoogleAuthProvider>
          <NotesProvider>
            <WelcomeProvider>
              <SubscriptionProvider>
                <AppContent />
              </SubscriptionProvider>
            </WelcomeProvider>
          </NotesProvider>
        </GoogleAuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;