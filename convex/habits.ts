import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "./_helpers";

export const listHabits = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    return await ctx.db
      .query("habits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const getTodayCompletions = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const userId = await getAuthUserId(ctx);
    const completions = await ctx.db
      .query("habitCompletions")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).eq("completedDate", date)
      )
      .collect();
    return completions.map((c) => c.habitId);
  },
});

export const insertHabit = mutation({
  args: {
    templateId: v.optional(v.string()),
    title: v.string(),
    category: v.string(),
    expectedBenefit: v.string(),
    state: v.string(),
    schedule: v.object({
      frequencyPerWeek: v.number(),
      targetTimesOfDay: v.array(v.string()),
      startsOn: v.string(),
      endsOn: v.optional(v.string()),
    }),
    reminderRule: v.optional(
      v.object({
        reminderTimeLocal: v.string(),
        timezone: v.string(),
        pushEnabled: v.boolean(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    return await ctx.db.insert("habits", {
      userId,
      templateId: args.templateId,
      title: args.title,
      category: args.category,
      expectedBenefit: args.expectedBenefit,
      state: args.state,
      schedule: args.schedule,
      reminderRule: args.reminderRule,
      streakCount: 0,
      completionRate30d: 0,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const updateHabitState = mutation({
  args: {
    habitId: v.id("habits"),
    state: v.string(),
  },
  handler: async (ctx, { habitId, state }) => {
    const userId = await getAuthUserId(ctx);
    const habit = await ctx.db.get(habitId);
    if (!habit || habit.userId !== userId) {
      throw new Error("Habit not found");
    }
    await ctx.db.patch(habitId, {
      state,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const removeHabit = mutation({
  args: { habitId: v.id("habits") },
  handler: async (ctx, { habitId }) => {
    const userId = await getAuthUserId(ctx);
    const habit = await ctx.db.get(habitId);
    if (!habit || habit.userId !== userId) {
      throw new Error("Habit not found");
    }
    const completions = await ctx.db
      .query("habitCompletions")
      .withIndex("by_habit_date", (q) => q.eq("habitId", habitId))
      .collect();
    for (const c of completions) {
      await ctx.db.delete(c._id);
    }
    await ctx.db.delete(habitId);
  },
});

/**
 * Auto-complete any habit whose `linkingRule` matches a food/workout that
 * was just logged. Idempotent on `(habitId, completedDate)` — if the habit
 * is already marked done today, this is a no-op.
 *
 * Returns the list of habit ids that just got auto-completed.
 */
export const autoCompleteFromFoodInternal = internalMutation({
  args: {
    userId: v.string(),
    day: v.string(),
    foodName: v.string(),
    foodCategory: v.optional(v.string()),
    quantity: v.optional(v.number()),
  },
  handler: async (ctx, { userId, day, foodName, foodCategory, quantity }) => {
    const habits = await ctx.db
      .query("habits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const lowerName = foodName.toLowerCase();
    const lowerCat = (foodCategory ?? "").toLowerCase();
    const triggered: string[] = [];
    for (const habit of habits) {
      if (habit.state !== "active") continue;
      const rule = habit.linkingRule;
      if (!rule) continue;
      if (rule.kind !== "food_contains" && rule.kind !== "food_category") continue;
      if (rule.minQuantity !== undefined && (quantity ?? 0) < rule.minQuantity) {
        continue;
      }
      const haystack = rule.kind === "food_category" ? lowerCat : lowerName;
      const matched = rule.patterns.some((p) => haystack.includes(p.toLowerCase()));
      if (!matched) continue;

      const existing = await ctx.db
        .query("habitCompletions")
        .withIndex("by_habit_date", (q) =>
          q.eq("habitId", habit._id).eq("completedDate", day)
        )
        .unique();
      if (existing) continue;

      await ctx.db.insert("habitCompletions", {
        userId,
        habitId: habit._id,
        completedDate: day,
      });
      triggered.push(habit._id);
    }
    return triggered;
  },
});

/** Same idea but for workout/exercise events. */
export const autoCompleteFromWorkoutInternal = internalMutation({
  args: {
    userId: v.string(),
    day: v.string(),
    activityType: v.string(),
  },
  handler: async (ctx, { userId, day, activityType }) => {
    const habits = await ctx.db
      .query("habits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const lowerActivity = activityType.toLowerCase();
    const triggered: string[] = [];
    for (const habit of habits) {
      if (habit.state !== "active") continue;
      const rule = habit.linkingRule;
      if (!rule || rule.kind !== "workout_type") continue;
      const matched = rule.patterns.some((p) =>
        lowerActivity.includes(p.toLowerCase())
      );
      if (!matched) continue;

      const existing = await ctx.db
        .query("habitCompletions")
        .withIndex("by_habit_date", (q) =>
          q.eq("habitId", habit._id).eq("completedDate", day)
        )
        .unique();
      if (existing) continue;

      await ctx.db.insert("habitCompletions", {
        userId,
        habitId: habit._id,
        completedDate: day,
      });
      triggered.push(habit._id);
    }
    return triggered;
  },
});

export const toggleCompletion = mutation({
  args: {
    habitId: v.id("habits"),
    date: v.string(),
  },
  handler: async (ctx, { habitId, date }) => {
    const userId = await getAuthUserId(ctx);
    const habit = await ctx.db.get(habitId);
    if (!habit || habit.userId !== userId) {
      throw new Error("Habit not found");
    }

    const existing = await ctx.db
      .query("habitCompletions")
      .withIndex("by_habit_date", (q) =>
        q.eq("habitId", habitId).eq("completedDate", date)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    }

    await ctx.db.insert("habitCompletions", {
      userId,
      habitId,
      completedDate: date,
    });
    return true;
  },
});
