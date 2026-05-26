import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "./_helpers";

export const getGoal = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    return await ctx.db
      .query("nutritionGoals")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const getTodayFoodLog = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const userId = await getAuthUserId(ctx);
    return await ctx.db
      .query("foodLog")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).eq("loggedDate", date)
      )
      .order("desc")
      .collect();
  },
});

export const getWeightLog = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    const entries = await ctx.db
      .query("weightLog")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    return limit ? entries.slice(0, limit) : entries;
  },
});

export const upsertGoal = mutation({
  args: {
    goalType: v.string(),
    weeklyChangeKg: v.number(),
    activityLevel: v.string(),
    dietaryApproach: v.string(),
    calorieTarget: v.number(),
    proteinG: v.number(),
    carbsG: v.number(),
    fatG: v.number(),
    tdee: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const existing = await ctx.db
      .query("nutritionGoals")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const data = {
      userId,
      goalType: args.goalType,
      weeklyChangeKg: args.weeklyChangeKg,
      activityLevel: args.activityLevel,
      dietaryApproach: args.dietaryApproach,
      calorieTarget: args.calorieTarget,
      proteinG: args.proteinG,
      carbsG: args.carbsG,
      fatG: args.fatG,
      tdee: args.tdee,
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }
    return await ctx.db.insert("nutritionGoals", data);
  },
});

export const clearGoal = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const existing = await ctx.db
      .query("nutritionGoals")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const addFoodEntry = mutation({
  args: {
    name: v.string(),
    brand: v.optional(v.string()),
    mealType: v.string(),
    calories: v.number(),
    proteinG: v.number(),
    carbsG: v.number(),
    fatG: v.number(),
    quantity: v.number(),
    unit: v.string(),
    barcode: v.optional(v.string()),
    loggedDate: v.string(),
    recipeId: v.optional(v.id("recipes")),
    photoId: v.optional(v.id("foodPhotos")),
    confidence: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const id = await ctx.db.insert("foodLog", {
      userId,
      ...args,
    });
    await ctx.runMutation(internal.habits.autoCompleteFromFoodInternal, {
      userId,
      day: args.loggedDate,
      foodName: args.name,
      quantity: args.quantity,
    });
    await ctx.scheduler.runAfter(0, internal.analytics.recomputeAnalyticsForDay, {
      userId,
      day: args.loggedDate,
    });
    return id;
  },
});

// ─── Phase 3: Recipes ────────────────────────────────────────────────────────

export const listRecipes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    return await ctx.db
      .query("recipes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const addRecipe = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    servings: v.number(),
    ingredients: v.array(
      v.object({
        name: v.string(),
        quantity: v.number(),
        unit: v.string(),
        calories: v.number(),
        proteinG: v.number(),
        carbsG: v.number(),
        fatG: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const totals = args.ingredients.reduce(
      (acc, i) => ({
        calories: acc.calories + i.calories,
        proteinG: acc.proteinG + i.proteinG,
        carbsG: acc.carbsG + i.carbsG,
        fatG: acc.fatG + i.fatG,
      }),
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    );
    const perServing = {
      calories: Math.round(totals.calories / args.servings),
      proteinG: Math.round(totals.proteinG / args.servings),
      carbsG: Math.round(totals.carbsG / args.servings),
      fatG: Math.round(totals.fatG / args.servings),
    };
    return await ctx.db.insert("recipes", {
      userId,
      name: args.name,
      description: args.description,
      servings: args.servings,
      ingredients: args.ingredients,
      totals: perServing,
      isPublicTemplate: false,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const deleteRecipe = mutation({
  args: { id: v.id("recipes") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    const r = await ctx.db.get(id);
    if (!r || r.userId !== userId) throw new Error("Recipe not found");
    await ctx.db.delete(id);
  },
});

export const logFromRecipe = mutation({
  args: {
    recipeId: v.id("recipes"),
    servings: v.number(),
    mealType: v.string(),
    loggedDate: v.string(),
  },
  handler: async (ctx, { recipeId, servings, mealType, loggedDate }) => {
    const userId = await getAuthUserId(ctx);
    const recipe = await ctx.db.get(recipeId);
    if (!recipe || recipe.userId !== userId) throw new Error("Recipe not found");
    const totals = recipe.totals;
    const id = await ctx.db.insert("foodLog", {
      userId,
      name: recipe.name,
      mealType,
      calories: Math.round(totals.calories * servings),
      proteinG: Math.round(totals.proteinG * servings),
      carbsG: Math.round(totals.carbsG * servings),
      fatG: Math.round(totals.fatG * servings),
      quantity: servings,
      unit: "serving",
      loggedDate,
      recipeId,
    });
    await ctx.runMutation(internal.habits.autoCompleteFromFoodInternal, {
      userId,
      day: loggedDate,
      foodName: recipe.name,
      quantity: servings,
    });
    await ctx.scheduler.runAfter(0, internal.analytics.recomputeAnalyticsForDay, {
      userId,
      day: loggedDate,
    });
    return id;
  },
});

// ─── Phase 3: Meal templates ─────────────────────────────────────────────────

export const listTemplates = query({
  args: { mealType: v.optional(v.string()) },
  handler: async (ctx, { mealType }) => {
    const userId = await getAuthUserId(ctx);
    let q = ctx.db.query("mealTemplates").withIndex("by_user", (q) => q.eq("userId", userId));
    const all = await q.collect();
    return mealType ? all.filter((t) => t.mealType === mealType) : all;
  },
});

export const addTemplate = mutation({
  args: {
    name: v.string(),
    mealType: v.string(),
    items: v.array(
      v.object({
        name: v.string(),
        brand: v.optional(v.string()),
        calories: v.number(),
        proteinG: v.number(),
        carbsG: v.number(),
        fatG: v.number(),
        quantity: v.number(),
        unit: v.string(),
        recipeId: v.optional(v.id("recipes")),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    return await ctx.db.insert("mealTemplates", {
      userId,
      name: args.name,
      mealType: args.mealType,
      items: args.items,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const logFromTemplate = mutation({
  args: { templateId: v.id("mealTemplates"), loggedDate: v.string() },
  handler: async (ctx, { templateId, loggedDate }) => {
    const userId = await getAuthUserId(ctx);
    const tpl = await ctx.db.get(templateId);
    if (!tpl || tpl.userId !== userId) throw new Error("Template not found");
    const ids: string[] = [];
    for (const item of tpl.items) {
      const id = await ctx.db.insert("foodLog", {
        userId,
        name: item.name,
        brand: item.brand,
        mealType: tpl.mealType,
        calories: item.calories,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
        quantity: item.quantity,
        unit: item.unit,
        loggedDate,
        recipeId: item.recipeId,
      });
      ids.push(id);
      await ctx.runMutation(internal.habits.autoCompleteFromFoodInternal, {
        userId,
        day: loggedDate,
        foodName: item.name,
        quantity: item.quantity,
      });
    }
    await ctx.scheduler.runAfter(0, internal.analytics.recomputeAnalyticsForDay, {
      userId,
      day: loggedDate,
    });
    return ids;
  },
});

// ─── Phase 3: Smart suggestions ──────────────────────────────────────────────

export const recentFoods = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const userId = await getAuthUserId(ctx);
    const rows = await ctx.db
      .query("foodLog")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);
    const seen = new Set<string>();
    const out: typeof rows = [];
    for (const r of rows) {
      const key = `${r.name.toLowerCase()}::${r.brand?.toLowerCase() ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
      if (out.length >= (limit ?? 20)) break;
    }
    return out;
  },
});

export const frequentByMealtime = query({
  args: { mealType: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { mealType, limit }) => {
    const userId = await getAuthUserId(ctx);
    const rows = await ctx.db
      .query("foodLog")
      .withIndex("by_user_meal", (q) => q.eq("userId", userId).eq("mealType", mealType))
      .order("desc")
      .take(500);
    const counts = new Map<string, { entry: (typeof rows)[number]; count: number }>();
    for (const r of rows) {
      const key = `${r.name.toLowerCase()}::${r.brand?.toLowerCase() ?? ""}`;
      const c = counts.get(key);
      if (c) {
        c.count += 1;
      } else {
        counts.set(key, { entry: r, count: 1 });
      }
    }
    const top = [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, limit ?? 10)
      .map(({ entry, count }) => ({ ...entry, frequency: count }));
    return top;
  },
});

export const removeFoodEntry = mutation({
  args: { id: v.id("foodLog") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    const entry = await ctx.db.get(id);
    if (!entry || entry.userId !== userId) {
      throw new Error("Food entry not found");
    }
    const day = entry.loggedDate;
    await ctx.db.delete(id);
    await ctx.scheduler.runAfter(0, internal.analytics.recomputeAnalyticsForDay, {
      userId,
      day,
    });
  },
});

export const logWeight = mutation({
  args: {
    weightKg: v.number(),
    loggedDate: v.string(),
  },
  handler: async (ctx, { weightKg, loggedDate }) => {
    const userId = await getAuthUserId(ctx);
    const existing = await ctx.db
      .query("weightLog")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", userId).eq("loggedDate", loggedDate)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { weightKg });
      return existing._id;
    }
    return await ctx.db.insert("weightLog", {
      userId,
      weightKg,
      loggedDate,
    });
  },
});
