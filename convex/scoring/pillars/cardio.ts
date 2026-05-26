import { fCardioRhrAbs, fCardioVo2Percentile } from "../doseResponse";
import { vo2MaxPercentile } from "../percentiles/vo2max";
import type { PillarInput } from "../types";

const CARDIO_WEIGHTS = {
  vo2: 0.7,
  rhr: 0.3,
} as const;

function chronoAge(dateOfBirth?: string): number | null {
  if (!dateOfBirth) return null;
  const ts = Date.parse(dateOfBirth);
  if (!Number.isFinite(ts)) return null;
  const years = (Date.now() - ts) / (365.25 * 86400 * 1000);
  return years > 0 ? years : null;
}

export function computeCardioScore(input: PillarInput): number | null {
  const w = input.wearableDaily;
  const profile = input.profile;
  if (!w) return null;
  if (w.vo2Max === undefined && w.restingHrBpm === undefined) return null;

  const age = profile ? chronoAge(profile.dateOfBirth) : null;
  const sex = profile?.sex ?? "male";

  const vo2Sub = w.vo2Max !== undefined && age !== null
    ? fCardioVo2Percentile(vo2MaxPercentile(w.vo2Max, age, sex))
    : null;
  const rhrSub = w.restingHrBpm !== undefined
    ? fCardioRhrAbs(w.restingHrBpm)
    : null;

  const parts: Array<{ value: number; weight: number } | null> = [
    vo2Sub !== null ? { value: vo2Sub, weight: CARDIO_WEIGHTS.vo2 } : null,
    rhrSub !== null ? { value: rhrSub, weight: CARDIO_WEIGHTS.rhr } : null,
  ];
  const active = parts.filter(
    (p): p is { value: number; weight: number } => p !== null
  );

  const totalWeight = active.reduce((s, p) => s + p.weight, 0);
  if (totalWeight === 0) return null;
  const weighted = active.reduce((s, p) => s + p.value * p.weight, 0);
  return Math.round((weighted / totalWeight) * 100);
}
