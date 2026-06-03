/**
 * Recovery Recommendations — deterministic, per-user ranking of Elysia habit
 * cards by how much "Recovery Fitness Score" upside they can realistically
 * unlock for THIS user over the next 7 days.
 *
 * Why deterministic and not LLM-based: every ingredient is already measured
 * (Whoop-style recovery sub-scores, Recovery Fitness weights, the user's
 * active habit coverage). Keeping the ranker pure makes it unit-testable,
 * cheap to run on every recovery query, and trivially reproducible if a user
 * asks "why is this on top?".
 *
 * Model
 * -----
 *   Efficiency is anchored to the SUB-KPI, not to the whole Recovery Fitness
 *   Score. A habit that fully fixes the single most-important *and* weakest
 *   sub-score can therefore reach ~100, instead of being capped at that
 *   metric's ~25–40 % contribution to the composite. This matches how a user
 *   reasons ("my sleep is wrecked, so a great sleep habit is highly efficient
 *   for me") and avoids every card collapsing into the 8–20 band.
 *
 *   relWeight_m = weight_m / max(weight)    → hrv 1.0, rhr 0.625, sleep 0.625,
 *                                              resp 0.25  (HRV is the anchor)
 *
 *   For each metric m in {hrv, rhr, resp, sleep}:
 *     gap_m      = (100 - subScore_m) / 100                    in [0, 1]
 *     headroom_m = relWeight_m * gap_m                         in [0, 1]
 *     coverage_m = clamp(sum(activeHabitImpact_m / 3), 0..1)   in [0, 1]
 *     adj_m      = headroom_m * (1 - alpha * coverage_m)
 *
 *   For each habit h with metricImpacts s_m in 0..3:
 *     raw_h      = sum_m (s_m / 3) * adj_m
 *
 *   Efficiency is then RELATIVE to the best-matched card in today's pool:
 *     efficiency = clamp(round(100 * (raw_h / max_h(raw))^0.7), 0, 100)
 *
 *   Anchoring to the pool's best lever is deliberate: a user with merely decent
 *   sub-scores still has a "most efficient next habit", and that should read as
 *   high (near 100) with the rest spread beneath it — an absolute mapping
 *   compresses everything into the low tens and makes every card look pointless.
 *   The 0.7 exponent is a concave curve that keeps mid-tier picks visible. The
 *   transform is strictly monotonic in raw, so ranking is unchanged. When the
 *   user has no headroom at all (max raw ≈ 0) every card scores 0.
 *
 *   Reasons are the top one-or-two metrics with non-zero contribution, mapped
 *   to short human-readable phrases ("Targets your low HRV").
 *
 * Weights mirror `recoveryFitness.ts` (HRV 0.40, RHR 0.25, sleep 0.25, resp
 * 0.10) — keep them in sync if the underlying score model changes.
 */

import { RECOVERY_FITNESS_WEIGHTS } from "./recoveryFitness";

// ─── Metric model ────────────────────────────────────────────────────────────

export type RecoveryMetric = "hrv" | "rhr" | "resp" | "sleep";

/** Strength of a habit's impact on a single metric, ordinal 0..3. */
export type HabitImpactStrength = 0 | 1 | 2 | 3;

export interface HabitMetricImpacts {
  hrv?: HabitImpactStrength;
  rhr?: HabitImpactStrength;
  resp?: HabitImpactStrength;
  sleep?: HabitImpactStrength;
}

export interface HabitTag {
  /** Mobile catalog templateId — same UUID used by `mockTemplates`. */
  templateId: string;
  /** ProtocolTemplate.category, kept for filtering. */
  category: string;
  /** Per-metric impact strengths. Omitted metrics are treated as 0. */
  metricImpacts: HabitMetricImpacts;
}

const MAX_STRENGTH = 3;

/**
 * How aggressively to discount headroom for metrics already covered by an
 * active habit. 0 = no discount (just rank by raw headroom), 1 = a fully
 * covered metric contributes nothing. 0.6 keeps already-good habits visible
 * without ranking duplicates first.
 */
const COVERAGE_ALPHA = 0.6;

// ─── Catalog of recovery-relevant habits ─────────────────────────────────────

/**
 * The scoring source of truth. Every templateId here MUST exist in the
 * mobile `mockTemplates` catalog (apps/mobile/src/mocks/data.ts), otherwise
 * the recommendation will dangle on the client.
 *
 * Strengths were calibrated from the references attached to each card:
 *   3 = direct, primary mechanism (e.g. breathing → HRV)
 *   2 = strong indirect (e.g. sauna → RHR via cardiovascular adaptation)
 *   1 = supporting / second-order
 *
 * Categories included: recovery, sleep, stress, cold_exposure, meditation,
 * mobility, training, nutrition, supplementation. Categories without a clear
 * recovery mechanism (skincare, preventive, productivity) are excluded so they
 * never surface in the recovery recommendation stack.
 */
export const RECOVERY_HABIT_TAGS: HabitTag[] = [
  // ─── Existing templates ────────────────────────────────────────────────────
  {
    templateId: "5f3ed6cc-0452-4bcf-b888-b5f9c863455f", // morning-sunlight-routine
    category: "sleep",
    metricImpacts: { sleep: 3, hrv: 1 },
  },
  {
    templateId: "c0d59f5c-82f8-4afb-aeb0-4cf3c59d39b5", // sauna-heat-exposure-protocol
    category: "recovery",
    metricImpacts: { rhr: 3, hrv: 2, resp: 1 },
  },
  {
    templateId: "d4e5f6a7-b8c9-0123-defa-234567890123", // cold-shower-protocol
    category: "cold_exposure",
    metricImpacts: { hrv: 2, rhr: 1 },
  },
  {
    templateId: "e5f6a7b8-c9d0-1234-efab-345678901234", // box-breathing-practice
    category: "meditation",
    metricImpacts: { hrv: 3, rhr: 2, resp: 2 },
  },
  {
    templateId: "a7b8c9d0-e1f2-3456-abcd-567890123456", // hip-thoracic-mobility
    category: "mobility",
    metricImpacts: { sleep: 1, hrv: 1 },
  },
  {
    templateId: "b8c9d0e1-f2a3-4567-bcde-678901234567", // hrv-stress-management
    category: "stress",
    metricImpacts: { hrv: 3, rhr: 2 },
  },
  {
    templateId: "e1f2a3b4-c5d6-7890-efab-901234567890", // sleep-wind-down-protocol
    category: "sleep",
    metricImpacts: { sleep: 3, hrv: 2, rhr: 1 },
  },
  {
    templateId: "f2a3b4c5-d6e7-8901-fabc-012345678901", // zone-2-cardio-protocol
    category: "training",
    metricImpacts: { rhr: 3, hrv: 2 },
  },
  {
    templateId: "c5d6e7f8-a9b0-1234-cdef-345678901234", // ice-bath-cold-immersion
    category: "cold_exposure",
    metricImpacts: { hrv: 3, rhr: 2 },
  },
  {
    templateId: "d6e7f8a9-b0c1-2345-defa-456789012345", // gratitude-journaling
    category: "meditation",
    metricImpacts: { sleep: 2, hrv: 1 },
  },
  {
    templateId: "c3d4e5f6-a7b8-9012-cdef-123456789012", // omega-3-daily-protocol
    category: "supplementation",
    metricImpacts: { hrv: 1, resp: 1 },
  },

  // ─── New recovery-relevant templates added in this feature ────────────────
  {
    templateId: "11111111-1111-4111-8111-111111111111", // magnesium-evening-protocol
    category: "supplementation",
    metricImpacts: { sleep: 3, hrv: 2 },
  },
  {
    templateId: "22222222-2222-4222-8222-222222222222", // caffeine-cutoff-2pm
    category: "sleep",
    metricImpacts: { sleep: 3, hrv: 2, rhr: 1 },
  },
  {
    templateId: "33333333-3333-4333-8333-333333333333", // alcohol-free-weeknights
    category: "recovery",
    metricImpacts: { sleep: 3, hrv: 3, rhr: 2 },
  },
  {
    templateId: "44444444-4444-4444-8444-444444444444", // screen-curfew-90min
    category: "sleep",
    metricImpacts: { sleep: 3, hrv: 1 },
  },
  {
    templateId: "55555555-5555-4555-8555-555555555555", // resonance-breathing-6bpm
    category: "meditation",
    metricImpacts: { hrv: 3, rhr: 2, resp: 3 },
  },
  {
    templateId: "66666666-6666-4666-8666-666666666666", // yoga-nidra-20min
    category: "meditation",
    metricImpacts: { sleep: 2, hrv: 2, rhr: 1 },
  },
  {
    templateId: "77777777-7777-4777-8777-777777777777", // foam-rolling-evening
    category: "mobility",
    metricImpacts: { sleep: 2, hrv: 1 },
  },
  {
    templateId: "88888888-8888-4888-8888-888888888888", // bedroom-cooling-18c
    category: "sleep",
    metricImpacts: { sleep: 3, hrv: 1 },
  },
  {
    templateId: "99999999-9999-4999-8999-999999999999", // post-workout-cooldown
    category: "recovery",
    metricImpacts: { rhr: 2, hrv: 2 },
  },
  {
    templateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", // hydration-baseline
    category: "recovery",
    metricImpacts: { rhr: 2, hrv: 1 },
  },
  {
    templateId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", // forest-walk-decompression
    category: "stress",
    metricImpacts: { hrv: 2, rhr: 2, sleep: 1 },
  },
  {
    templateId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", // consistent-bed-wake-time
    category: "sleep",
    metricImpacts: { sleep: 3, hrv: 2 },
  },
];

/** Categories whose cards can ever surface as a recovery recommendation. */
export const RECOVERY_RELEVANT_CATEGORIES: ReadonlySet<string> = new Set([
  "recovery",
  "sleep",
  "stress",
  "cold_exposure",
  "meditation",
  "mobility",
  "training",
  "nutrition",
  "supplementation",
]);

const TAG_BY_ID: ReadonlyMap<string, HabitMetricImpacts> = new Map(
  RECOVERY_HABIT_TAGS.map((t) => [t.templateId, t.metricImpacts])
);

/**
 * Reasonable per-category metric impacts used when a card has no hand-tuned
 * entry in RECOVERY_HABIT_TAGS. This is what makes the pool future-proof: any
 * NEW library card in a recovery-relevant category is automatically scorable
 * (and therefore recommendable) without a code change. Hand-tuning a card later
 * just means adding it to RECOVERY_HABIT_TAGS for sharper calibration.
 */
export function defaultImpactsForCategory(category: string): HabitMetricImpacts {
  switch (category) {
    case "sleep":
      return { sleep: 3, hrv: 1 };
    case "recovery":
      return { hrv: 2, rhr: 2 };
    case "stress":
      return { hrv: 2, rhr: 1 };
    case "meditation":
      return { hrv: 2, resp: 1 };
    case "cold_exposure":
      return { hrv: 2, rhr: 1 };
    case "mobility":
      return { sleep: 1, hrv: 1 };
    case "training":
      return { rhr: 2, hrv: 1 };
    case "nutrition":
      return { rhr: 1, hrv: 1 };
    case "supplementation":
      return { hrv: 1 };
    default:
      return {};
  }
}

/** Resolve a card's metric impacts: explicit tag first, else category default. */
export function resolveHabitTag(templateId: string, category: string): HabitTag {
  const explicit = TAG_BY_ID.get(templateId);
  return {
    templateId,
    category,
    metricImpacts: explicit ?? defaultImpactsForCategory(category),
  };
}

function totalStrength(m: HabitMetricImpacts): number {
  return (m.hrv ?? 0) + (m.rhr ?? 0) + (m.resp ?? 0) + (m.sleep ?? 0);
}

/**
 * Build the candidate pool from a catalog of `{ templateId, category }` (the
 * mobile `mockTemplates` shape). Keeps only recovery-relevant categories that
 * resolve to a non-zero impact, so every present-and-future card flows into the
 * same ranking automatically. Falls back to the hand-tuned tag list when no
 * catalog is supplied (e.g. older clients / tests).
 */
export function buildCandidatePool(
  catalog?: Array<{ templateId: string; category: string }>
): HabitTag[] {
  if (!catalog || catalog.length === 0) return RECOVERY_HABIT_TAGS;
  const pool: HabitTag[] = [];
  const seen = new Set<string>();
  for (const { templateId, category } of catalog) {
    if (!RECOVERY_RELEVANT_CATEGORIES.has(category)) continue;
    if (seen.has(templateId)) continue;
    const tag = resolveHabitTag(templateId, category);
    if (totalStrength(tag.metricImpacts) <= 0) continue;
    seen.add(templateId);
    pool.push(tag);
  }
  return pool.length > 0 ? pool : RECOVERY_HABIT_TAGS;
}

// ─── Scoring inputs / outputs ────────────────────────────────────────────────

export interface RecoverySubScores {
  hrv: number | null;
  rhr: number | null;
  resp: number | null;
  sleep: number | null;
}

export interface ScoreInput {
  /**
   * 7-day average of each Recovery Fitness sub-score (0..100). Missing means
   * we have no signal — that metric contributes no headroom.
   */
  subScores7d: RecoverySubScores;
  /** Active habits the user already has, as their HabitMetricImpacts. */
  activeHabitImpacts: HabitMetricImpacts[];
  /** templateIds currently inside the user's 7-day dismissal window. */
  dismissedTemplateIds: Set<string>;
  /** templateIds the user has already added as an active or planned habit. */
  activeTemplateIds: Set<string>;
  /** Override the candidate pool — defaults to RECOVERY_HABIT_TAGS. */
  candidates?: HabitTag[];
}

export interface RankedRecommendation {
  templateId: string;
  category: string;
  /** 0..100, higher = bigger predicted upside for this user. */
  efficiency: number;
  /** Short tags for the UI, e.g. ["Targets your low HRV"]. */
  reasons: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function metricLabel(m: RecoveryMetric): string {
  switch (m) {
    case "hrv":
      return "HRV";
    case "rhr":
      return "resting heart rate";
    case "resp":
      return "respiratory rate";
    case "sleep":
      return "sleep score";
  }
}

function reasonForMetric(m: RecoveryMetric, subScore: number | null): string {
  if (subScore === null) return `Could lift your ${metricLabel(m)}`;
  if (subScore < 60) return `Targets your low ${metricLabel(m)}`;
  return `Reinforces your ${metricLabel(m)}`;
}

const METRIC_ORDER: RecoveryMetric[] = ["hrv", "rhr", "resp", "sleep"];

function weightFor(m: RecoveryMetric): number {
  switch (m) {
    case "hrv":
      return RECOVERY_FITNESS_WEIGHTS.hrv;
    case "rhr":
      return RECOVERY_FITNESS_WEIGHTS.rhr;
    case "resp":
      return RECOVERY_FITNESS_WEIGHTS.resp;
    case "sleep":
      return RECOVERY_FITNESS_WEIGHTS.sleep;
  }
}

/**
 * The largest single Recovery Fitness weight (HRV, 0.40). Dividing each weight
 * by this rebases importance so the anchor metric is 1.0 — see the module
 * header. This is what lets a focused habit on a weak, important metric reach a
 * high efficiency rather than being capped at the metric's composite share.
 */
const MAX_WEIGHT = Math.max(
  RECOVERY_FITNESS_WEIGHTS.hrv,
  RECOVERY_FITNESS_WEIGHTS.rhr,
  RECOVERY_FITNESS_WEIGHTS.resp,
  RECOVERY_FITNESS_WEIGHTS.sleep
);

/** Importance of a metric relative to the anchor (HRV = 1.0). */
function relWeightFor(m: RecoveryMetric): number {
  return weightFor(m) / MAX_WEIGHT;
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

// ─── Pure scorer ─────────────────────────────────────────────────────────────

/**
 * Rank `candidates` for the given user signals. Returns the full ranked list
 * (callers slice top-N). Excludes anything in `activeTemplateIds` or
 * `dismissedTemplateIds`. Stable ordering: efficiency desc, then templateId
 * ascending so test fixtures don't flake on ties.
 */
export function scoreRecoveryRecommendations(
  input: ScoreInput
): RankedRecommendation[] {
  const pool = input.candidates ?? RECOVERY_HABIT_TAGS;

  // headroom_m = relWeight_m × (100 - subScore_m) / 100, clamped to [0, relWeight_m].
  // Using relWeight (anchored to HRV = 1.0) instead of the raw composite weight
  // is what allows a focused habit on a weak metric to score high.
  const headroom: Record<RecoveryMetric, number> = {
    hrv: 0,
    rhr: 0,
    resp: 0,
    sleep: 0,
  };
  for (const m of METRIC_ORDER) {
    const v = input.subScores7d[m];
    if (v === null) continue;
    const gap = clamp01((100 - v) / 100);
    headroom[m] = relWeightFor(m) * gap;
  }

  // coverage_m = saturated sum of active impacts on m (each impact already
  // ordinal 0..3, divided by max strength → 0..1)
  const coverage: Record<RecoveryMetric, number> = {
    hrv: 0,
    rhr: 0,
    resp: 0,
    sleep: 0,
  };
  for (const active of input.activeHabitImpacts) {
    for (const m of METRIC_ORDER) {
      const s = active[m] ?? 0;
      if (s > 0) coverage[m] += s / MAX_STRENGTH;
    }
  }
  for (const m of METRIC_ORDER) coverage[m] = clamp01(coverage[m]);

  const adj: Record<RecoveryMetric, number> = {
    hrv: 0,
    rhr: 0,
    resp: 0,
    sleep: 0,
  };
  for (const m of METRIC_ORDER) {
    adj[m] = headroom[m] * (1 - COVERAGE_ALPHA * coverage[m]);
  }

  // First pass: raw sub-KPI alignment for every surviving candidate.
  const scored: Array<{
    habit: HabitTag;
    raw: number;
    contributions: Array<{ m: RecoveryMetric; c: number }>;
  }> = [];
  for (const habit of pool) {
    if (input.activeTemplateIds.has(habit.templateId)) continue;
    if (input.dismissedTemplateIds.has(habit.templateId)) continue;

    const contributions: Array<{ m: RecoveryMetric; c: number }> = [];
    let raw = 0;
    for (const m of METRIC_ORDER) {
      const s = habit.metricImpacts[m] ?? 0;
      if (s === 0) continue;
      const c = (s / MAX_STRENGTH) * adj[m];
      raw += c;
      contributions.push({ m, c });
    }
    scored.push({ habit, raw, contributions });
  }

  // Second pass: normalise efficiency against the strongest lever in today's
  // pool so the best pick reads near 100 and the rest spread beneath it (see
  // header). Monotonic in raw → ranking unchanged. No headroom → all 0.
  const poolMax = scored.reduce((mx, s) => Math.max(mx, s.raw), 0);

  const ranked: RankedRecommendation[] = scored.map(
    ({ habit, raw, contributions }) => {
      const rel = poolMax > 1e-6 ? raw / poolMax : 0;
      const efficiency = Math.max(
        0,
        Math.min(100, Math.round(100 * Math.pow(rel, 0.7)))
      );

      contributions.sort((a, b) => b.c - a.c);
      const reasons = contributions
        .filter((c) => c.c > 0)
        .slice(0, 2)
        .map(({ m }) => reasonForMetric(m, input.subScores7d[m]));

      return {
        templateId: habit.templateId,
        category: habit.category,
        efficiency,
        reasons,
      };
    }
  );

  ranked.sort((a, b) => {
    if (b.efficiency !== a.efficiency) return b.efficiency - a.efficiency;
    return a.templateId.localeCompare(b.templateId);
  });

  return ranked;
}

/**
 * Look up the metric-impact tags for an arbitrary list of template ids. Used
 * to build `activeHabitImpacts` from the user's existing habits — habits with
 * no tag entry are treated as covering no recovery metric.
 */
export function impactsForTemplateIds(
  templateIds: string[],
  candidates: HabitTag[] = RECOVERY_HABIT_TAGS
): HabitMetricImpacts[] {
  const byId = new Map(candidates.map((c) => [c.templateId, c.metricImpacts]));
  const out: HabitMetricImpacts[] = [];
  for (const id of templateIds) {
    const impacts = byId.get(id);
    if (impacts) out.push(impacts);
  }
  return out;
}

/**
 * Metric coverage of the user's active habits, resolved with category fallback
 * (explicit tag → category default). Used so coverage-based diminishing returns
 * work for ANY active recovery habit, not only hand-tuned ones.
 */
export function impactsForActiveHabits(
  habits: Array<{ templateId: string; category: string }>
): HabitMetricImpacts[] {
  return habits
    .map((h) => resolveHabitTag(h.templateId, h.category).metricImpacts)
    .filter((m) => totalStrength(m) > 0);
}
