import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { getAuthUserId } from "./_helpers";

const SAMPLE_BATCH_LIMIT = 1000;
const WORKOUT_BATCH_LIMIT = 200;

const sampleValidator = v.object({
  source: v.string(),
  sampleId: v.string(),
  metricType: v.string(),
  startTime: v.string(),
  endTime: v.string(),
  value: v.number(),
  unit: v.string(),
  stage: v.optional(v.string()),
  sourceDevice: v.optional(v.string()),
  sourceApp: v.optional(v.string()),
});

const workoutValidator = v.object({
  source: v.string(),
  sourceWorkoutId: v.string(),
  activityType: v.string(),
  startTime: v.string(),
  endTime: v.string(),
  durationSec: v.number(),
  activeKcal: v.optional(v.number()),
  distanceM: v.optional(v.number()),
  hrAvgBpm: v.optional(v.number()),
  hrMaxBpm: v.optional(v.number()),
  sourceDevice: v.optional(v.string()),
});

function isoDay(iso: string): string {
  return iso.slice(0, 10);
}

function uniqueDays(rows: Array<{ day: string }>): string[] {
  const set = new Set<string>();
  for (const r of rows) set.add(r.day);
  return [...set];
}

// ─── Public mutations: ingest from mobile (HealthKit / Health Connect) ──────

export const ingestSamplesBatch = mutation({
  args: { samples: v.array(sampleValidator) },
  handler: async (ctx, { samples }) => {
    if (samples.length === 0) return { inserted: 0, skipped: 0 };
    if (samples.length > SAMPLE_BATCH_LIMIT) {
      throw new Error(`Batch too large (${samples.length} > ${SAMPLE_BATCH_LIMIT})`);
    }

    const userId = await getAuthUserId(ctx);
    return await ingestSamplesInternal(ctx, userId, samples);
  },
});

export const ingestWorkoutsBatch = mutation({
  args: { workouts: v.array(workoutValidator) },
  handler: async (ctx, { workouts }) => {
    if (workouts.length === 0) return { inserted: 0, skipped: 0 };
    if (workouts.length > WORKOUT_BATCH_LIMIT) {
      throw new Error(`Batch too large (${workouts.length} > ${WORKOUT_BATCH_LIMIT})`);
    }

    const userId = await getAuthUserId(ctx);
    return await ingestWorkoutsInternal(ctx, userId, workouts);
  },
});

// ─── Internal versions for actions (Whoop/Oura/Fitbit pulls) ─────────────────

export const ingestSamplesForUserInternal = internalMutation({
  args: { userId: v.string(), samples: v.array(sampleValidator) },
  handler: async (ctx, { userId, samples }) => {
    return await ingestSamplesInternal(ctx, userId, samples);
  },
});

export const ingestWorkoutsForUserInternal = internalMutation({
  args: { userId: v.string(), workouts: v.array(workoutValidator) },
  handler: async (ctx, { userId, workouts }) => {
    return await ingestWorkoutsInternal(ctx, userId, workouts);
  },
});

/**
 * Upsert variant of sample ingestion used for cycle/total-day metrics that
 * keep updating throughout the day (Whoop cycle's `kilojoule` grows as the
 * day progresses). Patches the value/end of an existing sample with the
 * same `sampleId` instead of skipping it.
 */
export const upsertCycleSamplesInternal = internalMutation({
  args: { userId: v.string(), samples: v.array(sampleValidator) },
  handler: async (ctx, { userId, samples }) => {
    const now = new Date().toISOString();
    let inserted = 0;
    let updated = 0;
    const touchedDays = new Set<string>();

    for (const s of samples) {
      const day = SLEEP_END_DAY_METRICS.has(s.metricType)
        ? isoDay(s.endTime ?? s.startTime)
        : isoDay(s.startTime);
      touchedDays.add(day);

      const existing = await ctx.db
        .query("wearableSamples")
        .withIndex("by_user_source_sample", (q: any) =>
          q.eq("userId", userId).eq("source", s.source).eq("sampleId", s.sampleId)
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          value: s.value,
          endTime: s.endTime,
          day,
          syncedAt: now,
        });
        updated += 1;
      } else {
        await ctx.db.insert("wearableSamples", {
          userId,
          source: s.source,
          sampleId: s.sampleId,
          metricType: s.metricType,
          startTime: s.startTime,
          endTime: s.endTime,
          day,
          value: s.value,
          unit: s.unit,
          stage: s.stage,
          sourceDevice: s.sourceDevice,
          sourceApp: s.sourceApp,
          syncedAt: now,
        });
        inserted += 1;
      }
    }

    // Trigger daily rollup for each affected day.
    for (const day of touchedDays) {
      await ctx.scheduler.runAfter(0, internal.wearables.rollupDay, {
        userId,
        day,
      });
    }

    return { inserted, skipped: updated };
  },
});

// ─── Sync state ──────────────────────────────────────────────────────────────

export const upsertSyncState = mutation({
  args: {
    source: v.string(),
    metricType: v.string(),
    lastSyncedEnd: v.string(),
    isFullSync: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    await upsertSyncStateInternal(ctx, {
      userId,
      source: args.source,
      metricType: args.metricType,
      lastSyncedEnd: args.lastSyncedEnd,
      isFullSync: args.isFullSync ?? false,
    });
  },
});

export const upsertSyncStateInternalMutation = internalMutation({
  args: {
    userId: v.string(),
    source: v.string(),
    metricType: v.string(),
    lastSyncedEnd: v.string(),
    isFullSync: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await upsertSyncStateInternal(ctx, {
      userId: args.userId,
      source: args.source,
      metricType: args.metricType,
      lastSyncedEnd: args.lastSyncedEnd,
      isFullSync: args.isFullSync ?? false,
    });
  },
});

export const getSyncState = query({
  args: { source: v.optional(v.string()) },
  handler: async (ctx, { source }) => {
    const userId = await getAuthUserId(ctx);
    const all = await ctx.db
      .query("wearableSyncState")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
    const filtered = source ? all.filter((s) => s.source === source) : all;
    return filtered.map((s) => ({
      source: s.source,
      metricType: s.metricType,
      lastSyncedEnd: s.lastSyncedEnd,
      lastFullSyncAt: s.lastFullSyncAt,
    }));
  },
});

// ─── Read APIs for UI / analytics ────────────────────────────────────────────

export const getDailyMetrics = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const userId = await getAuthUserId(ctx);
    const rows = await ctx.db
      .query("wearableDailyMetrics")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", from).lte("day", to)
      )
      .collect();
    return rows.sort((a, b) => a.day.localeCompare(b.day));
  },
});

export const getIntradaySeries = query({
  args: {
    metricType: v.string(),
    from: v.string(),
    to: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { metricType, from, to, limit }) => {
    const userId = await getAuthUserId(ctx);
    const rows = await ctx.db
      .query("wearableSamples")
      .withIndex("by_user_metric_time", (q) =>
        q
          .eq("userId", userId)
          .eq("metricType", metricType)
          .gte("startTime", from)
          .lte("startTime", to)
      )
      .take(limit ?? 5000);
    return rows;
  },
});

export const getWorkouts = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const userId = await getAuthUserId(ctx);
    return await ctx.db
      .query("wearableWorkouts")
      .withIndex("by_user_time", (q) =>
        q.eq("userId", userId).gte("startTime", from).lte("startTime", to)
      )
      .collect();
  },
});

// ─── Internal queries used by aggregator/analytics ──────────────────────────

export const getSamplesForDayInternal = internalQuery({
  args: { userId: v.string(), day: v.string(), metricType: v.string() },
  handler: async (ctx, { userId, day, metricType }) => {
    return await ctx.db
      .query("wearableSamples")
      .withIndex("by_user_day_metric", (q) =>
        q.eq("userId", userId).eq("day", day).eq("metricType", metricType)
      )
      .collect();
  },
});

export const getWorkoutsForDayInternal = internalQuery({
  args: { userId: v.string(), day: v.string() },
  handler: async (ctx, { userId, day }) => {
    return await ctx.db
      .query("wearableWorkouts")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
      .collect();
  },
});

/** True when the day has at least one raw wearable sample. */
export const dayHasSamplesInternal = internalQuery({
  args: { userId: v.string(), day: v.string() },
  handler: async (ctx, { userId, day }) => {
    const row = await ctx.db
      .query("wearableSamples")
      .withIndex("by_user_day_metric", (q) =>
        q.eq("userId", userId).eq("day", day)
      )
      .first();
    return row != null;
  },
});

/**
 * Re-run daily rollup for every day in [from, to] that has raw samples.
 * Used by the developer backfill so scores see rolled-up wearableDailyMetrics.
 */
export const rollupSampleDaysInRange = internalAction({
  args: {
    userId: v.string(),
    from: v.string(),
    to: v.string(),
  },
  handler: async (ctx, { userId, from, to }) => {
    const daysRolledUp: string[] = [];
    const start = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      return { daysRolledUp: 0, days: [] as string[] };
    }
    for (
      let t = start.getTime();
      t <= end.getTime();
      t += 86400_000
    ) {
      const day = new Date(t).toISOString().slice(0, 10);
      const has = await ctx.runQuery(internal.wearables.dayHasSamplesInternal, {
        userId,
        day,
      });
      if (!has) continue;
      await ctx.runAction(internal.wearables.rollupDay, { userId, day });
      daysRolledUp.push(day);
    }
    return { daysRolledUp: daysRolledUp.length, days: daysRolledUp };
  },
});

// ─── Daily rollup (Phase 1: simple, Phase 2 adds source prio) ───────────────

/**
 * Canonical metric types that semantically belong to the day the user wakes
 * up (i.e. the END of the cycle), not the day the cycle starts. Whoop and
 * Oura emit sleep events that span midnight; without this rule, "last
 * night's sleep" would never appear on today's dashboard.
 */
const SLEEP_END_DAY_METRICS = new Set<string>([
  "sleep_stage",
  "sleep_performance",
  "sleep_efficiency",
  "sleep_consistency",
  "respiratory_rate",
  // Whoop physiological cycles span sleep-onset to sleep-onset. The cycle
  // "represents" the calendar day the user was awake — that aligns with
  // the END of the cycle (or "today" for the still-open cycle).
  "total_calories",
  "strain",
]);

const ROLLUP_METRICS = [
  "heart_rate",
  "resting_heart_rate",
  "hrv_sdnn",
  "steps",
  "active_calories",
  "basal_calories",
  "distance_m",
  "oxygen_saturation",
  "respiratory_rate",
  "sleep_stage",
  "vo2_max",
  "skin_temperature",
  "sleep_performance",
  "sleep_efficiency",
  "sleep_consistency",
  "total_calories",
  "strain",
];

/**
 * Pure source-priority rule. Higher = preferred.
 *
 * Policy: dedicated wearables (Whoop, Oura, Fitbit, Garmin) ALWAYS outrank
 * phone-based OS aggregators (Apple Health, Health Connect) for any metric
 * they both emit — the wearable is on-body 24/7 and uses validated sensors,
 * whereas the OS aggregator may itself be sourced from the same wearable
 * with extra latency / lossy rounding. OS aggregators only "win" by virtue
 * of being the sole provider for a given metric (e.g. steps from the phone,
 * VO2 max from Apple Watch) — in that case the canonical picker iterates
 * candidate sources and the OS row is the only candidate.
 *
 * For sleep-architecture metrics Oura's ring is the gold standard, so it
 * edges Whoop slightly.
 */
function sourcePriority(source: string, metricType: string): number {
  const isSleepMetric =
    metricType === "sleep_stage" ||
    metricType === "sleep_performance" ||
    metricType === "sleep_efficiency" ||
    metricType === "sleep_consistency" ||
    metricType === "respiratory_rate";

  if (isSleepMetric) {
    if (source === "oura") return 100;
    if (source === "whoop") return 95;
    if (source === "fitbit") return 90;
    if (source === "garmin") return 85;
    if (source === "apple_health") return 50;
    if (source === "health_connect") return 45;
    return 10;
  }

  // All other metrics: wearable beats OS, regardless of metric type.
  if (source === "whoop") return 100;
  if (source === "oura") return 95;
  if (source === "fitbit") return 90;
  if (source === "garmin") return 85;
  if (source === "apple_health") return 50;
  if (source === "health_connect") return 45;
  return 10;
}

function pickCanonicalSamples<T extends { source: string }>(
  samples: T[],
  metricType: string
): { chosenSource: string | null; chosen: T[]; candidateSources: string[] } {
  if (samples.length === 0) {
    return { chosenSource: null, chosen: [], candidateSources: [] };
  }
  const bySource = new Map<string, T[]>();
  for (const s of samples) {
    const arr = bySource.get(s.source) ?? [];
    arr.push(s);
    bySource.set(s.source, arr);
  }
  const candidateSources = [...bySource.keys()];
  const sortedSources = candidateSources.sort(
    (a, b) => sourcePriority(b, metricType) - sourcePriority(a, metricType)
  );
  const chosenSource = sortedSources[0]!;
  return { chosenSource, chosen: bySource.get(chosenSource) ?? [], candidateSources };
}

export const rollupDay = internalAction({
  args: { userId: v.string(), day: v.string() },
  handler: async (ctx, { userId, day }) => {
    const result: Record<string, number | undefined> = {};
    const metricSources: Record<string, string> = {};

    for (const metric of ROLLUP_METRICS) {
      const samples: Array<Doc<"wearableSamples">> = await ctx.runQuery(
        internal.wearables.getSamplesForDayInternal,
        { userId, day, metricType: metric }
      );
      if (samples.length === 0) continue;

      const { chosenSource, chosen } = pickCanonicalSamples(samples, metric);
      if (!chosenSource) continue;
      metricSources[metric] = chosenSource;

      switch (metric) {
        case "steps":
        case "active_calories":
        case "basal_calories":
        case "distance_m":
          result[mapToDailyField(metric)] = sumValues(chosen);
          break;
        case "heart_rate": {
          const vals = chosen.map((s) => s.value).filter((v) => v > 0);
          if (vals.length > 0) {
            result.hrAvgBpm = avg(vals);
            result.hrMinBpm = Math.min(...vals);
            result.hrMaxBpm = Math.max(...vals);
          }
          break;
        }
        case "resting_heart_rate":
          result.restingHrBpm = avg(chosen.map((s) => s.value));
          break;
        case "hrv_sdnn":
          result.hrvAvgMs = avg(chosen.map((s) => s.value));
          break;
        case "oxygen_saturation":
          result.spo2AvgPct = avg(chosen.map((s) => s.value));
          break;
        case "respiratory_rate":
          result.respiratoryRateAvg = avg(chosen.map((s) => s.value));
          break;
        case "vo2_max":
          result.vo2Max = avg(chosen.map((s) => s.value));
          break;
        case "skin_temperature":
          result.skinTempCelsius = avg(chosen.map((s) => s.value));
          break;
        case "sleep_performance":
          result.sleepPerformancePct = avg(chosen.map((s) => s.value));
          break;
        case "sleep_efficiency":
          result.sleepEfficiencyPct = avg(chosen.map((s) => s.value));
          break;
        case "sleep_consistency":
          result.sleepConsistencyPct = avg(chosen.map((s) => s.value));
          break;
        case "total_calories": {
          // Daily totals: take the maximum value seen for the day (cycles
          // grow monotonically; if Whoop sends multiple cycle rows that
          // overlap with the day, the largest is the truest snapshot).
          const vals = chosen.map((s) => s.value).filter((v) => v > 0);
          if (vals.length > 0) result.totalKcal = Math.max(...vals);
          break;
        }
        case "strain": {
          // Same monotonic-growth logic for Whoop strain (0–21).
          const vals = chosen.map((s) => s.value).filter((v) => v >= 0);
          if (vals.length > 0) result.strainScore = Math.max(...vals);
          break;
        }
        case "sleep_stage": {
          const totals = sleepStageTotals(chosen);
          result.sleepMinutes = totals.total;
          result.sleepDeepMinutes = totals.deep;
          result.sleepRemMinutes = totals.rem;
          result.sleepLightMinutes = totals.light;
          result.sleepAwakeMinutes = totals.awake;
          break;
        }
      }
    }

    const workouts: Array<Doc<"wearableWorkouts">> = await ctx.runQuery(
      internal.wearables.getWorkoutsForDayInternal,
      { userId, day }
    );
    if (workouts.length > 0) {
      result.workoutCount = workouts.length;
      result.workoutKcal = workouts.reduce((s, w) => s + (w.activeKcal ?? 0), 0);
    }

    await ctx.runMutation(internal.wearables.writeDailyMetricsInternal, {
      userId,
      day,
      metrics: result,
      metricSources,
    });

    // Persist source choice rows for transparency / debugging.
    await ctx.runMutation(internal.wearables.writeSourceDevicesInternal, {
      userId,
      day,
      metricSources,
    });

    // Trigger downstream analytics recompute if available (Phase 4).
    try {
      await ctx.scheduler.runAfter(0, internal.analytics.recomputeAnalyticsForDay, {
        userId,
        day,
      });
    } catch {
      // analytics module may not exist yet during incremental rollouts
    }
  },
});

// Helper: standard JS aggregation pieces (exported for tests).
export function sumValues<T extends { value: number }>(rows: T[]): number {
  return rows.reduce((s, r) => s + r.value, 0);
}

export function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Sum minutes per stage from start/end intervals (or value=minutes when source emits scalar).
 * If `endTime > startTime`, derive minutes from the interval; otherwise use `value` as minutes.
 */
export function sleepStageTotals(
  samples: Array<{ startTime: string; endTime: string; stage?: string; value: number; unit?: string }>
) {
  let deep = 0;
  let rem = 0;
  let light = 0;
  let awake = 0;
  for (const s of samples) {
    // Aggregator sources (Whoop/Oura) emit one sample per stage where
    // `value` already contains the stage minutes for the night and
    // `start/end` span the ENTIRE sleep — using the interval here would
    // attribute the whole night to every stage. So prefer `value` when it
    // already encodes minutes; only fall back to the interval for raw
    // per-stage events emitted by Apple Health / Health Connect.
    const valueIsMinutes =
      typeof s.value === "number" &&
      s.value > 0 &&
      (s.unit === "min" || s.unit === undefined);
    let minutes = valueIsMinutes ? s.value : 0;
    if (minutes <= 0) {
      const startMs = Date.parse(s.startTime);
      const endMs = Date.parse(s.endTime);
      if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
        minutes = (endMs - startMs) / 60000;
      }
    }
    switch ((s.stage ?? "").toLowerCase()) {
      case "deep":
        deep += minutes;
        break;
      case "rem":
        rem += minutes;
        break;
      case "light":
        light += minutes;
        break;
      case "awake":
        awake += minutes;
        break;
    }
  }
  return {
    deep: Math.round(deep),
    rem: Math.round(rem),
    light: Math.round(light),
    awake: Math.round(awake),
    total: Math.round(deep + rem + light),
  };
}

function mapToDailyField(metric: string): string {
  switch (metric) {
    case "steps":
      return "steps";
    case "active_calories":
      return "activeKcal";
    case "basal_calories":
      return "basalKcal";
    case "distance_m":
      return "distanceM";
    default:
      return metric;
  }
}

// ─── Internal mutations used by rollup ───────────────────────────────────────

export const writeDailyMetricsInternal = internalMutation({
  args: {
    userId: v.string(),
    day: v.string(),
    metrics: v.any(),
    metricSources: v.any(),
  },
  handler: async (ctx, { userId, day, metrics, metricSources }) => {
    const existing = await ctx.db
      .query("wearableDailyMetrics")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
      .unique();
    const data = {
      userId,
      day,
      ...metrics,
      metricSources,
      lastUpdatedAt: new Date().toISOString(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }
    return await ctx.db.insert("wearableDailyMetrics", data);
  },
});

export const writeSourceDevicesInternal = internalMutation({
  args: {
    userId: v.string(),
    day: v.string(),
    metricSources: v.any(),
  },
  handler: async (ctx, { userId, day, metricSources }) => {
    for (const [metricType, chosenSource] of Object.entries(metricSources as Record<string, string>)) {
      const existing = await ctx.db
        .query("wearableSourceDevices")
        .withIndex("by_user_day_metric", (q) =>
          q.eq("userId", userId).eq("day", day).eq("metricType", metricType)
        )
        .unique();
      const data = {
        userId,
        day,
        metricType,
        chosenSource,
        updatedAt: new Date().toISOString(),
      };
      if (existing) {
        await ctx.db.patch(existing._id, data);
      } else {
        await ctx.db.insert("wearableSourceDevices", data);
      }
    }
  },
});

// ─── Shared ingestion helpers (mutation context) ─────────────────────────────

type SampleInput = {
  source: string;
  sampleId: string;
  metricType: string;
  startTime: string;
  endTime: string;
  value: number;
  unit: string;
  stage?: string;
  sourceDevice?: string;
  sourceApp?: string;
};

type WorkoutInput = {
  source: string;
  sourceWorkoutId: string;
  activityType: string;
  startTime: string;
  endTime: string;
  durationSec: number;
  activeKcal?: number;
  distanceM?: number;
  hrAvgBpm?: number;
  hrMaxBpm?: number;
  sourceDevice?: string;
};

async function ingestSamplesInternal(
  ctx: { db: any; scheduler: any },
  userId: string,
  samples: SampleInput[]
): Promise<{ inserted: number; skipped: number }> {
  const now = new Date().toISOString();
  let inserted = 0;
  let skipped = 0;
  const touchedDays = new Set<string>();

  for (const s of samples) {
    const day = SLEEP_END_DAY_METRICS.has(s.metricType)
      ? isoDay(s.endTime ?? s.startTime)
      : isoDay(s.startTime);
    touchedDays.add(day);

    const existing = await ctx.db
      .query("wearableSamples")
      .withIndex("by_user_source_sample", (q: any) =>
        q.eq("userId", userId).eq("source", s.source).eq("sampleId", s.sampleId)
      )
      .unique();
    if (existing) {
      skipped += 1;
      continue;
    }
    await ctx.db.insert("wearableSamples", {
      userId,
      source: s.source,
      sampleId: s.sampleId,
      metricType: s.metricType,
      startTime: s.startTime,
      endTime: s.endTime,
      day,
      value: s.value,
      unit: s.unit,
      stage: s.stage,
      sourceDevice: s.sourceDevice,
      sourceApp: s.sourceApp,
      syncedAt: now,
    });
    inserted += 1;
  }

  // Roll up every day touched by this batch — including days where all
  // samples were deduped. A reconnect often re-ingests zero new rows but
  // daily metrics were never rolled up from the first (failed) exchange.
  for (const day of touchedDays) {
    await ctx.scheduler.runAfter(0, internal.wearables.rollupDay, { userId, day });
  }
  return { inserted, skipped };
}

async function ingestWorkoutsInternal(
  ctx: { db: any; scheduler: any },
  userId: string,
  workouts: WorkoutInput[]
): Promise<{ inserted: number; skipped: number }> {
  const now = new Date().toISOString();
  let inserted = 0;
  let skipped = 0;
  const enrichedDays = new Set<string>();

  for (const w of workouts) {
    const existing = await ctx.db
      .query("wearableWorkouts")
      .withIndex("by_user_source_workout", (q: any) =>
        q.eq("userId", userId).eq("source", w.source).eq("sourceWorkoutId", w.sourceWorkoutId)
      )
      .unique();
    if (existing) {
      skipped += 1;
      continue;
    }
    const day = isoDay(w.startTime);
    await ctx.db.insert("wearableWorkouts", {
      userId,
      source: w.source,
      sourceWorkoutId: w.sourceWorkoutId,
      activityType: w.activityType,
      startTime: w.startTime,
      endTime: w.endTime,
      day,
      durationSec: w.durationSec,
      activeKcal: w.activeKcal,
      distanceM: w.distanceM,
      hrAvgBpm: w.hrAvgBpm,
      hrMaxBpm: w.hrMaxBpm,
      sourceDevice: w.sourceDevice,
      syncedAt: now,
    });
    inserted += 1;
    enrichedDays.add(day);
    // Auto-complete any habit whose linkingRule matches this activity.
    await ctx.scheduler.runAfter(0, internal.habits.autoCompleteFromWorkoutInternal, {
      userId,
      day,
      activityType: w.activityType,
    });
  }

  for (const day of enrichedDays) {
    await ctx.scheduler.runAfter(0, internal.wearables.rollupDay, { userId, day });
  }
  return { inserted, skipped };
}

async function upsertSyncStateInternal(
  ctx: { db: any },
  args: {
    userId: string;
    source: string;
    metricType: string;
    lastSyncedEnd: string;
    isFullSync: boolean;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await ctx.db
    .query("wearableSyncState")
    .withIndex("by_user_source_metric", (q: any) =>
      q
        .eq("userId", args.userId)
        .eq("source", args.source)
        .eq("metricType", args.metricType)
    )
    .unique();
  const data = {
    userId: args.userId,
    source: args.source,
    metricType: args.metricType,
    lastSyncedEnd: args.lastSyncedEnd,
    lastFullSyncAt: args.isFullSync ? now : existing?.lastFullSyncAt,
    updatedAt: now,
  };
  if (existing) {
    await ctx.db.patch(existing._id, data);
  } else {
    await ctx.db.insert("wearableSyncState", data);
  }
}

// ─── One-shot backfill for the sleep day-attribution + stage totals fix ─────

/**
 * Repairs sleep-related samples that were stored with the wrong `day` value
 * (start-of-cycle instead of wake-day) and re-runs the daily rollup for every
 * affected day. Safe to run multiple times — it is a no-op when the day field
 * already matches the wake-day rule.
 *
 * Invoke from CLI:
 *   npx convex run wearables:backfillSleepAttribution '{}'
 */
export const backfillSleepAttribution = internalAction({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, { userId }): Promise<{
    rewrittenSamples: number;
    daysRecomputed: number;
  }> => {
    const result: { rewrittenSamples: number; daysRecomputed: number } =
      await ctx.runMutation(
        internal.wearables.backfillSleepAttributionMutation,
        { userId }
      );
    return result;
  },
});

export const backfillSleepAttributionMutation = internalMutation({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, { userId }) => {
    const affected = new Set<string>();
    let rewrittenSamples = 0;
    const sleepMetrics = Array.from(SLEEP_END_DAY_METRICS);

    const allRows: Array<Doc<"wearableSamples">> = await ctx.db
      .query("wearableSamples")
      .collect();
    const sampleRows = allRows.filter((r) => {
      if (!SLEEP_END_DAY_METRICS.has(r.metricType)) return false;
      if (userId && r.userId !== userId) return false;
      return true;
    });
    void sleepMetrics; // kept for documentation / future per-metric stats

    for (const s of sampleRows) {
      const correctDay = isoDay(s.endTime ?? s.startTime);
      affected.add(`${s.userId}|${s.day}`);
      affected.add(`${s.userId}|${correctDay}`);
      if (s.day !== correctDay) {
        await ctx.db.patch(s._id, { day: correctDay });
        rewrittenSamples += 1;
      }
    }

    // Schedule a rollup for every (user, day) pair we touched.
    for (const key of affected) {
      const idx = key.indexOf("|");
      const uid = key.slice(0, idx);
      const day = key.slice(idx + 1);
      await ctx.scheduler.runAfter(0, internal.wearables.rollupDay, {
        userId: uid,
        day,
      });
    }

    return { rewrittenSamples, daysRecomputed: affected.size };
  },
});
