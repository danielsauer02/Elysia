/**
 * Per-user UI preferences synced across devices.
 *
 * Currently exposes the `dashboardTileIds` ordered list backing the
 * customizable Health Data tile grid on the dashboard. Future fields can
 * extend the same table without further plumbing on the client.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "./_helpers";

/**
 * Allowed tile IDs (must match `apps/mobile/src/components/dashboard/healthTiles.ts`).
 * Duplicated here to keep the backend self-contained and to reject malformed
 * client writes early.
 */
const KNOWN_TILE_IDS = new Set<string>([
  "hrv",
  "restingHr",
  "steps",
  "activeKcal",
  "sleepTotal",
  "restorativeSleep",
  "sleepConsistency",
  "sleepEfficiency",
  "respiratoryRate",
  "sleepDeep",
  "sleepRem",
  "sleepLight",
  "skinTemperature",
  "strain",
]);

const MAX_DASHBOARD_TILES = 24;

export const getMyPreferences = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const row = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!row) return { dashboardTileIds: null as string[] | null };
    return { dashboardTileIds: row.dashboardTileIds ?? null };
  },
});

export const setDashboardTiles = mutation({
  args: { tileIds: v.array(v.string()) },
  handler: async (ctx, { tileIds }) => {
    const userId = await getAuthUserId(ctx);

    // Validate, dedupe, cap.
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const id of tileIds) {
      if (!KNOWN_TILE_IDS.has(id)) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      cleaned.push(id);
      if (cleaned.length >= MAX_DASHBOARD_TILES) break;
    }

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const now = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, {
        dashboardTileIds: cleaned,
        updatedAt: now,
      });
      return { ok: true, dashboardTileIds: cleaned };
    }
    await ctx.db.insert("userPreferences", {
      userId,
      dashboardTileIds: cleaned,
      updatedAt: now,
    });
    return { ok: true, dashboardTileIds: cleaned };
  },
});
