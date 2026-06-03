/**
 * MetricTrendChart
 *
 * Generalised trend chart for the sleep-metric deep-dive views. Mirrors
 * the Sleep Fitness Score trend visuals (right-edge Y labels, faint
 * gridlines, dashed-green optimal band, sparse X-axis date anchors) but
 * with a configurable scale so it works for percentages, bpm, ms,
 * breaths/min and minute-based KPIs alike.
 *
 * Modes:
 *   - "bar"   Whoop-style daily bars (used on W/M for point-per-night
 *             scores). Missing days simply render no bar.
 *   - "line"  continuous line. Gaps (dead-battery nights) are *bridged*:
 *             we connect the last known point straight to the next one
 *             rather than dropping to zero, which keeps the trend honest.
 *             Optional raw nightly dots (`showDots`, e.g. resting HR).
 *
 * Line charts get an interactive finger scrubber: touch-and-drag paints a
 * vertical guide + glowing dot that rides the curve, with a light haptic
 * tick on grab and a callout showing the value/date under the finger.
 * Bars deliberately have no scrubber.
 */
import React, { useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import Svg, {
  Circle,
  Line as SvgLine,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";
import { borderTokens, colors, fontFamily, semantic } from "@/theme";

export interface TrendPoint {
  x: string; // ISO day
  y: number | null;
}

export interface AxisLabel {
  index: number;
  label: string;
}

interface Props {
  data: TrendPoint[];
  width: number;
  height: number;
  mode: "bar" | "line";
  scaleMin: number;
  scaleMax: number;
  yTicks: number[];
  formatTick: (v: number) => string;
  optimalRange?: [number, number] | null;
  /**
   * Shape of the optimal overlay:
   *   - "band"  shaded window between both bounds (default)
   *   - "below" shaded from the upper bound down to the floor (lower=better)
   *   - "above" shaded from the lower bound up to the ceiling (higher=better)
   */
  optimalKind?: "band" | "below" | "above";
  todayIndex: number | null;
  xAxisLabels: AxisLabel[];
  color: string;
  /** Overlay raw nightly dots on the line (resting HR style). */
  showDots?: boolean;
  /** Enable the finger scrubber (line mode only). */
  enableScrubber?: boolean;
  /** Format the scrubbed value for the callout. */
  formatValue: (v: number) => string;
  /** Format the scrubbed day for the callout. */
  formatScrubDay: (iso: string) => string;
}

const Y_AXIS_W = 34;
const X_AXIS_H = 20;
const TOP_PAD = 12;

interface ScrubState {
  px: number;
  py: number;
  value: number;
  day: string;
}

export function MetricTrendChart({
  data,
  width,
  height,
  mode,
  scaleMin,
  scaleMax,
  yTicks,
  formatTick,
  optimalRange,
  optimalKind = "band",
  todayIndex,
  xAxisLabels,
  color,
  showDots = false,
  enableScrubber = false,
  formatValue,
  formatScrubDay,
}: Props) {
  const plotW = Math.max(1, width - Y_AXIS_W);
  const plotH = Math.max(1, height - X_AXIS_H - TOP_PAD);
  const span = scaleMax - scaleMin || 1;

  const yFor = (v: number) =>
    TOP_PAD + (1 - (v - scaleMin) / span) * plotH;
  const xLine = (i: number) =>
    data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2;
  const slotW = data.length > 0 ? plotW / data.length : plotW;
  const xBarCentre = (i: number) => slotW * i + slotW / 2;

  // Non-null points keep their original index so X positions stay honest
  // and gaps are bridged by a straight segment (no drop to baseline).
  const present = useMemo(
    () =>
      data
        .map((p, i) => ({ i, y: p.y, day: p.x }))
        .filter((p): p is { i: number; y: number; day: string } => p.y !== null),
    [data]
  );

  const linePath = useMemo(() => {
    if (mode !== "line" || present.length === 0) return "";
    return present
      .map(
        (p, k) =>
          `${k === 0 ? "M" : "L"}${xLine(p.i).toFixed(2)} ${yFor(p.y).toFixed(2)}`
      )
      .join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [present, mode, plotW, plotH, scaleMin, scaleMax]);

  // Screen-space points for scrubbing — kept in a ref so the PanResponder
  // closure always reads the latest geometry without re-subscribing.
  const screenPts = useMemo(
    () => present.map((p) => ({ sx: xLine(p.i), sy: yFor(p.y), v: p.y, day: p.day })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [present, plotW, plotH, scaleMin, scaleMax]
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
    const py = lo.sy + (hi.sy - lo.sy) * t;
    const value = lo.v + (hi.v - lo.v) * t;
    const nearest = t < 0.5 ? lo : hi;
    return { px: clamped, py, value, day: nearest.day };
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => enableScrubber && mode === "line",
        onMoveShouldSetPanResponder: () => enableScrubber && mode === "line",
        onPanResponderGrant: (e) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          setScrub(scrubAt(e.nativeEvent.locationX));
        },
        onPanResponderMove: (e) => {
          setScrub(scrubAt(e.nativeEvent.locationX));
        },
        onPanResponderRelease: () => setScrub(null),
        onPanResponderTerminate: () => setScrub(null),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enableScrubber, mode]
  );

  // Shaded optimal region (top/bottom in data units) + the threshold lines
  // to dash. Single-sided kinds anchor one edge to the chart floor/ceiling
  // and only dash the meaningful threshold. We never dash a boundary that
  // sits on the axis edge — it would read as a stray baseline.
  let bandTopV: number | null = null;
  let bandBotV: number | null = null;
  let dashedLines: number[] = [];
  if (optimalRange != null) {
    if (optimalKind === "below") {
      bandTopV = Math.min(scaleMax, optimalRange[1]);
      bandBotV = scaleMin;
      dashedLines = [optimalRange[1]];
    } else if (optimalKind === "above") {
      bandTopV = scaleMax;
      bandBotV = Math.max(scaleMin, optimalRange[0]);
      dashedLines = [optimalRange[0]];
    } else {
      bandTopV = Math.min(scaleMax, optimalRange[1]);
      bandBotV = Math.max(scaleMin, optimalRange[0]);
      dashedLines = [optimalRange[0], optimalRange[1]];
    }
  }
  const showBand = bandTopV != null && bandBotV != null && bandTopV > bandBotV;
  const visibleDashed = dashedLines.filter((v) => v > scaleMin && v < scaleMax);

  const barBaseline = yFor(scaleMin);

  return (
    <View
      style={{ width, height }}
      {...(enableScrubber && mode === "line" ? panResponder.panHandlers : {})}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Optimal-range tinted band */}
        {showBand ? (
          <Rect
            x={0}
            y={yFor(bandTopV!)}
            width={plotW}
            height={Math.max(0, yFor(bandBotV!) - yFor(bandTopV!))}
            fill={semantic.success}
            opacity={0.14}
          />
        ) : null}

        {/* Faint gridlines + right-edge Y labels */}
        {yTicks.map((t) => (
          <React.Fragment key={`g${t}`}>
            <SvgLine
              x1={0}
              y1={yFor(t)}
              x2={plotW}
              y2={yFor(t)}
              stroke={borderTokens.subtle}
              strokeWidth={StyleSheet.hairlineWidth}
              opacity={0.5}
            />
            <SvgText
              x={width - 2}
              y={yFor(t) + 3}
              fontSize={9}
              fill={colors.textTertiary}
              textAnchor="end"
              fontFamily={fontFamily.body}
            >
              {formatTick(t)}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Dashed-green optimal threshold(s) */}
        {showBand
          ? visibleDashed.map((b, k) => (
              <SvgLine
                key={`b${k}`}
                x1={0}
                y1={yFor(b)}
                x2={plotW}
                y2={yFor(b)}
                stroke={semantic.success}
                strokeWidth={1}
                strokeDasharray="3 4"
                opacity={0.7}
              />
            ))
          : null}

        {/* Bars */}
        {mode === "bar"
          ? present.map((p) => {
              const yTop = yFor(p.y);
              const h = Math.max(2, barBaseline - yTop);
              const inOptimal =
                optimalRange != null &&
                p.y >= optimalRange[0] &&
                p.y <= optimalRange[1];
              const fill = inOptimal ? semantic.success : "#FFFFFF";
              const isToday = todayIndex !== null && p.i === todayIndex;
              const barW = Math.max(2, Math.min(slotW * 0.55, 7));
              return (
                <Rect
                  key={p.i}
                  x={xBarCentre(p.i) - barW / 2}
                  y={yTop}
                  width={barW}
                  height={h}
                  rx={1}
                  fill={fill}
                  opacity={inOptimal ? 0.92 : 0.85}
                  stroke={isToday ? "rgba(255,255,255,0.95)" : "none"}
                  strokeWidth={isToday ? 1 : 0}
                />
              );
            })
          : null}

        {/* Line */}
        {mode === "line" && linePath ? (
          <Path
            d={linePath}
            stroke={color}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {/* Raw nightly dots (resting-HR style) */}
        {mode === "line" && showDots
          ? present.map((p) => (
              <Circle
                key={`d${p.i}`}
                cx={xLine(p.i)}
                cy={yFor(p.y)}
                r={2.4}
                fill={color}
                opacity={0.55}
              />
            ))
          : null}

        {/* Today pin on line charts */}
        {mode === "line" && todayIndex !== null
          ? (() => {
              const tp = present.find((p) => p.i === todayIndex);
              if (!tp) return null;
              return (
                <Circle
                  cx={xLine(tp.i)}
                  cy={yFor(tp.y)}
                  r={4}
                  fill={color}
                  stroke="#000"
                  strokeWidth={2}
                />
              );
            })()
          : null}

        {/* X-axis date anchors */}
        {xAxisLabels.map((a) => (
          <SvgText
            key={`x${a.index}`}
            x={mode === "bar" ? xBarCentre(a.index) : xLine(a.index)}
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
              stroke={color}
              strokeWidth={1.5}
            />
          </>
        ) : null}
      </Svg>

      {/* Scrubber callout */}
      {scrub ? (
        <View
          pointerEvents="none"
          style={[
            styles.callout,
            {
              left: Math.max(0, Math.min(width - 96, scrub.px - 48)),
            },
          ]}
        >
          <Text style={styles.calloutValue}>{formatValue(scrub.value)}</Text>
          <Text style={styles.calloutDay}>{formatScrubDay(scrub.day)}</Text>
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
