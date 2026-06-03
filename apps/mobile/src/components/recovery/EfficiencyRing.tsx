/**
 * EfficiencyRing
 *
 * Small standalone 0–100 progress ring used by the recovery recommendation
 * stack to surface a habit's per-user efficiency score. A SVG arc (no Skia)
 * keeps it cheap enough to render N of them in a list / card stack.
 *
 * The ring is always green and fills proportionally to the score — a habit's
 * efficiency is a positive opportunity, so the color shouldn't read as a
 * warning. The arc length alone communicates magnitude.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { semantic } from "@/theme";

/** Always-green ring; magnitude is shown by the arc length, not hue. */
const RING_GREEN = semantic.success;

export interface EfficiencyRingProps {
  /** 0..100. Out-of-range values are clamped. */
  value: number;
  /** Outer size in px (square). Stroke scales proportionally. */
  size?: number;
  /** Optional small label below the ring (default "Efficiency"). */
  label?: string | null;
  /** Override the ring color. Defaults to green. */
  color?: string;
}

export function EfficiencyRing({
  value,
  size = 48,
  label = "Efficiency",
  color,
}: EfficiencyRingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const strokeWidth = Math.max(3, Math.round(size * 0.09));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Arc starts at 12 o'clock and sweeps clockwise. With strokeDashoffset =
  // (1 - pct) * circumference the visible portion equals the percentage.
  const dashOffset = circumference * (1 - clamped / 100);
  const tint = color ?? RING_GREEN;

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {/* Track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Foreground arc — rotated -90deg so 0% sits at 12 o'clock. */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={tint}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View pointerEvents="none" style={styles.center}>
          <Text
            style={[styles.value, { fontSize: Math.max(11, size * 0.32) }]}
            numberOfLines={1}
          >
            {Math.round(clamped)}
          </Text>
        </View>
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 4 },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    color: "#FFFFFF",
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  label: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});
