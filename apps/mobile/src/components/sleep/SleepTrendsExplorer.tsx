/**
 * SleepTrendsExplorer
 *
 * Bevel screenshot-20-inspired explorer at the bottom of the sleep
 * screen. Lets the user mix-and-match metrics on the same canvas.
 *
 *   - Top: scrollable chip row, multi-select. Default = [sleepScore].
 *   - Middle: chart. Single metric → original-unit bar/line; multi
 *             metric → values normalised to 0-100 so two y-axes are
 *             not needed (each line keeps its own color).
 *   - Bottom: timeframe pills + Custom button.
 *
 * Custom date range uses a lightweight HH-style input row (no extra
 * dependency). When `tf === "Custom"`, two date text inputs appear.
 */
import React, { useMemo, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { TrendBarChart, TrendLineChart } from "@/components/ui";
import { TimeframePills, type Timeframe } from "./TimeframePills";
import {
  borderTokens,
  colors,
  dataColors,
  fontFamily,
  spacing,
  surface,
} from "@/theme";

const DAY_MS = 86_400_000;

type ExplorerMetricId =
  | "score"
  | "timeAsleep"
  | "rem"
  | "deep"
  | "hrv"
  | "rr"
  | "hr"
  | "consistency"
  | "efficiency"
  | "spo2"
  | "stress";

interface ExplorerMetric {
  id: ExplorerMetricId;
  label: string;
  color: string;
}

const METRICS: ExplorerMetric[] = [
  { id: "score", label: "Score", color: dataColors.sleep.base },
  { id: "timeAsleep", label: "Time asleep", color: dataColors.sleep.gradient[1] },
  { id: "rem", label: "REM", color: "#22D3EE" },
  { id: "deep", label: "Deep", color: "#6366F1" },
  { id: "hrv", label: "HRV", color: "#A5B4FC" },
  { id: "rr", label: "Resp rate", color: "#34D399" },
  { id: "hr", label: "Resting HR", color: "#FB7185" },
  { id: "consistency", label: "Consistency", color: "#F59E0B" },
  { id: "efficiency", label: "Efficiency", color: "#84CC16" },
  { id: "spo2", label: "SpO2", color: "#22D3EE" },
  { id: "stress", label: "Sleep stress", color: "#E879F9" },
];

type TfPlusCustom = Timeframe | "Custom";

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function rangeFor(tf: TfPlusCustom, custom: { from: string; to: string }): { from: string; to: string } {
  if (tf === "Custom") return custom;
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  let back = 7;
  if (tf === "D") back = 1;
  else if (tf === "1W") back = 7;
  else if (tf === "1M") back = 30;
  else if (tf === "6M") back = 180;
  else if (tf === "1Y") back = 365;
  const from = new Date(today.getTime() - back * DAY_MS).toISOString().slice(0, 10);
  return { from, to };
}

function normalise(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

interface SeriesPoint { day: string; value: number | null }

export function SleepTrendsExplorer() {
  const [selected, setSelected] = useState<ExplorerMetricId[]>(["score"]);
  const [tf, setTf] = useState<TfPlusCustom>("1M");
  const [customFrom, setCustomFrom] = useState(isoToday());
  const [customTo, setCustomTo] = useState(isoToday());

  const range = useMemo(
    () => rangeFor(tf, { from: customFrom, to: customTo }),
    [tf, customFrom, customTo]
  );

  // Convex queries — one per selected metric. Convex caches and batches.
  // We render up to 5 in the picker; the unused are skipped.
  const s0 = useSeries(selected[0] ?? null, range);
  const s1 = useSeries(selected[1] ?? null, range);
  const s2 = useSeries(selected[2] ?? null, range);
  const s3 = useSeries(selected[3] ?? null, range);
  const s4 = useSeries(selected[4] ?? null, range);

  const allSeries = [s0, s1, s2, s3, s4].filter((s): s is { id: ExplorerMetricId; data: SeriesPoint[] } => s !== null);

  const toggle = (id: ExplorerMetricId) => {
    setSelected((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // never empty
        return prev.filter((p) => p !== id);
      }
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  };

  const chartWidth = Dimensions.get("window").width - spacing.lg * 2 - spacing.md * 2;

  // Auto-choose chart kind: 1 metric + range ≤ 1M → bars; else lines
  const singleMetric = allSeries.length === 1;
  const useBars =
    singleMetric &&
    (tf === "1W" || tf === "1M" || tf === "D");

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Trends</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {METRICS.map((m) => {
          const active = selected.includes(m.id);
          return (
            <Pressable
              key={m.id}
              onPress={() => toggle(m.id)}
              style={[
                styles.chip,
                active && {
                  borderColor: m.color,
                  backgroundColor: m.color + "22",
                },
              ]}
            >
              <View style={[styles.chipDot, { backgroundColor: m.color }]} />
              <Text
                style={[
                  styles.chipLabel,
                  active && { color: colors.textPrimary, fontFamily: fontFamily.bodyBold },
                ]}
              >
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.chartCard}>
        {useBars ? (
          <BarChartFor series={allSeries[0]!} width={chartWidth} />
        ) : (
          <LineChartFor series={allSeries} width={chartWidth} />
        )}
      </View>

      <TimeframePills
        value={tf === "Custom" ? "1M" : tf}
        onChange={setTf as (v: Timeframe) => void}
        options={["D", "1W", "1M", "6M", "1Y"]}
      />
      <View style={styles.customRow}>
        <Pressable
          onPress={() => setTf("Custom")}
          style={[
            styles.customBtn,
            tf === "Custom" && {
              borderColor: dataColors.sleep.base,
              backgroundColor: dataColors.sleep.base + "22",
            },
          ]}
        >
          <Text style={styles.customBtnText}>Custom</Text>
        </Pressable>
        {tf === "Custom" ? (
          <>
            <TextInput
              value={customFrom}
              onChangeText={setCustomFrom}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
              style={styles.dateInput}
            />
            <Text style={styles.dash}>—</Text>
            <TextInput
              value={customTo}
              onChangeText={setCustomTo}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
              style={styles.dateInput}
            />
          </>
        ) : null}
      </View>
    </View>
  );
}

function useSeries(
  id: ExplorerMetricId | null,
  range: { from: string; to: string }
): { id: ExplorerMetricId; data: SeriesPoint[] } | null {
  const data = useQuery(
    api.sleep.getSleepMetricSeries,
    id ? { metric: id, from: range.from, to: range.to } : "skip"
  );
  if (!id) return null;
  return { id, data: (data ?? []).map((p) => ({ day: p.day, value: p.value })) };
}

function BarChartFor({ series, width }: { series: { id: ExplorerMetricId; data: SeriesPoint[] }; width: number }) {
  const color = METRICS.find((m) => m.id === series.id)?.color ?? dataColors.sleep.base;
  const data = series.data.map((p) => ({ x: p.day, y: p.value }));
  const numeric = series.data.map((p) => p.value).filter((v): v is number => v !== null);
  const avg = numeric.length ? numeric.reduce((s, v) => s + v, 0) / numeric.length : null;
  return (
    <TrendBarChart
      data={data}
      width={width}
      height={220}
      color={color}
      avg={avg}
      pinIndex={data.length - 1}
    />
  );
}

function LineChartFor({
  series,
  width,
}: {
  series: Array<{ id: ExplorerMetricId; data: SeriesPoint[] }>;
  width: number;
}) {
  const lines = series.map((s) => {
    const numeric = s.data.map((p) => p.value).filter((v): v is number => v !== null);
    const min = numeric.length ? Math.min(...numeric) : 0;
    const max = numeric.length ? Math.max(...numeric) : 1;
    // Normalise multi-metric lines to 0..100 so they're directly comparable
    const norm = series.length > 1;
    const data = s.data.map((p) => ({
      x: p.day,
      y: p.value === null ? null : norm ? normalise(p.value, min, max) : p.value,
    }));
    const color = METRICS.find((m) => m.id === s.id)?.color ?? dataColors.sleep.base;
    return { id: s.id, data, color };
  });

  // Render stacked lines in the same SVG via overlapping TrendLineChart
  return (
    <View style={{ width, height: 220 }}>
      {lines.map((l, i) => (
        <View key={l.id} style={[StyleSheet.absoluteFillObject]}>
          <TrendLineChart
            data={l.data}
            width={width}
            height={220}
            color={l.color}
            avg={null}
            min={series.length > 1 ? 0 : undefined}
            max={series.length > 1 ? 100 : undefined}
            pinIndex={i === 0 ? l.data.length - 1 : null}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xxl, gap: spacing.md },
  header: { paddingHorizontal: spacing.lg },
  title: {
    fontFamily: fontFamily.heading,
    fontSize: 18,
    color: colors.textPrimary,
  },
  chipRow: { paddingHorizontal: spacing.lg, gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    backgroundColor: surface.card,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  chartCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: surface.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    padding: spacing.md,
  },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.lg,
  },
  customBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    backgroundColor: surface.card,
  },
  customBtnText: {
    fontFamily: fontFamily.bodyMedium,
    color: colors.textSecondary,
    fontSize: 13,
  },
  dateInput: {
    flex: 1,
    backgroundColor: surface.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    color: colors.textPrimary,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: fontFamily.mono,
    fontSize: 13,
  },
  dash: { color: colors.textTertiary },
});
