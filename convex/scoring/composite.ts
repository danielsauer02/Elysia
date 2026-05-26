/**
 * Composite Elysia Health Score.
 *
 * Spec: docs/analytics/scoring-model-v1.md §7.
 *
 * Combines available pillar scores into a single 0..100 figure, while
 * computing tierLevel and Tier-1 coverage so the UI can label the score
 * honestly ("Tier 1 only" vs "Tier 1+2").
 */

import { ALL_PILLAR_IDS, type PillarScoreMap } from "./types";
import {
  PILLAR_REGISTRY,
  PILLARS_BY_ID,
  pillarsByTier,
} from "./pillarRegistry";
import type { CompositeResult, PillarId } from "./types";

export function emptyPillarMap(): PillarScoreMap {
  const map = {} as PillarScoreMap;
  for (const id of ALL_PILLAR_IDS) map[id] = null;
  return map;
}

/**
 * Composite + coverage + tierLevel from a pillar score map. Pillars with
 * `score=null` OR `active=false` are excluded from the numerator/denominator.
 */
export function computeComposite(scores: PillarScoreMap): CompositeResult {
  const activeContributing: PillarId[] = [];
  let weighted = 0;
  let weightSum = 0;
  let highestTier: 1 | 2 | 3 | null = null;

  for (const pillar of PILLAR_REGISTRY) {
    if (!pillar.active) continue;
    const score = scores[pillar.id];
    if (score === null || score === undefined) continue;
    activeContributing.push(pillar.id);
    weighted += score * pillar.weight;
    weightSum += pillar.weight;
    if (highestTier === null || pillar.tier > highestTier) {
      highestTier = pillar.tier;
    }
  }

  const composite =
    weightSum > 0 ? Math.round(weighted / weightSum) : null;

  const tier1Total = pillarsByTier(1).filter((p) => p.active).length;
  const tier1Active = activeContributing.filter(
    (id) => PILLARS_BY_ID[id].tier === 1
  ).length;
  const coverage = tier1Total > 0 ? tier1Active / tier1Total : 0;

  return {
    composite,
    tierLevel: highestTier,
    coverage,
    activePillarIds: activeContributing,
  };
}
