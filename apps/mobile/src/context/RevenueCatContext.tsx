import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import Constants from "expo-constants";
import Purchases, {
  type CustomerInfo,
  LOG_LEVEL,
} from "react-native-purchases";
import RevenueCatUI from "react-native-purchases-ui";
import { useAuth } from "./AuthContext";

const RC_API_KEY = "test_WopXFeuiBEdKFLHhPdvOIPmBgeN";
const ENTITLEMENT_ID = "Elysia Pro";

interface RevenueCatContextValue {
  isReady: boolean;
  isProUser: boolean;
  isExpoGo: boolean;
  customerInfo: CustomerInfo | null;
  presentPaywall: () => Promise<boolean>;
  presentCustomerCenter: () => Promise<void>;
  restorePurchases: () => Promise<CustomerInfo | null>;
}

const RevenueCatContext = createContext<RevenueCatContextValue | null>(null);

export function RevenueCatProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isReady, setIsReady] = useState(false);
  const configured = useRef(false);
  const isExpoGo = Constants.appOwnership === "expo";

  useEffect(() => {
    if (configured.current) return;
    configured.current = true;

    if (isExpoGo) {
      setIsReady(true);
      return;
    }

    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    Purchases.configure({ apiKey: RC_API_KEY });

    Purchases.addCustomerInfoUpdateListener((info) => {
      setCustomerInfo(info);
    });

    Purchases.getCustomerInfo()
      .then((info) => {
        setCustomerInfo(info);
        setIsReady(true);
      })
      .catch((err) => {
        console.warn("RevenueCat: failed to get initial customer info", err);
        setIsReady(true);
      });
  }, [isExpoGo]);

  useEffect(() => {
    if (!isReady || !session) return;

    Purchases.logIn(session)
      .then(({ customerInfo: info }) => setCustomerInfo(info))
      .catch((err) => console.warn("RevenueCat: logIn failed", err));
  }, [isReady, session]);

  const isProUser = !!customerInfo?.entitlements.active[ENTITLEMENT_ID];

  const presentPaywall = useCallback(async (): Promise<boolean> => {
    if (isExpoGo) {
      console.log("Expo Go detected. Skipping RevenueCat paywall presentation.");
      return false;
    }
    try {
      await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: ENTITLEMENT_ID,
      });
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
      return !!info.entitlements.active[ENTITLEMENT_ID];
    } catch (err) {
      console.warn("RevenueCat: presentPaywall error", err);
      return false;
    }
  }, [isExpoGo]);

  const presentCustomerCenter = useCallback(async () => {
    if (isExpoGo) {
      console.log("Expo Go detected. Skipping RevenueCat Customer Center.");
      return;
    }
    try {
      await RevenueCatUI.presentCustomerCenter();
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
    } catch (err) {
      console.warn("RevenueCat: presentCustomerCenter error", err);
    }
  }, [isExpoGo]);

  const restorePurchases = useCallback(async (): Promise<CustomerInfo | null> => {
    if (isExpoGo) {
      console.log("Expo Go detected. Skipping RevenueCat restore flow.");
      return null;
    }
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      return info;
    } catch (err) {
      console.warn("RevenueCat: restorePurchases error", err);
      return null;
    }
  }, [isExpoGo]);

  return (
    <RevenueCatContext.Provider
      value={{
        isReady,
        isProUser,
        isExpoGo,
        customerInfo,
        presentPaywall,
        presentCustomerCenter,
        restorePurchases,
      }}
    >
      {children}
    </RevenueCatContext.Provider>
  );
}

export function useRevenueCat(): RevenueCatContextValue {
  const ctx = useContext(RevenueCatContext);
  if (!ctx) throw new Error("useRevenueCat must be used inside RevenueCatProvider");
  return ctx;
}
