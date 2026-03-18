/**
 * NutritionContext — MacroFactor-inspired calorie and macro tracking.
 * Backed by Supabase: nutrition_goals, food_log, weight_log tables.
 *
 * Core algorithm:
 *   BMR  = 10×weight + 6.25×height − 5×age + 5  (Mifflin-St Jeor, male approximation)
 *   TDEE = BMR × activityMultiplier
 *   CalorieTarget = TDEE ± dailyDelta
 */
import React, {
  createContext,
  useContext,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GoalType = "lose_weight" | "maintain" | "gain_muscle";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type DietaryApproach =
  | "balanced"
  | "high_protein"
  | "low_carb"
  | "mediterranean"
  | "keto";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface NutritionGoal {
  type: GoalType;
  weeklyChangeKg: number;
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

const MACRO_RATIOS: Record<DietaryApproach, { p: number; c: number; f: number }> =
  {
    balanced: { p: 0.3, c: 0.4, f: 0.3 },
    high_protein: { p: 0.4, c: 0.3, f: 0.3 },
    low_carb: { p: 0.3, c: 0.2, f: 0.5 },
    mediterranean: { p: 0.25, c: 0.45, f: 0.3 },
    keto: { p: 0.25, c: 0.05, f: 0.7 },
  };

export function calculateTargets(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  goal: NutritionGoal
): { tdee: number; targets: MacroTarget } {
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5;
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[goal.activityLevel]);
  const dailyDelta = Math.round((goal.weeklyChangeKg * 7700) / 7);
  let targetCals = tdee;
  if (goal.type === "lose_weight") targetCals = Math.max(1200, tdee - dailyDelta);
  if (goal.type === "gain_muscle")
    targetCals = tdee + Math.round(dailyDelta * 0.5);
  const ratios = MACRO_RATIOS[goal.dietaryApproach];
  return {
    tdee,
    targets: {
      calories: targetCals,
      proteinG: Math.round((targetCals * ratios.p) / 4),
      carbsG: Math.round((targetCals * ratios.c) / 4),
      fatG: Math.round((targetCals * ratios.f) / 9),
    },
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface NutritionContextValue {
  isGoalSet: boolean;
  goal: NutritionGoal | null;
  macroTargets: MacroTarget | null;
  tdee: number | null;
  foodLog: FoodEntry[];
  weightLog: WeightEntry[];
  isLoading: boolean;
  setGoal: (
    goal: NutritionGoal,
    weightKg: number,
    heightCm: number,
    ageYears: number
  ) => Promise<void>;
  clearGoal: () => Promise<void>;
  addFoodEntry: (entry: Omit<FoodEntry, "id" | "loggedAt">) => Promise<void>;
  removeFoodEntry: (id: string) => Promise<void>;
  logWeight: (kg: number) => Promise<void>;
  getDayTotals: () => MacroTarget;
}

const NutritionContext = createContext<NutritionContextValue | null>(null);

const todayISO = () => new Date().toISOString().split("T")[0]!;

// ─── Provider ─────────────────────────────────────────────────────────────────

export function NutritionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = todayISO();

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: goalRow, isLoading: goalLoading } = useQuery({
    queryKey: ["nutrition_goal", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nutrition_goals")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: foodLogRows = [], isLoading: foodLoading } = useQuery({
    queryKey: ["food_log", user?.id, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("food_log")
        .select("*")
        .eq("user_id", user!.id)
        .eq("logged_date", today)
        .order("logged_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: weightLogRows = [] } = useQuery({
    queryKey: ["weight_log", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weight_log")
        .select("*")
        .eq("user_id", user!.id)
        .order("logged_date", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  // ── Derived values ────────────────────────────────────────────────────────

  const goal: NutritionGoal | null = goalRow
    ? {
        type: goalRow.goal_type as GoalType,
        weeklyChangeKg: goalRow.weekly_change_kg ?? 0.5,
        activityLevel: goalRow.activity_level as ActivityLevel,
        dietaryApproach: goalRow.dietary_approach as DietaryApproach,
      }
    : null;

  const macroTargets: MacroTarget | null = goalRow
    ? {
        calories: goalRow.calorie_target ?? 0,
        proteinG: goalRow.protein_g ?? 0,
        carbsG: goalRow.carbs_g ?? 0,
        fatG: goalRow.fat_g ?? 0,
      }
    : null;

  const foodLog: FoodEntry[] = useMemo(
    () =>
      foodLogRows.map((r) => ({
        id: r.id as string,
        name: r.name as string,
        brand: (r.brand as string | null) ?? undefined,
        mealType: r.meal_type as MealType,
        calories: r.calories as number,
        proteinG: (r.protein_g as number) ?? 0,
        carbsG: (r.carbs_g as number) ?? 0,
        fatG: (r.fat_g as number) ?? 0,
        quantity: r.quantity as number,
        unit: r.unit as string,
        barcode: (r.barcode as string | null) ?? undefined,
        loggedAt: r.logged_at as string,
      })),
    [foodLogRows]
  );

  const weightLog: WeightEntry[] = useMemo(
    () =>
      weightLogRows.map((r) => ({
        date: r.logged_date as string,
        kg: r.weight_kg as number,
      })),
    [weightLogRows]
  );

  // ── Mutations ────────────────────────────────────────────────────────────

  const setGoalMutation = useMutation({
    mutationFn: async ({
      goalData,
      targets,
      tdee,
    }: {
      goalData: NutritionGoal;
      targets: MacroTarget;
      tdee: number;
    }) => {
      const { error } = await supabase.from("nutrition_goals").upsert({
        user_id: user!.id,
        goal_type: goalData.type,
        weekly_change_kg: goalData.weeklyChangeKg,
        activity_level: goalData.activityLevel,
        dietary_approach: goalData.dietaryApproach,
        calorie_target: targets.calories,
        protein_g: targets.proteinG,
        carbs_g: targets.carbsG,
        fat_g: targets.fatG,
        tdee,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nutrition_goal", user?.id] }),
  });

  const clearGoalMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("nutrition_goals")
        .delete()
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nutrition_goal", user?.id] }),
  });

  const addFoodMutation = useMutation({
    mutationFn: async (entry: Omit<FoodEntry, "id" | "loggedAt">) => {
      const { error } = await supabase.from("food_log").insert({
        user_id: user!.id,
        name: entry.name,
        brand: entry.brand ?? null,
        meal_type: entry.mealType,
        calories: entry.calories,
        protein_g: entry.proteinG,
        carbs_g: entry.carbsG,
        fat_g: entry.fatG,
        quantity: entry.quantity,
        unit: entry.unit,
        barcode: entry.barcode ?? null,
        logged_date: today,
      });
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["food_log", user?.id, today] }),
  });

  const removeFoodMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("food_log")
        .delete()
        .eq("id", id)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["food_log", user?.id, today] });
      const prev = qc.getQueryData(["food_log", user?.id, today]);
      qc.setQueryData(
        ["food_log", user?.id, today],
        (old: unknown) => Array.isArray(old) ? old.filter((r: { id?: string }) => r.id !== id) : []
      );
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev)
        qc.setQueryData(["food_log", user?.id, today], context.prev);
    },
    onSettled: () =>
      qc.invalidateQueries({ queryKey: ["food_log", user?.id, today] }),
  });

  const logWeightMutation = useMutation({
    mutationFn: async (kg: number) => {
      const { error } = await supabase.from("weight_log").upsert({
        user_id: user!.id,
        weight_kg: kg,
        logged_date: today,
        logged_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weight_log", user?.id] }),
  });

  // ── Public actions ────────────────────────────────────────────────────────

  const setGoal = useCallback(
    async (
      goalData: NutritionGoal,
      weightKg: number,
      heightCm: number,
      ageYears: number
    ) => {
      const { tdee, targets } = calculateTargets(weightKg, heightCm, ageYears, goalData);
      await setGoalMutation.mutateAsync({ goalData, targets, tdee });
    },
    [setGoalMutation]
  );

  const clearGoal = useCallback(async () => {
    await clearGoalMutation.mutateAsync();
  }, [clearGoalMutation]);

  const addFoodEntry = useCallback(
    async (entry: Omit<FoodEntry, "id" | "loggedAt">) => {
      await addFoodMutation.mutateAsync(entry);
    },
    [addFoodMutation]
  );

  const removeFoodEntry = useCallback(
    async (id: string) => {
      await removeFoodMutation.mutateAsync(id);
    },
    [removeFoodMutation]
  );

  const logWeight = useCallback(
    async (kg: number) => {
      await logWeightMutation.mutateAsync(kg);
    },
    [logWeightMutation]
  );

  const getDayTotals = useCallback((): MacroTarget => {
    return foodLog.reduce(
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
        tdee: goalRow?.tdee ?? null,
        foodLog,
        weightLog,
        isLoading: goalLoading || foodLoading,
        setGoal,
        clearGoal,
        addFoodEntry,
        removeFoodEntry,
        logWeight,
        getDayTotals,
      }}
    >
      {children}
    </NutritionContext.Provider>
  );
}

export function useNutrition(): NutritionContextValue {
  const ctx = useContext(NutritionContext);
  if (!ctx)
    throw new Error("useNutrition must be used inside NutritionProvider");
  return ctx;
}
