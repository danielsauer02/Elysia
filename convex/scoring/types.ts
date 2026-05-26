/**
 * Shared types for the Elysia Health Score engine.
 *
 * Spec: docs/analytics/scoring-model-v1.md
 *
 * Pure types only — safe to import from both Convex isolate code
 * (convex/scoring/**) and Vitest tests.
 */

export const TIER_1_PILLAR_IDS = [
  "sleep",
  "recovery",
  "cardio",
  "activity",
  "bodyBasic",
  "nutrition",
  "habits",
  "stress",
] as const;

export const TIER_2_PILLAR_IDS = ["blood", "bodyComp", "metabolic"] as const;

export const TIER_3_PILLAR_IDS = ["skin", "hair", "genetic"] as const;

export const ALL_PILLAR_IDS = [
  ...TIER_1_PILLAR_IDS,
  ...TIER_2_PILLAR_IDS,
  ...TIER_3_PILLAR_IDS,
] as const;

export type Tier1PillarId = (typeof TIER_1_PILLAR_IDS)[number];
export type Tier2PillarId = (typeof TIER_2_PILLAR_IDS)[number];
export type Tier3PillarId = (typeof TIER_3_PILLAR_IDS)[number];
export type PillarId = (typeof ALL_PILLAR_IDS)[number];

export type SourceId =
  | "wearableDaily"
  | "weightLog"
  | "foodLog"
  | "habitCompletions"
  | "labPanel"
  | "bodyCompositionScan"
  | "geneticReport"
  | "skinAssessment";

export type BaselineStatus = "calibrating" | "ready" | "stale";

/**
 * Input record fed to every pillar's computeScore. Optional fields stay
 * undefined when the source has no data — pillars decide whether they can
 * still produce a score from what is present.
 */
export interface PillarInput {
  /** Daily wearable aggregates for the day being scored. */
  wearableDaily: {
    steps?: number;
    activeKcal?: number;
    workoutKcal?: number;
    workoutCount?: number;
    restingHrBpm?: number;
    hrAvgBpm?: number;
    hrMaxBpm?: number;
    hrvAvgMs?: number;
    spo2AvgPct?: number;
    respiratoryRateAvg?: number;
    sleepMinutes?: number;
    sleepDeepMinutes?: number;
    sleepRemMinutes?: number;
    sleepLightMinutes?: number;
    sleepAwakeMinutes?: number;
    sleepEfficiencyPct?: number;
    sleepConsistencyPct?: number;
    sleepPerformancePct?: number;
    vo2Max?: number;
    distanceM?: number;
    totalKcal?: number;
  } | null;
  /** Daily energy balance row (food + tdee). */
  energyBalance: {
    intakeKcal?: number;
    tdeeEstimate?: number;
    balanceKcal?: number;
    proteinG?: number;
    proteinPerKg?: number;
    macroCompliancePct?: number;
    trainingLoad?: number;
  } | null;
  /** Profile basics: sex, age, anthropometry. */
  profile: {
    sex?: string;
    dateOfBirth?: string;
    heightCm?: number;
    weightKg?: number;
  } | null;
  /** Latest weight + 28d weight series for stability. */
  weightSeries: { day: string; weightKg: number }[] | null;
  /**
   * Trailing N-day wearable history (typically 7 days incl. today) used by
   * the Stress pillar for HRV variance and trend detection. Only fields the
   * pillar actually consumes are pulled.
   */
  recentWearable: { day: string; hrvAvgMs?: number; restingHrBpm?: number; respiratoryRateAvg?: number }[] | null;
  /** Habit roll-up for the day: counts, categories, streaks, adherence. */
  habits: {
    activeCount: number;
    completedToday: number;
    expectedToday: number;
    distinctCategories: number;
    maxStreakDays: number;
    /** Rolling 14d adherence in percent (0..100). */
    adherence14dPct: number;
  } | null;
}

/**
 * User baseline metrics consumed by pillar scoring (mostly Recovery).
 * Cohort defaults are filled in when the user is still calibrating.
 */
export interface BaselineMetrics {
  hrvMedian?: number;
  rhrMedian?: number;
  sleepMedian?: number;
  stepsMedian?: number;
  respMedian?: number;
  weightMedianKg?: number;
}

export interface BaselineContext {
  status: BaselineStatus;
  daysCalibrated: number;
  metrics: BaselineMetrics;
}

/**
 * Static definition of one pillar. Tier 2/3 entries set `active: false` and
 * carry a `computeScore` that always returns null so the composite shape
 * stays stable.
 */
export interface PillarDefinition {
  id: PillarId;
  label: string;
  tier: 1 | 2 | 3;
  /** Within-tier weight share. Tier 1 weights sum to 1.0. */
  weight: number;
  /** Years deducted/added at full +50 score delta. */
  lambda: number;
  /** Minutes credited per +1 score point above baseline. */
  beta: number;
  requiredSources: SourceId[];
  active: boolean;
  computeScore: (input: PillarInput, baseline: BaselineContext) => number | null;
}

export type PillarScoreMap = Record<PillarId, number | null>;

export interface CompositeResult {
  composite: number | null;
  tierLevel: 1 | 2 | 3 | null;
  coverage: number;
  activePillarIds: PillarId[];
}
