import { describe, expect, it } from "vitest";
import {
  LAYER_META,
  LAYER_TO_PILLARS,
  WHEEL_LAYER_IDS,
  computeLayerScores,
} from "../scoring/displayLayers";
import { PILLARS_BY_ID } from "../scoring/pillarRegistry";

describe("displayLayers metadata", () => {
  it("exposes exactly 6 layers", () => {
    expect(WHEEL_LAYER_IDS).toHaveLength(6);
    expect(Object.keys(LAYER_META).sort()).toEqual([...WHEEL_LAYER_IDS].sort());
  });

  it("every mapped pillar is registered", () => {
    for (const layerId of WHEEL_LAYER_IDS) {
      for (const pid of LAYER_TO_PILLARS[layerId]) {
        expect(PILLARS_BY_ID[pid]).toBeDefined();
      }
    }
  });

  it("habits is not assigned to any wheel layer", () => {
    const all = Object.values(LAYER_TO_PILLARS).flat();
    expect(all).not.toContain("habits");
  });
});

describe("computeLayerScores", () => {
  it("returns nulls for an empty pillar map", () => {
    const out = computeLayerScores({});
    for (const id of WHEEL_LAYER_IDS) expect(out[id]).toBeNull();
  });

  it("collapses recoverySleep to weighted avg of sleep + recovery", () => {
    const sleepW = PILLARS_BY_ID.sleep.weight;     // 0.18
    const recovW = PILLARS_BY_ID.recovery.weight;  // 0.13
    const out = computeLayerScores({ sleep: 80, recovery: 60 });
    const expected = Math.round(
      (80 * sleepW + 60 * recovW) / (sleepW + recovW)
    );
    expect(out.recoverySleep).toBe(expected);
  });

  it("passes a single-pillar layer through unchanged", () => {
    const out = computeLayerScores({ stress: 73, activity: 41, nutrition: 95 });
    expect(out.stressPsyche).toBe(73);
    expect(out.movement).toBe(41);
    expect(out.nutrition).toBe(95);
  });

  it("biomarkers stays null until any Tier 2/3 pillar lights up", () => {
    const out = computeLayerScores({ sleep: 80 });
    expect(out.biomarkers).toBeNull();
  });

  it("partial coverage: layer averages only the non-null pillars", () => {
    const out = computeLayerScores({ sleep: 90, recovery: null });
    expect(out.recoverySleep).toBe(90);
  });
});
