/**
 * Mobile-side mirror of `convex/scoring/displayLayers.ts`.
 *
 * Kept in sync manually: the engine ships the raw `layerScores` map; this
 * file owns the **render order, colors, labels, and tier metadata** that
 * the Longevity Wheel + Layer Detail Sheet consume.
 *
 * Why duplicated: bundling Convex source files into Metro pulls in the
 * whole pillar registry + dose-response code, which is dead weight on the
 * client. Mobile only needs the presentation contract.
 *
 * Pillar weights also live here so the LayerDetailSheet can show
 * pillar-weighted breakdowns without a round-trip.
 */

export const WHEEL_LAYER_IDS = [
  "recoverySleep",
  "stressPsyche",
  "movement",
  "cardioMetabolic",
  "nutrition",
  "biomarkers",
] as const;

export type WheelLayerId = (typeof WHEEL_LAYER_IDS)[number];

export type PillarId =
  | "sleep" | "recovery" | "cardio" | "activity"
  | "bodyBasic" | "nutrition" | "habits" | "stress"
  | "blood" | "bodyComp" | "metabolic" | "skin" | "hair" | "genetic";

export const LAYER_TO_PILLARS: Record<WheelLayerId, PillarId[]> = {
  recoverySleep:   ["sleep", "recovery"],
  stressPsyche:    ["stress"],
  movement:        ["activity"],
  cardioMetabolic: ["cardio", "bodyBasic"],
  nutrition:       ["nutrition"],
  biomarkers:      ["blood", "bodyComp", "metabolic", "skin", "hair", "genetic"],
};

export interface LayerMeta {
  id: WheelLayerId;
  label: string;
  shortLabel: string;
  color: string;
  tier: 1 | 2 | 3;
  /** Render order, outer (0) -> inner (5). */
  order: number;
}

export const LAYER_META: Record<WheelLayerId, LayerMeta> = {
  recoverySleep:   { id: "recoverySleep",   label: "Sleep & Recovery",     shortLabel: "Sleep & Recovery", color: "#7DD3FC", tier: 1, order: 0 },
  stressPsyche:    { id: "stressPsyche",    label: "Stress & Mind",        shortLabel: "Stress & Mind",    color: "#C4B5FD", tier: 1, order: 1 },
  movement:        { id: "movement",        label: "Movement",             shortLabel: "Movement",         color: "#FCD34D", tier: 1, order: 2 },
  cardioMetabolic: { id: "cardioMetabolic", label: "Cardio & Metabolic",   shortLabel: "Cardio",           color: "#F472B6", tier: 1, order: 3 },
  nutrition:       { id: "nutrition",       label: "Nutrition",            shortLabel: "Nutrition",        color: "#86EFAC", tier: 1, order: 4 },
  biomarkers:      { id: "biomarkers",      label: "Biomarkers",           shortLabel: "Biomarkers",       color: "#A8A29E", tier: 2, order: 5 },
};

export const LAYER_META_ORDERED: ReadonlyArray<LayerMeta> = WHEEL_LAYER_IDS.map(
  (id) => LAYER_META[id]
);

/** Tier 1 pillar weights mirrored from v1.2.0 (must match pillarRegistry). */
export const PILLAR_WEIGHTS: Partial<Record<PillarId, number>> = {
  sleep: 0.18,
  recovery: 0.13,
  cardio: 0.20,
  activity: 0.09,
  bodyBasic: 0.10,
  nutrition: 0.15,
  habits: 0.05,
  stress: 0.10,
};

export const PILLAR_LABELS: Record<PillarId, string> = {
  sleep: "Sleep",
  recovery: "Autonomic Recovery",
  cardio: "Cardiorespiratory",
  activity: "Daily Movement",
  bodyBasic: "Body Basics",
  nutrition: "Nutrition",
  habits: "Habits",
  stress: "Stress & Mental Load",
  blood: "Blood Panel",
  bodyComp: "Body Composition",
  metabolic: "Metabolic Rate",
  skin: "Skin Age",
  hair: "Hair Health",
  genetic: "Genetic Profile",
};
