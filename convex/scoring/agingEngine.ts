/**
 * Aging engine - pure math.
 *
 * Spec: docs/analytics/scoring-model-v1.md §8.
 *
 * No Convex imports here; the action layer (`convex/scoring.ts`) handles I/O.
 */

import { PILLAR_REGISTRY, PILLARS_BY_ID } from "./pillarRegistry";
import type { PillarId, PillarScoreMap } from "./types";

/** Hard caps from §8.1. Prevent runaway from data anomalies. */
export const AGE_DELTA_CAP_YEARS = 10;

/**
 * Elysia Age computation.
 *
 * `ageDelta = Σ λ_p * (score_p - 50)/50`  for each ACTIVE pillar with a
 * non-null score. Result clamped to ±10 years before being subtracted from
 * the chronological age.
 *
 * - score=100 -> -λ years (younger by λ)
 * - score=50  -> no change
 * - score=0   -> +λ years (older by λ)
 */
export function computeElysiaAge(
  chronoAge: number,
  scores: PillarScoreMap
): { elysiaAge: number; delta: number; ageDelta: number } {
  let ageDelta = 0;
  for (const pillar of PILLAR_REGISTRY) {
    if (!pillar.active) continue;
    const score = scores[pillar.id];
    if (score === null || score === undefined) continue;
    ageDelta += pillar.lambda * ((score - 50) / 50);
  }
  if (ageDelta > AGE_DELTA_CAP_YEARS) ageDelta = AGE_DELTA_CAP_YEARS;
  if (ageDelta < -AGE_DELTA_CAP_YEARS) ageDelta = -AGE_DELTA_CAP_YEARS;
  const elysiaAge = chronoAge - ageDelta;
  return { elysiaAge, delta: elysiaAge - chronoAge, ageDelta };
}

/**
 * OLS slope of `(elysiaAge - chronoAge)` over the last N days, then scaled
 * to years per year (×365/N).
 *
 * Returns null if fewer than 14 points present.
 */
export function computeVelocity(
  points: { day: string; delta: number }[]
): number | null {
  if (points.length < 14) return null;
  const sorted = [...points].sort((a, b) => a.day.localeCompare(b.day));
  const n = sorted.length;
  // x = day index (0..n-1), y = delta.
  const xs = sorted.map((_, i) => i);
  const ys = sorted.map((p) => p.delta);
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    num += dx * dy;
    den += dx * dx;
  }
  if (den === 0) return null;
  const slopePerDay = num / den;
  return slopePerDay * (365 / n);
}

/**
 * Confidence factor combining calibration status and Tier-1 coverage.
 * Spec §9.
 */
export function computeConfidence(args: {
  status: "calibrating" | "ready" | "stale";
  daysCalibrated: number;
  coverage: number;
}): number {
  if (args.status === "calibrating") return 0;
  // After ready, ramp 0.6 -> 1.0 over days 14..90.
  const extraDays = Math.max(0, args.daysCalibrated - 14);
  const ramp = 0.6 + 0.4 * Math.min(1, extraDays / 76);
  return Math.max(0, Math.min(1, ramp * args.coverage));
}

export interface Contribution {
  pillar: PillarId;
  tier: 1 | 2 | 3;
  deltaMinutes: number;
  rationale: string;
}

/**
 * Per-pillar daily contribution in minutes vs the 28-day pillar baseline.
 * `pillarBaselineScores` should hold the median pillar score over the
 * trailing 28 days (or default 50 during calibration).
 */
export function computeContributions(
  todayScores: PillarScoreMap,
  pillarBaselineScores: Partial<Record<PillarId, number>>
): Contribution[] {
  const out: Contribution[] = [];
  for (const pillar of PILLAR_REGISTRY) {
    if (!pillar.active) continue;
    const score = todayScores[pillar.id];
    if (score === null || score === undefined) continue;
    const baseline = pillarBaselineScores[pillar.id] ?? 50;
    const deltaScore = score - baseline;
    const deltaMinutes = deltaScore * pillar.beta;
    out.push({
      pillar: pillar.id,
      tier: pillar.tier,
      deltaMinutes: Math.round(deltaMinutes),
      rationale: rationaleFor(pillar.id, score, baseline),
    });
  }
  return out;
}

function rationaleFor(id: PillarId, score: number, baseline: number): string {
  const label = PILLARS_BY_ID[id].label;
  const diff = score - baseline;
  if (Math.abs(diff) < 3) return `${label} held steady around your baseline (${score}).`;
  if (diff > 0) return `${label} ${score} vs your 28d baseline ${Math.round(baseline)}.`;
  return `${label} dropped to ${score} from a ${Math.round(baseline)} baseline.`;
}

/**
 * Median over an array. Returns null for empty input.
 */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

/**
 * Per-pillar 28d median from a history of score maps.
 */
export function computePillarBaselines(
  history: PillarScoreMap[]
): Partial<Record<PillarId, number>> {
  const baselines: Partial<Record<PillarId, number>> = {};
  for (const pillar of PILLAR_REGISTRY) {
    if (!pillar.active) continue;
    const values = history
      .map((m) => m[pillar.id])
      .filter((v): v is number => v !== null && v !== undefined);
    const med = median(values);
    if (med !== null) baselines[pillar.id] = med;
  }
  return baselines;
}
