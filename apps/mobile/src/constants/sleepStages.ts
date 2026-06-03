/**
 * sleepStages
 *
 * Single source of truth for the four sleep-stage identities used across
 * the deep-dive: colours, labels, the chart stacking order (Awake on top,
 * Deep at the bottom — Bevel/Apple-Health convention) and the 2x2 grid
 * order (Awake, REM, Light/Core, Deep — Bevel layout).
 *
 * Palette is tuned for clear separation while staying in the indigo /
 * cyan family of the rest of the sleep UI:
 *   • Awake → orange   (a warm "you were up" accent, away from the blues)
 *   • REM   → cyan      (matches recovery accent)
 *   • Light → lavender  (light indigo)
 *   • Deep  → deep indigo (clearly darker than Light)
 */
import type { SleepStageId } from "@/context/SleepContext";

export const STAGE_COLORS: Record<SleepStageId, string> = {
  awake: "#FB923C", // orange 400
  rem: "#22D3EE", // cyan 400
  light: "#A5B4FC", // indigo 300 (lavender)
  deep: "#4F46E5", // indigo 600 (deep)
};

export const STAGE_LABELS: Record<SleepStageId, string> = {
  awake: "Awake",
  rem: "REM",
  light: "Light",
  deep: "Deep",
};

/** Top → bottom y-axis order for the hypnogram (Awake highest). */
export const CHART_ORDER: SleepStageId[] = ["awake", "rem", "light", "deep"];

/** Reading order for the 2x2 tile grid (Bevel: Awake, REM, Light, Deep). */
export const GRID_ORDER: SleepStageId[] = ["awake", "rem", "light", "deep"];

/**
 * Typical / optimal share of the night per stage, expressed as a
 * PERCENTAGE of total sleep (time in bed). Percentages keep the tile
 * bars scale-true: the axis is the same (0..total minutes) for every
 * tile, so an equal horizontal distance always means equal minutes, and
 * the optimal band lands at the same %-position the headline % uses.
 *
 * Bands are deliberately tight (little interpretation room). Sourced
 * from standard adult sleep-architecture guidance:
 *   • Awake : a few % only — you want very little wake time
 *   • Light : ~half the night
 *   • REM   : ~a fifth
 *   • Deep  : ~a sixth
 */
export const TYPICAL_RANGE_PCT: Record<SleepStageId, [number, number]> = {
  awake: [2, 8],
  rem: [18, 25],
  light: [45, 55],
  deep: [13, 23],
};

/** Convert a stage's %-band into an absolute [min,max] minute band. */
export function typicalRangeMinutes(
  stage: SleepStageId,
  totalMinutes: number
): [number, number] {
  const [lo, hi] = TYPICAL_RANGE_PCT[stage];
  return [(lo / 100) * totalMinutes, (hi / 100) * totalMinutes];
}

/** "1:30", "0:06", "4:07" — hours:minutes, minutes zero-padded. */
export function fmtHourMin(min: number | null): string {
  if (min === null || !Number.isFinite(min) || min < 0) return "—";
  const total = Math.round(min);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

/** Whole-percent of total, e.g. "23%". */
export function fmtPctOfTotal(min: number | null, total: number | null): string {
  if (min === null || total === null || total <= 0) return "—";
  return `${Math.round((min / total) * 100)}%`;
}

/** 24h clock label "23:30" from an ISO timestamp. */
export function fmtClock(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}
