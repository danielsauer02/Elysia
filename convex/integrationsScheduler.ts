/**
 * 15-min cron scheduling fan-out: for every active provider connection,
 * trigger the corresponding internal pull action so wearable samples stay
 * up to date even when the user is not actively foregrounded.
 */

import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

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
        await ctx.scheduler.runAfter(0, fn, { userId: conn.userId });
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
