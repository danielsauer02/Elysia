import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "./_helpers";
import {
  computeMacroCompliance,
  computeRecoveryProxy,
  estimateTdee,
  isoDay,
  pearson,
} from "./analyticsCore";

/**
 * Phase 4 entry point. Recomputes the energy balance + macro compliance + recovery
 * proxy for one day. Writes to the energyBalanceDaily table. Triggered after each
 * wearable rollup or food log change.
 *
 * The full implementation lives below; this top-level action is the public hook
 * referenced by other modules (wearables.rollupDay, nutrition write paths).
 */
export const recomputeAnalyticsForDay = internalAction({
  args: { userId: v.string(), day: v.string() },
  handler: async (ctx, { userId, day }) => {
    const profile = await ctx.runQuery(internal.analytics.getProfileInternal, { userId });
    const goal = await ctx.runQuery(internal.analytics.getNutritionGoalInternal, { userId });
    const food = await ctx.runQuery(internal.analytics.getFoodForDayInternal, {
      userId,
      day,
    });
    const wearable = await ctx.runQuery(internal.analytics.getDailyWearableInternal, {
      userId,
      day,
    });

    type FoodRow = {
      calories: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
    };
    const intake = (food as FoodRow[]).reduce(
      (acc: { kcal: number; proteinG: number; carbsG: number; fatG: number }, row: FoodRow) => ({
        kcal: acc.kcal + row.calories,
        proteinG: acc.proteinG + row.proteinG,
        carbsG: acc.carbsG + row.carbsG,
        fatG: acc.fatG + row.fatG,
      }),
      { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    );

    const tdee = estimateTdee({
      sex: profile?.sex ?? null,
      heightCm: profile?.heightCm ?? null,
      weightKg: profile?.weightKg ?? null,
      dateOfBirth: profile?.dateOfBirth ?? null,
      activityLevel: goal?.activityLevel ?? null,
      activeKcal: wearable?.activeKcal ?? null,
      workoutKcal: wearable?.workoutKcal ?? null,
      basalKcal: wearable?.basalKcal ?? null,
      totalKcal: wearable?.totalKcal ?? null,
    });

    const proteinPerKg =
      profile?.weightKg && profile.weightKg > 0
        ? intake.proteinG / profile.weightKg
        : null;

    const macroCompliancePct = computeMacroCompliance(
      {
        calorieTarget: goal?.calorieTarget,
        proteinG: goal?.proteinG,
        carbsG: goal?.carbsG,
        fatG: goal?.fatG,
      },
      {
        calories: intake.kcal,
        proteinG: intake.proteinG,
        carbsG: intake.carbsG,
        fatG: intake.fatG,
      }
    );

    const trainingLoad =
      (wearable?.workoutKcal ?? 0) + (wearable?.steps ?? 0) / 100;

    const recoveryProxy = computeRecoveryProxy({
      hrvAvgMs: wearable?.hrvAvgMs ?? null,
      restingHrBpm: wearable?.restingHrBpm ?? null,
      sleepMinutes: wearable?.sleepMinutes ?? null,
    });

    await ctx.runMutation(internal.analytics.writeEnergyBalanceInternal, {
      userId,
      day,
      data: {
        intakeKcal: intake.kcal,
        activeKcal: wearable?.activeKcal,
        basalKcal: wearable?.basalKcal,
        tdeeEstimate: tdee,
        balanceKcal: tdee !== null ? intake.kcal - tdee : undefined,
        proteinG: intake.proteinG,
        proteinPerKg: proteinPerKg ?? undefined,
        macroCompliancePct: macroCompliancePct ?? undefined,
        trainingLoad: trainingLoad > 0 ? trainingLoad : undefined,
        recoveryProxy: recoveryProxy ?? undefined,
      },
    });

    // Layer B: pillar scores + composite. Always runs after the energy
    // balance write so the Nutrition pillar (Phase D) sees up-to-date data.
    await ctx.runAction(internal.scoring.recomputeDailyHealthScores, {
      userId,
      day,
    });

    // Layer C: aging trajectory + per-pillar contributions. No-op while the
    // user is still in the 14-day calibration window.
    await ctx.runAction(internal.scoring.recomputeAgingTrajectory, {
      userId,
      day,
    });
  },
});

// ─── Public read APIs ────────────────────────────────────────────────────────

export const getEnergyBalanceRange = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const userId = await getAuthUserId(ctx);
    const rows = await ctx.db
      .query("energyBalanceDaily")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", from).lte("day", to)
      )
      .collect();
    return rows.sort((a, b) => a.day.localeCompare(b.day));
  },
});

export const getMacroTrend = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const userId = await getAuthUserId(ctx);
    const rows = await ctx.db
      .query("energyBalanceDaily")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", from).lte("day", to)
      )
      .collect();
    return rows.map((r) => ({
      day: r.day,
      proteinG: r.proteinG ?? 0,
      proteinPerKg: r.proteinPerKg ?? 0,
      macroCompliancePct: r.macroCompliancePct ?? 0,
    }));
  },
});

export const getTrainingLoadVsRecovery = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, { from, to }) => {
    const userId = await getAuthUserId(ctx);
    const rows = await ctx.db
      .query("energyBalanceDaily")
      .withIndex("by_user_day", (q) =>
        q.eq("userId", userId).gte("day", from).lte("day", to)
      )
      .collect();
    return rows.map((r) => ({
      day: r.day,
      trainingLoad: r.trainingLoad ?? 0,
      recoveryProxy: r.recoveryProxy ?? 0,
    }));
  },
});

export const getCorrelations = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days }) => {
    const userId = await getAuthUserId(ctx);
    const cutoff = isoDay(new Date(Date.now() - (days ?? 30) * 86_400_000));
    const energy = await ctx.db
      .query("energyBalanceDaily")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).gte("day", cutoff))
      .collect();
    const wearable = await ctx.db
      .query("wearableDailyMetrics")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).gte("day", cutoff))
      .collect();

    const wByDay = new Map(wearable.map((w) => [w.day, w]));

    type Row = {
      day: string;
      balanceKcal: number;
      sleepMinutes: number;
      trainingLoad: number;
      recoveryProxy: number;
      proteinPerKg: number;
    };
    const rows: Row[] = [];
    for (const e of energy) {
      const w = wByDay.get(e.day);
      rows.push({
        day: e.day,
        balanceKcal: e.balanceKcal ?? 0,
        sleepMinutes: w?.sleepMinutes ?? 0,
        trainingLoad: e.trainingLoad ?? 0,
        recoveryProxy: e.recoveryProxy ?? 0,
        proteinPerKg: e.proteinPerKg ?? 0,
      });
    }

    return {
      sampleSize: rows.length,
      sleepVsBalance: pearson(
        rows.map((r) => r.sleepMinutes),
        rows.map((r) => r.balanceKcal)
      ),
      trainingVsRecovery: pearson(
        rows.map((r) => r.trainingLoad),
        rows.map((r) => r.recoveryProxy)
      ),
      proteinVsRecovery: pearson(
        rows.map((r) => r.proteinPerKg),
        rows.map((r) => r.recoveryProxy)
      ),
    };
  },
});

// ─── Internal helpers ────────────────────────────────────────────────────────

export const getProfileInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", userId))
      .unique();
  },
});

export const getNutritionGoalInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("nutritionGoals")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const getFoodForDayInternal = internalQuery({
  args: { userId: v.string(), day: v.string() },
  handler: async (ctx, { userId, day }) => {
    return await ctx.db
      .query("foodLog")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("loggedDate", day))
      .collect();
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

export const writeEnergyBalanceInternal = internalMutation({
  args: { userId: v.string(), day: v.string(), data: v.any() },
  handler: async (ctx, { userId, day, data }) => {
    const existing = await ctx.db
      .query("energyBalanceDaily")
      .withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day))
      .unique();
    const payload = {
      userId,
      day,
      ...(data as Record<string, unknown>),
      updatedAt: new Date().toISOString(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return await ctx.db.insert("energyBalanceDaily", payload);
  },
});

// ─── Pure functions (testable, exported) ─────────────────────────────────────

// Re-exported here so legacy callers keep importing from analytics.ts.
export {
  isoDay,
  ageYears,
  mifflinStJeor,
  estimateTdee,
  computeMacroCompliance,
  computeRecoveryProxy,
  pearson,
} from "./analyticsCore";
