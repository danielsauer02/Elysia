import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@convex/_generated/dataModel";
import { api } from "@convex/_generated/api";
import { useAuth } from "@/context/AuthContext";
import { track } from "@/lib/analytics";

const todayISO = () => new Date().toISOString().split("T")[0]!;

export type MacroTargets = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type DayTotals = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type TodayFoodEntry = {
  id: string;
  name: string;
  brand?: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  quantity: number;
  unit: string;
  barcode?: string;
};

type AddFoodInput = {
  name: string;
  brand?: string;
  mealType: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  quantity: number;
  unit: string;
  barcode?: string;
  recipeId?: Id<"recipes">;
  photoId?: Id<"foodPhotos">;
  confidence?: number;
};

type SmartSuggestion = {
  name: string;
  brand?: string;
  mealType: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  quantity: number;
  unit: string;
  frequency?: number;
};

type NutritionContextValue = {
  macroTargets: MacroTargets | null;
  isGoalSet: boolean;
  getDayTotals: () => DayTotals;
  todayFoodEntries: TodayFoodEntry[];
  addFoodEntry: (input: AddFoodInput) => Promise<Id<"foodLog">>;
  recentFoods: SmartSuggestion[];
  suggestionsForMeal: (mealType: string) => SmartSuggestion[];
  isLoading: boolean;
};

const emptyTotals: DayTotals = {
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
};

const NutritionContext = createContext<NutritionContextValue | null>(null);

export function NutritionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const today = todayISO();

  const goal = useQuery(api.nutrition.getGoal, user ? {} : "skip");
  const foodLog = useQuery(
    api.nutrition.getTodayFoodLog,
    user ? { date: today } : "skip"
  );
  const recentFoodsRaw = useQuery(
    api.nutrition.recentFoods,
    user ? { limit: 20 } : "skip"
  );
  const breakfastFreq = useQuery(
    api.nutrition.frequentByMealtime,
    user ? { mealType: "breakfast", limit: 6 } : "skip"
  );
  const lunchFreq = useQuery(
    api.nutrition.frequentByMealtime,
    user ? { mealType: "lunch", limit: 6 } : "skip"
  );
  const dinnerFreq = useQuery(
    api.nutrition.frequentByMealtime,
    user ? { mealType: "dinner", limit: 6 } : "skip"
  );
  const snackFreq = useQuery(
    api.nutrition.frequentByMealtime,
    user ? { mealType: "snack", limit: 6 } : "skip"
  );
  const addFoodEntryMut = useMutation(api.nutrition.addFoodEntry);

  const macroTargets = useMemo((): MacroTargets | null => {
    if (!goal) return null;
    const c = goal.calorieTarget ?? 0;
    const p = goal.proteinG ?? 0;
    const carbs = goal.carbsG ?? 0;
    const f = goal.fatG ?? 0;
    if (c <= 0 && p <= 0 && carbs <= 0 && f <= 0) return null;
    return { calories: c, proteinG: p, carbsG: carbs, fatG: f };
  }, [goal]);

  const isGoalSet = macroTargets !== null;

  const totalsForToday = useMemo((): DayTotals => {
    const entries = foodLog ?? [];
    return entries.reduce(
      (acc, row) => ({
        calories: acc.calories + row.calories,
        proteinG: acc.proteinG + row.proteinG,
        carbsG: acc.carbsG + row.carbsG,
        fatG: acc.fatG + row.fatG,
      }),
      { ...emptyTotals }
    );
  }, [foodLog]);

  const getDayTotals = useCallback(() => totalsForToday, [totalsForToday]);

  const todayFoodEntries = useMemo((): TodayFoodEntry[] => {
    const rows = foodLog ?? [];
    return rows.map((row) => ({
      id: row._id,
      name: row.name,
      brand: row.brand,
      mealType: row.mealType as TodayFoodEntry["mealType"],
      calories: row.calories,
      proteinG: row.proteinG,
      carbsG: row.carbsG,
      fatG: row.fatG,
      quantity: row.quantity,
      unit: row.unit,
      barcode: row.barcode,
    }));
  }, [foodLog]);

  const addFoodEntry = useCallback(
    async (input: AddFoodInput) => {
      const id = await addFoodEntryMut({
        ...input,
        loggedDate: today,
      });
      track("food_logged", {
        meal: input.mealType,
        source: input.photoId
          ? "photo"
          : input.barcode
          ? "barcode"
          : input.recipeId
          ? "recipe"
          : "manual",
      });
      return id;
    },
    [addFoodEntryMut, today]
  );

  const recentFoods = useMemo<SmartSuggestion[]>(() => {
    return (recentFoodsRaw ?? []).map((r) => ({
      name: r.name,
      brand: r.brand,
      mealType: r.mealType,
      calories: r.calories,
      proteinG: r.proteinG,
      carbsG: r.carbsG,
      fatG: r.fatG,
      quantity: r.quantity,
      unit: r.unit,
    }));
  }, [recentFoodsRaw]);

  const suggestionsByMeal = useMemo<Record<string, SmartSuggestion[]>>(() => {
    const toSugg = (rows: typeof breakfastFreq | undefined): SmartSuggestion[] =>
      (rows ?? []).map((r) => ({
        name: r.name,
        brand: r.brand,
        mealType: r.mealType,
        calories: r.calories,
        proteinG: r.proteinG,
        carbsG: r.carbsG,
        fatG: r.fatG,
        quantity: r.quantity,
        unit: r.unit,
        frequency: r.frequency,
      }));
    return {
      breakfast: toSugg(breakfastFreq),
      lunch: toSugg(lunchFreq),
      dinner: toSugg(dinnerFreq),
      snack: toSugg(snackFreq),
    };
  }, [breakfastFreq, lunchFreq, dinnerFreq, snackFreq]);

  const suggestionsForMeal = useCallback(
    (mealType: string) => suggestionsByMeal[mealType] ?? [],
    [suggestionsByMeal]
  );

  const isLoading =
    user !== null && (goal === undefined || foodLog === undefined);

  const value = useMemo(
    (): NutritionContextValue => ({
      macroTargets,
      isGoalSet,
      getDayTotals,
      todayFoodEntries,
      addFoodEntry,
      recentFoods,
      suggestionsForMeal,
      isLoading,
    }),
    [
      macroTargets,
      isGoalSet,
      getDayTotals,
      todayFoodEntries,
      addFoodEntry,
      recentFoods,
      suggestionsForMeal,
      isLoading,
    ]
  );

  return (
    <NutritionContext.Provider value={value}>
      {children}
    </NutritionContext.Provider>
  );
}

export function useNutrition(): NutritionContextValue {
  const ctx = useContext(NutritionContext);
  if (!ctx) {
    throw new Error("useNutrition must be used within NutritionProvider");
  }
  return ctx;
}
