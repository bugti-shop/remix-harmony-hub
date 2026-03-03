import { useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// Define navigation order for different sections
const NOTES_SECTION_ORDER = ['/', '/notes', '/calendar', '/settings'];
const TODO_SECTION_ORDER = ['/todo/today', '/todo/calendar', '/profile', '/todo/progress', '/todo/settings'];

interface SwipeConfig {
  minSwipeDistance?: number; // Minimum distance to trigger navigation
  maxVerticalMovement?: number; // Max vertical movement to still consider horizontal swipe
}

const triggerHaptic = async () => {
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (error) {
    // Haptics not available
  }
};

export const useSwipeNavigation = (config: SwipeConfig = {}) => {
  const { minSwipeDistance = 80, maxVerticalMovement = 100 } = config;
  const navigate = useNavigate();
  const location = useLocation();
  
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchEndRef = useRef<{ x: number; y: number } | null>(null);

  // Determine which section the user is in
  const getCurrentSectionOrder = useCallback(() => {
    if (location.pathname.startsWith('/todo')) {
      return TODO_SECTION_ORDER;
    }
    return NOTES_SECTION_ORDER;
  }, [location.pathname]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
    touchEndRef.current = null;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current || !touchEndRef.current) return;

    const deltaX = touchEndRef.current.x - touchStartRef.current.x;
    const deltaY = Math.abs(touchEndRef.current.y - touchStartRef.current.y);
    const swipeTime = Date.now() - touchStartRef.current.time;

    // Only process horizontal swipes that are fast enough and not too vertical
    if (Math.abs(deltaX) < minSwipeDistance || deltaY > maxVerticalMovement) {
      touchStartRef.current = null;
      touchEndRef.current = null;
      return;
    }

    // Require quick swipe (under 500ms) for better UX
    if (swipeTime > 500) {
      touchStartRef.current = null;
      touchEndRef.current = null;
      return;
    }

    const sectionOrder = getCurrentSectionOrder();
    const currentIndex = sectionOrder.findIndex(path => path === location.pathname);

    if (currentIndex === -1) {
      touchStartRef.current = null;
      touchEndRef.current = null;
      return;
    }

    let targetIndex: number;

    if (deltaX > 0) {
      // Swipe right - go to previous section
      targetIndex = currentIndex - 1;
    } else {
      // Swipe left - go to next section
      targetIndex = currentIndex + 1;
    }

    // Check bounds
    if (targetIndex >= 0 && targetIndex < sectionOrder.length) {
      triggerHaptic();
      navigate(sectionOrder[targetIndex]);
    }

    touchStartRef.current = null;
    touchEndRef.current = null;
  }, [minSwipeDistance, maxVerticalMovement, getCurrentSectionOrder, location.pathname, navigate]);

  return {
    swipeHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
};

export default useSwipeNavigation;
