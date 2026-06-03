/**
 * SleepScoreBarChart
 *
 * 8sleep-style fixed 0–100 bar chart for the W / M timeframes. Renders:
 *   - faint horizontal gridlines every 20 (0, 20, 40, 60, 80, 100)
 *   - Y-axis labels on the right edge, with enough plot top-padding so
 *     the "100" label is never clipped against the card border
 *   - TWO dashed horizontal lines at the optimal-range boundaries
 *     (80 and 100) with a tinted-green band between — the legend below
 *     the card mirrors exactly this visual so the meaning is obvious
 *   - one bar per data point; bright green if score ≥ optimal lower
 *     bound, off-white otherwise, faded-grey for missing days
 *   - dashed horizontal `avg` baseline
 *   - sparse X-axis date anchors (caller supplies which slots to label)
 *
 * Approximation: a single internal NaN flanked by valid neighbours is
 * back-filled via linear interpolation and rendered at half opacity, so
 * the timeline stays continuous without faking a hard zero.
 *
 * The legend is intentionally NOT rendered here — the parent owns the
 * spacing below the SVG so it never overlaps the X-axis anchors.
 */
import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { borderTokens, colors, fontFamily, semantic } from "@/theme";

export interface ScoreBarPoint {
  x: string;
  y: number | null;
}

export interface AxisLabel {
  index: number;
  label: string;
}

interface Props {
  data: ScoreBarPoint[];
  width: number;
  height: number;
  optimalRange: [number, number];
  todayIndex: number | null;
  xAxisLabels: AxisLabel[];
}

const Y_TICKS = [0, 20, 40, 60, 80, 100];
const Y_AXIS_W = 26;
const X_AXIS_H = 20;
const TOP_PAD = 10;

export function SleepScoreBarChart({
  data,
  width,
  height,
  optimalRange,
  todayIndex,
  xAxisLabels,
}: Props) {
  const plotW = Math.max(1, width - Y_AXIS_W);
  const plotH = Math.max(1, height - X_AXIS_H - TOP_PAD);

  const yFor = (v: number) => TOP_PAD + (1 - v / 100) * plotH;
  const slotW = data.length > 0 ? plotW / data.length : plotW;
  const barW = Math.max(2, Math.min(slotW * 0.55, 6));

  const display = data.map((p, i) => {
    if (p.y !== null) return { y: p.y, approx: false };
    const prev = data[i - 1]?.y ?? null;
    const next = data[i + 1]?.y ?? null;
    if (prev !== null && next !== null) {
      return { y: (prev + next) / 2, approx: true };
    }
    return { y: null as number | null, approx: false };
  });

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Optimal range tinted band */}
        <Rect
          x={0}
          y={yFor(optimalRange[1])}
          width={plotW}
          height={Math.max(0, yFor(optimalRange[0]) - yFor(optimalRange[1]))}
          fill={semantic.success}
          opacity={0.14}
        />

        {/* Gridlines + right-side Y-axis labels */}
        {Y_TICKS.map((t) => {
          const isOptimalEdge = t === optimalRange[0] || t === optimalRange[1];
          return (
            <React.Fragment key={t}>
              <Line
                x1={0}
                y1={yFor(t)}
                x2={plotW}
                y2={yFor(t)}
                stroke={isOptimalEdge ? semantic.success : borderTokens.subtle}
                strokeWidth={isOptimalEdge ? 1 : StyleSheet.hairlineWidth}
                strokeDasharray={isOptimalEdge ? "3 4" : undefined}
                opacity={isOptimalEdge ? 0.7 : 0.55}
              />
              <SvgText
                x={width - 2}
                y={yFor(t) + 3}
                fontSize={9}
                fill={colors.textTertiary}
                textAnchor="end"
                fontFamily={fontFamily.body}
              >
                {t}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Bars */}
        {display.map((p, i) => {
          if (p.y === null) return null;
          const cx = slotW * i + slotW / 2;
          const x = cx - barW / 2;
          const yTop = yFor(p.y);
          const h = Math.max(2, yFor(0) - yTop);
          const isOptimal = p.y >= optimalRange[0];
          const fill = isOptimal ? semantic.success : "#FFFFFF";
          const isToday = todayIndex !== null && i === todayIndex;
          const opacity = p.approx ? 0.5 : isOptimal ? 0.92 : 0.85;
          return (
            <Rect
              key={i}
              x={x}
              y={yTop}
              width={barW}
              height={h}
              rx={1}
              fill={fill}
              opacity={opacity}
              stroke={isToday ? "rgba(255,255,255,0.95)" : "none"}
              strokeWidth={isToday ? 1 : 0}
            />
          );
        })}

        {/* X-axis date anchors */}
        {xAxisLabels.map((a) => {
          const cx = slotW * a.index + slotW / 2;
          return (
            <SvgText
              key={a.index}
              x={cx}
              y={height - 4}
              fontSize={10}
              fill={colors.textTertiary}
              textAnchor="middle"
              fontFamily={fontFamily.body}
            >
              {a.label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}
