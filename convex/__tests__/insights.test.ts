import { describe, expect, it } from "vitest";
import { buildCorrelationInsights } from "../insights";

const day = "2026-05-23";

function row(
  isoDay: string,
  scores: Record<string, number | null>
): { day: string; pillarScores: Record<string, number | null> } {
  return { day: isoDay, pillarScores: scores };
}

describe("buildCorrelationInsights", () => {
  it("returns nothing with fewer than 7 days of data", () => {
    const insights = buildCorrelationInsights(day, [
      row("2026-05-22", { sleep: 70, recovery: 75 }),
      row("2026-05-21", { sleep: 65, recovery: 60 }),
    ]);
    expect(insights).toEqual([]);
  });

  it("emits a positive insight when sleep and recovery move together", () => {
    const history = Array.from({ length: 14 }, (_, i) =>
      row(`2026-05-${String(i + 1).padStart(2, "0")}`, {
        sleep: 50 + i * 3,
        recovery: 55 + i * 3,
        activity: 50,
        nutrition: 50,
      })
    );
    const insights = buildCorrelationInsights(day, history);
    const sleepRecovery = insights.find((i) => i.title.includes("Sleep"));
    expect(sleepRecovery).toBeDefined();
    expect(sleepRecovery!.severity).toBe("positive");
  });

  it("skips pillar pairs with missing data on too many days", () => {
    const history = Array.from({ length: 14 }, (_, i) =>
      row(`2026-05-${String(i + 1).padStart(2, "0")}`, {
        sleep: 70 + i,
        recovery: null,
        activity: 60,
        nutrition: 60,
      })
    );
    const insights = buildCorrelationInsights(day, history);
    expect(insights.some((i) => i.title.toLowerCase().includes("recovery"))).toBe(false);
  });
});
