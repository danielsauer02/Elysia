/**
 * BodyClockWheel
 *
 * Oura-style 24h "body clock" dial. The circle is split into 8 slices by
 * four diameters (every 3h); hour anchors sit outside at 12am (top), 6am
 * (right), 12pm (bottom), 6pm (left) and the four 3-hour diagonals, with
 * faint minor dots on the in-between hours.
 *
 * Two concentric bands:
 *   - inner  the chronotype's *optimal* sleep window (suggested), a soft
 *            translucent band with a white midpoint dot
 *   - outer  *last night's recorded* sleep, a brighter arc that breaks
 *            wherever you were awake, with a white midpoint dot and a bed
 *            icon at the moment you fell asleep
 *
 * `mode="optimalOnly"` drops the outer/actual ring and paints the optimal
 * window as the single bright arc — used on the deep-dive page.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { colors, dataColors, fontFamily } from "@/theme";

export interface WheelSchedule {
  asleepHour: number;
  midpointHour: number;
  awakeHour: number;
}

export interface WheelActual {
  asleepHour: number;
  awakeHour: number;
  midpointHour: number;
  /** Awake windows (in clock hours) that break the recorded arc. */
  breaks: { from: number; to: number }[];
}

interface Props {
  size: number;
  optimal: WheelSchedule | null;
  actual?: WheelActual | null;
  mode?: "dual" | "optimalOnly";
}

const LABEL_HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

// Outer (actual recorded sleep) reads brighter + bluer than the inner
// chronotype band so the two rings are instantly distinguishable.
const ACTUAL_COLOR = "#7DD3FC";

const RING_W = 8;

function hourLabel(h: number): string {
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

export function BodyClockWheel({ size, optimal, actual, mode = "dual" }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 30;
  // Equal-width rings with a small gap between them.
  const rInner = rOuter - (RING_W + 6);
  const rLines = rInner - 4;
  const rDots = rOuter + 9;
  const rLabels = rOuter + 22;
  // A touch more breathing room from the outer ring so the bed doesn't look
  // pasted onto the arc (matches Oura's spacing).
  const rBed = rOuter + 17;

  const angle = (h: number) => ((h % 24) / 24) * 2 * Math.PI - Math.PI / 2;
  const polar = (h: number, r: number) => ({
    x: cx + Math.cos(angle(h)) * r,
    y: cy + Math.sin(angle(h)) * r,
  });

  const arcPath = (from: number, to: number, r: number): string => {
    const s = polar(from, r);
    const e = polar(to, r);
    let sweep = to - from;
    if (sweep < 0) sweep += 24;
    const largeArc = sweep > 12 ? 1 : 0;
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  };

  const span = (from: number, to: number) => {
    let s = to - from;
    if (s < 0) s += 24;
    return s;
  };

  // Carve a sleep window into "on" sub-arcs by removing awake breaks.
  const onSegments = (
    asleep: number,
    awake: number,
    breaks: { from: number; to: number }[]
  ): [number, number][] => {
    const total = span(asleep, awake);
    if (total <= 0) return [];
    const offs = breaks
      .map((b) => [span(asleep, b.from), span(asleep, b.to)] as [number, number])
      .map(([f, t]) => [
        Math.max(0, Math.min(total, f)),
        Math.max(0, Math.min(total, t)),
      ] as [number, number])
      .filter(([f, t]) => t > f)
      .sort((a, b) => a[0] - b[0]);
    const segs: [number, number][] = [];
    let cur = 0;
    for (const [f, t] of offs) {
      if (f > cur) segs.push([cur, f]);
      cur = Math.max(cur, t);
    }
    if (cur < total) segs.push([cur, total]);
    // Safety net: if breaks happened to swallow the entire window (e.g.
    // bogus/aggregate awake data), still draw the full recorded arc rather
    // than rendering nothing.
    if (segs.length === 0) return [[asleep % 24, awake % 24]];
    return segs.map(([f, t]) => [(asleep + f) % 24, (asleep + t) % 24]);
  };

  const showActual = mode === "dual" && actual != null;
  const optimalRadius = mode === "optimalOnly" ? rOuter : rInner;

  // Bed icon rides just outside the outer ring, anchored to the recorded
  // sleep midpoint. If it lands on top of an hour label, the whole icon
  // fades so the time stays readable.
  const bedPoint = showActual ? polar(actual!.midpointHour, rBed) : null;
  const bedFaded =
    bedPoint != null &&
    LABEL_HOURS.some((h) => {
      const lp = polar(h, rLabels);
      return Math.hypot(lp.x - bedPoint.x, lp.y - bedPoint.y) < 24;
    });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* 8-slice diameters */}
        {[0, 3, 6, 9].map((h) => {
          const a = polar(h, rLines);
          const b = polar(h + 12, rLines);
          return (
            <Path
              key={`l${h}`}
              d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
          );
        })}

        {/* Base tracks — same width as the data rings */}
        <Circle
          cx={cx}
          cy={cy}
          r={rOuter}
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={RING_W}
          fill="none"
        />
        {mode === "dual" ? (
          <Circle
            cx={cx}
            cy={cy}
            r={rInner}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={RING_W}
            fill="none"
          />
        ) : null}

        {/* Optimal window (inner band in dual mode, the headline arc when alone) */}
        {optimal ? (
          <Path
            d={arcPath(optimal.asleepHour, optimal.awakeHour, optimalRadius)}
            stroke={dataColors.sleep.base}
            strokeWidth={RING_W}
            strokeLinecap="round"
            fill="none"
            opacity={mode === "optimalOnly" ? 0.95 : 0.6}
          />
        ) : null}

        {/* Optimal midpoint dot */}
        {optimal ? (
          <Circle
            cx={polar(optimal.midpointHour, optimalRadius).x}
            cy={polar(optimal.midpointHour, optimalRadius).y}
            r={4.5}
            fill="#FFFFFF"
            opacity={mode === "optimalOnly" ? 1 : 0.85}
          />
        ) : null}

        {/* Actual recorded sleep (outer), brighter + broken at awake windows */}
        {showActual
          ? onSegments(actual!.asleepHour, actual!.awakeHour, actual!.breaks).map(
              ([f, t], i) => (
                <Path
                  key={`a${i}`}
                  d={arcPath(f, t, rOuter)}
                  stroke={ACTUAL_COLOR}
                  strokeWidth={RING_W}
                  strokeLinecap="round"
                  fill="none"
                />
              )
            )
          : null}

        {/* Actual midpoint dot */}
        {showActual ? (
          <Circle
            cx={polar(actual!.midpointHour, rOuter).x}
            cy={polar(actual!.midpointHour, rOuter).y}
            r={5}
            fill="#FFFFFF"
            stroke="#0B1020"
            strokeWidth={1.5}
          />
        ) : null}
      </Svg>

      {/* Hour labels */}
      {LABEL_HOURS.map((h) => {
        const p = polar(h, rLabels);
        return (
          <Text key={`hl${h}`} style={[styles.hourLabel, { left: p.x - 16, top: p.y - 7 }]}>
            {hourLabel(h)}
          </Text>
        );
      })}

      {/* Minor hour dots */}
      {Array.from({ length: 24 }, (_, h) => h)
        .filter((h) => h % 3 !== 0)
        .map((h) => {
          const p = polar(h, rDots);
          return (
            <View
              key={`md${h}`}
              style={[styles.minorDot, { left: p.x - 1.5, top: p.y - 1.5 }]}
            />
          );
        })}

      {/* Bed icon at the recorded sleep midpoint, just outside the ring.
          Fades to transparent if it would otherwise cover an hour label. */}
      {bedPoint ? (
        <View
          pointerEvents="none"
          style={[
            styles.bedWrap,
            {
              left: bedPoint.x - 9,
              top: bedPoint.y - 9,
              opacity: bedFaded ? 0.35 : 1,
            },
          ]}
        >
          <Ionicons name="bed" size={11} color="#0B1020" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hourLabel: {
    position: "absolute",
    width: 32,
    textAlign: "center",
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
    color: colors.textTertiary,
  },
  minorDot: {
    position: "absolute",
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  bedWrap: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: ACTUAL_COLOR,
    alignItems: "center",
    justifyContent: "center",
  },
});
