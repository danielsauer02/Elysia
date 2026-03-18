/**
 * NutritionContext — MacroFactor-inspired calorie and macro tracking.
 *
 * Core algorithm:
 *   BMR  = 10×weight + 6.25×height − 5×age + 5  (Mifflin-St Jeor, male approximation)
 *   TDEE = BMR × activityMultiplier
 *   CalorieTarget = TDEE − dailyDeficit  (or + surplus for muscle gain)
 */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type GoalType = "lose_weight" | "maintain" | "gain_muscle";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type DietaryApproach = "balanced" | "high_protein" | "low_carb" | "mediterranean" | "keto";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface NutritionGoal {
  type: GoalType;
  weeklyChangeKg: number;   // 0.25 | 0.5 | 0.75 | 1.0
  activityLevel: ActivityLevel;
  dietaryApproach: DietaryApproach;
}

export interface MacroTarget {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface FoodEntry {
  id: string;
  name: string;
  brand?: string;
  mealType: MealType;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  quantity: number;
  unit: string;
  barcode?: string;
  loggedAt: string;
}

export interface WeightEntry {
  date: string;
  kg: number;
}

// ─── Calorie engine ───────────────────────────────────────────────────────────

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary (desk job, no exercise)",
  light: "Lightly active (1–3 days/wk)",
  moderate: "Moderately active (3–5 days/wk)",
  active: "Very active (6–7 days/wk)",
  very_active: "Athlete / physical job",
};

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const DIETARY_LABELS: Record<DietaryApproach, string> = {
  balanced: "Balanced (30P / 40C / 30F)",
  high_protein: "High Protein (40P / 30C / 30F)",
  low_carb: "Low Carb (30P / 20C / 50F)",
  mediterranean: "Mediterranean (25P / 45C / 30F)",
  keto: "Ketogenic (25P / 5C / 70F)",
};

// Macronutrient ratios by approach
const MACRO_RATIOS: Record<DietaryApproach, { p: number; c: number; f: number }> = {
  balanced:     { p: 0.30, c: 0.40, f: 0.30 },
  high_protein: { p: 0.40, c: 0.30, f: 0.30 },
  low_carb:     { p: 0.30, c: 0.20, f: 0.50 },
  mediterranean:{ p: 0.25, c: 0.45, f: 0.30 },
  keto:         { p: 0.25, c: 0.05, f: 0.70 },
};

export function calculateTargets(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  goal: NutritionGoal
): { tdee: number; targets: MacroTarget } {
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5;
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[goal.activityLevel]);

  // 7700 kcal ≈ 1 kg body weight
  const dailyDelta = Math.round((goal.weeklyChangeKg * 7700) / 7);
  let targetCals = tdee;
  if (goal.type === "lose_weight") targetCals = Math.max(1200, tdee - dailyDelta);
  if (goal.type === "gain_muscle") targetCals = tdee + Math.round(dailyDelta * 0.5); // conservative surplus

  const ratios = MACRO_RATIOS[goal.dietaryApproach];
  const targets: MacroTarget = {
    calories: targetCals,
    proteinG: Math.round((targetCals * ratios.p) / 4),
    carbsG: Math.round((targetCals * ratios.c) / 4),
    fatG: Math.round((targetCals * ratios.f) / 9),
  };

  return { tdee, targets };
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface NutritionContextValue {
  isGoalSet: boolean;
  goal: NutritionGoal | null;
  macroTargets: MacroTarget | null;
  tdee: number | null;
  foodLog: FoodEntry[];
  weightLog: WeightEntry[];
  setGoal: (goal: NutritionGoal, weightKg: number, heightCm: number, ageYears: number) => void;
  addFoodEntry: (entry: Omit<FoodEntry, "id" | "loggedAt">) => void;
  removeFoodEntry: (id: string) => void;
  logWeight: (kg: number) => void;
  getDayTotals: () => MacroTarget;
  clearGoal: () => void;
}

const NutritionContext = createContext<NutritionContextValue | null>(null);

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0]!;
}

export function NutritionProvider({ children }: { children: ReactNode }) {
  const [goal, setGoalState] = useState<NutritionGoal | null>(null);
  const [macroTargets, setMacroTargets] = useState<MacroTarget | null>(null);
  const [tdee, setTdee] = useState<number | null>(null);
  const [foodLog, setFoodLog] = useState<FoodEntry[]>([]);
  const [weightLog, setWeightLog] = useState<WeightEntry[]>([]);

  const setGoal = useCallback(
    (g: NutritionGoal, weightKg: number, heightCm: number, ageYears: number) => {
      const { tdee: calculatedTdee, targets } = calculateTargets(weightKg, heightCm, ageYears, g);
      setGoalState(g);
      setMacroTargets(targets);
      setTdee(calculatedTdee);
    },
    []
  );

  const clearGoal = useCallback(() => {
    setGoalState(null);
    setMacroTargets(null);
    setTdee(null);
  }, []);

  const addFoodEntry = useCallback((entry: Omit<FoodEntry, "id" | "loggedAt">) => {
    setFoodLog((prev) => [
      { ...entry, id: generateId(), loggedAt: new Date().toISOString() },
      ...prev,
    ]);
  }, []);

  const removeFoodEntry = useCallback((id: string) => {
    setFoodLog((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const logWeight = useCallback((kg: number) => {
    setWeightLog((prev) => [
      { date: todayISO(), kg },
      ...prev.filter((w) => w.date !== todayISO()),
    ]);
  }, []);

  const getDayTotals = useCallback((): MacroTarget => {
    const today = todayISO();
    const todayEntries = foodLog.filter((e) => e.loggedAt.startsWith(today));
    return todayEntries.reduce(
      (acc, e) => ({
        calories: acc.calories + e.calories,
        proteinG: acc.proteinG + e.proteinG,
        carbsG: acc.carbsG + e.carbsG,
        fatG: acc.fatG + e.fatG,
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    );
  }, [foodLog]);

  return (
    <NutritionContext.Provider
      value={{
        isGoalSet: goal !== null,
        goal,
        macroTargets,
        tdee,
        foodLog,
        weightLog,
        setGoal,
        addFoodEntry,
        removeFoodEntry,
        logWeight,
        getDayTotals,
        clearGoal,
      }}
    >
      {children}
    </NutritionContext.Provider>
  );
}

export function useNutrition(): NutritionContextValue {
  const ctx = useContext(NutritionContext);
  if (!ctx) throw new Error("useNutrition must be used inside NutritionProvider");
  return ctx;
}
