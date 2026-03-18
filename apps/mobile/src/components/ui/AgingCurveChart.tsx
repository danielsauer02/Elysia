/**
 * SVG aging curve visualization.
 *
 * X-axis = chronological age (0 → life expectancy)
 * Y-axis = biological age
 *
 * - Gray diagonal: y = x (biological age tracks chronological perfectly)
 * - Cyan line: your actual biological age track since joining
 * - Dot: current position; below the line = biologically younger (good)
 * - Dashed projection: where you're headed based on current trends
 */
import React from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import Svg, {
  Line,
  Path,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
  Rect,
} from "react-native-svg";
import { colors } from "@/theme";

interface AgingPoint {
  chronoAge: number;
  bioAge: number;
}

interface AgingCurveChartProps {
  chronoAge: number;
  bioAge: number;
  history?: AgingPoint[];
  lifeExpectancy?: number;
}

export function AgingCurveChart({
  chronoAge,
  bioAge,
  history = [],
  lifeExpectancy = 85,
}: AgingCurveChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  const W = screenWidth - 64; // full width minus horizontal padding
  const H = 220;
  const PAD = { left: 36, right: 16, top: 20, bottom: 32 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const toX = (age: number) => PAD.left + (age / lifeExpectancy) * chartW;
  const toY = (bAge: number) => H - PAD.bottom - (bAge / lifeExpectancy) * chartH;

  // Gray reference line: y = x
  const refX1 = toX(0);
  const refY1 = toY(0);
  const refX2 = toX(lifeExpectancy);
  const refY2 = toY(lifeExpectancy);

  // Build the cyan biological age path (history + current point)
  const allPoints: AgingPoint[] = history.length > 0
    ? [...history, { chronoAge, bioAge }]
    : [{ chronoAge: chronoAge - 0.3, bioAge: bioAge + 0.5 }, { chronoAge, bioAge }];

  const bioPath = allPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(p.chronoAge)} ${toY(p.bioAge)}`)
    .join(" ");

  // Projection: dashed line extending from current point
  const projectionEndAge = Math.min(chronoAge + 10, lifeExpectancy);
  const projectionEndBio = bioAge + (chronoAge + 10 - chronoAge) * 0.7; // slowing down aging
  const projPath = `M ${toX(chronoAge)} ${toY(bioAge)} L ${toX(projectionEndAge)} ${toY(projectionEndBio)}`;

  // Current dot
  const dotX = toX(chronoAge);
  const dotY = toY(bioAge);

  // Diff
  const diff = chronoAge - bioAge;
  const diffSign = diff >= 0 ? `-${diff.toFixed(1)}` : `+${Math.abs(diff).toFixed(1)}`;
  const diffColor = diff >= 0 ? colors.success : colors.destructive;

  // Y-axis labels
  const yLabels = [0, 25, 50, 75, lifeExpectancy];
  const xLabels = [0, 25, 50, 75, lifeExpectancy];

  return (
    <View style={styles.wrap}>
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="bioGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.accent} stopOpacity={0.5} />
            <Stop offset="1" stopColor={colors.accent} stopOpacity={1} />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {yLabels.map((v) => (
          <Line
            key={`gy${v}`}
            x1={PAD.left}
            y1={toY(v)}
            x2={W - PAD.right}
            y2={toY(v)}
            stroke={colors.border}
            strokeWidth={0.5}
          />
        ))}
        {xLabels.map((v) => (
          <Line
            key={`gx${v}`}
            x1={toX(v)}
            y1={PAD.top}
            x2={toX(v)}
            y2={H - PAD.bottom}
            stroke={colors.border}
            strokeWidth={0.5}
          />
        ))}

        {/* Gray reference diagonal (biological = chronological) */}
        <Line
          x1={refX1}
          y1={refY1}
          x2={refX2}
          y2={refY2}
          stroke={colors.borderStrong}
          strokeWidth={1.5}
          strokeDasharray="6,4"
        />

        {/* Cyan biological age track */}
        <Path
          d={bioPath}
          stroke={colors.accent}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dashed projection */}
        <Path
          d={projPath}
          stroke={colors.accent}
          strokeWidth={1.5}
          fill="none"
          strokeDasharray="5,4"
          strokeOpacity={0.5}
        />

        {/* Current age dot on ref line (chronological position) */}
        <Circle
          cx={toX(chronoAge)}
          cy={toY(chronoAge)}
          r={4}
          fill={colors.borderStrong}
          stroke={colors.background}
          strokeWidth={1}
        />

        {/* Current biological age dot */}
        <Circle
          cx={dotX}
          cy={dotY}
          r={7}
          fill={colors.accent}
          stroke={colors.background}
          strokeWidth={2}
        />

        {/* Age label on dot */}
        <SvgText
          x={dotX + 12}
          y={dotY + 4}
          fill={colors.accent}
          fontSize={11}
          fontWeight="700"
        >
          {bioAge.toFixed(1)}
        </SvgText>

        {/* X-axis labels */}
        {xLabels.map((v) => (
          <SvgText
            key={`xl${v}`}
            x={toX(v)}
            y={H - PAD.bottom + 14}
            fill={colors.textTertiary}
            fontSize={9}
            textAnchor="middle"
          >
            {v}
          </SvgText>
        ))}

        {/* Y-axis labels */}
        {yLabels.map((v) => (
          <SvgText
            key={`yl${v}`}
            x={PAD.left - 6}
            y={toY(v) + 3}
            fill={colors.textTertiary}
            fontSize={9}
            textAnchor="end"
          >
            {v}
          </SvgText>
        ))}
      </Svg>

      {/* Legend + diff */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: colors.borderStrong }]} />
          <Text style={styles.legendLabel}>Expected (avg)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: colors.accent }]} />
          <Text style={styles.legendLabel}>Your biological age</Text>
        </View>
        <View style={[styles.diffBadge, { backgroundColor: diff >= 0 ? colors.successMuted : colors.destructiveMuted }]}>
          <Text style={[styles.diffText, { color: diff >= 0 ? colors.success : colors.destructive }]}>
            {diffSign} yrs {diff >= 0 ? "younger" : "older"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 4,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendLine: { width: 18, height: 2, borderRadius: 1 },
  legendLabel: { fontSize: 11, color: colors.textTertiary },
  diffBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginLeft: "auto",
  },
  diffText: { fontSize: 12, fontWeight: "700" },
});
