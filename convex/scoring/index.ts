/**
 * Pure top-level orchestrator for the Elysia Health Score engine.
 *
 * Spec: docs/analytics/scoring-model-v1.md §6, §7.
 *
 * No Convex imports here so it can be unit-tested directly with vitest.
 * The Convex-side wrapper that loads inputs from the DB and persists the
 * result lives in `convex/scoring.ts` (action layer).
 */

import { computeComposite, emptyPillarMap } from "./composite";
import { PILLAR_REGISTRY } from "./pillarRegistry";
import type {
  BaselineContext,
  CompositeResult,
  PillarInput,
  PillarScoreMap,
} from "./types";

export const SCORE_MODEL_VERSION = "1.2.0" as const;

export interface DailyScoreResult {
  pillarScores: PillarScoreMap;
  composite: CompositeResult;
}

export function computeDailyScores(
  input: PillarInput,
  baseline: BaselineContext
): DailyScoreResult {
  const pillarScores = emptyPillarMap();
  for (const pillar of PILLAR_REGISTRY) {
    if (!pillar.active) {
      // Locked tier — stays null on purpose.
      continue;
    }
    try {
      pillarScores[pillar.id] = pillar.computeScore(input, baseline);
    } catch {
      pillarScores[pillar.id] = null;
    }
  }
  return {
    pillarScores,
    composite: computeComposite(pillarScores),
  };
}

export { computeComposite, emptyPillarMap } from "./composite";
export { PILLAR_REGISTRY, PILLARS_BY_ID, activePillars, pillarsByTier } from "./pillarRegistry";
export * from "./types";
