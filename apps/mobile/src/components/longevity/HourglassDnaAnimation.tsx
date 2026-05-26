/**
 * HourglassDnaAnimation
 *
 * Centerpiece of the Trajectory tab. An SVG hourglass containing two
 * sinusoidal DNA strands and a column of glowing particles that flow
 * continuously top -> bottom -> back. Center overlay shows the Elysia Age
 * plus a sign-coloured delta line.
 *
 * Pure Reanimated 4 — no Lottie. All animations are derived from a single
 * shared phase value so the GPU does the work.
 */

import React, { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { colors } from "@/theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Geometry ───────────────────────────────────────────────────────────────

const W = 220;
const H = 280;
const CX = W / 2;
/** Half-width of the hourglass at top/bottom. */
const HOURGLASS_HALF_W = 70;
/** Vertical extents of the hourglass shape. */
const TOP_Y = 24;
const BOT_Y = H - 24;
const WAIST_Y = H / 2;
/** Waist (center) half-width — the pinch point. */
const WAIST_HALF_W = 10;

/** Returns the half-width of the hourglass at a given normalized y in [0..1]. */
function halfWidthAt(t: number): number {
  // Smooth easing: linear interp between outer and waist via cosine.
  const center = 0.5;
  const dist = Math.abs(t - center) * 2; // 0 at waist, 1 at top/bottom
  return WAIST_HALF_W + (HOURGLASS_HALF_W - WAIST_HALF_W) * dist;
}

function hourglassPath(): string {
  // Top-left -> top-right -> waist-right -> bottom-right -> bottom-left ->
  // waist-left -> close.
  const tl = { x: CX - HOURGLASS_HALF_W, y: TOP_Y };
  const tr = { x: CX + HOURGLASS_HALF_W, y: TOP_Y };
  const wr = { x: CX + WAIST_HALF_W, y: WAIST_Y };
  const br = { x: CX + HOURGLASS_HALF_W, y: BOT_Y };
  const bl = { x: CX - HOURGLASS_HALF_W, y: BOT_Y };
  const wl = { x: CX - WAIST_HALF_W, y: WAIST_Y };
  return [
    `M ${tl.x} ${tl.y}`,
    `L ${tr.x} ${tr.y}`,
    `L ${wr.x} ${wr.y}`,
    `L ${br.x} ${br.y}`,
    `L ${bl.x} ${bl.y}`,
    `L ${wl.x} ${wl.y}`,
    `Z`,
  ].join(" ");
}

/** Sample the two DNA strands at N points along the hourglass. */
function buildDnaPaths(samples = 60, helixCycles = 3) {
  const left: Array<{ x: number; y: number }> = [];
  const right: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const y = TOP_Y + (BOT_Y - TOP_Y) * t;
    const halfW = halfWidthAt(t);
    const phase = t * Math.PI * 2 * helixCycles;
    // Helix sinusoid bounded to the local hourglass width.
    const ampScale = Math.max(0.3, halfW / HOURGLASS_HALF_W) * (halfW - 2);
    left.push({ x: CX + Math.cos(phase) * ampScale * -1, y });
    right.push({ x: CX + Math.cos(phase) * ampScale, y });
  }
  const toPath = (pts: Array<{ x: number; y: number }>) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  return { left: toPath(left), right: toPath(right) };
}

// ─── Particle ──────────────────────────────────────────────────────────────

interface ParticleProps {
  /** Phase offset in [0..1]. Determines vertical position. */
  offset: number;
  /** Constant noise term to perturb horizontal position. */
  jitter: number;
  /** Shared loop value in [0..1]. */
  phase: SharedValue<number>;
  color: string;
}

function Particle({ offset, jitter, phase, color }: ParticleProps) {
  // NOTE: every value used inside `useAnimatedProps` (which runs on the UI
  // thread) is either inlined or a captured constant. Calling a plain JS
  // helper here would throw `Tried to synchronously call a non-worklet
  // function on the UI thread`.
  const props = useAnimatedProps(() => {
    "worklet";
    // Cycle through the hourglass: 0..0.5 falls down, 0.5..1.0 rises back up.
    const raw = (phase.value + offset) % 1;
    const isFall = raw < 0.5;
    const t = isFall ? raw * 2 : (1 - raw) * 2;
    const y = TOP_Y + (BOT_Y - TOP_Y) * t;
    // Inline of halfWidthAt(t) so the worklet stays self-contained.
    const dist = Math.abs(t - 0.5) * 2;
    const halfW = WAIST_HALF_W + (HOURGLASS_HALF_W - WAIST_HALF_W) * dist;
    const localJ = jitter * (halfW - 2);
    const x = CX + localJ;
    // Pinch fade — particles fade out near the waist.
    const distToWaist = dist;
    const opacity = Math.max(0.18, distToWaist) * (isFall ? 1 : 0.6);
    return { cx: x, cy: y, opacity };
  });

  return (
    <AnimatedCircle
      r={2}
      fill={color}
      animatedProps={props}
      // GPU-friendly soft glow via stroke.
      stroke={color}
      strokeOpacity={0.4}
      strokeWidth={1.5}
    />
  );
}

// ─── Animation ──────────────────────────────────────────────────────────────

export interface HourglassDnaAnimationProps {
  /** Elysia Age (years). When undefined the center shows a placeholder. */
  elysiaAge?: number;
  /** elysiaAge - chronoAge. Negative = younger biological. */
  delta?: number;
  /** When true, replaces the center text with the calibration banner. */
  calibrating?: boolean;
  /** Optional `day N / 14` text shown during calibration. */
  calibrationLabel?: string;
}

export function HourglassDnaAnimation({
  elysiaAge,
  delta,
  calibrating = false,
  calibrationLabel,
}: HourglassDnaAnimationProps) {
  const phase = useSharedValue(0);
  useEffect(() => {
    phase.value = 0;
    phase.value = withRepeat(
      withTiming(1, { duration: 6000, easing: Easing.linear }),
      -1,
      false
    );
  }, [phase]);

  const dna = useMemo(() => buildDnaPaths(), []);
  const hourglass = useMemo(() => hourglassPath(), []);

  // Particles: a fixed pool with random offsets + jitter.
  const particles = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        offset: i / 16,
        jitter: (Math.sin(i * 17.31) + Math.cos(i * 3.7)) * 0.45,
      })),
    []
  );

  // Color logic for delta line.
  let deltaColor = colors.textPrimary;
  let deltaSign = "";
  if (delta !== undefined && Number.isFinite(delta)) {
    if (delta <= -0.5) {
      deltaColor = colors.success;
      deltaSign = "−";
    } else if (delta >= 0.5) {
      deltaColor = colors.destructive;
      deltaSign = "+";
    } else {
      deltaColor = colors.textPrimary;
      deltaSign = delta < 0 ? "−" : delta > 0 ? "+" : "";
    }
  }
  const deltaAbs =
    delta !== undefined ? Math.abs(delta).toFixed(1) : null;
  const deltaWord =
    delta === undefined
      ? null
      : delta < 0
        ? "years younger"
        : delta > 0
          ? "years older"
          : "matches chrono";

  return (
    <View style={styles.wrap} accessibilityLabel="Elysia hourglass">
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id="hgFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.18} />
            <Stop offset="50%" stopColor={colors.accent} stopOpacity={0.05} />
            <Stop offset="100%" stopColor={colors.accent} stopOpacity={0.18} />
          </LinearGradient>
        </Defs>
        {/* Glow layers behind the hourglass */}
        <Path d={hourglass} fill="none" stroke={colors.accent} strokeOpacity={0.12} strokeWidth={8} />
        <Path d={hourglass} fill="none" stroke={colors.accent} strokeOpacity={0.22} strokeWidth={4} />
        <Path d={hourglass} fill="url(#hgFill)" stroke={colors.accent} strokeOpacity={0.9} strokeWidth={1.5} />

        {/* DNA double helix */}
        <Path d={dna.left} stroke={colors.accent} strokeOpacity={0.55} strokeWidth={1.2} fill="none" />
        <Path d={dna.right} stroke={colors.accent} strokeOpacity={0.55} strokeWidth={1.2} fill="none" />

        {/* Particles */}
        {particles.map((p, i) => (
          <Particle
            key={i}
            offset={p.offset}
            jitter={p.jitter}
            phase={phase}
            color={colors.accent}
          />
        ))}
      </Svg>

      <View style={styles.centerOverlay} pointerEvents="none">
        {calibrating ? (
          <>
            <Text style={styles.calibLabel}>CALIBRATING</Text>
            {calibrationLabel ? (
              <Text style={styles.calibSub}>{calibrationLabel}</Text>
            ) : null}
          </>
        ) : (
          <>
            <Text style={styles.ageNumber}>
              {elysiaAge !== undefined ? elysiaAge.toFixed(1) : "—"}
            </Text>
            <Text style={styles.ageUnit}>ELYSIA AGE</Text>
            {deltaAbs !== null && deltaWord !== null ? (
              <Text style={[styles.delta, { color: deltaColor }]}>
                {deltaSign}{deltaAbs} {deltaWord}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: W, height: H, alignItems: "center", justifyContent: "center" },
  centerOverlay: {
    position: "absolute",
    top: 0, bottom: 0, left: 0, right: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  ageNumber: {
    fontSize: 48,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -2,
    lineHeight: 52,
  },
  ageUnit: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textTertiary,
    letterSpacing: 1.2,
  },
  delta: { fontSize: 12, fontWeight: "700", marginTop: 4 },
  calibLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.accent,
    letterSpacing: 1.4,
  },
  calibSub: { fontSize: 11, color: colors.textTertiary, fontWeight: "600" },
});
