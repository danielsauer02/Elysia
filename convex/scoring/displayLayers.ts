/**
 * UI-only mapping of the 7-pillar Elysia engine onto 6 concentric layers
 * displayed in the mobile Longevity Wheel. Pure presentation logic - the
 * engine and tests never depend on this file.
 *
 * Spec: docs/analytics/scoring-model-v1.md §2.4 (Wheel Layers).
 */

import { PILLARS_BY_ID } from "./pillarRegistry";
import type { PillarId } from "./types";

export const WHEEL_LAYER_IDS = [
  "recoverySleep",
  "stressPsyche",
  "movement",
  "cardioMetabolic",
  "nutrition",
  "biomarkers",
] as const;

export type WheelLayerId = (typeof WHEEL_LAYER_IDS)[number];

/**
 * Each layer aggregates one or more pillars. Habits is intentionally not
 * placed in any layer — it surfaces as a separate "Consistency" pill in the
 * UI under the wheel.
 */
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
  /** Tier required to unlock real data for this layer. */
  tier: 1 | 2 | 3;
  /** Render order, outer (0) -> inner (5). */
  order: number;
}

export const LAYER_META: Record<WheelLayerId, LayerMeta> = {
  recoverySleep: {
    id: "recoverySleep",
    label: "Sleep & Recovery",
    shortLabel: "Sleep",
    color: "#7DD3FC",
    tier: 1,
    order: 0,
  },
  stressPsyche: {
    id: "stressPsyche",
    label: "Stress & Mind",
    shortLabel: "Stress",
    color: "#C4B5FD",
    tier: 1,
    order: 1,
  },
  movement: {
    id: "movement",
    label: "Movement",
    shortLabel: "Move",
    color: "#FCD34D",
    tier: 1,
    order: 2,
  },
  cardioMetabolic: {
    id: "cardioMetabolic",
    label: "Cardio & Metabolic",
    shortLabel: "Cardio",
    color: "#F472B6",
    tier: 1,
    order: 3,
  },
  nutrition: {
    id: "nutrition",
    label: "Nutrition",
    shortLabel: "Nutri",
    color: "#86EFAC",
    tier: 1,
    order: 4,
  },
  biomarkers: {
    id: "biomarkers",
    label: "Biomarkers",
    shortLabel: "Bio",
    color: "#A8A29E",
    tier: 2,
    order: 5,
  },
};

export const LAYER_META_ORDERED: ReadonlyArray<LayerMeta> = WHEEL_LAYER_IDS.map(
  (id) => LAYER_META[id]
);

/**
 * Aggregates a pillar -> score map into a layer -> score map. Each layer
 * score is the pillar-weight-weighted average of its constituent pillar
 * scores. Layers whose pillars are all null (or have zero combined weight)
 * collapse to null.
 *
 * Pure function. Idempotent. Safe to call on partial pillar maps.
 */
export function computeLayerScores(
  pillarScores: Partial<Record<PillarId, number | null>>
): Record<WheelLayerId, number | null> {
  const out = {} as Record<WheelLayerId, number | null>;

  for (const layerId of WHEEL_LAYER_IDS) {
    const pillars = LAYER_TO_PILLARS[layerId];
    let weighted = 0;
    let total = 0;
    for (const pid of pillars) {
      const def = PILLARS_BY_ID[pid];
      const score = pillarScores[pid];
      if (score === null || score === undefined || !def) continue;
      weighted += score * def.weight;
      total += def.weight;
    }
    out[layerId] = total > 0 ? Math.round(weighted / total) : null;
  }

  return out;
}
