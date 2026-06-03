/**
 * Chronotype approximation from a rolling window of sleep midpoints.
 *
 * Oura's real chronotype uses 3 months of body temperature + activity +
 * sleep data. We don't have body-temperature density yet (Whoop gives only
 * one skin_temp reading per night, no continuous temp). Until the smart
 * band ships continuous core-temperature data, we approximate the chrono
 * type from the circular MEAN of the sleep midpoint over the last 14-30
 * nights and bucket it into the same six classes Oura uses.
 *
 * Pure functions only — no Convex deps. The Convex query in `sleep.ts`
 * hydrates `samples` from `wearableSamples` (metricType = sleep_stage) and
 * passes the per-night `start`/`end` ISO timestamps to `computeChronotype`.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type ChronotypeClass =
  | "calibrating"
  | "early_morning"
  | "morning"
  | "late_morning"
  | "early_evening"
  | "evening"
  | "late_evening";

export type ChronotypeAlignment = "aligned" | "slightly_off" | "off";

export interface ChronotypeNight {
  /** ISO start time of the sleep session. */
  start: string;
  /** ISO end time of the sleep session. */
  end: string;
}

/** Asleep / midpoint / awake decimal-hour schedule (0..24). */
export interface ChronotypeSchedule {
  asleepHour: number;
  midpointHour: number;
  awakeHour: number;
}

export interface ChronotypeResult {
  class: ChronotypeClass;
  /** Decimal-hour midpoint of the chronotype (0..24). null while calibrating. */
  midpointHour: number | null;
  asleepHour: number | null;
  awakeHour: number | null;
  /**
   * Canonical optimal sleep schedule for the classified chronotype — the
   * "ideal" window the inner ring + deep-dive page paint. null while
   * calibrating.
   */
  optimal: ChronotypeSchedule | null;
  /** Number of nights with usable data that fed this result. */
  daysCounted: number;
  /** Number of nights required to leave the `calibrating` state. */
  daysRequired: number;
  /**
   * Comparison of last-night's midpoint with the chronotype mean. null
   * while calibrating or when last-night data is missing.
   */
  alignment: ChronotypeAlignment | null;
  /** Delta hours between last-night midpoint and chronotype mean. */
  lastNightDeltaHours: number | null;
}

/**
 * Canonical optimal sleep windows per chronotype (8h in bed). These drive
 * the inner "suggested" ring and the deep-dive Asleep/Midpoint/Awake row.
 * Early-evening lands on the textbook 00:00→08:00 window.
 */
const CHRONO_OPTIMAL: Record<
  Exclude<ChronotypeClass, "calibrating">,
  { asleep: number; awake: number }
> = {
  early_morning: { asleep: 21.0, awake: 5.0 },
  morning: { asleep: 22.0, awake: 6.0 },
  late_morning: { asleep: 23.0, awake: 7.0 },
  early_evening: { asleep: 0.0, awake: 8.0 },
  evening: { asleep: 0.5, awake: 8.5 },
  late_evening: { asleep: 1.5, awake: 9.5 },
};

function optimalScheduleFor(
  klass: Exclude<ChronotypeClass, "calibrating">
): ChronotypeSchedule {
  const { asleep, awake } = CHRONO_OPTIMAL[klass];
  const midpoint = (asleep + 4) % 24;
  return { asleepHour: asleep, awakeHour: awake, midpointHour: midpoint };
}

// ─── Bounds ──────────────────────────────────────────────────────────────────

/** Buckets are half-open [start, end) in decimal hours of midpoint. */
const CLASS_BOUNDS: ReadonlyArray<{
  id: Exclude<ChronotypeClass, "calibrating">;
  start: number;
  end: number;
}> = [
  // Wraps around midnight: 00:00..02:00 belongs to early_morning AS the
  // pre-dawn sleep midpoint of an early-rising morning person.
  { id: "early_morning", start: 0.0, end: 2.5 }, // midpoint 00:00–02:30 → wake ~05:00–07:00
  { id: "morning",       start: 2.5, end: 3.5 }, // wake ~07:00–08:30
  { id: "late_morning",  start: 3.5, end: 4.25 }, // wake ~08:30–09:45
  { id: "early_evening", start: 4.25, end: 5.0 }, // wake ~09:45–11:00
  { id: "evening",       start: 5.0, end: 6.0 },
  { id: "late_evening",  start: 6.0, end: 12.0 }, // wake after 11:00 (and via wrap)
];

export const CHRONOTYPE_CALIBRATION_NIGHTS = 14;

// ─── Public API ──────────────────────────────────────────────────────────────

export function computeChronotype(
  nights: ChronotypeNight[],
  options: { calibrationNights?: number; nowIso?: string } = {}
): ChronotypeResult {
  const daysRequired = options.calibrationNights ?? CHRONOTYPE_CALIBRATION_NIGHTS;

  // Sort newest-first for deterministic "last night" lookup.
  const sorted = nights
    .slice()
    .filter((n) => isFiniteIso(n.start) && isFiniteIso(n.end))
    .sort((a, b) => b.end.localeCompare(a.end));

  const midpoints = sorted.map((n) => midpointHourOf(n.start, n.end));
  const asleepHours = sorted.map((n) => localHourOf(n.start));
  const awakeHours = sorted.map((n) => localHourOf(n.end));

  if (midpoints.length < daysRequired) {
    return {
      class: "calibrating",
      midpointHour: null,
      asleepHour: null,
      awakeHour: null,
      optimal: null,
      daysCounted: midpoints.length,
      daysRequired,
      alignment: null,
      lastNightDeltaHours: null,
    };
  }

  const window = midpoints.slice(0, 30); // cap at 30 nights for stability
  const windowAsleep = asleepHours.slice(0, 30);
  const windowAwake = awakeHours.slice(0, 30);

  const midpointMean = circularMeanHours(window);
  const klass = classifyMidpoint(midpointMean);

  const asleepMean = circularMeanHours(windowAsleep);
  const awakeMean = circularMeanHours(windowAwake);

  // Last-night alignment vs chronotype mean. Thresholds are deliberately
  // forgiving: a night is rarely a perfect match, so a midpoint within
  // ~1h still reads as "aligned" rather than nagging "slightly off".
  const lastMid = midpoints[0]!;
  const deltaH = circularDeltaHours(lastMid, midpointMean);
  let alignment: ChronotypeAlignment = "aligned";
  if (Math.abs(deltaH) > 2) alignment = "off";
  else if (Math.abs(deltaH) > 1) alignment = "slightly_off";

  return {
    class: klass,
    midpointHour: midpointMean,
    asleepHour: asleepMean,
    awakeHour: awakeMean,
    optimal: optimalScheduleFor(klass),
    daysCounted: midpoints.length,
    daysRequired,
    alignment,
    lastNightDeltaHours: deltaH,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isFiniteIso(s: string): boolean {
  const t = Date.parse(s);
  return Number.isFinite(t);
}

/** Local clock hour (0..24) of an ISO timestamp, treating the source as UTC. */
function localHourOf(iso: string): number {
  const d = new Date(iso);
  return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
}

/**
 * Midpoint-of-sleep in decimal hours (0..24). Always uses the absolute
 * delta between start and end so a sleep crossing midnight maps to the
 * correct clock hour (e.g. start 23:00 end 07:00 → midpoint 03:00).
 */
export function midpointHourOf(startIso: string, endIso: string): number {
  const s = Date.parse(startIso);
  const e = Date.parse(endIso);
  const mid = new Date(s + (e - s) / 2);
  return mid.getUTCHours() + mid.getUTCMinutes() / 60 + mid.getUTCSeconds() / 3600;
}

/** Bucket a midpoint hour into one of the 6 chronotype classes. */
export function classifyMidpoint(midpointHour: number): Exclude<ChronotypeClass, "calibrating"> {
  const h = ((midpointHour % 24) + 24) % 24;
  for (const b of CLASS_BOUNDS) {
    if (h >= b.start && h < b.end) return b.id;
  }
  // Should never happen: bounds cover [0, 12) and late_evening goes to 12.
  // Map 12..24 (afternoon midpoint = night-shift worker) to late_evening too.
  return "late_evening";
}

/**
 * Circular mean of hours on the 24h clock. Returns a value in [0, 24).
 */
export function circularMeanHours(hours: number[]): number {
  if (hours.length === 0) return 0;
  const twoPi = 2 * Math.PI;
  let sx = 0;
  let sy = 0;
  for (const h of hours) {
    const theta = ((((h % 24) + 24) % 24) / 24) * twoPi;
    sx += Math.cos(theta);
    sy += Math.sin(theta);
  }
  const theta = Math.atan2(sy / hours.length, sx / hours.length);
  let h = (theta / twoPi) * 24;
  if (h < 0) h += 24;
  return h;
}

/**
 * Signed shortest-arc delta between two hour values on the 24h clock,
 * in the range (-12, 12]. Positive means `a` is LATER than `b`.
 */
export function circularDeltaHours(a: number, b: number): number {
  let d = (((a - b) % 24) + 24) % 24; // 0..24
  if (d > 12) d -= 24;                // (-12, 12]
  return d;
}
