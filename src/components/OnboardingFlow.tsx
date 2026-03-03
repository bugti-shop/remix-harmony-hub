import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Confetti from 'react-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, CheckSquare, Unlock, Bell, Crown, Loader2, Check } from 'lucide-react';
// Google auth removed
import Welcome from '@/components/Welcome';
import featureHome from '@/assets/feature-home.png';
import featureNotes from '@/assets/feature-notes.png';
import featureNotesTypes from '@/assets/feature-notes-types.png';
import featureEditor from '@/assets/feature-editor.png';

import featureFontStyling from '@/assets/feature-font-styling.png';
import featureStickyNotes from '@/assets/feature-sticky-notes.png';
import featureCodeEditor from '@/assets/feature-code-editor.png';
import featureThemeDark from '@/assets/feature-theme-dark.png';
import featureThemeGreen from '@/assets/feature-theme-green.png';
import featureThemeForest from '@/assets/feature-theme-forest.png';
import featureThemeBrown from '@/assets/feature-theme-brown.png';
import featureThemeLight from '@/assets/feature-theme-light.png';
import featureTables from '@/assets/feature-tables.png';
import featureMedia from '@/assets/feature-media.png';
import featureFolders from '@/assets/feature-folders.png';
import featureTaskInput from '@/assets/feature-task-input.png';
import featureTaskList from '@/assets/feature-task-list-new.png';
import featurePriority from '@/assets/feature-priority.png';
import featureOptions from '@/assets/feature-options.png';
import featureDragDrop from '@/assets/feature-drag-drop.png';
import featurePriorityFolders from '@/assets/feature-priority-folders.png';
import featureCustomActions from '@/assets/feature-custom-actions.png';
import featureSubtasksTracking from '@/assets/feature-subtasks-tracking.png';
import featureCompletedTasks from '@/assets/feature-completed-tasks.png';
import featureDateTime from '@/assets/feature-date-time.png';
import featureBatchActions from '@/assets/feature-batch-actions.png';
import featureMultipleTasks from '@/assets/feature-multiple-tasks.png';
import featureProductivityTools from '@/assets/feature-productivity-tools.png';
import featureSwipeComplete from '@/assets/feature-swipe-complete.png';
import featureSwipeDelete from '@/assets/feature-swipe-delete.png';
import showcaseFolders from '@/assets/showcase-folders.png';
import showcaseAvatars from '@/assets/showcase-avatars.png';
import { PRICING_DISPLAY } from '@/lib/billing';
import { Capacitor } from '@capacitor/core';
import { triggerHaptic } from '@/utils/haptics';
import { useRevenueCat } from '@/contexts/RevenueCatContext';

interface OnboardingFlowProps {
  onComplete: () => void;
}

export default function OnboardingFlow({
  onComplete
}: OnboardingFlowProps) {
  const { t } = useTranslation();
  const { isPro, checkEntitlement, initialize: initRevenueCat } = useRevenueCat();
  const [showWelcome, setShowWelcome] = useState(true);
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState('');
  const [source, setSource] = useState('');
  const [progress, setProgress] = useState(0);
  const [complete, setComplete] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [showAdminInput, setShowAdminInput] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right'>('left');
  const [themeView, setThemeView] = useState<number>(0);
  const [swipeActionView, setSwipeActionView] = useState<0 | 1>(0);
  const [showcaseView, setShowcaseView] = useState<0 | 1>(0);
  const [offerings, setOfferings] = useState<any>(null);
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(false);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const themeTouchStartX = useRef<number>(0);
  const themeTouchEndX = useRef<number>(0);
  const swipeActionTouchStartX = useRef<number>(0);
  const swipeActionTouchEndX = useRef<number>(0);
  const showcaseTouchStartX = useRef<number>(0);
  const showcaseTouchEndX = useRef<number>(0);


  // Theme showcase data
  const themeFeatures = [
    { image: featureThemeDark, title: t('onboarding.themes.dark'), subtitle: t('onboarding.themes.darkDesc') },
    { image: featureThemeGreen, title: t('onboarding.themes.green'), subtitle: t('onboarding.themes.greenDesc') },
    { image: featureThemeForest, title: t('onboarding.themes.forest'), subtitle: t('onboarding.themes.forestDesc') },
    { image: featureThemeBrown, title: t('onboarding.themes.brown'), subtitle: t('onboarding.themes.brownDesc') },
    { image: featureThemeLight, title: t('onboarding.themes.light'), subtitle: t('onboarding.themes.lightDesc') },
  ];

  // Preload all images immediately with high priority for instant rendering
  useEffect(() => {
    const imagesToPreload = [featureHome, featureNotes, featureNotesTypes, featureEditor, featureFontStyling, featureStickyNotes, featureCodeEditor, featureThemeDark, featureThemeGreen, featureThemeForest, featureThemeBrown, featureThemeLight, featureTables, featureMedia, featureFolders, featureTaskInput, featureTaskList, featurePriority, featureOptions, featureDragDrop, featurePriorityFolders, featureCustomActions, featureSubtasksTracking, featureCompletedTasks, featureDateTime, featureBatchActions, featureMultipleTasks, featureProductivityTools, featureSwipeComplete, featureSwipeDelete, showcaseFolders, showcaseAvatars];
    
    // Use Promise.all for parallel loading
    const loadPromises = imagesToPreload.map(src => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.decoding = 'sync';
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = src;
      });
    });
    
    Promise.all(loadPromises).then(() => setImagesLoaded(true));
    
    // Fast fallback - don't wait too long
    const timeout = setTimeout(() => setImagesLoaded(true), 500);
    return () => clearTimeout(timeout);
  }, []);


  const goals = [{
    id: 'notes',
    label: t('onboarding.goals.notes'),
    icon: FileText
  }, {
    id: 'tasks',
    label: t('onboarding.goals.tasks'),
    icon: CheckSquare
  }];

  const sources = [{
    name: 'TikTok',
    color: '#000000',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Tiktok_icon.svg/2048px-Tiktok_icon.svg.png'
  }, {
    name: 'YouTube',
    color: '#000000',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/YouTube_social_white_square_%282017%29.svg/1024px-YouTube_social_white_square_%282017%29.svg.png'
  }, {
    name: 'Google',
    color: '#000000',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/2048px-Google_%22G%22_logo.svg.png'
  }, {
    name: 'Play Store',
    color: '#000000',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Google_Play_2022_icon.svg/1856px-Google_Play_2022_icon.svg.png'
  }, {
    name: 'Facebook',
    color: '#000000',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/2023_Facebook_icon.svg/2048px-2023_Facebook_icon.svg.png'
  }, {
    name: 'LinkedIn',
    color: '#000000',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/LinkedIn_icon.svg/2048px-LinkedIn_icon.svg.png'
  }];

  // Steps: 1 (goal) -> 2-13 (note features) -> 14 (task input) -> 15 (showcase) -> 16-28 (task features) -> 29 (testimonials) -> 30 (source) -> 31 (google sign in) -> 32 (loading)
  const totalSteps = 32;

  // Showcase features data
  const showcaseFeatures = [
    { image: showcaseFolders, title: t('onboarding.showcase.organizeFolders'), subtitle: t('onboarding.showcase.organizeFoldersDesc') },
    { image: showcaseAvatars, title: t('onboarding.showcase.assignAnyone'), subtitle: t('onboarding.showcase.assignAnyoneDesc') },
  ];

  // Fetch RevenueCat offerings when paywall is about to show
  const fetchOfferings = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    
    // Try to load cached offerings first for instant display
    const { getSetting, setSetting } = await import('@/utils/settingsStorage');
    const cachedOfferings = await getSetting<{ data: any; timestamp: number } | null>('rc_offerings_cache', null);
    if (cachedOfferings) {
      try {
        // Check if cache is less than 24 hours old
        if (cachedOfferings.timestamp && Date.now() - cachedOfferings.timestamp < 24 * 60 * 60 * 1000) {
          setOfferings(cachedOfferings.data);
        }
      } catch (e) {
        console.error('Failed to parse cached offerings:', e);
      }
    }
    
    // Fetch fresh data (show loading only if no cached data)
    if (!cachedOfferings) {
      setIsLoadingOfferings(true);
    }
    
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const offeringsData = await Purchases.getOfferings();
      setOfferings(offeringsData);
      
      // Cache the offerings with timestamp
      await setSetting('rc_offerings_cache', {
        data: offeringsData,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Failed to fetch offerings:', error);
    } finally {
      setIsLoadingOfferings(false);
    }
  }, []);

  // Pre-fetch RevenueCat offerings early in onboarding (around step 10)
  useEffect(() => {
    if (step >= 10 && !offerings) {
      fetchOfferings();
    }
  }, [step, offerings, fetchOfferings]);

  useEffect(() => {
    if (step === 32) {
      const timer = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(timer);
            setTimeout(() => {
              setComplete(true);
              setTimeout(() => setShowPaywall(true), 2000);
            }, 500);
            return 100;
          }
          return prev + 1;
        });
      }, 80);
      return () => clearInterval(timer);
    }
  }, [step]);


  const handleContinue = () => {
    triggerHaptic('heavy');
    if (step < 32) {
      setSwipeDirection('left');
      // Skip removed step 8 (sketch)
      setStep(step === 7 ? 9 : step + 1);
    }
  };

  // Google auth step removed - auto continues to next step

  const handleBack = () => {
    triggerHaptic('heavy');
    if (step === 1) {
      setShowWelcome(true);
    } else if (step > 1) {
      setSwipeDirection('right');
      // Skip removed step 8 (sketch)
      setStep(step === 9 ? 7 : step - 1);
    }
  };

  // Swipe gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const swipeThreshold = 50;
    const diff = touchStartX.current - touchEndX.current;
    
    if (Math.abs(diff) > swipeThreshold && step !== 32) {
      if (diff > 0) {
        // Swiped left - go next
        handleContinue();
      } else {
        // Swiped right - go back
        handleBack();
      }
    }
    touchStartX.current = 0;
    touchEndX.current = 0;
  };


  // Theme swipe gesture handlers
  const handleThemeTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    themeTouchStartX.current = e.touches[0].clientX;
  };

  const handleThemeTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    themeTouchEndX.current = e.touches[0].clientX;
  };

  const handleThemeTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    const swipeThreshold = 50;
    const diff = themeTouchStartX.current - themeTouchEndX.current;
    
    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0 && themeView < 4) {
        // Swiped left - next theme view
        triggerHaptic('light');
        setThemeView(themeView + 1);
      } else if (diff < 0 && themeView > 0) {
        // Swiped right - previous theme view
        triggerHaptic('light');
        setThemeView(themeView - 1);
      }
    }
    themeTouchStartX.current = 0;
    themeTouchEndX.current = 0;
  };

  // Swipe action gesture handlers
  const handleSwipeActionTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    swipeActionTouchStartX.current = e.touches[0].clientX;
  };

  const handleSwipeActionTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    swipeActionTouchEndX.current = e.touches[0].clientX;
  };

  const handleSwipeActionTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    const swipeThreshold = 50;
    const diff = swipeActionTouchStartX.current - swipeActionTouchEndX.current;
    
    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0 && swipeActionView < 1) {
        // Swiped left - next swipe action view
        triggerHaptic('light');
        setSwipeActionView(1);
      } else if (diff < 0 && swipeActionView > 0) {
        // Swiped right - previous swipe action view
        triggerHaptic('light');
        setSwipeActionView(0);
      }
    }
    swipeActionTouchStartX.current = 0;
    swipeActionTouchEndX.current = 0;
  };

  // Showcase swipe gesture handlers
  const handleShowcaseTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    showcaseTouchStartX.current = e.touches[0].clientX;
  };

  const handleShowcaseTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    showcaseTouchEndX.current = e.touches[0].clientX;
  };

  const handleShowcaseTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    const swipeThreshold = 50;
    const diff = showcaseTouchStartX.current - showcaseTouchEndX.current;
    
    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0 && showcaseView < 1) {
        // Swiped left - next showcase view
        triggerHaptic('light');
        setShowcaseView(1);
      } else if (diff < 0 && showcaseView > 0) {
        // Swiped right - previous showcase view
        triggerHaptic('light');
        setShowcaseView(0);
      }
    }
    showcaseTouchStartX.current = 0;
    showcaseTouchEndX.current = 0;
  };

  const slideVariants = {
    enter: (direction: 'left' | 'right') => ({
      x: direction === 'left' ? 100 : -100,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction: 'left' | 'right') => ({
      x: direction === 'left' ? -100 : 100,
      opacity: 0
    })
  };

  // Show welcome screen first
  if (showWelcome) {
    return <Welcome onGetStarted={() => setShowWelcome(false)} />;
  }

  if (showPaywall) {
    const PLANS = [
      { id: 'weekly' as const, label: 'Weekly', price: '$1.99/wk', badge: null },
      { id: 'monthly' as const, label: 'Monthly', price: '$5.99/mo', badge: '3 DAYS FREE' },
      { id: 'yearly' as const, label: 'Yearly', price: '$39.99/yr', badge: 'Best Value' },
    ];
    const currentPlan = PLANS.find(p => p.id === selectedPlan)!;

    return (
      <div className="min-h-screen bg-white p-6 flex flex-col justify-between" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}>
        <div>
          <h1 className="text-3xl font-bold text-center mb-6">{t('onboarding.paywall.upgradeTitle')}</h1>
          <div className="flex flex-col items-start mx-auto w-80 relative">
            <div className="absolute left-[10.5px] top-[20px] bottom-[20px] w-[11px] bg-primary/20 rounded-b-full"></div>

            <div className="flex items-start gap-3 mb-6 relative">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground z-10 flex-shrink-0">
                <Unlock size={16} className="text-primary-foreground" strokeWidth={2} />
              </div>
              <div>
                <p className="font-semibold">{t('onboarding.paywall.today')}</p>
                <p className="text-muted-foreground text-sm">{t('onboarding.paywall.todayDesc')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 mb-6 relative">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground z-10 flex-shrink-0">
                <Bell size={16} className="text-primary-foreground" strokeWidth={2} />
              </div>
              <div>
                <p className="font-semibold">{t('onboarding.paywall.reminderDay', { days: 2 })}</p>
                <p className="text-muted-foreground text-sm">{t('onboarding.paywall.reminderDesc')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 relative">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground z-10 flex-shrink-0">
                <Crown size={16} className="text-primary-foreground" strokeWidth={2} />
              </div>
              <div>
                <p className="font-semibold">{t('onboarding.paywall.billingDay', { days: 3 })}</p>
                <p className="text-muted-foreground text-sm">{t('onboarding.paywall.billingDesc', { days: 3 })}</p>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center gap-4">
          {isLoadingOfferings ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">{t('onboarding.paywall.loadingPrices')}</span>
            </div>
          ) : (
            <div className="flex gap-3 w-full max-w-sm">
              {PLANS.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`flex-1 relative rounded-xl p-3 text-center border-2 transition-all ${
                    selectedPlan === plan.id 
                      ? 'border-primary bg-secondary' 
                      : 'border-muted bg-white'
                  }`}
                >
                  {plan.badge && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full whitespace-nowrap">
                      {plan.badge}
                    </span>
                  )}
                  <p className="font-bold text-sm">{plan.label}</p>
                  <p className="text-muted-foreground text-xs mt-1">{plan.price}</p>
                  {selectedPlan === plan.id && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <Check size={10} className="text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

            <div className="flex flex-col items-center gap-2">
              <button 
                onClick={async () => {
                  setIsPurchasing(true);
                  try {
                    if (Capacitor.isNativePlatform()) {
                      const { Purchases, PACKAGE_TYPE } = await import('@revenuecat/purchases-capacitor');
                      const offerings = await Purchases.getOfferings();
                      
                      if (!offerings?.current) {
                        throw new Error(t('onboarding.paywall.noOfferings'));
                      }

                      console.log('OnboardingFlow: Available packages:', offerings.current.availablePackages.map(p => ({
                        identifier: p.identifier,
                        packageType: p.packageType,
                        productIdentifier: p.product?.identifier,
                      })));

                      let pkg: any = null;

                      if (selectedPlan === 'weekly') {
                        pkg = offerings.current.availablePackages.find(p => p.packageType === PACKAGE_TYPE.WEEKLY)
                          || offerings.current.availablePackages.find(p => p.product?.identifier === 'nnppd_weekly')
                          || offerings.current.availablePackages.find(p => p.product?.identifier?.includes('weekly'));
                      } else if (selectedPlan === 'monthly') {
                        pkg = offerings.current.availablePackages.find(p => p.packageType === PACKAGE_TYPE.MONTHLY)
                          || offerings.current.availablePackages.find(p => p.product?.identifier === 'npd_mo')
                          || offerings.current.availablePackages.find(p => p.product?.identifier?.includes('npd_mo'));
                      } else if (selectedPlan === 'yearly') {
                        pkg = offerings.current.availablePackages.find(p => p.packageType === PACKAGE_TYPE.ANNUAL)
                          || offerings.current.availablePackages.find(p => p.product?.identifier === 'npd_yr')
                          || offerings.current.availablePackages.find(p => p.product?.identifier?.includes('npd_yr'));
                      }
                      
                      if (!pkg) {
                        console.error('OnboardingFlow: Package not found. Available:', JSON.stringify(offerings.current.availablePackages));
                        throw new Error(t('onboarding.paywall.packageNotFound', { plan: selectedPlan }));
                      }
                      
                      const result = await Purchases.purchasePackage({ aPackage: pkg });
                      const hasEntitlement = result.customerInfo.entitlements.active['npd Pro'] !== undefined;
                      
                      if (hasEntitlement) {
                        const { setSetting } = await import('@/utils/settingsStorage');
                        await setSetting('npd_trial_start', new Date().toISOString());
                        onComplete();
                      }
                    } else {
                      const { setSetting } = await import('@/utils/settingsStorage');
                      await setSetting('npd_trial_start', new Date().toISOString());
                      onComplete();
                    }
                  } catch (error: any) {
                    if (error.code === 'PURCHASE_CANCELLED' || error.userCancelled) {
                      console.log('Purchase cancelled by user');
                    } else {
                      console.error('Purchase failed:', error);
                      setAdminError(t('onboarding.paywall.purchaseFailed'));
                      setTimeout(() => setAdminError(''), 3000);
                    }
                  } finally {
                    setIsPurchasing(false);
                  }
                }}
                disabled={isPurchasing}
                className="w-80 mt-4 btn-duo disabled:opacity-50"
              >
                {isPurchasing ? t('onboarding.paywall.processing') : `Continue with ${currentPlan.label} — ${currentPlan.price}`}
              </button>

              {/* Restore Purchase Button */}
              <button 
                onClick={async () => {
                  setIsRestoring(true);
                  try {
                    if (Capacitor.isNativePlatform()) {
                      const { Purchases } = await import('@revenuecat/purchases-capacitor');
                      const { customerInfo } = await Purchases.restorePurchases();
                      const hasEntitlement = customerInfo.entitlements.active['npd Pro'] !== undefined;
                      if (hasEntitlement) {
                        onComplete();
                      } else {
                        setAdminError(t('onboarding.paywall.noPurchasesFound'));
                        setTimeout(() => setAdminError(''), 3000);
                      }
                    } else {
                      setAdminError(t('onboarding.paywall.noPurchasesFound'));
                      setTimeout(() => setAdminError(''), 3000);
                    }
                  } catch (error) {
                    console.error('Restore failed:', error);
                    setAdminError(t('onboarding.paywall.restoreFailed'));
                    setTimeout(() => setAdminError(''), 3000);
                  } finally {
                    setIsRestoring(false);
                  }
                }}
                disabled={isRestoring}
                className="text-primary font-medium text-sm mt-2 disabled:opacity-50"
              >
                {isRestoring ? t('onboarding.paywall.restoring') : t('onboarding.paywall.restorePurchase')}
              </button>

              {/* Admin Access Section */}
              <div className="mt-6 w-full">
                {!showAdminInput ? (
                  <button 
                    onClick={() => setShowAdminInput(true)}
                    className="text-muted-foreground text-xs underline"
                  >
                    {t('onboarding.paywall.accessCode')}
                  </button>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex gap-2 w-full max-w-xs">
                      <input
                        type="password"
                        value={adminCode}
                        onChange={(e) => {
                        setAdminCode(e.target.value.slice(0, 20));
                          setAdminError('');
                        }}
                        placeholder={t('onboarding.paywall.enterAccessCode')}
                        className="flex-1 px-4 py-2 border border-muted rounded-lg text-center text-sm focus:outline-none focus:border-primary"
                        maxLength={20}
                      />
                      <button
                        onClick={async () => {
                          const validCode = 'BUGTI';
                          if (adminCode.trim().toUpperCase() === validCode) {
                            const { setSetting } = await import('@/utils/settingsStorage');
                            await setSetting('npd_admin_bypass', true);
                            window.dispatchEvent(new CustomEvent('adminBypassActivated'));
                            onComplete();
                          } else {
                            setAdminError(t('onboarding.paywall.invalidCode'));
                            setAdminCode('');
                          }
                        }}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                      >
                        {t('onboarding.paywall.apply')}
                      </button>
                    </div>
                    {adminError && (
                      <p className="text-destructive text-xs">{adminError}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate progress percentage
  const currentProgress = step / totalSteps * 100;


  return (
    <div className="min-h-screen bg-white flex flex-col justify-between p-6 relative overflow-y-auto" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}>
      {complete && <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} />}

      <div>
        <div className="flex items-center gap-4">
          {step >= 1 && step !== 20 && (
            <button onClick={handleBack} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M15 18L9 12L15 6" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}

          <div className="flex-1">
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div className="h-2 rounded-full bg-primary" style={{
                width: `${currentProgress}%`
              }} />
            </div>
          </div>

        </div>

        {step === 1 && (
          <section className="mt-8">
            <h1 className="text-2xl font-semibold text-gray-900">{t('onboarding.mainGoal')}</h1>
            <p className="text-gray-400 mt-2">
              {t('onboarding.mainGoalSubtitle')}
            </p>
            <div className="mt-8 space-y-4">
              {goals.map(g => {
                const IconComponent = g.icon;
                return (
                  <button key={g.id} onClick={() => setGoal(g.label)} className={`w-full text-left rounded-2xl py-4 px-4 transition flex items-center gap-3 ${goal === g.label ? 'bg-primary text-primary-foreground' : 'text-gray-800'}`} style={goal !== g.label ? { backgroundColor: '#f9f8fd' } : {}}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${goal === g.label ? 'bg-white' : 'bg-gray-200'}`}>
                      <IconComponent className={`w-4 h-4 ${goal === g.label ? 'text-primary' : 'text-gray-600'}`} />
                    </div>
                    <span className="text-base font-medium">{g.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <AnimatePresence mode="wait" custom={swipeDirection}>
          {step === 2 && (
            <motion.section 
              key="step2"
              custom={swipeDirection}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="mt-6 text-center flex flex-col items-center relative"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.features.findNotesInstantly')}</h1>
              <p className="text-gray-500 text-sm mb-3">{t('onboarding.features.findNotesDesc')}</p>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
                <img src={featureHome} alt={t('onboarding.features.findNotesInstantly')} loading="eager" decoding="async" className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg" />
              </div>
            </motion.section>
          )}

          {step === 3 && (
            <motion.section 
              key="step3"
              custom={swipeDirection}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="mt-6 text-center flex flex-col items-center relative"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.features.neverLoseThought')}</h1>
              <p className="text-gray-500 text-sm mb-3">{t('onboarding.features.neverLoseDesc')}</p>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
                <img src={featureNotes} alt={t('onboarding.features.neverLoseThought')} loading="eager" decoding="async" className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg" />
              </div>
            </motion.section>
          )}

          {step === 4 && (
            <motion.section 
              key="step4"
              custom={swipeDirection}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="mt-6 text-center flex flex-col items-center relative"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.features.uniqueNoteTypes')}</h1>
              <p className="text-gray-500 text-sm mb-3">{t('onboarding.features.uniqueNoteTypesDesc')}</p>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
                <img src={featureNotesTypes} alt={t('onboarding.features.uniqueNoteTypes')} loading="eager" decoding="async" className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg" />
              </div>
            </motion.section>
          )}

          {step === 5 && (
            <motion.section 
              key="step5"
              custom={swipeDirection}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="mt-6 text-center flex flex-col items-center relative"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.features.writeLikePro')}</h1>
              <p className="text-gray-500 text-sm mb-3">{t('onboarding.features.writeLikeProDesc')}</p>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
                <img src={featureEditor} alt={t('onboarding.features.writeLikePro')} loading="eager" decoding="async" className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg" />
              </div>
            </motion.section>
          )}

          {step === 6 && (
            <motion.section 
              key="step6"
              custom={swipeDirection}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="mt-6 text-center flex flex-col items-center relative"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.features.codeNotes')}</h1>
              <p className="text-gray-500 text-sm mb-3">{t('onboarding.features.codeNotesDesc')}</p>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
                <img src={featureCodeEditor} alt={t('onboarding.features.codeNotes')} loading="eager" decoding="async" className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg" />
              </div>
            </motion.section>
          )}

          {step === 7 && (
            <motion.section 
              key="step7"
              custom={swipeDirection}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="mt-6 text-center flex flex-col items-center relative"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.features.stickyNotes')}</h1>
              <p className="text-gray-500 text-sm mb-3">{t('onboarding.features.stickyNotesDesc')}</p>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
                <img src={featureStickyNotes} alt={t('onboarding.features.stickyNotes')} loading="eager" decoding="async" className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg" />
              </div>
            </motion.section>
          )}

          {/* Step 8 - Sketch removed */}

          {step === 9 && (
            <motion.section 
              key="step9"
              custom={swipeDirection}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="mt-6 text-center flex flex-col items-center relative"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.features.styleText')}</h1>
              <p className="text-gray-500 text-sm mb-3">{t('onboarding.features.styleTextDesc')}</p>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
                <img src={featureFontStyling} alt={t('onboarding.features.styleText')} loading="eager" decoding="async" className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg" />
              </div>
            </motion.section>
          )}

          {step === 10 && (
            <motion.section 
              key="step10"
              custom={swipeDirection}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="mt-6 text-center flex flex-col items-center relative"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={themeView}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="text-center"
                >
                  <h1 className="text-2xl font-bold text-gray-900 mb-1">{themeFeatures[themeView].title}</h1>
                  <p className="text-gray-500 text-sm mb-3">{themeFeatures[themeView].subtitle}</p>
                </motion.div>
              </AnimatePresence>
              
              {/* Theme Toggle Switcher */}
              <div 
                className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-full"
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
              >
                {[0, 1, 2, 3, 4].map((idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHaptic('light');
                      setThemeView(idx);
                    }}
                    onTouchEnd={(e) => e.stopPropagation()}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                      themeView === idx
                        ? 'bg-primary text-white shadow-md'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
              
              <div
                onTouchStart={handleThemeTouchStart}
                onTouchMove={handleThemeTouchMove}
                onTouchEnd={handleThemeTouchEnd}
                className="touch-pan-y"
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={themeView}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className="relative"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
                    <img 
                      src={themeFeatures[themeView].image} 
                      alt={themeFeatures[themeView].title} 
                      loading="eager" 
                      decoding="async" 
                      className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg pointer-events-none" 
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {step === 11 && (
          <motion.section 
            key="step11"
            custom={swipeDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-6 text-center flex flex-col items-center relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.features.organizeData')}</h1>
            <p className="text-gray-500 text-sm mb-3">{t('onboarding.features.organizeDataDesc')}</p>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
              <img src={featureTables} alt={t('onboarding.features.organizeData')} loading="eager" decoding="async" className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg" />
            </div>
          </motion.section>
        )}

        {step === 12 && (
          <motion.section 
            key="step12"
            custom={swipeDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-6 text-center flex flex-col items-center relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.features.captureEveryMoment')}</h1>
            <p className="text-gray-500 text-sm mb-3">{t('onboarding.features.captureEveryMomentDesc')}</p>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
              <img src={featureMedia} alt={t('onboarding.features.captureEveryMoment')} loading="eager" decoding="async" className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg" />
            </div>
          </motion.section>
        )}

        {step === 13 && (
          <motion.section 
            key="step13"
            custom={swipeDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-6 text-center flex flex-col items-center relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.features.stayOrganized')}</h1>
            <p className="text-gray-500 text-sm mb-3">{t('onboarding.features.stayOrganizedDesc')}</p>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
              <img src={featureFolders} alt={t('onboarding.features.stayOrganized')} loading="eager" decoding="async" className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg" />
            </div>
          </motion.section>
        )}

        {step === 14 && (
          <motion.section 
            key="step14"
            custom={swipeDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-6 text-center flex flex-col items-center relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.features.addTasksSeconds')}</h1>
            <p className="text-gray-500 text-sm mb-3">{t('onboarding.features.addTasksSecondsDesc')}</p>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
              <img src={featureTaskInput} alt={t('onboarding.features.addTasksSeconds')} loading="eager" decoding="async" className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg" />
            </div>
          </motion.section>
        )}

        {step === 15 && (
          <motion.section 
            key="step15-showcase"
            custom={swipeDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-6 text-center flex flex-col items-center relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={showcaseView}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <h1 className="text-2xl font-bold text-gray-900 mb-1">{showcaseFeatures[showcaseView].title}</h1>
                <p className="text-gray-500 text-sm mb-3">{showcaseFeatures[showcaseView].subtitle}</p>
              </motion.div>
            </AnimatePresence>
            
            {/* Toggle Switcher */}
            <div className="flex gap-2 mb-4" onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => { e.stopPropagation(); triggerHaptic('light'); setShowcaseView(0); }}
                onTouchEnd={(e) => e.stopPropagation()}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${showcaseView === 0 ? 'bg-primary text-primary-foreground' : 'bg-gray-100 text-gray-600'}`}
              >
                {t('onboarding.showcase.folders')}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); triggerHaptic('light'); setShowcaseView(1); }}
                onTouchEnd={(e) => e.stopPropagation()}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${showcaseView === 1 ? 'bg-primary text-primary-foreground' : 'bg-gray-100 text-gray-600'}`}
              >
                {t('onboarding.showcase.avatars')}
              </button>
            </div>
            
            <div 
              className="relative"
              onTouchStart={handleShowcaseTouchStart}
              onTouchMove={handleShowcaseTouchMove}
              onTouchEnd={handleShowcaseTouchEnd}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
              <AnimatePresence mode="wait">
                <motion.img
                  key={showcaseView}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  src={showcaseFeatures[showcaseView].image}
                  alt={showcaseFeatures[showcaseView].title}
                  loading="eager"
                  decoding="async"
                  className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg"
                />
              </AnimatePresence>
            </div>
          </motion.section>
        )}

        {step === 16 && (
          <motion.section 
            key="step16"
            custom={swipeDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-6 text-center flex flex-col items-center relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.features.seeTasks')}</h1>
            <p className="text-gray-500 text-sm mb-3">{t('onboarding.features.seeTasksDesc')}</p>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
              <img src={featureTaskList} alt={t('onboarding.features.seeTasks')} loading="eager" decoding="async" className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg" />
            </div>
          </motion.section>
        )}

        {step === 17 && (
          <motion.section 
            key="step17"
            custom={swipeDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-6 text-center flex flex-col items-center relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.features.focusMatters')}</h1>
            <p className="text-gray-500 text-sm mb-3">{t('onboarding.features.focusMattersDesc')}</p>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
              <img src={featurePriority} alt={t('onboarding.features.focusMatters')} loading="eager" decoding="async" className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg" />
            </div>
          </motion.section>
        )}

        {step === 18 && (
          <motion.section 
            key="step18"
            custom={swipeDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-6 text-center flex flex-col items-center relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.features.powerfulOptions')}</h1>
            <p className="text-gray-500 text-sm mb-3">{t('onboarding.features.powerfulOptionsDesc')}</p>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
              <img src={featureOptions} alt={t('onboarding.features.powerfulOptions')} loading="eager" decoding="async" className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg" />
            </div>
          </motion.section>
        )}

        {step === 19 && (
          <motion.section 
            key="step19"
            custom={swipeDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-6 text-center flex flex-col items-center relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.features.dragDropDone')}</h1>
            <p className="text-gray-500 text-sm mb-3">{t('onboarding.features.dragDropDoneDesc')}</p>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
              <img src={featureDragDrop} alt={t('onboarding.features.dragDropDone')} loading="eager" decoding="async" className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg" />
            </div>
          </motion.section>
        )}

        {step === 20 && (
          <motion.section 
            key="step20"
            custom={swipeDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-6 text-center flex flex-col items-center relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.features.smartFolders')}</h1>
            <p className="text-gray-500 text-sm mb-3">{t('onboarding.features.smartFoldersDesc')}</p>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
              <img src={featurePriorityFolders} alt={t('onboarding.features.smartFolders')} loading="eager" decoding="async" className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg" />
            </div>
          </motion.section>
        )}

        {step === 21 && (
          <motion.section 
            key="step21"
            custom={swipeDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-6 text-center flex flex-col items-center relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.features.customizeEverything')}</h1>
            <p className="text-gray-500 text-sm mb-3">{t('onboarding.features.customizeEverythingDesc')}</p>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
              <img src={featureCustomActions} alt={t('onboarding.features.customizeEverything')} loading="eager" decoding="async" className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg" />
            </div>
          </motion.section>
        )}

        {step === 22 && (
          <motion.section 
            key="step22"
            custom={swipeDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-6 text-center flex flex-col items-center relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.features.breakDownGoals')}</h1>
            <p className="text-gray-500 text-sm mb-3">{t('onboarding.features.breakDownGoalsDesc')}</p>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
              <img src={featureSubtasksTracking} alt={t('onboarding.features.breakDownGoals')} loading="eager" decoding="async" className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg" />
            </div>
          </motion.section>
        )}

        {step === 23 && (
          <motion.section 
            key="step23"
            custom={swipeDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-6 text-center flex flex-col items-center relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.features.celebrateWins')}</h1>
            <p className="text-gray-500 text-sm mb-3">{t('onboarding.features.celebrateWinsDesc')}</p>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
              <img src={featureCompletedTasks} alt={t('onboarding.features.celebrateWins')} loading="eager" decoding="async" className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg" />
            </div>
          </motion.section>
        )}

        {step === 24 && (
          <motion.section 
            key="step24"
            custom={swipeDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-6 text-center flex flex-col items-center relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.features.scheduleBoss')}</h1>
            <p className="text-gray-500 text-sm mb-3">{t('onboarding.features.scheduleBossDesc')}</p>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
              <img src={featureDateTime} alt={t('onboarding.features.scheduleBoss')} loading="eager" decoding="async" className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg" />
            </div>
          </motion.section>
        )}

        {step === 25 && (
          <motion.section 
            key="step25"
            custom={swipeDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-6 text-center flex flex-col items-center relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.features.bulkActions')}</h1>
            <p className="text-gray-500 text-sm mb-3">{t('onboarding.features.bulkActionsDesc')}</p>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
              <img src={featureBatchActions} alt={t('onboarding.features.bulkActions')} loading="eager" decoding="async" className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg" />
            </div>
          </motion.section>
        )}

        {step === 26 && (
          <motion.section 
            key="step26"
            custom={swipeDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-6 text-center flex flex-col items-center relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.features.addTenTasks')}</h1>
            <p className="text-gray-500 text-sm mb-3">{t('onboarding.features.addTenTasksDesc')}</p>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
              <img src={featureMultipleTasks} alt={t('onboarding.features.addTenTasks')} loading="eager" decoding="async" className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg" />
            </div>
          </motion.section>
        )}

        {step === 27 && (
          <motion.section 
            key="step27"
            custom={swipeDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-6 text-center flex flex-col items-center relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.features.productivityTools')}</h1>
            <p className="text-gray-500 text-sm mb-3">{t('onboarding.features.productivityToolsDesc')}</p>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
              <img src={featureProductivityTools} alt={t('onboarding.features.productivityTools')} loading="eager" decoding="async" className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg" />
            </div>
          </motion.section>
        )}

        {step === 28 && (
          <motion.section 
            key="step28"
            custom={swipeDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-6 text-center flex flex-col items-center relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('onboarding.features.swipeConquer')}</h1>
            <p className="text-gray-500 text-sm mb-3">{t('onboarding.features.swipeConquerDesc')}</p>
            
            {/* Swipe Action Toggle Switcher */}
            <div className="flex gap-2 mb-4" onTouchStart={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => { e.stopPropagation(); triggerHaptic('light'); setSwipeActionView(0); }}
                onTouchEnd={(e) => e.stopPropagation()}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${swipeActionView === 0 ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                {t('onboarding.swipeActions.swipeComplete')}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); triggerHaptic('light'); setSwipeActionView(1); }}
                onTouchEnd={(e) => e.stopPropagation()}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${swipeActionView === 1 ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                {t('onboarding.swipeActions.swipeDelete')}
              </button>
            </div>
            
            <div 
              className="relative"
              onTouchStart={handleSwipeActionTouchStart}
              onTouchMove={handleSwipeActionTouchMove}
              onTouchEnd={handleSwipeActionTouchEnd}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-50"></div>
              <AnimatePresence mode="wait">
                <motion.img
                  key={swipeActionView}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  src={swipeActionView === 0 ? featureSwipeComplete : featureSwipeDelete}
                  alt={swipeActionView === 0 ? t('onboarding.swipeActions.swipeComplete') : t('onboarding.swipeActions.swipeDelete')}
                  loading="eager"
                  decoding="async"
                  className="w-[240px] h-auto object-contain relative z-10 rounded-2xl shadow-lg"
                />
              </AnimatePresence>
            </div>
          </motion.section>
        )}

        {step === 29 && (
          <motion.section 
            key="step29"
            custom={swipeDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-6 text-center flex flex-col items-center relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('onboarding.testimonials.title')}</h1>
            <p className="text-gray-500 text-sm mb-6">{t('onboarding.testimonials.subtitle')}</p>
            
            <div className="space-y-4 w-full max-w-sm">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-primary/5 to-blue-50 rounded-2xl p-4 text-left"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex text-yellow-400">
                    {'★★★★★'.split('').map((star, i) => <span key={i}>{star}</span>)}
                  </div>
                </div>
                <p className="text-gray-700 text-sm mb-2">"{t('onboarding.testimonials.review1')}"</p>
                <p className="text-gray-500 text-xs font-medium">{t('onboarding.testimonials.reviewer1')}</p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 text-left"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex text-yellow-400">
                    {'★★★★★'.split('').map((star, i) => <span key={i}>{star}</span>)}
                  </div>
                </div>
                <p className="text-gray-700 text-sm mb-2">"{t('onboarding.testimonials.review2')}"</p>
                <p className="text-gray-500 text-xs font-medium">{t('onboarding.testimonials.reviewer2')}</p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 text-left"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex text-yellow-400">
                    {'★★★★★'.split('').map((star, i) => <span key={i}>{star}</span>)}
                  </div>
                </div>
                <p className="text-gray-700 text-sm mb-2">"{t('onboarding.testimonials.review3')}"</p>
                <p className="text-gray-500 text-xs font-medium">{t('onboarding.testimonials.reviewer3')}</p>
              </motion.div>
            </div>
          </motion.section>
        )}

        {step === 30 && (
          <section className="mt-8">
            <h1 className="text-2xl font-semibold text-gray-900">{t('onboarding.howFoundUs')}</h1>
            <p className="text-gray-400 mt-2">{t('onboarding.selectPlatform')}</p>

            <div className="mt-6 space-y-4 pb-24">
              {sources.map(s => (
                <button key={s.name} onClick={() => setSource(s.name)} className={`flex items-center gap-3 rounded-2xl py-4 px-4 w-full transition border text-left ${source === s.name ? 'bg-primary text-primary-foreground border-primary' : 'text-gray-800 border-gray-100'}`} style={source !== s.name ? { backgroundColor: '#f9f8fd' } : {}}>
                  <img src={s.logo} alt={s.name} loading="eager" decoding="async" className="w-6 h-6" style={{ filter: 'none' }} />
                  <span className="text-base font-medium" style={{ color: source === s.name ? '#fff' : s.color }}>{s.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Step 31 - Removed Google Sign-In - Auto continue */}
        {step === 31 && (
          <motion.section 
            key="step31"
            custom={swipeDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex-1 flex flex-col items-center justify-center px-6"
            onAnimationComplete={() => {
              // Skip this step immediately
              handleContinue();
            }}
          >
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">{t('onboarding.loading.settingUp', 'Setting up...')}</p>
          </motion.section>
        )}

        {step === 32 && (
          <section className="mt-20 text-center">
            <h1 className="text-5xl font-bold mb-4">{progress}%</h1>
            <p className="text-lg font-semibold mb-4">{t('onboarding.loading.settingUp')}</p>

            <div className="w-72 h-2 mx-auto rounded-full bg-gray-200 overflow-hidden">
              <motion.div className="h-full bg-gradient-to-r from-primary to-blue-400" initial={{ width: '0%' }} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
            </div>

            <div className="mt-8 rounded-2xl p-5 w-80 mx-auto" style={{ backgroundColor: '#f9f8fd' }}>
              <h2 className="font-semibold text-lg mb-2">{t('onboarding.loading.preparingFeatures')}</h2>
              {[
                t('onboarding.loading.notesVoiceMemos'),
                t('onboarding.loading.tasksReminders'),
                t('onboarding.loading.foldersOrganization'),
                t('onboarding.loading.calendarView'),
                t('onboarding.loading.templates')
              ].map((item, i) => (
                <div key={i} className="py-2 text-left">
                  <div className="flex justify-between mb-1">
                    <span>{item}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
                    <motion.div className="h-full bg-primary" initial={{ width: '0%' }} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="mt-8 space-y-4">
        {step !== 31 && step !== 32 && (
          <button
            onClick={handleContinue}
            className="w-full btn-duo"
          >
            {t('onboarding.continue')}
          </button>
        )}
      </div>
    </div>
  );
}
