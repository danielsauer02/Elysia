/**
 * Habit Recommendations API.
 *
 * Powers the "How can I improve my Recovery?" stack on the recovery deep-dive.
 * The ranker is intentionally compute-on-read: the underlying 7-day data
 * already refreshes daily via the wearable rollup pipeline, so a query call
 * gives the freshest answer without a separate persisted snapshot.
 *
 * Only the user-initiated "Not now" dismissal is persisted, in
 * `recommendationDismissals`, with a 7-day TTL so a dismissed card reappears
 * after a week.
 */

import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "./_helpers";
import {
  computeRecoveryFitnessScore,
  type RecoveryFitnessBaseline,
} from "./scoring/recoveryFitness";
import {
  computeSleepFitnessScore,
  targetSleepMinutesForAge,
} from "./scoring/sleepFitness";
import {
  buildCandidatePool,
  impactsForActiveHabits,
  scoreRecoveryRecommendations,
  RECOVERY_RELEVANT_CATEGORIES,
  type RecoverySubScores,
  type HabitMetricImpacts,
} from "./scoring/recoveryRecommendations";

const DAY_MS = 86_400_000;
const DISMISS_TTL_MS = 7 * DAY_MS;
const RECOVERY_SCOPE = "recovery";
const TOP_N = 5;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isoTs(d: Date): string {
  return d.toISOString();
}

// ─── Helpers shared with recovery.ts (kept local to avoid import cycles) ──────

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
  sleepMinutes?: number;
  sleepDeepMinutes?: number;
  sleepRemMinutes?: number;
  sleepLightMinutes?: number;
  sleepAwakeMinutes?: number;
  sleepEfficiencyPct?: number;
  sleepConsistencyPct?: number;
};

function sleepScoreForRow(
  row: DailyRow,
  targetSleepMinutes: number
): number | null {
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

/**
 * Average each Recovery Fitness sub-score across the last 7 days of data.
 * `null` per metric means no day in the window had a usable signal.
 */
function averageSubScores(
  rows: DailyRow[],
  baseline: RecoveryFitnessBaseline,
  targetSleepMinutes: number
): RecoverySubScores {
  const buckets: Record<keyof RecoverySubScores, number[]> = {
    hrv: [],
    rhr: [],
    resp: [],
    sleep: [],
  };
  for (const row of rows) {
    const sleepScore = sleepScoreForRow(row, targetSleepMinutes);
    const r = computeRecoveryFitnessScore({
      hrvAvgMs: row.hrvAvgMs ?? undefined,
      restingHrBpm: row.restingHrBpm ?? undefined,
      respiratoryRateAvg: row.respiratoryRateAvg ?? undefined,
      sleepScore: sleepScore ?? undefined,
      baseline,
    });
    if (!r) continue;
    if (r.subHrv !== null) buckets.hrv.push(r.subHrv);
    if (r.subRhr !== null) buckets.rhr.push(r.subRhr);
    if (r.subResp !== null) buckets.resp.push(r.subResp);
    if (r.subSleep !== null) buckets.sleep.push(r.subSleep);
  }
  const avg = (xs: number[]): number | null =>
    xs.length === 0 ? null : Math.round(xs.reduce((s, x) => s + x, 0) / xs.length);
  return {
    hrv: avg(buckets.hrv),
    rhr: avg(buckets.rhr),
    resp: avg(buckets.resp),
    sleep: avg(buckets.sleep),
  };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Ranked recovery recommendations for the authenticated user. Returns up to
 * the top N candidates, the user's currently-active recovery-relevant habits
 * (for the "Already in place" section), and the metric-context that drove
 * the ranking (handy for the UI subtitle / debug).
 */
export const getRecoveryRecommendations = query({
  // The client passes its habit catalog (templateId + category) so any newly
  // added library card automatically becomes a scorable candidate without a
  // backend change. Optional for resilience (older clients fall back to the
  // hand-tuned tag list).
  args: {
    catalog: v.optional(
      v.array(v.object({ templateId: v.string(), category: v.string() }))
    ),
  },
  handler: async (ctx, { catalog }) => {
    const userId = await getAuthUserId(ctx);
    const now = new Date();
    const candidatePool = buildCandidatePool(catalog);
    const candidateIds = new Set(candidatePool.map((c) => c.templateId));
    const today = isoDay(now);
    const from = isoDay(new Date(now.getTime() - 6 * DAY_MS));
    const baseline = await getBaseline(ctx, userId);
    const targetSleepMinutes = await getUserSleepTargetMinutes(ctx, userId);

    const dailyRows = (await ctx.db
      .query("wearableDailyMetrics")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", from).lte("day", today)
      )
      .collect()) as DailyRow[];

    const subScores7d = averageSubScores(dailyRows, baseline, targetSleepMinutes);

    const habits = await ctx.db
      .query("habits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const activeTemplateIds = new Set<string>();
    const plannedOrActiveTemplateIds = new Set<string>();
    const activeRecoveryHabits: Array<{
      habitId: string;
      templateId: string;
      title: string;
      category: string;
    }> = [];
    // Active recovery-relevant habits drive coverage (resolved with category
    // fallback) — counts any active habit in a recovery category, not just
    // candidate-pool ones.
    const activeRecoveryForCoverage: Array<{
      templateId: string;
      category: string;
    }> = [];
    for (const habit of habits) {
      if (!habit.templateId) continue;
      if (habit.state === "planned" || habit.state === "active") {
        plannedOrActiveTemplateIds.add(habit.templateId);
      }
      const isRecoveryRelevant =
        candidateIds.has(habit.templateId) ||
        RECOVERY_RELEVANT_CATEGORIES.has(habit.category);
      if (habit.state === "active" && isRecoveryRelevant) {
        activeTemplateIds.add(habit.templateId);
        activeRecoveryForCoverage.push({
          templateId: habit.templateId,
          category: habit.category,
        });
        activeRecoveryHabits.push({
          habitId: habit._id,
          templateId: habit.templateId,
          title: habit.title,
          category: habit.category,
        });
      }
    }

    // Excluding both planned + active prevents recommending something the
    // user has already moved into their pipeline. Coverage discount still
    // only counts active habits — planned ones haven't actually improved
    // anything yet.
    const excludeIds = new Set<string>([
      ...activeTemplateIds,
      ...plannedOrActiveTemplateIds,
    ]);

    const activeImpacts: HabitMetricImpacts[] = impactsForActiveHabits(
      activeRecoveryForCoverage
    );

    const nowMs = now.getTime();
    const dismissalRows = await ctx.db
      .query("recommendationDismissals")
      .withIndex("by_user_scope", (q) =>
        q.eq("userId", userId).eq("scope", RECOVERY_SCOPE)
      )
      .collect();
    const dismissedTemplateIds = new Set<string>();
    for (const row of dismissalRows) {
      const expires = Date.parse(row.expiresAt);
      if (Number.isFinite(expires) && expires > nowMs) {
        dismissedTemplateIds.add(row.templateId);
      }
    }

    const ranked = scoreRecoveryRecommendations({
      subScores7d,
      activeHabitImpacts: activeImpacts,
      dismissedTemplateIds,
      activeTemplateIds: excludeIds,
      candidates: candidatePool,
    });

    return {
      generatedAt: isoTs(now),
      generatedForDay: today,
      windowFrom: from,
      windowTo: today,
      subScores7d,
      recommendations: ranked.slice(0, TOP_N),
      alreadyInPlace: activeRecoveryHabits,
    };
  },
});

// ─── Mutations ───────────────────────────────────────────────────────────────

/**
 * Dismiss a recommendation for 7 days. If a dismissal already exists for the
 * same (user, scope, templateId), we patch its expiry forward rather than
 * inserting a duplicate so the table stays small.
 */
export const dismissRecoveryRecommendation = mutation({
  args: { templateId: v.string() },
  handler: async (ctx, { templateId }) => {
    const userId = await getAuthUserId(ctx);
    const now = new Date();
    const dismissedAt = isoTs(now);
    const expiresAt = isoTs(new Date(now.getTime() + DISMISS_TTL_MS));

    const existing = await ctx.db
      .query("recommendationDismissals")
      .withIndex("by_user_scope_template", (q) =>
        q
          .eq("userId", userId)
          .eq("scope", RECOVERY_SCOPE)
          .eq("templateId", templateId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { dismissedAt, expiresAt });
      return { dismissed: true, expiresAt };
    }

    await ctx.db.insert("recommendationDismissals", {
      userId,
      scope: RECOVERY_SCOPE,
      templateId,
      dismissedAt,
      expiresAt,
    });
    return { dismissed: true, expiresAt };
  },
});
