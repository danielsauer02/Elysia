/**
 * /recovery-trend
 *
 * Recovery Fitness Score trend — the recovery twin of /sleep-trend. Five
 * timeframes (D / 1W / 1M / 6M / 1Y):
 *
 *   D     — half-bow centred on the selected day (creme → orange), weighted
 *           across the four contributors, followed by a "Score contributors"
 *           breakdown (HRV · Resting HR · Sleep · Respiratory rate).
 *   1W/1M — fixed 0–100 bar chart with the High band + average baseline.
 *   6M/Y  — fixed 0–100 line chart with the same axes + scrubber.
 *
 * The selected day from /recovery travels through as a query param.
 */
import React, { useMemo, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavScrollHandler } from "@/hooks/useNavScrollHandler";
import { useOverscrollBounce } from "@/hooks/useOverscrollBounce";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { BowGauge, type BowSegment } from "@/components/ui";
import { TimeframePills, type Timeframe } from "@/components/sleep/TimeframePills";
import {
  SleepScoreBarChart,
  type AxisLabel,
  type ScoreBarPoint,
} from "@/components/sleep/SleepScoreBarChart";
import { SleepScoreLineChart } from "@/components/sleep/SleepScoreLineChart";
import { OptimalRangeLegend } from "@/components/sleep/OptimalRangeLegend";
import { GlowyHeroCard } from "@/components/sleep/GlowyHeroCard";
import { AboutSleepScoreCard } from "@/components/sleep/AboutSleepScoreCard";
import {
  borderTokens,
  colors,
  fontFamily,
  semantic,
  spacing,
} from "@/theme";

const DAY_MS = 86_400_000;
const OPTIMAL: [number, number] = [80, 100];
const HERO_BG = "#0A0F1C";

type RecoveryQuality = "high" | "moderate" | "low";

interface RecoveryRow {
  score: number;
  subHrv: number | null;
  subRhr: number | null;
  subSleep: number | null;
  subResp: number | null;
  quality: RecoveryQuality;
}

// Weights mirror convex/scoring/recoveryFitness.ts.
const WEIGHTS = { hrv: 0.4, rhr: 0.25, sleep: 0.25, resp: 0.1 } as const;

const TINTS = {
  hrv: "#F2994A",
  rhr: "#F4B36A",
  sleep: "#F6D08A",
  resp: "#9AD0C2",
} as const;

const CONTRIBUTOR_COPY: Record<
  "hrv" | "rhr" | "sleep" | "resp",
  { label: string; weight: string; description: string }
> = {
  hrv: {
    label: "HRV",
    weight: "40% of score",
    description: "Overnight heart-rate variability vs your personal baseline",
  },
  rhr: {
    label: "Resting HR",
    weight: "25% of score",
    description: "Resting heart rate vs your baseline — lower is better",
  },
  sleep: {
    label: "Sleep",
    weight: "25% of score",
    description: "Last night's Elysia Sleep Score",
  },
  resp: {
    label: "Respiratory rate",
    weight: "10% of score",
    description: "Breathing rate vs your baseline — an early strain signal",
  },
};

const ABOUT_BODY =
  "Your Recovery Score blends the signals that best predict how ready your body is today: heart-rate variability (40%), resting heart rate (25%), last night's sleep (25%) and respiratory rate (10%). HRV and resting HR are read against your own rolling baseline, so the score adapts to you rather than to a generic norm. 80+ is High (green) — you're primed for strain; 60–79 is Moderate (amber) — train, but listen to your body; under 60 is Low (red) — prioritise rest. The score renormalises across whichever signals are present, so a missing metric never zeroes you out.";

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
  if (tf === "D") return { from: anchor, to: anchor };
  let back = 7;
  if (tf === "1M") back = 30;
  else if (tf === "6M") back = 180;
  else if (tf === "1Y") back = 365;
  return { from: isoMinusDays(anchor, back - 1), to: anchor };
}

function expectedSpanFor(tf: Timeframe): number {
  if (tf === "D") return 1;
  if (tf === "1W") return 7;
  if (tf === "1M") return 30;
  if (tf === "6M") return 180;
  return 365;
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

function buildAxisLabels(data: ScoreBarPoint[], tf: Timeframe): AxisLabel[] {
  if (data.length === 0) return [];
  if (tf === "1W") return data.map((p, i) => ({ index: i, label: fmtAnchor(p.x, tf) }));
  const step = Math.max(1, Math.floor(data.length / 4));
  const out: AxisLabel[] = [];
  for (let i = step - 1; i < data.length; i += step) {
    out.push({ index: i, label: fmtAnchor(data[i]!.x, tf) });
  }
  return out;
}

function qualityWord(q: RecoveryQuality): string {
  if (q === "high") return "High";
  if (q === "moderate") return "Moderate";
  return "Low";
}

function qualityDotColor(q: RecoveryQuality): string {
  if (q === "high") return semantic.success;
  if (q === "low") return semantic.destructive;
  return "#FFFFFF";
}

export default function RecoveryTrendScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string }>();
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const anchorDay = (params.day as string | undefined) ?? todayIso;
  const { onScroll } = useNavScrollHandler();
  const bounceStyle = useOverscrollBounce();

  const [tf, setTf] = useState<Timeframe>("D");
  const range = useMemo(() => rangeFor(tf, anchorDay), [tf, anchorDay]);
  const rows = useQuery(api.recovery.getRecoveryFitnessRange, range);

  const series = useMemo<ScoreBarPoint[]>(() => {
    if (tf === "D" || !rows) return [];
    const fromMs = Date.parse(`${range.from}T00:00:00Z`);
    const toMs = Date.parse(`${range.to}T00:00:00Z`);
    const days = Math.round((toMs - fromMs) / DAY_MS) + 1;
    const byDay = new Map(rows.map((r) => [r.day, r] as const));
    const out: ScoreBarPoint[] = [];
    for (let i = 0; i < days; i++) {
      const day = isoMinusDays(range.to, days - 1 - i);
      const row = byDay.get(day);
      out.push({ x: day, y: row?.recovery ? row.recovery.score : null });
    }
    return out;
  }, [rows, range, tf]);

  const dayRow = rows?.find((r) => r.day === anchorDay) ?? null;
  const dayRecovery = (dayRow?.recovery ?? null) as RecoveryRow | null;

  const numericVals = series.map((p) => p.y).filter((v): v is number => v !== null);
  const avg = numericVals.length
    ? numericVals.reduce((s, v) => s + v, 0) / numericVals.length
    : null;
  const todayIndex = series.findIndex((p) => p.x === anchorDay);

  let delta: number | null = null;
  if (dayRecovery && avg !== null && avg !== 0) {
    delta = ((dayRecovery.score - avg) / avg) * 100;
  }

  const chartWidth = Dimensions.get("window").width - spacing.lg * 2 - spacing.md * 2;
  const dataReady = rows !== undefined;

  const oldestDay = rows && rows.length > 0 ? rows[0]?.day ?? null : null;
  const expectedSpanDays = expectedSpanFor(tf);
  const actualSpanDays = oldestDay
    ? Math.round(
        (Date.parse(`${anchorDay}T00:00:00Z`) -
          Date.parse(`${oldestDay}T00:00:00Z`)) /
          DAY_MS
      ) + 1
    : 0;
  const coverageRatio = expectedSpanDays > 0 ? actualSpanDays / expectedSpanDays : 0;

  const minPointsByTf: Record<Timeframe, number> = { D: 1, "1W": 3, "1M": 5, "6M": 30, "1Y": 60 };
  const minCoverageByTf: Record<Timeframe, number> = { D: 0, "1W": 0, "1M": 0, "6M": 0.5, "1Y": 0.5 };
  const enoughData =
    numericVals.length >= minPointsByTf[tf] && coverageRatio >= minCoverageByTf[tf];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Recovery Score</Text>
        <View style={{ width: 40 }} />
      </View>

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
            options={["D", "1W", "1M", "6M", "1Y"]}
            variant="segmented"
          />

          {tf === "D" ? (
            <DayView day={anchorDay} recovery={dayRecovery} dataReady={dataReady} />
          ) : (
            <>
              <GlowyHeroCard variant="deep" style={styles.chartCardPadding}>
                <ChartHero
                  tf={tf}
                  recovery={dayRecovery}
                  avg={avg}
                  delta={delta}
                  dayLabel={formatHeroDay(anchorDay, todayIso)}
                />
                {!dataReady ? (
                  <Text style={styles.dataNote}>Loading…</Text>
                ) : !enoughData ? (
                  <Text style={styles.dataNote}>
                    {coverageRatio < 0.5 && actualSpanDays > 0
                      ? `Your history only covers the last ${actualSpanDays} day${actualSpanDays === 1 ? "" : "s"}. The ${tfPretty(tf)} trend unlocks once enough of this window is filled.`
                      : "Not enough data yet to render a meaningful trend. Log a few more days and this view fills in automatically."}
                  </Text>
                ) : tf === "1W" || tf === "1M" ? (
                  <SleepScoreBarChart
                    data={series}
                    width={chartWidth}
                    height={220}
                    optimalRange={OPTIMAL}
                    todayIndex={todayIndex >= 0 ? todayIndex : null}
                    xAxisLabels={buildAxisLabels(series, tf)}
                  />
                ) : (
                  <SleepScoreLineChart
                    data={series}
                    width={chartWidth}
                    height={220}
                    optimalRange={OPTIMAL}
                    todayIndex={todayIndex >= 0 ? todayIndex : null}
                    xAxisLabels={buildAxisLabels(series, tf)}
                    enableScrubber
                  />
                )}
              </GlowyHeroCard>
              {dataReady && enoughData ? <OptimalRangeLegend /> : null}
            </>
          )}

          <AboutSleepScoreCard title="About the Recovery Score" body={ABOUT_BODY} />
        </Animated.ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

function tfPretty(tf: Timeframe): string {
  if (tf === "1W") return "weekly";
  if (tf === "1M") return "monthly";
  if (tf === "6M") return "6-month";
  if (tf === "1Y") return "yearly";
  return "daily";
}

function DayView({
  day,
  recovery,
  dataReady,
}: {
  day: string;
  recovery: RecoveryRow | null;
  dataReady: boolean;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const dayLabel =
    day === todayIso
      ? "TODAY"
      : day === isoMinusDays(todayIso, 1)
      ? "YESTERDAY"
      : new Date(`${day}T00:00:00Z`)
          .toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })
          .toUpperCase();

  if (!dataReady) {
    return (
      <View style={styles.dCard}>
        <Text style={styles.dataNote}>Loading…</Text>
      </View>
    );
  }

  if (!recovery) {
    return (
      <View style={styles.dCard}>
        <Text style={styles.dayLabel}>{dayLabel}</Text>
        <Text style={styles.dataNote}>
          No recovery score for this day yet. Connect a wearable that reports
          HRV or resting heart rate to start your trend.
        </Text>
      </View>
    );
  }

  const segments: BowSegment[] = [
    { fillFraction: WEIGHTS.hrv * ((recovery.subHrv ?? 0) / 100), color: TINTS.hrv },
    { fillFraction: WEIGHTS.rhr * ((recovery.subRhr ?? 0) / 100), color: TINTS.rhr },
    { fillFraction: WEIGHTS.sleep * ((recovery.subSleep ?? 0) / 100), color: TINTS.sleep },
    { fillFraction: WEIGHTS.resp * ((recovery.subResp ?? 0) / 100), color: TINTS.resp },
  ];

  return (
    <View style={{ gap: spacing.lg }}>
      <GlowyHeroCard variant="deep" style={styles.dHeroCard}>
        <View style={styles.dHero}>
          <BowGauge
            mode="solid"
            segments={segments}
            size={240}
            tickWidth={12}
            centre={
              <View style={{ alignItems: "center", gap: 4 }}>
                <Text style={styles.dayLabel}>{dayLabel}</Text>
                <Text style={styles.dHeroScore}>{recovery.score}</Text>
                <View style={styles.dHeroQuality}>
                  <Text style={styles.qualityText}>{qualityWord(recovery.quality)}</Text>
                  <View
                    style={[
                      styles.qualityDot,
                      { backgroundColor: qualityDotColor(recovery.quality) },
                    ]}
                  />
                </View>
              </View>
            }
          />
          <Text style={styles.dHeroCaption}>ELYSIA RECOVERY SCORE</Text>
        </View>
      </GlowyHeroCard>

      <View style={{ gap: spacing.md }}>
        <Text style={styles.sectionHeading}>SCORE CONTRIBUTORS</Text>
        <Contributor tint={TINTS.hrv} info={CONTRIBUTOR_COPY.hrv} value={roundOrNull(recovery.subHrv)} />
        <Contributor tint={TINTS.rhr} info={CONTRIBUTOR_COPY.rhr} value={roundOrNull(recovery.subRhr)} />
        <Contributor tint={TINTS.sleep} info={CONTRIBUTOR_COPY.sleep} value={roundOrNull(recovery.subSleep)} />
        <Contributor tint={TINTS.resp} info={CONTRIBUTOR_COPY.resp} value={roundOrNull(recovery.subResp)} />
      </View>
    </View>
  );
}

function roundOrNull(v: number | null): number | null {
  return v === null ? null : Math.round(v);
}

function Contributor({
  tint,
  info,
  value,
}: {
  tint: string;
  info: { label: string; weight: string; description: string };
  value: number | null;
}) {
  return (
    <View style={styles.contribCard}>
      <View style={styles.contribTopRow}>
        <View style={styles.contribLabelGroup}>
          <Text style={styles.contribLabel}>{info.label}</Text>
          <View style={styles.weightPill}>
            <Text style={styles.weightText}>{info.weight}</Text>
          </View>
        </View>
        <Text style={styles.contribValue}>{value === null ? "—" : `${value}%`}</Text>
      </View>
      <Text style={styles.contribDesc}>{info.description}</Text>
      <View style={styles.contribTrack}>
        <View
          style={[
            styles.contribFill,
            {
              width: `${Math.max(0, Math.min(100, value ?? 0))}%`,
              backgroundColor: tint,
            },
          ]}
        />
      </View>
    </View>
  );
}

function ChartHero({
  tf,
  recovery,
  avg,
  delta,
  dayLabel,
}: {
  tf: Timeframe;
  recovery: RecoveryRow | null;
  avg: number | null;
  delta: number | null;
  dayLabel: string;
}) {
  const word = recovery ? qualityWord(recovery.quality) : null;

  const deltaColor =
    delta === null
      ? colors.textTertiary
      : Math.abs(delta) < 1
      ? "#FFFFFF"
      : delta > 0
      ? semantic.success
      : semantic.destructive;

  return (
    <View style={styles.chartHero}>
      <View style={styles.chartHeroCol}>
        <Text style={styles.chartHeroLabel}>{dayLabel}</Text>
        <Text style={styles.chartHeroValue}>{recovery ? recovery.score : "—"}</Text>
        <Text style={styles.chartHeroSub}>{word ?? "—"}</Text>
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
        <Text style={styles.chartHeroValue}>{avg === null ? "—" : Math.round(avg)}</Text>
      </View>
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
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.huge * 2 },
  dCard: {
    backgroundColor: HERO_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    padding: spacing.lg,
    gap: spacing.md,
  },
  dHeroCard: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  dHero: { alignItems: "center", paddingVertical: spacing.sm, gap: spacing.sm },
  dayLabel: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    letterSpacing: 2,
    color: "#C7CFE0",
    fontWeight: "500",
  },
  dHeroScore: {
    fontFamily: fontFamily.monoBold,
    fontSize: 64,
    lineHeight: 70,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
    letterSpacing: -2,
  },
  dHeroQuality: { flexDirection: "row", alignItems: "center", gap: 6 },
  dHeroCaption: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    letterSpacing: 2.2,
    color: "#C7CFE0",
    fontWeight: "500",
    marginTop: spacing.xs,
  },
  qualityText: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: "300",
  },
  qualityDot: { width: 6, height: 6, borderRadius: 3 },
  sectionHeading: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    letterSpacing: 1.6,
    color: "#FFFFFF",
    opacity: 0.85,
    fontWeight: "500",
  },
  contribCard: {
    backgroundColor: HERO_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 8,
  },
  contribTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  contribLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  contribLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  weightPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  weightText: { fontFamily: fontFamily.body, fontSize: 11, color: colors.textTertiary },
  contribValue: {
    fontFamily: fontFamily.monoBold,
    fontSize: 16,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  contribDesc: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    color: colors.textTertiary,
    lineHeight: 17,
  },
  contribTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    marginTop: 4,
  },
  contribFill: { height: "100%", borderRadius: 2 },
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
  chartHeroQuality: { flexDirection: "row", alignItems: "center", gap: 6 },
  chartHeroDelta: { marginTop: 2 },
  chartHeroSub: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    color: "#FFFFFF",
    opacity: 0.78,
    fontWeight: "300",
  },
  dataNote: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
});
