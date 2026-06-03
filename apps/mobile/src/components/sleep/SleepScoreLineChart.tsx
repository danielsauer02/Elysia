/**
 * SleepScoreLineChart
 *
 * 8sleep-style line chart for the 6M / Y timeframes — same fixed 0–100
 * Y-axis with 20-step gridlines + green optimal range band as the
 * SleepScoreBarChart, but a continuous line instead of bars. The line
 * is broken on null gaps wider than one slot so we don't draw fake zero
 * crossings; single-slot gaps are linearly approximated for visual
 * continuity. The legend is rendered by the parent.
 */
import React, { useMemo, useRef, useState } from "react";
import { View, StyleSheet, PanResponder, Text } from "react-native";
import * as Haptics from "expo-haptics";
import Svg, {
  Circle,
  Line as SvgLine,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import {
  borderTokens,
  colors,
  dataColors,
  fontFamily,
  semantic,
} from "@/theme";
import type { AxisLabel, ScoreBarPoint } from "./SleepScoreBarChart";

interface Props {
  data: ScoreBarPoint[];
  width: number;
  height: number;
  optimalRange: [number, number];
  todayIndex: number | null;
  xAxisLabels: AxisLabel[];
  /** Enable the finger scrubber (haptic + curve-tracking dot). */
  enableScrubber?: boolean;
}

const Y_TICKS = [0, 20, 40, 60, 80, 100];
const Y_AXIS_W = 26;
const X_AXIS_H = 20;
const TOP_PAD = 10;

interface ScrubState {
  px: number;
  py: number;
  value: number;
  day: string;
}

export function SleepScoreLineChart({
  data,
  width,
  height,
  optimalRange,
  todayIndex,
  xAxisLabels,
  enableScrubber = false,
}: Props) {
  const plotW = Math.max(1, width - Y_AXIS_W);
  const plotH = Math.max(1, height - X_AXIS_H - TOP_PAD);

  const yFor = (v: number) => TOP_PAD + (1 - v / 100) * plotH;
  const xFor = (i: number) =>
    data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2;

  const filled = data.map((p, i) => {
    if (p.y !== null) return p.y;
    const prev = data[i - 1]?.y ?? null;
    const next = data[i + 1]?.y ?? null;
    if (prev !== null && next !== null) return (prev + next) / 2;
    return null as number | null;
  });

  const runs: string[] = [];
  let cur: string[] = [];
  filled.forEach((y, i) => {
    if (y === null) {
      if (cur.length > 0) {
        runs.push(cur.join(" "));
        cur = [];
      }
      return;
    }
    const cmd = cur.length === 0 ? "M" : "L";
    cur.push(`${cmd}${xFor(i).toFixed(2)} ${yFor(y).toFixed(2)}`);
  });
  if (cur.length > 0) runs.push(cur.join(" "));

  const todayY = todayIndex !== null ? filled[todayIndex] ?? null : null;

  // Scrubber: screen-space points across the non-null run, kept in a ref so
  // the PanResponder closure always reads fresh geometry.
  const screenPts = useMemo(
    () =>
      filled
        .map((y, i) => ({ y, i }))
        .filter((p): p is { y: number; i: number } => p.y !== null)
        .map((p) => ({ sx: xFor(p.i), sy: yFor(p.y), v: p.y, day: data[p.i]!.x })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, plotW, plotH]
  );
  const ptsRef = useRef(screenPts);
  ptsRef.current = screenPts;
  const [scrub, setScrub] = useState<ScrubState | null>(null);

  const scrubAt = (localX: number): ScrubState | null => {
    const pts = ptsRef.current;
    if (pts.length === 0) return null;
    const clamped = Math.max(pts[0]!.sx, Math.min(pts[pts.length - 1]!.sx, localX));
    let lo = pts[0]!;
    let hi = pts[pts.length - 1]!;
    for (let k = 0; k < pts.length - 1; k++) {
      if (clamped >= pts[k]!.sx && clamped <= pts[k + 1]!.sx) {
        lo = pts[k]!;
        hi = pts[k + 1]!;
        break;
      }
    }
    const t = hi.sx === lo.sx ? 0 : (clamped - lo.sx) / (hi.sx - lo.sx);
    const nearest = t < 0.5 ? lo : hi;
    return {
      px: clamped,
      py: lo.sy + (hi.sy - lo.sy) * t,
      value: lo.v + (hi.v - lo.v) * t,
      day: nearest.day,
    };
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => enableScrubber,
        onMoveShouldSetPanResponder: () => enableScrubber,
        onPanResponderGrant: (e) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setScrub(scrubAt(e.nativeEvent.locationX));
        },
        onPanResponderMove: (e) => setScrub(scrubAt(e.nativeEvent.locationX)),
        onPanResponderRelease: () => setScrub(null),
        onPanResponderTerminate: () => setScrub(null),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enableScrubber]
  );

  const fmtDay = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });

  return (
    <View
      style={{ width, height }}
      {...(enableScrubber ? panResponder.panHandlers : {})}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Rect
          x={0}
          y={yFor(optimalRange[1])}
          width={plotW}
          height={Math.max(0, yFor(optimalRange[0]) - yFor(optimalRange[1]))}
          fill={semantic.success}
          opacity={0.14}
        />

        {Y_TICKS.map((t) => {
          const isOptimalEdge = t === optimalRange[0] || t === optimalRange[1];
          return (
            <React.Fragment key={t}>
              <SvgLine
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

        {runs.map((d, i) => (
          <Path
            key={i}
            d={d}
            stroke={dataColors.sleep.base}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {todayIndex !== null && todayY !== null ? (
          <Circle
            cx={xFor(todayIndex)}
            cy={yFor(todayY)}
            r={4}
            fill={dataColors.sleep.base}
            stroke="#000"
            strokeWidth={2}
          />
        ) : null}

        {xAxisLabels.map((a) => (
          <SvgText
            key={a.index}
            x={xFor(a.index)}
            y={height - 4}
            fontSize={10}
            fill={colors.textTertiary}
            textAnchor="middle"
            fontFamily={fontFamily.body}
          >
            {a.label}
          </SvgText>
        ))}

        {/* Scrubber guide */}
        {scrub ? (
          <>
            <SvgLine
              x1={scrub.px}
              y1={TOP_PAD}
              x2={scrub.px}
              y2={TOP_PAD + plotH}
              stroke="rgba(255,255,255,0.45)"
              strokeWidth={1}
            />
            <Circle cx={scrub.px} cy={scrub.py} r={9} fill="#FFFFFF" opacity={0.18} />
            <Circle
              cx={scrub.px}
              cy={scrub.py}
              r={4.5}
              fill="#FFFFFF"
              stroke={dataColors.sleep.base}
              strokeWidth={1.5}
            />
          </>
        ) : null}
      </Svg>

      {scrub ? (
        <View
          pointerEvents="none"
          style={[
            styles.callout,
            { left: Math.max(0, Math.min(width - 96, scrub.px - 48)) },
          ]}
        >
          <Text style={styles.calloutValue}>{Math.round(scrub.value)}</Text>
          <Text style={styles.calloutDay}>{fmtDay(scrub.day)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  callout: {
    position: "absolute",
    top: 0,
    width: 96,
    alignItems: "center",
    backgroundColor: "rgba(10,15,28,0.92)",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: borderTokens.subtle,
    paddingVertical: 4,
  },
  calloutValue: {
    fontFamily: fontFamily.monoBold,
    fontSize: 13,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  calloutDay: {
    fontFamily: fontFamily.body,
    fontSize: 10,
    color: colors.textTertiary,
  },
});
