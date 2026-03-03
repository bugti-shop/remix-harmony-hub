// Billing Configuration - Product and entitlement identifiers for RevenueCat

import { Capacitor } from '@capacitor/core';

// Entitlement identifier - matches RevenueCat dashboard
export const ENTITLEMENT_ID = 'npd Pro';

// Product identifiers - matches RevenueCat dashboard and store products
export const BILLING_CONFIG = {
  weekly: {
    productId: 'nnppd_weekly:nnnpd-weekly',
    basePlanId: 'nnnpd-weekly',
  },
  monthly: {
    productId: 'npd_mo:npd-mo',
    basePlanId: 'npd-mo',
  },
  yearly: {
    productId: 'npd_yr:npd-yearly-plan',
    basePlanId: 'npd-yearly-plan',
  },
} as const;

export type PlanType = keyof typeof BILLING_CONFIG;

export interface SubscriptionProduct {
  productId: string;
  basePlanId?: string;
  purchaseOptionId?: string;
}

export const getSubscriptionDetails = (plan: PlanType): SubscriptionProduct => {
  return BILLING_CONFIG[plan];
};

// Pricing display (for UI only - actual pricing comes from RevenueCat/Store)
export const PRICING_DISPLAY = {
  weekly: {
    price: '$1.99',
    period: 'week',
    displayPrice: '$1.99/wk',
  },
  monthly: {
    price: '$5.99',
    period: 'month',
    displayPrice: '$5.99/mo',
  },
  yearly: {
    price: '$39.99',
    period: 'year',
    displayPrice: '$39.99/yr',
  },
} as const;

export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};
