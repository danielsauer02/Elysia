/**
 * SleepStressCard — flagship detail window (Whoop "Schlafstress")
 *
 * Lives directly below "Time to fall asleep" in the Metrics section.
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ SLEEP STRESS                              (i)  │
 *   │ 12%                                            │
 *   │             🌙                                  │
 *   │ 3 ┄┄┄┄┄┄▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁┄┄┄┄┄  ← sleep veil    │
 *   │ 2                                              │
 *   │ 1   ╱╲    ╱╲      ╱╲        ╎                   │
 *   │ 0 ─╱──╲──╱──╲────╱──╲──────╎ (green curve)      │
 *   │   23:00   02:00   05:00   08:00                 │
 *   │ HIGH    0%                               0:00   │
 *   │ ▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨               │
 *   │ MEDIUM  1%                               0:05   │
 *   │ █▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨               │
 *   │ LOW     99%                              6:34   │
 *   │ ████████████████████████████████▨               │
 *   └──────────────────────────────────────────────┘
 *
 * Whoop's API only exposes aggregate sleep data, so the per-minute stress
 * index (0-3) is synthesised deterministically from the night window — the
 * same approach as the hypnogram. When a smart band lands, swap the synth
 * for the real series and the chart + zone bars stay identical.
 */
import React, { useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import Svg, {
  Defs,
  Line,
  LinearGradient as SvgLinearGradient,
  Path,
  Pattern,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { GlowyHeroCard } from "./GlowyHeroCard";
import { colors, fontFamily, spacing } from "@/theme";

interface Props {
  primaryStart: string | null;
  primaryEnd: string | null;
}

const STRESS_GREEN = "#1FE0A0"; // Whoop-style stress curve green
const ZONE = {
  high: { label: "HIGH", color: "#F4A15D" },
  medium: { label: "MEDIUM", color: "#46D6A0" },
  low: { label: "LOW", color: "#5AA0F0" },
};

const MS_MIN = 60_000;
const MS_HOUR = 3_600_000;

/* deterministic PRNG so the synthesised curve is stable per night */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Synth {
  /** [t(ms), index 0..3] sampled across the full axis. */
  points: [number, number][];
  axisStart: number;
  axisEnd: number;
  sleepStart: number;
  sleepEnd: number;
  avgPct: number;
  zones: { high: number; medium: number; low: number }; // minutes
}

function synthesize(startMs: number, endMs: number): Synth {
  const axisStart = startMs - 20 * MS_MIN;
  const axisEnd = endMs + 20 * MS_MIN;
  const stepMs = 4 * MS_MIN;
  const rand = mulberry32(Math.floor(startMs / MS_MIN));

  const points: [number, number][] = [];
  let prev = 0.45;
  for (let t = axisStart; t <= axisEnd; t += stepMs) {
    const inSleep = t >= startMs && t <= endMs;
    // Baseline low stress; the pre/post-sleep edges drift a little higher.
    // Skewed so a healthy night sits mostly in the LOW zone, with rare
    // brief arousal spikes — matching a typical Whoop sleep-stress night.
    const base = inSleep ? 0.4 : 0.7;
    let v = prev * 0.7 + base * 0.3 + (rand() - 0.5) * 0.35;
    if (rand() > 0.965) v += 0.5 + rand() * 1.2;
    v = Math.max(0.05, Math.min(3, v));
    prev = v;
    points.push([t, v]);
  }

  // Aggregate zone minutes within the sleep window only.
  const inSleepSamples = points.filter(
    ([t]) => t >= startMs && t <= endMs
  );
  const totalSleepMin = Math.max(1, (endMs - startMs) / MS_MIN);
  let hi = 0;
  let mid = 0;
  let lo = 0;
  for (const [, v] of inSleepSamples) {
    if (v >= 2) hi += 1;
    else if (v >= 1) mid += 1;
    else lo += 1;
  }
  const n = Math.max(1, inSleepSamples.length);
  const avg = inSleepSamples.reduce((s, [, v]) => s + v, 0) / n;

  return {
    points,
    axisStart,
    axisEnd,
    sleepStart: startMs,
    sleepEnd: endMs,
    avgPct: Math.round((avg / 3) * 100),
    zones: {
      high: (hi / n) * totalSleepMin,
      medium: (mid / n) * totalSleepMin,
      low: (lo / n) * totalSleepMin,
    },
  };
}

function fmtHMm(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

function clockLabel(ms: number): string {
  const d = new Date(ms);
  return `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

export function SleepStressCard({ primaryStart, primaryEnd }: Props) {
  const [infoOpen, setInfoOpen] = useState(false);

  const startMs = primaryStart ? Date.parse(primaryStart) : NaN;
  const endMs = primaryEnd ? Date.parse(primaryEnd) : NaN;
  const hasWindow =
    Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;

  const synth = useMemo(
    () => (hasWindow ? synthesize(startMs, endMs) : null),
    [hasWindow, startMs, endMs]
  );

  const cardW = Dimensions.get("window").width - spacing.lg * 2;
  const innerW = cardW - spacing.lg * 2; // card padding both sides

  return (
    <GlowyHeroCard variant="hero" style={styles.card}>
      <View style={styles.inner}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.kpiTitle}>Sleep stress</Text>
          <Pressable
            hitSlop={10}
            onPress={() => setInfoOpen(true)}
            style={styles.infoBtn}
          >
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={colors.textSecondary}
            />
          </Pressable>
        </View>
        <Text style={styles.avgValue}>
          {synth ? `${synth.avgPct}%` : "—"}
        </Text>

        {synth ? (
          <>
            <StressChart synth={synth} width={innerW} />
            <View style={styles.zones}>
              <StressZoneBar
                label={ZONE.high.label}
                color={ZONE.high.color}
                minutes={synth.zones.high}
                totalMinutes={
                  synth.zones.high + synth.zones.medium + synth.zones.low
                }
                width={innerW}
              />
              <StressZoneBar
                label={ZONE.medium.label}
                color={ZONE.medium.color}
                minutes={synth.zones.medium}
                totalMinutes={
                  synth.zones.high + synth.zones.medium + synth.zones.low
                }
                width={innerW}
              />
              <StressZoneBar
                label={ZONE.low.label}
                color={ZONE.low.color}
                minutes={synth.zones.low}
                totalMinutes={
                  synth.zones.high + synth.zones.medium + synth.zones.low
                }
                width={innerW}
              />
            </View>
          </>
        ) : (
          <Text style={styles.locked}>Connect a sleep band to unlock</Text>
        )}
      </View>

      <InfoModal open={infoOpen} onClose={() => setInfoOpen(false)} />
    </GlowyHeroCard>
  );
}

/* ── Chart ────────────────────────────────────────────────────────── */

const CHART_H = 168;
const PAD_L = 26;
const PAD_R = 10;
const PAD_T = 22;
const PAD_B = 20;

function StressChart({ synth, width }: { synth: Synth; width: number }) {
  const plotW = width - PAD_L - PAD_R;
  const plotH = CHART_H - PAD_T - PAD_B;
  const { axisStart, axisEnd, sleepStart, sleepEnd, points } = synth;
  const span = axisEnd - axisStart;

  const xFor = (t: number) => PAD_L + ((t - axisStart) / span) * plotW;
  const yFor = (idx: number) => PAD_T + (1 - idx / 3) * plotH;

  // Hour grid ticks (round hours inside the axis).
  const ticks: number[] = [];
  const firstHour = Math.ceil(axisStart / MS_HOUR) * MS_HOUR;
  for (let t = firstHour; t <= axisEnd; t += MS_HOUR) {
    // Show every 3rd hour to avoid clutter (matches Whoop's 02:00 / 05:00).
    if (new Date(t).getHours() % 3 === 0) ticks.push(t);
  }

  // Curve path + area fill to baseline.
  let line = "";
  let area = "";
  points.forEach(([t, v], i) => {
    const x = xFor(t);
    const y = yFor(v);
    line += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)} `;
    area += `${i === 0 ? `M${x.toFixed(1)},${yFor(0).toFixed(1)} L` : "L"}${x.toFixed(
      1
    )},${y.toFixed(1)} `;
  });
  if (points.length) {
    area += `L${xFor(points[points.length - 1]![0]).toFixed(1)},${yFor(0).toFixed(
      1
    )} Z`;
  }

  const sleepX0 = xFor(sleepStart);
  const sleepX1 = xFor(sleepEnd);
  const moonX = (sleepX0 + sleepX1) / 2;

  // Screen-space points for the finger-scrubber (interpolated along the line).
  const screenPts = useMemo(
    () => points.map(([t, v]) => ({ x: xFor(t), y: yFor(v) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points, width]
  );
  const [scrub, setScrub] = useState<{ x: number; y: number } | null>(null);

  const scrubAtX = (px: number): { x: number; y: number } => {
    const cx = Math.max(PAD_L, Math.min(PAD_L + plotW, px));
    for (let i = 0; i < screenPts.length - 1; i += 1) {
      const a = screenPts[i]!;
      const b = screenPts[i + 1]!;
      if (cx >= a.x && cx <= b.x) {
        const r = (cx - a.x) / Math.max(1e-6, b.x - a.x);
        return { x: cx, y: a.y + (b.y - a.y) * r };
      }
    }
    const last = screenPts[screenPts.length - 1] ?? { x: cx, y: yFor(0) };
    const first = screenPts[0] ?? { x: cx, y: yFor(0) };
    return cx <= first.x ? { x: cx, y: first.y } : { x: cx, y: last.y };
  };
  // Keep the responder pointed at the latest scrub fn (points/width change).
  const scrubRef = useRef(scrubAtX);
  scrubRef.current = scrubAtX;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        setScrub(scrubRef.current(e.nativeEvent.locationX));
      },
      onPanResponderMove: (e) => {
        setScrub(scrubRef.current(e.nativeEvent.locationX));
      },
      onPanResponderRelease: () => setScrub(null),
      onPanResponderTerminate: () => setScrub(null),
    })
  ).current;

  return (
    <View style={{ width, height: CHART_H }} {...pan.panHandlers}>
      <Svg width={width} height={CHART_H}>
        <Defs>
          <SvgLinearGradient id="stressFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={STRESS_GREEN} stopOpacity={0.22} />
            <Stop offset="1" stopColor={STRESS_GREEN} stopOpacity={0.02} />
          </SvgLinearGradient>
        </Defs>

        {/* Horizontal grid + y labels 0..3 */}
        {[0, 1, 2, 3].map((idx) => (
          <React.Fragment key={`h-${idx}`}>
            <Line
              x1={PAD_L}
              y1={yFor(idx)}
              x2={width - PAD_R}
              y2={yFor(idx)}
              stroke="rgba(255,255,255,0.07)"
              strokeWidth={1}
            />
            <SvgText
              x={PAD_L - 6}
              y={yFor(idx) + 3}
              fill="rgba(255,255,255,0.4)"
              fontSize={8}
              textAnchor="end"
            >
              {`${idx}.0`}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Sleep-window veil + ceiling line at index 3 */}
        <Rect
          x={sleepX0}
          y={yFor(3)}
          width={Math.max(1, sleepX1 - sleepX0)}
          height={yFor(0) - yFor(3)}
          fill="rgba(255,255,255,0.05)"
        />
        <Line
          x1={sleepX0}
          y1={yFor(3)}
          x2={sleepX1}
          y2={yFor(3)}
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={1.5}
        />

        {/* Hour gridlines + bottom labels */}
        {ticks.map((t) => (
          <React.Fragment key={`t-${t}`}>
            <Line
              x1={xFor(t)}
              y1={PAD_T}
              x2={xFor(t)}
              y2={yFor(0)}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
            <SvgText
              x={xFor(t)}
              y={CHART_H - 6}
              fill="rgba(255,255,255,0.45)"
              fontSize={8}
              textAnchor="middle"
            >
              {clockLabel(t)}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Start clock (left) + wake dashed line + end clock (right, bold) */}
        <SvgText
          x={xFor(sleepStart)}
          y={CHART_H - 6}
          fill="rgba(255,255,255,0.55)"
          fontSize={8}
          textAnchor="middle"
        >
          {clockLabel(sleepStart)}
        </SvgText>
        <Line
          x1={sleepX1}
          y1={PAD_T}
          x2={sleepX1}
          y2={yFor(0)}
          stroke="rgba(255,255,255,0.7)"
          strokeWidth={1}
          strokeDasharray="3,3"
        />
        <SvgText
          x={sleepX1}
          y={CHART_H - 6}
          fill="#FFFFFF"
          fontSize={8.5}
          fontWeight="bold"
          textAnchor="middle"
        >
          {clockLabel(sleepEnd)}
        </SvgText>

        {/* Stress curve */}
        <Path d={area} fill="url(#stressFill)" />
        <Path
          d={line}
          fill="none"
          stroke={STRESS_GREEN}
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>

      {/* Moon centred above the sleep ceiling */}
      <View
        style={[
          styles.moon,
          { left: moonX - 8, top: yFor(3) - 18 },
        ]}
        pointerEvents="none"
      >
        <Ionicons name="moon" size={13} color="#FFFFFF" />
      </View>

      {/* Finger scrubber — vertical guide + dot riding the curve */}
      {scrub ? (
        <>
          <View
            pointerEvents="none"
            style={[
              styles.scrubLine,
              { left: scrub.x - 0.5, top: PAD_T, height: yFor(0) - PAD_T },
            ]}
          />
          <View
            pointerEvents="none"
            style={[styles.scrubGlow, { left: scrub.x - 9, top: scrub.y - 9 }]}
          />
          <View
            pointerEvents="none"
            style={[styles.scrubDot, { left: scrub.x - 5, top: scrub.y - 5 }]}
          />
        </>
      ) : null}
    </View>
  );
}

/* ── Zone bar ─────────────────────────────────────────────────────── */

function StressZoneBar({
  label,
  color,
  minutes,
  totalMinutes,
  width,
}: {
  label: string;
  color: string;
  minutes: number;
  totalMinutes: number;
  width: number;
}) {
  const pct =
    totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0;
  const fillW = Math.max(
    2,
    totalMinutes > 0 ? (minutes / totalMinutes) * width : 0
  );
  const rawId = React.useId();
  const hatchId = `zhatch${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const BAR_H = 10;

  return (
    <View style={styles.zoneRow}>
      <View style={styles.zoneLabelRow}>
        <Text style={[styles.zoneLabel, { color }]}>
          {label} <Text style={styles.zonePct}>{pct}%</Text>
        </Text>
        <Text style={[styles.zoneDuration, { color }]}>{fmtHMm(minutes)}</Text>
      </View>
      <Svg width={width} height={BAR_H}>
        <Defs>
          <Pattern
            id={hatchId}
            patternUnits="userSpaceOnUse"
            width={5}
            height={5}
            patternTransform="rotate(-45)"
          >
            <Line
              x1="0"
              y1="0"
              x2="0"
              y2="5"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1.4"
            />
          </Pattern>
        </Defs>
        <Rect
          x={0}
          y={0}
          width={width}
          height={BAR_H}
          rx={BAR_H / 2}
          fill={`url(#${hatchId})`}
        />
        <Rect
          x={0}
          y={0}
          width={fillW}
          height={BAR_H}
          rx={BAR_H / 2}
          fill={color}
        />
      </Svg>
    </View>
  );
}

/* ── Info modal ───────────────────────────────────────────────────── */

function InfoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Sleep stress</Text>
            <Pressable hitSlop={10} onPress={onClose}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            Sleep stress measures the time you spend in a high-stress zone
            while asleep. Elevated sleep stress can point to lower sleep
            quality and more fragmented nights. Elysia derives your stress
            from your moment-to-moment heart rate and heart-rate variability,
            comparing them against your personal baseline to compute a stress
            score.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 0 },
  inner: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kpiTitle: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    color: colors.textPrimary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  infoBtn: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avgValue: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 26,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
    marginTop: -4,
  },
  locked: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    color: colors.textSecondary,
    paddingVertical: spacing.lg,
  },
  moon: {
    position: "absolute",
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  scrubLine: {
    position: "absolute",
    width: 1,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  scrubGlow: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  scrubDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(10,15,28,0.6)",
  },
  zones: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  zoneRow: { gap: 4 },
  zoneLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  zoneLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  zonePct: {
    fontFamily: fontFamily.bodyMedium,
    color: colors.textTertiary,
  },
  zoneDuration: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#0A0F1C",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontFamily: fontFamily.heading,
    fontSize: 16,
    color: colors.textPrimary,
  },
  modalBody: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
