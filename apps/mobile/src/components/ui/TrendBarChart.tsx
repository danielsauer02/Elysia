/**
 * TrendBarChart
 *
 * Vertical-bar chart over a numeric series. Supports:
 *   - optional `optimalRange` horizontal band drawn behind the bars
 *   - optional dashed `avg` baseline
 *   - optional `pinX` pin (Eight-Sleep style "today" highlight)
 *   - null values render as a faded ghost bar so the spacing stays even
 *
 * SVG-only — Skia would be overkill for 7–90 bars and breaks portability
 * with the rest of the screen.
 */
import React from "react";
import { View } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import { dataColors } from "@/theme";

export interface BarPoint {
  x: string | number;
  y: number | null;
}

interface Props {
  data: BarPoint[];
  width: number;
  height: number;
  /** Y-axis upper bound. Defaults to max(data) * 1.1. */
  max?: number;
  /** Y-axis lower bound. Defaults to 0. */
  min?: number;
  color?: string;
  /** Inclusive horizontal band drawn behind bars, e.g. [80, 100]. */
  optimalRange?: [number, number] | null;
  /** Dashed average baseline. */
  avg?: number | null;
  /** Index of bar to outline as the "pin" (today). */
  pinIndex?: number | null;
  /** Background grid track colour (faint). */
  trackColor?: string;
  paddingX?: number;
  paddingY?: number;
}

export function TrendBarChart({
  data,
  width,
  height,
  max,
  min = 0,
  color = dataColors.sleep.base,
  optimalRange = null,
  avg = null,
  pinIndex = null,
  trackColor = "rgba(255,255,255,0.05)",
  paddingX = 6,
  paddingY = 8,
}: Props) {
  const innerW = Math.max(1, width - paddingX * 2);
  const innerH = Math.max(1, height - paddingY * 2);
  const dataMax =
    max ??
    Math.max(
      1,
      ...data.map((d) => (d.y ?? 0) * 1.1),
      optimalRange?.[1] ?? 0,
      avg ?? 0
    );
  const span = Math.max(1, dataMax - min);

  const slotW = data.length > 0 ? innerW / data.length : innerW;
  const barW = Math.max(2, slotW * 0.55);

  const yFor = (v: number) => paddingY + (1 - (v - min) / span) * innerH;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Optimal-range band */}
        {optimalRange ? (
          <Rect
            x={0}
            y={yFor(optimalRange[1])}
            width={width}
            height={Math.max(0, yFor(optimalRange[0]) - yFor(optimalRange[1]))}
            fill={color}
            opacity={0.07}
          />
        ) : null}

        {/* Baseline (zero / min) */}
        <Line
          x1={0}
          y1={yFor(min)}
          x2={width}
          y2={yFor(min)}
          stroke={trackColor}
          strokeWidth={1}
        />

        {/* Average dashed line */}
        {avg !== null && avg !== undefined ? (
          <Line
            x1={0}
            y1={yFor(avg)}
            x2={width}
            y2={yFor(avg)}
            stroke="rgba(255,255,255,0.45)"
            strokeWidth={1}
            strokeDasharray="3 4"
          />
        ) : null}

        {/* Bars */}
        {data.map((p, i) => {
          const cx = paddingX + slotW * i + slotW / 2;
          const x = cx - barW / 2;
          const v = p.y ?? 0;
          const isMissing = p.y === null;
          const yTop = yFor(Math.max(min, v));
          const h = Math.max(2, yFor(min) - yTop);
          const isPin = pinIndex !== null && i === pinIndex;

          return (
            <Rect
              key={i}
              x={x}
              y={yTop}
              width={barW}
              height={h}
              rx={Math.min(3, barW / 2)}
              fill={color}
              opacity={isMissing ? 0.12 : isPin ? 1 : 0.85}
              stroke={isPin ? "rgba(255,255,255,0.9)" : "none"}
              strokeWidth={isPin ? 1 : 0}
            />
          );
        })}
      </Svg>
    </View>
  );
}
