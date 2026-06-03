/**
 * SleepStagesChart
 *
 * Bevel/Oura-style hypnogram drawn as a stepped LINE — not a bar chart.
 *
 *   • Four lanes, top→bottom: Awake, REM, Light, Deep. Five separator
 *     guides delimit them.
 *   • At any moment exactly ONE stage is active. Each stage segment is a
 *     thin, equal-thickness horizontal bar centred vertically inside its
 *     lane (equal gap to the lane's upper and lower separator).
 *   • Consecutive segments are joined by a thin vertical connector at the
 *     transition x, so the whole night reads as a continuous step line
 *     (…Light → Deep → Light → REM → Awake…).
 *   • Faint hour ticks (2, 3, 4 …) sit along the bottom inside the box so
 *     you can place a transition in time at a glance.
 *
 * Selection: the selected stage's bars stay bright; everything else
 * (bars + connectors) fades right back so you can see exactly when that
 * stage occurred across the night.
 *
 * Scrubber: touch-and-drag paints a vertical guide + glowing dot that
 * snaps to the active lane, with a light haptic on grab and a callout
 * showing the clock time + the stage you're hovering over. There is no
 * numeric Y axis here — the value at any time IS the (colour-coded) stage.
 *
 * The segment timeline is supplied by the parent (built once via
 * lib/hypnogram): a real feed renders as-is, the Whoop aggregate renders
 * as a representative cycle shape until the smartband lands.
 */
import React, { useMemo, useRef, useState } from "react";
import { PanResponder, View, Text, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import Svg, { Circle, Line, Rect, Text as SvgText } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import type { SleepStageId } from "@/context/SleepContext";
import type { HypnoSegment } from "@/lib/hypnogram";
import { CHART_ORDER, STAGE_COLORS, STAGE_LABELS } from "@/constants/sleepStages";
import { GlowyHeroCard } from "./GlowyHeroCard";
import { colors, fontFamily } from "@/theme";

interface Props {
  segments: HypnoSegment[];
  nightStart: number; // epoch ms
  nightEnd: number; // epoch ms
  selectedStage: SleepStageId | null;
  width: number;
  height?: number;
}

const THICKNESS = 7;
const HOUR_MS = 3_600_000;

function clockHHMM(ms: number): string {
  const d = new Date(ms);
  const hh = d.getHours();
  const mm = d.getMinutes().toString().padStart(2, "0");
  const period = hh < 12 ? "AM" : "PM";
  const hh12 = hh % 12 || 12;
  return `${hh12}:${mm} ${period}`;
}

function hourTickLabel(ms: number): string {
  const hh = new Date(ms).getHours();
  return `${hh % 12 || 12}:00`;
}

interface ScrubState {
  x: number;
  y: number;
  stage: SleepStageId;
  ms: number;
}

export function SleepStagesChart({
  segments,
  nightStart,
  nightEnd,
  selectedStage,
  width,
  height = 196,
}: Props) {
  const padTop = 20;
  const padBot = 22;
  const padX = 16;
  const plotW = width - padX * 2;
  const span = nightEnd - nightStart;
  const valid = Number.isFinite(span) && span > 0 && segments.length > 0;

  const laneH = (height - padTop - padBot) / CHART_ORDER.length;
  const laneCenter = (stage: SleepStageId): number => {
    const idx = CHART_ORDER.indexOf(stage);
    return padTop + idx * laneH + laneH / 2;
  };

  const xFor = (ms: number) => padX + ((ms - nightStart) / span) * plotW;

  const bars = useMemo(() => {
    if (!valid) return [];
    return segments.map((s, i) => {
      const x1 = xFor(s.start);
      const x2 = xFor(s.end);
      const cy = laneCenter(s.stage);
      const active = selectedStage === null || selectedStage === s.stage;
      return {
        key: `${i}-${s.start}`,
        x: x1,
        w: Math.max(2, x2 - x1),
        y: cy - THICKNESS / 2,
        color: STAGE_COLORS[s.stage],
        opacity: active ? 1 : 0.1,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid, segments, nightStart, span, plotW, laneH, selectedStage]);

  const connectors = useMemo(() => {
    if (!valid) return [];
    const out: { key: string; x: number; y1: number; y2: number; opacity: number }[] = [];
    for (let i = 1; i < segments.length; i++) {
      const prev = segments[i - 1]!;
      const cur = segments[i]!;
      const x = xFor(cur.start);
      const yPrev = laneCenter(prev.stage);
      const yCur = laneCenter(cur.stage);
      const active =
        selectedStage === null || selectedStage === prev.stage || selectedStage === cur.stage;
      out.push({
        key: `c-${i}`,
        x,
        y1: Math.min(yPrev, yCur),
        y2: Math.max(yPrev, yCur),
        opacity: active ? 0.28 : 0.05,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid, segments, nightStart, span, plotW, laneH, selectedStage]);

  // Whole-hour ticks inside the plot, skipping any too close to the edges.
  const hourTicks = useMemo(() => {
    if (!valid) return [];
    const out: { key: string; x: number; label: string }[] = [];
    // Tick on the local wall-clock hour, not on UTC-hour boundaries.
    const startLocal = new Date(nightStart);
    startLocal.setMinutes(0, 0, 0);
    let first = startLocal.getTime();
    if (first < nightStart) first += HOUR_MS;
    for (let ms = first; ms <= nightEnd; ms += HOUR_MS) {
      const x = xFor(ms);
      if (x < padX + 14 || x > width - padX - 14) continue;
      out.push({ key: `h-${ms}`, x, label: hourTickLabel(ms) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid, nightStart, nightEnd, span, plotW, width]);

  const [scrub, setScrub] = useState<ScrubState | null>(null);

  // The PanResponder closure is created once, so it reads live geometry +
  // segments through a ref — otherwise switching the selected night would
  // leave the scrubber mapping against stale data.
  const geomRef = useRef({ valid, nightStart, span, plotW, padX, width, laneH, padTop, segments });
  geomRef.current = { valid, nightStart, span, plotW, padX, width, laneH, padTop, segments };

  const scrubAt = (localX: number): ScrubState | null => {
    const g = geomRef.current;
    if (!g.valid || g.segments.length === 0) return null;
    const clampedX = Math.max(g.padX, Math.min(g.width - g.padX, localX));
    const ms = g.nightStart + ((clampedX - g.padX) / g.plotW) * g.span;
    let stage: SleepStageId = g.segments[0]!.stage;
    for (const s of g.segments) {
      if (ms >= s.start) stage = s.stage;
      else break;
    }
    const idx = CHART_ORDER.indexOf(stage);
    const y = g.padTop + idx * g.laneH + g.laneH / 2;
    return { x: clampedX, y, stage, ms };
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => geomRef.current.valid,
        onMoveShouldSetPanResponder: () => geomRef.current.valid,
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
    []
  );

  return (
    <GlowyHeroCard variant="hero" style={styles.card}>
      {valid ? (
        <View style={{ width, height }} {...panResponder.panHandlers}>
          <Svg width={width} height={height}>
            {/* Lane separators (5 lines) */}
            {Array.from({ length: CHART_ORDER.length + 1 }).map((_, i) => {
              const y = padTop + i * laneH;
              return (
                <Line
                  key={`sep-${i}`}
                  x1={padX}
                  y1={y}
                  x2={width - padX}
                  y2={y}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth={1}
                />
              );
            })}

            {/* Vertical transition connectors */}
            {connectors.map((c) => (
              <Line
                key={c.key}
                x1={c.x}
                y1={c.y1}
                x2={c.x}
                y2={c.y2}
                stroke="#FFFFFF"
                strokeOpacity={c.opacity}
                strokeWidth={2}
              />
            ))}

            {/* Stage step bars */}
            {bars.map((b) => (
              <Rect
                key={b.key}
                x={b.x}
                y={b.y}
                width={b.w}
                height={THICKNESS}
                rx={THICKNESS / 2}
                fill={b.color}
                opacity={b.opacity}
              />
            ))}

            {/* Hour ticks along the bottom */}
            {hourTicks.map((t) => (
              <SvgText
                key={t.key}
                x={t.x}
                y={height - 7}
                fontSize={8}
                fill="rgba(255,255,255,0.28)"
                textAnchor="middle"
                fontFamily={fontFamily.body}
              >
                {t.label}
              </SvgText>
            ))}

            {/* Scrubber guide + lane dot */}
            {scrub ? (
              <>
                <Line
                  x1={scrub.x}
                  y1={padTop}
                  x2={scrub.x}
                  y2={height - padBot}
                  stroke="rgba(255,255,255,0.45)"
                  strokeWidth={1}
                />
                <Circle
                  cx={scrub.x}
                  cy={scrub.y}
                  r={9}
                  fill={STAGE_COLORS[scrub.stage]}
                  opacity={0.22}
                />
                <Circle
                  cx={scrub.x}
                  cy={scrub.y}
                  r={4.5}
                  fill="#FFFFFF"
                  stroke={STAGE_COLORS[scrub.stage]}
                  strokeWidth={1.5}
                />
              </>
            ) : null}
          </Svg>

          {/* Scrubber callout — clock time + the stage under the finger */}
          {scrub ? (
            <View
              pointerEvents="none"
              style={[
                styles.callout,
                { left: Math.max(4, Math.min(width - 100, scrub.x - 48)) },
              ]}
            >
              <Text style={styles.calloutTime}>{clockHHMM(scrub.ms)}</Text>
              <Text style={[styles.calloutStage, { color: STAGE_COLORS[scrub.stage] }]}>
                {STAGE_LABELS[scrub.stage]}
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={[styles.empty, { height }]}>
          <Ionicons name="bar-chart-outline" size={22} color={colors.textTertiary} />
          <Text style={styles.emptyText}>No stage data for this night yet.</Text>
        </View>
      )}
    </GlowyHeroCard>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    color: colors.textTertiary,
  },
  callout: {
    position: "absolute",
    top: 2,
    width: 96,
    alignItems: "center",
    backgroundColor: "rgba(10,15,28,0.92)",
    borderRadius: 8,
    paddingVertical: 4,
  },
  calloutTime: {
    fontFamily: fontFamily.monoBold,
    fontSize: 12,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  calloutStage: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});
