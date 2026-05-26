import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "./_helpers";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", userId))
      .unique();
    return profile ?? null;
  },
});

export const getEmailInfo = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", userId))
      .unique();
    return {
      email: profile?.email ?? null,
      emailChangedAt: profile?.emailChangedAt ?? null,
    };
  },
});

export const upsertProfile = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    heightCm: v.optional(v.number()),
    weightKg: v.optional(v.number()),
    goals: v.optional(v.array(v.string())),
    wearables: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", userId))
      .unique();

    const now = new Date().toISOString();

    if (existing) {
      const updates: Record<string, unknown> = { updatedAt: now };
      if (args.name !== undefined) updates.name = args.name;
      if (args.email !== undefined) updates.email = args.email;
      if (args.dateOfBirth !== undefined) updates.dateOfBirth = args.dateOfBirth;
      if (args.heightCm !== undefined) updates.heightCm = args.heightCm;
      if (args.weightKg !== undefined) updates.weightKg = args.weightKg;
      if (args.goals !== undefined) updates.goals = args.goals;
      if (args.wearables !== undefined) updates.wearables = args.wearables;

      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }

    return await ctx.db.insert("profiles", {
      clerkUserId: userId,
      name: args.name,
      email: args.email,
      dateOfBirth: args.dateOfBirth,
      heightCm: args.heightCm,
      weightKg: args.weightKg,
      goals: args.goals ?? [],
      wearables: args.wearables ?? [],
      updatedAt: now,
    });
  },
});

export const updateEmail = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const userId = await getAuthUserId(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", userId))
      .unique();
    if (!profile) throw new Error("Profile not found");

    if (profile.emailChangedAt) {
      const elapsed = Date.now() - new Date(profile.emailChangedAt).getTime();
      if (elapsed < SEVEN_DAYS_MS) {
        const remaining = Math.ceil(
          (SEVEN_DAYS_MS - elapsed) / (24 * 60 * 60 * 1000),
        );
        throw new Error(
          `Only allowed to change account settings every 7 days. Wait ${remaining} day${remaining === 1 ? "" : "s"}.`,
        );
      }
    }

    await ctx.db.patch(profile._id, {
      email,
      emailChangedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  },
});
