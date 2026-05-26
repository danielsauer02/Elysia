/**
 * AgingCurveChart
 *
 * Two-line SVG chart comparing chronological vs Elysia age over a time
 * window. Driven by `agingTrajectory` rows from Convex (one per day) plus
 * the latest live values.
 *
 * Renders gracefully with sparse data — when only one point is available
 * we draw it as a single dot with a "Trajectory will appear as you stay
 * consistent" hint. During calibration the chart is hidden entirely and a
 * placeholder takes its place.
 */
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { colors, radii, spacing } from "@/theme";

export type AgingHistoryPoint = {
  day?: string;
  chronoAge: number;
  bioAge: number;
};

type Props = {
  chronoAge: number;
  bioAge: number;
  history: AgingHistoryPoint[];
  sex: "male" | "female";
  /** When true, render the placeholder + copy without the lines. */
  isCalibrating?: boolean;
  calibrationDaysCompleted?: number;
  calibrationDaysRequired?: number;
};

const CHART_WIDTH = 320;
const CHART_HEIGHT = 160;
const PAD = { top: 16, right: 12, bottom: 22, left: 30 };

function buildPath(
  points: number[],
  width: number,
  height: number,
  minY: number,
  maxY: number
): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M 0 ${yScale(points[0]!, height, minY, maxY)}`;
  const stepX = width / (points.length - 1);
  return points
    .map((y, i) => {
      const cmd = i === 0 ? "M" : "L";
      const cx = i * stepX;
      const cy = yScale(y, height, minY, maxY);
      return `${cmd} ${cx.toFixed(2)} ${cy.toFixed(2)}`;
    })
    .join(" ");
}

function yScale(v: number, height: number, minY: number, maxY: number): number {
  if (maxY === minY) return height / 2;
  return height - ((v - minY) / (maxY - minY)) * height;
}

export function AgingCurveChart({
  chronoAge,
  bioAge,
  history,
  isCalibrating,
  calibrationDaysCompleted,
  calibrationDaysRequired,
}: Props) {
  if (isCalibrating) {
    return (
      <View style={styles.wrap}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Calibrating your aging trajectory
          </Text>
          {calibrationDaysCompleted !== undefined && calibrationDaysRequired !== undefined && (
            <Text style={styles.placeholderSub}>
              Day {calibrationDaysCompleted} of {calibrationDaysRequired}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Build series — include the live "today" point in case history is empty.
  const points = history.length > 0
    ? history
    : [{ chronoAge, bioAge }];
  const allValues = points.flatMap((p) => [p.chronoAge, p.bioAge]);
  const minY = Math.floor(Math.min(...allValues) - 0.5);
  const maxY = Math.ceil(Math.max(...allValues) + 0.5);

  const innerW = CHART_WIDTH - PAD.left - PAD.right;
  const innerH = CHART_HEIGHT - PAD.top - PAD.bottom;

  const chronoPath = buildPath(points.map((p) => p.chronoAge), innerW, innerH, minY, maxY);
  const bioPath = buildPath(points.map((p) => p.bioAge), innerW, innerH, minY, maxY);

  const last = points[points.length - 1]!;
  const delta = last.bioAge - last.chronoAge;
  const deltaColor = delta <= 0 ? colors.success : colors.destructive;

  return (
    <View style={styles.wrap}>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.textSecondary }]} />
          <Text style={styles.legendLabel}>Chronological</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
          <Text style={styles.legendLabel}>Elysia Age</Text>
        </View>
        <Text style={[styles.deltaText, { color: deltaColor }]}>
          Δ {delta >= 0 ? "+" : ""}{delta.toFixed(1)} y
        </Text>
      </View>

      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        {/* Y axis ticks */}
        {[0, 0.5, 1].map((t) => {
          const y = PAD.top + innerH * t;
          const label = (maxY - (maxY - minY) * t).toFixed(0);
          return (
            <React.Fragment key={t}>
              <Line
                x1={PAD.left}
                x2={PAD.left + innerW}
                y1={y}
                y2={y}
                stroke={colors.border}
                strokeWidth={0.5}
                strokeDasharray="2 4"
              />
              <SvgText
                x={PAD.left - 6}
                y={y + 3}
                fontSize="9"
                fill={colors.textTertiary}
                textAnchor="end"
              >
                {label}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Translated chart group */}
        <Path
          d={chronoPath}
          fill="none"
          stroke={colors.textSecondary}
          strokeWidth={1.5}
          strokeDasharray="3 3"
          transform={`translate(${PAD.left}, ${PAD.top})`}
        />
        <Path
          d={bioPath}
          fill="none"
          stroke={colors.accent}
          strokeWidth={2.2}
          transform={`translate(${PAD.left}, ${PAD.top})`}
        />

        {/* Marker for latest bio point */}
        {points.length > 0 && (
          <Circle
            cx={PAD.left + innerW}
            cy={PAD.top + yScale(last.bioAge, innerH, minY, maxY)}
            r={3.5}
            fill={colors.accent}
          />
        )}
      </Svg>

      {points.length < 7 && (
        <Text style={styles.sparseHint}>
          Trajectory sharpens as you keep tracking — {7 - points.length} more day
          {7 - points.length === 1 ? "" : "s"} for a full weekly view.
        </Text>
      )}
    </View>
  );
}

// Local React import for fragment usage in SVG map. Imported lazily to avoid
// touching unrelated React-Native imports above.
import React from "react";

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, color: colors.textSecondary },
  deltaText: { marginLeft: "auto", fontSize: 12, fontWeight: "700" },

  sparseHint: { fontSize: 10, color: colors.textTertiary, fontStyle: "italic", marginTop: 2 },

  placeholder: {
    height: 160,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  placeholderText: { fontSize: 13, color: colors.textSecondary },
  placeholderSub: { fontSize: 11, color: colors.textTertiary },
});
