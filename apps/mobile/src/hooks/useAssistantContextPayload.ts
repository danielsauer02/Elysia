import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAppContext } from "@/context/AppContext";
import { useHabits } from "@/context/HabitsContext";
import { useNutrition } from "@/context/NutritionContext";

/**
 * Compact snapshot for the Convex assistant (no secrets). Expand as more data is wired.
 */
export function useAssistantContextPayload(): string {
  const { user } = useAuth();
  const { onboardingData, isOnboarded } = useAppContext();
  const { habits } = useHabits();
  const { macroTargets, getDayTotals, todayFoodEntries, isGoalSet } = useNutrition();

  return useMemo(() => {
    if (!user) return "";

    const totals = getDayTotals();
    const lines: string[] = [];
    lines.push(`User signed in (id suffix: …${user.id.slice(-8)}).`);
    lines.push(`Onboarding complete: ${isOnboarded ? "yes" : "no"}.`);

    if (onboardingData?.name) lines.push(`Preferred name: ${onboardingData.name}.`);
    if (onboardingData?.goals?.length)
      lines.push(`Stated goals: ${onboardingData.goals.join(", ")}.`);

    const active = habits.filter((h) => h.state === "active");
    const planned = habits.filter((h) => h.state === "planned");
    if (active.length) {
      lines.push(
        `Active habits (${active.length}): ${active.map((h) => h.title).slice(0, 12).join("; ")}${active.length > 12 ? "…" : ""}.`
      );
    }
    if (planned.length) {
      lines.push(`Planned habits: ${planned.length}.`);
    }

    if (isGoalSet && macroTargets) {
      lines.push(
        `Nutrition targets: ~${macroTargets.calories} kcal, P ${macroTargets.proteinG}g / C ${macroTargets.carbsG}g / F ${macroTargets.fatG}g.`
      );
      lines.push(
        `Today logged food: ${todayFoodEntries.length} entries, ~${Math.round(totals.calories)} kcal.`
      );
    } else {
      lines.push("Nutrition goals not fully set in app.");
    }

    return lines.join("\n");
  }, [
    user,
    onboardingData,
    isOnboarded,
    habits,
    macroTargets,
    isGoalSet,
    getDayTotals,
    todayFoodEntries,
  ]);
}
