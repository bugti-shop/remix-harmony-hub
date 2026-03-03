import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Crown, Unlock, Bell, Loader2, MapPin, Check } from 'lucide-react';
import { useSubscription, ProductType } from '@/contexts/SubscriptionContext';
import { Capacitor } from '@capacitor/core';
import { triggerHaptic } from '@/utils/haptics';
import { useHardwareBackButton } from '@/hooks/useHardwareBackButton';

const PLANS = [
  { id: 'weekly' as ProductType, label: 'Weekly', price: '$1.99/wk', badge: null },
  { id: 'monthly' as ProductType, label: 'Monthly', price: '$5.99/mo', badge: 'Popular' },
  { id: 'yearly' as ProductType, label: 'Yearly', price: '$39.99/yr', badge: 'Best Value' },
] as const;

export const PremiumPaywall = () => {
  const { t } = useTranslation();
  const { showPaywall, closePaywall, unlockPro, purchase } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<ProductType>('monthly');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [showAdminInput, setShowAdminInput] = useState(false);
  const [adminError, setAdminError] = useState('');

  useHardwareBackButton({
    onBack: () => { closePaywall(); },
    enabled: showPaywall,
    priority: 'sheet',
  });

  if (!showPaywall) return null;

  const currentPlan = PLANS.find(p => p.id === selectedPlan)!;

  const handlePurchase = async () => {
    setIsPurchasing(true);
    setAdminError('');
    try {
      if (Capacitor.isNativePlatform()) {
        const success = await purchase(selectedPlan);
        if (success) {
          closePaywall();
        } else {
          setAdminError('Purchase was cancelled or failed. Please try again.');
          setTimeout(() => setAdminError(''), 4000);
        }
      } else {
        await unlockPro();
      }
    } catch (error: any) {
      if (error.code !== 'PURCHASE_CANCELLED' && !error.userCancelled) {
        console.error('Purchase failed:', error);
        setAdminError(`Purchase failed: ${error.message || 'Please try again.'}`);
        setTimeout(() => setAdminError(''), 5000);
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const { Purchases } = await import('@revenuecat/purchases-capacitor');
        const { customerInfo } = await Purchases.restorePurchases();
        const hasEntitlement = customerInfo.entitlements.active['npd Pro'] !== undefined;
        if (hasEntitlement) {
          await unlockPro();
        } else {
          setAdminError('No purchases found');
          setTimeout(() => setAdminError(''), 3000);
        }
      } else {
        setAdminError('No purchases found');
        setTimeout(() => setAdminError(''), 3000);
      }
    } catch (error) {
      console.error('Restore failed:', error);
      setAdminError('Restore failed');
      setTimeout(() => setAdminError(''), 3000);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleAccessCode = async () => {
    const validCode = 'BUGTI';
    if (adminCode.trim().toUpperCase() === validCode) {
      const { setSetting } = await import('@/utils/settingsStorage');
      await setSetting('npd_admin_bypass', true);
      await unlockPro();
    } else {
      setAdminError('Invalid access code');
      setAdminCode('');
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}>
      {/* Close button */}
      <div className="flex justify-end px-4 py-2">
        <button onClick={closePaywall} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
          <X className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6">
        <h1 className="text-3xl font-bold text-center mb-6">{t('onboarding.paywall.upgradeTitle')}</h1>
        
        {/* Feature timeline */}
        <div className="flex flex-col items-start mx-auto w-80 relative">
          <div className="absolute left-[10.5px] top-[20px] bottom-[20px] w-[11px] bg-primary/20 rounded-b-full"></div>

           <div className="flex items-start gap-3 mb-6 relative">
             <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground z-10 flex-shrink-0">
               <Unlock size={16} strokeWidth={2} />
             </div>
             <div>
               <p className="font-semibold">{t('onboarding.paywall.unlockAllFeatures')}</p>
               <p className="text-muted-foreground text-sm">{t('onboarding.paywall.unlockAllFeaturesDesc')}</p>
             </div>
           </div>
           <div className="flex items-start gap-3 mb-6 relative">
             <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground z-10 flex-shrink-0">
               <Bell size={16} strokeWidth={2} />
             </div>
             <div>
               <p className="font-semibold">{t('onboarding.paywall.unlimitedEverything')}</p>
               <p className="text-muted-foreground text-sm">{t('onboarding.paywall.unlimitedEverythingDesc')}</p>
             </div>
           </div>
           <div className="flex items-start gap-3 mb-6 relative">
             <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground z-10 flex-shrink-0">
               <Crown size={16} strokeWidth={2} />
             </div>
             <div>
               <p className="font-semibold">{t('onboarding.paywall.proMember')}</p>
               <p className="text-muted-foreground text-sm">{t('onboarding.paywall.proMemberDesc')}</p>
             </div>
           </div>
        </div>

        {/* Plan selection */}
        <div className="mt-10 flex flex-col items-center gap-4">
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

          <div className="flex flex-col items-center gap-2">
            <button 
              onClick={handlePurchase}
              disabled={isPurchasing}
              className="w-80 mt-4 btn-duo disabled:opacity-50"
            >
              {isPurchasing ? t('onboarding.paywall.processing') : `Continue with ${currentPlan.label} — ${currentPlan.price}`}
            </button>

            <button 
              onClick={handleRestore}
              disabled={isRestoring}
              className="text-primary font-medium text-sm mt-2 disabled:opacity-50"
            >
              {isRestoring ? t('onboarding.paywall.restoring') : t('onboarding.paywall.restorePurchase')}
            </button>

            {adminError && (
              <p className="text-destructive text-xs mt-1">{adminError}</p>
            )}

            {/* Access Code */}
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
                      onClick={handleAccessCode}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                    >
                      {t('onboarding.paywall.apply')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
