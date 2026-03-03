import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getSetting, setSetting } from '@/utils/settingsStorage';

export interface TourStep {
  /** A CSS selector OR 'center' for a free-floating card */
  target: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  /** Where to position the tooltip relative to the target */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** Navigate to this route before showing the step */
  navigateTo?: string;
  /** Optional image to display in the tooltip (import path) */
  image?: string;
}

interface FeatureTourProps {
  steps: TourStep[];
  tourId: string;
  onComplete?: () => void;
  onSkip?: () => void;
}

const TOUR_SEEN_PREFIX = 'npd_tour_seen_';

export const FeatureTour = ({ steps, tourId, onComplete, onSkip }: FeatureTourProps) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;

  const calculatePosition = useCallback(() => {
    if (!step || isNavigating) return;

    if (step.target === 'center' || step.placement === 'center') {
      setHighlightRect(null);
      const hasImage = !!step.image;
      const w = hasImage ? Math.min(320, window.innerWidth - 32) : 300;
      const h = hasImage ? 160 : 100;
      setTooltipPosition({ top: window.innerHeight / 2 - h, left: window.innerWidth / 2 - w / 2, width: w });
      return;
    }

    const el = document.querySelector(step.target);
    if (!el) {
      // Element not found — show centered
      setHighlightRect(null);
      setTooltipPosition({ top: window.innerHeight / 2 - 100, left: window.innerWidth / 2 - 150, width: 300 });
      return;
    }

    const rect = el.getBoundingClientRect();
    setHighlightRect(rect);

    const tooltipWidth = Math.min(300, window.innerWidth - 32);
    const placement = step.placement || 'bottom';
    let top = 0;
    let left = 0;

    switch (placement) {
      case 'bottom':
        top = rect.bottom + 12;
        left = Math.max(16, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16));
        break;
      case 'top':
        top = rect.top - 12 - 180;
        left = Math.max(16, Math.min(rect.left + rect.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - 16));
        break;
      case 'left':
        top = rect.top + rect.height / 2 - 80;
        left = Math.max(16, rect.left - tooltipWidth - 12);
        break;
      case 'right':
        top = rect.top + rect.height / 2 - 80;
        left = Math.min(rect.right + 12, window.innerWidth - tooltipWidth - 16);
        break;
    }

    // Clamp top
    top = Math.max(16, Math.min(top, window.innerHeight - 220));

    setTooltipPosition({ top, left, width: tooltipWidth });
  }, [step, isNavigating]);

  useEffect(() => {
    calculatePosition();
    window.addEventListener('resize', calculatePosition);
    return () => window.removeEventListener('resize', calculatePosition);
  }, [calculatePosition, currentStep]);

  // Scroll target into view
  useEffect(() => {
    if (!step || step.target === 'center' || isNavigating) return;
    const el = document.querySelector(step.target);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(calculatePosition, 400);
      return () => clearTimeout(timer);
    }
  }, [step, calculatePosition, isNavigating]);

  // Handle navigation for the current step
  useEffect(() => {
    if (!step?.navigateTo) return;

    const currentPath = window.location.pathname;
    if (currentPath !== step.navigateTo) {
      setIsNavigating(true);
      // Dispatch a custom event that our App listens for
      window.dispatchEvent(new CustomEvent('tourNavigate', { detail: { path: step.navigateTo } }));
      // Wait for page to load
      const timer = setTimeout(() => {
        setIsNavigating(false);
        calculatePosition();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentStep, step, calculatePosition]);

  const goToStep = (index: number) => {
    setHighlightRect(null);
    setTooltipPosition(null);
    setCurrentStep(index);
  };

  const handleNext = () => {
    if (isLast) {
      handleComplete();
    } else {
      goToStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) goToStep(currentStep - 1);
  };

  const handleComplete = async () => {
    await setSetting(`${TOUR_SEEN_PREFIX}${tourId}`, 'true');
    onComplete?.();
  };

  const handleSkip = async () => {
    await setSetting(`${TOUR_SEEN_PREFIX}${tourId}`, 'true');
    onSkip?.();
  };

  if (!tooltipPosition || isNavigating) {
    // Show a subtle loading state while navigating
    if (isNavigating) {
      return (
        <div className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center">
          <div className="bg-card rounded-xl px-6 py-4 shadow-lg">
            <p className="text-sm text-foreground animate-pulse">Loading next step...</p>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        key="tour-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999]"
      >
        {/* Dark overlay with cutout */}
        <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
          <defs>
            <mask id="tour-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {highlightRect && (
                <rect
                  x={highlightRect.left - 6}
                  y={highlightRect.top - 6}
                  width={highlightRect.width + 12}
                  height={highlightRect.height + 12}
                  rx="10"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0" y="0" width="100%" height="100%"
            fill="rgba(0,0,0,0.6)"
            mask="url(#tour-mask)"
            style={{ pointerEvents: 'auto' }}
            onClick={handleSkip}
          />
        </svg>

        {/* Highlight ring */}
        {highlightRect && (
          <motion.div
            layoutId="highlight"
            className="absolute rounded-xl border-2 border-primary pointer-events-none"
            style={{
              top: highlightRect.top - 6,
              left: highlightRect.left - 6,
              width: highlightRect.width + 12,
              height: highlightRect.height + 12,
            }}
            animate={{
              boxShadow: [
                '0 0 0 0px hsl(var(--primary) / 0.3)',
                '0 0 0 6px hsl(var(--primary) / 0)',
              ],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}

        {/* Tooltip card */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
          className="absolute bg-card border border-border rounded-xl shadow-lg p-4 z-[10000]"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            width: tooltipPosition.width,
          }}
        >
          {/* Skip button */}
          <button
            onClick={handleSkip}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>

          {/* Step counter */}
          <p className="text-[10px] text-muted-foreground mb-1">
            {currentStep + 1} / {steps.length}
          </p>

          {/* Content */}
          <div className="pr-6">
            {step.image && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, delay: 0.1 }}
                className="mb-3 rounded-lg overflow-hidden border border-border/50 shadow-sm"
              >
                <img
                  src={step.image}
                  alt={step.title}
                  className="w-full h-auto max-h-36 object-cover"
                  loading="eager"
                />
              </motion.div>
            )}
            {step.icon && !step.image && <div className="mb-2">{step.icon}</div>}
            <h3 className="text-sm font-semibold text-foreground mb-1">{step.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
            {/* Progress dots */}
            <div className="flex gap-1 flex-wrap max-w-[40%]">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === currentStep ? 'w-4 bg-primary' : i < currentStep ? 'w-1.5 bg-primary/50' : 'w-1.5 bg-muted-foreground/30'
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-1.5">
              {!isFirst && (
                <Button variant="ghost" size="sm" onClick={handlePrev} className="h-7 px-2">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button size="sm" onClick={handleNext} className="h-7 px-3 text-xs">
                {isLast ? t('tour.finish', 'Finish') : t('tour.next', 'Next')}
                {!isLast && <ChevronRight className="h-3.5 w-3.5 ml-1" />}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

/** Hook to check if a tour has been seen */
export const useTourSeen = (tourId: string) => {
  const [seen, setSeen] = useState(true);
  useEffect(() => {
    getSetting<string>(`${TOUR_SEEN_PREFIX}${tourId}`, '').then(v => setSeen(v === 'true'));
  }, [tourId]);
  return seen;
};
