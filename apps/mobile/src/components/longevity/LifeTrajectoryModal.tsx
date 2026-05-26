/**
 * LifeTrajectoryModal
 *
 * Full-screen modal that projects the user's Elysia Age vs chronological
 * age out to their (sex-adjusted) life expectancy. Two-line chart with a
 * confidence band on the future segment.
 *
 * Inputs:
 *   - trajectoryHistory: historical (chronoAge, elysiaAge) per day
 *   - velocity28d:       current aging slope (years per year - 1)
 *   - sex:               drives the base life expectancy
 *
 * The modal computes the chart and life-expectancy delta entirely
 * client-side from these inputs — no extra round-trip required.
 */

import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Polyline,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@/theme";

// ─── Life expectancy lookup ────────────────────────────────────────────────

const LIFE_EXPECTANCY_BY_SEX: Record<string, number> = {
  male: 81.5,
  female: 85.0,
  unspecified: 83.0,
};

// ─── Projection ────────────────────────────────────────────────────────────

interface ProjectionPoint {
  t: number; // years from today (negative = past)
  chrono: number;
  elysia: number;
  band?: { lower: number; upper: number };
  isFuture: boolean;
}

function buildProjection({
  history,
  chronoToday,
  elysiaToday,
  velocity28d,
  horizonYears,
}: {
  history: Array<{ day: string; chronoAge: number; elysiaAge: number }>;
  chronoToday: number;
  elysiaToday: number;
  velocity28d: number;
  horizonYears: number;
}): ProjectionPoint[] {
  const today = new Date();
  // Days -> years offset for history points.
  const historyPts: ProjectionPoint[] = history.map((h) => {
    const d = new Date(h.day + "T00:00:00Z");
    const t = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return {
      t,
      chrono: h.chronoAge,
      elysia: h.elysiaAge,
      isFuture: false,
    };
  });

  // Future projection: 1 point per year + endpoint.
  const futurePts: ProjectionPoint[] = [];
  const slope = 1 + velocity28d;
  // 95% confidence band widens by 0.4 years per year of extrapolation.
  const sigmaPerYear = 0.4;
  for (let t = 0; t <= horizonYears; t += 1) {
    const elysia = elysiaToday + slope * t;
    const chrono = chronoToday + t;
    const sigma = sigmaPerYear * t;
    futurePts.push({
      t,
      chrono,
      elysia,
      band:
        t === 0
          ? undefined
          : { lower: elysia - 1.96 * sigma, upper: elysia + 1.96 * sigma },
      isFuture: t > 0,
    });
  }

  return [...historyPts.sort((a, b) => a.t - b.t), ...futurePts];
}

// ─── Chart ─────────────────────────────────────────────────────────────────

const CHART_W = 320;
const CHART_H = 220;
const PAD_LEFT = 36;
const PAD_RIGHT = 12;
const PAD_TOP = 14;
const PAD_BOTTOM = 28;

function scaleLinear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  return (v: number) => {
    if (d1 === d0) return r0;
    return r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
  };
}

interface LifeChartProps {
  points: ProjectionPoint[];
}

function LifeChart({ points }: LifeChartProps) {
  if (points.length === 0) return null;
  const xs = points.map((p) => p.t);
  const ys = points
    .flatMap((p) => [p.chrono, p.elysia, p.band?.lower ?? p.elysia, p.band?.upper ?? p.elysia]);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.floor(Math.min(...ys)) - 2;
  const yMax = Math.ceil(Math.max(...ys)) + 2;

  const x = scaleLinear([xMin, xMax], [PAD_LEFT, CHART_W - PAD_RIGHT]);
  const y = scaleLinear([yMin, yMax], [CHART_H - PAD_BOTTOM, PAD_TOP]);

  // Build path strings.
  const chronoPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.t).toFixed(1)} ${y(p.chrono).toFixed(1)}`)
    .join(" ");
  const elysiaPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.t).toFixed(1)} ${y(p.elysia).toFixed(1)}`)
    .join(" ");

  // Confidence band (only future): build polygon.
  const futurePts = points.filter((p) => p.isFuture || p.t === 0);
  const upperPts = futurePts.map((p) => `${x(p.t).toFixed(1)},${y(p.band?.upper ?? p.elysia).toFixed(1)}`);
  const lowerPts = [...futurePts]
    .reverse()
    .map((p) => `${x(p.t).toFixed(1)},${y(p.band?.lower ?? p.elysia).toFixed(1)}`);
  const bandPoly = [...upperPts, ...lowerPts].join(" ");

  // "Today" marker.
  const todayPoint = points.find((p) => Math.abs(p.t) < 0.01);
  const tx = x(0);
  const tyChrono = todayPoint ? y(todayPoint.chrono) : null;
  const tyElysia = todayPoint ? y(todayPoint.elysia) : null;

  // Y-axis ticks.
  const yTicks = useMemo(() => {
    const step = Math.ceil((yMax - yMin) / 4 / 5) * 5 || 5;
    const ticks: number[] = [];
    for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) ticks.push(v);
    return ticks;
  }, [yMin, yMax]);

  return (
    <Svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
      <Defs>
        <LinearGradient id="bandGrad" x1="0%" x2="100%" y1="0%" y2="0%">
          <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.2} />
          <Stop offset="100%" stopColor={colors.accent} stopOpacity={0.05} />
        </LinearGradient>
      </Defs>

      {/* Y grid */}
      {yTicks.map((v) => (
        <React.Fragment key={`y${v}`}>
          <Line
            x1={PAD_LEFT}
            x2={CHART_W - PAD_RIGHT}
            y1={y(v)}
            y2={y(v)}
            stroke={colors.border}
            strokeWidth={0.5}
            strokeOpacity={0.6}
          />
          <SvgText
            x={PAD_LEFT - 6}
            y={y(v) + 3}
            fontSize={8}
            fill={colors.textTertiary}
            textAnchor="end"
          >
            {v}
          </SvgText>
        </React.Fragment>
      ))}

      {/* Confidence band */}
      <Polyline points={bandPoly} fill="url(#bandGrad)" stroke="none" />

      {/* Chrono dashed line */}
      <Path
        d={chronoPath}
        fill="none"
        stroke={colors.textTertiary}
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />

      {/* Elysia solid line */}
      <Path
        d={elysiaPath}
        fill="none"
        stroke={colors.accent}
        strokeWidth={2.5}
        strokeLinecap="round"
      />

      {/* Today marker */}
      {tyChrono != null && tyElysia != null ? (
        <>
          <Line
            x1={tx}
            x2={tx}
            y1={PAD_TOP}
            y2={CHART_H - PAD_BOTTOM}
            stroke={colors.borderStrong}
            strokeWidth={1}
            strokeDasharray="2 4"
          />
          <Circle cx={tx} cy={tyElysia} r={4} fill={colors.accent} />
          <Circle cx={tx} cy={tyChrono} r={3} fill={colors.textTertiary} />
        </>
      ) : null}

      {/* X labels (years offset, every ~step) */}
      <SvgText x={x(xMin)} y={CHART_H - 10} fontSize={8} fill={colors.textTertiary} textAnchor="start">
        {`${Math.round(xMin)}y`}
      </SvgText>
      <SvgText x={tx} y={CHART_H - 10} fontSize={8} fill={colors.textPrimary} fontWeight="700" textAnchor="middle">
        Today
      </SvgText>
      <SvgText x={x(xMax)} y={CHART_H - 10} fontSize={8} fill={colors.textTertiary} textAnchor="end">
        {`+${Math.round(xMax)}y`}
      </SvgText>
    </Svg>
  );
}

// ─── Disclaimer popup ──────────────────────────────────────────────────────

function DisclaimerPopup({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.disclaimerOverlay} onPress={onClose} />
      <View style={styles.disclaimerSheet}>
        <Text style={styles.disclaimerTitle}>About this projection</Text>
        <Text style={styles.disclaimerBody}>
          This projection is based solely on the metrics we can measure
          (wearable, nutrition, habits). It is not a medical statement and
          does not guarantee a life expectancy. Diseases, accidents, and
          unmodelled life events are not accounted for. The estimate follows
          published hazard-ratio research; see our bibliography.
        </Text>
        <TouchableOpacity style={styles.disclaimerBtn} onPress={onClose}>
          <Text style={styles.disclaimerBtnLabel}>Got it</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Modal ─────────────────────────────────────────────────────────────────

export interface LifeTrajectoryModalProps {
  visible: boolean;
  onClose: () => void;
  history: Array<{ day: string; chronoAge: number; elysiaAge: number }>;
  chronoAge?: number;
  elysiaAge?: number;
  velocity28d?: number;
  sex?: string;
}

export function LifeTrajectoryModal({
  visible,
  onClose,
  history,
  chronoAge,
  elysiaAge,
  velocity28d,
  sex,
}: LifeTrajectoryModalProps) {
  const [discOpen, setDiscOpen] = useState(false);

  const baseExpectancy =
    LIFE_EXPECTANCY_BY_SEX[sex?.toLowerCase() ?? ""] ??
    LIFE_EXPECTANCY_BY_SEX.unspecified;

  const v = velocity28d ?? 0;
  const horizonYears = chronoAge
    ? Math.max(1, baseExpectancy - chronoAge)
    : 30;
  const projectedExpectancy =
    1 + v > 0 ? baseExpectancy / (1 + v) : baseExpectancy * 2;
  const expectancyDelta = projectedExpectancy - baseExpectancy;

  const points = useMemo(() => {
    if (chronoAge === undefined || elysiaAge === undefined) return [];
    return buildProjection({
      history,
      chronoToday: chronoAge,
      elysiaToday: elysiaAge,
      velocity28d: v,
      horizonYears,
    });
  }, [history, chronoAge, elysiaAge, v, horizonYears]);

  const deltaSign = expectancyDelta > 0.05 ? "+" : expectancyDelta < -0.05 ? "−" : "±";
  const deltaColor =
    expectancyDelta > 0.05
      ? colors.success
      : expectancyDelta < -0.05
        ? colors.destructive
        : colors.textPrimary;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="overFullScreen"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.fullscreen}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Life Trajectory</Text>
          <TouchableOpacity
            onPress={() => setDiscOpen(true)}
            hitSlop={10}
            style={styles.closeBtn}
          >
            <Ionicons name="information-circle-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.subHeader}>
            <Text style={styles.sub}>
              Solid line = Elysia Age, dashed = Chronological. Future projection
              extrapolated from your last 28-day pace.
            </Text>
          </View>

          <View style={styles.chartWrap}>
            <LifeChart points={points} />
          </View>

          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
              <Text style={styles.legendLabel}>Elysia Age</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: "transparent", borderColor: colors.textTertiary, borderStyle: "dashed" },
                ]}
              />
              <Text style={styles.legendLabel}>Chronological</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: colors.accent + "22", borderColor: colors.accent + "55" },
                ]}
              />
              <Text style={styles.legendLabel}>95% band</Text>
            </View>
          </View>

          <View style={styles.expectancyCard}>
            <View style={styles.expectancyHeader}>
              <Text style={styles.expectancyLabel}>LIFE EXPECTANCY</Text>
              <TouchableOpacity onPress={() => setDiscOpen(true)} hitSlop={8}>
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.expectancyRow}>
              <Text style={styles.expectancyValue}>{baseExpectancy.toFixed(1)}</Text>
              <Text style={styles.expectancyUnit}>y baseline</Text>
            </View>
            <Text style={[styles.expectancyDelta, { color: deltaColor }]}>
              {deltaSign}{Math.abs(expectancyDelta).toFixed(1)}y at current pace
            </Text>
            <Text style={styles.expectancyHint}>
              Projected total ≈ {projectedExpectancy.toFixed(1)}y (no medical
              events modelled).
            </Text>
          </View>
        </ScrollView>
      </View>
      <DisclaimerPopup visible={discOpen} onClose={() => setDiscOpen(false)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullscreen: { flex: 1, backgroundColor: colors.background },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl + 12,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 16, fontWeight: "800", color: colors.textPrimary },
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  subHeader: {},
  sub: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  chartWrap: { alignItems: "center" },
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 14, height: 8, borderRadius: 2, borderWidth: 1, borderColor: "transparent" },
  legendLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: "600" },
  expectancyCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 4,
  },
  expectancyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  expectancyLabel: { fontSize: 10, fontWeight: "800", color: colors.textTertiary, letterSpacing: 1.2 },
  expectancyRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  expectancyValue: { fontSize: 36, fontWeight: "800", color: colors.textPrimary, letterSpacing: -1.5 },
  expectancyUnit: { fontSize: 12, color: colors.textTertiary, fontWeight: "600" },
  expectancyDelta: { fontSize: 14, fontWeight: "700", marginTop: 4 },
  expectancyHint: { fontSize: 11, color: colors.textTertiary, marginTop: 6, lineHeight: 15 },

  // Disclaimer popup
  disclaimerOverlay: { flex: 1, backgroundColor: colors.overlay },
  disclaimerSheet: {
    position: "absolute",
    bottom: spacing.xl,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  disclaimerTitle: { fontSize: 15, fontWeight: "800", color: colors.textPrimary },
  disclaimerBody: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  disclaimerBtn: {
    alignSelf: "flex-end",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
  },
  disclaimerBtnLabel: { fontSize: 13, fontWeight: "700", color: colors.background },
});
