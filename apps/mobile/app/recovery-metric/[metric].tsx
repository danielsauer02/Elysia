/**
 * /recovery-metric/[metric]
 *
 * Deep-dive trend view for one recovery biometric (Resting HR, HRV,
 * Respiratory rate, Body temperature, SpO2). Same visual family as the
 * sleep metric detail — GlowyHeroCard, selected-day value + qualitative
 * dot, timeframe average + delta, optimal-range legend and an expandable
 * About widget — wired to the recovery queries instead.
 */
import React, { useMemo, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavScrollHandler } from "@/hooks/useNavScrollHandler";
import { useOverscrollBounce } from "@/hooks/useOverscrollBounce";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  borderTokens,
  colors,
  dataColors,
  fontFamily,
  semantic,
  spacing,
} from "@/theme";
import { GlowyHeroCard } from "@/components/sleep/GlowyHeroCard";
import { OptimalRangeLegend } from "@/components/sleep/OptimalRangeLegend";
import { AboutSleepScoreCard } from "@/components/sleep/AboutSleepScoreCard";
import { TimeframePills, type Timeframe } from "@/components/sleep/TimeframePills";
import {
  MetricTrendChart,
  type AxisLabel,
  type TrendPoint,
} from "@/components/sleep/MetricTrendChart";
import {
  ageYearsFromDob,
  classifyDot,
  effectiveGoodRange,
  type SleepMetric,
} from "@/components/sleep/sleepMetricCatalog";
import { getRecoveryMetric } from "@/components/sleep/recoveryMetricCatalog";

const DAY_MS = 86_400_000;

function isoMinusDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - n * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function formatHeroDay(day: string, todayIso: string): string {
  if (day === todayIso) return "TODAY";
  if (day === isoMinusDays(todayIso, 1)) return "YESTERDAY";
  return new Date(`${day}T00:00:00Z`)
    .toLocaleDateString(undefined, { month: "short", day: "numeric" })
    .toUpperCase();
}

function rangeFor(tf: Timeframe, anchor: string): { from: string; to: string } {
  let back = 7;
  if (tf === "1M") back = 30;
  else if (tf === "6M") back = 180;
  else if (tf === "1Y") back = 365;
  return { from: isoMinusDays(anchor, back - 1), to: anchor };
}

function expectedSpanFor(tf: Timeframe): number {
  if (tf === "1W") return 7;
  if (tf === "1M") return 30;
  if (tf === "6M") return 180;
  if (tf === "1Y") return 365;
  return 1;
}

function avgPeriodLabel(tf: Timeframe): string {
  if (tf === "1W") return "7-DAY AVERAGE";
  if (tf === "1M") return "30-DAY AVERAGE";
  if (tf === "6M") return "6-MONTH AVERAGE";
  if (tf === "1Y") return "1-YEAR AVERAGE";
  return "AVERAGE";
}

function fmtAnchor(iso: string, tf: Timeframe): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (tf === "1W") return d.toLocaleDateString(undefined, { weekday: "short" });
  if (tf === "1M") return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  return d.toLocaleDateString(undefined, { month: "short" });
}

function buildAxisLabels(data: TrendPoint[], tf: Timeframe): AxisLabel[] {
  if (data.length === 0) return [];
  if (tf === "1W") return data.map((p, i) => ({ index: i, label: fmtAnchor(p.x, tf) }));
  const target = 4;
  const step = Math.max(1, Math.floor(data.length / target));
  const out: AxisLabel[] = [];
  for (let i = step - 1; i < data.length; i += step) {
    out.push({ index: i, label: fmtAnchor(data[i]!.x, tf) });
  }
  return out;
}

function densify(
  rows: { day: string; value: number | null }[] | undefined,
  from: string,
  to: string
): TrendPoint[] {
  if (!rows) return [];
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  const days = Math.round((toMs - fromMs) / DAY_MS) + 1;
  const byDay = new Map(rows.map((r) => [r.day, r.value] as const));
  const out: TrendPoint[] = [];
  for (let i = 0; i < days; i++) {
    const day = isoMinusDays(to, days - 1 - i);
    out.push({ x: day, y: byDay.has(day) ? byDay.get(day)! : null });
  }
  return out;
}

interface Scale {
  min: number;
  max: number;
  ticks: number[];
  formatTick: (v: number) => string;
}

function buildTicks(min: number, max: number, count = 5): number[] {
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

function tickFormatterFor(unit: string): (v: number) => string {
  if (unit === "br/min") return (v) => v.toFixed(0);
  if (unit === "°C") return (v) => v.toFixed(1);
  return (v) => `${Math.round(v)}`;
}

function computeScale(
  metric: SleepMetric,
  values: number[],
  band: [number, number] | null
): Scale {
  const formatTick = tickFormatterFor(metric.unit);
  let lo = values.length ? Math.min(...values) : 0;
  let hi = values.length ? Math.max(...values) : 1;

  if (metric.tightZoom) {
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) {
      lo = (values[0] ?? 14) - 1;
      hi = (values[0] ?? 14) + 1;
    }
    const pad = Math.max(0.6, (hi - lo) * 0.35);
    let min = lo - pad;
    let max = hi + pad;
    const rough = max - min;
    const step = rough <= 2.5 ? 0.5 : rough <= 6 ? 1 : 2;
    min = Math.floor(min / step) * step;
    max = Math.ceil(max / step) * step;
    if (max <= min) max = min + step;
    const ticks: number[] = [];
    for (let v = min; v <= max + 1e-9; v += step) {
      ticks.push(Math.round(v * 10) / 10);
    }
    const formatTightTick = step < 1 ? (v: number) => v.toFixed(1) : (v: number) => v.toFixed(0);
    return { min, max, ticks, formatTick: formatTightTick };
  }

  if (band) {
    const kind = metric.optimalKind ?? "band";
    if (kind === "below") hi = Math.max(hi, band[1]);
    else if (kind === "above") lo = Math.min(lo, band[0]);
    else {
      lo = Math.min(lo, band[0]);
      hi = Math.max(hi, band[1]);
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) {
    lo = 0;
    hi = lo + 1;
  }
  const pad = (hi - lo) * 0.15 || 1;
  let min = lo - pad;
  let max = hi + pad;
  if (metric.unit === "%") {
    min = Math.max(0, Math.floor(min));
    max = Math.min(100, Math.ceil(max));
  } else {
    min = Math.max(0, Math.floor(min));
    max = Math.ceil(max);
  }
  if (max <= min) max = min + 1;
  return { min, max, ticks: buildTicks(min, max), formatTick };
}

function chartModeFor(
  metric: SleepMetric
): { mode: "bar" | "line"; showDots: boolean } {
  if (metric.detailChart === "scatter") return { mode: "line", showDots: true };
  return { mode: "line", showDots: false };
}

export default function RecoveryMetricDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ metric: string; day?: string }>();
  const metric = params.metric ? getRecoveryMetric(params.metric) : undefined;
  const { onScroll } = useNavScrollHandler();
  const bounceStyle = useOverscrollBounce();

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const anchor = (params.day as string | undefined) ?? todayIso;
  const [tf, setTf] = useState<Timeframe>("1W");
  const range = useMemo(() => rangeFor(tf, anchor), [tf, anchor]);

  const rows = useQuery(
    api.recovery.getRecoveryMetricSeries,
    metric ? { metric: metric.id, from: range.from, to: range.to } : "skip"
  );
  const profile = useQuery(api.profiles.getMyProfile, {});
  const age = ageYearsFromDob(profile?.dateOfBirth ?? null);

  if (!metric) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <Header onBack={() => router.back()} title="Unknown metric" />
        <Text style={styles.placeholder}>This metric does not exist.</Text>
      </SafeAreaView>
    );
  }

  const series = densify(rows, range.from, range.to);
  const numeric = series
    .map((p) => p.y)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const avg = numeric.length
    ? numeric.reduce((s, v) => s + v, 0) / numeric.length
    : null;

  const anchorPoint = series.find((p) => p.x === anchor) ?? null;
  const lastPresent = [...series].reverse().find((p) => p.y !== null) ?? null;
  const todayRaw = anchorPoint?.y ?? lastPresent?.y ?? null;

  const delta =
    todayRaw != null && avg != null && avg !== 0
      ? ((todayRaw - avg) / avg) * 100
      : null;

  const { mode, showDots } = chartModeFor(metric);
  const optimalRange = effectiveGoodRange(metric, age);
  const optimalKind: "band" | "below" | "above" =
    metric.optimalKind === "below" || metric.optimalKind === "above"
      ? metric.optimalKind
      : "band";

  const scale = computeScale(metric, numeric, optimalRange);
  const xLabels = buildAxisLabels(series, tf);
  const todayIndex = series.findIndex((p) => p.x === anchor);

  const chartWidth =
    Dimensions.get("window").width - spacing.lg * 2 - spacing.md * 2;

  const oldest = series.find((p) => p.y !== null) ?? null;
  const actualSpan = oldest
    ? Math.round(
        (Date.parse(`${anchor}T00:00:00Z`) -
          Date.parse(`${oldest.x}T00:00:00Z`)) /
          DAY_MS
      ) + 1
    : 0;
  const expectedSpan = expectedSpanFor(tf);
  const coverageShort =
    (tf === "6M" || tf === "1Y") &&
    actualSpan > 0 &&
    actualSpan < expectedSpan * 0.9;

  const dataReady = rows !== undefined;
  const enoughToDraw = numeric.length >= 2;

  const fmtScrubDay = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Header onBack={() => router.back()} title={metric.label} />
      <Animated.View style={[styles.flex, bounceStyle] as never}>
        <Animated.ScrollView
          contentContainerStyle={styles.scroll}
          onScroll={onScroll}
          scrollEventThrottle={16}
          overScrollMode="never"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <TimeframePills
            value={tf}
            onChange={setTf}
            options={["1W", "1M", "6M", "1Y"]}
            variant="segmented"
          />

          <GlowyHeroCard variant="deep" style={styles.chartCardPadding}>
            <Hero
              metric={metric}
              tf={tf}
              dayLabel={formatHeroDay(anchor, todayIso)}
              todayRaw={todayRaw}
              avg={avg}
              delta={delta}
              age={age}
            />
            {!dataReady ? (
              <Text style={styles.dataNote}>Loading…</Text>
            ) : !enoughToDraw ? (
              <Text style={styles.dataNote}>
                Not enough data yet to render a meaningful trend. Log a few
                more days and this view fills in automatically.
              </Text>
            ) : (
              <MetricTrendChart
                data={series}
                width={chartWidth}
                height={220}
                mode={mode}
                scaleMin={scale.min}
                scaleMax={scale.max}
                yTicks={scale.ticks}
                formatTick={scale.formatTick}
                optimalRange={optimalRange}
                optimalKind={optimalKind}
                todayIndex={todayIndex >= 0 ? todayIndex : null}
                xAxisLabels={xLabels}
                color={dataColors.recovery.base}
                showDots={showDots}
                enableScrubber={mode === "line"}
                formatValue={(v) => metric.format(v)}
                formatScrubDay={fmtScrubDay}
              />
            )}
          </GlowyHeroCard>

          {dataReady && enoughToDraw && optimalRange ? <OptimalRangeLegend /> : null}

          {coverageShort ? (
            <Text style={styles.coverageNote}>
              Only the last {actualSpan} day{actualSpan === 1 ? "" : "s"} are
              recorded so far — the {tfPretty(tf)} view fills in as your history
              grows.
            </Text>
          ) : null}

          <AboutSleepScoreCard
            title={`About ${metric.label}`}
            body={buildAboutBody(metric, optimalRange, age)}
          />
        </Animated.ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

function tfPretty(tf: Timeframe): string {
  if (tf === "6M") return "6-month";
  if (tf === "1Y") return "yearly";
  return "trend";
}

function buildAboutBody(
  metric: SleepMetric,
  optimalRange: [number, number] | null,
  age: number | null
): string {
  if (metric.id === "rhr" && optimalRange) {
    const ceil = Math.round(optimalRange[1]);
    const line =
      age != null
        ? `Your zone: at age ${age}, a resting heart rate at or below ${ceil} bpm sits in the healthy range — and a lower number is better still.`
        : `Your zone: a resting heart rate at or below ${ceil} bpm sits in the healthy range — and a lower number is better still. Add your date of birth in your profile to tailor this to your age.`;
    return `${metric.about}\n\n${line}`;
  }
  return metric.about;
}

function MetricValue({ text }: { text: string }) {
  if (!/[0-9]/.test(text)) {
    return <Text style={styles.chartHeroValue}>{text}</Text>;
  }
  const runs = text.match(/[0-9.,:]+|[^0-9.,:]+/g) ?? [text];
  return (
    <Text style={styles.chartHeroValue}>
      {runs.map((run, i) =>
        /[0-9]/.test(run) ? (
          run
        ) : (
          <Text key={i} style={styles.chartHeroUnit}>
            {run}
          </Text>
        )
      )}
    </Text>
  );
}

function Hero({
  metric,
  tf,
  dayLabel,
  todayRaw,
  avg,
  delta,
  age,
}: {
  metric: SleepMetric;
  tf: Timeframe;
  dayLabel: string;
  todayRaw: number | null;
  avg: number | null;
  delta: number | null;
  age: number | null;
}) {
  const dot = classifyDot(metric, todayRaw, age);
  const showWord = metric.optimalKind !== "none";
  const word = dot === "good" ? "In range" : dot === "bad" ? "Poor" : "Fair";

  const deltaColor =
    delta === null
      ? colors.textTertiary
      : Math.abs(delta) < 1
      ? "#FFFFFF"
      : (metric.higherIsBetter ? delta > 0 : delta < 0)
      ? semantic.success
      : semantic.destructive;

  return (
    <View style={styles.chartHero}>
      <View style={styles.chartHeroCol}>
        <Text style={styles.chartHeroLabel}>{dayLabel}</Text>
        <MetricValue text={metric.format(todayRaw)} />
        {showWord ? (
          <Text style={styles.chartHeroSub}>{todayRaw !== null ? word : "—"}</Text>
        ) : null}
        {delta !== null ? (
          <View style={[styles.chartHeroQuality, styles.chartHeroDelta]}>
            <Text style={styles.chartHeroSub}>
              {delta > 0 ? "+" : ""}
              {delta.toFixed(1)}%
            </Text>
            <View style={[styles.qualityDot, { backgroundColor: deltaColor }]} />
          </View>
        ) : null}
      </View>
      <View style={[styles.chartHeroCol, { alignItems: "flex-end" }]}>
        <Text style={styles.chartHeroLabel}>{avgPeriodLabel(tf)}</Text>
        <MetricValue text={avg === null ? "—" : metric.format(avg)} />
      </View>
    </View>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={10} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: borderTokens.subtle,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: fontFamily.heading, fontSize: 17, color: colors.textPrimary },
  scroll: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.huge * 2,
  },
  chartCardPadding: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
  },
  chartHero: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: spacing.xs,
  },
  chartHeroCol: { gap: 2 },
  chartHeroLabel: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    letterSpacing: 1.6,
    color: "#C7CFE0",
    fontWeight: "500",
  },
  chartHeroValue: {
    fontFamily: fontFamily.monoBold,
    fontSize: 34,
    lineHeight: 38,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
    fontWeight: "500",
  },
  chartHeroUnit: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  chartHeroQuality: { flexDirection: "row", alignItems: "center", gap: 6 },
  chartHeroDelta: { marginTop: 2 },
  chartHeroSub: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    color: "#FFFFFF",
    opacity: 0.78,
    fontWeight: "300",
  },
  qualityDot: { width: 6, height: 6, borderRadius: 3 },
  dataNote: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  coverageNote: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    color: colors.textTertiary,
    lineHeight: 17,
    textAlign: "center",
    paddingHorizontal: spacing.md,
  },
  placeholder: { padding: spacing.lg, color: colors.textSecondary },
});
