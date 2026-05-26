/**
 * ElysiaSummaryRings — three Whoop-style mini-rings at the top of the
 * Elysia (habits library) tab. Mirrors the Home-tab `DailySummaryRings`
 * trio for a consistent feel, but surfaces habit composition:
 *
 *   • ACTIVE      — habits currently being tracked (absolute count)
 *   • CONSISTENCY — avg 30-day completion across active habits (%)
 *   • PLANNED     — habits parked for later (absolute count)
 *
 * Wraps `DailySummaryRings` with `centerOverride` so the centers show
 * absolute integers (12) instead of percentages (12 %). The visual fill
 * still maps to a sensible 0–100 scale so progress reads at a glance.
 */
import React, { useMemo } from "react";
import {
  DailySummaryRings,
  type SummaryRingId,
  type SummaryRingValue,
} from "@/components/dashboard/DailySummaryRings";
import { useHabits } from "@/context/HabitsContext";
import { dataColors } from "@/theme";

/** Visual fill caps — picked so realistic habit counts look balanced. */
const ACTIVE_FULL_AT = 8;   // 8 active habits = ring 100%
const PLANNED_FULL_AT = 6;  // 6 planned habits = ring 100%

interface ElysiaSummaryRingsProps {
  width: number;
  compact?: boolean;
  onPressRing?: (id: SummaryRingId) => void;
}

/**
 * Hook variant — returns just the SummaryRingValue[] for callers that
 * want to drive `useStickyRingsHeader` (sticky variant on Elysia tab)
 * rather than rendering the standalone trio.
 */
export function useElysiaSummaryRingValues(): SummaryRingValue[] {
  const { habits } = useHabits();
  return useMemo(() => {
    const activeHabits = habits.filter((h) => h.state === "active");
    const plannedCount = habits.filter((h) => h.state === "planned").length;
    const activeCount = activeHabits.length;

    const avgConsistency =
      activeCount > 0
        ? Math.round(
            (activeHabits.reduce((s, h) => s + h.completionRate30d, 0) /
              activeCount) *
              100
          )
        : 0;

    return [
      {
        id: "active",
        label: "Active",
        value: Math.min(100, (activeCount / ACTIVE_FULL_AT) * 100),
        centerOverride: String(activeCount),
        color: { kind: "data", key: "habits" },
      },
      {
        id: "consistency",
        label: "Consistency",
        value: activeCount === 0 ? null : avgConsistency,
        unit: "%",
        color: { kind: "data", key: "recovery" },
      },
      {
        id: "planned",
        label: "Planned",
        value: Math.min(100, (plannedCount / PLANNED_FULL_AT) * 100),
        centerOverride: String(plannedCount),
        color: {
          kind: "custom",
          base: "#A78BFA",
          gradient: ["#C4B5FD", "#7C3AED"],
          glow: "rgba(167, 139, 250, 0.45)",
        },
      },
    ];
  }, [habits]);
}

export function ElysiaSummaryRings({
  width,
  compact = false,
  onPressRing,
}: ElysiaSummaryRingsProps) {
  const values = useElysiaSummaryRingValues();
  return (
    <DailySummaryRings
      values={values}
      width={width}
      compact={compact}
      onPressRing={onPressRing}
    />
  );
}

// Re-export for callers that want to wire navigation off ring presses
// without pulling DailySummaryRings directly.
export type { SummaryRingId };

// `dataColors` referenced by JSDoc — keep import warm so tree-shake
// doesn't strip it from typedef checks during dev.
void dataColors;
