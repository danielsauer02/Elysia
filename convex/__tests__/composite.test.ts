import { describe, expect, it } from "vitest";
import { computeComposite, emptyPillarMap } from "../scoring/composite";
import { computeDailyScores } from "../scoring/index";
import { PILLARS_BY_ID } from "../scoring/pillarRegistry";
import type { BaselineContext, PillarInput, PillarScoreMap } from "../scoring/types";

describe("emptyPillarMap", () => {
  it("contains every pillar id as null", () => {
    const map = emptyPillarMap();
    const expectedIds = Object.keys(PILLARS_BY_ID);
    expect(Object.keys(map).sort()).toEqual(expectedIds.sort());
    for (const id of expectedIds) {
      expect(map[id as keyof PillarScoreMap]).toBeNull();
    }
  });
});

describe("computeComposite §7", () => {
  it("returns null composite with no scores", () => {
    const r = computeComposite(emptyPillarMap());
    expect(r.composite).toBeNull();
    expect(r.tierLevel).toBeNull();
    expect(r.coverage).toBe(0);
  });

  it("weights only ACTIVE pillars and renormalises", () => {
    const map = emptyPillarMap();
    // v1.2.0 weights: sleep 0.18, recovery 0.13, activity 0.09.
    map.sleep = 80;
    map.recovery = 60;
    map.activity = 90;
    const r = computeComposite(map);
    const expected =
      (80 * 0.18 + 60 * 0.13 + 90 * 0.09) /
      (0.18 + 0.13 + 0.09);
    expect(r.composite).toBe(Math.round(expected));
    expect(r.tierLevel).toBe(1);
    expect(r.activePillarIds.sort()).toEqual(
      ["activity", "recovery", "sleep"].sort()
    );
  });

  it("ignores inactive Tier 2/3 pillars even if a score is provided", () => {
    const map = emptyPillarMap();
    map.sleep = 80;
    // Tier 2 pillar (blood) is `active: false` — composite should drop it.
    map.blood = 100;
    const r = computeComposite(map);
    expect(r.composite).toBe(80);
    expect(r.activePillarIds).toEqual(["sleep"]);
  });

  it("Tier-1 coverage = active Tier-1 with score / total active Tier-1", () => {
    const map = emptyPillarMap();
    map.sleep = 80;
    map.recovery = 70;
    // 6 other active Tier-1 pillars stay null -> 2 of 8 contribute (v1.2.0)
    const r = computeComposite(map);
    expect(r.coverage).toBeCloseTo(2 / 8);
  });
});

describe("computeDailyScores end-to-end", () => {
  const baseline: BaselineContext = {
    status: "ready",
    daysCalibrated: 30,
    metrics: { hrvMedian: 50, rhrMedian: 60, respMedian: 14 },
  };

  it("produces null composite for a user with no wearable yet", () => {
    const input: PillarInput = {
      wearableDaily: null,
      energyBalance: null,
      profile: null,
      weightSeries: null,
      recentWearable: null,
      habits: null,
    };
    const { pillarScores, composite } = computeDailyScores(input, baseline);
    expect(composite.composite).toBeNull();
    expect(pillarScores.sleep).toBeNull();
    expect(pillarScores.recovery).toBeNull();
    expect(pillarScores.activity).toBeNull();
    expect(pillarScores.stress).toBeNull();
    // Tier 2/3 ALWAYS null
    expect(pillarScores.blood).toBeNull();
    expect(pillarScores.genetic).toBeNull();
  });

  it("All-Tier-1 full coverage composite (Whoop + nutrition + weight + habits)", () => {
    const series = Array.from({ length: 8 }, (_, i) => ({
      day: `2026-05-${String(i + 1).padStart(2, "0")}`,
      weightKg: 70,
    }));
    const input: PillarInput = {
      wearableDaily: {
        sleepMinutes: 480,
        sleepEfficiencyPct: 92,
        sleepConsistencyPct: 85,
        sleepDeepMinutes: 90,
        sleepRemMinutes: 100,
        hrvAvgMs: 55,
        restingHrBpm: 58,
        steps: 9000,
        activeKcal: 500,
        workoutKcal: 240,
        vo2Max: 50,
      },
      energyBalance: {
        macroCompliancePct: 90,
        proteinPerKg: 1.6,
        balanceKcal: 0,
      },
      profile: { sex: "male", dateOfBirth: "1990-01-01", heightCm: 178, weightKg: 70 },
      weightSeries: series,
      recentWearable: Array.from({ length: 7 }, (_, i) => ({
        day: `2026-05-${String(i + 17).padStart(2, "0")}`,
        hrvAvgMs: 54 + i * 0.5,
        restingHrBpm: 58,
        respiratoryRateAvg: 14,
      })),
      habits: {
        activeCount: 5,
        completedToday: 5,
        expectedToday: 5,
        distinctCategories: 4,
        maxStreakDays: 14,
        adherence14dPct: 95,
      },
    };
    const { pillarScores, composite } = computeDailyScores(input, baseline);
    expect(pillarScores.sleep).toBeGreaterThanOrEqual(95);
    expect(pillarScores.recovery).toBeGreaterThanOrEqual(85);
    expect(pillarScores.activity).toBeGreaterThanOrEqual(85);
    expect(pillarScores.bodyBasic).toBe(100);
    expect(pillarScores.nutrition).toBe(100);
    expect(pillarScores.habits).toBe(100);
    expect(pillarScores.cardio).toBeGreaterThanOrEqual(80);
    expect(pillarScores.stress).toBeGreaterThanOrEqual(70);
    expect(composite.composite).toBeGreaterThanOrEqual(85);
    expect(composite.tierLevel).toBe(1);
    expect(composite.coverage).toBe(1);
  });
});
