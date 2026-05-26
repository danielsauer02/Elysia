/**
 * PerformanceCircles
 *
 * Three WHOOP-inspired ring circles: Sleep | Performance | Longevity
 *
 * Design:
 *  - 270° arc with 90° gap at the bottom (like WHOOP's rings)
 *  - Dark sphere fill inside the ring
 *  - Large bold percentage centered
 *  - Category label + chevron BELOW the ring (tappable)
 *  - Tapping opens a partial-screen detail modal
 *
 * Data:
 *  - The ring score percentages stay as MOCKS until the dynamic Longevity
 *    Engine is implemented. They are isolated as a single `MOCK_SCORES`
 *    constant so the future swap to a real algorithm is one-line.
 *  - The detail modal rows are wired to LIVE data:
 *      - Sleep / Performance: `api.wearables.getDailyMetrics` (today)
 *      - Longevity: `useHabits()` (active count, today progress, streaks)
 *  - Missing values render as `—` so the modal layout stays stable.
 */
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { colors, spacing, radii } from "@/theme";
import { useHabits } from "@/context/HabitsContext";

// ─── Constants ────────────────────────────────────────────────────────────────

// Each ring is 270° filled, 90° gap at the bottom.
// We rotate 135° from SVG default (3 o'clock) so the arc starts at ~7 o'clock
// and ends at ~5 o'clock, leaving the gap at 6 o'clock.
const ARC_DEGREES = 270;
const ARC_ROTATION = 135;

// Single source of truth for the placeholder ring scores. Swap with the
// dynamic Longevity Engine output when it lands.
const MOCK_SCORES = { sleep: 82, performance: 71, longevity: 68 } as const;

type RingId = "sleep" | "performance" | "longevity";

interface DetailRow {
  label: string;
  value: string;
}

interface RingMetric {
  id: RingId;
  title: string;
  value: number;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  details: DetailRow[];
}

// ─── Formatting helpers ─────────────────────────────────────────────────────

const DASH = "—";

function fmtNum(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  return digits > 0 ? value.toFixed(digits) : String(Math.round(value));
}

function fmtMinutes(min: number | null | undefined): string {
  if (min === null || min === undefined || !Number.isFinite(min) || min <= 0) return DASH;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  return `${Math.round(value)}%`;
}

function fmtKcal(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  return `${Math.round(value)} kcal`;
}

function fmtBpm(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  return `${Math.round(value)} bpm`;
}

function fmtMs(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  return `${Math.round(value)} ms`;
}

function fmtSteps(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  return Math.round(value).toLocaleString();
}

// ─── Live data hook ───────────────────────────────────────────────────────────

function useRingMetrics(): RingMetric[] {
  const today = new Date().toISOString().slice(0, 10);
  const dailyRows = useQuery(api.wearables.getDailyMetrics, { from: today, to: today });
  const todayRow = dailyRows && dailyRows.length > 0 ? dailyRows[0] : null;

  const { habits, getTodayProgress } = useHabits();

  return useMemo<RingMetric[]>(() => {
    const sleepRem = todayRow?.sleepRemMinutes ?? null;
    const sleepDeep = todayRow?.sleepDeepMinutes ?? null;
    const restorative =
      sleepRem !== null && sleepDeep !== null ? sleepRem + sleepDeep : null;

    // Sleep
    const sleepDetails: DetailRow[] = [
      { label: "Total sleep", value: fmtMinutes(todayRow?.sleepMinutes) },
      { label: "Restorative sleep", value: fmtMinutes(restorative) },
      { label: "Deep sleep", value: fmtMinutes(sleepDeep) },
      { label: "REM sleep", value: fmtMinutes(sleepRem) },
      { label: "Light sleep", value: fmtMinutes(todayRow?.sleepLightMinutes) },
      { label: "Sleep efficiency", value: fmtPct(todayRow?.sleepEfficiencyPct) },
      { label: "Sleep consistency", value: fmtPct(todayRow?.sleepConsistencyPct) },
      { label: "Respiratory rate", value: fmtBpm(todayRow?.respiratoryRateAvg) },
    ];

    // Performance
    const activeKcal = todayRow?.activeKcal ?? todayRow?.workoutKcal ?? null;
    const performanceDetails: DetailRow[] = [
      { label: "HRV", value: fmtMs(todayRow?.hrvAvgMs) },
      { label: "Resting HR", value: fmtBpm(todayRow?.restingHrBpm) },
      { label: "Active calories", value: fmtKcal(activeKcal) },
      { label: "Steps", value: fmtSteps(todayRow?.steps) },
      { label: "VO2 max", value: fmtNum(todayRow?.vo2Max, 1) },
      { label: "SpO2", value: fmtPct(todayRow?.spo2AvgPct) },
    ];

    // Longevity (habits-derived)
    const active = habits.filter((h) => h.state === "active");
    const todayProgress = getTodayProgress();
    const avg30d =
      active.length > 0
        ? active.reduce((s, h) => s + (h.completionRate30d ?? 0), 0) / active.length
        : null;
    const bestStreak = active.reduce((s, h) => Math.max(s, h.streakCount ?? 0), 0);
    const currentStreak = active.reduce((s, h) => s + (h.streakCount ?? 0), 0);
    const weeklyRate = avg30d; // 30d average doubles as weekly proxy until per-week is computed
    const longevityDetails: DetailRow[] = [
      { label: "Active habits", value: String(active.length) },
      {
        label: "Completed today",
        value: `${todayProgress.completed} / ${todayProgress.total}`,
      },
      { label: "Weekly rate", value: weeklyRate !== null ? fmtPct(weeklyRate * 100) : DASH },
      { label: "30-day avg", value: avg30d !== null ? fmtPct(avg30d * 100) : DASH },
      { label: "Best streak", value: bestStreak > 0 ? `${bestStreak} days` : DASH },
      { label: "Current streak", value: currentStreak > 0 ? `${currentStreak} days` : DASH },
    ];

    return [
      {
        id: "sleep",
        title: "Sleep",
        value: MOCK_SCORES.sleep,
        color: "#818CF8",
        icon: "moon-outline",
        details: sleepDetails,
      },
      {
        id: "performance",
        title: "Performance",
        value: MOCK_SCORES.performance,
        color: "#22D3EE",
        icon: "flash-outline",
        details: performanceDetails,
      },
      {
        id: "longevity",
        title: "Longevity",
        value: MOCK_SCORES.longevity,
        color: "#34D399",
        icon: "leaf-outline",
        details: longevityDetails,
      },
    ];
  }, [todayRow, habits, getTodayProgress]);
}

// ─── Ring Circle (WHOOP-style) ────────────────────────────────────────────────

interface RingCircleProps {
  value: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}

function RingCircle({
  value,
  color,
  size = 108,
  strokeWidth = Math.max(3, Math.round(size * 0.1)),
}: RingCircleProps) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const arcLength = (ARC_DEGREES / 360) * circumference;
  const filled = (value / 100) * arcLength;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={cx} cy={cy} r={r - strokeWidth / 2} fill={colors.surface} />
      <G rotation={ARC_ROTATION} origin={`${cx}, ${cy}`}>
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          strokeLinecap="round"
        />
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${filled} ${circumference - filled}`}
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
}

// ─── Single Circle Widget ─────────────────────────────────────────────────────

interface CircleWidgetProps {
  metric: RingMetric;
  onPress: () => void;
}

function CircleWidget({ metric, onPress }: CircleWidgetProps) {
  const SIZE = 108;
  return (
    <TouchableOpacity style={styles.circleWidget} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.circleContainer}>
        <RingCircle value={metric.value} color={metric.color} size={SIZE} />
        <View style={styles.circleCenter}>
          <Text style={[styles.circlePct, { color: metric.color }]}>{metric.value}%</Text>
        </View>
      </View>
      <View style={styles.circleLabelRow}>
        <Text style={styles.circleTitle}>{metric.title.toUpperCase()}</Text>
        <Ionicons name="chevron-forward" size={11} color={colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

interface DetailModalProps {
  metric: RingMetric | null;
  onClose: () => void;
}

function DetailModal({ metric, onClose }: DetailModalProps) {
  if (!metric) return null;
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.detailOverlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.detailSheet}>
        <View style={styles.detailHandle} />
        <View style={styles.detailHeader}>
          <View style={styles.detailHeaderLeft}>
            <View style={[styles.detailIcon, { backgroundColor: metric.color + "18" }]}>
              <Ionicons name={metric.icon} size={18} color={metric.color} />
            </View>
            <View>
              <Text style={styles.detailTitle}>{metric.title} Score</Text>
              <View style={styles.detailScoreRow}>
                <RingCircle value={metric.value} color={metric.color} size={32} />
                <Text style={[styles.detailScore, { color: metric.color }]}>{metric.value}%</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.detailClose}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {metric.details.map((stat) => (
            <View key={stat.label} style={styles.detailStatRow}>
              <Text style={styles.detailStatLabel}>{stat.label}</Text>
              <Text style={styles.detailStatValue}>{stat.value}</Text>
            </View>
          ))}
          <View style={styles.detailNote}>
            <Ionicons name="information-circle-outline" size={13} color={colors.textTertiary} />
            <Text style={styles.detailNoteText}>
              Score is a placeholder. Connect more data sources to unlock the dynamic
              Elysia Longevity Engine.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function PerformanceCircles() {
  const metrics = useRingMetrics();
  const [selectedMetric, setSelectedMetric] = useState<RingMetric | null>(null);

  return (
    <>
      <View style={styles.row}>
        {metrics.map((metric) => (
          <CircleWidget
            key={metric.id}
            metric={metric}
            onPress={() => setSelectedMetric(metric)}
          />
        ))}
      </View>

      {selectedMetric && (
        <DetailModal metric={selectedMetric} onClose={() => setSelectedMetric(null)} />
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: spacing.md,
  },

  circleWidget: { alignItems: "center", gap: spacing.sm },
  circleContainer: { position: "relative", alignItems: "center", justifyContent: "center" },
  circleCenter: { position: "absolute", alignItems: "center", justifyContent: "center" },
  circlePct: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  circleLabelRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  circleTitle: { fontSize: 11, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.5 },

  detailOverlay: { flex: 1, backgroundColor: colors.overlay },
  detailSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xxl,
    paddingTop: spacing.lg,
    maxHeight: "65%",
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  detailHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: radii.full,
    alignSelf: "center",
    marginBottom: spacing.lg,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  detailHeaderLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  detailIcon: { width: 40, height: 40, borderRadius: radii.md, alignItems: "center", justifyContent: "center" },
  detailTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  detailScoreRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 2 },
  detailScore: { fontSize: 18, fontWeight: "800", letterSpacing: -0.5 },
  detailClose: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  detailStatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailStatLabel: { fontSize: 14, color: colors.textSecondary },
  detailStatValue: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  detailNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
  },
  detailNoteText: { flex: 1, fontSize: 12, color: colors.textTertiary, lineHeight: 17 },
});
