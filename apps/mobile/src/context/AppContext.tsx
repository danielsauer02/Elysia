import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEYS = {
  IS_ONBOARDED: "@elysia/isOnboarded",
  ONBOARDING_DATA: "@elysia/onboardingData",
  TEMP_SUBSCRIPTION_ACCESS: "@elysia/tempSubscriptionAccess",
} as const;

interface OnboardingData {
  name: string;
  dateOfBirth: string;
  heightCm: number;
  weightKg: number;
  goals: string[];
  wearables: string[];
}

interface AppContextValue {
  isOnboarded: boolean;
  isProfileLoading: boolean;
  onboardingData: Partial<OnboardingData>;
  hasTemporarySubscriptionAccess: boolean;
  completeOnboarding: (data: OnboardingData) => void;
  resetOnboarding: () => void;
  grantTemporarySubscriptionAccess: () => void;
  resetTemporarySubscriptionAccess: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [onboardingData, setOnboardingData] = useState<Partial<OnboardingData>>({});
  const [hasTemporarySubscriptionAccess, setHasTemporarySubscriptionAccess] =
    useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [onboarded, data, tempAccess] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.IS_ONBOARDED),
          AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_DATA),
          AsyncStorage.getItem(STORAGE_KEYS.TEMP_SUBSCRIPTION_ACCESS),
        ]);
        if (onboarded === "true") setIsOnboarded(true);
        if (data) setOnboardingData(JSON.parse(data));
        if (tempAccess === "true") setHasTemporarySubscriptionAccess(true);
      } catch (e) {
        console.warn("Failed to restore app state:", e);
      } finally {
        setIsProfileLoading(false);
      }
    })();
  }, []);

  const completeOnboarding = useCallback((data: OnboardingData) => {
    setOnboardingData(data);
    setIsOnboarded(true);
    AsyncStorage.setItem(STORAGE_KEYS.IS_ONBOARDED, "true").catch(() => {});
    AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_DATA, JSON.stringify(data)).catch(() => {});
  }, []);

  const resetOnboarding = useCallback(() => {
    setIsOnboarded(false);
    setOnboardingData({});
    setHasTemporarySubscriptionAccess(false);
    AsyncStorage.removeItem(STORAGE_KEYS.IS_ONBOARDED).catch(() => {});
    AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING_DATA).catch(() => {});
    AsyncStorage.removeItem(STORAGE_KEYS.TEMP_SUBSCRIPTION_ACCESS).catch(() => {});
  }, []);

  const grantTemporarySubscriptionAccess = useCallback(() => {
    setHasTemporarySubscriptionAccess(true);
    AsyncStorage.setItem(STORAGE_KEYS.TEMP_SUBSCRIPTION_ACCESS, "true").catch(() => {});
  }, []);

  const resetTemporarySubscriptionAccess = useCallback(() => {
    setHasTemporarySubscriptionAccess(false);
    AsyncStorage.removeItem(STORAGE_KEYS.TEMP_SUBSCRIPTION_ACCESS).catch(() => {});
  }, []);

  return (
    <AppContext.Provider
      value={{
        isOnboarded,
        isProfileLoading,
        onboardingData,
        hasTemporarySubscriptionAccess,
        completeOnboarding,
        resetOnboarding,
        grantTemporarySubscriptionAccess,
        resetTemporarySubscriptionAccess,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used inside AppProvider");
  return ctx;
}
