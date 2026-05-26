import { describe, expect, it } from "vitest";
import { computeStressScore } from "../scoring/pillars/stress";
import {
  fStressFragmentation,
  fStressHrvCv,
  fStressRespDeviation,
} from "../scoring/doseResponse";
import type { BaselineContext, PillarInput } from "../scoring/types";

const READY_BASELINE: BaselineContext = {
  status: "ready",
  daysCalibrated: 30,
  metrics: { hrvMedian: 50, rhrMedian: 60, respMedian: 14 },
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

describe("stress dose-response §4.8", () => {
  it("HRV CV of 5% scores 1.0 (stable autonomic state)", () => {
    expect(fStressHrvCv(5)).toBe(1);
  });
  it("HRV CV of 40% collapses to 0", () => {
    expect(fStressHrvCv(40)).toBe(0);
  });
  it("Sleep fragmentation 0 = perfect", () => {
    expect(fStressFragmentation(0)).toBe(1);
  });
  it("Sleep fragmentation 100 = max stress", () => {
    expect(fStressFragmentation(100)).toBe(0);
  });
  it("Respiratory deviation at baseline = 1.0", () => {
    expect(fStressRespDeviation(0)).toBe(1);
  });
  it("Respiratory deviation 30% = 0", () => {
    expect(fStressRespDeviation(30)).toBe(0);
  });
});

describe("computeStressScore", () => {
  it("returns null without any usable signal", () => {
    expect(computeStressScore(emptyInput(), READY_BASELINE)).toBeNull();
  });

  it("low fragmentation + stable HRV + baseline resp = high score", () => {
    const recent = Array.from({ length: 7 }, () => ({
      day: "2026-05-23",
      hrvAvgMs: 50,
    }));
    const score = computeStressScore(
      {
        ...emptyInput(),
        wearableDaily: {
          sleepEfficiencyPct: 95,
          sleepAwakeMinutes: 5,
          respiratoryRateAvg: 14,
        },
        recentWearable: recent,
      },
      READY_BASELINE
    );
    expect(score).toBeGreaterThanOrEqual(95);
  });

  it("high HRV variability + fragmented sleep collapses the score", () => {
    const recent = [
      { day: "d1", hrvAvgMs: 30 },
      { day: "d2", hrvAvgMs: 60 },
      { day: "d3", hrvAvgMs: 25 },
      { day: "d4", hrvAvgMs: 70 },
    ];
    const score = computeStressScore(
      {
        ...emptyInput(),
        wearableDaily: {
          sleepEfficiencyPct: 65,
          sleepAwakeMinutes: 50,
          respiratoryRateAvg: 19,
        },
        recentWearable: recent,
      },
      READY_BASELINE
    );
    expect(score).toBeLessThan(40);
  });

  it("computes from fragmentation only when HRV history is too short", () => {
    const score = computeStressScore(
      {
        ...emptyInput(),
        wearableDaily: { sleepEfficiencyPct: 95, sleepAwakeMinutes: 5 },
        recentWearable: [{ day: "d1", hrvAvgMs: 50 }],
      },
      READY_BASELINE
    );
    expect(score).not.toBeNull();
    expect(score).toBeGreaterThanOrEqual(85);
  });
});
