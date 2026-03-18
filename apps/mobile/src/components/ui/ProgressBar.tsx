import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radii } from "@/theme";

interface ProgressBarProps {
  value: number;
  color?: string;
  trackColor?: string;
  height?: number;
  showLabel?: boolean;
  label?: string;
}

export function ProgressBar({
  value,
  color = colors.accent,
  trackColor = colors.surface,
  height = 6,
  showLabel = false,
  label,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value));

  return (
    <View style={styles.container}>
      <View style={[styles.track, { height, backgroundColor: trackColor }]}>
        <View
          style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color, height }]}
        />
      </View>
      {showLabel ? (
        <Text style={styles.labelText}>{label ?? `${Math.round(pct * 100)}%`}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  track: {
    flex: 1,
    borderRadius: radii.full,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  fill: {
    borderRadius: radii.full,
  },
  labelText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textTertiary,
    minWidth: 36,
    textAlign: "right",
  },
});
