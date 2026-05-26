import { describe, expect, it } from "vitest";
import {
  normalizeFitbitActivity,
  normalizeFitbitHeart,
  normalizeOuraActivity,
  normalizeOuraSleeps,
  normalizeWhoopRecoveries,
  normalizeWhoopSleeps,
  normalizeWhoopWorkouts,
} from "../wearableNormalizers";

describe("normalizeWhoopRecoveries", () => {
  it("emits HRV / RHR / SpO2 samples with stable ids", () => {
    const out = normalizeWhoopRecoveries([
      {
        cycle_id: 1234,
        sleep_id: "s1",
        user_id: 1,
        created_at: "2026-05-03T08:00:00Z",
        updated_at: "2026-05-03T08:00:00Z",
        score: {
          hrv_rmssd_milli: 65,
          resting_heart_rate: 54,
          spo2_percentage: 96.5,
        },
      },
    ]);
    expect(out).toHaveLength(3);
    expect(new Set(out.map((s) => s.metricType))).toEqual(
      new Set(["hrv_sdnn", "resting_heart_rate", "oxygen_saturation"])
    );
    expect(out.every((s) => s.source === "whoop")).toBe(true);
    expect(out.every((s) => s.sampleId.startsWith("whoop_recovery_1234"))).toBe(true);
  });

  it("skips entries without a score", () => {
    const out = normalizeWhoopRecoveries([
      {
        cycle_id: 1,
        sleep_id: "s",
        user_id: 1,
        created_at: "2026-05-03T08:00:00Z",
        updated_at: "2026-05-03T08:00:00Z",
      },
    ]);
    expect(out).toHaveLength(0);
  });
});

describe("normalizeWhoopSleeps", () => {
  it("converts stage durations from millis to minutes", () => {
    const out = normalizeWhoopSleeps([
      {
        id: "abc",
        cycle_id: 1,
        user_id: 1,
        start: "2026-05-03T00:00:00Z",
        end: "2026-05-03T08:00:00Z",
        score: {
          stage_summary: {
            total_light_sleep_time_milli: 4 * 60 * 60 * 1000,
            total_slow_wave_sleep_time_milli: 2 * 60 * 60 * 1000,
            total_rem_sleep_time_milli: 90 * 60 * 1000,
            total_awake_time_milli: 0,
          },
          respiratory_rate: 14.2,
        },
      },
    ]);
    const stages = Object.fromEntries(
      out
        .filter((s) => s.metricType === "sleep_stage")
        .map((s) => [s.stage, s.value])
    );
    expect(stages.light).toBe(240);
    expect(stages.deep).toBe(120);
    expect(stages.rem).toBe(90);
    expect(stages.awake).toBeUndefined();
    expect(out.find((s) => s.metricType === "respiratory_rate")?.value).toBeCloseTo(14.2);
  });
});

describe("normalizeWhoopWorkouts", () => {
  it("converts kilojoule to kcal and computes duration", () => {
    const out = normalizeWhoopWorkouts([
      {
        id: "wid",
        sport_id: 1,
        start: "2026-05-03T10:00:00Z",
        end: "2026-05-03T11:00:00Z",
        score: {
          kilojoule: 2092, // ~ 500 kcal
          distance_meter: 5000,
          average_heart_rate: 145,
          max_heart_rate: 175,
        },
      } as any,
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.durationSec).toBe(3600);
    expect(out[0]!.activeKcal).toBe(500);
    expect(out[0]!.hrAvgBpm).toBe(145);
  });
});

describe("normalizeOuraSleeps", () => {
  it("converts seconds → minutes per stage", () => {
    const out = normalizeOuraSleeps([
      {
        id: "o1",
        day: "2026-05-03",
        bedtime_start: "2026-05-02T23:00:00Z",
        bedtime_end: "2026-05-03T07:00:00Z",
        total_sleep_duration: 7 * 3600,
        deep_sleep_duration: 90 * 60,
        light_sleep_duration: 4 * 3600,
        rem_sleep_duration: 90 * 60,
      },
    ]);
    const m = Object.fromEntries(out.map((s) => [s.stage ?? s.metricType, s.value]));
    expect(m.deep).toBe(90);
    expect(m.light).toBe(240);
    expect(m.rem).toBe(90);
  });
});

describe("normalizeOuraActivity", () => {
  it("emits steps + active_calories samples", () => {
    const out = normalizeOuraActivity([
      {
        id: "oa",
        day: "2026-05-03",
        timestamp: "2026-05-03T12:00:00Z",
        steps: 10500,
        active_calories: 540,
      } as any,
    ]);
    const types = out.map((s) => s.metricType);
    expect(types).toContain("steps");
    expect(types).toContain("active_calories");
  });
});

describe("normalizeFitbitHeart", () => {
  it("flattens daily resting heart rate sample", () => {
    const out = normalizeFitbitHeart("2026-05-03", {
      "activities-heart": [
        { dateTime: "2026-05-03", value: { restingHeartRate: 56 } },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.metricType).toBe("resting_heart_rate");
    expect(out[0]!.value).toBe(56);
  });

  it("emits intraday HR samples when present", () => {
    const out = normalizeFitbitHeart("2026-05-03", {
      "activities-heart": [],
      "activities-heart-intraday": {
        dataset: [
          { time: "08:00:00", value: 72 },
          { time: "08:01:00", value: 74 },
        ],
        datasetInterval: 60,
      },
    });
    expect(out).toHaveLength(2);
    expect(out.every((s) => s.metricType === "heart_rate")).toBe(true);
  });
});

describe("normalizeFitbitActivity", () => {
  it("creates a steps sample for the given day", () => {
    const out = normalizeFitbitActivity("2026-05-03", {
      summary: { steps: 9876, caloriesOut: 2400 },
    });
    expect(out.find((s) => s.metricType === "steps")?.value).toBe(9876);
    expect(out.every((s) => s.source === "fitbit")).toBe(true);
  });
});
