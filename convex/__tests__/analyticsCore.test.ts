import { describe, expect, it } from "vitest";
import {
  ageYears,
  computeMacroCompliance,
  computeRecoveryProxy,
  estimateTdee,
  isoDay,
  mifflinStJeor,
  pearson,
} from "../analyticsCore";

describe("isoDay", () => {
  it("formats UTC date in YYYY-MM-DD", () => {
    expect(isoDay(new Date("2026-05-03T13:45:00Z"))).toBe("2026-05-03");
  });
});

describe("ageYears", () => {
  it("returns null for invalid input", () => {
    expect(ageYears(null)).toBeNull();
    expect(ageYears("not-a-date")).toBeNull();
  });
  it("computes a positive age relative to a fixed now", () => {
    const now = new Date("2026-05-03T00:00:00Z").getTime();
    const yrs = ageYears("1990-05-03", now);
    expect(yrs).not.toBeNull();
    expect(yrs!).toBeCloseTo(36, 0);
  });
});

describe("mifflinStJeor", () => {
  it("returns null when required values are missing", () => {
    expect(
      mifflinStJeor({
        sex: "male",
        weightKg: null,
        heightCm: 180,
        dateOfBirth: "1990-01-01",
      })
    ).toBeNull();
  });

  it("computes a sane male BMR", () => {
    const bmr = mifflinStJeor({
      sex: "male",
      weightKg: 80,
      heightCm: 180,
      dateOfBirth: "1990-01-01",
    });
    expect(bmr).toBeGreaterThan(1500);
    expect(bmr).toBeLessThan(2200);
  });

  it("female adjustment is lower than male", () => {
    const args = {
      weightKg: 70,
      heightCm: 170,
      dateOfBirth: "1990-01-01",
    };
    const m = mifflinStJeor({ ...args, sex: "male" })!;
    const f = mifflinStJeor({ ...args, sex: "female" })!;
    expect(m - f).toBe(166);
  });
});

describe("estimateTdee", () => {
  const profile = {
    sex: "male",
    heightCm: 180,
    weightKg: 80,
    dateOfBirth: "1990-01-01",
    activityLevel: "moderate",
  };

  it("uses wearable totals when both basal+active present", () => {
    const t = estimateTdee({
      ...profile,
      activeKcal: 600,
      basalKcal: 1700,
      workoutKcal: 0,
    });
    expect(t).toBe(2300);
  });

  it("falls back to Mifflin + activity factor + workout kcal", () => {
    const t = estimateTdee({
      ...profile,
      activeKcal: null,
      basalKcal: null,
      workoutKcal: 500,
    });
    expect(t).toBeGreaterThan(2500);
    expect(t).toBeLessThan(4000);
  });
});

describe("computeMacroCompliance", () => {
  it("returns null when no targets are set", () => {
    expect(
      computeMacroCompliance({}, { calories: 100, proteinG: 1, carbsG: 1, fatG: 1 })
    ).toBeNull();
  });

  it("returns 100 when intake exactly meets targets", () => {
    expect(
      computeMacroCompliance(
        { calorieTarget: 2000, proteinG: 150, carbsG: 200, fatG: 60 },
        { calories: 2000, proteinG: 150, carbsG: 200, fatG: 60 }
      )
    ).toBe(100);
  });

  it("caps each macro at 100% so over-eating doesn't inflate the score", () => {
    expect(
      computeMacroCompliance(
        { calorieTarget: 2000, proteinG: 150 },
        { calories: 6000, proteinG: 600, carbsG: 0, fatG: 0 }
      )
    ).toBe(100);
  });
});

describe("computeRecoveryProxy", () => {
  it("returns null when all signals missing", () => {
    expect(
      computeRecoveryProxy({ hrvAvgMs: null, restingHrBpm: null, sleepMinutes: null })
    ).toBeNull();
  });

  it("scores higher recovery for healthy ranges", () => {
    const high = computeRecoveryProxy({ hrvAvgMs: 80, restingHrBpm: 55, sleepMinutes: 480 })!;
    const low = computeRecoveryProxy({ hrvAvgMs: 25, restingHrBpm: 80, sleepMinutes: 240 })!;
    expect(high).toBeGreaterThan(low);
  });
});

describe("pearson", () => {
  it("requires at least 3 paired samples", () => {
    expect(pearson([1, 2], [1, 2])).toBeNull();
  });

  it("detects perfect positive correlation", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBe(1);
  });

  it("detects perfect negative correlation", () => {
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBe(-1);
  });

  it("returns 0 for uncorrelated data", () => {
    const r = pearson([1, 2, 3, 4], [3, 1, 4, 2]);
    expect(r).not.toBeNull();
    expect(Math.abs(r!)).toBeLessThan(0.5);
  });
});
