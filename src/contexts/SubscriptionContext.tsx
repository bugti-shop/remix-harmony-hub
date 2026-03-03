import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import { getStoredGoogleUser } from '@/utils/googleAuth';
import { Capacitor } from '@capacitor/core';
import {
  Purchases,
  LOG_LEVEL,
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
  PACKAGE_TYPE,
  PAYWALL_RESULT,
  PurchasesCallbackId
} from '@revenuecat/purchases-capacitor';
import { RevenueCatUI } from '@revenuecat/purchases-capacitor-ui';

// RevenueCat API Key - This is a public key safe to include in the app
const REVENUECAT_API_KEY = 'goog_WLSvWlyHHLzNAgIfhCzAYsGaZyh';

// Entitlement identifier
const ENTITLEMENT_ID = 'npd Pro';

// Product identifiers
const PRODUCT_IDS = {
  weekly: 'nnppd_weekly:nnnpd-weekly',
  monthly: 'npd_mo:npd-mo',
  yearly: 'npd_yr:npd-yearly-plan',
} as const;

export type ProductType = keyof typeof PRODUCT_IDS;
export type SubscriptionTier = 'free' | 'premium';
export type SubscriptionPlanType = 'none' | 'weekly' | 'monthly' | 'yearly';

// All premium features list
export const PREMIUM_FEATURES = [
  'linkedin_formatter',
  'note_templates',
  'app_lock',
  'notes_type_visibility',
  'notes_settings',
  'tasks_settings',
  'quick_add',
  'multiple_tasks',
  'location_reminders',
  'task_status',
  'view_mode_status_board',
  'view_mode_timeline',
  'view_mode_progress',
  'view_mode_priority',
  'view_mode_history',
  'dark_mode',
  'smart_lists',
  'time_tracking',
  'extract_features',
  'backup',
  'deadline_escalation',
  'pin_feature',
  'extra_folders',
  'extra_sections',
  'file_attachments',
  'customize_navigation',
  'sketch',
] as const;

// No features are restricted to specific plan types - all premium features available to all plans
export const RECURRING_ONLY_FEATURES: readonly PremiumFeature[] = [] as const;

export type PremiumFeature = typeof PREMIUM_FEATURES[number];

// Free limits
export const FREE_LIMITS = {
  maxNoteFolders: 3,
  maxTaskFolders: 3,
  maxTaskSections: 1,
  maxNotes: 10,
};

interface UnifiedBillingContextType {
  // Subscription state
  tier: SubscriptionTier;
  planType: SubscriptionPlanType;
  isPro: boolean;
  isRecurringSubscriber: boolean;
  isLoading: boolean;
  
  // Feature gating
  showPaywall: boolean;
  paywallFeature: string | null;
  openPaywall: (feature?: string) => void;
  closePaywall: () => void;
  canUseFeature: (feature: PremiumFeature) => boolean;
  requireFeature: (feature: PremiumFeature) => boolean;
  unlockPro: () => Promise<void>;

  // RevenueCat state
  isInitialized: boolean;
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOfferings | null;
  error: string | null;

  // RevenueCat actions
  initialize: (appUserID?: string) => Promise<void>;
  checkEntitlement: () => Promise<boolean>;
  getOfferings: () => Promise<PurchasesOfferings | null>;
  purchase: (productType: ProductType) => Promise<boolean>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  presentPaywall: () => Promise<PAYWALL_RESULT>;
  presentPaywallIfNeeded: () => Promise<PAYWALL_RESULT>;
  presentCustomerCenter: () => Promise<void>;
  logout: () => Promise<void>;
}

const UnifiedBillingContext = createContext<UnifiedBillingContextType | undefined>(undefined);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  // Local state
  const [localProAccess, setLocalProAccess] = useState(false);
  const [localLoading, setLocalLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState<string | null>(null);

  // RevenueCat state
  const [isInitialized, setIsInitialized] = useState(false);
  const [rcLoading, setRcLoading] = useState(false);
  const [rcIsPro, setRcIsPro] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listenerHandle, setListenerHandle] = useState<PurchasesCallbackId | null>(null);

  // Load local admin bypass on mount + listen for activation
  useEffect(() => {
    const loadLocal = async () => {
      try {
        const adminBypass = await getSetting<boolean>('npd_admin_bypass', false);
        setLocalProAccess(!!adminBypass);
      } catch (e) {
        console.error('Failed to load subscription:', e);
      } finally {
        setLocalLoading(false);
      }
    };
    loadLocal();

    // Listen for admin bypass activation from OnboardingFlow or elsewhere
    const handleAdminBypass = () => {
      setLocalProAccess(true);
    };
    window.addEventListener('adminBypassActivated', handleAdminBypass);
    return () => window.removeEventListener('adminBypassActivated', handleAdminBypass);
  }, []);

  // ==================== RevenueCat Logic ====================

  const initialize = useCallback(async (userID?: string) => {
    if (!Capacitor.isNativePlatform()) {
      console.log('RevenueCat: Skipping initialization on web platform');
      setIsInitialized(true);
      return;
    }

    try {
      setRcLoading(true);
      setError(null);
      await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
      await Purchases.configure({ apiKey: REVENUECAT_API_KEY, appUserID: userID });

      console.log('RevenueCat: SDK configured successfully');

      const { customerInfo: info } = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      const hasEntitlement = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
      setRcIsPro(hasEntitlement);

      const offeringsData = await Purchases.getOfferings();
      setOfferings(offeringsData);

      setIsInitialized(true);
      console.log('RevenueCat: Initialization complete', { isPro: hasEntitlement });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize RevenueCat';
      console.error('RevenueCat: Initialization error', err);
      setError(errorMessage);
    } finally {
      setRcLoading(false);
    }
  }, []);

  const checkEntitlement = useCallback(async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const { customerInfo: info } = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      const hasEntitlement = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
      setRcIsPro(hasEntitlement);
      return hasEntitlement;
    } catch (err) {
      console.error('RevenueCat: Error checking entitlement', err);
      return false;
    }
  }, []);

  const getOfferingsData = useCallback(async (): Promise<PurchasesOfferings | null> => {
    if (!Capacitor.isNativePlatform()) return null;
    try {
      setRcLoading(true);
      const offeringsData = await Purchases.getOfferings();
      setOfferings(offeringsData);
      return offeringsData;
    } catch (err) {
      console.error('RevenueCat: Error fetching offerings', err);
      return null;
    } finally {
      setRcLoading(false);
    }
  }, []);

  const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      setRcLoading(true);
      setError(null);
      const result = await Purchases.purchasePackage({ aPackage: pkg });
      setCustomerInfo(result.customerInfo);
      const hasEntitlement = result.customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
      setRcIsPro(hasEntitlement);
      console.log('RevenueCat: Purchase successful', { isPro: hasEntitlement });
      return hasEntitlement;
    } catch (err: any) {
      if (err.code === 'PURCHASE_CANCELLED' || err.userCancelled) {
        console.log('RevenueCat: Purchase cancelled by user');
        return false;
      }
      const errorMessage = err instanceof Error ? err.message : 'Purchase failed';
      console.error('RevenueCat: Purchase error', err);
      setError(errorMessage);
      return false;
    } finally {
      setRcLoading(false);
    }
  }, []);

  const purchase = useCallback(async (productType: ProductType): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
      console.log('RevenueCat: Purchase not available on web platform');
      return false;
    }
    try {
      setRcLoading(true);
      setError(null);
      const currentOfferings = await Purchases.getOfferings();
      if (!currentOfferings) throw new Error('No offerings available');

      // Collect ALL packages from ALL offerings (current + all named offerings)
      const allPackages: PurchasesPackage[] = [];
      if (currentOfferings.current) {
        allPackages.push(...currentOfferings.current.availablePackages);
      }
      // Also search through all named offerings
      if (currentOfferings.all) {
        Object.values(currentOfferings.all).forEach((offering: any) => {
          if (offering?.availablePackages) {
            offering.availablePackages.forEach((p: PurchasesPackage) => {
              if (!allPackages.find(existing => existing.identifier === p.identifier && existing.product?.identifier === p.product?.identifier)) {
                allPackages.push(p);
              }
            });
          }
        });
      }

      console.log('RevenueCat: All available packages across offerings:', allPackages.map(p => ({
        identifier: p.identifier,
        packageType: p.packageType,
        productIdentifier: p.product?.identifier,
      })));
      console.log('RevenueCat: Looking for productType:', productType, 'with ID:', PRODUCT_IDS[productType]);

      let pkg: any = null;

      const packageTypeMap: Record<ProductType, PACKAGE_TYPE> = {
        weekly: PACKAGE_TYPE.WEEKLY,
        monthly: PACKAGE_TYPE.MONTHLY,
        yearly: PACKAGE_TYPE.ANNUAL,
      };

      const productIdMap: Record<ProductType, string> = {
        weekly: 'nnppd_weekly',
        monthly: 'npd_mo',
        yearly: 'npd_yr',
      };

      // Try finding by package type first, then by product identifier across ALL offerings
      pkg = allPackages.find(p => p.packageType === packageTypeMap[productType])
        || allPackages.find(p => p.product?.identifier === productIdMap[productType])
        || allPackages.find(p => p.product?.identifier?.includes(productIdMap[productType]));

      if (pkg) {
        console.log('RevenueCat: Found package:', pkg.identifier, pkg.product?.identifier);
        return await purchasePackage(pkg);
      }

      // Fallback: purchase directly via store product if not in offerings
      console.log('RevenueCat: Package not found in offerings, trying direct product purchase for:', productIdMap[productType]);
      const fullProductId = PRODUCT_IDS[productType];
      const { products } = await Purchases.getProducts({ 
        productIdentifiers: [productIdMap[productType], fullProductId] 
      });
      console.log('RevenueCat: Found store products:', products.map(p => p.identifier));

      const storeProduct = products.find(p => p.identifier === productIdMap[productType])
        || products.find(p => p.identifier === fullProductId)
        || products[0];

      if (!storeProduct) {
        console.error('RevenueCat: No product found. Tried:', productIdMap[productType], fullProductId);
        throw new Error(`Product not found for ${productType}. Make sure it's added to RevenueCat and Google Play.`);
      }

      console.log('RevenueCat: Purchasing store product directly:', storeProduct.identifier);
      const result = await Purchases.purchaseStoreProduct({ product: storeProduct });
      setCustomerInfo(result.customerInfo);
      const hasEntitlement = result.customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
      setRcIsPro(hasEntitlement);
      return hasEntitlement;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Purchase failed';
      console.error('RevenueCat: Purchase error', err);
      setError(errorMessage);
      return false;
    } finally {
      setRcLoading(false);
    }
  }, [purchasePackage]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      setRcLoading(true);
      setError(null);
      const { customerInfo: info } = await Purchases.restorePurchases();
      setCustomerInfo(info);
      const hasEntitlement = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
      setRcIsPro(hasEntitlement);
      console.log('RevenueCat: Restore successful', { isPro: hasEntitlement });
      return hasEntitlement;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Restore failed';
      console.error('RevenueCat: Restore error', err);
      setError(errorMessage);
      return false;
    } finally {
      setRcLoading(false);
    }
  }, []);

  const presentPaywallRC = useCallback(async (): Promise<PAYWALL_RESULT> => {
    if (!Capacitor.isNativePlatform()) {
      console.log('RevenueCat: Paywall not available on web platform');
      return PAYWALL_RESULT.NOT_PRESENTED;
    }
    try {
      setRcLoading(true);
      const { result } = await RevenueCatUI.presentPaywall();
      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        await checkEntitlement();
      }
      return result;
    } catch (err) {
      console.error('RevenueCat: Paywall error', err);
      return PAYWALL_RESULT.ERROR;
    } finally {
      setRcLoading(false);
    }
  }, [checkEntitlement]);

  const presentPaywallIfNeeded = useCallback(async (): Promise<PAYWALL_RESULT> => {
    if (!Capacitor.isNativePlatform()) {
      return PAYWALL_RESULT.NOT_PRESENTED;
    }
    try {
      setRcLoading(true);
      const { result } = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: ENTITLEMENT_ID,
      });
      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        await checkEntitlement();
      }
      return result;
    } catch (err) {
      console.error('RevenueCat: Paywall error', err);
      return PAYWALL_RESULT.ERROR;
    } finally {
      setRcLoading(false);
    }
  }, [checkEntitlement]);

  const presentCustomerCenter = useCallback(async (): Promise<void> => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await RevenueCatUI.presentCustomerCenter();
      await checkEntitlement();
    } catch (err) {
      console.error('RevenueCat: Customer Center error', err);
    }
  }, [checkEntitlement]);

  const logout = useCallback(async (): Promise<void> => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Purchases.logOut();
      setCustomerInfo(null);
      setRcIsPro(false);
      setIsInitialized(false);
    } catch (err) {
      console.error('RevenueCat: Logout error', err);
    }
  }, []);

  // Auto-initialize RevenueCat on mount
  useEffect(() => {
    if (!isInitialized && Capacitor.isNativePlatform()) {
      const initWithGoogleUser = async () => {
        try {
          const storedUser = await getStoredGoogleUser();
          await initialize(storedUser?.email || undefined);
        } catch {
          await initialize();
        }
      };
      initWithGoogleUser();
    } else if (!Capacitor.isNativePlatform()) {
      setIsInitialized(true);
    }
  }, [initialize, isInitialized]);

  // Listen for customer info updates
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let isMounted = true;

    const setupListener = async () => {
      try {
        const handle = await Purchases.addCustomerInfoUpdateListener((info: CustomerInfo) => {
          if (isMounted) {
            console.log('RevenueCat: Customer info updated');
            setCustomerInfo(info);
            const hasEntitlement = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
            setRcIsPro(hasEntitlement);
          }
        });
        if (isMounted) setListenerHandle(handle);
      } catch (err) {
        console.error('RevenueCat: Error setting up listener', err);
      }
    };

    setupListener();

    return () => {
      isMounted = false;
      if (listenerHandle) {
        Purchases.removeCustomerInfoUpdateListener({ listenerToRemove: listenerHandle }).catch(console.error);
      }
    };
  }, []);

  // ==================== Unified isPro ====================
  const isPro = localProAccess || (Capacitor.isNativePlatform() ? rcIsPro : false);
  const tier: SubscriptionTier = isPro ? 'premium' : 'free';
  const isLoading = localLoading || rcLoading || (Capacitor.isNativePlatform() && !isInitialized);

  // Detect plan type from RevenueCat entitlement
  const planType: SubscriptionPlanType = useMemo(() => {
    if (!isPro) return 'none';
    if (localProAccess) return 'monthly';
    if (!customerInfo) return 'none';
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
    if (!entitlement) return 'none';
    const productId = entitlement.productIdentifier || '';
    if (productId.includes('_yr') || productId.includes('yearly') || productId.includes('annual')) return 'yearly';
    if (productId.includes('weekly') || productId.includes('_wk')) return 'weekly';
    if (productId === PRODUCT_IDS.monthly || productId.includes('month') || productId.includes('mo')) return 'monthly';
    return 'none';
  }, [isPro, customerInfo, localProAccess]);

  const isRecurringSubscriber = planType === 'monthly' || planType === 'weekly' || planType === 'yearly';

  // ==================== Feature Gating ====================

  const canUseFeature = useCallback((feature: PremiumFeature): boolean => {
    if (!isPro) return false;
    if ((RECURRING_ONLY_FEATURES as readonly string[]).includes(feature)) {
      return isRecurringSubscriber;
    }
    return true;
  }, [isPro, isRecurringSubscriber]);

  const requireFeature = useCallback((feature: PremiumFeature): boolean => {
    if ((RECURRING_ONLY_FEATURES as readonly string[]).includes(feature)) {
      if (isRecurringSubscriber) return true;
      setPaywallFeature(feature);
      setShowPaywall(true);
      return false;
    }
    if (isPro) return true;
    setPaywallFeature(feature);
    setShowPaywall(true);
    return false;
  }, [isPro, isRecurringSubscriber]);

  const openPaywall = useCallback((feature?: string) => {
    setPaywallFeature(feature || null);
    setShowPaywall(true);
  }, []);

  const closePaywall = useCallback(() => {
    setShowPaywall(false);
    setPaywallFeature(null);
  }, []);

  const unlockPro = useCallback(async () => {
    await setSetting('npd_admin_bypass', true);
    setLocalProAccess(true);
    setShowPaywall(false);
    setPaywallFeature(null);
  }, []);

  return (
    <UnifiedBillingContext.Provider
      value={{
        // Subscription
        tier,
        planType,
        isPro,
        isRecurringSubscriber,
        isLoading,
        // Feature gating
        showPaywall,
        paywallFeature,
        openPaywall,
        closePaywall,
        canUseFeature,
        requireFeature,
        unlockPro,
        // RevenueCat
        isInitialized,
        customerInfo,
        offerings,
        error,
        initialize,
        checkEntitlement,
        getOfferings: getOfferingsData,
        purchase,
        purchasePackage,
        restorePurchases,
        presentPaywall: presentPaywallRC,
        presentPaywallIfNeeded,
        presentCustomerCenter,
        logout,
      }}
    >
      {children}
    </UnifiedBillingContext.Provider>
  );
};

// Primary hook - unified billing
export const useSubscription = () => {
  const context = useContext(UnifiedBillingContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
};

// Backward-compatible alias for useRevenueCat consumers
export const useRevenueCat = () => useSubscription();

// Re-export constants
export { ENTITLEMENT_ID, PRODUCT_IDS, REVENUECAT_API_KEY };
