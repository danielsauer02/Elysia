import { fRecoveryHrv, fRecoveryResp, fRecoveryRhr } from "../doseResponse";
import type { BaselineContext, PillarInput } from "../types";

const RECOVERY_WEIGHTS = {
  hrv: 0.5,
  rhr: 0.35,
  resp: 0.15,
} as const;

/**
 * Cohort fallbacks when the user has no personal baseline yet.
 * Spec §5.
 */
const COHORT_BASELINE = {
  hrvMedian: 45,
  rhrMedian: 62,
  respMedian: 15,
} as const;

export function computeRecoveryScore(
  input: PillarInput,
  baseline: BaselineContext
): number | null {
  const w = input.wearableDaily;
  if (!w) return null;
  if (w.hrvAvgMs === undefined && w.restingHrBpm === undefined) return null;

  const hrvBase  = baseline.metrics.hrvMedian  ?? COHORT_BASELINE.hrvMedian;
  const rhrBase  = baseline.metrics.rhrMedian  ?? COHORT_BASELINE.rhrMedian;
  const respBase = baseline.metrics.respMedian ?? COHORT_BASELINE.respMedian;

  const hrvSub = w.hrvAvgMs !== undefined
    ? fRecoveryHrv(w.hrvAvgMs, hrvBase)
    : null;
  const rhrSub = w.restingHrBpm !== undefined
    ? fRecoveryRhr(w.restingHrBpm, rhrBase)
    : null;
  const respSub = w.respiratoryRateAvg !== undefined
    ? fRecoveryResp(w.respiratoryRateAvg, respBase)
    : null;

  const parts: Array<{ value: number; weight: number } | null> = [
    hrvSub  !== null ? { value: hrvSub,  weight: RECOVERY_WEIGHTS.hrv }  : null,
    rhrSub  !== null ? { value: rhrSub,  weight: RECOVERY_WEIGHTS.rhr }  : null,
    respSub !== null ? { value: respSub, weight: RECOVERY_WEIGHTS.resp } : null,
  ];
  const active = parts.filter(
    (p): p is { value: number; weight: number } => p !== null
  );

  const totalWeight = active.reduce((s, p) => s + p.weight, 0);
  if (totalWeight === 0) return null;
  const weighted = active.reduce((s, p) => s + p.value * p.weight, 0);
  return Math.round((weighted / totalWeight) * 100);
}
