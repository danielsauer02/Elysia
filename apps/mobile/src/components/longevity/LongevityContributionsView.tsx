/**
 * LongevityContributionsView
 *
 * Renders the day's (or window's) per-pillar healthspan minute deltas as two
 * stacked columns:
 *   - Drivers (positive contributions, sorted desc)
 *   - Drains  (negative contributions, sorted asc by magnitude)
 *
 * Replaces the older WaterfallChart inside LongevityPerformanceView.
 *
 * Pure presentation. Data comes from `useLongevityData().contributions`.
 */

import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radii } from "@/theme";
import type { LongevityContribution } from "@/components/ui/LongevityPerformanceView";
import {
  LAYER_TO_PILLARS,
  LAYER_META,
  type PillarId,
  type WheelLayerId,
} from "@/lib/displayLayers";

// ─── Helpers ────────────────────────────────────────────────────────────────

const PILLAR_TO_LAYER: Partial<Record<PillarId, WheelLayerId>> = (() => {
  const out: Partial<Record<PillarId, WheelLayerId>> = {};
  for (const layerId of Object.keys(LAYER_TO_PILLARS) as WheelLayerId[]) {
    for (const pillar of LAYER_TO_PILLARS[layerId]) out[pillar] = layerId;
  }
  return out;
})();

function colorFor(category: string): string {
  const layerId = PILLAR_TO_LAYER[category as PillarId];
  if (layerId) return LAYER_META[layerId].color;
  return colors.accent;
}

function formatDelta(min: number): string {
  const abs = Math.abs(min);
  const sign = min >= 0 ? "+" : "−";
  if (abs >= 60) {
    const h = Math.floor(abs / 60);
    const m = Math.round(abs % 60);
    return m > 0 ? `${sign}${h}h${m}m` : `${sign}${h}h`;
  }
  return `${sign}${Math.round(abs)}m`;
}

// ─── Row ────────────────────────────────────────────────────────────────────

function ContributionRow({
  item,
  rationale,
  maxAbs,
}: {
  item: LongevityContribution;
  rationale?: string;
  maxAbs: number;
}) {
  const color = colorFor(item.category);
  const widthPct = maxAbs > 0
    ? Math.max(8, Math.min(100, (Math.abs(item.deltaMinutes) / maxAbs) * 100))
    : 0;

  return (
    <View style={rowStyles.row}>
      <View style={[rowStyles.iconWrap, { backgroundColor: color + "20" }]}>
        <Ionicons name={item.icon} size={14} color={color} />
      </View>
      <View style={rowStyles.body}>
        <View style={rowStyles.headerRow}>
          <Text style={rowStyles.label} numberOfLines={1}>
            {item.label}
          </Text>
          <Text style={[rowStyles.delta, { color }]}>
            {formatDelta(item.deltaMinutes)}
          </Text>
        </View>
        <View style={rowStyles.track}>
          <View
            style={[
              rowStyles.bar,
              { width: `${widthPct}%`, backgroundColor: color },
            ]}
          />
        </View>
        {rationale ? (
          <Text style={rowStyles.rationale} numberOfLines={2}>
            {rationale}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 4 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  label: { fontSize: 13, fontWeight: "700", color: colors.textPrimary, flex: 1 },
  delta: { fontSize: 13, fontWeight: "800" },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  bar: { height: 4, borderRadius: 2 },
  rationale: { fontSize: 11, color: colors.textTertiary, lineHeight: 14 },
});

// ─── View ───────────────────────────────────────────────────────────────────

export interface LongevityContributionsViewProps {
  contributions: LongevityContribution[];
  /** Optional per-pillar rationale (from getLongevityContributionTotals.totals[].lastRationale). */
  rationaleByPillar?: Record<string, string>;
  /** Header copy. */
  title?: string;
  subtitle?: string;
}

export function LongevityContributionsView({
  contributions,
  rationaleByPillar,
  title = "Healthspan contributions",
  subtitle = "Minutes added / lost vs your personal baseline.",
}: LongevityContributionsViewProps) {
  const { drivers, drains, maxAbs } = useMemo(() => {
    const drivers = contributions
      .filter((c) => c.deltaMinutes > 0)
      .sort((a, b) => b.deltaMinutes - a.deltaMinutes);
    const drains = contributions
      .filter((c) => c.deltaMinutes < 0)
      .sort((a, b) => a.deltaMinutes - b.deltaMinutes);
    const maxAbs = Math.max(
      1,
      ...contributions.map((c) => Math.abs(c.deltaMinutes))
    );
    return { drivers, drains, maxAbs };
  }, [contributions]);

  if (contributions.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="hourglass-outline" size={20} color={colors.textTertiary} />
        <Text style={styles.emptyLabel}>
          No contributions yet — they appear after baseline is ready.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headerBlock}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <View style={styles.columns}>
        <View style={styles.column}>
          <Text style={[styles.columnTitle, { color: colors.success }]}>
            DRIVERS
          </Text>
          {drivers.length === 0 ? (
            <Text style={styles.columnEmpty}>None today.</Text>
          ) : (
            drivers.map((c) => (
              <ContributionRow
                key={`d-${c.category}`}
                item={c}
                rationale={rationaleByPillar?.[c.category]}
                maxAbs={maxAbs}
              />
            ))
          )}
        </View>
        <View style={styles.column}>
          <Text style={[styles.columnTitle, { color: colors.destructive }]}>
            DRAINS
          </Text>
          {drains.length === 0 ? (
            <Text style={styles.columnEmpty}>None today.</Text>
          ) : (
            drains.map((c) => (
              <ContributionRow
                key={`x-${c.category}`}
                item={c}
                rationale={rationaleByPillar?.[c.category]}
                maxAbs={maxAbs}
              />
            ))
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  headerBlock: { gap: 2 },
  title: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  subtitle: { fontSize: 11, color: colors.textTertiary, lineHeight: 15 },
  columns: { flexDirection: "row", gap: spacing.md },
  column: { flex: 1, gap: 2 },
  columnTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  columnEmpty: {
    fontSize: 12,
    color: colors.textTertiary,
    fontStyle: "italic",
    paddingVertical: spacing.sm,
  },
  empty: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
  },
  emptyLabel: { flex: 1, fontSize: 12, color: colors.textTertiary, lineHeight: 16 },
});
