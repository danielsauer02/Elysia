/**
 * Recovery Fitness Score — display-only score for the Recovery Deep-Dive
 * screen.
 *
 * NOT the same as `computeRecoveryScore` in pillars/recovery.ts (longevity
 * engine). That pillar score keeps its own weights tuned for the aging
 * trajectory model. THIS score follows the Whoop "Recovery" shape so the
 * tracking-view UI reads like the sleep view's Sleep Fitness Score:
 *
 *   HRV          40%   (vs personal baseline — strongest recovery marker)
 *   Resting HR   25%   (vs personal baseline — lower vs baseline = better)
 *   Sleep        25%   (last night's Elysia Sleep Score, 0..100)
 *   Resp. rate   10%   (vs personal baseline — early illness/strain signal)
 *
 * Sub-score curves intentionally reuse `convex/scoring/doseResponse.ts` so the
 * pillar + fitness recovery scores agree on the underlying physiology. Like
 * the sleep score, the total renormalises across whichever parts are present
 * so a user with only HRV still gets a fair number.
 */

import { clamp01, fRecoveryHrv, fRecoveryResp, fRecoveryRhr } from "./doseResponse";

// ─── Inputs ──────────────────────────────────────────────────────────────────

export interface RecoveryFitnessBaseline {
  hrvMedian?: number | undefined;
  rhrMedian?: number | undefined;
  respMedian?: number | undefined;
}

export interface RecoveryFitnessInput {
  /** Nightly/daily average HRV (ms). */
  hrvAvgMs?: number | undefined;
  /** Resting heart rate (bpm). */
  restingHrBpm?: number | undefined;
  /** Respiratory rate (breaths/min). */
  respiratoryRateAvg?: number | undefined;
  /** Last night's Elysia Sleep Score (0..100), already computed upstream. */
  sleepScore?: number | undefined;
  /** Personal rolling-median baselines (cohort fallback applied below). */
  baseline: RecoveryFitnessBaseline;
}

/**
 * Cohort fallbacks when the user has no personal baseline yet. Mirrors
 * `pillars/recovery.ts` so both recovery scores calibrate identically.
 */
export const RECOVERY_COHORT_BASELINE = {
  hrvMedian: 45,
  rhrMedian: 62,
  respMedian: 15,
} as const;

// ─── Weights & quality bands ───────────────────────────────────────────────────

export const RECOVERY_FITNESS_WEIGHTS = {
  hrv: 0.4,
  rhr: 0.25,
  sleep: 0.25,
  resp: 0.1,
} as const;

export type RecoveryFitnessQuality = "high" | "moderate" | "low";

/** Whoop-style recovery bands: High (green) / Moderate (amber) / Low (red). */
export function classifyRecovery(score: number): RecoveryFitnessQuality {
  if (score >= 80) return "high";
  if (score >= 60) return "moderate";
  return "low";
}

// ─── Public output ─────────────────────────────────────────────────────────────

export interface RecoveryFitnessResult {
  /** 0..100 overall score, rounded. */
  score: number;
  /** Each sub-score in 0..100. `null` when the input was missing. */
  subHrv: number | null;
  subRhr: number | null;
  subSleep: number | null;
  subResp: number | null;
  quality: RecoveryFitnessQuality;
  /**
   * Which components were active. The score renormalises across these — a
   * user with only HRV still gets a fair number.
   */
  activeParts: Array<"hrv" | "rhr" | "sleep" | "resp">;
}

// ─── Computation ─────────────────────────────────────────────────────────────

/**
 * Computes the Whoop-style recovery score plus its breakdown.
 *
 * Returns `null` when neither cardio signal (HRV nor resting HR) is present —
 * those are the backbone of recovery; without either there is nothing
 * meaningful to score. Sub-components are renormalised when missing.
 */
export function computeRecoveryFitnessScore(
  input: RecoveryFitnessInput
): RecoveryFitnessResult | null {
  const hrvBase = input.baseline.hrvMedian ?? RECOVERY_COHORT_BASELINE.hrvMedian;
  const rhrBase = input.baseline.rhrMedian ?? RECOVERY_COHORT_BASELINE.rhrMedian;
  const respBase =
    input.baseline.respMedian ?? RECOVERY_COHORT_BASELINE.respMedian;

  const subHrv =
    input.hrvAvgMs !== undefined && Number.isFinite(input.hrvAvgMs)
      ? Math.round(clamp01(fRecoveryHrv(input.hrvAvgMs, hrvBase)) * 100)
      : null;
  const subRhr =
    input.restingHrBpm !== undefined && Number.isFinite(input.restingHrBpm)
      ? Math.round(clamp01(fRecoveryRhr(input.restingHrBpm, rhrBase)) * 100)
      : null;
  const subResp =
    input.respiratoryRateAvg !== undefined &&
    Number.isFinite(input.respiratoryRateAvg)
      ? Math.round(clamp01(fRecoveryResp(input.respiratoryRateAvg, respBase)) * 100)
      : null;
  const subSleep =
    input.sleepScore !== undefined && Number.isFinite(input.sleepScore)
      ? Math.round(Math.max(0, Math.min(100, input.sleepScore)))
      : null;

  // Require at least one cardio signal — same gate as the recovery pillar.
  if (subHrv === null && subRhr === null) return null;

  const parts: Array<{
    id: "hrv" | "rhr" | "sleep" | "resp";
    v: number;
    w: number;
  }> = [];
  if (subHrv !== null) parts.push({ id: "hrv", v: subHrv, w: RECOVERY_FITNESS_WEIGHTS.hrv });
  if (subRhr !== null) parts.push({ id: "rhr", v: subRhr, w: RECOVERY_FITNESS_WEIGHTS.rhr });
  if (subSleep !== null) parts.push({ id: "sleep", v: subSleep, w: RECOVERY_FITNESS_WEIGHTS.sleep });
  if (subResp !== null) parts.push({ id: "resp", v: subResp, w: RECOVERY_FITNESS_WEIGHTS.resp });

  const totalW = parts.reduce((s, p) => s + p.w, 0);
  if (totalW === 0) return null;
  const weighted = parts.reduce((s, p) => s + p.v * p.w, 0);
  const score = Math.round(weighted / totalW);

  return {
    score,
    subHrv,
    subRhr,
    subSleep,
    subResp,
    quality: classifyRecovery(score),
    activeParts: parts.map((p) => p.id),
  };
}
