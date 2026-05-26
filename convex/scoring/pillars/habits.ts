import {
  fHabitAdherence14d,
  fHabitCategoryBreadth,
  fHabitStreakFactor,
} from "../doseResponse";
import type { PillarInput } from "../types";

const HABIT_WEIGHTS = {
  adherence: 0.6,
  breadth: 0.2,
  streak: 0.2,
} as const;

export function computeHabitScore(input: PillarInput): number | null {
  const h = input.habits;
  if (!h || h.activeCount === 0) return null;

  const adherence = fHabitAdherence14d(h.adherence14dPct);
  const breadth = fHabitCategoryBreadth(h.distinctCategories);
  const streak = fHabitStreakFactor(h.maxStreakDays);

  const weighted =
    adherence * HABIT_WEIGHTS.adherence +
    breadth * HABIT_WEIGHTS.breadth +
    streak * HABIT_WEIGHTS.streak;
  return Math.round(weighted * 100);
}
