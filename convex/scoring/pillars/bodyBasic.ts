import { fBodyBmi, fBodyStability } from "../doseResponse";
import type { PillarInput } from "../types";

const BODY_WEIGHTS = {
  bmi: 0.7,
  stability: 0.3,
} as const;

function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  if (m <= 0) return 0;
  return weightKg / (m * m);
}

/** 28-day coefficient of variation of weight in percent. */
function weightCv(series: { day: string; weightKg: number }[]): number | null {
  if (series.length < 4) return null;
  const values = series.map((p) => p.weightKg).filter((v) => v > 0);
  if (values.length < 4) return null;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean === 0) return null;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const sd = Math.sqrt(variance);
  return (sd / mean) * 100;
}

export function computeBodyBasicScore(input: PillarInput): number | null {
  const profile = input.profile;
  const series = input.weightSeries;
  const latestWeight = profile?.weightKg
    ?? series?.[series.length - 1]?.weightKg
    ?? null;
  const height = profile?.heightCm ?? null;
  if (latestWeight === null || height === null) return null;

  const bmiVal = bmi(latestWeight, height);
  const bmiSub = fBodyBmi(bmiVal);

  const cv = series && series.length >= 4 ? weightCv(series) : null;
  const stabilitySub = cv !== null ? fBodyStability(cv) : null;

  const parts: Array<{ value: number; weight: number } | null> = [
    { value: bmiSub, weight: BODY_WEIGHTS.bmi },
    stabilitySub !== null
      ? { value: stabilitySub, weight: BODY_WEIGHTS.stability }
      : null,
  ];
  const active = parts.filter(
    (p): p is { value: number; weight: number } => p !== null
  );

  const totalWeight = active.reduce((s, p) => s + p.weight, 0);
  if (totalWeight === 0) return null;
  const weighted = active.reduce((s, p) => s + p.value * p.weight, 0);
  return Math.round((weighted / totalWeight) * 100);
}
