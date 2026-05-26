import {
  fActivityKcal,
  fActivitySteps,
  fActivityWorkoutLoad,
} from "../doseResponse";
import type { PillarInput } from "../types";

const ACTIVITY_WEIGHTS = {
  steps: 0.45,
  kcal: 0.30,
  workout: 0.25,
} as const;

export function computeActivityScore(input: PillarInput): number | null {
  const w = input.wearableDaily;
  if (!w) return null;
  if (w.steps === undefined && w.activeKcal === undefined) return null;

  const stepsSub = w.steps !== undefined ? fActivitySteps(w.steps) : null;
  const kcalSub  = w.activeKcal !== undefined ? fActivityKcal(w.activeKcal) : null;

  // Workout-load proxy: convert workout kcal to minutes assuming ~8 kcal/min
  // moderate intensity (Ainsworth Compendium baseline). When wearable already
  // reports `workoutCount` we use that as a soft floor.
  const workoutMin = w.workoutKcal !== undefined
    ? w.workoutKcal / 8
    : (w.workoutCount ?? 0) > 0 ? 15 * (w.workoutCount ?? 0) : null;
  const workoutSub = workoutMin !== null
    ? fActivityWorkoutLoad(workoutMin)
    : null;

  const parts: Array<{ value: number; weight: number } | null> = [
    stepsSub   !== null ? { value: stepsSub,   weight: ACTIVITY_WEIGHTS.steps }   : null,
    kcalSub    !== null ? { value: kcalSub,    weight: ACTIVITY_WEIGHTS.kcal }    : null,
    workoutSub !== null ? { value: workoutSub, weight: ACTIVITY_WEIGHTS.workout } : null,
  ];
  const active = parts.filter(
    (p): p is { value: number; weight: number } => p !== null
  );

  const totalWeight = active.reduce((s, p) => s + p.weight, 0);
  if (totalWeight === 0) return null;
  const weighted = active.reduce((s, p) => s + p.value * p.weight, 0);
  return Math.round((weighted / totalWeight) * 100);
}
