/**
 * Sleep Deep-Dive API.
 *
 * Public surface for the mobile `/sleep` screen and its sub-routes. This
 * module is the SINGLE place the mobile app talks to for sleep — it pulls
 * from `wearableDailyMetrics` + `wearableSamples` + the new
 * `sleepNightTags` + `sleepManualSessions` tables and shapes the responses
 * around the UI sections in docs/execution/06-phase6-post-mvp-roadmap.md.
 *
 * Pure scoring logic lives in `scoring/sleepFitness.ts` and
 * `scoring/chronotype.ts` — keep this file thin.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "./_helpers";
import {
  computeSleepFitnessScore,
  targetSleepMinutesForAge,
  type SleepFitnessResult,
} from "./scoring/sleepFitness";
import type { QueryCtx } from "./_generated/server";
import {
  computeChronotype,
  midpointHourOf,
  type ChronotypeNight,
} from "./scoring/chronotype";

// ─── Tag catalogue ───────────────────────────────────────────────────────────
//
// Append-only. Renaming an id orphans existing `sleepNightTags.tags` entries
// (which are stored as plain strings to keep the schema future-proof). The
// mobile app maps each id to label + icon — see
// apps/mobile/src/components/sleep/NightTagsRow.tsx.

export const SLEEP_TAG_CATALOG = [
  "coffee",
  "alcohol",
  "late_meal",
  "stress",
  "exercise",
  "travel",
  "late_screen",
  "medication",
  "sick",
  "argument",
  "cold_room",
] as const;

export type SleepTagId = (typeof SLEEP_TAG_CATALOG)[number];

const SLEEP_TAG_SET = new Set<string>(SLEEP_TAG_CATALOG);

/**
 * Resolve the user's optimal sleep target (minutes) from their profile.
 * Defaults to 480min (8h, adult) when the profile is missing or has no
 * date of birth — that's the median target across NSF age bands and
 * matches what the home hero shows when the profile hasn't loaded.
 */
async function getUserSleepTargetMinutes(
  ctx: QueryCtx,
  userId: string
): Promise<number> {
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", userId))
    .unique();
  const dob = profile?.dateOfBirth;
  if (!dob) return 480;
  const ms = Date.parse(dob);
  if (!Number.isFinite(ms)) return 480;
  const ageYears = (Date.now() - ms) / (365.25 * 24 * 60 * 60 * 1000);
  return targetSleepMinutesForAge(ageYears);
}

function sanitizeTags(tags: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tags) {
    if (!SLEEP_TAG_SET.has(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBack(n: number): { from: string; to: string } {
  const today = new Date();
  const to = isoDay(today);
  const from = isoDay(new Date(today.getTime() - n * DAY_MS));
  return { from, to };
}

/**
 * Group sleep_stage rows by their nightly window (`startTime + endTime`).
 * Wearable normalizers emit one stage row per stage per night sharing the
 * same start/end, so the pair is a stable session key. Apple/HC fragments
 * are segment-level — they share `day` and within-night times.
 */
function groupStagesByNight(
  rows: Array<{
    startTime: string;
    endTime: string;
    stage?: string;
    value: number;
    source: string;
  }>
): Array<{
  start: string;
  end: string;
  source: string;
  segments: Array<{ stage: string; start: string; end: string; minutes: number }>;
}> {
  type Bucket = {
    start: string;
    end: string;
    source: string;
    segments: Array<{ stage: string; start: string; end: string; minutes: number }>;
  };
  const buckets = new Map<string, Bucket>();
  for (const r of rows) {
    if (!r.stage) continue;
    const key = `${r.startTime}__${r.endTime}`;
    let b = buckets.get(key);
    if (!b) {
      b = { start: r.startTime, end: r.endTime, source: r.source, segments: [] };
      buckets.set(key, b);
    }
    b.segments.push({
      stage: r.stage,
      start: r.startTime,
      end: r.endTime,
      minutes: r.value,
    });
  }
  return [...buckets.values()];
}

interface NightSummary {
  start: string;
  end: string;
  source: string;
  /** Total minutes asleep (deep + rem + light). */
  asleepMinutes: number;
  deepMinutes: number;
  remMinutes: number;
  lightMinutes: number;
  awakeMinutes: number;
  segments: Array<{ stage: string; start: string; end: string; minutes: number }>;
  /** Number of stage transitions (used as a fragmentation proxy). */
  transitions: number;
}

function summariseNight(
  group: ReturnType<typeof groupStagesByNight>[number]
): NightSummary {
  let deep = 0;
  let rem = 0;
  let light = 0;
  let awake = 0;
  for (const seg of group.segments) {
    switch (seg.stage) {
      case "deep":
        deep += seg.minutes;
        break;
      case "rem":
        rem += seg.minutes;
        break;
      case "light":
        light += seg.minutes;
        break;
      case "awake":
        awake += seg.minutes;
        break;
    }
  }
  // Transitions are derived only if we have multiple distinct segment rows
  // (Apple Health / Health Connect supply per-segment rows; Whoop/Oura supply
  // aggregated per-stage minutes so transitions stay at 0 and the awake-
  // fallback in `computeSleepFitnessScore` kicks in).
  let transitions = 0;
  if (group.segments.length > 1) {
    const sortedSegments = group.segments
      .slice()
      .sort((a, b) => a.start.localeCompare(b.start));
    let prev: string | null = null;
    for (const s of sortedSegments) {
      if (prev !== null && prev !== s.stage) transitions++;
      prev = s.stage;
    }
  }
  return {
    start: group.start,
    end: group.end,
    source: group.source,
    asleepMinutes: Math.round(deep + rem + light),
    deepMinutes: Math.round(deep),
    remMinutes: Math.round(rem),
    lightMinutes: Math.round(light),
    awakeMinutes: Math.round(awake),
    segments: group.segments,
    transitions,
  };
}

/** Returns the dominant primary-sleep night for the day (max asleepMinutes). */
function pickPrimary(nights: NightSummary[]): NightSummary | null {
  if (nights.length === 0) return null;
  return nights.reduce((best, n) =>
    n.asleepMinutes > best.asleepMinutes ? n : best
  );
}

/**
 * Heart-rate dip: percentage drop from the day's average HR to the lowest
 * HR during sleep. Returns null when either input is missing or the values
 * are inconsistent (sleep low ≥ day average → no dip to report).
 */
function computeHrDip(
  dayAvgBpm: number | null,
  sleepLowBpm: number | null
): number | null {
  if (
    dayAvgBpm === null ||
    sleepLowBpm === null ||
    !Number.isFinite(dayAvgBpm) ||
    !Number.isFinite(sleepLowBpm) ||
    dayAvgBpm <= 0 ||
    sleepLowBpm > dayAvgBpm
  ) {
    return null;
  }
  return ((dayAvgBpm - sleepLowBpm) / dayAvgBpm) * 100;
}

/**
 * Resolve the Elysia Sleep Fitness Score for ONE wake-day, using the EXACT
 * same inputs as `getSleepNight` (rollup totals with a stage-row fallback,
 * plus stage transitions from the primary night). Shared so the dashboard
 * ring and the /sleep hero never drift apart.
 */
async function resolveNightFitness(
  ctx: QueryCtx,
  userId: Awaited<ReturnType<typeof getAuthUserId>>,
  day: string,
  targetSleepMinutes: number
): Promise<SleepFitnessResult | null> {
  const dailyRow =
    (await ctx.db
      .query("wearableDailyMetrics")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
      .first()) ?? null;

  const stageRows = await ctx.db
    .query("wearableSamples")
    .withIndex("by_user_day_metric", (q) =>
      q.eq("userId", userId).eq("day", day).eq("metricType", "sleep_stage")
    )
    .collect();
  const primary = pickPrimary(groupStagesByNight(stageRows).map(summariseNight));

  return computeSleepFitnessScore({
    sleepMinutes: dailyRow?.sleepMinutes ?? primary?.asleepMinutes ?? undefined,
    sleepDeepMinutes: dailyRow?.sleepDeepMinutes ?? primary?.deepMinutes ?? undefined,
    sleepRemMinutes: dailyRow?.sleepRemMinutes ?? primary?.remMinutes ?? undefined,
    sleepLightMinutes: dailyRow?.sleepLightMinutes ?? primary?.lightMinutes ?? undefined,
    sleepAwakeMinutes: dailyRow?.sleepAwakeMinutes ?? primary?.awakeMinutes ?? undefined,
    sleepEfficiencyPct: dailyRow?.sleepEfficiencyPct ?? undefined,
    sleepConsistencyPct: dailyRow?.sleepConsistencyPct ?? undefined,
    stageTransitions: primary?.transitions ?? undefined,
    targetSleepMinutes,
  });
}

// ─── Public queries ──────────────────────────────────────────────────────────

/**
 * Sleep Fitness Score for every day in [from, to]. Used by the week-dots
 * bar and the score-trend route. Missing days are NOT padded — caller is
 * expected to merge by `day` for the calendar render.
 */
export const getSleepFitnessRange = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const userId = await getAuthUserId(ctx);
    const targetSleepMinutes = await getUserSleepTargetMinutes(ctx, userId);
    const rows = await ctx.db
      .query("wearableDailyMetrics")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", from).lte("day", to)
      )
      .collect();

    return rows
      .map((r) => {
        const fitness = computeSleepFitnessScore({
          sleepMinutes: r.sleepMinutes ?? undefined,
          sleepDeepMinutes: r.sleepDeepMinutes ?? undefined,
          sleepRemMinutes: r.sleepRemMinutes ?? undefined,
          sleepLightMinutes: r.sleepLightMinutes ?? undefined,
          sleepAwakeMinutes: r.sleepAwakeMinutes ?? undefined,
          sleepEfficiencyPct: r.sleepEfficiencyPct ?? undefined,
          sleepConsistencyPct: r.sleepConsistencyPct ?? undefined,
          targetSleepMinutes,
        });
        return { day: r.day, fitness };
      })
      .filter((row): row is { day: string; fitness: SleepFitnessResult } => row.fitness !== null)
      .sort((a, b) => a.day.localeCompare(b.day));
  },
});

/**
 * Most recent day (≤ today) that actually has a sleep recording. Drives
 * the default selected day on the /sleep screen so that at e.g. 2 a.m. —
 * before the upcoming night is recorded — we still surface LAST night's
 * sleep instead of an empty "today". Returns today as a safe fallback
 * when the user has no sleep history at all.
 */
export const getLatestSleepDay = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const today = isoDay(new Date());

    // Newest-first scan of daily rollups for the last night with sleep.
    const rollups = await ctx.db
      .query("wearableDailyMetrics")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).lte("day", today)
      )
      .order("desc")
      .take(60);
    for (const r of rollups) {
      if ((r.sleepMinutes ?? 0) > 0) return r.day;
    }

    // Fall back to raw stage samples when the rollup hasn't run yet.
    const samples = await ctx.db
      .query("wearableSamples")
      .withIndex("by_user_day_metric", (q) => q.eq("userId", userId))
      .order("desc")
      .take(120);
    for (const s of samples) {
      if (s.metricType === "sleep_stage" && s.day <= today) return s.day;
    }

    return today;
  },
});

/**
 * Elysia Sleep Score of the most recent recorded night, for the Home
 * dashboard's sleep ring. Keeps the ring in lock-step with the /sleep
 * deep-dive hero (same SleepFitnessScore) and the same "last recorded
 * night" fallback as getLatestSleepDay. Returns null when there is no
 * sleep history at all.
 */
export const getLatestSleepScore = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const today = isoDay(new Date());
    const targetSleepMinutes = await getUserSleepTargetMinutes(ctx, userId);

    const rollups = await ctx.db
      .query("wearableDailyMetrics")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).lte("day", today)
      )
      .order("desc")
      .take(60);

    for (const r of rollups) {
      if ((r.sleepMinutes ?? 0) <= 0) continue;
      // Use the SAME resolver as the /sleep hero so the values stay in sync.
      const fitness = await resolveNightFitness(
        ctx,
        userId,
        r.day,
        targetSleepMinutes
      );
      if (fitness) return { day: r.day, score: fitness.score };
    }
    return null;
  },
});

/**
 * Everything the `/sleep` screen needs for ONE selected day:
 *   - dailyMetrics row (or null)
 *   - stage segments + tile totals
 *   - manual sessions for that wake-day
 *   - night tags
 *   - SleepFitnessResult
 *   - flat `metrics` map ready to feed `SleepMetricsGrid` (each value
 *     `null` when the underlying provider did not supply it)
 *
 * `day` follows the wake-day attribution rule (same as sleep_stage rows).
 */
export const getSleepNight = query({
  args: { day: v.string() },
  handler: async (ctx, { day }) => {
    const userId = await getAuthUserId(ctx);

    const dailyRow =
      (await ctx.db
        .query("wearableDailyMetrics")
        .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
        .first()) ?? null;

    // Pull stage rows for the day (wake-day attribution → all rows belong
    // to nights ending on `day`).
    const stageRows = await ctx.db
      .query("wearableSamples")
      .withIndex("by_user_day_metric", (q) =>
        q.eq("userId", userId).eq("day", day).eq("metricType", "sleep_stage")
      )
      .collect();

    const grouped = groupStagesByNight(stageRows);
    const nights = grouped.map(summariseNight);
    const primary = pickPrimary(nights);

    const tagRow =
      (await ctx.db
        .query("sleepNightTags")
        .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
        .first()) ?? null;

    const manualSessions = await ctx.db
      .query("sleepManualSessions")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
      .collect();

    // Resolve sleep totals: daily-rollup row beats stage-row totals (the
    // rollup already merged across sources via priority). Fall back to
    // primary-night stage totals when the rollup hasn't run yet.
    const totals = {
      asleepMinutes:
        dailyRow?.sleepMinutes ?? primary?.asleepMinutes ?? null,
      deepMinutes: dailyRow?.sleepDeepMinutes ?? primary?.deepMinutes ?? null,
      remMinutes: dailyRow?.sleepRemMinutes ?? primary?.remMinutes ?? null,
      lightMinutes:
        dailyRow?.sleepLightMinutes ?? primary?.lightMinutes ?? null,
      awakeMinutes:
        dailyRow?.sleepAwakeMinutes ?? primary?.awakeMinutes ?? null,
    };

    const targetSleepMinutes = await getUserSleepTargetMinutes(ctx, userId);
    const fitness = computeSleepFitnessScore({
      sleepMinutes: totals.asleepMinutes ?? undefined,
      sleepDeepMinutes: totals.deepMinutes ?? undefined,
      sleepRemMinutes: totals.remMinutes ?? undefined,
      sleepLightMinutes: totals.lightMinutes ?? undefined,
      sleepAwakeMinutes: totals.awakeMinutes ?? undefined,
      sleepEfficiencyPct: dailyRow?.sleepEfficiencyPct ?? undefined,
      sleepConsistencyPct: dailyRow?.sleepConsistencyPct ?? undefined,
      stageTransitions: primary?.transitions ?? undefined,
      targetSleepMinutes,
    });

    // Sleep-debt: target 8h × 7 days minus the last 7 days of actual sleep,
    // in minutes (clamped to non-negative). Cheap enough to compute on the
    // fly per request — the row count is bounded at 7.
    const sevenDaysAgo = isoDay(new Date(Date.parse(`${day}T00:00:00Z`) - 6 * DAY_MS));
    const sevenDayRows = await ctx.db
      .query("wearableDailyMetrics")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", sevenDaysAgo).lte("day", day)
      )
      .collect();
    const sumMinutes7d = sevenDayRows.reduce(
      (s, r) => s + (r.sleepMinutes ?? 0),
      0
    );
    const targetMinutes = 8 * 60 * 7;
    const debtMinutes = Math.max(0, targetMinutes - sumMinutes7d);

    // Restorative sleep = REM + Deep (the physically/mentally recovering
    // stages). null only when neither stage has any signal.
    const restorativeMinutes =
      totals.remMinutes === null && totals.deepMinutes === null
        ? null
        : (totals.remMinutes ?? 0) + (totals.deepMinutes ?? 0);

    // Heart-rate dip = % drop from the day's average HR to the lowest HR
    // reached during sleep. Whoop's resting HR ≈ the sleeping trough; we
    // prefer the daily min when present. A bigger dip = stronger nocturnal
    // parasympathetic recovery. null when the inputs aren't available.
    const hrDip = computeHrDip(
      dailyRow?.hrAvgBpm ?? null,
      dailyRow?.hrMinBpm ?? dailyRow?.restingHrBpm ?? null
    );

    // Last-night sleep deficit = the per-night shortfall against the
    // age-based target (clamped ≥0). This is what the Sleep-specific tile
    // shows; the deep-dive view aggregates it across the last 7 days.
    const nightDeficitMinutes =
      totals.asleepMinutes === null
        ? null
        : Math.max(0, targetSleepMinutes - totals.asleepMinutes);

    return {
      day,
      dailyMetrics: dailyRow,
      stages: {
        deepMinutes: totals.deepMinutes,
        remMinutes: totals.remMinutes,
        lightMinutes: totals.lightMinutes,
        awakeMinutes: totals.awakeMinutes,
        primary: primary
          ? {
              start: primary.start,
              end: primary.end,
              source: primary.source,
              transitions: primary.transitions,
            }
          : null,
        segments:
          primary?.segments.map((s) => ({
            stage: s.stage,
            start: s.start,
            end: s.end,
            minutes: s.minutes,
          })) ?? [],
      },
      manualSessions: manualSessions.map((m) => ({
        sessionId: m.sessionId,
        startTime: m.startTime,
        endTime: m.endTime,
        kind: m.kind,
        note: m.note ?? null,
      })),
      tags: tagRow?.tags ?? [],
      fitness,
      metrics: {
        timeToFallAsleep: null, // not exposed by Whoop API — waits for smart band
        hr: dailyRow?.restingHrBpm ?? null,
        hrv: dailyRow?.hrvAvgMs ?? null,
        rr: dailyRow?.respiratoryRateAvg ?? null,
        spo2: dailyRow?.spo2AvgPct ?? null,
        efficiency: dailyRow?.sleepEfficiencyPct ?? null,
        consistency: dailyRow?.sleepConsistencyPct ?? null,
        performance: dailyRow?.sleepPerformancePct ?? null,
        // Stress proxy = quality sub-component (lower → more fragmented).
        // null when no signal is available.
        stress: fitness?.qualityParts.stress ?? null,
        debtMinutes,
        nightDeficitMinutes,
        restorativeMinutes,
        hrDip,
      },
    };
  },
});

/**
 * Time-series for the metric-detail screen. Returns one row per day in
 * [from, to] for the named metric. `value` is `null` when the day had no
 * data. `score` is the Sleep Fitness Score (re-computed on demand).
 */
export const getSleepMetricSeries = query({
  args: { metric: v.string(), from: v.string(), to: v.string() },
  handler: async (ctx, { metric, from, to }) => {
    const userId = await getAuthUserId(ctx);
    const targetSleepMinutes = await getUserSleepTargetMinutes(ctx, userId);
    const rows = await ctx.db
      .query("wearableDailyMetrics")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", from).lte("day", to)
      )
      .collect();
    const sorted = rows.sort((a, b) => a.day.localeCompare(b.day));

    return sorted.map((r) => {
      let value: number | null = null;
      switch (metric) {
        case "score": {
          const f = computeSleepFitnessScore({
            sleepMinutes: r.sleepMinutes ?? undefined,
            sleepDeepMinutes: r.sleepDeepMinutes ?? undefined,
            sleepRemMinutes: r.sleepRemMinutes ?? undefined,
            sleepLightMinutes: r.sleepLightMinutes ?? undefined,
            sleepAwakeMinutes: r.sleepAwakeMinutes ?? undefined,
            sleepEfficiencyPct: r.sleepEfficiencyPct ?? undefined,
            sleepConsistencyPct: r.sleepConsistencyPct ?? undefined,
            targetSleepMinutes,
          });
          value = f?.score ?? null;
          break;
        }
        case "timeAsleep":
          value = r.sleepMinutes ?? null;
          break;
        case "deep":
          value = r.sleepDeepMinutes ?? null;
          break;
        case "rem":
          value = r.sleepRemMinutes ?? null;
          break;
        case "light":
          value = r.sleepLightMinutes ?? null;
          break;
        case "awake":
          value = r.sleepAwakeMinutes ?? null;
          break;
        case "restorative":
          value =
            r.sleepRemMinutes === undefined && r.sleepDeepMinutes === undefined
              ? null
              : (r.sleepRemMinutes ?? 0) + (r.sleepDeepMinutes ?? 0);
          break;
        case "hrDip":
          value = computeHrDip(
            r.hrAvgBpm ?? null,
            r.hrMinBpm ?? r.restingHrBpm ?? null
          );
          break;
        case "debt":
          // Per-night deficit against the age-based target. The detail
          // view sums these across the window into a cumulative line.
          value =
            r.sleepMinutes === undefined || r.sleepMinutes === null
              ? null
              : Math.max(0, targetSleepMinutes - r.sleepMinutes);
          break;
        case "hr":
          value = r.restingHrBpm ?? null;
          break;
        case "hrv":
          value = r.hrvAvgMs ?? null;
          break;
        case "rr":
          value = r.respiratoryRateAvg ?? null;
          break;
        case "spo2":
          value = r.spo2AvgPct ?? null;
          break;
        case "efficiency":
          value = r.sleepEfficiencyPct ?? null;
          break;
        case "consistency":
          value = r.sleepConsistencyPct ?? null;
          break;
        case "performance":
          value = r.sleepPerformancePct ?? null;
          break;
        default:
          value = null;
      }
      return { day: r.day, value };
    });
  },
});

/**
 * Chronotype approximation from the last 30 nights of sleep_stage data.
 * See `computeChronotype` for the math + caveats. Returns the calibrating
 * empty-state when the user has fewer than 14 nights.
 */
export const getChronotype = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const { from, to } = daysBack(30);
    // We need ISO-time boundaries on the index `by_user_metric_time`.
    const rows = await ctx.db
      .query("wearableSamples")
      .withIndex("by_user_metric_time", (q) =>
        q
          .eq("userId", userId)
          .eq("metricType", "sleep_stage")
          .gte("startTime", `${from}T00:00:00.000Z`)
          .lte("startTime", `${to}T23:59:59.999Z`)
      )
      .take(2000);

    // Collapse stage rows to one entry per night.
    const seen = new Set<string>();
    const nights: ChronotypeNight[] = [];
    for (const r of rows) {
      const key = `${r.startTime}__${r.endTime}`;
      if (seen.has(key)) continue;
      seen.add(key);
      nights.push({ start: r.startTime, end: r.endTime });
    }

    return computeChronotype(nights);
  },
});

// ─── Public mutations ────────────────────────────────────────────────────────

export const setNightTags = mutation({
  args: { day: v.string(), tags: v.array(v.string()) },
  handler: async (ctx, { day, tags }) => {
    const userId = await getAuthUserId(ctx);
    const clean = sanitizeTags(tags);
    const now = new Date().toISOString();

    const existing = await ctx.db
      .query("sleepNightTags")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { tags: clean, updatedAt: now });
      return { tags: clean };
    }
    await ctx.db.insert("sleepNightTags", {
      userId,
      day,
      tags: clean,
      updatedAt: now,
    });
    return { tags: clean };
  },
});

export const addManualSleepSession = mutation({
  args: {
    startTime: v.string(),
    endTime: v.string(),
    kind: v.union(v.literal("primary"), v.literal("nap")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { startTime, endTime, kind, note }) => {
    const userId = await getAuthUserId(ctx);
    const startMs = Date.parse(startTime);
    const endMs = Date.parse(endTime);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      throw new Error("Invalid ISO start/end time");
    }
    if (endMs <= startMs) {
      throw new Error("endTime must be after startTime");
    }

    const sessionId = `manual_${userId.slice(-8)}_${startMs.toString(36)}_${endMs.toString(36)}`;
    const day = isoDay(new Date(endMs)); // wake-day attribution
    const now = new Date().toISOString();

    // Idempotency: same user + same window = one session.
    const existing = await ctx.db
      .query("sleepManualSessions")
      .withIndex("by_user_session", (q) =>
        q.eq("userId", userId).eq("sessionId", sessionId)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { kind, note });
      return { sessionId, day };
    }

    await ctx.db.insert("sleepManualSessions", {
      userId,
      sessionId,
      startTime,
      endTime,
      day,
      kind,
      note,
      createdAt: now,
    });
    return { sessionId, day };
  },
});

export const deleteManualSleepSession = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    const row = await ctx.db
      .query("sleepManualSessions")
      .withIndex("by_user_session", (q) =>
        q.eq("userId", userId).eq("sessionId", sessionId)
      )
      .first();
    if (row) await ctx.db.delete(row._id);
    return { ok: true };
  },
});

// ─── Exports for testing ─────────────────────────────────────────────────────

export const __internals = {
  groupStagesByNight,
  summariseNight,
  sanitizeTags,
  midpointHourOf,
};
