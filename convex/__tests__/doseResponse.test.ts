import { describe, expect, it } from "vitest";
import {
  fActivityKcal,
  fActivitySteps,
  fActivityWorkoutLoad,
  fBodyBmi,
  fBodyStability,
  fCardioRhrAbs,
  fCardioVo2Percentile,
  fHabitAdherence14d,
  fHabitCategoryBreadth,
  fHabitStreakFactor,
  fNutritionEnergyBalance,
  fNutritionMacro,
  fNutritionProteinPerKg,
  fRecoveryHrv,
  fRecoveryResp,
  fRecoveryRhr,
  fSleepConsistency,
  fSleepDuration,
  fSleepEfficiency,
  fSleepRestorative,
  pwl,
} from "../scoring/doseResponse";

/**
 * Eckwerte aus docs/analytics/scoring-model-v1.md §4.
 * Bei Aenderungen an Knotenpunkten MUSS hier auch nachgezogen werden.
 */

describe("pwl", () => {
  it("returns first y for x below domain", () => {
    expect(pwl([[0, 0.2], [10, 1]], -5)).toBe(0.2);
  });
  it("returns last y for x above domain", () => {
    expect(pwl([[0, 0], [10, 1]], 100)).toBe(1);
  });
  it("interpolates linearly between knots", () => {
    expect(pwl([[0, 0], [10, 1]], 5)).toBeCloseTo(0.5);
    expect(pwl([[0, 0], [10, 1]], 2.5)).toBeCloseTo(0.25);
  });
  it("handles single knot", () => {
    expect(pwl([[5, 0.5]], 99)).toBe(0.5);
  });
});

describe("sleep dose-response §4.1", () => {
  it("duration plateau between 8h and 9h", () => {
    expect(fSleepDuration(480)).toBe(1);
    expect(fSleepDuration(540)).toBe(1);
  });
  it("duration drops outside plateau", () => {
    expect(fSleepDuration(360)).toBeCloseTo(0.5);
    expect(fSleepDuration(720)).toBeCloseTo(0.5);
    expect(fSleepDuration(300)).toBe(0);
  });
  it("efficiency 92% maxes out", () => {
    expect(fSleepEfficiency(92)).toBe(1);
    expect(fSleepEfficiency(88)).toBeCloseTo(0.85);
    expect(fSleepEfficiency(70)).toBe(0);
  });
  it("consistency knots", () => {
    expect(fSleepConsistency(85)).toBe(1);
    expect(fSleepConsistency(60)).toBeCloseTo(0.4);
  });
  it("restorative knots", () => {
    expect(fSleepRestorative(180)).toBe(1);
    expect(fSleepRestorative(60)).toBe(0);
  });
});

describe("recovery dose-response §4.2", () => {
  it("HRV at baseline scores 0.7", () => {
    expect(fRecoveryHrv(50, 50)).toBeCloseTo(0.7);
  });
  it("HRV +10% above baseline maxes out", () => {
    expect(fRecoveryHrv(55, 50)).toBe(1);
  });
  it("HRV -30% below baseline scores 0", () => {
    expect(fRecoveryHrv(35, 50)).toBe(0);
  });
  it("RHR at baseline interpolates between -2% (1.0) and +2% (0.7)", () => {
    expect(fRecoveryRhr(60, 60)).toBeCloseTo(0.85);
  });
  it("RHR 2% lower than baseline maxes out", () => {
    expect(fRecoveryRhr(58.8, 60)).toBe(1);
  });
  it("RHR 15% above baseline scores 0", () => {
    expect(fRecoveryRhr(69, 60)).toBe(0);
  });
  it("respiratory rate at baseline maxes out", () => {
    expect(fRecoveryResp(15, 15)).toBe(1);
  });
  it("HRV with zero baseline returns 0", () => {
    expect(fRecoveryHrv(50, 0)).toBe(0);
  });
});

describe("cardio dose-response §4.3", () => {
  it("VO2 percentile 50 scores 0.65", () => {
    expect(fCardioVo2Percentile(50)).toBeCloseTo(0.65);
  });
  it("VO2 percentile >= 90 maxes out", () => {
    expect(fCardioVo2Percentile(90)).toBe(1);
    expect(fCardioVo2Percentile(99)).toBe(1);
  });
  it("RHR 45 bpm maxes out", () => {
    expect(fCardioRhrAbs(45)).toBe(1);
    expect(fCardioRhrAbs(80)).toBe(0);
  });
});

describe("activity dose-response §4.4", () => {
  it("10k steps maxes out, 15k still maxes", () => {
    expect(fActivitySteps(10000)).toBe(1);
    expect(fActivitySteps(15000)).toBe(1);
  });
  it("steps knots interpolate", () => {
    expect(fActivitySteps(6000)).toBeCloseTo(0.7);
    expect(fActivitySteps(8000)).toBeCloseTo(0.9);
  });
  it("active kcal saturates at 800", () => {
    expect(fActivityKcal(800)).toBe(1);
    expect(fActivityKcal(1500)).toBe(1);
  });
  it("workout load knots", () => {
    expect(fActivityWorkoutLoad(45)).toBe(1);
    expect(fActivityWorkoutLoad(15)).toBeCloseTo(0.4);
  });
});

describe("body basics dose-response §4.5", () => {
  it("BMI 22 is peak", () => {
    expect(fBodyBmi(22)).toBe(1);
  });
  it("BMI nadir at 22-24.9", () => {
    expect(fBodyBmi(24.9)).toBe(1);
  });
  it("BMI extremes score 0", () => {
    expect(fBodyBmi(15)).toBe(0);
    expect(fBodyBmi(40)).toBe(0);
  });
  it("weight stability at CV <= 1% maxes out", () => {
    expect(fBodyStability(1)).toBe(1);
    expect(fBodyStability(0)).toBe(1);
    expect(fBodyStability(10)).toBe(0);
  });
});

describe("nutrition dose-response §4.6", () => {
  it("macro compliance 90% maxes out", () => {
    expect(fNutritionMacro(90)).toBe(1);
  });
  it("protein 1.6 g/kg maxes out", () => {
    expect(fNutritionProteinPerKg(1.6)).toBe(1);
    expect(fNutritionProteinPerKg(0.8)).toBeCloseTo(0.4);
  });
  it("energy balance at 0 maxes out", () => {
    expect(fNutritionEnergyBalance(0)).toBe(1);
    expect(fNutritionEnergyBalance(-1000)).toBeCloseTo(0.3);
    expect(fNutritionEnergyBalance(1000)).toBeCloseTo(0.3);
  });
});

describe("habits dose-response §4.7", () => {
  it("adherence 95% maxes out", () => {
    expect(fHabitAdherence14d(95)).toBe(1);
    expect(fHabitAdherence14d(0)).toBe(0);
  });
  it("breadth saturates at 4 categories", () => {
    expect(fHabitCategoryBreadth(4)).toBe(1);
    expect(fHabitCategoryBreadth(10)).toBe(1);
    expect(fHabitCategoryBreadth(1)).toBeCloseTo(0.4);
  });
  it("streak factor", () => {
    expect(fHabitStreakFactor(14)).toBe(1);
    expect(fHabitStreakFactor(0)).toBeCloseTo(0.2);
  });
});
