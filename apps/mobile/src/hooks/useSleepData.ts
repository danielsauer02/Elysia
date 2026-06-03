import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useSleepContext } from "@/context/SleepContext";

/**
 * Single fetch surface for the /sleep deep-dive screen. Wraps the
 * three core queries so individual sections don't re-trigger requests.
 *
 *   week       — Sleep Fitness Score for each day in the visible week
 *   night      — Full breakdown for `selectedDay`
 *   chronotype — Computed chronotype + alignment
 *
 * `undefined` from `useQuery` means "still loading" — sections check
 * `loading` for skeleton states.
 */
export function useSleepData() {
  const { selectedDay, weekRange } = useSleepContext();

  const week = useQuery(api.sleep.getSleepFitnessRange, weekRange);
  const night = useQuery(api.sleep.getSleepNight, { day: selectedDay });
  const chronotype = useQuery(api.sleep.getChronotype, {});

  const loading =
    week === undefined || night === undefined || chronotype === undefined;

  return {
    loading,
    week: week ?? [],
    night: night ?? null,
    chronotype: chronotype ?? null,
  };
}
