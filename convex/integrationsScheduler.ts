/**
 * Scheduled cron fan-out (every 2h): for every active provider connection,
 * trigger the corresponding internal pull action so wearable samples stay
 * up to date even when the user is not actively foregrounded.
 *
 * Scheduled pulls intentionally use a short look-back window (SCHEDULED_DAYS_BACK)
 * and only refresh `lastSyncedAt` when new samples land — keeping recurring
 * cron cost (action compute + reactive write amplification) to a minimum.
 * Manual/foreground syncs and the initial OAuth backfill still pull a wider
 * window via their own entry points.
 */

import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

/** Look-back window for recurring scheduled pulls. */
const SCHEDULED_DAYS_BACK = 2;

export const listActiveConnectionsInternal = internalQuery({
  handler: async (ctx) => {
    return await ctx.db
      .query("wearableConnections")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const pullAllProviders = internalAction({
  handler: async (ctx) => {
    const connections = await ctx.runQuery(
      internal.integrationsScheduler.listActiveConnectionsInternal,
      {}
    );

    let scheduled = 0;
    for (const conn of connections as Array<{ userId: string; provider: string }>) {
      const fn = pullActionForProvider(conn.provider);
      if (!fn) continue;
      try {
        await ctx.scheduler.runAfter(0, fn, {
          userId: conn.userId,
          daysBack: SCHEDULED_DAYS_BACK,
          scheduled: true,
        });
        scheduled++;
      } catch {
        // log/ignore - best effort
      }
    }
    return { scheduled };
  },
});

function pullActionForProvider(provider: string) {
  switch (provider) {
    case "whoop":
      return internal.integrations.pullWhoopInternal;
    case "oura":
      return internal.integrations.pullOuraInternal;
    case "fitbit":
      return internal.integrations.pullFitbitInternal;
    default:
      return null;
  }
}
