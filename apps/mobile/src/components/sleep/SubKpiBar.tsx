/**
 * SubKpiBar
 *
 * Thin 0..100 progress strip. The fill colour is overridable but
 * defaults to off-white — the hero pairs this bar with a coloured dot
 * next to the KPI label, so the bar itself stays neutral. Pass an
 * explicit `color` only when the caller needs a per-row tint (e.g. the
 * sleep-trend D-view contributor cards).
 *
 * Hidden when `value === null` (the parent should render the dash).
 */
import React from "react";
import { View } from "react-native";

interface Props {
  value: number | null;
  /** Number for fixed width, or undefined to stretch to parent. */
  width?: number;
  height?: number;
  /** Optional fill colour. Defaults to off-white. */
  color?: string;
}

export function SubKpiBar({
  value,
  width,
  height = 4,
  color = "rgba(255,255,255,0.9)",
}: Props) {
  const filled = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <View
      style={{
        width: width ?? "100%",
        height,
        borderRadius: height / 2,
        backgroundColor: "rgba(255,255,255,0.08)",
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${filled}%`,
          height: "100%",
          borderRadius: height / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
