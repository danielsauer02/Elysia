import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "pull active wearable providers",
  { minutes: 15 },
  internal.integrationsScheduler.pullAllProviders
);

crons.daily(
  "generate daily insights",
  { hourUTC: 4, minuteUTC: 0 },
  internal.insights.generateDailyInsights
);

/**
 * Nightly refresh of `userBaselines` (14-day rolling medians) plus a
 * follow-up recompute of today's pillar scores and aging trajectory for
 * every user that just transitioned from calibrating -> ready.
 * Spec: docs/analytics/scoring-model-v1.md §5.
 */
crons.daily(
  "refresh user baselines",
  { hourUTC: 3, minuteUTC: 30 },
  internal.scoring.refreshAllBaselines
);

export default crons;
