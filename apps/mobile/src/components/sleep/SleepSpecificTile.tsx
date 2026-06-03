/**
 * SleepSpecificTile
 *
 * Compact half-width tile for the "Sleep-specific" container. No sparkline.
 * Layout: icon on the left, then a vertically-centred column with the label
 * on top (+ an optional small caption like "7-day" tucked right under it)
 * and the value with a red/white/green status dot below. A chevron sits
 * top-right when a detail screen exists. All tiles share a FIXED height so
 * the 2x2 grid stays visually even regardless of caption presence.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  borderTokens,
  colors,
  dataColors,
  fontFamily,
  semantic,
  spacing,
  surface,
} from "@/theme";
import { classifyDot, type SleepMetric } from "./sleepMetricCatalog";
import { useSleepContext } from "@/context/SleepContext";

function dotColor(kind: "good" | "neutral" | "bad"): string {
  if (kind === "good") return semantic.success;
  if (kind === "bad") return semantic.destructive;
  return colors.textPrimary;
}

interface Props {
  metric: SleepMetric;
  value: number | null;
}

export function SleepSpecificTile({ metric, value }: Props) {
  const router = useRouter();
  const { selectedDay } = useSleepContext();
  const dot = classifyDot(metric, value);

  const content = (
    <View style={styles.card}>
      {metric.allowDetail ? (
        <Ionicons
          name="chevron-forward"
          size={13}
          color={colors.textTertiary}
          style={styles.chevron}
        />
      ) : null}

      <View style={styles.iconBox}>
        <Ionicons name={metric.icon} size={15} color={dataColors.sleep.base} />
      </View>

      <View style={styles.textCol}>
        <Text style={styles.label} numberOfLines={2}>
          {metric.label}
        </Text>
        {metric.caption ? (
          <Text style={styles.caption}>{metric.caption}</Text>
        ) : null}
        <View style={styles.valueRow}>
          <Text style={styles.value}>{metric.format(value)}</Text>
          <View style={[styles.dot, { backgroundColor: dotColor(dot) }]} />
        </View>
      </View>
    </View>
  );

  if (metric.allowDetail) {
    return (
      <Pressable
        style={styles.wrap}
        onPress={() =>
          router.push({
            pathname: "/sleep-metric/[metric]",
            params: { metric: metric.id, day: selectedDay },
          })
        }
      >
        {content}
      </Pressable>
    );
  }
  return <View style={styles.wrap}>{content}</View>;
}

const styles = StyleSheet.create({
  wrap: { width: "48.5%" },
  card: {
    backgroundColor: surface.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    height: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  chevron: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(129,140,248,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: {
    flex: 1,
    justifyContent: "center",
  },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 10,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  caption: {
    fontFamily: fontFamily.body,
    fontSize: 9,
    color: colors.textTertiary,
    marginTop: 1,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  value: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 16,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
