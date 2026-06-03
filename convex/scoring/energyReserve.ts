/**
 * Energy Reserve model.
 *
 * A Bevel-style "body battery": a reserve that charges overnight from sleep
 * (sleep-onset → wake) and drains across the waking day — slowly from baseline
 * metabolism and faster during workouts. Pure + deterministic so it can be
 * unit-tested and re-derived from raw inputs on demand.
 *
 *   charge phase (onset → wake): rises BASE_MORNING → morningEnergy
 *   drain  phase (wake → now)  : morningEnergy − baseline·hoursAwake − Σ activity
 *
 * Each workout's drain accrues linearly across its own window so the curve
 * shows a visible, steeper dip during the session. Energy may dip below 0.
 */

export const ENERGY = {
  /** Max % a single fully-restorative night can charge the reserve. */
  SLEEP_CHARGE_MAX: 60,
  /** Reserve at sleep onset (residual you carry into the night). */
  BASE_MORNING: 40,
  /** Baseline waking drain (metabolic + cognitive), % per hour. */
  DRAIN_BASE_PER_HOUR: 2.5,
  /**
   * Active kcal that drain one reserve point. Tuned so a workout reads as a
   * visibly steeper — but not waterfall — dip: a ~500 kcal session costs ~17%
   * rather than wiping a third of the battery. Keeps the reserve a sustainable,
   * continuously-running model (two sessions in a day stay recoverable by a
   * single good night).
   */
  KCAL_PER_POINT: 30,
  /** Fallback intensity when a workout has no kcal (kcal/min). */
  DEFAULT_KCAL_PER_MIN: 5,
  /**
   * Hard ceiling on a single session's drain so an outlier (e.g. a long, very
   * high-kcal effort) can never cause a cliff. Realistic days stay well under.
   */
  MAX_WORKOUT_DRAIN: 18,
  /** Lowest the reserve is allowed to read (display floor). */
  FLOOR: -20,
} as const;

export type EnergyPhase = "charge" | "drain" | "workout";

export interface EnergyWorkout {
  startMs: number;
  endMs: number;
  durationSec: number;
  activityType: string;
  activeKcal?: number | undefined;
}

export interface EnergyReserveInput {
  /** Sleep onset — left edge of the curve (charging begins). */
  sleepOnsetMs: number;
  /** Wake time — charging ends, draining begins. */
  wakeMs: number;
  /** Right end of the DRAWN curve (live clock today, day end for past days). */
  nowMs: number;
  /** Reserve % at wake (BASE_MORNING + sleep charge). */
  morningEnergy: number;
  workouts: EnergyWorkout[];
  /** Sampling resolution in minutes (default 10). */
  stepMinutes?: number;
}

export interface EnergySample {
  tMs: number;
  e: number;
  /** Phase of the segment STARTING at this sample (drives dashed vs solid). */
  phase: EnergyPhase;
}

export interface EnergyEvent {
  kind: "sleep" | "workout";
  startMs: number;
  endMs: number;
  label: string;
  /** Signed reserve delta (+charge for sleep / −drain for workouts). */
  delta: number;
}

export interface EnergyReserveResult {
  morningEnergy: number;
  current: number;
  /** Total charged from this night's sleep (positive %). */
  totalCharged: number;
  /** Total discharged since waking up to `nowMs` (positive %). */
  totalDischarged: number;
  samples: EnergySample[];
  events: EnergyEvent[];
}

function clampFloor(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < ENERGY.FLOOR) return ENERGY.FLOOR;
  if (v > 100) return 100;
  return v;
}

/** Reserve points a workout costs (kcal-driven, with a duration fallback). */
export function workoutDrainPoints(w: EnergyWorkout): number {
  const kcal =
    w.activeKcal !== undefined && Number.isFinite(w.activeKcal) && w.activeKcal > 0
      ? w.activeKcal
      : (w.durationSec / 60) * ENERGY.DEFAULT_KCAL_PER_MIN;
  const raw = Math.max(0, kcal / ENERGY.KCAL_PER_POINT);
  return Math.min(ENERGY.MAX_WORKOUT_DRAIN, raw);
}

/** Activity drain accrued by time `tMs`, summed over all workouts (linear). */
function activityDrainAt(tMs: number, workouts: EnergyWorkout[]): number {
  let drain = 0;
  for (const w of workouts) {
    const pts = workoutDrainPoints(w);
    if (tMs <= w.startMs) continue;
    if (tMs >= w.endMs) {
      drain += pts;
      continue;
    }
    const span = Math.max(1, w.endMs - w.startMs);
    drain += pts * ((tMs - w.startMs) / span);
  }
  return drain;
}

function isInWorkout(tMs: number, workouts: EnergyWorkout[]): boolean {
  return workouts.some((w) => tMs > w.startMs && tMs < w.endMs);
}

export function energyAt(tMs: number, input: EnergyReserveInput): number {
  const morningEnergy = clampFloor(input.morningEnergy);
  if (tMs <= input.wakeMs) {
    // Charge phase: rise from BASE_MORNING → morningEnergy across the night.
    // Smoothstep (S-curve): gentle start, steepest mid-night, and a slight
    // saturation as it approaches the peak at wake — not a straight line.
    const span = Math.max(1, input.wakeMs - input.sleepOnsetMs);
    const frac = Math.max(0, Math.min(1, (tMs - input.sleepOnsetMs) / span));
    const eased = frac * frac * (3 - 2 * frac);
    return clampFloor(ENERGY.BASE_MORNING + (morningEnergy - ENERGY.BASE_MORNING) * eased);
  }
  const hoursAwake = (tMs - input.wakeMs) / 3_600_000;
  const baseDrain = ENERGY.DRAIN_BASE_PER_HOUR * hoursAwake;
  const actDrain = activityDrainAt(tMs, input.workouts);
  return clampFloor(morningEnergy - baseDrain - actDrain);
}

function phaseAt(tMs: number, input: EnergyReserveInput): EnergyPhase {
  if (tMs < input.wakeMs) return "charge";
  if (isInWorkout(tMs, input.workouts)) return "workout";
  return "drain";
}

export function computeEnergyReserve(
  input: EnergyReserveInput
): EnergyReserveResult {
  const stepMs = Math.max(1, input.stepMinutes ?? 10) * 60_000;
  const morningEnergy = clampFloor(input.morningEnergy);
  const start = input.sleepOnsetMs;
  const end = Math.max(start + stepMs, input.nowMs);

  // Build the set of sample times: a regular grid PLUS the critical
  // boundaries (wake + every workout edge) so the dashed/solid transitions
  // and the steeper workout dips land crisply.
  const times = new Set<number>();
  for (let t = start; t < end; t += stepMs) times.add(t);
  times.add(start);
  times.add(end);
  if (input.wakeMs > start && input.wakeMs < end) times.add(input.wakeMs);
  for (const w of input.workouts) {
    if (w.startMs > start && w.startMs < end) times.add(w.startMs);
    if (w.endMs > start && w.endMs < end) times.add(w.endMs);
  }
  const sortedTimes = Array.from(times).sort((a, b) => a - b);

  const samples: EnergySample[] = sortedTimes.map((t) => ({
    tMs: t,
    e: energyAt(t, input),
    // Phase of the segment to the RIGHT of this sample (use a nudge so a
    // sample sitting exactly on a boundary picks the upcoming segment).
    phase: phaseAt(t + 1, input),
  }));

  const current = energyAt(end, input);
  const totalCharged = Math.max(0, morningEnergy - ENERGY.BASE_MORNING);
  const totalDischarged = Math.max(0, morningEnergy - current);

  const events: EnergyEvent[] = [];
  // Sleep charge event (only when we actually have a night window).
  if (input.wakeMs > input.sleepOnsetMs) {
    events.push({
      kind: "sleep",
      startMs: input.sleepOnsetMs,
      endMs: input.wakeMs,
      label: "Primary Sleep",
      delta: totalCharged,
    });
  }
  for (const w of input.workouts) {
    // Only log COMPLETED workouts (ended on or before the curve end).
    if (w.endMs > end) continue;
    events.push({
      kind: "workout",
      startMs: w.startMs,
      endMs: w.endMs,
      label: w.activityType,
      delta: -workoutDrainPoints(w),
    });
  }
  events.sort((a, b) => a.startMs - b.startMs);

  return { morningEnergy, current, totalCharged, totalDischarged, samples, events };
}

/**
 * Morning reserve from the night's sleep: BASE_MORNING residual plus up to
 * SLEEP_CHARGE_MAX scaled by the night's quality (`sleepFraction`, 0..1 =
 * sleep score / 100 or minutes / target).
 */
export function morningEnergyFromSleep(sleepFraction: number): number {
  const f = Math.max(0, Math.min(1, Number.isFinite(sleepFraction) ? sleepFraction : 0));
  return Math.round(ENERGY.BASE_MORNING + ENERGY.SLEEP_CHARGE_MAX * f);
}

/**
 * Lightweight end-of-day + peak estimate for the month calendar — avoids a
 * full per-day stage/curve build. Assumes a ~16 h waking window.
 */
export function estimateDayBattery(
  morningEnergy: number,
  activityDrainTotal: number
): { endLevel: number; maxLevel: number } {
  const wakingHours = 16;
  const baseDrain = ENERGY.DRAIN_BASE_PER_HOUR * wakingHours;
  const endLevel = clampFloor(morningEnergy - baseDrain - activityDrainTotal);
  return { endLevel: Math.round(endLevel), maxLevel: Math.round(clampFloor(morningEnergy)) };
}
