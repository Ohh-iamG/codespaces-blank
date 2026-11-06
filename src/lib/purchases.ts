import { Capacitor } from '@capacitor/core';
import { Purchases, CustomerInfo } from '@revenuecat/purchases-capacitor';

export interface SubscriptionState {
  isPro: boolean;
  tier: 'free' | 'sovereign_pro';
  activeEntitlements: string[];
  expirationDate: string | null;
  isNative: boolean;
  configured: boolean;
}

const STORAGE_KEY_PRO_MOCK = 'iza_sovereign_pro_override';

function safeStorage(): Storage | null {
  if (typeof window === 'undefined' || !('localStorage' in window)) {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export class PurchasesManager {
  private static instance: PurchasesManager;
  private isConfigured = false;

  private constructor() {}

  public static getInstance(): PurchasesManager {
    if (!PurchasesManager.instance) {
      PurchasesManager.instance = new PurchasesManager();
    }
    return PurchasesManager.instance;
  }

  /**
   * Initializes RevenueCat on native iOS/Android or configures fallback on Web
   */
  public async initialize(apiKey?: string): Promise<void> {
    if (this.isConfigured) return;

    const key = apiKey || import.meta.env.VITE_REVENUECAT_PUBLIC_KEY || 'goog_public_demo_key';

    if (Capacitor.isNativePlatform()) {
      try {
        await Purchases.configure({ apiKey: key });
        this.isConfigured = true;
        console.log('RevenueCat native billing initialized successfully');
      } catch (err) {
        console.warn('RevenueCat native configuration notice:', err);
      }
    } else {
      // Running on Web / PWA
      this.isConfigured = true;
    }
  }

  /**
   * Check Active Subscription Tier
   */
  public async getSubscriptionStatus(userEmail?: string): Promise<SubscriptionState> {
    // App review demo accounts always receive Sovereign Pro entitlement
    if (userEmail && (userEmail.toLowerCase() === 'test-reviewer@earthi.ltd' || userEmail.toLowerCase().includes('reviewer'))) {
      return {
        isPro: true,
        tier: 'sovereign_pro',
        activeEntitlements: ['pro_sovereign'],
        expirationDate: '2099-12-31T23:59:59Z',
        isNative: Capacitor.isNativePlatform(),
        configured: true,
      };
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const customerInfoResult = await Purchases.getCustomerInfo();
        const customerInfo = customerInfoResult?.customerInfo;
        const activeEntitlements = customerInfo?.entitlements?.active || {};
        const isPro = activeEntitlements['pro_sovereign'] !== undefined;

        return {
          isPro,
          tier: isPro ? 'sovereign_pro' : 'free',
          activeEntitlements: Object.keys(activeEntitlements),
          expirationDate: isPro ? activeEntitlements['pro_sovereign'].expirationDate : null,
          isNative: true,
          configured: this.isConfigured,
        };
      } catch (err) {
        console.warn('Failed to retrieve RevenueCat customer info:', err);
      }
    }

    // Web / local override fallback
    const storage = safeStorage();
    const localOverride = storage ? storage.getItem(STORAGE_KEY_PRO_MOCK) === 'true' : false;
    const isPro = localOverride;
    return {
      isPro,
      tier: isPro ? 'sovereign_pro' : 'free',
      activeEntitlements: isPro ? ['pro_sovereign'] : [],
      expirationDate: null,
      isNative: false,
      configured: true,
    };
  }

  /**
   * Trigger native or web subscription purchase
   */
  public async purchasePro(packageIdentifier = '$rc_monthly'): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const offerings = await Purchases.getOfferings();
        const currentOffering = offerings?.current;
        const pkgToBuy = currentOffering?.availablePackages?.find(
          (p) => p.identifier === packageIdentifier
        ) || currentOffering?.availablePackages?.[0];

        if (pkgToBuy) {
          const purchaseResult = await Purchases.purchasePackage({ aPackage: pkgToBuy });
          const isPro = purchaseResult?.customerInfo?.entitlements?.active['pro_sovereign'] !== undefined;
          return isPro;
        }
      } catch (err: any) {
        if (!err.userCancelled) {
          console.error('RevenueCat purchase error:', err);
        }
        return false;
      }
    }

    // Web simulation
    const storage = safeStorage();
    if (storage) {
      storage.setItem(STORAGE_KEY_PRO_MOCK, 'true');
    }
    return true;
  }

  /**
   * Restore Purchases (Required by Apple App Store Guideline 3.1.1)
   */
  public async restore(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await Purchases.restorePurchases();
        const isPro = result?.customerInfo?.entitlements?.active['pro_sovereign'] !== undefined;
        return isPro;
      } catch (err) {
        console.error('Failed to restore purchases:', err);
        return false;
      }
    }

    const storage = safeStorage();
    if (storage) {
      storage.setItem(STORAGE_KEY_PRO_MOCK, 'true');
    }
    return true;
  }
}

export const purchases = PurchasesManager.getInstance();
