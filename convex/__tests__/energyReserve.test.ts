import { describe, expect, it } from "vitest";
import {
  computeEnergyReserve,
  energyAt,
  morningEnergyFromSleep,
  workoutDrainPoints,
  estimateDayBattery,
  ENERGY,
} from "../scoring/energyReserve";

const H = 3_600_000;
const onset = Date.parse("2026-06-01T01:00:00.000Z");
const wake = Date.parse("2026-06-01T07:00:00.000Z");

function baseInput(over: Partial<Parameters<typeof computeEnergyReserve>[0]> = {}) {
  return {
    sleepOnsetMs: onset,
    wakeMs: wake,
    nowMs: wake + 4 * H,
    morningEnergy: 100,
    workouts: [],
    stepMinutes: 60,
    ...over,
  };
}

describe("morningEnergyFromSleep", () => {
  it("leaves the base residual after a terrible night", () => {
    expect(morningEnergyFromSleep(0)).toBe(ENERGY.BASE_MORNING);
  });
  it("tops out at 100 after a perfect night", () => {
    expect(morningEnergyFromSleep(1)).toBe(100);
  });
  it("clamps out-of-range fractions", () => {
    expect(morningEnergyFromSleep(2)).toBe(100);
    expect(morningEnergyFromSleep(-1)).toBe(ENERGY.BASE_MORNING);
  });
});

describe("workoutDrainPoints", () => {
  it("uses kcal when present", () => {
    // 360 kcal / 30 kcal-per-point = 12.
    expect(workoutDrainPoints({ startMs: 0, endMs: H, durationSec: 3600, activityType: "running", activeKcal: 360 })).toBeCloseTo(12, 5);
  });
  it("falls back to duration when kcal missing", () => {
    // 60 min * 5 kcal/min = 300 kcal / 30 = 10.
    expect(workoutDrainPoints({ startMs: 0, endMs: H, durationSec: 3600, activityType: "running" })).toBeCloseTo(10, 5);
  });
  it("caps a single session's drain at MAX_WORKOUT_DRAIN", () => {
    expect(
      workoutDrainPoints({ startMs: 0, endMs: H, durationSec: 7200, activityType: "running", activeKcal: 5000 })
    ).toBe(ENERGY.MAX_WORKOUT_DRAIN);
  });
});

describe("energyAt — charge phase", () => {
  it("starts at BASE_MORNING at onset and reaches morningEnergy at wake", () => {
    const input = baseInput({ morningEnergy: 82 });
    expect(energyAt(onset, input)).toBe(ENERGY.BASE_MORNING);
    expect(energyAt(wake, input)).toBeCloseTo(82, 5);
    // Halfway through the night → halfway between base and morning.
    expect(energyAt(onset + 3 * H, input)).toBeCloseTo((ENERGY.BASE_MORNING + 82) / 2, 1);
  });
});

describe("computeEnergyReserve", () => {
  it("drains only baseline with no workouts", () => {
    const r = computeEnergyReserve(baseInput());
    expect(r.morningEnergy).toBe(100);
    // 4h * 2.5%/h = 10 → 90
    expect(r.current).toBeCloseTo(90, 5);
    // Charged from base (40) to morning (100) → 60.
    expect(r.totalCharged).toBeCloseTo(60, 5);
    expect(r.totalDischarged).toBeCloseTo(10, 5);
  });

  it("adds a faster dip during a workout and logs a completed session", () => {
    const wStart = wake + 2 * H;
    const wEnd = wake + 3 * H;
    const r = computeEnergyReserve(
      baseInput({
        workouts: [{ startMs: wStart, endMs: wEnd, durationSec: 3600, activityType: "running", activeKcal: 360 }],
      })
    );
    // baseline 4h*2.5 = 10, activity 360/30 = 12 → 100-22 = 78
    expect(r.current).toBeCloseTo(78, 5);
    expect(r.events.map((e) => e.kind)).toEqual(["sleep", "workout"]);
    const workout = r.events.find((e) => e.kind === "workout");
    expect(workout?.delta).toBeCloseTo(-12, 5);
  });

  it("tags charge / drain / workout phases on samples", () => {
    const phases = new Set(computeEnergyReserve(baseInput()).samples.map((s) => s.phase));
    expect(phases.has("charge")).toBe(true);
    expect(phases.has("drain")).toBe(true);
  });

  it("can dip below zero (down to the floor)", () => {
    const r = computeEnergyReserve(baseInput({ nowMs: wake + 80 * H, stepMinutes: 120 }));
    expect(r.current).toBe(ENERGY.FLOOR);
  });
});

describe("estimateDayBattery", () => {
  it("subtracts a 16h baseline plus activity", () => {
    // 100 - 2.5*16 - 0 = 60
    expect(estimateDayBattery(100, 0)).toEqual({ endLevel: 60, maxLevel: 100 });
    // 100 - 40 - 20 = 40
    expect(estimateDayBattery(100, 20)).toEqual({ endLevel: 40, maxLevel: 100 });
  });
});
