/**
 * EnergyCurveChart
 *
 * Bevel-style reserve curve for the Energy Reserve deep dive.
 *
 *   • Time-based X axis (sleep onset → xEnd); the curve only occupies onset →
 *     now, the rest of the day is empty. Clean 6-hour clock grid.
 *   • Under-curve overlay coloured by the reserve's ZONE at each time
 *     (green > 50%, amber 25–50%, red < 25%), fading downward and ending at
 *     the 0 line. Below 0 there's no overlay.
 *   • Curve is DASHED while passive (sleep charge + baseline drain) and a
 *     SOLID orange line during workouts (the steeper dips).
 *   • Sleep window: blue line + moon sitting on the 100% line, a blue veil
 *     down the whole column, and a green "charging" bar (with a bolt in a dark
 *     disc) below the 0 line.
 *   • Workouts: orange line + dumbbell on the 100% line and an orange veil.
 *   • Y axis can dip below 0.
 */
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import {
  ENERGY_AMBER,
  ENERGY_GREEN,
  ENERGY_RED,
  energyLevelColor,
  energyZoneColor,
} from "./energyColors";
import { colors, fontFamily } from "@/theme";

export interface EnergySample {
  t: string;
  e: number;
  phase: "charge" | "drain" | "workout";
}
export interface EnergyEvent {
  kind: "sleep" | "workout";
  tStart: string;
  tEnd: string;
  label: string;
  delta: number;
}

interface Props {
  samples: EnergySample[];
  events: EnergyEvent[];
  xStart: string;
  xEnd: string;
  width: number;
  height: number;
  onScrub?: (sample: EnergySample | null) => void;
}

const SLEEP_BLUE = "#6E8BFF";
const WORKOUT_ORANGE = "#FB923C";

const PAD_L = 8;
const PAD_R = 36; // Y labels live on the RIGHT (Bevel-style)
const PAD_T = 22; // top band for the moon / workout icons (above the 100 line)
const PAD_B = 22;
const SCRUB_ROW_H = 18;

const Y_TOP = 100;
const Y_BOTTOM = -25;
const Y_SPAN = Y_TOP - Y_BOTTOM;
const CHARGE_BAR_E = -13;

function fmtClock(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCHours().toString().padStart(2, "0")}:${d
    .getUTCMinutes()
    .toString()
    .padStart(2, "0")}`;
}

export function EnergyCurveChart({
  samples,
  events,
  xStart,
  xEnd,
  width,
  height,
  onScrub,
}: Props) {
  const [scrub, setScrub] = useState<EnergySample | null>(null);

  const xStartMs = Date.parse(xStart);
  const xEndMs = Math.max(xStartMs + 1, Date.parse(xEnd));
  const innerW = width - PAD_L - PAD_R;
  const plotTop = PAD_T;
  const plotBottom = height - PAD_B;

  const xForMs = (ms: number) =>
    PAD_L + Math.max(0, Math.min(1, (ms - xStartMs) / (xEndMs - xStartMs))) * innerW;
  const yFor = (e: number) =>
    plotTop + ((Y_TOP - e) / Y_SPAN) * (plotBottom - plotTop);

  const y0 = yFor(0);
  const lineY = yFor(100); // moon / workout line sits ON the 100% line
  const chargeBarY = yFor(CHARGE_BAR_E);

  const sleepEv = events.find((e) => e.kind === "sleep") ?? null;
  const workouts = events.filter((e) => e.kind === "workout");

  // ── Curve paths: dashed (passive) vs solid (workout) ──
  // Build CONTINUOUS polylines per run (one M + many L) so the dash pattern
  // runs across the whole passive stretch instead of resetting every segment
  // (which made tiny segments render solid).
  const { dashedPath, solidPath, lastPt } = useMemo(() => {
    if (samples.length === 0) return { dashedPath: "", solidPath: "", lastPt: null };
    const pt = (s: EnergySample) => ({ x: xForMs(Date.parse(s.t)), y: yFor(s.e) });
    const cat = (s: EnergySample) => (s.phase === "workout" ? "solid" : "dash");
    let dashed = "";
    let solid = "";
    let i = 0;
    while (i < samples.length - 1) {
      const c = cat(samples[i]!);
      let j = i;
      while (j < samples.length - 1 && cat(samples[j]!) === c) j++;
      const start = pt(samples[i]!);
      let d = `M${start.x.toFixed(1)} ${start.y.toFixed(1)}`;
      for (let k = i + 1; k <= j; k++) {
        const p = pt(samples[k]!);
        d += ` L${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      }
      if (c === "solid") solid += `${d} `;
      else dashed += `${d} `;
      i = j; // share the boundary point so runs stay connected
    }
    return { dashedPath: dashed.trim(), solidPath: solid.trim(), lastPt: pt(samples[samples.length - 1]!) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples, width, height, xStart, xEnd]);

  // ── Zone overlay: per-time coloured quads (curve → 0 line) ──
  const zonePaths = useMemo(() => {
    const out: Record<string, string> = {
      [ENERGY_GREEN]: "",
      [ENERGY_AMBER]: "",
      [ENERGY_RED]: "",
    };
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i]!;
      const b = samples[i + 1]!;
      if (a.e <= 0 || b.e <= 0) continue;
      const xa = xForMs(Date.parse(a.t));
      const xb = xForMs(Date.parse(b.t));
      const ya = yFor(a.e);
      const yb = yFor(b.e);
      const color = energyZoneColor(a.e);
      out[color] += `M${xa.toFixed(1)} ${ya.toFixed(1)} L${xb.toFixed(1)} ${yb.toFixed(1)} L${xb.toFixed(1)} ${y0.toFixed(1)} L${xa.toFixed(1)} ${y0.toFixed(1)} Z `;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples, width, height, xStart, xEnd]);

  // ── X axis ticks: clean 6-hour clock grid ──
  const ticks = useMemo(() => {
    const out: Array<{ ms: number; label: string }> = [];
    const SIX_H = 6 * 3_600_000;
    let t = Math.ceil(xStartMs / SIX_H) * SIX_H;
    while (t <= xEndMs) {
      out.push({ ms: t, label: fmtClock(t) });
      t += SIX_H;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xStart, xEnd]);

  const yLabels = [100, 75, 50, 25, 0];

  // ── Scrubber ──
  const handleScrub = (px: number) => {
    if (samples.length === 0) return;
    const ms = xStartMs + ((px - PAD_L) / innerW) * (xEndMs - xStartMs);
    let best = samples[0]!;
    let bestD = Infinity;
    for (const s of samples) {
      const d = Math.abs(Date.parse(s.t) - ms);
      if (d < bestD) { bestD = d; best = s; }
    }
    setScrub(best);
    onScrub?.(best);
  };
  const endScrub = () => { setScrub(null); onScrub?.(null); };

  const pan = Gesture.Pan()
    .onBegin((e) => { "worklet"; runOnJS(handleScrub)(e.x); })
    .onUpdate((e) => { "worklet"; runOnJS(handleScrub)(e.x); })
    .onEnd(() => { "worklet"; runOnJS(endScrub)(); });

  const currentTint = energyLevelColor(samples.length ? samples[samples.length - 1]!.e : null);
  const moonX = sleepEv
    ? (xForMs(Date.parse(sleepEv.tStart)) + xForMs(Date.parse(sleepEv.tEnd))) / 2
    : 0;

  return (
    <View>
      <View style={{ height: SCRUB_ROW_H }}>
        {scrub ? (
          <Text style={styles.scrubText}>
            {fmtClock(Date.parse(scrub.t))} · {Math.round(scrub.e)}%
          </Text>
        ) : null}
      </View>

      <GestureDetector gesture={pan}>
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="zoneGreen" x1="0" y1={plotTop} x2="0" y2={y0} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={ENERGY_GREEN} stopOpacity="0.42" />
              <Stop offset="0.55" stopColor={ENERGY_GREEN} stopOpacity="0.26" />
              <Stop offset="0.9" stopColor={ENERGY_GREEN} stopOpacity="0.05" />
              <Stop offset="1" stopColor={ENERGY_GREEN} stopOpacity="0" />
            </LinearGradient>
            <LinearGradient id="zoneAmber" x1="0" y1={plotTop} x2="0" y2={y0} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={ENERGY_AMBER} stopOpacity="0.42" />
              <Stop offset="0.55" stopColor={ENERGY_AMBER} stopOpacity="0.26" />
              <Stop offset="0.9" stopColor={ENERGY_AMBER} stopOpacity="0.05" />
              <Stop offset="1" stopColor={ENERGY_AMBER} stopOpacity="0" />
            </LinearGradient>
            <LinearGradient id="zoneRed" x1="0" y1={plotTop} x2="0" y2={y0} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={ENERGY_RED} stopOpacity="0.42" />
              <Stop offset="0.55" stopColor={ENERGY_RED} stopOpacity="0.26" />
              <Stop offset="0.9" stopColor={ENERGY_RED} stopOpacity="0.05" />
              <Stop offset="1" stopColor={ENERGY_RED} stopOpacity="0" />
            </LinearGradient>
            {/* Workout line stroke: zone colour by Y (green→amber→red as the
                reserve crosses 50% / 25% during the session). */}
            <LinearGradient id="workoutLine" x1="0" y1={plotTop} x2="0" y2={y0} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={ENERGY_GREEN} stopOpacity="1" />
              <Stop offset="0.5" stopColor={ENERGY_GREEN} stopOpacity="1" />
              <Stop offset="0.5" stopColor={ENERGY_AMBER} stopOpacity="1" />
              <Stop offset="0.75" stopColor={ENERGY_AMBER} stopOpacity="1" />
              <Stop offset="0.75" stopColor={ENERGY_RED} stopOpacity="1" />
              <Stop offset="1" stopColor={ENERGY_RED} stopOpacity="1" />
            </LinearGradient>
          </Defs>

          {/* Gridlines (0 line emphasised) */}
          {yLabels.map((lv) => (
            <Line
              key={lv}
              x1={PAD_L}
              y1={yFor(lv)}
              x2={width - PAD_R}
              y2={yFor(lv)}
              stroke={lv === 0 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.07)"}
              strokeWidth={1}
            />
          ))}

          {/* Zone overlay quads */}
          {zonePaths[ENERGY_GREEN] ? <Path d={zonePaths[ENERGY_GREEN]} fill="url(#zoneGreen)" /> : null}
          {zonePaths[ENERGY_AMBER] ? <Path d={zonePaths[ENERGY_AMBER]} fill="url(#zoneAmber)" /> : null}
          {zonePaths[ENERGY_RED] ? <Path d={zonePaths[ENERGY_RED]} fill="url(#zoneRed)" /> : null}

          {/* Sleep veil (top line → bottom, over the overlay) */}
          {sleepEv ? (
            <Rect
              x={xForMs(Date.parse(sleepEv.tStart))}
              y={lineY}
              width={Math.max(0, xForMs(Date.parse(sleepEv.tEnd)) - xForMs(Date.parse(sleepEv.tStart)))}
              height={plotBottom - lineY}
              fill={SLEEP_BLUE}
              opacity={0.14}
            />
          ) : null}

          {/* Workout veils (top line → bottom, over the overlay) */}
          {workouts.map((w, i) => (
            <Rect
              key={`wv${i}`}
              x={xForMs(Date.parse(w.tStart))}
              y={lineY}
              width={Math.max(2, xForMs(Date.parse(w.tEnd)) - xForMs(Date.parse(w.tStart)))}
              height={plotBottom - lineY}
              fill={WORKOUT_ORANGE}
              opacity={0.13}
            />
          ))}

          {/* Curve — thin, finely dashed while passive; solid zone-gradient
              line during workouts. */}
          {dashedPath ? (
            <Path d={dashedPath} stroke="#FFFFFF" strokeWidth={1.3} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2.5 3.5" />
          ) : null}
          {solidPath ? (
            <Path d={solidPath} stroke="url(#workoutLine)" strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          ) : null}

          {/* Sleep moon line — on the 100% line */}
          {sleepEv ? (
            <Line
              x1={xForMs(Date.parse(sleepEv.tStart))}
              y1={lineY}
              x2={xForMs(Date.parse(sleepEv.tEnd))}
              y2={lineY}
              stroke={SLEEP_BLUE}
              strokeWidth={3}
              strokeLinecap="round"
            />
          ) : null}

          {/* Workout lines — on the 100% line */}
          {workouts.map((w, i) => (
            <Line
              key={`wl${i}`}
              x1={xForMs(Date.parse(w.tStart))}
              y1={lineY}
              x2={xForMs(Date.parse(w.tEnd))}
              y2={lineY}
              stroke={WORKOUT_ORANGE}
              strokeWidth={3}
              strokeLinecap="round"
            />
          ))}

          {/* Green charging bar + dark disc below the 0 line (sleep) */}
          {sleepEv ? (
            <>
              <Line
                x1={xForMs(Date.parse(sleepEv.tStart))}
                y1={chargeBarY}
                x2={xForMs(Date.parse(sleepEv.tEnd))}
                y2={chargeBarY}
                stroke={ENERGY_GREEN}
                strokeWidth={6}
                strokeLinecap="round"
              />
              <Circle cx={moonX} cy={chargeBarY} r={9} fill="#1A1F28" />
            </>
          ) : null}

          {/* Current point */}
          {lastPt ? (
            <Circle cx={lastPt.x} cy={lastPt.y} r={5} fill={currentTint} stroke="#0A0F1C" strokeWidth={1.5} />
          ) : null}

          {/* Scrubber */}
          {scrub ? (
            <>
              <Line x1={xForMs(Date.parse(scrub.t))} y1={plotTop} x2={xForMs(Date.parse(scrub.t))} y2={plotBottom} stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
              <Circle cx={xForMs(Date.parse(scrub.t))} cy={yFor(scrub.e)} r={5} fill="#fff" />
            </>
          ) : null}
        </Svg>
      </GestureDetector>

      {/* Icon overlays (moon / dumbbell above the line, bolt on the charge bar) */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { top: SCRUB_ROW_H }]}>
        {sleepEv ? (
          <Ionicons name="moon" size={13} color={SLEEP_BLUE} style={{ position: "absolute", left: moonX - 7, top: lineY - 17 }} />
        ) : null}
        {sleepEv ? (
          <Ionicons name="flash" size={11} color={ENERGY_GREEN} style={{ position: "absolute", left: moonX - 5.5, top: chargeBarY - 6 }} />
        ) : null}
        {workouts.map((w, i) => {
          const cx = (xForMs(Date.parse(w.tStart)) + xForMs(Date.parse(w.tEnd))) / 2;
          return (
            <Ionicons key={`wi${i}`} name="barbell" size={13} color={WORKOUT_ORANGE} style={{ position: "absolute", left: cx - 7, top: lineY - 17 }} />
          );
        })}
      </View>

      {/* Y tick labels (right gutter) */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {yLabels.map((lv) => (
          <Text key={lv} style={[styles.yTick, { top: SCRUB_ROW_H + yFor(lv) - 7 }]}>
            {lv}
          </Text>
        ))}
      </View>

      {/* X tick labels */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { top: SCRUB_ROW_H + plotBottom + 3 }]}>
        {ticks.map((tk, i) => (
          <Text
            key={i}
            style={[styles.xTick, { left: Math.max(0, Math.min(width - 36, xForMs(tk.ms) - 18)) }]}
          >
            {tk.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrubText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    color: colors.textPrimary,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  yTick: {
    position: "absolute",
    right: 4,
    width: 26,
    textAlign: "right",
    fontFamily: fontFamily.body,
    fontSize: 10,
    color: colors.textTertiary,
    fontVariant: ["tabular-nums"],
  },
  xTick: {
    position: "absolute",
    width: 36,
    textAlign: "center",
    fontFamily: fontFamily.body,
    fontSize: 10,
    color: colors.textTertiary,
    fontVariant: ["tabular-nums"],
  },
});
