/**
 * Shared constants for longevity calculations and display.
 * Single source of truth — imported by AgingCurveChart, LongevityPerformanceView,
 * and dashboard screens.
 */

/** Maximum age shown on charts and used as the Y-axis cap. */
export const MAX_LIFESPAN_AGE = 105;

/** Aging index scale displayed on the number line (0.75 = aging 25% slower). */
export const AGING_INDEX_MIN = 0.75;
export const AGING_INDEX_MAX = 1.5;
export const AGING_INDEX_TICKS = [0.75, 1.0, 1.25, 1.5] as const;

/**
 * Average life expectancy by sex (2026 medical research, global developed-country avg).
 * Used for Y-axis highlight and projected life expectancy calculation.
 */
export const LIFE_EXPECTANCY_BY_SEX: Record<"male" | "female", number> = {
  male: 82,
  female: 86,
};

/**
 * Compute the aging index (ratio of biological to chronological aging rate).
 * Values <1 indicate aging slower than average; >1 indicates faster.
 */
export function computeAgingIndex(bioAge: number, chronoAge: number): number {
  if (chronoAge <= 0) return 1;
  return bioAge / chronoAge;
}

/**
 * Compute the projected life expectancy given the user's current aging index.
 * Caps at MAX_LIFESPAN_AGE.
 */
export function computeProjectedLifeExpectancy(
  lifeExpectancy: number,
  agingIndex: number
): number {
  if (agingIndex <= 0) return lifeExpectancy;
  return Math.min(MAX_LIFESPAN_AGE, lifeExpectancy / agingIndex);
}
