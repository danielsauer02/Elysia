/**
 * TrendLineChart
 *
 * Smooth line over a numeric series. Supports an optional dashed `avg`
 * baseline and a "today" pin (filled dot + vertical drop line). Also
 * works as the sparkline inside metric tiles when `compact` is true
 * (axes hidden, smaller stroke, shorter padding).
 *
 * Null points break the line — we render the prefix/suffix as separate
 * polylines so the dashboard never shows a fake zero crossing.
 */
import React from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { dataColors } from "@/theme";

export interface LinePoint {
  x: string | number;
  y: number | null;
}

interface Props {
  data: LinePoint[];
  width: number;
  height: number;
  min?: number;
  max?: number;
  color?: string;
  avg?: number | null;
  /** Index whose value gets a dot + drop-line. */
  pinIndex?: number | null;
  compact?: boolean;
  paddingX?: number;
  paddingY?: number;
}

export function TrendLineChart({
  data,
  width,
  height,
  min,
  max,
  color = dataColors.sleep.base,
  avg = null,
  pinIndex = null,
  compact = false,
  paddingX,
  paddingY,
}: Props) {
  const pX = paddingX ?? (compact ? 2 : 8);
  const pY = paddingY ?? (compact ? 2 : 10);
  const innerW = Math.max(1, width - pX * 2);
  const innerH = Math.max(1, height - pY * 2);

  const numericValues = data.map((d) => d.y).filter((v): v is number => v !== null);
  const dataMin = min ?? (numericValues.length ? Math.min(...numericValues) : 0);
  const dataMax = max ?? (numericValues.length ? Math.max(...numericValues) : 1);
  const span = Math.max(0.0001, dataMax - dataMin);
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const xFor = (i: number) => pX + stepX * i;
  const yFor = (v: number) => pY + (1 - (v - dataMin) / span) * innerH;

  // Build path with breaks on null
  type Run = { d: string };
  const runs: Run[] = [];
  let current: string[] = [];
  data.forEach((p, i) => {
    if (p.y === null) {
      if (current.length > 0) {
        runs.push({ d: current.join(" ") });
        current = [];
      }
      return;
    }
    const cmd = current.length === 0 ? "M" : "L";
    current.push(`${cmd}${xFor(i).toFixed(2)} ${yFor(p.y).toFixed(2)}`);
  });
  if (current.length > 0) runs.push({ d: current.join(" ") });

  const stroke = compact ? 1.6 : 2;

  // Pin
  let pin: { x: number; y: number; value: number } | null = null;
  if (pinIndex !== null && pinIndex !== undefined) {
    const p = data[pinIndex];
    if (p && p.y !== null) {
      pin = { x: xFor(pinIndex), y: yFor(p.y), value: p.y };
    }
  }

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {!compact && avg !== null && avg !== undefined ? (
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

        {runs.map((r, i) => (
          <Path
            key={i}
            d={r.d}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}

        {pin ? (
          <>
            <Line
              x1={pin.x}
              y1={pin.y}
              x2={pin.x}
              y2={height - pY}
              stroke={color}
              strokeWidth={1}
              opacity={0.45}
            />
            <Circle cx={pin.x} cy={pin.y} r={4} fill={color} stroke="#000" strokeWidth={2} />
          </>
        ) : null}
      </Svg>
    </View>
  );
}
