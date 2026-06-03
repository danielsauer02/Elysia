/**
 * OptimalRangeLegend
 *
 * Tiny key that matches the visual the bar/line charts draw for the
 * optimal range: two thin dashed horizontal lines with a tinted-green
 * fill between them. Lives outside the chart card so it never overlaps
 * the X-axis date anchors.
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import { colors, fontFamily, semantic } from "@/theme";

export function OptimalRangeLegend() {
  const w = 22;
  const h = 12;
  return (
    <View style={styles.row}>
      <Svg width={w} height={h}>
        <Rect x={0} y={2} width={w} height={h - 4} fill={semantic.success} opacity={0.18} />
        <Line
          x1={0}
          y1={2}
          x2={w}
          y2={2}
          stroke={semantic.success}
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.85}
        />
        <Line
          x1={0}
          y1={h - 2}
          x2={w}
          y2={h - 2}
          stroke={semantic.success}
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.85}
        />
      </Svg>
      <Text style={styles.text}>Optimal range</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "center",
  },
  text: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    color: colors.textTertiary,
  },
});
