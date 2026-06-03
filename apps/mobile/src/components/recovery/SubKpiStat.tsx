/**
 * SubKpiStat
 *
 * Recovery-hero sub-KPI tile. Unlike the sleep hero's `SubKpiBar` (a thin
 * progress strip), recovery shows the raw biometric as a large number with
 * its unit and a single quality dot — the readings (HRV ms, RHR bpm, sleep
 * %) are meaningful in absolute terms, so the number itself is the story.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fontFamily } from "@/theme";

interface Props {
  label: string;
  /** Pre-formatted value, e.g. "62" (unit shown separately). */
  value: string;
  unit: string;
  /** Quality dot colour, or null to hide the dot (no data). */
  dotColor: string | null;
}

const TILE_BG = "rgba(31, 39, 66, 0.62)";

export function SubKpiStat({ label, value, unit, dotColor }: Props) {
  return (
    <View style={styles.tile}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.unit}>{unit}</Text>
        {dotColor ? (
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    gap: 8,
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 12,
    backgroundColor: TILE_BG,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  label: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    color: "#FFFFFF",
    opacity: 0.92,
  },
  // Dot sits to the RIGHT of the unit, vertically centred against the big
  // number (alignItems:center on the row keeps it level with the digits).
  dot: { width: 7, height: 7, borderRadius: 3.5, marginLeft: 6 },
  valueRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  value: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 22,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  unit: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    color: colors.textTertiary,
  },
});
