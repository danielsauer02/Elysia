import {
  fStressFragmentation,
  fStressHrvCv,
  fStressRespDeviation,
} from "../doseResponse";
import type { BaselineContext, PillarInput } from "../types";

const STRESS_WEIGHTS = {
  hrvCv: 0.45,
  fragmentation: 0.35,
  respDeviation: 0.20,
} as const;

/** Coefficient of variation (%) of HRV across the recent window. */
function hrvCvPct(history: { hrvAvgMs?: number }[]): number | null {
  const values = history
    .map((p) => p.hrvAvgMs)
    .filter((v): v is number => typeof v === "number" && v > 0);
  if (values.length < 3) return null;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean === 0) return null;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const sd = Math.sqrt(variance);
  return (sd / mean) * 100;
}

/**
 * Stress / autonomic-load pillar. Spec §4.8.
 *
 * Higher score = lower observed stress. All three sub-scores derive from
 * existing wearable signals — no new ingestion required.
 *
 * Returns null if neither a 3-day HRV window NOR today's sleep efficiency
 * exists; this keeps the pillar honest on apps that only report sleep
 * duration (e.g. Apple Health duration-only).
 */
export function computeStressScore(
  input: PillarInput,
  baseline: BaselineContext
): number | null {
  const w = input.wearableDaily;
  const recent = input.recentWearable ?? [];

  // 1) HRV coefficient-of-variation over the last 3-7 days (lower = calmer)
  const cv = hrvCvPct(recent);
  const hrvSub = cv !== null ? fStressHrvCv(cv) : null;

  // 2) Sleep fragmentation today
  const awake = w?.sleepAwakeMinutes ?? 0;
  const effPct = w?.sleepEfficiencyPct;
  const fragRaw =
    effPct !== undefined
      ? awake + Math.max(0, 100 - effPct)
      : w?.sleepAwakeMinutes !== undefined
        ? awake
        : null;
  const fragSub = fragRaw !== null ? fStressFragmentation(fragRaw) : null;

  // 3) Respiratory deviation today vs baseline
  const respBase = baseline.metrics.respMedian ?? 15;
  const respToday = w?.respiratoryRateAvg;
  const respDevPct =
    respToday !== undefined && respBase > 0
      ? Math.abs((respToday - respBase) / respBase) * 100
      : null;
  const respSub = respDevPct !== null ? fStressRespDeviation(respDevPct) : null;

  const parts: Array<{ value: number; weight: number } | null> = [
    hrvSub  !== null ? { value: hrvSub,  weight: STRESS_WEIGHTS.hrvCv }         : null,
    fragSub !== null ? { value: fragSub, weight: STRESS_WEIGHTS.fragmentation } : null,
    respSub !== null ? { value: respSub, weight: STRESS_WEIGHTS.respDeviation } : null,
  ];
  const active = parts.filter(
    (p): p is { value: number; weight: number } => p !== null
  );
  if (active.length === 0) return null;

  const totalWeight = active.reduce((s, p) => s + p.weight, 0);
  if (totalWeight === 0) return null;
  const weighted = active.reduce((s, p) => s + p.value * p.weight, 0);
  return Math.round((weighted / totalWeight) * 100);
}
