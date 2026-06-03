/**
 * TimeToFallAsleepCard
 *
 * Hero metric (Bevel screenshot 13) shown at the very top of the Metrics
 * section. A light horizontal scale that fades out at both ends, with the
 * minute value centred above it and a glowing dot marking the position.
 *
 * Sleep-onset latency thresholds (research: a normal latency is ~10-20 min;
 * <7 min can signal sleep debt, >18 min trends late):
 *   Fast    < 7 min
 *   Normal  7 – 18 min
 *   Late    > 18 min
 *
 * Whoop's API does not expose latency, so `value` is usually null and the
 * scale renders without a dot ("Connect a sleep band to unlock"). When a
 * smart band lands, the dot is positioned on the same scale automatically.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  borderTokens,
  colors,
  fontFamily,
  spacing,
  surface,
} from "@/theme";

interface Props {
  /** Minutes to fall asleep. null when unavailable. */
  value: number | null;
}

export const ONSET_FAST_MAX = 7;
export const ONSET_NORMAL_MAX = 18;
/** Scale extent used purely for dot placement. */
const SCALE_MAX = 28;

type Band = "fast" | "normal" | "late";

function bandFor(value: number): Band {
  if (value < ONSET_FAST_MAX) return "fast";
  if (value <= ONSET_NORMAL_MAX) return "normal";
  return "late";
}

function thumbPct(value: number): number {
  return Math.max(0.02, Math.min(0.98, value / SCALE_MAX));
}

const LABELS: { id: Band; text: string }[] = [
  { id: "fast", text: "Fast" },
  { id: "normal", text: "Normal" },
  { id: "late", text: "Late" },
];

export function TimeToFallAsleepCard({ value }: Props) {
  const hasValue = value !== null && Number.isFinite(value) && value >= 0;
  const band = hasValue ? bandFor(value as number) : null;
  const pct = hasValue ? thumbPct(value as number) : null;

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Time to fall asleep</Text>

      <Text style={styles.value}>
        {hasValue ? `${Math.round(value as number)} min` : "Connect a sleep band"}
      </Text>

      <View style={styles.scaleWrap}>
        {/* Light scale that fades out toward both edges */}
        <LinearGradient
          colors={[
            "rgba(226,232,240,0)",
            "rgba(226,232,240,0.55)",
            "rgba(226,232,240,0.55)",
            "rgba(226,232,240,0)",
          ]}
          locations={[0, 0.18, 0.82, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.scaleLine}
        />

        {pct !== null ? (
          <View style={[styles.thumb, { left: `${pct * 100}%` }]}>
            <View style={styles.thumbGlow} />
            <View style={styles.thumbDark}>
              <View style={styles.thumbDot} />
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.labels}>
        {LABELS.map((l) => (
          <Text
            key={l.id}
            style={[
              styles.labelText,
              band === l.id && styles.labelActive,
            ]}
          >
            {l.text}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: surface.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  heading: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    color: colors.textPrimary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  value: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 20,
    color: colors.textPrimary,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  scaleWrap: {
    height: 24,
    justifyContent: "center",
    position: "relative",
    marginTop: 2,
  },
  scaleLine: {
    height: 3,
    borderRadius: 2,
  },
  thumb: {
    position: "absolute",
    top: 0,
    width: 24,
    height: 24,
    marginLeft: -12,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbGlow: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  thumbDark: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#0A0F1C",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  labelText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
    color: colors.textTertiary,
    letterSpacing: 0.4,
  },
  labelActive: {
    fontFamily: fontFamily.bodyBold,
    color: colors.textPrimary,
  },
});
