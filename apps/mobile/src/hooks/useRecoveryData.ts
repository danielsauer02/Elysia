import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRecoveryContext } from "@/context/RecoveryContext";

/**
 * Single fetch surface for the /recovery deep-dive screen. Wraps the two
 * core queries so individual sections don't re-trigger requests.
 *
 *   week — Recovery Fitness Score for each day in the visible week
 *   day  — Full breakdown for `selectedDay`
 *
 * `undefined` from `useQuery` means "still loading" — sections check
 * `loading` for skeleton states.
 */
export function useRecoveryData() {
  const { selectedDay, weekRange } = useRecoveryContext();

  const week = useQuery(api.recovery.getRecoveryFitnessRange, weekRange);
  const day = useQuery(api.recovery.getRecoveryDay, { day: selectedDay });

  const loading = week === undefined || day === undefined;

  return {
    loading,
    week: week ?? [],
    day: day ?? null,
  };
}
