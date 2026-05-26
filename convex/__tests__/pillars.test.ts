import { describe, expect, it } from "vitest";
import { computeActivityScore } from "../scoring/pillars/activity";
import { computeBodyBasicScore } from "../scoring/pillars/bodyBasic";
import { computeCardioScore } from "../scoring/pillars/cardio";
import { computeHabitScore } from "../scoring/pillars/habits";
import { computeNutritionScore } from "../scoring/pillars/nutrition";
import { computeRecoveryScore } from "../scoring/pillars/recovery";
import { computeSleepScore } from "../scoring/pillars/sleep";
import type { BaselineContext, PillarInput } from "../scoring/types";

const READY_BASELINE: BaselineContext = {
  status: "ready",
  daysCalibrated: 60,
  metrics: { hrvMedian: 50, rhrMedian: 60, respMedian: 14 },
};

const CALIBRATING_BASELINE: BaselineContext = {
  status: "calibrating",
  daysCalibrated: 3,
  metrics: {},
};

function emptyInput(): PillarInput {
  return {
    wearableDaily: null,
    energyBalance: null,
    profile: null,
    weightSeries: null,
    recentWearable: null,
    habits: null,
  };
}

describe("computeSleepScore", () => {
  it("returns null when sleepMinutes missing", () => {
    expect(computeSleepScore({ ...emptyInput(), wearableDaily: {} })).toBeNull();
  });
  it("scores duration-only input (Apple Health style)", () => {
    const score = computeSleepScore({
      ...emptyInput(),
      wearableDaily: { sleepMinutes: 480 },
    });
    expect(score).toBe(100);
  });
  it("blends duration + efficiency + consistency + restorative (Whoop style)", () => {
    const score = computeSleepScore({
      ...emptyInput(),
      wearableDaily: {
        sleepMinutes: 480,
        sleepEfficiencyPct: 92,
        sleepConsistencyPct: 85,
        sleepDeepMinutes: 100,
        sleepRemMinutes: 90,
      },
    });
    expect(score).toBe(100);
  });
  it("renormalises across partial sub-scores", () => {
    const score = computeSleepScore({
      ...emptyInput(),
      wearableDaily: { sleepMinutes: 360, sleepEfficiencyPct: 70 },
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(50);
  });
});

describe("computeRecoveryScore", () => {
  it("returns null when no HRV nor RHR present", () => {
    expect(
      computeRecoveryScore({ ...emptyInput(), wearableDaily: {} }, READY_BASELINE)
    ).toBeNull();
  });
  it("uses cohort defaults during calibration", () => {
    const score = computeRecoveryScore(
      { ...emptyInput(), wearableDaily: { hrvAvgMs: 45, restingHrBpm: 62 } },
      CALIBRATING_BASELINE
    );
    // HRV=baseline -> 0.7; RHR=baseline -> 0.85 (mid of [-2,1] and [2,0.7]).
    expect(score).toBeGreaterThanOrEqual(65);
    expect(score).toBeLessThanOrEqual(85);
  });
  it("high HRV vs baseline + low RHR maxes recovery", () => {
    const score = computeRecoveryScore(
      {
        ...emptyInput(),
        wearableDaily: { hrvAvgMs: 65, restingHrBpm: 56, respiratoryRateAvg: 13 },
      },
      READY_BASELINE
    );
    expect(score).toBe(100);
  });
  it("low HRV + high RHR collapses recovery", () => {
    const score = computeRecoveryScore(
      {
        ...emptyInput(),
        wearableDaily: { hrvAvgMs: 30, restingHrBpm: 72 },
      },
      READY_BASELINE
    );
    expect(score).toBeLessThan(35);
  });
});

describe("computeActivityScore", () => {
  it("returns null when neither steps nor active kcal present", () => {
    expect(
      computeActivityScore({ ...emptyInput(), wearableDaily: {} })
    ).toBeNull();
  });
  it("10k steps + 500 active kcal + 40min workout = full score", () => {
    const score = computeActivityScore({
      ...emptyInput(),
      wearableDaily: {
        steps: 10000,
        activeKcal: 500,
        workoutKcal: 320, // 320 / 8 = 40 min
      },
    });
    expect(score).toBeGreaterThanOrEqual(95);
  });
  it("sedentary day scores low", () => {
    const score = computeActivityScore({
      ...emptyInput(),
      wearableDaily: { steps: 1500, activeKcal: 80 },
    });
    expect(score).toBeLessThan(30);
  });
});

describe("computeCardioScore", () => {
  it("returns null without VO2 and RHR", () => {
    expect(
      computeCardioScore({ ...emptyInput(), wearableDaily: {} })
    ).toBeNull();
  });
  it("elite male 30yo with VO2 54 and RHR 50 scores top tier", () => {
    const score = computeCardioScore({
      ...emptyInput(),
      wearableDaily: { vo2Max: 54, restingHrBpm: 50 },
      profile: { sex: "male", dateOfBirth: "1995-01-01" },
    });
    expect(score).toBeGreaterThanOrEqual(85);
  });
  it("sedentary 50yo female with VO2 22 and RHR 75 scores low", () => {
    const score = computeCardioScore({
      ...emptyInput(),
      wearableDaily: { vo2Max: 22, restingHrBpm: 75 },
      profile: { sex: "female", dateOfBirth: "1975-01-01" },
    });
    expect(score).toBeLessThan(35);
  });
});

describe("computeBodyBasicScore", () => {
  it("returns null without weight/height", () => {
    expect(computeBodyBasicScore(emptyInput())).toBeNull();
  });
  it("BMI 22 with stable weight maxes out", () => {
    const series = Array.from({ length: 8 }, (_, i) => ({
      day: `2026-05-${String(i + 1).padStart(2, "0")}`,
      weightKg: 70,
    }));
    const score = computeBodyBasicScore({
      ...emptyInput(),
      profile: { weightKg: 70, heightCm: 178 },
      weightSeries: series,
    });
    expect(score).toBe(100);
  });
  it("BMI 32 falls", () => {
    const score = computeBodyBasicScore({
      ...emptyInput(),
      profile: { weightKg: 110, heightCm: 178 },
      weightSeries: null,
    });
    expect(score).toBeLessThan(50);
  });
});

describe("computeNutritionScore", () => {
  it("returns null when macroCompliancePct missing", () => {
    expect(
      computeNutritionScore({ ...emptyInput(), energyBalance: {} })
    ).toBeNull();
  });
  it("90% macro + 1.6 g/kg protein + 0 balance = full score", () => {
    const score = computeNutritionScore({
      ...emptyInput(),
      energyBalance: {
        macroCompliancePct: 90,
        proteinPerKg: 1.6,
        balanceKcal: 0,
      },
    });
    expect(score).toBe(100);
  });
  it("low protein + macro miss drops score", () => {
    const score = computeNutritionScore({
      ...emptyInput(),
      energyBalance: {
        macroCompliancePct: 50,
        proteinPerKg: 0.6,
        balanceKcal: -800,
      },
    });
    expect(score).toBeLessThan(55);
  });
});

describe("computeHabitScore", () => {
  it("returns null with zero active habits", () => {
    expect(
      computeHabitScore({
        ...emptyInput(),
        habits: {
          activeCount: 0,
          completedToday: 0,
          expectedToday: 0,
          distinctCategories: 0,
          maxStreakDays: 0,
          adherence14dPct: 0,
        },
      })
    ).toBeNull();
  });
  it("perfect adherence + 4 categories + 14 day streak maxes out", () => {
    const score = computeHabitScore({
      ...emptyInput(),
      habits: {
        activeCount: 6,
        completedToday: 6,
        expectedToday: 6,
        distinctCategories: 4,
        maxStreakDays: 14,
        adherence14dPct: 95,
      },
    });
    expect(score).toBe(100);
  });
  it("low adherence drops score", () => {
    const score = computeHabitScore({
      ...emptyInput(),
      habits: {
        activeCount: 3,
        completedToday: 0,
        expectedToday: 3,
        distinctCategories: 1,
        maxStreakDays: 0,
        adherence14dPct: 10,
      },
    });
    expect(score).toBeLessThan(35);
  });
});
