/**
 * Central registry of all Elysia Health Score pillars.
 *
 * Spec: docs/analytics/scoring-model-v1.md §2.
 *
 * Tier 2/3 pillars are declared with `active: false` so they appear in the
 * UI as locked slots and surface in `dailyHealthScores.pillarScores` as
 * `null`, while staying excluded from composite math until a future model
 * bump flips them to `active: true`.
 */

import { computeActivityScore } from "./pillars/activity";
import { computeBodyBasicScore } from "./pillars/bodyBasic";
import { computeCardioScore } from "./pillars/cardio";
import { computeHabitScore } from "./pillars/habits";
import { computeNutritionScore } from "./pillars/nutrition";
import { computeRecoveryScore } from "./pillars/recovery";
import { computeSleepScore } from "./pillars/sleep";
import { computeStressScore } from "./pillars/stress";
import type { PillarDefinition, PillarId } from "./types";

const stub = () => null;

export const PILLAR_REGISTRY: ReadonlyArray<PillarDefinition> = [
  // ─── Tier 1 ─────────────────────────────────────────────────────────────
  {
    id: "sleep",
    label: "Sleep",
    tier: 1,
    weight: 0.18,
    lambda: 2.0,
    beta: 1.2,
    requiredSources: ["wearableDaily"],
    active: true,
    computeScore: (input) => computeSleepScore(input),
  },
  {
    id: "recovery",
    label: "Autonomic Recovery",
    tier: 1,
    weight: 0.13,
    lambda: 1.5,
    beta: 1.0,
    requiredSources: ["wearableDaily"],
    active: true,
    computeScore: (input, baseline) => computeRecoveryScore(input, baseline),
  },
  {
    id: "cardio",
    label: "Cardiorespiratory",
    tier: 1,
    weight: 0.20,
    lambda: 3.0,
    beta: 1.5,
    requiredSources: ["wearableDaily"],
    active: true,
    computeScore: (input) => computeCardioScore(input),
  },
  {
    id: "activity",
    label: "Daily Movement",
    tier: 1,
    weight: 0.09,
    lambda: 2.0,
    beta: 1.2,
    requiredSources: ["wearableDaily"],
    active: true,
    computeScore: (input) => computeActivityScore(input),
  },
  {
    id: "bodyBasic",
    label: "Body Basics",
    tier: 1,
    weight: 0.10,
    lambda: 1.5,
    beta: 0.8,
    requiredSources: ["weightLog"],
    active: true,
    computeScore: (input) => computeBodyBasicScore(input),
  },
  {
    id: "nutrition",
    label: "Nutrition Quality",
    tier: 1,
    weight: 0.15,
    lambda: 2.0,
    beta: 1.2,
    requiredSources: ["foodLog"],
    active: true,
    computeScore: (input) => computeNutritionScore(input),
  },
  {
    id: "habits",
    label: "Habit Consistency",
    tier: 1,
    weight: 0.05,
    lambda: 0.5,
    beta: 0.4,
    requiredSources: ["habitCompletions"],
    active: true,
    computeScore: (input) => computeHabitScore(input),
  },
  {
    id: "stress",
    label: "Stress & Mental Load",
    tier: 1,
    weight: 0.10,
    lambda: 1.5,
    beta: 1.0,
    requiredSources: ["wearableDaily"],
    active: true,
    computeScore: (input, baseline) => computeStressScore(input, baseline),
  },
  // ─── Tier 2 ─────────────────────────────────────────────────────────────
  {
    id: "blood",
    label: "Blood Biomarker Panel",
    tier: 2,
    weight: 0.18,
    lambda: 4.0,
    beta: 1.8,
    requiredSources: ["labPanel"],
    active: false,
    computeScore: stub,
  },
  {
    id: "bodyComp",
    label: "Body Composition",
    tier: 2,
    weight: 0.10,
    lambda: 2.0,
    beta: 1.0,
    requiredSources: ["bodyCompositionScan"],
    active: false,
    computeScore: stub,
  },
  {
    id: "metabolic",
    label: "Metabolic Rate",
    tier: 2,
    weight: 0.07,
    lambda: 1.0,
    beta: 0.6,
    requiredSources: ["labPanel"],
    active: false,
    computeScore: stub,
  },
  // ─── Tier 3 ─────────────────────────────────────────────────────────────
  {
    id: "skin",
    label: "Skin Age",
    tier: 3,
    weight: 0.05,
    lambda: 1.0,
    beta: 0.5,
    requiredSources: ["skinAssessment"],
    active: false,
    computeScore: stub,
  },
  {
    id: "hair",
    label: "Hair Health",
    tier: 3,
    weight: 0.03,
    lambda: 0.5,
    beta: 0.3,
    requiredSources: ["skinAssessment"],
    active: false,
    computeScore: stub,
  },
  {
    id: "genetic",
    label: "Genetic Profile",
    tier: 3,
    weight: 0.10,
    lambda: 2.5,
    beta: 1.2,
    requiredSources: ["geneticReport"],
    active: false,
    computeScore: stub,
  },
];

export const PILLARS_BY_ID: Readonly<Record<PillarId, PillarDefinition>> =
  PILLAR_REGISTRY.reduce(
    (acc, p) => {
      acc[p.id] = p;
      return acc;
    },
    {} as Record<PillarId, PillarDefinition>
  );

export function activePillars(): PillarDefinition[] {
  return PILLAR_REGISTRY.filter((p) => p.active);
}

export function pillarsByTier(tier: 1 | 2 | 3): PillarDefinition[] {
  return PILLAR_REGISTRY.filter((p) => p.tier === tier);
}
