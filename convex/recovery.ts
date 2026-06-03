/**
 * Recovery Deep-Dive API.
 *
 * Public surface for the mobile `/recovery` screen and its sub-routes. Mirrors
 * `convex/sleep.ts`: pulls from `wearableDailyMetrics` (+ `userBaselines` for
 * the personal reference points) and shapes responses around the recovery UI
 * sections.
 *
 * Pure scoring logic lives in `scoring/recoveryFitness.ts` — keep this thin.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "./_helpers";
import type { QueryCtx } from "./_generated/server";
import {
  computeSleepFitnessScore,
  targetSleepMinutesForAge,
} from "./scoring/sleepFitness";
import {
  computeRecoveryFitnessScore,
  type RecoveryFitnessBaseline,
  type RecoveryFitnessResult,
} from "./scoring/recoveryFitness";
import {
  computeEnergyReserve,
  estimateDayBattery,
  morningEnergyFromSleep,
  workoutDrainPoints,
  type EnergyWorkout,
} from "./scoring/energyReserve";

const DAY_MS = 86_400_000;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

/** Age-based sleep target (minutes) for the recovery score's sleep part. */
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

/** Personal rolling-median baselines (HRV/RHR/Resp) or `{}` when calibrating. */
async function getBaseline(
  ctx: QueryCtx,
  userId: string
): Promise<RecoveryFitnessBaseline> {
  const row = await ctx.db
    .query("userBaselines")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  const m = (row?.metrics ?? {}) as Record<string, number | undefined>;
  return {
    hrvMedian: m.hrvMedian,
    rhrMedian: m.rhrMedian,
    respMedian: m.respMedian,
  };
}

type DailyRow = {
  day: string;
  restingHrBpm?: number;
  hrvAvgMs?: number;
  respiratoryRateAvg?: number;
  spo2AvgPct?: number;
  skinTempCelsius?: number;
  sleepMinutes?: number;
  sleepDeepMinutes?: number;
  sleepRemMinutes?: number;
  sleepLightMinutes?: number;
  sleepAwakeMinutes?: number;
  sleepEfficiencyPct?: number;
  sleepConsistencyPct?: number;
};

/** Last night's Elysia Sleep Score from a daily row (recovery's sleep part). */
function sleepScoreForRow(row: DailyRow, targetSleepMinutes: number): number | null {
  const f = computeSleepFitnessScore({
    sleepMinutes: row.sleepMinutes ?? undefined,
    sleepDeepMinutes: row.sleepDeepMinutes ?? undefined,
    sleepRemMinutes: row.sleepRemMinutes ?? undefined,
    sleepLightMinutes: row.sleepLightMinutes ?? undefined,
    sleepAwakeMinutes: row.sleepAwakeMinutes ?? undefined,
    sleepEfficiencyPct: row.sleepEfficiencyPct ?? undefined,
    sleepConsistencyPct: row.sleepConsistencyPct ?? undefined,
    targetSleepMinutes,
  });
  return f?.score ?? null;
}

function recoveryForRow(
  row: DailyRow,
  baseline: RecoveryFitnessBaseline,
  sleepScore: number | null
): RecoveryFitnessResult | null {
  return computeRecoveryFitnessScore({
    hrvAvgMs: row.hrvAvgMs ?? undefined,
    restingHrBpm: row.restingHrBpm ?? undefined,
    respiratoryRateAvg: row.respiratoryRateAvg ?? undefined,
    sleepScore: sleepScore ?? undefined,
    baseline,
  });
}

// ─── Public queries ──────────────────────────────────────────────────────────

/**
 * Recovery Fitness Score for every day in [from, to]. Drives the hero's
 * week-dots bar and the recovery score-trend route. Missing days are NOT
 * padded — the caller merges by `day` for the calendar render.
 */
export const getRecoveryFitnessRange = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const userId = await getAuthUserId(ctx);
    const baseline = await getBaseline(ctx, userId);
    const targetSleepMinutes = await getUserSleepTargetMinutes(ctx, userId);
    const rows = (await ctx.db
      .query("wearableDailyMetrics")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", from).lte("day", to)
      )
      .collect()) as DailyRow[];

    return rows
      .map((r) => {
        const sleepScore = sleepScoreForRow(r, targetSleepMinutes);
        const recovery = recoveryForRow(r, baseline, sleepScore);
        return { day: r.day, recovery };
      })
      .filter(
        (row): row is { day: string; recovery: RecoveryFitnessResult } =>
          row.recovery !== null
      )
      .sort((a, b) => a.day.localeCompare(b.day));
  },
});

/**
 * Most recent day (≤ today) that actually has a recovery signal (HRV or
 * resting HR). Drives the default selected day on /recovery. Returns today
 * as a safe fallback when there is no history at all.
 */
export const getLatestRecoveryDay = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const today = isoDay(new Date());
    const rows = (await ctx.db
      .query("wearableDailyMetrics")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).lte("day", today))
      .order("desc")
      .take(90)) as DailyRow[];
    for (const r of rows) {
      if (r.hrvAvgMs !== undefined || r.restingHrBpm !== undefined) return r.day;
    }
    return today;
  },
});

/**
 * Recovery Fitness Score of the most recent recorded day, for the Home
 * dashboard's recovery ring. Keeps the ring in lock-step with the /recovery
 * deep-dive hero. Returns null when there is no recovery history.
 */
export const getLatestRecoveryScore = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const today = isoDay(new Date());
    const baseline = await getBaseline(ctx, userId);
    const targetSleepMinutes = await getUserSleepTargetMinutes(ctx, userId);
    const rows = (await ctx.db
      .query("wearableDailyMetrics")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).lte("day", today))
      .order("desc")
      .take(90)) as DailyRow[];

    for (const r of rows) {
      const recovery = recoveryForRow(
        r,
        baseline,
        sleepScoreForRow(r, targetSleepMinutes)
      );
      if (recovery) return { day: r.day, score: recovery.score };
    }
    return null;
  },
});

/**
 * Everything the `/recovery` screen needs for ONE selected day:
 *   - dailyMetrics row (or null)
 *   - RecoveryFitnessResult (score + sub-scores + quality)
 *   - flat `metrics` map ready to feed the metric tiles (each value `null`
 *     when the provider did not supply it)
 */
export const getRecoveryDay = query({
  args: { day: v.string() },
  handler: async (ctx, { day }) => {
    const userId = await getAuthUserId(ctx);
    const baseline = await getBaseline(ctx, userId);
    const targetSleepMinutes = await getUserSleepTargetMinutes(ctx, userId);

    const dailyRow =
      ((await ctx.db
        .query("wearableDailyMetrics")
        .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
        .first()) as DailyRow | null) ?? null;

    const sleepScore = dailyRow ? sleepScoreForRow(dailyRow, targetSleepMinutes) : null;
    const recovery = dailyRow ? recoveryForRow(dailyRow, baseline, sleepScore) : null;

    return {
      day,
      dailyMetrics: dailyRow,
      recovery,
      sleepScore,
      baseline,
      metrics: {
        rhr: dailyRow?.restingHrBpm ?? null,
        hrv: dailyRow?.hrvAvgMs ?? null,
        rr: dailyRow?.respiratoryRateAvg ?? null,
        temp: dailyRow?.skinTempCelsius ?? null,
        spo2: dailyRow?.spo2AvgPct ?? null,
      },
    };
  },
});

/**
 * Time-series for the recovery metric-detail screen. One row per day in
 * [from, to] for the named metric. `value` is `null` when the day had no
 * data. Supports the five biometrics plus the recovery `score` itself.
 */
export const getRecoveryMetricSeries = query({
  args: { metric: v.string(), from: v.string(), to: v.string() },
  handler: async (ctx, { metric, from, to }) => {
    const userId = await getAuthUserId(ctx);
    const baseline = await getBaseline(ctx, userId);
    const targetSleepMinutes = await getUserSleepTargetMinutes(ctx, userId);
    const rows = (await ctx.db
      .query("wearableDailyMetrics")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", from).lte("day", to)
      )
      .collect()) as DailyRow[];
    const sorted = rows.sort((a, b) => a.day.localeCompare(b.day));

    return sorted.map((r) => {
      let value: number | null = null;
      switch (metric) {
        case "score": {
          const rec = recoveryForRow(
            r,
            baseline,
            sleepScoreForRow(r, targetSleepMinutes)
          );
          value = rec?.score ?? null;
          break;
        }
        case "rhr":
          value = r.restingHrBpm ?? null;
          break;
        case "hrv":
          value = r.hrvAvgMs ?? null;
          break;
        case "rr":
          value = r.respiratoryRateAvg ?? null;
          break;
        case "temp":
          value = r.skinTempCelsius ?? null;
          break;
        case "spo2":
          value = r.spo2AvgPct ?? null;
          break;
        default:
          value = null;
      }
      return { day: r.day, value };
    });
  },
});

/**
 * Energy Reserve curve for ONE day — the data-driven "body battery".
 *
 * Charges from the night's sleep (morning reserve), then drains across the
 * waking day from baseline metabolism plus each logged workout. Returns the
 * sampled curve, the discrete events (wake / workouts / now) and the current
 * reserve so the deep-dive can render the curve + scrubber and the main view
 * can show a compact battery tile.
 */
/** Sleep onset + wake (ISO ms) for a day, from its sleep_stage samples. */
async function resolveSleepWindow(
  ctx: QueryCtx,
  userId: string,
  day: string
): Promise<{ onsetMs: number; wakeMs: number }> {
  const stageRows = await ctx.db
    .query("wearableSamples")
    .withIndex("by_user_day_metric", (q) =>
      q.eq("userId", userId).eq("day", day).eq("metricType", "sleep_stage")
    )
    .collect();

  // Fallbacks (UTC) when no stage data exists: 01:00 onset → 07:00 wake.
  let onsetMs = Date.parse(`${day}T01:00:00.000Z`);
  let wakeMs = Date.parse(`${day}T07:00:00.000Z`);
  let sawAny = false;
  for (const s of stageRows) {
    const start = Date.parse(s.startTime);
    const end = Date.parse(s.endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (!sawAny) {
      onsetMs = start;
      wakeMs = end;
      sawAny = true;
    } else {
      if (start < onsetMs) onsetMs = start;
      if (end > wakeMs) wakeMs = end;
    }
  }
  if (wakeMs <= onsetMs) wakeMs = onsetMs + 6 * 3_600_000;
  return { onsetMs, wakeMs };
}

async function dayWorkouts(
  ctx: QueryCtx,
  userId: string,
  day: string
): Promise<EnergyWorkout[]> {
  const rows = await ctx.db
    .query("wearableWorkouts")
    .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
    .collect();
  return rows
    .map((w) => ({
      startMs: Date.parse(w.startTime),
      endMs: Date.parse(w.endTime),
      durationSec: w.durationSec,
      activityType: w.activityType,
      activeKcal: w.activeKcal,
    }))
    .filter((w) => Number.isFinite(w.startMs) && Number.isFinite(w.endMs));
}

export const getEnergyReserve = query({
  args: { day: v.string() },
  handler: async (ctx, { day }) => {
    const userId = await getAuthUserId(ctx);
    const targetSleepMinutes = await getUserSleepTargetMinutes(ctx, userId);

    const dailyRow =
      ((await ctx.db
        .query("wearableDailyMetrics")
        .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
        .first()) as DailyRow | null) ?? null;

    // Sleep charge: prefer the night's Elysia Sleep Score; fall back to the
    // minutes-vs-target ratio so a duration-only night still charges.
    const sleepScore = dailyRow ? sleepScoreForRow(dailyRow, targetSleepMinutes) : null;
    const sleepFraction =
      sleepScore !== null
        ? sleepScore / 100
        : dailyRow?.sleepMinutes !== undefined
          ? dailyRow.sleepMinutes / targetSleepMinutes
          : 0;
    const morningEnergy = morningEnergyFromSleep(sleepFraction);

    const { onsetMs, wakeMs } = await resolveSleepWindow(ctx, userId, day);
    const workouts = await dayWorkouts(ctx, userId, day);

    // Curve right end: live clock today, end of that day's evening for past
    // days (so the full decline is visible).
    const today = isoDay(new Date());
    const dayEnd = Date.parse(`${day}T23:00:00.000Z`);
    const nowRaw = day === today ? Date.now() : dayEnd;
    const nowMs = Math.max(wakeMs + 60_000, Math.min(nowRaw, dayEnd + 60 * 60_000));

    // X-axis extent: always show through ~18:00, growing as the day runs long.
    const sixPm = Date.parse(`${day}T18:00:00.000Z`);
    const xEndMs = Math.max(nowMs, sixPm, wakeMs + 8 * 3_600_000);

    const result = computeEnergyReserve({
      sleepOnsetMs: onsetMs,
      wakeMs,
      nowMs,
      morningEnergy,
      workouts,
      stepMinutes: 10,
    });

    return {
      day,
      current: Math.round(result.current),
      morningEnergy: Math.round(result.morningEnergy),
      totalCharged: Math.round(result.totalCharged),
      totalDischarged: Math.round(result.totalDischarged),
      sleepOnset: new Date(onsetMs).toISOString(),
      wake: new Date(wakeMs).toISOString(),
      xStart: new Date(onsetMs).toISOString(),
      xEnd: new Date(xEndMs).toISOString(),
      now: new Date(nowMs).toISOString(),
      samples: result.samples.map((s) => ({
        t: new Date(s.tMs).toISOString(),
        e: Math.round(s.e * 10) / 10,
        phase: s.phase,
      })),
      events: result.events.map((e) => ({
        kind: e.kind,
        tStart: new Date(e.startMs).toISOString(),
        tEnd: new Date(e.endMs).toISOString(),
        label: e.label,
        delta: Math.round(e.delta),
      })),
    };
  },
});

/**
 * Per-day battery summary for the Energy Reserve calendar. One entry per day
 * in [from, to] that has a daily row, with the end-of-day reserve + the day's
 * peak (lightweight estimate — see estimateDayBattery).
 */
export const getEnergyReserveMonth = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const userId = await getAuthUserId(ctx);
    const targetSleepMinutes = await getUserSleepTargetMinutes(ctx, userId);

    const rows = (await ctx.db
      .query("wearableDailyMetrics")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", from).lte("day", to)
      )
      .collect()) as DailyRow[];

    const workoutRows = await ctx.db
      .query("wearableWorkouts")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", from).lte("day", to)
      )
      .collect();
    const drainByDay = new Map<string, number>();
    for (const w of workoutRows) {
      const pts = workoutDrainPoints({
        startMs: Date.parse(w.startTime),
        endMs: Date.parse(w.endTime),
        durationSec: w.durationSec,
        activityType: w.activityType,
        activeKcal: w.activeKcal,
      });
      drainByDay.set(w.day, (drainByDay.get(w.day) ?? 0) + pts);
    }

    return rows
      .map((r) => {
        const sleepScore = sleepScoreForRow(r, targetSleepMinutes);
        const frac =
          sleepScore !== null
            ? sleepScore / 100
            : r.sleepMinutes !== undefined
              ? r.sleepMinutes / targetSleepMinutes
              : 0;
        const morningEnergy = morningEnergyFromSleep(frac);
        const { endLevel, maxLevel } = estimateDayBattery(
          morningEnergy,
          drainByDay.get(r.day) ?? 0
        );
        return { day: r.day, endLevel, maxLevel };
      })
      .sort((a, b) => a.day.localeCompare(b.day));
  },
});
