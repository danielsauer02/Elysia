import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "./_helpers";

export const getDashboardSummary = query({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    const userId = await getAuthUserId(ctx);

    const [habits, completions, profile] = await Promise.all([
      ctx.db
        .query("habits")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("habitCompletions")
        .withIndex("by_user_date", (q) =>
          q.eq("userId", userId).eq("completedDate", today)
        )
        .collect(),
      ctx.db
        .query("profiles")
        .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", userId))
        .unique(),
    ]);

    const completedIds = new Set(completions.map((c) => c.habitId));
    const activeHabits = habits.filter((h) => h.state === "active");
    const completedCount = activeHabits.filter((h) =>
      completedIds.has(h._id)
    ).length;

    return {
      profile: profile
        ? {
            name: profile.name,
            weightKg: profile.weightKg,
            dateOfBirth: profile.dateOfBirth,
          }
        : null,
      habitSummary: {
        total: activeHabits.length,
        completedToday: completedCount,
        completionRate:
          activeHabits.length > 0
            ? Math.round((completedCount / activeHabits.length) * 100)
            : 0,
      },
      tiles: [
        {
          tileId: "habit_consistency",
          title: "Habit Consistency",
          status: "active",
          insight: `${completedCount}/${activeHabits.length} completed today`,
        },
        {
          tileId: "wearable_recovery",
          title: "Recovery & Sleep",
          status: "placeholder_connect",
        },
        {
          tileId: "diagnostics_slot",
          title: "Diagnostics",
          status: "placeholder_coming_soon",
        },
      ],
    };
  },
});
