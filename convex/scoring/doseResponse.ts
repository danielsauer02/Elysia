/**
 * Pure dose-response building blocks. Every constant traces back to
 * docs/analytics/scoring-model-v1.md §4.
 *
 * Convention: all functions accept a metric value and return a [0..1] score
 * representing "how healthy" that value is. Curves are piecewise linear and
 * monotone within each segment.
 */

/**
 * Linear interpolation over an array of (x,y) knots. Knots MUST be sorted
 * ascending by x. Result is clamped to [knots[0].y, knots[last].y]; in
 * practice all our curves use y in [0,1].
 */
export function pwl(knots: ReadonlyArray<readonly [number, number]>, x: number): number {
  if (knots.length === 0) return 0;
  if (knots.length === 1) return knots[0]![1];
  if (x <= knots[0]![0]) return knots[0]![1];
  if (x >= knots[knots.length - 1]![0]) return knots[knots.length - 1]![1];
  for (let i = 0; i < knots.length - 1; i++) {
    const [x0, y0] = knots[i]!;
    const [x1, y1] = knots[i + 1]!;
    if (x >= x0 && x <= x1) {
      if (x1 === x0) return y1;
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return knots[knots.length - 1]![1];
}

export function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

// ─── Sleep §4.1 ──────────────────────────────────────────────────────────────

export const SLEEP_DURATION_KNOTS = [
  [300, 0.0], [360, 0.5], [420, 0.85], [480, 1.0],
  [540, 1.0], [600, 0.85], [720, 0.5],
] as const;

export const SLEEP_EFFICIENCY_KNOTS = [
  [70, 0.0], [80, 0.5], [88, 0.85], [92, 1.0], [100, 1.0],
] as const;

export const SLEEP_CONSISTENCY_KNOTS = [
  [40, 0.0], [60, 0.4], [75, 0.7], [85, 1.0], [100, 1.0],
] as const;

export const SLEEP_RESTORATIVE_KNOTS = [
  [60, 0.0], [90, 0.4], [120, 0.7], [180, 1.0], [300, 1.0],
] as const;

export const fSleepDuration  = (min: number) => pwl(SLEEP_DURATION_KNOTS,    min);
export const fSleepEfficiency = (pct: number) => pwl(SLEEP_EFFICIENCY_KNOTS, pct);
export const fSleepConsistency = (pct: number) => pwl(SLEEP_CONSISTENCY_KNOTS, pct);
export const fSleepRestorative = (min: number) => pwl(SLEEP_RESTORATIVE_KNOTS, min);

// ─── Recovery §4.2 ───────────────────────────────────────────────────────────

export const RECOVERY_HRV_KNOTS = [
  [-30, 0.0], [-15, 0.4], [0, 0.7], [10, 1.0], [25, 1.0],
] as const;

/**
 * Doc §4.2 writes the RHR/resp knots best->worst for narrative clarity.
 * The pwl helper requires ascending x, so we store them ascending here. The
 * shape is identical (lower delta = better score).
 */
export const RECOVERY_RHR_KNOTS = [
  [-10, 1.0], [-2, 1.0], [2, 0.7], [8, 0.3], [15, 0.0],
] as const;

export const RECOVERY_RESP_KNOTS = [
  [-2, 1.0], [0, 1.0], [1, 0.7], [3, 0.4], [5, 0.0],
] as const;

/** HRV relative delta in percent vs baseline. Higher = better. */
export function fRecoveryHrv(valueMs: number, baselineMs: number): number {
  if (baselineMs <= 0) return 0;
  const deltaPct = ((valueMs - baselineMs) / baselineMs) * 100;
  return pwl(RECOVERY_HRV_KNOTS, deltaPct);
}

/** RHR relative delta in percent vs baseline. LOWER (negative) = better. */
export function fRecoveryRhr(valueBpm: number, baselineBpm: number): number {
  if (baselineBpm <= 0) return 0;
  const deltaPct = ((valueBpm - baselineBpm) / baselineBpm) * 100;
  // Knots are descending in score over rising delta (above-baseline RHR is bad).
  // Reverse interpretation: we keep RECOVERY_RHR_KNOTS sorted by x, but the y
  // values already encode "more delta = worse" via 0 at +15%, 1 at -2%/-10%.
  return pwl(RECOVERY_RHR_KNOTS, deltaPct);
}

/** Respiratory rate absolute delta (bpm) vs baseline. Lower delta = better. */
export function fRecoveryResp(value: number, baseline: number): number {
  const delta = value - baseline;
  return pwl(RECOVERY_RESP_KNOTS, delta);
}

// ─── Cardio §4.3 ─────────────────────────────────────────────────────────────

export const CARDIO_VO2_PCTILE_KNOTS = [
  [10, 0.0], [25, 0.35], [50, 0.65], [75, 0.9], [90, 1.0],
] as const;

/** Stored ascending; doc §4.3 writes best->worst. */
export const CARDIO_RHR_ABS_KNOTS = [
  [45, 1.0], [55, 0.9], [60, 0.7], [70, 0.4], [80, 0.0],
] as const;

export const fCardioVo2Percentile = (pct: number) => pwl(CARDIO_VO2_PCTILE_KNOTS, pct);
export const fCardioRhrAbs        = (bpm: number) => pwl(CARDIO_RHR_ABS_KNOTS,    bpm);

// ─── Activity §4.4 ───────────────────────────────────────────────────────────

export const ACTIVITY_STEPS_KNOTS = [
  [0, 0.0], [2000, 0.2], [4000, 0.45], [6000, 0.7],
  [8000, 0.9], [10000, 1.0], [15000, 1.0],
] as const;

export const ACTIVITY_KCAL_KNOTS = [
  [0, 0.0], [150, 0.3], [300, 0.6], [500, 0.9], [800, 1.0],
] as const;

export const ACTIVITY_WORKOUT_LOAD_KNOTS = [
  [0, 0.0], [15, 0.4], [30, 0.75], [45, 1.0], [120, 1.0],
] as const;

export const fActivitySteps        = (n: number) => pwl(ACTIVITY_STEPS_KNOTS, n);
export const fActivityKcal         = (k: number) => pwl(ACTIVITY_KCAL_KNOTS, k);
export const fActivityWorkoutLoad  = (min: number) => pwl(ACTIVITY_WORKOUT_LOAD_KNOTS, min);

// ─── Body Basics §4.5 ────────────────────────────────────────────────────────

export const BODY_BMI_KNOTS = [
  [15, 0.0], [18.5, 0.5], [20, 0.85], [22, 1.0],
  [24.9, 1.0], [27, 0.85], [30, 0.5], [35, 0.2], [40, 0.0],
] as const;

/** Stored ascending; doc §4.5 writes best->worst. */
export const BODY_STABILITY_KNOTS = [
  [0, 1.0], [1, 1.0], [2, 0.85], [5, 0.4], [10, 0.0],
] as const;

export const fBodyBmi       = (bmi: number) => pwl(BODY_BMI_KNOTS, bmi);
export const fBodyStability = (cv: number) => pwl(BODY_STABILITY_KNOTS, cv);

// ─── Nutrition §4.6 ──────────────────────────────────────────────────────────

export const NUTRITION_MACRO_KNOTS = [
  [0, 0.0], [50, 0.4], [75, 0.75], [90, 1.0], [100, 1.0],
] as const;

export const NUTRITION_PROTEIN_KNOTS = [
  [0.4, 0.0], [0.8, 0.4], [1.2, 0.85], [1.6, 1.0], [2.4, 1.0], [3.0, 0.85],
] as const;

export const NUTRITION_ENERGY_BALANCE_KNOTS = [
  [-1000, 0.3], [-500, 0.85], [0, 1.0], [500, 0.85], [1000, 0.3],
] as const;

export const fNutritionMacro          = (p: number) => pwl(NUTRITION_MACRO_KNOTS, p);
export const fNutritionProteinPerKg   = (p: number) => pwl(NUTRITION_PROTEIN_KNOTS, p);
export const fNutritionEnergyBalance  = (d: number) => pwl(NUTRITION_ENERGY_BALANCE_KNOTS, d);

// ─── Stress §4.8 ─────────────────────────────────────────────────────────────
//
// Derived from existing wearable signals - no new data source. The lower the
// observed variance / fragmentation / deviation, the higher the score.

/** HRV 3d coefficient of variation (%). Lower = calmer autonomic system. */
export const STRESS_HRV_CV_KNOTS = [
  [0, 1.0], [5, 1.0], [10, 0.85], [15, 0.6], [25, 0.3], [40, 0.0],
] as const;

/** Sleep fragmentation score: awakeMin + (100 - sleepEfficiencyPct). */
export const STRESS_FRAGMENTATION_KNOTS = [
  [0, 1.0], [10, 0.9], [25, 0.65], [40, 0.4], [60, 0.15], [100, 0.0],
] as const;

/** |respiratoryRate - baseline| / baseline * 100 (%). Lower = baseline. */
export const STRESS_RESP_DEV_KNOTS = [
  [0, 1.0], [3, 0.9], [7, 0.7], [12, 0.4], [20, 0.15], [30, 0.0],
] as const;

export const fStressHrvCv          = (cv: number) => pwl(STRESS_HRV_CV_KNOTS, cv);
export const fStressFragmentation  = (frag: number) => pwl(STRESS_FRAGMENTATION_KNOTS, frag);
export const fStressRespDeviation  = (dev: number) => pwl(STRESS_RESP_DEV_KNOTS, dev);

// ─── Habits §4.7 ─────────────────────────────────────────────────────────────

export const HABIT_ADHERENCE_KNOTS = [
  [0, 0.0], [40, 0.4], [60, 0.7], [80, 0.9], [95, 1.0],
] as const;

export const HABIT_BREADTH_KNOTS = [
  [0, 0.0], [1, 0.4], [2, 0.7], [3, 0.9], [4, 1.0],
] as const;

export const HABIT_STREAK_KNOTS = [
  [0, 0.2], [3, 0.5], [7, 0.8], [14, 1.0], [30, 1.0],
] as const;

export const fHabitAdherence14d   = (p: number) => pwl(HABIT_ADHERENCE_KNOTS, p);
export const fHabitCategoryBreadth = (c: number) => pwl(HABIT_BREADTH_KNOTS, c);
export const fHabitStreakFactor    = (s: number) => pwl(HABIT_STREAK_KNOTS, s);
