import { describe, expect, it } from "vitest";
import {
  CHRONOTYPE_CALIBRATION_NIGHTS,
  circularDeltaHours,
  circularMeanHours,
  classifyMidpoint,
  computeChronotype,
  midpointHourOf,
  type ChronotypeNight,
} from "../scoring/chronotype";

// ─── Helpers for fixtures ────────────────────────────────────────────────────

/**
 * Build a synthetic night. `goToBedHour` and `wakeHour` are clock hours
 * (0..24); if go-to-bed is after wake, the night crosses midnight onto
 * the next day.
 */
function night(dayUtc: string, goToBedHour: number, wakeHour: number): ChronotypeNight {
  const [y, m, d] = dayUtc.split("-").map((s) => Number(s));
  const dayMs = Date.UTC(y!, m! - 1, d!);
  const start = new Date(dayMs + Math.round(goToBedHour * 3_600_000));
  const wakeOffset = wakeHour <= goToBedHour ? 24 + wakeHour : wakeHour;
  const end = new Date(dayMs + Math.round(wakeOffset * 3_600_000));
  return { start: start.toISOString(), end: end.toISOString() };
}

/** N nights ending today (or `startOffsetDays` ago), all the same schedule. */
function repeat(
  n: number,
  goToBed: number,
  wake: number,
  startOffsetDays = 0
): ChronotypeNight[] {
  const out: ChronotypeNight[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const dayOffset = startOffsetDays + i;
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - dayOffset));
    const ymd = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    out.push(night(ymd, goToBed, wake));
  }
  return out;
}

// ─── classifyMidpoint ────────────────────────────────────────────────────────

describe("classifyMidpoint", () => {
  it("buckets early_morning around 01:00 midpoint (wake ~05:30)", () => {
    expect(classifyMidpoint(1.0)).toBe("early_morning");
    expect(classifyMidpoint(2.4)).toBe("early_morning");
  });
  it("buckets morning at midpoint 03:00 (wake ~07:30)", () => {
    expect(classifyMidpoint(3.0)).toBe("morning");
  });
  it("buckets late_morning at midpoint 04:00 (wake ~08:30)", () => {
    expect(classifyMidpoint(4.0)).toBe("late_morning");
  });
  it("buckets early_evening at midpoint 04.5 (wake ~10:30)", () => {
    expect(classifyMidpoint(4.5)).toBe("early_evening");
  });
  it("buckets evening at midpoint 05:30", () => {
    expect(classifyMidpoint(5.5)).toBe("evening");
  });
  it("buckets late_evening at midpoint 07:00", () => {
    expect(classifyMidpoint(7.0)).toBe("late_evening");
  });
});

// ─── midpointHourOf ──────────────────────────────────────────────────────────

describe("midpointHourOf", () => {
  it("computes midpoint for a night crossing midnight", () => {
    const start = "2026-05-20T23:00:00Z";
    const end = "2026-05-21T07:00:00Z";
    expect(midpointHourOf(start, end)).toBeCloseTo(3.0, 5);
  });
  it("computes midpoint for a same-day nap", () => {
    expect(midpointHourOf("2026-05-21T13:00:00Z", "2026-05-21T14:00:00Z")).toBeCloseTo(13.5, 5);
  });
});

// ─── computeChronotype ───────────────────────────────────────────────────────

describe("computeChronotype", () => {
  it("returns calibrating with under N nights", () => {
    const r = computeChronotype(repeat(10, 23, 7));
    expect(r.class).toBe("calibrating");
    expect(r.daysCounted).toBe(10);
    expect(r.daysRequired).toBe(CHRONOTYPE_CALIBRATION_NIGHTS);
    expect(r.midpointHour).toBeNull();
    expect(r.alignment).toBeNull();
  });

  it("classifies a regular early-bed sleeper as morning", () => {
    const r = computeChronotype(repeat(14, 22.5, 6.5));
    expect(r.class).toBe("morning");
    expect(r.midpointHour).toBeCloseTo(2.5, 1);
    expect(r.alignment).toBe("aligned");
  });

  it("classifies a regular late-bed sleeper as late_evening", () => {
    const r = computeChronotype(repeat(14, 2, 11));
    expect(r.class).toBe("late_evening");
    expect(r.midpointHour).toBeCloseTo(6.5, 1);
  });

  it("flags slight misalignment when last night is 1.5h off the mean", () => {
    // Build 13 regular nights starting from yesterday so the newest entry
    // is the off-by-one night.
    const regular = repeat(13, 23, 7, 1); // midpoint 3.0 (morning)
    const offByOne = repeat(1, 0.5, 8.5, 0)[0]!; // midpoint 4.5, "today"
    const r = computeChronotype([offByOne, ...regular]);
    expect(r.class).toBe("morning");
    expect(r.alignment).toBe("slightly_off");
    expect(Math.abs(r.lastNightDeltaHours!)).toBeGreaterThan(1);
    expect(Math.abs(r.lastNightDeltaHours!)).toBeLessThan(2);
  });

  it("flags off when last night is >2h off the mean", () => {
    const regular = repeat(13, 23, 7, 1); // midpoint 3.0
    const wayOff = repeat(1, 3, 10, 0)[0]!; // midpoint 6.5 → ~3.5h delta
    const r = computeChronotype([wayOff, ...regular]);
    expect(r.alignment).toBe("off");
  });

  it("caps the window at 30 nights for stability", () => {
    // Last 30 nights are late-evening, before that 20 nights are morning.
    // Window cap → late_evening should win.
    const recent = repeat(30, 2, 11, 0);
    const ancient = repeat(20, 22, 6, 30);
    const r = computeChronotype([...recent, ...ancient]);
    expect(r.class).toBe("late_evening");
    expect(r.daysCounted).toBe(50);
  });

  it("custom calibrationNights threshold respected", () => {
    const r = computeChronotype(repeat(5, 23, 7), { calibrationNights: 5 });
    expect(r.class).toBe("morning");
  });

  it("ignores malformed ISO entries", () => {
    const ns = [{ start: "not-a-date", end: "still-not" }, ...repeat(14, 23, 7)];
    const r = computeChronotype(ns);
    expect(r.daysCounted).toBe(14);
    expect(r.class).toBe("morning");
  });
});

// ─── Circular helpers ────────────────────────────────────────────────────────

describe("circularMeanHours", () => {
  it("returns the hour for a constant input", () => {
    expect(circularMeanHours([3, 3, 3])).toBeCloseTo(3, 5);
  });
  it("handles wrap-around (23.5 + 0.5 → 0)", () => {
    const m = circularMeanHours([23.5, 0.5]);
    expect(m === 0 || m === 24 || Math.abs(m - 24) < 1e-6).toBe(true);
  });
});

describe("circularDeltaHours", () => {
  it("returns 0 for identical hours", () => {
    expect(circularDeltaHours(3, 3)).toBeCloseTo(0, 5);
  });
  it("computes shortest arc 23.5 vs 0.5 = 1", () => {
    expect(Math.abs(circularDeltaHours(0.5, 23.5))).toBeCloseTo(1, 5);
  });
  it("signs positive when a is later than b within 12h", () => {
    expect(circularDeltaHours(5, 3)).toBeCloseTo(2, 5);
    expect(circularDeltaHours(3, 5)).toBeCloseTo(-2, 5);
  });
});
