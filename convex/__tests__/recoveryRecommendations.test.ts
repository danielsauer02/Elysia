import { describe, expect, it } from "vitest";
import {
  buildCandidatePool,
  defaultImpactsForCategory,
  impactsForTemplateIds,
  resolveHabitTag,
  scoreRecoveryRecommendations,
  RECOVERY_HABIT_TAGS,
  type HabitTag,
} from "../scoring/recoveryRecommendations";

// Compact fixture pool so tests aren't coupled to the production catalog.
// Strengths are chosen to make each metric the dominant contributor for at
// least one habit, so headroom-driven ranking is observable.
const HRV_HABIT: HabitTag = {
  templateId: "11111111-1111-4111-8111-aaaaaaaaaaaa",
  category: "meditation",
  metricImpacts: { hrv: 3 },
};
const RHR_HABIT: HabitTag = {
  templateId: "22222222-2222-4222-8222-aaaaaaaaaaaa",
  category: "training",
  metricImpacts: { rhr: 3 },
};
const RESP_HABIT: HabitTag = {
  templateId: "33333333-3333-4333-8333-aaaaaaaaaaaa",
  category: "meditation",
  metricImpacts: { resp: 3 },
};
const SLEEP_HABIT: HabitTag = {
  templateId: "44444444-4444-4444-8444-aaaaaaaaaaaa",
  category: "sleep",
  metricImpacts: { sleep: 3 },
};
const MIXED_HABIT: HabitTag = {
  templateId: "55555555-5555-4555-8555-aaaaaaaaaaaa",
  category: "recovery",
  metricImpacts: { hrv: 2, rhr: 2, sleep: 1 },
};

const ALL_FIXTURE = [HRV_HABIT, RHR_HABIT, RESP_HABIT, SLEEP_HABIT, MIXED_HABIT];

describe("scoreRecoveryRecommendations", () => {
  it("ranks the metric with the lowest sub-score first (headroom)", () => {
    // HRV is the weakest sub-score AND has the highest weight (0.40) — the
    // HRV-only habit must come out on top.
    const ranked = scoreRecoveryRecommendations({
      subScores7d: { hrv: 30, rhr: 90, resp: 95, sleep: 85 },
      activeHabitImpacts: [],
      dismissedTemplateIds: new Set(),
      activeTemplateIds: new Set(),
      candidates: ALL_FIXTURE,
    });
    expect(ranked[0]!.templateId).toBe(HRV_HABIT.templateId);
    expect(ranked[0]!.reasons[0]).toContain("low HRV");
  });

  it("scores a focused habit on a weak, important sub-KPI high (anchored to the sub-KPI, not the composite)", () => {
    // User is failing HRV badly. A strength-3 HRV habit should read as highly
    // efficient (≥ 60) rather than being throttled by HRV's ~40% composite share.
    const ranked = scoreRecoveryRecommendations({
      subScores7d: { hrv: 20, rhr: 80, resp: 90, sleep: 85 },
      activeHabitImpacts: [],
      dismissedTemplateIds: new Set(),
      activeTemplateIds: new Set(),
      candidates: ALL_FIXTURE,
    });
    const hrv = ranked.find((r) => r.templateId === HRV_HABIT.templateId)!;
    expect(hrv.efficiency).toBeGreaterThanOrEqual(60);
  });

  it("a strength-3 habit on a fully-failed sub-KPI approaches 100", () => {
    const ranked = scoreRecoveryRecommendations({
      // Sleep at 0 (worst case); SLEEP_HABIT has sleep:3.
      subScores7d: { hrv: 100, rhr: 100, resp: 100, sleep: 0 },
      activeHabitImpacts: [],
      dismissedTemplateIds: new Set(),
      activeTemplateIds: new Set(),
      candidates: ALL_FIXTURE,
    });
    const sleep = ranked.find((r) => r.templateId === SLEEP_HABIT.templateId)!;
    // relWeight(sleep) = 0.25/0.40 = 0.625 → ~63, comfortably above the old cap.
    expect(sleep.efficiency).toBeGreaterThanOrEqual(60);
  });

  it("clamps efficiency to [0, 100]", () => {
    const ranked = scoreRecoveryRecommendations({
      subScores7d: { hrv: 0, rhr: 0, resp: 0, sleep: 0 },
      activeHabitImpacts: [],
      dismissedTemplateIds: new Set(),
      activeTemplateIds: new Set(),
      candidates: ALL_FIXTURE,
    });
    for (const r of ranked) {
      expect(r.efficiency).toBeGreaterThanOrEqual(0);
      expect(r.efficiency).toBeLessThanOrEqual(100);
    }
  });

  it("returns 0 efficiency when every sub-score is maxed out (no headroom)", () => {
    const ranked = scoreRecoveryRecommendations({
      subScores7d: { hrv: 100, rhr: 100, resp: 100, sleep: 100 },
      activeHabitImpacts: [],
      dismissedTemplateIds: new Set(),
      activeTemplateIds: new Set(),
      candidates: ALL_FIXTURE,
    });
    for (const r of ranked) expect(r.efficiency).toBe(0);
  });

  it("ignores metrics with null sub-score (treated as no signal, no headroom)", () => {
    // Only HRV present and low — only HRV-touching habits should rank > 0.
    const ranked = scoreRecoveryRecommendations({
      subScores7d: { hrv: 20, rhr: null, resp: null, sleep: null },
      activeHabitImpacts: [],
      dismissedTemplateIds: new Set(),
      activeTemplateIds: new Set(),
      candidates: ALL_FIXTURE,
    });
    const byId = new Map(ranked.map((r) => [r.templateId, r.efficiency]));
    expect(byId.get(HRV_HABIT.templateId)).toBeGreaterThan(0);
    expect(byId.get(MIXED_HABIT.templateId)).toBeGreaterThan(0);
    expect(byId.get(RHR_HABIT.templateId)).toBe(0);
    expect(byId.get(RESP_HABIT.templateId)).toBe(0);
    expect(byId.get(SLEEP_HABIT.templateId)).toBe(0);
  });

  it("diminishes a metric's contribution when it is already covered by an active habit", () => {
    const ctx = {
      subScores7d: { hrv: 30, rhr: 30, resp: 95, sleep: 95 } as const,
      dismissedTemplateIds: new Set<string>(),
      activeTemplateIds: new Set<string>(),
      candidates: ALL_FIXTURE,
    };
    const baseline = scoreRecoveryRecommendations({
      ...ctx,
      activeHabitImpacts: [],
    });
    const withHrvCovered = scoreRecoveryRecommendations({
      ...ctx,
      activeHabitImpacts: [{ hrv: 3 }], // a strong HRV habit is already active
    });
    const hrvBefore =
      baseline.find((r) => r.templateId === HRV_HABIT.templateId)!.efficiency;
    const hrvAfter =
      withHrvCovered.find((r) => r.templateId === HRV_HABIT.templateId)!
        .efficiency;
    expect(hrvAfter).toBeLessThan(hrvBefore);

    // Meanwhile the RHR habit (whose metric isn't covered) must not be penalised
    // — with HRV handled it's now comparatively the stronger lever, so its
    // efficiency holds or rises.
    const rhrBefore =
      baseline.find((r) => r.templateId === RHR_HABIT.templateId)!.efficiency;
    const rhrAfter =
      withHrvCovered.find((r) => r.templateId === RHR_HABIT.templateId)!
        .efficiency;
    expect(rhrAfter).toBeGreaterThanOrEqual(rhrBefore);
  });

  it("excludes dismissed and active templateIds from the ranked list", () => {
    const ranked = scoreRecoveryRecommendations({
      subScores7d: { hrv: 30, rhr: 30, resp: 30, sleep: 30 },
      activeHabitImpacts: [],
      dismissedTemplateIds: new Set([HRV_HABIT.templateId]),
      activeTemplateIds: new Set([SLEEP_HABIT.templateId]),
      candidates: ALL_FIXTURE,
    });
    const ids = ranked.map((r) => r.templateId);
    expect(ids).not.toContain(HRV_HABIT.templateId);
    expect(ids).not.toContain(SLEEP_HABIT.templateId);
    expect(ids).toContain(RHR_HABIT.templateId);
  });

  it("produces a stable, deterministic order on equal efficiencies", () => {
    const a = scoreRecoveryRecommendations({
      subScores7d: { hrv: 70, rhr: 70, resp: 70, sleep: 70 },
      activeHabitImpacts: [],
      dismissedTemplateIds: new Set<string>(),
      activeTemplateIds: new Set<string>(),
      candidates: ALL_FIXTURE,
    }).map((r) => r.templateId);
    const b = scoreRecoveryRecommendations({
      subScores7d: { hrv: 70, rhr: 70, resp: 70, sleep: 70 },
      activeHabitImpacts: [],
      dismissedTemplateIds: new Set<string>(),
      activeTemplateIds: new Set<string>(),
      candidates: ALL_FIXTURE,
    }).map((r) => r.templateId);
    expect(a).toEqual(b);
  });

  it("attaches at most two reasons, ordered by metric contribution", () => {
    const ranked = scoreRecoveryRecommendations({
      // HRV biggest gap, then RHR, then sleep, resp = full.
      subScores7d: { hrv: 20, rhr: 40, resp: 100, sleep: 70 },
      activeHabitImpacts: [],
      dismissedTemplateIds: new Set(),
      activeTemplateIds: new Set(),
      candidates: [MIXED_HABIT],
    });
    expect(ranked).toHaveLength(1);
    const { reasons } = ranked[0]!;
    expect(reasons.length).toBeLessThanOrEqual(2);
    expect(reasons[0]).toContain("HRV");
  });

  it("matches the production catalog: every tag has a unique, well-formed templateId and a sensible category", () => {
    const ids = new Set<string>();
    for (const tag of RECOVERY_HABIT_TAGS) {
      expect(tag.templateId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(ids.has(tag.templateId)).toBe(false);
      ids.add(tag.templateId);
      expect(tag.category.length).toBeGreaterThan(0);
      // At least one metric impact > 0, otherwise the card can never rank.
      const totalStrength =
        (tag.metricImpacts.hrv ?? 0) +
        (tag.metricImpacts.rhr ?? 0) +
        (tag.metricImpacts.resp ?? 0) +
        (tag.metricImpacts.sleep ?? 0);
      expect(totalStrength).toBeGreaterThan(0);
    }
  });
});

describe("impactsForTemplateIds", () => {
  it("returns the impact maps in input order for known ids, drops unknowns", () => {
    const got = impactsForTemplateIds(
      [HRV_HABIT.templateId, "no-such-id", RHR_HABIT.templateId],
      ALL_FIXTURE
    );
    expect(got).toEqual([HRV_HABIT.metricImpacts, RHR_HABIT.metricImpacts]);
  });
});

describe("buildCandidatePool — future-proof catalog", () => {
  it("includes a brand-new card via its category default (no explicit tag needed)", () => {
    const newCardId = "99999999-9999-4999-8999-ffffffffffff";
    const pool = buildCandidatePool([
      { templateId: newCardId, category: "sleep" },
      { templateId: "deadbeef-0000-4000-8000-000000000000", category: "skincare" },
    ]);
    const ids = pool.map((c) => c.templateId);
    // Recovery-relevant category → in the pool with sensible impacts.
    expect(ids).toContain(newCardId);
    expect(pool.find((c) => c.templateId === newCardId)?.metricImpacts).toEqual(
      defaultImpactsForCategory("sleep")
    );
    // Irrelevant category → excluded.
    expect(ids).not.toContain("deadbeef-0000-4000-8000-000000000000");
  });

  it("prefers a hand-tuned tag over the category default when one exists", () => {
    const tag = RECOVERY_HABIT_TAGS[0]!;
    const resolved = resolveHabitTag(tag.templateId, "supplementation");
    expect(resolved.metricImpacts).toEqual(tag.metricImpacts);
  });

  it("falls back to the hand-tuned tag list when no catalog is supplied", () => {
    expect(buildCandidatePool()).toBe(RECOVERY_HABIT_TAGS);
    expect(buildCandidatePool([])).toBe(RECOVERY_HABIT_TAGS);
  });

  it("lifts a well-matched new card into a high efficiency score end-to-end", () => {
    const newCardId = "abcabcab-abc0-4abc-8abc-abcabcabcabc";
    const pool = buildCandidatePool([{ templateId: newCardId, category: "sleep" }]);
    const [top] = scoreRecoveryRecommendations({
      subScores7d: { hrv: 60, rhr: 70, resp: 90, sleep: 25 },
      activeHabitImpacts: [],
      dismissedTemplateIds: new Set(),
      activeTemplateIds: new Set(),
      candidates: pool,
    });
    expect(top?.templateId).toBe(newCardId);
    // The sqrt lift should put a strongly-matched pick well above the old
    // low-tens band that the linear mapping produced.
    expect(top!.efficiency).toBeGreaterThanOrEqual(50);
  });
});
