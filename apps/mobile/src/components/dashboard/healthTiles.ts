/**
 * Health Data tile catalogue.
 *
 * Single source of truth for every tile that can appear in the dashboard's
 * Health Data grid. The grid renders whatever IDs the user has enabled (in
 * the order they have arranged), and the Edit sheet lists the rest under
 * "Available tiles". Adding a new tile is a one-entry change here.
 *
 * Each catalogue entry exposes a pure `pickValue(row)` so the grid component
 * stays dumb and provider-agnostic — when a wearable does not emit a given
 * field, `pickValue` returns null, and the tile renders an em dash instead
 * of an error state.
 */
import { Ionicons } from "@expo/vector-icons";

export type TileId =
  | "hrv"
  | "restingHr"
  | "steps"
  | "activeKcal"
  | "sleepTotal"
  | "restorativeSleep"
  | "sleepConsistency"
  | "sleepEfficiency"
  | "respiratoryRate"
  | "sleepDeep"
  | "sleepRem"
  | "sleepLight"
  | "skinTemperature"
  | "strain";

/** Default tiles shown to a user who has never customised the grid. */
export const DEFAULT_TILE_IDS: TileId[] = [
  "hrv",
  "restingHr",
  "steps",
  "activeKcal",
  "sleepTotal",
  "restorativeSleep",
  "strain",
];

/**
 * Subset of `wearableDailyMetrics` fields the catalogue may read from.
 * Kept loose so callers can pass `useQuery(api.wearables.getDailyMetrics)[0]`
 * directly without adapter boilerplate.
 */
export type WearableDailyRow = {
  steps?: number;
  activeKcal?: number;
  basalKcal?: number;
  workoutKcal?: number;
  totalKcal?: number;
  strainScore?: number;
  restingHrBpm?: number;
  hrAvgBpm?: number;
  hrvAvgMs?: number;
  spo2AvgPct?: number;
  respiratoryRateAvg?: number;
  vo2Max?: number;
  sleepMinutes?: number;
  sleepDeepMinutes?: number;
  sleepRemMinutes?: number;
  sleepLightMinutes?: number;
  sleepAwakeMinutes?: number;
  skinTempCelsius?: number;
  sleepPerformancePct?: number;
  sleepEfficiencyPct?: number;
  sleepConsistencyPct?: number;
};

export interface TileDefinition {
  id: TileId;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  unit?: string;
  /** Short caption shown in the empty state and the Edit sheet. */
  sub: string;
  /** Pulls the tile's value from a daily metrics row. Returns null if absent. */
  pickValue: (row: WearableDailyRow | null | undefined) => number | null;
  /** Optional formatter; default is `Math.round(value).toString()`. */
  format?: (value: number) => string;
}

const fmtInt = (n: number) => Math.round(n).toLocaleString();
const fmtOneDecimal = (n: number) => n.toFixed(1);
const minutesToHm = (m: number) => {
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return h === 0 ? `${r}m` : `${h}h ${r}m`;
};

export const TILE_CATALOGUE: Record<TileId, TileDefinition> = {
  hrv: {
    id: "hrv",
    title: "HRV",
    icon: "pulse-outline",
    color: "#818CF8",
    unit: "ms",
    sub: "Heart rate variability",
    pickValue: (r) => r?.hrvAvgMs ?? null,
  },
  restingHr: {
    id: "restingHr",
    title: "Resting HR",
    icon: "heart-outline",
    color: "#F87171",
    unit: "bpm",
    sub: "Baseline cardiovascular",
    pickValue: (r) => r?.restingHrBpm ?? null,
  },
  steps: {
    id: "steps",
    title: "Steps",
    icon: "footsteps-outline",
    color: "#34D399",
    sub: "Apple Health / Health Connect",
    pickValue: (r) => r?.steps ?? null,
    format: fmtInt,
  },
  activeKcal: {
    id: "activeKcal",
    title: "Calorie burn",
    icon: "flame-outline",
    color: "#FB923C",
    unit: "kcal",
    sub: "Total daily energy expenditure",
    // Prefer whichever full-day total the provider reports:
    //   - `totalKcal` (Whoop /v2/cycle kilojoule, Garmin daily total)
    //   - basal + active (Apple Health / Health Connect)
    //   - active alone, then workouts-only (fallback chain)
    pickValue: (r) => {
      if ((r?.totalKcal ?? 0) > 0) return r!.totalKcal!;
      const basal = r?.basalKcal ?? null;
      const active = r?.activeKcal ?? null;
      if (basal !== null && active !== null) return basal + active;
      if (active !== null) return active;
      return r?.workoutKcal ?? null;
    },
  },
  sleepTotal: {
    id: "sleepTotal",
    title: "Sleep",
    icon: "moon-outline",
    color: "#A78BFA",
    sub: "Last night's sleep",
    pickValue: (r) => r?.sleepMinutes ?? null,
    format: minutesToHm,
  },
  restorativeSleep: {
    id: "restorativeSleep",
    title: "Restorative sleep",
    icon: "sparkles-outline",
    color: "#C084FC",
    sub: "REM + Deep sleep combined",
    pickValue: (r) => {
      const rem = r?.sleepRemMinutes ?? null;
      const deep = r?.sleepDeepMinutes ?? null;
      if (rem === null && deep === null) return null;
      return (rem ?? 0) + (deep ?? 0);
    },
    format: minutesToHm,
  },
  sleepConsistency: {
    id: "sleepConsistency",
    title: "Sleep consistency",
    icon: "calendar-outline",
    color: "#A78BFA",
    unit: "%",
    sub: "Bedtime / wake regularity",
    pickValue: (r) => r?.sleepConsistencyPct ?? null,
  },
  sleepEfficiency: {
    id: "sleepEfficiency",
    title: "Sleep efficiency",
    icon: "speedometer-outline",
    color: "#A78BFA",
    unit: "%",
    sub: "Asleep vs in-bed time",
    pickValue: (r) => r?.sleepEfficiencyPct ?? null,
  },
  respiratoryRate: {
    id: "respiratoryRate",
    title: "Respiratory rate",
    icon: "leaf-outline",
    color: "#22D3EE",
    unit: "bpm",
    sub: "Breaths per minute",
    pickValue: (r) => r?.respiratoryRateAvg ?? null,
    format: fmtOneDecimal,
  },
  sleepDeep: {
    id: "sleepDeep",
    title: "Deep sleep",
    icon: "moon-outline",
    color: "#7C3AED",
    sub: "Slow-wave restoration",
    pickValue: (r) => r?.sleepDeepMinutes ?? null,
    format: minutesToHm,
  },
  sleepRem: {
    id: "sleepRem",
    title: "REM sleep",
    icon: "cloud-outline",
    color: "#A78BFA",
    sub: "Cognitive recovery",
    pickValue: (r) => r?.sleepRemMinutes ?? null,
    format: minutesToHm,
  },
  sleepLight: {
    id: "sleepLight",
    title: "Light sleep",
    icon: "moon-outline",
    color: "#C4B5FD",
    sub: "Transitional stage",
    pickValue: (r) => r?.sleepLightMinutes ?? null,
    format: minutesToHm,
  },
  skinTemperature: {
    id: "skinTemperature",
    title: "Skin temperature",
    icon: "thermometer-outline",
    color: "#F472B6",
    unit: "°C",
    sub: "Nightly average vs baseline",
    pickValue: (r) => r?.skinTempCelsius ?? null,
    format: (n) => n.toFixed(1),
  },
  strain: {
    id: "strain",
    title: "Strain",
    icon: "trending-up-outline",
    color: "#22D3EE",
    sub: "Whoop daily strain (0–21)",
    pickValue: (r) => r?.strainScore ?? null,
    format: (n) => n.toFixed(1),
  },
};

export const ALL_TILE_IDS: TileId[] = Object.keys(TILE_CATALOGUE) as TileId[];

/** Returns true when `id` matches a known tile. Used to validate persisted prefs. */
export function isKnownTileId(id: string): id is TileId {
  return id in TILE_CATALOGUE;
}

/** Format a tile value for display, falling back to em-dash when null. */
export function formatTileValue(def: TileDefinition, value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return def.format ? def.format(value) : String(Math.round(value));
}
