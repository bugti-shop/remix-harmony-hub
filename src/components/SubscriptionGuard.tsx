import { useCallback } from 'react';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface SubscriptionGuardProps {
  children: React.ReactNode;
  onSubscriptionExpired?: () => void;
}

// SubscriptionGuard renders children - actual gating is done via requireFeature()
export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  return <>{children}</>;
}

// Hook for components that need to check subscription status
export function useSubscriptionGuard() {
  const { isPro, customerInfo } = useSubscription();

  const requireSubscription = useCallback(async (): Promise<boolean> => {
    return isPro;
  }, [isPro]);

  const getSubscriptionStatus = useCallback(() => {
    if (!customerInfo) {
      return { isActive: isPro, expirationDate: null, willRenew: false };
    }

    const entitlement = customerInfo.entitlements.active['npd Pro'];
    
    if (!entitlement) {
      return { isActive: isPro, expirationDate: null, willRenew: false };
    }

    return {
      isActive: true,
      expirationDate: entitlement.expirationDate ? new Date(entitlement.expirationDate) : null,
      willRenew: entitlement.willRenew ?? false,
    };
  }, [customerInfo, isPro]);

  return {
    isPro,
    requireSubscription,
    getSubscriptionStatus,
  };
}
