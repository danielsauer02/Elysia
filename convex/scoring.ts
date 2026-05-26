/**
 * Convex action layer for the Elysia Health Score engine.
 *
 * Reads inputs from the DB, calls the pure orchestrator in `convex/scoring/`
 * and persists `dailyHealthScores` (one row per user-day).
 *
 * Pipeline: see [convex/analytics.ts](./analytics.ts) - this module is
 * invoked from `recomputeAnalyticsForDay` after the energy balance is
 * written.
 */

import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "./_helpers";
import { computeDailyScores, SCORE_MODEL_VERSION } from "./scoring/index";
import type {
  BaselineContext,
  PillarInput,
  PillarScoreMap,
  PillarId,
} from "./scoring/types";
import {
  computeConfidence,
  computeContributions,
  computeElysiaAge,
  computePillarBaselines,
  computeVelocity,
} from "./scoring/agingEngine";
import { computeLayerScores } from "./scoring/displayLayers";
import { ageYears, isoDay } from "./analyticsCore";

/**
 * Classify the 7-day trajectory of `composite` scores. Returns "improving",
 * "stable" or "declining". Null when fewer than 5 non-null days are
 * available (insufficient to fit a slope).
 *
 * Slope is OLS over (dayIndex, composite). |slope| >= 0.5 points/day flips
 * to improving/declining.
 */
function classifyTrajectoryStatus(
  composites: Array<number | null | undefined>
): "improving" | "stable" | "declining" | null {
  const points = composites
    .map((c, i) => ({ x: i, y: c }))
    .filter((p): p is { x: number; y: number } => typeof p.y === "number");
  if (points.length < 5) return null;
  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) ** 2;
  }
  if (den === 0) return "stable";
  const slope = num / den;
  if (slope >= 0.5) return "improving";
  if (slope <= -0.5) return "declining";
  return "stable";
}

// ─── Internal queries ────────────────────────────────────────────────────────

export const getProfileInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", userId))
      .unique();
  },
});

export const getDailyWearableInternal = internalQuery({
  args: { userId: v.string(), day: v.string() },
  handler: async (ctx, { userId, day }) => {
    return await ctx.db
      .query("wearableDailyMetrics")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
      .unique();
  },
});

export const getEnergyBalanceInternal = internalQuery({
  args: { userId: v.string(), day: v.string() },
  handler: async (ctx, { userId, day }) => {
    return await ctx.db
      .query("energyBalanceDaily")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
      .unique();
  },
});

export const getWeightSeriesInternal = internalQuery({
  args: { userId: v.string(), from: v.string(), to: v.string() },
  handler: async (ctx, { userId, from, to }) => {
    const rows = await ctx.db
      .query("weightLog")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).gte("loggedDate", from).lte("loggedDate", to)
      )
      .collect();
    return rows
      .map((r) => ({ day: r.loggedDate, weightKg: r.weightKg }))
      .sort((a, b) => a.day.localeCompare(b.day));
  },
});

export const getUserBaselineInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("userBaselines")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const getHabitRollupInternal = internalQuery({
  args: { userId: v.string(), day: v.string() },
  handler: async (ctx, { userId, day }) => {
    const habits = await ctx.db
      .query("habits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const activeHabits = habits.filter((h) => h.state === "active");
    if (activeHabits.length === 0) {
      return {
        activeCount: 0,
        completedToday: 0,
        expectedToday: 0,
        distinctCategories: 0,
        maxStreakDays: 0,
        adherence14dPct: 0,
      };
    }

    const completionsToday = await ctx.db
      .query("habitCompletions")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).eq("completedDate", day)
      )
      .collect();

    // 14-day adherence window.
    const dayDate = new Date(`${day}T00:00:00Z`);
    const from = isoDay(new Date(dayDate.getTime() - 13 * 86400 * 1000));
    const completions14d = await ctx.db
      .query("habitCompletions")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).gte("completedDate", from).lte("completedDate", day)
      )
      .collect();

    const distinctCategories = new Set(activeHabits.map((h) => h.category)).size;
    const maxStreakDays = activeHabits.reduce(
      (m, h) => Math.max(m, h.streakCount ?? 0),
      0
    );

    // Expected completions over the 14d window: sum of frequencyPerWeek * 2.
    const expected14d = activeHabits.reduce(
      (s, h) => s + (h.schedule?.frequencyPerWeek ?? 0) * 2,
      0
    );
    const adherence14dPct =
      expected14d > 0
        ? Math.min(100, (completions14d.length / expected14d) * 100)
        : 0;

    // For "today" we just use frequencyPerWeek/7 as the expected target.
    const expectedToday = activeHabits.reduce(
      (s, h) => s + (h.schedule?.frequencyPerWeek ?? 0) / 7,
      0
    );

    return {
      activeCount: activeHabits.length,
      completedToday: completionsToday.length,
      expectedToday,
      distinctCategories,
      maxStreakDays,
      adherence14dPct,
    };
  },
});

// ─── Internal mutation: persist score ────────────────────────────────────────

export const writeDailyHealthScoreInternal = internalMutation({
  args: {
    userId: v.string(),
    day: v.string(),
    pillarScores: v.any(),
    composite: v.optional(v.number()),
    tierLevel: v.optional(v.number()),
    coverage: v.optional(v.number()),
    layerScores: v.optional(v.any()),
    trajectoryStatus: v.optional(v.string()),
    scoreModelVersion: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dailyHealthScores")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", args.userId).eq("day", args.day)
      )
      .unique();
    const payload = {
      userId: args.userId,
      day: args.day,
      pillarScores: args.pillarScores,
      composite: args.composite,
      tierLevel: args.tierLevel,
      coverage: args.coverage,
      layerScores: args.layerScores,
      trajectoryStatus: args.trajectoryStatus,
      scoreModelVersion: args.scoreModelVersion,
      updatedAt: new Date().toISOString(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return await ctx.db.insert("dailyHealthScores", payload);
  },
});

/**
 * Patch-only mutation used at the end of `recomputeAgingTrajectory` to
 * cache `healthspanCreditsToday` on the day's existing dailyHealthScores
 * row. Idempotent.
 */
export const patchHealthspanCreditsInternal = internalMutation({
  args: {
    userId: v.string(),
    day: v.string(),
    healthspanCreditsToday: v.number(),
  },
  handler: async (ctx, { userId, day, healthspanCreditsToday }) => {
    const existing = await ctx.db
      .query("dailyHealthScores")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
      .unique();
    if (!existing) return;
    await ctx.db.patch(existing._id, { healthspanCreditsToday });
  },
});

// ─── Core action: recompute one day ──────────────────────────────────────────

export const recomputeDailyHealthScores = internalAction({
  args: { userId: v.string(), day: v.string() },
  handler: async (ctx, { userId, day }) => {
    type ProfileRow = {
      sex?: string;
      dateOfBirth?: string;
      heightCm?: number;
      weightKg?: number;
    };
    type WearableRow = NonNullable<PillarInput["wearableDaily"]>;
    type EnergyRow = NonNullable<PillarInput["energyBalance"]>;
    type WeightRow = { day: string; weightKg: number };

    const [profile, wearable, energy, baseline] = await Promise.all([
      ctx.runQuery(internal.scoring.getProfileInternal, { userId }) as Promise<ProfileRow | null>,
      ctx.runQuery(internal.scoring.getDailyWearableInternal, { userId, day }) as Promise<WearableRow | null>,
      ctx.runQuery(internal.scoring.getEnergyBalanceInternal, { userId, day }) as Promise<EnergyRow | null>,
      ctx.runQuery(internal.scoring.getUserBaselineInternal, { userId }) as Promise<
        { status: string; daysCalibrated: number; metrics: Record<string, number> } | null
      >,
    ]);

    // Weight series window: last 28 days ending on `day`.
    const dayDate = new Date(`${day}T00:00:00Z`);
    const seriesFrom = isoDay(new Date(dayDate.getTime() - 27 * 86400 * 1000));
    const weightSeries = (await ctx.runQuery(
      internal.scoring.getWeightSeriesInternal,
      { userId, from: seriesFrom, to: day }
    )) as WeightRow[];

    // 7-day wearable window for the Stress pillar (HRV variance).
    const recentFrom = isoDay(new Date(dayDate.getTime() - 6 * 86400 * 1000));
    const recentWearableRaw = (await ctx.runQuery(
      internal.scoring.getWearableRangeInternal,
      { userId, from: recentFrom, to: day }
    )) as Array<{
      day: string;
      hrvAvgMs?: number;
      restingHrBpm?: number;
      respiratoryRateAvg?: number;
    }>;
    const recentWearable = recentWearableRaw.map((r) => ({
      day: r.day,
      hrvAvgMs: r.hrvAvgMs,
      restingHrBpm: r.restingHrBpm,
      respiratoryRateAvg: r.respiratoryRateAvg,
    }));

    const habits = (await ctx.runQuery(internal.scoring.getHabitRollupInternal, {
      userId,
      day,
    })) as NonNullable<PillarInput["habits"]>;

    const input: PillarInput = {
      wearableDaily: wearable,
      energyBalance: energy,
      profile,
      weightSeries: weightSeries.length > 0 ? weightSeries : null,
      recentWearable: recentWearable.length > 0 ? recentWearable : null,
      habits,
    };

    const baselineCtx: BaselineContext = {
      status: (baseline?.status as BaselineContext["status"]) ?? "calibrating",
      daysCalibrated: baseline?.daysCalibrated ?? 0,
      metrics: (baseline?.metrics ?? {}) as BaselineContext["metrics"],
    };

    const { pillarScores, composite } = computeDailyScores(input, baselineCtx);

    // UI-layer aggregates (v1.2.0) — pure projection over pillarScores.
    const layerScores = computeLayerScores(pillarScores);

    // 7-day composite trajectory (today + last 6 days), excluding today since
    // we haven't written it yet. The current day is appended on the client.
    const trajFrom = isoDay(new Date(dayDate.getTime() - 6 * 86400 * 1000));
    const recentScoreRows = (await ctx.runQuery(
      internal.scoring.getRecentHealthScoresInternal,
      { userId, from: trajFrom, to: day }
    )) as Array<{ day: string; composite?: number | null }>;
    const composites: Array<number | null | undefined> = [
      ...recentScoreRows
        .filter((r) => r.day !== day)
        .map((r) => r.composite ?? null),
      composite.composite ?? null,
    ];
    const trajectoryStatus = classifyTrajectoryStatus(composites) ?? undefined;

    await ctx.runMutation(internal.scoring.writeDailyHealthScoreInternal, {
      userId,
      day,
      pillarScores,
      composite: composite.composite ?? undefined,
      tierLevel: composite.tierLevel ?? undefined,
      coverage: composite.coverage,
      layerScores,
      trajectoryStatus,
      scoreModelVersion: SCORE_MODEL_VERSION,
    });
  },
});

// ─── Aging Engine: queries + mutations + action ─────────────────────────────

export const getRecentHealthScoresInternal = internalQuery({
  args: { userId: v.string(), from: v.string(), to: v.string() },
  handler: async (ctx, { userId, from, to }) => {
    const rows = await ctx.db
      .query("dailyHealthScores")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", from).lte("day", to)
      )
      .collect();
    return rows.sort((a, b) => a.day.localeCompare(b.day));
  },
});

export const getRecentAgingTrajectoryInternal = internalQuery({
  args: { userId: v.string(), from: v.string(), to: v.string() },
  handler: async (ctx, { userId, from, to }) => {
    const rows = await ctx.db
      .query("agingTrajectory")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", from).lte("day", to)
      )
      .collect();
    return rows.sort((a, b) => a.day.localeCompare(b.day));
  },
});

export const writeAgingTrajectoryInternal = internalMutation({
  args: {
    userId: v.string(),
    day: v.string(),
    chronoAge: v.number(),
    elysiaAge: v.number(),
    delta: v.number(),
    velocity28d: v.optional(v.number()),
    confidence: v.number(),
    tierLevel: v.optional(v.number()),
    scoreModelVersion: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("agingTrajectory")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", args.userId).eq("day", args.day)
      )
      .unique();
    const payload = {
      ...args,
      updatedAt: new Date().toISOString(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return await ctx.db.insert("agingTrajectory", payload);
  },
});

export const replaceContributionsInternal = internalMutation({
  args: {
    userId: v.string(),
    day: v.string(),
    contributions: v.array(
      v.object({
        pillar: v.string(),
        tier: v.number(),
        deltaMinutes: v.number(),
        rationale: v.string(),
      })
    ),
    scoreModelVersion: v.string(),
  },
  handler: async (ctx, { userId, day, contributions, scoreModelVersion }) => {
    const existing = await ctx.db
      .query("longevityContributions")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
      .collect();
    await Promise.all(existing.map((row) => ctx.db.delete(row._id)));
    await Promise.all(
      contributions.map((c) =>
        ctx.db.insert("longevityContributions", {
          userId,
          day,
          pillar: c.pillar,
          tier: c.tier,
          deltaMinutes: c.deltaMinutes,
          rationale: c.rationale,
          scoreModelVersion,
        })
      )
    );
  },
});

export const recomputeAgingTrajectory = internalAction({
  args: { userId: v.string(), day: v.string() },
  handler: async (ctx, { userId, day }) => {
    const profile = (await ctx.runQuery(internal.scoring.getProfileInternal, {
      userId,
    })) as { dateOfBirth?: string } | null;
    const baseline = (await ctx.runQuery(internal.scoring.getUserBaselineInternal, {
      userId,
    })) as
      | { status: BaselineContext["status"]; daysCalibrated: number }
      | null;

    // §5: no trajectory while still calibrating.
    if (!baseline || baseline.status === "calibrating") return;

    const chronoAge = profile ? ageYears(profile.dateOfBirth ?? null) : null;
    if (chronoAge === null) return;

    // Pull the last 28 days of pillar scores.
    const dayDate = new Date(`${day}T00:00:00Z`);
    const from = isoDay(new Date(dayDate.getTime() - 27 * 86400 * 1000));
    const scoreRows = (await ctx.runQuery(
      internal.scoring.getRecentHealthScoresInternal,
      { userId, from, to: day }
    )) as { day: string; pillarScores: PillarScoreMap; coverage?: number; tierLevel?: number }[];

    const todayRow = scoreRows.find((r) => r.day === day);
    if (!todayRow) return;

    const { elysiaAge, delta } = computeElysiaAge(chronoAge, todayRow.pillarScores);

    // 28d trajectory velocity: pull prior trajectory rows + include today's.
    const trajFrom = isoDay(new Date(dayDate.getTime() - 27 * 86400 * 1000));
    const trajRows = (await ctx.runQuery(
      internal.scoring.getRecentAgingTrajectoryInternal,
      { userId, from: trajFrom, to: day }
    )) as { day: string; delta: number }[];
    const velocityPoints = [
      ...trajRows.filter((r) => r.day !== day),
      { day, delta },
    ];
    const velocity28d = computeVelocity(velocityPoints) ?? undefined;

    const confidence = computeConfidence({
      status: baseline.status,
      daysCalibrated: baseline.daysCalibrated,
      coverage: todayRow.coverage ?? 0,
    });

    await ctx.runMutation(internal.scoring.writeAgingTrajectoryInternal, {
      userId,
      day,
      chronoAge,
      elysiaAge,
      delta,
      velocity28d,
      confidence,
      tierLevel: todayRow.tierLevel ?? undefined,
      scoreModelVersion: SCORE_MODEL_VERSION,
    });

    // Contributions: per-pillar delta vs pillar 28d baseline.
    const history = scoreRows
      .filter((r) => r.day !== day)
      .map((r) => r.pillarScores);
    const pillarBaselines = computePillarBaselines(history);
    const contributions = computeContributions(
      todayRow.pillarScores,
      pillarBaselines
    );
    await ctx.runMutation(internal.scoring.replaceContributionsInternal, {
      userId,
      day,
      contributions: contributions.map((c) => ({
        pillar: c.pillar as string,
        tier: c.tier,
        deltaMinutes: c.deltaMinutes,
        rationale: c.rationale,
      })),
      scoreModelVersion: SCORE_MODEL_VERSION,
    });

    // Cache today's healthspan credit sum on the dailyHealthScores row so the
    // Longevity Battery can render it without joining longevityContributions.
    const healthspanCreditsToday = contributions.reduce(
      (s, c) => s + (c.deltaMinutes ?? 0),
      0
    );
    await ctx.runMutation(internal.scoring.patchHealthspanCreditsInternal, {
      userId,
      day,
      healthspanCreditsToday,
    });
  },
});

// ─── Public queries ──────────────────────────────────────────────────────────

export const getHealthScoresRange = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const userId = await getAuthUserId(ctx);
    const rows = await ctx.db
      .query("dailyHealthScores")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", from).lte("day", to)
      )
      .collect();
    return rows.sort((a, b) => a.day.localeCompare(b.day));
  },
});

export const getHealthScoreForDay = query({
  args: { day: v.string() },
  handler: async (ctx, { day }) => {
    const userId = await getAuthUserId(ctx);
    return await ctx.db
      .query("dailyHealthScores")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
      .unique();
  },
});

/**
 * Latest dailyHealthScores row for the authenticated user. Used by the
 * Longevity Wheel + Battery to render the most recent layerScores +
 * composite + trajectoryStatus + healthspanCreditsToday in one round-trip.
 */
export const getLatestHealthScore = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const rows = await ctx.db
      .query("dailyHealthScores")
      .withIndex("by_user_day", (q) => q.eq("userId", userId))
      .order("desc")
      .take(1);
    return rows[0] ?? null;
  },
});

export const getAgingTrajectoryRange = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const userId = await getAuthUserId(ctx);
    const rows = await ctx.db
      .query("agingTrajectory")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", from).lte("day", to)
      )
      .collect();
    return rows.sort((a, b) => a.day.localeCompare(b.day));
  },
});

export const getLatestAgingTrajectory = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const rows = await ctx.db
      .query("agingTrajectory")
      .withIndex("by_user_day", (q) => q.eq("userId", userId))
      .order("desc")
      .take(1);
    return rows[0] ?? null;
  },
});

export const getLongevityContributions = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const userId = await getAuthUserId(ctx);
    const rows = await ctx.db
      .query("longevityContributions")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", from).lte("day", to)
      )
      .collect();
    return rows.sort((a, b) => a.day.localeCompare(b.day));
  },
});

/**
 * Single roll-up for the LongevityPerformanceView: aggregates per-pillar
 * minutes over the chosen window. UI maps `timeFilter` to from/to days.
 */
export const getLongevityContributionTotals = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const userId = await getAuthUserId(ctx);
    const rows = await ctx.db
      .query("longevityContributions")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", from).lte("day", to)
      )
      .collect();
    type Bucket = {
      pillar: string;
      tier: number;
      deltaMinutes: number;
      lastRationale: string;
      dayCount: number;
    };
    const byPillar = new Map<string, Bucket>();
    for (const row of rows) {
      const existing = byPillar.get(row.pillar);
      if (existing) {
        existing.deltaMinutes += row.deltaMinutes;
        existing.lastRationale = row.rationale;
        existing.dayCount += 1;
      } else {
        byPillar.set(row.pillar, {
          pillar: row.pillar,
          tier: row.tier,
          deltaMinutes: row.deltaMinutes,
          lastRationale: row.rationale,
          dayCount: 1,
        });
      }
    }
    const totals = [...byPillar.values()].sort(
      (a, b) => Math.abs(b.deltaMinutes) - Math.abs(a.deltaMinutes)
    );
    const totalDeltaMinutes = totals.reduce((s, t) => s + t.deltaMinutes, 0);
    return { totals, totalDeltaMinutes, dayCount: rows.length };
  },
});

/**
 * What-if simulator: takes the latest dailyHealthScores row and lets the
 * UI ask "what would my composite + Elysia Age look like if pillar X was
 * score Y?". Returns the resulting composite, age delta, contributions —
 * does not write anything.
 */
export const simulateScore = query({
  args: {
    /** Map of pillarId -> override score in 0..100 (or null to clear). */
    overrides: v.any(),
    /** Optional ISO day; defaults to the latest dailyHealthScores row. */
    day: v.optional(v.string()),
  },
  handler: async (ctx, { overrides, day }) => {
    const userId = await getAuthUserId(ctx);

    let scoreRow = null as null | {
      day: string;
      pillarScores: PillarScoreMap;
      composite?: number;
      coverage?: number;
      tierLevel?: number;
    };
    if (day) {
      scoreRow = await ctx.db
        .query("dailyHealthScores")
        .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
        .unique();
    } else {
      const latest = await ctx.db
        .query("dailyHealthScores")
        .withIndex("by_user_day", (q) => q.eq("userId", userId))
        .order("desc")
        .take(1);
      scoreRow = latest[0] ?? null;
    }
    if (!scoreRow) return null;

    const merged: PillarScoreMap = { ...scoreRow.pillarScores };
    const overridesMap = (overrides ?? {}) as Partial<
      Record<PillarId, number | null>
    >;
    for (const [pid, val] of Object.entries(overridesMap)) {
      if (val === null) {
        merged[pid as PillarId] = null;
      } else if (typeof val === "number" && Number.isFinite(val)) {
        merged[pid as PillarId] = Math.max(0, Math.min(100, Math.round(val)));
      }
    }

    const { computeComposite } = await import("./scoring/composite");
    const composite = computeComposite(merged);

    // Aging
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", userId))
      .unique();
    const chronoAge = ageYears(profile?.dateOfBirth ?? null);
    let elysiaAge: number | null = null;
    let delta: number | null = null;
    if (chronoAge !== null) {
      const ages = computeElysiaAge(chronoAge, merged);
      elysiaAge = ages.elysiaAge;
      delta = ages.delta;
    }

    return {
      day: scoreRow.day,
      pillarScores: merged,
      composite: composite.composite,
      coverage: composite.coverage,
      tierLevel: composite.tierLevel,
      chronoAge,
      elysiaAge,
      delta,
    };
  },
});

export const getCalibrationState = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const baseline = await ctx.db
      .query("userBaselines")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!baseline) {
      return {
        status: "calibrating" as const,
        daysCalibrated: 0,
        daysRequired: 14,
      };
    }
    return {
      status: baseline.status,
      daysCalibrated: baseline.daysCalibrated,
      daysRequired: 14,
      metrics: baseline.metrics,
      updatedAt: baseline.updatedAt,
    };
  },
});

// ─── Baseline refresh (cron-driven) ─────────────────────────────────────────

export const writeUserBaselineInternal = internalMutation({
  args: {
    userId: v.string(),
    windowStart: v.string(),
    windowEnd: v.string(),
    metrics: v.any(),
    status: v.string(),
    daysCalibrated: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userBaselines")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    const payload = {
      ...args,
      scoreModelVersion: SCORE_MODEL_VERSION,
      updatedAt: new Date().toISOString(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return await ctx.db.insert("userBaselines", payload);
  },
});

export const getDistinctScoringUsersInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Collect from wearableDailyMetrics — anyone with at least one rolled-up
    // day has enough data to start calibrating. Cheap enough at MVP scale.
    const rows = await ctx.db.query("wearableDailyMetrics").collect();
    const ids = new Set<string>();
    for (const r of rows) ids.add(r.userId);
    return [...ids];
  },
});

type WearableDayRow = {
  hrvAvgMs?: number;
  restingHrBpm?: number;
  sleepMinutes?: number;
  steps?: number;
  strainScore?: number;
  totalKcal?: number;
  activeKcal?: number;
  hrAvgBpm?: number;
  respiratoryRateAvg?: number;
};

function dayHasMeaningfulWearableData(row: WearableDayRow): boolean {
  return (
    (row.hrvAvgMs ?? 0) > 0 ||
    (row.restingHrBpm ?? 0) > 0 ||
    (row.sleepMinutes ?? 0) > 0 ||
    (row.steps ?? 0) > 0 ||
    (row.strainScore ?? 0) > 0 ||
    (row.totalKcal ?? 0) > 0 ||
    (row.activeKcal ?? 0) > 0 ||
    (row.hrAvgBpm ?? 0) > 0
  );
}

export const refreshUserBaseline = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const today = new Date();
    const windowEnd = isoDay(today);
    const windowStart = isoDay(
      new Date(today.getTime() - 13 * 86400 * 1000)
    );

    const wearableRows = await ctx.runQuery(
      internal.scoring.getWearableRangeInternal,
      { userId, from: windowStart, to: windowEnd }
    );

    const wrows = wearableRows as WearableDayRow[];
    const daysCalibrated = wrows.filter(dayHasMeaningfulWearableData).length;

    const numericMedian = (values: number[]): number | null => {
      const filtered = values.filter((v) => Number.isFinite(v));
      if (filtered.length === 0) return null;
      const sorted = [...filtered].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[mid - 1]! + sorted[mid]!) / 2
        : sorted[mid]!;
    };

    const metrics = {
      hrvMedian: numericMedian(wrows.map((r) => r.hrvAvgMs ?? NaN)),
      rhrMedian: numericMedian(wrows.map((r) => r.restingHrBpm ?? NaN)),
      sleepMedian: numericMedian(wrows.map((r) => r.sleepMinutes ?? NaN)),
      stepsMedian: numericMedian(wrows.map((r) => r.steps ?? NaN)),
      respMedian: numericMedian(wrows.map((r) => r.respiratoryRateAvg ?? NaN)),
    };

    const status: "calibrating" | "ready" | "stale" =
      daysCalibrated >= 14 ? "ready" : "calibrating";

    await ctx.runMutation(internal.scoring.writeUserBaselineInternal, {
      userId,
      windowStart,
      windowEnd,
      metrics,
      status,
      daysCalibrated,
    });
  },
});

export const getWearableRangeInternal = internalQuery({
  args: { userId: v.string(), from: v.string(), to: v.string() },
  handler: async (ctx, { userId, from, to }) => {
    const rows = await ctx.db
      .query("wearableDailyMetrics")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", from).lte("day", to)
      )
      .collect();
    return rows;
  },
});

/**
 * Cron entry point: refresh baselines for every user with rolled-up data,
 * and re-trigger today's score recompute so a freshly-promoted user sees
 * Aging Engine output the same night.
 */
export const refreshAllBaselines = internalAction({
  args: {},
  handler: async (ctx): Promise<{ processed: number }> => {
    const userIds: string[] = await ctx.runQuery(
      internal.scoring.getDistinctScoringUsersInternal,
      {}
    );
    const today = isoDay(new Date());
    for (const userId of userIds) {
      await ctx.runAction(internal.scoring.refreshUserBaseline, { userId });
      // Re-run today's pipeline so newly-ready users get a trajectory row.
      await ctx.runAction(internal.scoring.recomputeDailyHealthScores, {
        userId,
        day: today,
      });
      await ctx.runAction(internal.scoring.recomputeAgingTrajectory, {
        userId,
        day: today,
      });
    }
    return { processed: userIds.length };
  },
});

// ─── Score model version seeding ─────────────────────────────────────────────

export const seedScoreModelVersion = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("scoreModelVersions")
      .withIndex("by_version", (q) => q.eq("version", SCORE_MODEL_VERSION))
      .unique();
    if (existing) return existing._id;
    const { PILLAR_REGISTRY } = await import("./scoring/pillarRegistry");
    const serialised = PILLAR_REGISTRY.map((p) => ({
      id: p.id,
      label: p.label,
      tier: p.tier,
      weight: p.weight,
      lambda: p.lambda,
      beta: p.beta,
      requiredSources: p.requiredSources,
      active: p.active,
    }));
    return await ctx.db.insert("scoreModelVersions", {
      version: SCORE_MODEL_VERSION,
      releasedAt: new Date().toISOString(),
      pillarRegistry: serialised,
      description: "v1.2.0: adds 8th Tier-1 pillar `stress` (HRV-CV + sleep fragmentation + respiratory deviation). Activity 0.15->0.09, Recovery 0.15->0.13, Habits 0.07->0.05 to make room. Persists layerScores (6-layer wheel mapping), trajectoryStatus (7d composite slope), and healthspanCreditsToday on dailyHealthScores.",
    });
  },
});

export const ensureScoreModelVersion = action({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(internal.scoring.seedScoreModelVersion, {});
    return { version: SCORE_MODEL_VERSION };
  },
});

// ─── Backfill action: recompute last N days for current user ─────────────────

export const backfillMyHealthScores = action({
  args: { days: v.optional(v.number()) },
  handler: async (
    ctx,
    { days }
  ): Promise<{
    recomputed: number;
    baselineStatus: string;
    daysCalibrated: number;
    trajectoryWritten: number;
    wearableSync: {
      providers: string[];
      samplesInserted: number;
      daysRolledUp: number;
      diagnostics?: Record<string, unknown>;
    } | null;
  }> => {
    const userId = await getAuthUserId(ctx);
    const n = Math.max(1, Math.min(365, days ?? 90));
    const today = new Date();
    const fromDay = isoDay(new Date(today.getTime() - (n - 1) * 86400 * 1000));

    // 0) Pull OAuth wearables + roll raw samples → wearableDailyMetrics.
    //    Backfill only recomputes scores; without this step the engine sees
    //    "0 days of wearable data" even when Whoop shows as connected.
    let wearableSync: {
      providers: string[];
      samplesInserted: number;
      daysRolledUp: number;
      diagnostics?: Record<string, unknown>;
    } | null = null;
    try {
      wearableSync = await ctx.runAction(
        internal.integrations.syncWearablesForUserInternal,
        { userId, daysBack: Math.min(n, 90) }
      );
    } catch (e) {
      console.error("[backfill] wearable sync failed", e);
    }

    // 1) Ensure every day with raw samples is rolled up (covers Health
    //    Connect / Apple Health ingested via the mobile app).
    await ctx.runAction(internal.wearables.rollupSampleDaysInRange, {
      userId,
      from: fromDay,
      to: isoDay(today),
    });

    // 2) Refresh baseline AFTER data exists in wearableDailyMetrics.
    await ctx.runAction(internal.scoring.refreshUserBaseline, { userId });
    const baseline = (await ctx.runQuery(
      internal.scoring.getUserBaselineInternal,
      { userId }
    )) as { status: string; daysCalibrated: number } | null;
    const baselineStatus = baseline?.status ?? "calibrating";
    const daysCalibrated = baseline?.daysCalibrated ?? 0;

    // 3) Recompute pillar scores + aging trajectory per day.
    let recomputed = 0;
    let trajectoryWritten = 0;
    for (let i = 0; i < n; i++) {
      const d = isoDay(new Date(today.getTime() - i * 86400 * 1000));
      await ctx.runAction(internal.scoring.recomputeDailyHealthScores, {
        userId,
        day: d,
      });
      recomputed++;
      if (baselineStatus === "ready") {
        await ctx.runAction(internal.scoring.recomputeAgingTrajectory, {
          userId,
          day: d,
        });
        trajectoryWritten++;
      }
    }
    return {
      recomputed,
      baselineStatus,
      daysCalibrated,
      trajectoryWritten,
      wearableSync,
    };
  },
});
