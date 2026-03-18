import React, {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

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
  onboardingData: Partial<OnboardingData>;
  completeOnboarding: (data: OnboardingData) => void;
  resetOnboarding: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [onboardingData, setOnboardingData] = useState<Partial<OnboardingData>>({});

  const completeOnboarding = (data: OnboardingData) => {
    setOnboardingData(data);
    setIsOnboarded(true);
  };

  const resetOnboarding = () => {
    setIsOnboarded(false);
    setOnboardingData({});
  };

  return (
    <AppContext.Provider
      value={{ isOnboarded, onboardingData, completeOnboarding, resetOnboarding }}
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
