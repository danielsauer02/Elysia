/**
 * BowGauge
 *
 * Eight-Sleep-inspired 180° dashed gauge. SVG-based for sharp dashes at
 * any DPI. The filled segment is either a single-color sweep
 * (`value`) or a weighted multi-color sequence (`segments`) where each
 * segment occupies a fraction of the total bow proportional to its
 * weight × performance — exactly mirroring 8sleep's D-view layout.
 *
 *   value           — 0..max, will be clamped (ignored when `segments` is set)
 *   max             — defaults to 100
 *   size            — outer square in px (svg viewport)
 *   ticks           — how many dashes around the arc (default 56)
 *   segments        — optional: multi-color weighted fill, in order
 *   tickInnerRatio  — inner radius as fraction of outer (controls dash length).
 *                     0.86 ≈ 8sleep stubby ticks, 0.7 = long ticks.
 *
 * Centre content (number + label) is supplied via the `centre` prop so
 * the caller controls fonts.
 */
import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Defs, G, Line, LinearGradient, Path, Stop } from "react-native-svg";
import { dataColors } from "@/theme";

export interface BowSegment {
  /** Fraction of the FULL arc this segment fills (0..1). Segments sum ≤ 1. */
  fillFraction: number;
  color: string;
}

interface Props {
  value?: number;
  max?: number;
  size?: number;
  /** Tick count — only honoured in `mode="dashes"`. */
  ticks?: number;
  /** Two-stop gradient for the filled portion (single-color mode). */
  gradient?: readonly [string, string];
  /** Colour of the unfilled trail. */
  trailColor?: string;
  /** Tick / stroke width. */
  tickWidth?: number;
  centre?: React.ReactNode;
  /** Inner radius as fraction of outer radius. Lower = longer dashes. */
  tickInnerRatio?: number;
  /** Multi-segment fill (overrides `value`/`gradient` when provided). */
  segments?: BowSegment[];
  /**
   * `dashes`  — 8sleep home-card look: discrete radial ticks (default).
   * `solid`   — 8sleep trend-D-view look: one continuous stroked arc,
   *             ideal for showing weighted segments as butt-joined arcs
   *             with no visible gap between adjacent colours.
   */
  mode?: "dashes" | "solid";
}

// 180° arc starting at 180° (9 o'clock) sweeping to 0° (3 o'clock).
function arcPoint(cx: number, cy: number, r: number, t: number) {
  const angle = Math.PI + t * Math.PI;
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  tStart: number,
  tEnd: number
): string {
  if (tEnd <= tStart) return "";
  const p0 = arcPoint(cx, cy, r, tStart);
  const p1 = arcPoint(cx, cy, r, tEnd);
  const largeArc = tEnd - tStart > 0.5 ? 1 : 0;
  return `M${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
}

export function BowGauge({
  value = 0,
  max = 100,
  size = 240,
  ticks = 56,
  gradient = dataColors.sleep.gradient,
  trailColor = "rgba(255,255,255,0.07)",
  tickWidth = 2,
  centre,
  tickInnerRatio = 0.86,
  segments,
  mode = "dashes",
}: Props) {
  const cx = size / 2;
  const cy = size / 2;
  // Pad the outer radius by half the stroke width so the top of the
  // bow is never clipped by the SVG viewport (a 12px stroke would
  // otherwise hang 6px above y=0 and read as a dark horizontal cut).
  const strokeW = mode === "solid" ? Math.max(tickWidth, 10) : tickWidth;
  const rOuter = size / 2 - 2 - strokeW / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="bowFill" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={gradient[0]} stopOpacity="1" />
            <Stop offset="1" stopColor={gradient[1]} stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {mode === "solid"
          ? renderSolid({ cx, cy, r: rOuter, segments, value, max, trailColor, strokeW })
          : renderDashes({
              cx,
              cy,
              rOuter,
              rInner: rOuter * tickInnerRatio,
              ticks,
              segments,
              value,
              max,
              trailColor,
              tickWidth,
            })}
      </Svg>
      {centre ? <View style={styles.centre} pointerEvents="none">{centre}</View> : null}
    </View>
  );
}

function renderDashes({
  cx,
  cy,
  rOuter,
  rInner,
  ticks,
  segments,
  value,
  max,
  trailColor,
  tickWidth,
}: {
  cx: number;
  cy: number;
  rOuter: number;
  rInner: number;
  ticks: number;
  segments: BowSegment[] | undefined;
  value: number;
  max: number;
  trailColor: string;
  tickWidth: number;
}) {
  const tickColors: (string | null)[] = new Array(ticks).fill(null);
  if (segments && segments.length > 0) {
    let cursor = 0;
    for (const seg of segments) {
      const segTicks = Math.round(Math.max(0, Math.min(1, seg.fillFraction)) * ticks);
      for (let i = 0; i < segTicks && cursor < ticks; i++) {
        tickColors[cursor] = seg.color;
        cursor++;
      }
    }
  } else {
    const pct = Math.max(0, Math.min(1, value / Math.max(1, max)));
    const filled = Math.round(pct * ticks);
    for (let i = 0; i < filled; i++) tickColors[i] = "url(#bowFill)";
  }

  return (
    <G>
      {Array.from({ length: ticks }, (_, i) => {
        const t = ticks === 1 ? 0 : i / (ticks - 1);
        const angle = Math.PI + t * Math.PI;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return (
          <Line
            key={i}
            x1={cx + cos * rInner}
            y1={cy + sin * rInner}
            x2={cx + cos * rOuter}
            y2={cy + sin * rOuter}
            stroke={tickColors[i] ?? trailColor}
            strokeWidth={tickWidth}
            strokeLinecap="round"
          />
        );
      })}
    </G>
  );
}

function renderSolid({
  cx,
  cy,
  r,
  segments,
  value,
  max,
  trailColor,
  strokeW,
}: {
  cx: number;
  cy: number;
  r: number;
  segments: BowSegment[] | undefined;
  value: number;
  max: number;
  trailColor: string;
  strokeW: number;
}) {
  const segs: BowSegment[] =
    segments && segments.length > 0
      ? segments
      : [
          {
            fillFraction: Math.max(0, Math.min(1, value / Math.max(1, max))),
            color: "url(#bowFill)",
          },
        ];

  // Trail underneath, then paint each segment as an arc starting where
  // the previous one ended. Half-tick overlap (epsilon) hides the
  // hairline join between adjacent colours.
  const eps = 0.004;
  let cursor = 0;
  const paths: { d: string; color: string; key: string }[] = [];
  segs.forEach((s, i) => {
    const f = Math.max(0, s.fillFraction);
    // Skip zero-fill segments (e.g. a contributor whose sub-score is
    // missing) — without this we'd still draw the eps-padded join and
    // get a tiny mystery tick on the bow.
    if (f <= 0) return;
    const next = Math.min(1, cursor + f);
    const tStart = Math.max(0, cursor - (i === 0 ? 0 : eps));
    const tEnd = Math.min(1, next + eps);
    const d = arcPath(cx, cy, r, tStart, tEnd);
    if (d) paths.push({ d, color: s.color, key: `seg-${i}` });
    cursor = next;
  });

  return (
    <G>
      <Path
        d={arcPath(cx, cy, r, 0, 1)}
        stroke={trailColor}
        strokeWidth={strokeW}
        fill="none"
        strokeLinecap="butt"
      />
      {paths.map((p) => (
        <Path
          key={p.key}
          d={p.d}
          stroke={p.color}
          strokeWidth={strokeW}
          fill="none"
          strokeLinecap="butt"
        />
      ))}
    </G>
  );
}

const styles = StyleSheet.create({
  centre: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
