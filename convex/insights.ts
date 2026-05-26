/**
 * AI-generated insights pipeline. Nightly action that scans the user's
 * recent metrics + nutrition + recovery data and writes coaching cards
 * into the `insights` table for the dashboard feed.
 *
 * Phase 5 fills out the heuristics + LLM call. This stub is wired into the
 * crons schedule so the generator can be implemented incrementally.
 */

import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
  mutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "./_helpers";

const RECENT_DAYS = 7;

export const generateDailyInsights = internalAction({
  handler: async (ctx) => {
    const users = (await ctx.runQuery(internal.insights.listAllUserIdsInternal, {})) as string[];
    let written = 0;
    for (const userId of users) {
      try {
        const ins = await ctx.runQuery(internal.insights.computeInsightsForUserInternal, {
          userId,
        });
        if (ins.length === 0) continue;
        await ctx.runMutation(internal.insights.insertInsightsInternal, {
          userId,
          insights: ins,
        });
        written += ins.length;
      } catch {
        // best-effort - one user's failure shouldn't stop the batch
      }
    }
    return { written };
  },
});

export const listAllUserIdsInternal = internalQuery({
  handler: async (ctx): Promise<string[]> => {
    const profiles = await ctx.db.query("profiles").collect();
    return profiles.map((p) => p.clerkUserId);
  },
});

/**
 * Pure heuristic insight generation - no LLM. Looks at the most recent
 * energyBalanceDaily + wearableDailyMetrics row and produces 0..3 cards.
 */
export const computeInsightsForUserInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }): Promise<InsightInput[]> => {
    const today = new Date().toISOString().slice(0, 10);
    const cutoff = new Date(Date.now() - RECENT_DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const energy = await ctx.db
      .query("energyBalanceDaily")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", cutoff).lte("day", today)
      )
      .collect();
    const wearable = await ctx.db
      .query("wearableDailyMetrics")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", cutoff).lte("day", today)
      )
      .collect();

    // 28d window of pillar scores for correlation insights.
    const corrCutoff = new Date(Date.now() - 27 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const scoreHistory = await ctx.db
      .query("dailyHealthScores")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", corrCutoff).lte("day", today)
      )
      .collect();

    const todayEnergy = energy.find((e) => e.day === today);
    const todayWearable = wearable.find((w) => w.day === today);
    const heuristic = buildHeuristicInsights({
      day: today,
      todayEnergy,
      todayWearable,
      pastEnergy: energy,
      pastWearable: wearable,
    });
    const correlation = buildCorrelationInsights(today, scoreHistory);
    return [...heuristic, ...correlation];
  },
});

export const insertInsightsInternal = internalMutation({
  args: {
    userId: v.string(),
    insights: v.array(
      v.object({
        day: v.string(),
        category: v.string(),
        severity: v.string(),
        title: v.string(),
        body: v.string(),
        action: v.optional(
          v.object({
            kind: v.string(),
            label: v.string(),
            payload: v.optional(v.any()),
          })
        ),
      })
    ),
  },
  handler: async (ctx, { userId, insights }) => {
    const now = new Date().toISOString();
    for (const ins of insights) {
      const existing = await ctx.db
        .query("insights")
        .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", ins.day))
        .filter((q) =>
          q.and(q.eq(q.field("category"), ins.category), q.eq(q.field("title"), ins.title))
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { body: ins.body, severity: ins.severity, action: ins.action });
        continue;
      }
      await ctx.db.insert("insights", {
        userId,
        day: ins.day,
        category: ins.category,
        severity: ins.severity,
        title: ins.title,
        body: ins.body,
        action: ins.action,
        createdAt: now,
      });
    }
  },
});

export const listMyInsights = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    const rows = await ctx.db
      .query("insights")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit ?? 20);
    return rows.filter((r) => !r.dismissedAt);
  },
});

export const dismissInsight = mutation({
  args: { insightId: v.id("insights") },
  handler: async (ctx, { insightId }) => {
    const userId = await getAuthUserId(ctx);
    const ins = await ctx.db.get(insightId);
    if (!ins || ins.userId !== userId) return;
    await ctx.db.patch(insightId, { dismissedAt: new Date().toISOString() });
  },
});

export const generateForMyselfNow = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const ins = (await ctx.runQuery(
      internal.insights.computeInsightsForUserInternal,
      { userId }
    )) as InsightInput[];
    if (ins.length > 0) {
      await ctx.runMutation(internal.insights.insertInsightsInternal, {
        userId,
        insights: ins,
      });
    }
    return { generated: ins.length };
  },
});

// ─── Pure heuristics (testable) ─────────────────────────────────────────────

export type InsightInput = {
  day: string;
  category: string;
  severity: string;
  title: string;
  body: string;
  action?: { kind: string; label: string; payload?: unknown };
};

type EnergyRow = {
  day: string;
  intakeKcal?: number;
  tdeeEstimate?: number;
  balanceKcal?: number;
  proteinG?: number;
  proteinPerKg?: number;
  recoveryProxy?: number;
  trainingLoad?: number;
};

type WearableRow = {
  day: string;
  steps?: number;
  sleepMinutes?: number;
  hrvAvgMs?: number;
  restingHrBpm?: number;
};

export function buildHeuristicInsights(args: {
  day: string;
  todayEnergy?: EnergyRow;
  todayWearable?: WearableRow;
  pastEnergy: EnergyRow[];
  pastWearable: WearableRow[];
}): InsightInput[] {
  const out: InsightInput[] = [];
  const { day, todayEnergy, todayWearable } = args;

  const recovery = todayEnergy?.recoveryProxy;
  if (typeof recovery === "number") {
    if (recovery < 50) {
      out.push({
        day,
        category: "recovery",
        severity: "warning",
        title: "Recovery is low today",
        body:
          "Your HRV, resting HR or sleep is below baseline. Consider an easy day, hydration and an earlier bedtime tonight.",
      });
    } else if (recovery >= 80) {
      out.push({
        day,
        category: "recovery",
        severity: "positive",
        title: "Strong recovery",
        body:
          "Your body is primed for a hard session today. Use it on something high quality before another easy day.",
      });
    }
  }

  const balance = todayEnergy?.balanceKcal;
  if (typeof balance === "number" && balance < -700) {
    out.push({
      day,
      category: "nutrition",
      severity: "warning",
      title: "Aggressive deficit",
      body: `You're ${Math.abs(Math.round(balance))} kcal under TDEE today. Long-term that risks lean mass; aim closer to 300-500 kcal.`,
    });
  }
  if (typeof balance === "number" && balance > 700) {
    out.push({
      day,
      category: "nutrition",
      severity: "warning",
      title: "Surplus today",
      body: `You're ${Math.round(balance)} kcal above TDEE. Fine for a building phase; revisit weekly average.`,
    });
  }

  const proteinPerKg = todayEnergy?.proteinPerKg;
  if (typeof proteinPerKg === "number" && proteinPerKg < 1.4) {
    out.push({
      day,
      category: "nutrition",
      severity: "warning",
      title: "Protein under target",
      body: `Only ${proteinPerKg.toFixed(1)} g/kg today. Aim for 1.6-2.0 g/kg to protect muscle.`,
    });
  }

  const sleep = todayWearable?.sleepMinutes;
  if (typeof sleep === "number" && sleep > 0 && sleep < 6 * 60) {
    out.push({
      day,
      category: "sleep",
      severity: "warning",
      title: "Sleep was short",
      body: `${Math.round(sleep / 60)}h logged. Plan a wind-down 30 min earlier tonight to bank recovery.`,
    });
  }

  return out;
}

/**
 * Generate pair-wise Pearson correlation insights between pillars.
 * Only reports |r| >= 0.5 with at least 7 paired days so we never surface
 * spurious noise during early-life data.
 */
export function buildCorrelationInsights(
  day: string,
  history: { day: string; pillarScores: Record<string, number | null> }[]
): InsightInput[] {
  if (history.length < 7) return [];
  const pillars = ["sleep", "recovery", "activity", "nutrition"] as const;
  const seen = new Set<string>();
  const out: InsightInput[] = [];

  for (let i = 0; i < pillars.length; i++) {
    for (let j = i + 1; j < pillars.length; j++) {
      const a = pillars[i]!;
      const b = pillars[j]!;
      const key = `${a}|${b}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const pairs = history
        .map((row) => {
          const xs = row.pillarScores[a];
          const ys = row.pillarScores[b];
          return xs !== null && ys !== null && xs !== undefined && ys !== undefined
            ? ([xs, ys] as const)
            : null;
        })
        .filter((p): p is readonly [number, number] => p !== null);
      if (pairs.length < 7) continue;

      const r = pearsonCorrelation(
        pairs.map((p) => p[0]),
        pairs.map((p) => p[1])
      );
      if (r === null || Math.abs(r) < 0.5) continue;

      const direction = r > 0 ? "tends to lift" : "tends to drag down";
      out.push({
        day,
        category: "insight",
        severity: r > 0 ? "positive" : "warning",
        title: `${cap(a)} ${direction} ${cap(b)}`,
        body: `Over the last ${pairs.length} days your ${a} score ${direction} your ${b} score (r=${r.toFixed(
          2
        )}). Lean into ${a} to compound the effect.`,
      });
    }
  }
  return out;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i]! - mx;
    const b = ys[i]! - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  if (denom === 0) return null;
  return num / denom;
}
