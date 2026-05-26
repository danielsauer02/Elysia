/**
 * Builds the AI coach's user context payload. Aggregates the most recent
 * profile, nutrition, habit, wearable, energy balance and insight data into
 * a compact text summary that the OpenAI action ships as a system message.
 *
 * Token budget: enforced via TARGET_CHAR_BUDGET. Truncates list-style sections
 * (recent foods, insights) before scalar facts.
 */

import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

const TARGET_CHAR_BUDGET = 8000; // ~2k tokens, leaves room for chat history

export type AssistantContextResult = {
  summary: string;
  facts: Record<string, unknown>;
};

export const buildContextForUser = internalQuery({
  args: { userId: v.string(), today: v.string() },
  handler: async (ctx, { userId, today }): Promise<AssistantContextResult> => {
    const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

    const [
      profile,
      goal,
      foodToday,
      foodWeek,
      habits,
      energy,
      wearable,
      latestInsights,
    ] = await Promise.all([
      ctx.db
        .query("profiles")
        .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", userId))
        .unique(),
      ctx.db
        .query("nutritionGoals")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique(),
      ctx.db
        .query("foodLog")
        .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("loggedDate", today))
        .collect(),
      ctx.db
        .query("foodLog")
        .withIndex("by_user_date", (q) =>
          q.eq("userId", userId).gte("loggedDate", cutoff).lte("loggedDate", today)
        )
        .collect(),
      ctx.db
        .query("habits")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("energyBalanceDaily")
        .withIndex("by_user_day", (q) =>
          q.eq("userId", userId).gte("day", cutoff).lte("day", today)
        )
        .collect(),
      ctx.db
        .query("wearableDailyMetrics")
        .withIndex("by_user_day", (q) =>
          q.eq("userId", userId).gte("day", cutoff).lte("day", today)
        )
        .collect(),
      ctx.db
        .query("insights")
        .withIndex("by_user_created", (q) => q.eq("userId", userId))
        .order("desc")
        .take(5),
    ]);

    const todayEnergy = energy.find((e) => e.day === today);
    const todayWearable = wearable.find((w) => w.day === today);

    const intakeToday = foodToday.reduce(
      (acc, f) => ({
        kcal: acc.kcal + f.calories,
        proteinG: acc.proteinG + f.proteinG,
        carbsG: acc.carbsG + f.carbsG,
        fatG: acc.fatG + f.fatG,
      }),
      { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    );

    const avgWeek = (rows: Array<{ balanceKcal?: number }>): number | null => {
      const vals = rows.map((r) => r.balanceKcal ?? 0).filter((v) => Number.isFinite(v));
      if (vals.length === 0) return null;
      return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
    };

    const activeHabits = habits.filter((h) => h.state === "active");
    const facts = {
      profile: profile
        ? {
            name: profile.name,
            sex: profile.sex,
            heightCm: profile.heightCm,
            weightKg: profile.weightKg,
            dateOfBirth: profile.dateOfBirth,
            goals: profile.goals,
            wearables: profile.wearables,
          }
        : null,
      nutritionTargets: goal
        ? {
            calorieTarget: goal.calorieTarget,
            proteinG: goal.proteinG,
            carbsG: goal.carbsG,
            fatG: goal.fatG,
            tdee: goal.tdee,
            goalType: goal.goalType,
            activityLevel: goal.activityLevel,
            dietaryApproach: goal.dietaryApproach,
          }
        : null,
      today: {
        date: today,
        intake: intakeToday,
        energy: todayEnergy
          ? {
              tdeeEstimate: todayEnergy.tdeeEstimate,
              balanceKcal: todayEnergy.balanceKcal,
              proteinPerKg: todayEnergy.proteinPerKg,
              macroCompliancePct: todayEnergy.macroCompliancePct,
              recoveryProxy: todayEnergy.recoveryProxy,
              trainingLoad: todayEnergy.trainingLoad,
            }
          : null,
        wearable: todayWearable
          ? {
              steps: todayWearable.steps,
              activeKcal: todayWearable.activeKcal,
              basalKcal: todayWearable.basalKcal,
              hrAvgBpm: todayWearable.hrAvgBpm,
              restingHrBpm: todayWearable.restingHrBpm,
              hrvAvgMs: todayWearable.hrvAvgMs,
              sleepMinutes: todayWearable.sleepMinutes,
              sleepDeepMinutes: todayWearable.sleepDeepMinutes,
              sleepRemMinutes: todayWearable.sleepRemMinutes,
              spo2AvgPct: todayWearable.spo2AvgPct,
              respiratoryRateAvg: todayWearable.respiratoryRateAvg,
              workoutCount: todayWearable.workoutCount,
              workoutKcal: todayWearable.workoutKcal,
            }
          : null,
      },
      week: {
        avgBalanceKcal: avgWeek(energy),
        days: energy.map((e) => ({
          day: e.day,
          balanceKcal: e.balanceKcal,
          recoveryProxy: e.recoveryProxy,
        })),
      },
      activeHabits: activeHabits.slice(0, 8).map((h) => ({
        title: h.title,
        category: h.category,
        streakCount: h.streakCount,
        completionRate30d: h.completionRate30d,
      })),
      latestInsights: latestInsights.slice(0, 3).map((i) => ({
        category: i.category,
        severity: i.severity,
        title: i.title,
        body: i.body,
      })),
    };

    const summary = renderSummary(facts);
    return { summary: truncateToBudget(summary, TARGET_CHAR_BUDGET), facts };
  },
});

function renderSummary(facts: Record<string, any>): string {
  const lines: string[] = [];
  const p = facts.profile as Record<string, unknown> | null;
  if (p) {
    lines.push(`PROFILE: ${jsonInline(p)}`);
  }
  const t = facts.nutritionTargets;
  if (t) lines.push(`NUTRITION TARGETS: ${jsonInline(t)}`);
  const todayEnergy = facts.today?.energy;
  if (todayEnergy) lines.push(`TODAY ENERGY: ${jsonInline(todayEnergy)}`);
  const todayWearable = facts.today?.wearable;
  if (todayWearable) lines.push(`TODAY WEARABLE: ${jsonInline(todayWearable)}`);
  const intake = facts.today?.intake;
  if (intake) lines.push(`TODAY INTAKE: ${jsonInline(intake)}`);
  const week = facts.week;
  if (week) lines.push(`WEEK: avgBalanceKcal=${week.avgBalanceKcal} days=${jsonInline(week.days)}`);
  const habits = facts.activeHabits as Array<unknown>;
  if (habits?.length) lines.push(`ACTIVE HABITS: ${jsonInline(habits)}`);
  const insights = facts.latestInsights as Array<unknown>;
  if (insights?.length) lines.push(`LATEST INSIGHTS: ${jsonInline(insights)}`);
  return lines.join("\n");
}

function jsonInline(o: unknown): string {
  return JSON.stringify(o);
}

function truncateToBudget(text: string, budget: number): string {
  if (text.length <= budget) return text;
  // Drop list sections from the end first; keep header lines.
  const lines = text.split("\n");
  while (lines.join("\n").length > budget && lines.length > 0) {
    lines.pop();
  }
  return lines.join("\n");
}
