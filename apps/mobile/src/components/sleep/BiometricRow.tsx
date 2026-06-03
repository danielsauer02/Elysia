/**
 * BiometricRow
 *
 * Full-row tile for the "Biometrics" container. Left: icon with the label
 * vertically centred beside it and the value (+ status dot) below the
 * label. Right: the 7-day mini sparkline, vertically centred and kept
 * short so the full label always fits. A chevron sits top-right when a
 * detail screen exists.
 */
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { TrendLineChart } from "@/components/ui";
import { useSleepContext } from "@/context/SleepContext";
import {
  borderTokens,
  colors,
  dataColors,
  fontFamily,
  semantic,
  spacing,
  surface,
} from "@/theme";
import { ageYearsFromDob, classifyDot, type SleepMetric } from "./sleepMetricCatalog";

const DAY_MS = 86_400_000;

function rangeFor(day: string): { from: string; to: string } {
  const end = new Date(`${day}T00:00:00Z`);
  const start = new Date(end.getTime() - 6 * DAY_MS);
  return { from: start.toISOString().slice(0, 10), to: day };
}

function dotColor(kind: "good" | "neutral" | "bad"): string {
  if (kind === "good") return semantic.success;
  if (kind === "bad") return semantic.destructive;
  return colors.textPrimary;
}

interface Props {
  metric: SleepMetric;
  value: number | null;
}

export function BiometricRow({ metric, value }: Props) {
  const router = useRouter();
  const { selectedDay } = useSleepContext();
  const range = useMemo(() => rangeFor(selectedDay), [selectedDay]);

  const series = useQuery(api.sleep.getSleepMetricSeries, {
    metric: metric.id,
    from: range.from,
    to: range.to,
  });
  const points = useMemo(
    () => (series ?? []).map((p) => ({ x: p.day, y: p.value })),
    [series]
  );

  // Age personalises the resting-HR ceiling so the tile dot matches the
  // deep-dive view. Convex dedupes this query across the sibling rows.
  const profile = useQuery(api.profiles.getMyProfile, {});
  const age = ageYearsFromDob(profile?.dateOfBirth ?? null);
  const dot = classifyDot(metric, value, age);

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
        <View style={styles.valueRow}>
          <Text style={styles.value}>{metric.format(value)}</Text>
          <View style={[styles.dot, { backgroundColor: dotColor(dot) }]} />
        </View>
      </View>

      <View style={styles.chartWrap}>
        {/* Small downward nudge so the curve never rides into the chevron. */}
        <View style={{ marginTop: 8 }}>
          <TrendLineChart
            data={points}
            width={104}
            height={38}
            compact
            color={dataColors.sleep.base}
          />
        </View>
      </View>
    </View>
  );

  if (metric.allowDetail) {
    return (
      <Pressable onPress={() =>
        router.push({
          pathname: "/sleep-metric/[metric]",
          params: { metric: metric.id, day: selectedDay },
        })
      }>
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: surface.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    height: 72,
    paddingHorizontal: spacing.md,
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
    width: 116,
    justifyContent: "center",
  },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 10,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
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
  chartWrap: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "center",
  },
});
