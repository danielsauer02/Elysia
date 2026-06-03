/**
 * TimeframePills
 *
 * Bevel-style segmented control for trend timeframes.
 * Values: "1W" | "1M" | "6M" | "1Y" — optionally "D" for sleep-trend.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  borderTokens,
  colors,
  dataColors,
  fontFamily,
  spacing,
  surface,
} from "@/theme";

export type Timeframe = "D" | "1W" | "1M" | "6M" | "1Y";

interface Props {
  value: Timeframe;
  onChange: (v: Timeframe) => void;
  options?: Timeframe[];
  /** Render style — 8sleep uses a segmented control look. */
  variant?: "outline" | "segmented";
}

const DISPLAY_LABEL: Record<Timeframe, string> = {
  D: "D",
  "1W": "W",
  "1M": "M",
  "6M": "6M",
  "1Y": "Y",
};

export function TimeframePills({
  value,
  onChange,
  options = ["1W", "1M", "6M", "1Y"],
  variant = "outline",
}: Props) {
  if (variant === "segmented") {
    return (
      <View style={styles.segmentedTrack}>
        {options.map((opt) => {
          const active = value === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              style={[styles.segment, active && styles.segmentActive]}
            >
              <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                {DISPLAY_LABEL[opt]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={[
              styles.pill,
              active && {
                backgroundColor: dataColors.sleep.base + "22",
                borderColor: dataColors.sleep.base,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                active && { color: colors.textPrimary, fontFamily: fontFamily.bodyBold },
              ]}
            >
              {DISPLAY_LABEL[opt]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    backgroundColor: surface.card,
  },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  segmentedTrack: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 999,
    padding: 3,
  },
  segment: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 999,
    minWidth: 44,
    alignItems: "center",
  },
  segmentActive: {
    backgroundColor: "rgba(255,255,255,0.13)",
  },
  segmentLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    color: colors.textTertiary,
  },
  segmentLabelActive: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
  },
});
