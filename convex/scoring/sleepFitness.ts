/**
 * Sleep Fitness Score — display-only score for the Sleep Deep-Dive screen.
 *
 * NOT the same as `computeSleepScore` in pillars/sleep.ts (longevity engine).
 * That pillar score keeps its own dose-response weights tuned for the aging
 * trajectory model. THIS score follows the Eight-Sleep "Sleep Fitness Score"
 * shape so the home-screen UI is legible without re-educating the user:
 *
 *   Time slept   40%
 *   Quality      50%   (efficiency 55 + restorative 30 + stress 15)
 *   Consistency  10%
 *
 * Subscore knots intentionally reuse `convex/scoring/doseResponse.ts` so
 * pillar + fitness scores agree on the underlying physiology.
 */

import {
  clamp01,
  fSleepConsistency,
  fSleepDuration,
  fSleepEfficiency,
  fSleepRestorative,
  pwl,
} from "./doseResponse";

// ─── Inputs ──────────────────────────────────────────────────────────────────

export interface SleepFitnessInput {
  sleepMinutes: number | undefined;
  sleepDeepMinutes?: number | undefined;
  sleepRemMinutes?: number | undefined;
  sleepLightMinutes?: number | undefined;
  sleepAwakeMinutes?: number | undefined;
  sleepEfficiencyPct?: number | undefined;
  sleepConsistencyPct?: number | undefined;
  /**
   * Number of inferred stage transitions ("fragmentation events") that
   * happened during the night. Optional — when missing we fall back to
   * `sleepAwakeMinutes` alone, which is the only signal we get from the
   * current Whoop API. The upcoming smart band will supply this directly.
   */
  stageTransitions?: number | undefined;
  /**
   * Trailing midpoints-of-sleep in DECIMAL HOURS (e.g. 3.25 for 03:15)
   * for the last 14 days, NOT including today. Used as a fallback when
   * `sleepConsistencyPct` is missing (Apple Health / Health Connect).
   * Length < 3 → fallback is treated as "unknown" and consistency is
   * dropped from the score with weight renormalisation.
   */
  recentMidpoints14d?: number[] | undefined;
  /**
   * Age-banded optimal sleep target in MINUTES (e.g. 480 for 8h adults).
   * When provided, the Time sub-score uses linear actual/target
   * normalisation — matching the visible "X% of your age target" UX
   * we render on the hero. When omitted, the legacy dose-response
   * curve is used (so existing tests stay deterministic).
   */
  targetSleepMinutes?: number | undefined;
}

/**
 * NSF-aligned age-banded optimal sleep target (in minutes). Used by
 * `getSleepTargetMinutes` on the backend and the home hero on the
 * client so both stay in sync.
 */
export function targetSleepMinutesForAge(ageYears: number): number {
  if (!Number.isFinite(ageYears) || ageYears <= 0) return 480;
  if (ageYears < 14) return 600; // 10h
  if (ageYears < 18) return 540; // 9h
  if (ageYears < 65) return 480; // 8h
  return 450; // 7.5h
}

// ─── Sub-score curves ────────────────────────────────────────────────────────

/**
 * Mirror of SLEEP_DURATION_KNOTS but tuned so 480 min reads 100 (the spec
 * uses 1.0 at 480), 360 min reads 40 instead of 50 (penalises 6h harder
 * because the consumer expectation post-Eight-Sleep is that 6h ≠ "ok").
 */
export const SLEEP_TIME_KNOTS = [
  [300, 0.0],
  [360, 0.4],
  [420, 0.8],
  [480, 1.0],
  [540, 1.0],
  [600, 0.85],
  [720, 0.5],
] as const;

/** Stage-transition fragmentation curve (0 events = perfect, ≥40 = noisy). */
export const SLEEP_TRANSITIONS_KNOTS = [
  [0, 1.0],
  [5, 0.95],
  [10, 0.85],
  [20, 0.65],
  [30, 0.4],
  [40, 0.2],
  [60, 0.0],
] as const;

/** Pure awake-minute fallback when transitions are not available. */
export const SLEEP_AWAKE_KNOTS = [
  [0, 1.0],
  [5, 0.95],
  [15, 0.8],
  [30, 0.55],
  [60, 0.25],
  [120, 0.0],
] as const;

/** Sleep-midpoint stddev over 14 days (hours). 0.3h ≈ Whoop's "consistent". */
export const SLEEP_MIDPOINT_STDDEV_KNOTS = [
  [0.2, 1.0],
  [0.5, 0.85],
  [1.0, 0.6],
  [1.5, 0.35],
  [2.5, 0.1],
  [4.0, 0.0],
] as const;

/**
 * Time-slept score as a NON-LINEAR function of `actual/target`. The user
 * spec is explicit: "die hälfte des optimal benötigten schlafes ergibt
 * 50% score für time slept" is wrong — sleep deprivation has to read as
 * severe. Knots tuned so 50% target ≈ 25, 75% target ≈ 60, 100% = 100,
 * with a milder shoulder for oversleeping (the body recovers, just not
 * efficiently).
 */
export const SLEEP_TIME_RATIO_KNOTS = [
  [0.0, 0.0],
  [0.3, 0.05],
  [0.5, 0.25],
  [0.65, 0.45],
  [0.8, 0.7],
  [0.9, 0.88],
  [1.0, 1.0],
  [1.1, 1.0],
  [1.3, 0.85],
  [1.6, 0.55],
  [2.0, 0.2],
] as const;

export const fSleepTimeRatio = (ratio: number) =>
  pwl(SLEEP_TIME_RATIO_KNOTS, ratio);

export const fSleepTime = (min: number) => pwl(SLEEP_TIME_KNOTS, min);
export const fSleepTransitions = (n: number) => pwl(SLEEP_TRANSITIONS_KNOTS, n);
export const fSleepAwake = (min: number) => pwl(SLEEP_AWAKE_KNOTS, min);
export const fSleepMidpointStability = (stddevH: number) =>
  pwl(SLEEP_MIDPOINT_STDDEV_KNOTS, stddevH);

// ─── Weights & quality bands ─────────────────────────────────────────────────

export const FITNESS_WEIGHTS = {
  time: 0.4,
  quality: 0.5,
  consistency: 0.1,
} as const;

/** Internal weights inside the Quality sub-score. Sum to 1.0. */
export const QUALITY_SUB_WEIGHTS = {
  efficiency: 0.55,
  restorative: 0.3,
  stress: 0.15,
} as const;

export type SleepFitnessQuality = "optimal" | "in_range" | "poor";

export function classifyQuality(score: number): SleepFitnessQuality {
  if (score >= 80) return "optimal";
  if (score >= 60) return "in_range";
  return "poor";
}

// ─── Public output ───────────────────────────────────────────────────────────

export interface SleepFitnessResult {
  /** 0..100 overall score, rounded. */
  score: number;
  /** Each sub-score in 0..100. `null` when input was missing. */
  subTime: number;
  subQuality: number | null;
  subConsistency: number | null;
  /** Quality components (only the present ones); each 0..100. */
  qualityParts: {
    efficiency: number | null;
    restorative: number | null;
    stress: number | null;
  };
  quality: SleepFitnessQuality;
  /**
   * Which top-level components were active. The score renormalises across
   * these — a user with only `sleepMinutes` still gets a fair number.
   */
  activeParts: Array<"time" | "quality" | "consistency">;
}

// ─── Computation ─────────────────────────────────────────────────────────────

/**
 * Computes the Eight-Sleep-style overall score plus its breakdown.
 *
 * Returns `null` only when `sleepMinutes` is missing — Time is required;
 * without it the night did not happen on this device. Sub-components are
 * renormalised when their inputs are missing.
 */
export function computeSleepFitnessScore(
  input: SleepFitnessInput
): SleepFitnessResult | null {
  if (input.sleepMinutes === undefined || input.sleepMinutes <= 0) return null;

  // Time: prefer the age-banded actual/target ratio when the caller
  // supplies a target — that's what the UI advertises ("100% = your age
  // target"). The mapping is intentionally NON-LINEAR (see
  // SLEEP_TIME_RATIO_KNOTS): 50% of target reads ~25, 75% reads ~60.
  // Falls back to the legacy duration-minute dose-response curve for
  // callers that don't supply a target (kept for test determinism).
  const subTime =
    input.targetSleepMinutes && input.targetSleepMinutes > 0
      ? Math.round(
          clamp01(
            fSleepTimeRatio(input.sleepMinutes / input.targetSleepMinutes)
          ) * 100
        )
      : Math.round(clamp01(fSleepTime(input.sleepMinutes)) * 100);

  // Quality: efficiency + restorative + stress, renormalised over present parts
  const effSub =
    input.sleepEfficiencyPct !== undefined
      ? Math.round(clamp01(fSleepEfficiency(input.sleepEfficiencyPct)) * 100)
      : null;

  const restorativeMin =
    (input.sleepDeepMinutes ?? 0) + (input.sleepRemMinutes ?? 0);
  const hasRestorativeSignal =
    input.sleepDeepMinutes !== undefined || input.sleepRemMinutes !== undefined;
  const restorativeSub = hasRestorativeSignal
    ? Math.round(clamp01(fSleepRestorative(restorativeMin)) * 100)
    : null;

  // Stress (fragmentation proxy). Prefer stage transitions when known.
  let stressSub: number | null = null;
  if (input.stageTransitions !== undefined) {
    stressSub = Math.round(clamp01(fSleepTransitions(input.stageTransitions)) * 100);
  } else if (input.sleepAwakeMinutes !== undefined) {
    stressSub = Math.round(clamp01(fSleepAwake(input.sleepAwakeMinutes)) * 100);
  }

  const qualityParts: SleepFitnessResult["qualityParts"] = {
    efficiency: effSub,
    restorative: restorativeSub,
    stress: stressSub,
  };

  const qualityComponents: Array<{ v: number; w: number }> = [];
  if (effSub !== null) qualityComponents.push({ v: effSub, w: QUALITY_SUB_WEIGHTS.efficiency });
  if (restorativeSub !== null) qualityComponents.push({ v: restorativeSub, w: QUALITY_SUB_WEIGHTS.restorative });
  if (stressSub !== null) qualityComponents.push({ v: stressSub, w: QUALITY_SUB_WEIGHTS.stress });

  let subQuality: number | null = null;
  if (qualityComponents.length > 0) {
    const totalW = qualityComponents.reduce((s, p) => s + p.w, 0);
    const weighted = qualityComponents.reduce((s, p) => s + p.v * p.w, 0);
    subQuality = Math.round(weighted / totalW);
  }

  // Consistency: Whoop value preferred, else midpoint stddev fallback.
  let subConsistency: number | null = null;
  if (input.sleepConsistencyPct !== undefined) {
    subConsistency = Math.round(
      clamp01(fSleepConsistency(input.sleepConsistencyPct)) * 100
    );
  } else if (input.recentMidpoints14d && input.recentMidpoints14d.length >= 3) {
    const stddev = circularStddevHours(input.recentMidpoints14d);
    subConsistency = Math.round(clamp01(fSleepMidpointStability(stddev)) * 100);
  }

  // Top-level renormalisation
  const topParts: Array<{ id: "time" | "quality" | "consistency"; v: number; w: number }> = [
    { id: "time", v: subTime, w: FITNESS_WEIGHTS.time },
  ];
  if (subQuality !== null) topParts.push({ id: "quality", v: subQuality, w: FITNESS_WEIGHTS.quality });
  if (subConsistency !== null) topParts.push({ id: "consistency", v: subConsistency, w: FITNESS_WEIGHTS.consistency });

  const totalTopW = topParts.reduce((s, p) => s + p.w, 0);
  const weightedTop = topParts.reduce((s, p) => s + p.v * p.w, 0);
  const score = Math.round(weightedTop / totalTopW);

  return {
    score,
    subTime,
    subQuality,
    subConsistency,
    qualityParts,
    quality: classifyQuality(score),
    activeParts: topParts.map((p) => p.id),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Standard deviation of sleep midpoints expressed in decimal hours,
 * computed on the CIRCLE so a midpoint of 23.5 (11:30 PM) and 0.5
 * (00:30 AM) read as 1 hour apart, not 23.
 *
 * Algorithm: convert each hour to a unit vector on the 24h clock, take
 * the resultant vector R; circular stddev ≈ sqrt(-2 * ln(|R|)) in
 * radians, converted to hours via /(2π) * 24.
 */
export function circularStddevHours(midpointsH: number[]): number {
  if (midpointsH.length === 0) return 0;
  const twoPi = 2 * Math.PI;
  let sx = 0;
  let sy = 0;
  for (const h of midpointsH) {
    const theta = ((h % 24) / 24) * twoPi;
    sx += Math.cos(theta);
    sy += Math.sin(theta);
  }
  const n = midpointsH.length;
  const r = Math.sqrt(sx * sx + sy * sy) / n;
  if (r <= 0) return 12; // pathological: opposite midpoints cancel — max spread
  if (r >= 1) return 0;
  const stddevRad = Math.sqrt(-2 * Math.log(r));
  return (stddevRad / twoPi) * 24;
}
