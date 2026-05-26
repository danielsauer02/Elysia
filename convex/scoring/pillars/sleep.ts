import {
  fSleepConsistency,
  fSleepDuration,
  fSleepEfficiency,
  fSleepRestorative,
} from "../doseResponse";
import type { PillarInput } from "../types";

const SLEEP_WEIGHTS = {
  duration: 0.45,
  efficiency: 0.25,
  consistency: 0.15,
  restorative: 0.15,
} as const;

export function computeSleepScore(input: PillarInput): number | null {
  const w = input.wearableDaily;
  if (!w || w.sleepMinutes === undefined) return null;

  const duration = fSleepDuration(w.sleepMinutes);

  const efficiency = w.sleepEfficiencyPct !== undefined
    ? fSleepEfficiency(w.sleepEfficiencyPct)
    : null;

  const consistency = w.sleepConsistencyPct !== undefined
    ? fSleepConsistency(w.sleepConsistencyPct)
    : null;

  const restorativeMin = (w.sleepDeepMinutes ?? 0) + (w.sleepRemMinutes ?? 0);
  const restorative = (w.sleepDeepMinutes !== undefined || w.sleepRemMinutes !== undefined)
    ? fSleepRestorative(restorativeMin)
    : null;

  // Renormalise to the weights of available sub-scores so a Whoop user
  // (full set) and an Apple Health user (often only duration) both get a
  // fair 0..100 score.
  const parts: Array<{ value: number; weight: number } | null> = [
    { value: duration, weight: SLEEP_WEIGHTS.duration },
    efficiency  !== null ? { value: efficiency,  weight: SLEEP_WEIGHTS.efficiency }  : null,
    consistency !== null ? { value: consistency, weight: SLEEP_WEIGHTS.consistency } : null,
    restorative !== null ? { value: restorative, weight: SLEEP_WEIGHTS.restorative } : null,
  ];
  const active = parts.filter(
    (p): p is { value: number; weight: number } => p !== null
  );

  const totalWeight = active.reduce((s, p) => s + p.weight, 0);
  if (totalWeight === 0) return null;
  const weighted = active.reduce((s, p) => s + p.value * p.weight, 0);
  return Math.round((weighted / totalWeight) * 100);
}
