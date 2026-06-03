/**
 * hypnogram
 *
 * Turns the night's stage data into an ordered list of time-resolved
 * stage segments the chart can draw as a Bevel-style stepped area.
 *
 * Two data regimes:
 *
 *   1. RESOLVED  — a real smartband/SDK feed gives many short segments
 *      with distinct start/end times forming a timeline. We pass these
 *      through verbatim (sorted by start).
 *
 *   2. AGGREGATE — the current Whoop API only returns per-stage totals
 *      (`stage_summary`): four rows that all span the whole night. There
 *      is no real hypnogram to draw. We synthesise a *representative*
 *      one whose per-stage durations exactly match the totals and whose
 *      shape follows realistic sleep architecture (deep front-loaded,
 *      REM back-loaded, brief awakenings between cycles). It's a
 *      faithful illustration, not invented data — and the moment the
 *      smartband lands, regime (1) takes over automatically.
 */
import type { SleepStageId } from "@/context/SleepContext";

export interface HypnoSegment {
  stage: SleepStageId;
  start: number; // epoch ms
  end: number; // epoch ms
}

interface RawSegment {
  stage: string;
  start: string;
  end: string;
  minutes: number;
}

export interface StageTotals {
  deepMinutes: number | null;
  remMinutes: number | null;
  lightMinutes: number | null;
  awakeMinutes: number | null;
}

export interface BuiltHypnogram {
  segments: HypnoSegment[];
  /** True when the shape is synthesised from totals (no real timeline). */
  synthetic: boolean;
}

const STAGE_IDS: SleepStageId[] = ["awake", "rem", "light", "deep"];

function isStageId(s: string): s is SleepStageId {
  return (STAGE_IDS as string[]).includes(s);
}

/** Detect a genuine timeline: >2 segments AND not all sharing one window. */
function isResolved(segments: RawSegment[]): boolean {
  if (segments.length <= 2) return false;
  const windows = new Set(segments.map((s) => `${s.start}|${s.end}`));
  return windows.size > 1;
}

export function buildHypnogram(
  segments: RawSegment[],
  startIso: string | null,
  endIso: string | null,
  totals: StageTotals
): BuiltHypnogram {
  const startMs = startIso ? Date.parse(startIso) : NaN;
  const endMs = endIso ? Date.parse(endIso) : NaN;
  const validWindow =
    Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;

  if (isResolved(segments)) {
    const resolved = segments
      .filter((s) => isStageId(s.stage))
      .map((s) => ({
        stage: s.stage as SleepStageId,
        start: Date.parse(s.start),
        end: Date.parse(s.end),
      }))
      .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
      .sort((a, b) => a.start - b.start);
    if (resolved.length > 0) return { segments: resolved, synthetic: false };
  }

  if (!validWindow) return { segments: [], synthetic: true };

  return {
    segments: synthesize(startMs, endMs, totals),
    synthetic: true,
  };
}

/**
 * Build a believable cyclic hypnogram from per-stage totals.
 *
 * Strategy: split the night into ~90-minute cycles. Each cycle runs
 * light → deep → light → rem, with deep weighted to early cycles and
 * REM to late cycles. Awake is sprinkled at cycle boundaries. Per-stage
 * minute budgets are distributed across their slots so the totals match
 * exactly, then laid down sequentially across the real clock window.
 */
function synthesize(startMs: number, endMs: number, totals: StageTotals): HypnoSegment[] {
  const deep = Math.max(0, totals.deepMinutes ?? 0);
  const rem = Math.max(0, totals.remMinutes ?? 0);
  const light = Math.max(0, totals.lightMinutes ?? 0);
  const awake = Math.max(0, totals.awakeMinutes ?? 0);
  const totalMin = deep + rem + light + awake;
  if (totalMin <= 0) return [];

  const cycles = Math.max(3, Math.min(6, Math.round(totalMin / 90)));

  // Per-cycle weights.
  const deepW: number[] = [];
  const remW: number[] = [];
  let deepWSum = 0;
  let remWSum = 0;
  for (let i = 0; i < cycles; i++) {
    const dw = cycles - i; // front-loaded
    const rw = i + 1; // back-loaded
    deepW.push(dw);
    remW.push(rw);
    deepWSum += dw;
    remWSum += rw;
  }

  const deepPer = deepW.map((w) => (deepWSum ? (deep * w) / deepWSum : 0));
  const remPer = remW.map((w) => (remWSum ? (rem * w) / remWSum : 0));
  const lightPer = light / (cycles * 2); // two light slots per cycle
  const awakeSlots = Math.max(1, Math.min(cycles - 1, Math.round(awake / 8) || 1));
  const awakePer = awake / awakeSlots;

  // Build the ordered slot list (in minutes).
  type Slot = { stage: SleepStageId; minutes: number };
  const slots: Slot[] = [];
  for (let i = 0; i < cycles; i++) {
    if (lightPer > 0) slots.push({ stage: "light", minutes: lightPer });
    if (deepPer[i]! > 0) slots.push({ stage: "deep", minutes: deepPer[i]! });
    if (lightPer > 0) slots.push({ stage: "light", minutes: lightPer });
    if (remPer[i]! > 0) slots.push({ stage: "rem", minutes: remPer[i]! });
    // Awake between cycles (skip after the final cycle).
    if (awake > 0 && i < awakeSlots) {
      slots.push({ stage: "awake", minutes: awakePer });
    }
  }
  if (slots.length === 0) return [];

  // Lay the slots over the real clock window, scaling to fit exactly.
  const slotSum = slots.reduce((acc, s) => acc + s.minutes, 0);
  const spanMs = endMs - startMs;
  const out: HypnoSegment[] = [];
  let cursor = startMs;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!;
    const segMs = (slot.minutes / slotSum) * spanMs;
    const end = i === slots.length - 1 ? endMs : cursor + segMs;
    out.push({ stage: slot.stage, start: cursor, end });
    cursor = end;
  }
  return out;
}
