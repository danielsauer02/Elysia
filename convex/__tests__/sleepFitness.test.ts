import { describe, expect, it } from "vitest";
import {
  circularStddevHours,
  classifyQuality,
  computeSleepFitnessScore,
} from "../scoring/sleepFitness";

describe("classifyQuality", () => {
  it("classifies score bands per Eight-Sleep spec", () => {
    expect(classifyQuality(95)).toBe("optimal");
    expect(classifyQuality(80)).toBe("optimal");
    expect(classifyQuality(79)).toBe("in_range");
    expect(classifyQuality(60)).toBe("in_range");
    expect(classifyQuality(59)).toBe("poor");
    expect(classifyQuality(0)).toBe("poor");
  });
});

describe("computeSleepFitnessScore", () => {
  it("returns null when sleepMinutes missing", () => {
    expect(computeSleepFitnessScore({ sleepMinutes: undefined })).toBeNull();
  });

  it("returns null when sleepMinutes is 0", () => {
    expect(computeSleepFitnessScore({ sleepMinutes: 0 })).toBeNull();
  });

  it("scores Apple-Health-style duration-only input (no quality, no consistency)", () => {
    const r = computeSleepFitnessScore({ sleepMinutes: 480 })!;
    expect(r.subTime).toBe(100);
    expect(r.subQuality).toBeNull();
    expect(r.subConsistency).toBeNull();
    // Only Time contributes → score equals subTime
    expect(r.score).toBe(100);
    expect(r.activeParts).toEqual(["time"]);
    expect(r.quality).toBe("optimal");
  });

  it("scores a full Whoop-style night (all parts present)", () => {
    const r = computeSleepFitnessScore({
      sleepMinutes: 480,
      sleepDeepMinutes: 100,
      sleepRemMinutes: 90,
      sleepLightMinutes: 270,
      sleepAwakeMinutes: 20,
      sleepEfficiencyPct: 92,
      sleepConsistencyPct: 85,
    })!;
    expect(r.subTime).toBe(100);
    expect(r.subQuality).toBeGreaterThan(85);
    expect(r.subConsistency).toBe(100);
    expect(r.score).toBeGreaterThanOrEqual(95);
    expect(r.quality).toBe("optimal");
    expect(r.activeParts).toEqual(["time", "quality", "consistency"]);
  });

  it("penalises short sleep heavily (6h = 360 min reads 40)", () => {
    const r = computeSleepFitnessScore({ sleepMinutes: 360 })!;
    expect(r.subTime).toBe(40);
    expect(r.score).toBe(40);
    expect(r.quality).toBe("poor");
  });

  it("renormalises when only Time + Quality are present", () => {
    const r = computeSleepFitnessScore({
      sleepMinutes: 480,
      sleepEfficiencyPct: 92,
      sleepDeepMinutes: 100,
      sleepRemMinutes: 90,
      sleepAwakeMinutes: 20,
    })!;
    expect(r.subConsistency).toBeNull();
    expect(r.activeParts).toEqual(["time", "quality"]);
    // Weighted avg of subTime (40%) + subQuality (50%) renormalised over 90%
    const expected = Math.round((100 * 0.4 + r.subQuality! * 0.5) / 0.9);
    expect(r.score).toBe(expected);
  });

  it("uses stage-transitions when supplied (overrides awake-fallback)", () => {
    const withTransitions = computeSleepFitnessScore({
      sleepMinutes: 480,
      sleepEfficiencyPct: 92,
      sleepDeepMinutes: 100,
      sleepRemMinutes: 90,
      sleepAwakeMinutes: 60,
      stageTransitions: 5,
    })!;
    const withoutTransitions = computeSleepFitnessScore({
      sleepMinutes: 480,
      sleepEfficiencyPct: 92,
      sleepDeepMinutes: 100,
      sleepRemMinutes: 90,
      sleepAwakeMinutes: 60,
    })!;
    // 5 transitions ≈ 95, 60 awake-min ≈ 25 → transitions path is much higher
    expect(withTransitions.qualityParts.stress).toBeGreaterThan(
      (withoutTransitions.qualityParts.stress ?? 0)
    );
  });

  it("falls back to midpoint stddev for consistency when Whoop pct missing", () => {
    const r = computeSleepFitnessScore({
      sleepMinutes: 480,
      sleepEfficiencyPct: 92,
      sleepDeepMinutes: 100,
      sleepRemMinutes: 90,
      // Very regular: midpoints all near 03:00
      recentMidpoints14d: [3.0, 3.1, 2.9, 3.2, 3.0, 3.05, 2.95, 3.1, 3.0, 3.15, 2.85, 3.0, 3.05, 2.95],
    })!;
    expect(r.subConsistency).not.toBeNull();
    expect(r.subConsistency!).toBeGreaterThan(85);
  });

  it("drops consistency entirely when fewer than 3 midpoints supplied", () => {
    const r = computeSleepFitnessScore({
      sleepMinutes: 480,
      sleepEfficiencyPct: 92,
      recentMidpoints14d: [3.0, 3.1],
    })!;
    expect(r.subConsistency).toBeNull();
    expect(r.activeParts).not.toContain("consistency");
  });

  it("a worst-case 5h night with poor efficiency lands in poor band", () => {
    const r = computeSleepFitnessScore({
      sleepMinutes: 300,
      sleepEfficiencyPct: 70,
      sleepAwakeMinutes: 90,
      sleepDeepMinutes: 20,
      sleepRemMinutes: 30,
      sleepConsistencyPct: 40,
    })!;
    expect(r.quality).toBe("poor");
    expect(r.score).toBeLessThan(40);
  });
});

describe("circularStddevHours", () => {
  it("returns 0 for a constant midpoint", () => {
    expect(circularStddevHours([3, 3, 3, 3])).toBeCloseTo(0, 5);
  });

  it("treats 23:30 and 00:30 as 1h apart, not 23h", () => {
    const wrapAround = circularStddevHours([23.5, 0.5]);
    const linearMistake = circularStddevHours([0.0, 1.0]);
    // Both pairs are 1h apart on the clock → similar stddevs
    expect(Math.abs(wrapAround - linearMistake)).toBeLessThan(0.05);
  });

  it("grows with spread", () => {
    const tight = circularStddevHours([3, 3.1, 2.9, 3, 3.05]);
    const loose = circularStddevHours([1, 5, 3, 7, 2]);
    expect(loose).toBeGreaterThan(tight);
  });
});
