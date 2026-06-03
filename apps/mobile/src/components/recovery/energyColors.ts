/**
 * Shared Energy Reserve colour zones — used by the compact card, the deep-dive
 * battery, the calendar and the curve so every surface agrees on what a level
 * "means". Mirrors the user's spec: above 50% is good (green), 0–50% is a
 * warning (amber), below 0% is depleted (red).
 */
export const ENERGY_GREEN = "#4ED164";
export const ENERGY_AMBER = "#F4B36A";
export const ENERGY_RED = "#F2615C";
export const ENERGY_GREY = "rgba(255,255,255,0.10)";

/**
 * Level → zone colour. Zones: above 50% green, 25–50% amber, below 25% red.
 * `null` (no data) falls back to a muted grey.
 */
export function energyLevelColor(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return "rgba(255,255,255,0.4)";
  if (pct > 50) return ENERGY_GREEN;
  if (pct >= 25) return ENERGY_AMBER;
  return ENERGY_RED;
}

/** Zone colour for the under-curve overlay (assumes the value is above 0). */
export function energyZoneColor(e: number): string {
  if (e > 50) return ENERGY_GREEN;
  if (e >= 25) return ENERGY_AMBER;
  return ENERGY_RED;
}
