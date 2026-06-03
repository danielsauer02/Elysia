/**
 * ScatterTrendChart
 *
 * Bevel-inspired scatter cloud with an optional smoothed median line.
 * Used for intra-night HR/HRV/RR/SpO2 distributions and as a fallback
 * for cross-night HR/HRV/RR/SpO2 trends until the smart band feeds
 * intra-night samples.
 *
 *   points    — array of (t, v) numeric pairs
 *   smoothed  — when true and >=3 points, render a Catmull-Rom-ish
 *               polyline through a windowed median
 */
import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { dataColors } from "@/theme";

export interface ScatterPoint {
  t: number;
  v: number;
}

interface Props {
  points: ScatterPoint[];
  width: number;
  height: number;
  color?: string;
  smoothed?: boolean;
  min?: number;
  max?: number;
  avg?: number | null;
  paddingX?: number;
  paddingY?: number;
}

export function ScatterTrendChart({
  points,
  width,
  height,
  color = dataColors.sleep.base,
  smoothed = true,
  min,
  max,
  avg = null,
  paddingX = 6,
  paddingY = 10,
}: Props) {
  const innerW = Math.max(1, width - paddingX * 2);
  const innerH = Math.max(1, height - paddingY * 2);

  const xs = points.map((p) => p.t);
  const vs = points.map((p) => p.v);
  const xMin = xs.length ? Math.min(...xs) : 0;
  const xMax = xs.length ? Math.max(...xs) : 1;
  const xSpan = Math.max(0.0001, xMax - xMin);
  const yMin = min ?? (vs.length ? Math.min(...vs) : 0);
  const yMax = max ?? (vs.length ? Math.max(...vs) : 1);
  const ySpan = Math.max(0.0001, yMax - yMin);

  const xFor = (t: number) => paddingX + ((t - xMin) / xSpan) * innerW;
  const yFor = (v: number) => paddingY + (1 - (v - yMin) / ySpan) * innerH;

  // Smoothed line via rolling median of 3.
  const smoothPath = useMemo(() => {
    if (!smoothed || points.length < 3) return null;
    const sorted = [...points].sort((a, b) => a.t - b.t);
    const window = 3;
    const half = Math.floor(window / 2);
    const pts: ScatterPoint[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const lo = Math.max(0, i - half);
      const hi = Math.min(sorted.length, i + half + 1);
      const slice = sorted.slice(lo, hi).map((p) => p.v).sort((a, b) => a - b);
      const med = slice[Math.floor(slice.length / 2)]!;
      pts.push({ t: sorted[i]!.t, v: med });
    }
    const d = pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${xFor(p.t).toFixed(2)} ${yFor(p.v).toFixed(2)}`)
      .join(" ");
    return d;
  }, [smoothed, points, xMin, xSpan, yMin, ySpan, paddingX, paddingY, innerW, innerH]);

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {avg !== null && avg !== undefined ? (
          <Line
            x1={0}
            y1={yFor(avg)}
            x2={width}
            y2={yFor(avg)}
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={1}
            strokeDasharray="3 4"
          />
        ) : null}
        {points.map((p, i) => (
          <Circle
            key={i}
            cx={xFor(p.t)}
            cy={yFor(p.v)}
            r={2.4}
            fill={color}
            opacity={0.55}
          />
        ))}
        {smoothPath ? (
          <Path
            d={smoothPath}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={0.95}
          />
        ) : null}
      </Svg>
    </View>
  );
}
