import { describe, expect, it } from "vitest";
import {
  classifyRecovery,
  computeRecoveryFitnessScore,
} from "../scoring/recoveryFitness";

const BASELINE = { hrvMedian: 50, rhrMedian: 60, respMedian: 14 };

describe("classifyRecovery", () => {
  it("classifies recovery bands Whoop-style", () => {
    expect(classifyRecovery(95)).toBe("high");
    expect(classifyRecovery(80)).toBe("high");
    expect(classifyRecovery(79)).toBe("moderate");
    expect(classifyRecovery(60)).toBe("moderate");
    expect(classifyRecovery(59)).toBe("low");
    expect(classifyRecovery(0)).toBe("low");
  });
});

describe("computeRecoveryFitnessScore", () => {
  it("returns null when neither HRV nor resting HR is present", () => {
    expect(
      computeRecoveryFitnessScore({
        respiratoryRateAvg: 14,
        sleepScore: 80,
        baseline: BASELINE,
      })
    ).toBeNull();
  });

  it("scores HRV-only input and renormalises to that single part", () => {
    const r = computeRecoveryFitnessScore({
      hrvAvgMs: 60, // +20% vs 50 baseline → top of curve
      baseline: BASELINE,
    })!;
    expect(r.subHrv).toBe(100);
    expect(r.subRhr).toBeNull();
    expect(r.subSleep).toBeNull();
    expect(r.subResp).toBeNull();
    expect(r.score).toBe(100);
    expect(r.activeParts).toEqual(["hrv"]);
    expect(r.quality).toBe("high");
  });

  it("scores a full Whoop-style day (all four parts present)", () => {
    const r = computeRecoveryFitnessScore({
      hrvAvgMs: 60, // +20% → 100
      restingHrBpm: 58, // -3.3% vs 60 → ~1.0
      respiratoryRateAvg: 14, // delta 0 → top
      sleepScore: 80,
      baseline: BASELINE,
    })!;
    expect(r.activeParts).toEqual(["hrv", "rhr", "sleep", "resp"]);
    // Weighted: (100*.4 + ~100*.25 + 80*.25 + ~100*.1) ≈ 95
    expect(r.score).toBeGreaterThanOrEqual(94);
    expect(r.score).toBeLessThanOrEqual(96);
    expect(r.quality).toBe("high");
  });

  it("uses cohort baseline when personal baseline is missing", () => {
    const r = computeRecoveryFitnessScore({
      hrvAvgMs: 45, // == cohort median → mid-curve
      baseline: {},
    })!;
    // 45 == cohort hrv median (delta 0%) → curve gives 0.7 → 70
    expect(r.subHrv).toBe(70);
    expect(r.score).toBe(70);
    expect(r.quality).toBe("moderate");
  });

  it("a depressed day reads low", () => {
    const r = computeRecoveryFitnessScore({
      hrvAvgMs: 35, // -30% → 0
      restingHrBpm: 69, // +15% → 0
      respiratoryRateAvg: 14,
      sleepScore: 40,
      baseline: BASELINE,
    })!;
    expect(r.subHrv).toBe(0);
    expect(r.subRhr).toBe(0);
    expect(r.score).toBeLessThan(60);
    expect(r.quality).toBe("low");
  });
});
