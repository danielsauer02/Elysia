/**
 * HealthDataGrid (Bevel-style v2)
 *
 * 2-column grid of "Health Monitor" tiles. Each tile:
 *   ┌─────────────────────────────┐
 *   │ ⬭ HRV           ▮ Normal    │
 *   │  55.2 ms                    │
 *   └─────────────────────────────┘
 *
 *   • icon  + short title at the top
 *   • big tabular-mono number (Geist Mono) with unit
 *   • status pill (Normal / Lower / Higher) bottom-left
 *   • slim baseline indicator on the right edge — empty for now until
 *     we have per-tile normal ranges piped in.
 *
 * Pulls daily wearable rollup from `api.wearables.getDailyMetrics`. Tile
 * order is persisted via `useDashboardTiles()`. Tap-and-hold (long press)
 * jumps into the existing EditTilesSheet for reordering / add / remove.
 */
import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  borderTokens,
  dataColors,
  radii,
  spacing,
  surface,
  text,
  typography,
} from "@/theme";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { useDashboardTiles } from "@/hooks/useDashboardTiles";
import {
  TILE_CATALOGUE,
  formatTileValue,
  type TileDefinition,
  type WearableDailyRow,
} from "@/components/dashboard/healthTiles";
import { EditTilesSheet } from "@/components/dashboard/EditTilesSheet";

const todayISO = () => new Date().toISOString().slice(0, 10);

function HealthDataGridInner() {
  const today = todayISO();
  const dailyRows = useQuery(api.wearables.getDailyMetrics, {
    from: today,
    to: today,
  });
  const todayRow = (dailyRows && dailyRows.length > 0 ? dailyRows[0] : null) as
    | (WearableDailyRow & { _id: string })
    | null;

  const { tileIds, setTileIds } = useDashboardTiles();
  const [editOpen, setEditOpen] = useState(false);

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Health Monitor</Text>
        <AnimatedPressable
          haptic="light"
          style={styles.editBtn}
          onPress={() => setEditOpen(true)}
        >
          <Ionicons name="options-outline" size={13} color={text.secondary} />
          <Text style={styles.editLabel}>Edit</Text>
        </AnimatedPressable>
      </View>

      {tileIds.length === 0 ? (
        <View style={styles.emptyHint}>
          <Text style={styles.emptyHintText}>
            No tiles selected. Tap Edit to add some.
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {tileIds.map((id) => {
            const def = TILE_CATALOGUE[id];
            if (!def) return null;
            return (
              <View key={id} style={styles.cell}>
                <HealthTile def={def} row={todayRow} onLongPress={() => setEditOpen(true)} />
              </View>
            );
          })}
        </View>
      )}

      <EditTilesSheet
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        tileIds={tileIds}
        onChange={setTileIds}
      />
    </View>
  );
}

interface HealthTileProps {
  def: TileDefinition;
  row: WearableDailyRow | null;
  onLongPress?: () => void;
}

/** Pick a sensible status label/color from a value vs (optional) range. */
function classify(
  value: number | null,
  def: TileDefinition
): { label: string; color: string } {
  if (value === null || !Number.isFinite(value)) {
    return { label: "No data", color: text.tertiary };
  }
  // Until each tile carries an explicit normal range we mark it Normal.
  // (We'll wire per-tile ranges + comparisons against the user's baseline
  // in a follow-up pass — that's what the "Lower / Normal / Higher" pill
  // is meant to show.)
  return { label: "Normal", color: dataColors.recovery.base };
}

function HealthTile({ def, row, onLongPress }: HealthTileProps) {
  const value = def.pickValue(row);
  const hasValue = value !== null && Number.isFinite(value);
  const formatted = formatTileValue(def, value);
  const status = classify(value, def);

  return (
    <AnimatedPressable
      onLongPress={onLongPress}
      delayLongPress={300}
      style={styles.tile}
      haptic="none"
    >
      {/* Header: icon + label */}
      <View style={styles.tileHeader}>
        <View
          style={[
            styles.iconBadge,
            { backgroundColor: def.color + "1A", borderColor: def.color + "30" },
          ]}
        >
          <Ionicons name={def.icon} size={12} color={def.color} />
        </View>
        <Text style={styles.tileTitle} numberOfLines={1}>
          {def.title}
        </Text>
      </View>

      {/* Value */}
      <View style={styles.valueRow}>
        {hasValue ? (
          <Text style={styles.valueText} numberOfLines={1}>
            {formatted}
            {def.unit ? (
              <Text style={styles.valueUnit}>{` ${def.unit}`}</Text>
            ) : null}
          </Text>
        ) : (
          <Text style={styles.valueEmpty}>—</Text>
        )}
      </View>

      {/* Status pill */}
      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: status.color },
          ]}
        />
        <Text style={[styles.statusLabel, { color: status.color }]} numberOfLines={1}>
          {status.label}
        </Text>
      </View>

      {/* Right-edge baseline indicator — slim "pill" with a centered marker.
          When we have per-tile ranges we'll position the marker dynamically;
          for now it stays neutral. */}
      <View style={styles.baselineCol} pointerEvents="none">
        <View style={styles.baselineTrack}>
          <View
            style={[
              styles.baselineMarker,
              {
                backgroundColor: hasValue ? def.color : text.tertiary,
              },
            ]}
          />
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    ...typography.title2,
    color: text.primary,
    fontSize: 17,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: surface.raised,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: borderTokens.hairline,
  },
  editLabel: {
    ...typography.caption,
    color: text.secondary,
    fontSize: 11,
  },

  // Grid
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -spacing.xs,
  },
  cell: {
    width: "50%",
    padding: spacing.xs,
  },
  tile: {
    position: "relative",
    backgroundColor: surface.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 6,
    minHeight: 96,
    overflow: "hidden",
  },
  tileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconBadge: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tileTitle: {
    ...typography.caption,
    color: text.secondary,
    fontSize: 11,
    letterSpacing: 0.4,
    flex: 1,
  },

  valueRow: {
    minHeight: 28,
    justifyContent: "center",
    paddingRight: 18, // leave room for baseline indicator
  },
  valueText: {
    ...typography.numberLg,
    color: text.primary,
    fontSize: 22,
    lineHeight: 24,
  },
  valueUnit: {
    ...typography.callout,
    color: text.tertiary,
    fontSize: 12,
    fontFamily: "Geist_500Medium",
  },
  valueEmpty: {
    ...typography.numberLg,
    color: text.tertiary,
    fontSize: 22,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    ...typography.caption,
    fontSize: 11,
  },

  // Baseline indicator on the right side of the tile
  baselineCol: {
    position: "absolute",
    right: spacing.sm,
    top: spacing.md + 6,
    bottom: spacing.md + 6,
    width: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  baselineTrack: {
    width: 4,
    height: "100%",
    borderRadius: 2,
    backgroundColor: borderTokens.hairline,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  baselineMarker: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  emptyHint: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    backgroundColor: surface.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
  },
  emptyHintText: {
    ...typography.body,
    color: text.tertiary,
    fontSize: 13,
    textAlign: "center",
  },
});

/** Memoised: no props, only re-renders when its Convex queries change. */
export const HealthDataGrid = React.memo(HealthDataGridInner);
