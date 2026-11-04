import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PurchasesPackage,
  CustomerInfo,
} from 'react-native-purchases';
import { PlanTier } from '../components/PaywallModal';

// RevenueCat API keys (Production iOS & Android SDK keys + Test Store fallback)
export const REVENUECAT_CONFIG = {
  iosApiKey: 'appl_rAOYNjJMUDrVIcmzvfeRUJHFLKy',
  androidApiKey: 'goog_UTtchgepALqNSJJXCktiDPLTqfp',
  testStoreApiKey: 'test_FpZHVOcqKAqEpNxfTJmEyyDuzST',
  entitlementId: 'pepcalc',
  productIds: {
    lifetime: 'com.thomasaldrin.pepcalc.lifetime',
    annual: 'com.thomasaldrin.pepcalc.annual',
    monthly: 'com.thomasaldrin.pepcalc.monthly',
  },
};

let isConfigured = false;

export async function initializeRevenueCat(): Promise<boolean> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return false;
  }

  try {
    if (!isConfigured) {
      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.WARN);
      const apiKey =
        Platform.OS === 'ios'
          ? REVENUECAT_CONFIG.iosApiKey
          : REVENUECAT_CONFIG.androidApiKey;

      Purchases.configure({ apiKey });
      isConfigured = true;
    }

    const customerInfo = await Purchases.getCustomerInfo();
    return checkProEntitlement(customerInfo);
  } catch (err) {
    console.warn('[RevenueCat] Initialization / Preview fallback:', err);
    return false;
  }
}

export function checkProEntitlement(customerInfo: CustomerInfo): boolean {
  if (
    customerInfo?.entitlements?.active?.[REVENUECAT_CONFIG.entitlementId] !==
    undefined
  ) {
    return true;
  }
  return (
    Object.keys(customerInfo?.entitlements?.active || {}).length > 0 ||
    (customerInfo?.nonSubscriptionTransactions || []).length > 0
  );
}

export async function getAvailablePackages(): Promise<
  Record<PlanTier, PurchasesPackage | null>
> {
  const result: Record<PlanTier, PurchasesPackage | null> = {
    lifetime: null,
    annual: null,
    monthly: null,
  };

  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return result;
  }

  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return result;

    result.lifetime =
      current.lifetime ||
      current.availablePackages.find((p) =>
        p.identifier.toLowerCase().includes('lifetime')
      ) ||
      null;

    result.annual =
      current.annual ||
      current.availablePackages.find(
        (p) =>
          p.identifier.toLowerCase().includes('annual') ||
          p.identifier.toLowerCase().includes('year')
      ) ||
      null;

    result.monthly =
      current.monthly ||
      current.availablePackages.find((p) =>
        p.identifier.toLowerCase().includes('month')
      ) ||
      null;
  } catch (err) {
    console.warn('[RevenueCat] Failed to fetch offerings:', err);
  }

  return result;
}

export async function purchasePlanTier(tier: PlanTier): Promise<{
  success: boolean;
  cancelled?: boolean;
  errorMessage?: string;
}> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { success: __DEV__ };
  }

  try {
    const packages = await getAvailablePackages();
    const pkg = packages[tier];

    if (pkg) {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return { success: checkProEntitlement(customerInfo) };
    }

    if (__DEV__) {
      return { success: true };
    }

    return {
      success: false,
      errorMessage:
        'Unable to connect to the App Store right now. Please check your connection and try again.',
    };
  } catch (err: any) {
    if (err?.userCancelled) {
      return { success: false, cancelled: true };
    }
    console.warn('[RevenueCat] Purchase error:', err);
    return {
      success: false,
      errorMessage:
        err?.message ||
        'Your purchase could not be completed. Please try again.',
    };
  }
}

export async function restoreUserPurchases(): Promise<boolean> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return false;
  }

  try {
    const customerInfo = await Purchases.restorePurchases();
    return checkProEntitlement(customerInfo);
  } catch (err) {
    console.warn('[RevenueCat] Restore error:', err);
    return false;
  }
}
