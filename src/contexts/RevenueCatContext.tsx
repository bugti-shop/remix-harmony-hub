// Backward compatibility re-exports - all billing is now unified in SubscriptionContext
export { useRevenueCat, useSubscription, SubscriptionProvider as RevenueCatProvider, ENTITLEMENT_ID, PRODUCT_IDS, REVENUECAT_API_KEY } from '@/contexts/SubscriptionContext';
export type { ProductType } from '@/contexts/SubscriptionContext';
