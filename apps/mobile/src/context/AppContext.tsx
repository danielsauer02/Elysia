import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OnboardingData {
  name: string;
  dateOfBirth: string;
  heightCm: number;
  weightKg: number;
  goals: string[];
  wearables: string[];
}

interface ProfileRow {
  id: string;
  name: string | null;
  date_of_birth: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  goals: string[] | null;
  wearables: string[] | null;
}

interface AppContextValue {
  isOnboarded: boolean;
  isProfileLoading: boolean;
  onboardingData: Partial<OnboardingData>;
  completeOnboarding: (data: OnboardingData) => Promise<void>;
  resetOnboarding: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // Load profile whenever auth user changes
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setIsProfileLoading(false);
      return;
    }

    setIsProfileLoading(true);
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error && error.code !== "PGRST116") {
          console.error("[AppContext] profile load error:", error.message);
        }
        setProfile(data ?? null);
        setIsProfileLoading(false);
      });
  }, [user?.id]);

  const completeOnboarding = useCallback(
    async (data: OnboardingData) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        name: data.name,
        date_of_birth: data.dateOfBirth,
        height_cm: data.heightCm,
        weight_kg: data.weightKg,
        goals: data.goals,
        wearables: data.wearables,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      // Optimistically update local state so navigation fires immediately
      setProfile((prev) => ({
        id: user.id,
        name: data.name,
        date_of_birth: data.dateOfBirth,
        height_cm: data.heightCm,
        weight_kg: data.weightKg,
        goals: data.goals,
        wearables: data.wearables,
        ...(prev ?? {}),
      }));
    },
    [user]
  );

  const resetOnboarding = useCallback(() => {
    setProfile(null);
  }, []);

  const isOnboarded = profile?.name != null && profile.name.length > 0;

  const onboardingData: Partial<OnboardingData> = {
    name: profile?.name ?? undefined,
    dateOfBirth: profile?.date_of_birth ?? undefined,
    heightCm: profile?.height_cm ?? undefined,
    weightKg: profile?.weight_kg ?? undefined,
    goals: profile?.goals ?? undefined,
    wearables: profile?.wearables ?? undefined,
  };

  return (
    <AppContext.Provider
      value={{
        isOnboarded,
        isProfileLoading,
        onboardingData,
        completeOnboarding,
        resetOnboarding,
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
