/**
 * LongevityWheel
 *
 * Multi-ring wheel that visualises the 6 wheel-layer scores (v1.2.0).
 *
 * Rendering split (z-order, bottom → top):
 *   1. Skia Canvas — ring tracks, score arcs (SweepGradient fade at tip),
 *      gaussian glow halos, active-ring shimmer overlay, center battery.
 *   2. SVG layer — label `<TextPath>` text only. Skia has no per-glyph
 *      text-along-path API, so this stays on react-native-svg.
 *      `pointerEvents="none"` so taps fall through.
 *   3. Transparent `<View>` — polar hit-testing for ring touches.
 *   4. `<Pressable>` over the battery — center tap.
 *
 * Props + state API + touch behaviour are byte-for-byte identical to the
 * previous SVG version. Only the visual layer was rewritten in Skia.
 */

import React, { useEffect, useMemo, useRef } from "react";
import {
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Svg, {
  Defs,
  G,
  Path as SvgPath,
  Text as SvgText,
  TextPath,
} from "react-native-svg";
import {
  BlurMask,
  Canvas,
  Group,
  matchFont,
  Path as SkiaPath,
  Rect as SkiaRect,
  RoundedRect,
  Skia,
  SweepGradient,
  Text as SkiaText,
  vec,
  type SkFont,
} from "@shopify/react-native-skia";
import {
  Easing,
  interpolateColor,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors } from "@/theme";
import {
  LAYER_META_ORDERED,
  type LayerMeta,
  type WheelLayerId,
} from "@/lib/displayLayers";

/** Fire-and-forget haptic that no-ops when the native module is missing. */
function safeHaptic(fn: () => Promise<unknown>): void {
  try {
    fn().catch(() => {
      /* swallow UnavailabilityError */
    });
  } catch {
    /* synchronous throw (older versions) */
  }
}

// ─── Geometry ───────────────────────────────────────────────────────────────

const SIZE = 340;
const CENTER = SIZE / 2;
const OUTER_RADIUS = CENTER - 16;
const RING_STROKE = 14;
const RING_STROKE_HOVER = 19;
const RING_GAP = 5;
const LABEL_FONT = 9.5;
const LABEL_FONT_HOVER = 12.5;
const CHAR_W = 5.6;
const CHAR_W_HOVER = 7.4;
const LABEL_GAP_DEG = 6;

function radiusForOrder(order: number): number {
  return OUTER_RADIUS - order * (RING_STROKE + RING_GAP);
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** SVG `d` string for an arc starting at `startDeg` past 12 o'clock. */
function arcPathString(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  sweepDeg: number
): string {
  const sweep = Math.max(0, Math.min(360, sweepDeg));
  if (sweep <= 0.1) return "";
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, startDeg + sweep);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

// ─── Skia ring (visual layer 1) ─────────────────────────────────────────────

interface RingPropsExt {
  layer: LayerMeta;
  score: number | null;
  dimmed?: boolean;
  hovered: boolean;
}

/**
 * Skia rendering of one band — track, score arc (with SweepGradient fade
 * at the tip), gaussian glow halo and the hover shimmer overlay.
 *
 * Labels are NOT rendered here; they live in the SVG overlay so we can
 * keep using `<TextPath>` for proper text-along-arc layout.
 */
function LongevityRingSkia({ layer, score, dimmed, hovered }: RingPropsExt) {
  const r = radiusForOrder(layer.order);
  const isLocked = score === null;
  const fillPct = Math.max(0, Math.min(100, score ?? 0));

  // Hover state drives stroke width — same logic as before but the swell
  // is animated for a tactile feel (Skia rerenders are cheap).
  const strokeAnim = useSharedValue(RING_STROKE);
  useEffect(() => {
    strokeAnim.value = withTiming(
      hovered ? RING_STROKE_HOVER : RING_STROKE,
      { duration: 140, easing: Easing.out(Easing.cubic) }
    );
  }, [hovered, strokeAnim]);

  // Pulsing glow halo behind the score arc.
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (isLocked || dimmed) {
      pulse.value = 0.55;
      return;
    }
    pulse.value = withRepeat(
      withTiming(0.4, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [isLocked, dimmed, pulse]);
  const haloOpacity = useDerivedValue(
    () => pulse.value * 0.45 + (hovered ? 0.45 : 0)
  );

  // "Active band" shimmer — pulsing white overlay only while hovered.
  const activeShimmer = useSharedValue(0);
  useEffect(() => {
    if (hovered) {
      activeShimmer.value = withRepeat(
        withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }),
        -1,
        true
      );
    } else {
      activeShimmer.value = withTiming(0, { duration: 220 });
    }
  }, [hovered, activeShimmer]);
  const shimmerOpacity = useDerivedValue(() =>
    hovered ? 0.18 + activeShimmer.value * 0.32 : 0
  );

  // Animated 0→pct fill so the arc draws itself in over ~900ms when the
  // score changes (mirrors what the SVG version did via animatedProps).
  const fillT = useSharedValue(0);
  useEffect(() => {
    fillT.value = withTiming(fillPct, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [fillPct, fillT]);

  const ringColor = isLocked && !dimmed ? colors.borderStrong : layer.color;
  const trackOpacity = dimmed ? 0.16 : 0.28;
  const arcOpacity = dimmed ? 0.55 : 1;

  // The label sweep is a function of the final (rounded) score, NOT the
  // animated fill — the digits never change during the fill animation.
  const labelText = layer.label.toUpperCase();
  const scoreText = score === null ? "" : ` ${Math.round(fillPct)}%`;
  const fullText = labelText + scoreText;
  const charW = hovered ? CHAR_W_HOVER : CHAR_W;
  const padArcPx = hovered ? RING_STROKE_HOVER : RING_STROKE;
  const textWidthPx = fullText.length * charW;
  const radPerPx = 1 / r;
  const labelSweepDeg = ((textWidthPx + padArcPx * 2) * radPerPx * 180) / Math.PI;
  const cappedLabelSweep = Math.min(labelSweepDeg, 120);

  const arcStartDeg = cappedLabelSweep + LABEL_GAP_DEG;
  const remainingDeg = 360 - arcStartDeg;
  const scoreSweepFinalDeg = (fillPct / 100) * remainingDeg;

  // Skia paths (pre-built, animated via `end` prop):
  // - track   : full circle, drawn flat at low opacity
  // - scoreFull: same arc as score but drawn at maximum sweep, then we
  //              clip it dynamically with the `end` shared value.
  const trackPath = useMemo(() => {
    const p = Skia.Path.Make();
    p.addCircle(CENTER, CENTER, r);
    return p;
  }, [r]);

  const scoreFullPath = useMemo(() => {
    const d = arcPathString(CENTER, CENTER, r, arcStartDeg, remainingDeg);
    if (!d) return Skia.Path.Make();
    return Skia.Path.MakeFromSVGString(d) ?? Skia.Path.Make();
  }, [r, arcStartDeg, remainingDeg]);

  // Map `fillT` (0..fillPct) into `end` (0..1) along the full arc.
  const scoreEnd = useDerivedValue(() => {
    if (remainingDeg <= 0) return 0;
    const sweep = (fillT.value / 100) * remainingDeg;
    return Math.max(0, Math.min(1, sweep / remainingDeg));
  });

  // Halo stroke = scoreArc stroke + 8 px. Hoisted to top of component so
  // the hook count stays stable even when the halo branch is hidden.
  const haloStroke = useDerivedValue(() => strokeAnim.value + 8);

  // SweepGradient that runs around the wheel center. Same color throughout
  // for the first 92 % of the sweep, then fades to transparent at the tip
  // — gives the "energy tip" look without needing a mask hack.
  const sweepStart = arcStartDeg - 90;
  const sweepEnd = arcStartDeg + remainingDeg - 90;

  return (
    <Group>
      {/* 1. Track */}
      <SkiaPath
        path={trackPath}
        style="stroke"
        strokeWidth={strokeAnim}
        strokeCap="butt"
        color={ringColor}
        opacity={trackOpacity}
      />

      {/* 2. Glow halo — same arc as score, drawn with a wider stroke and
              a gaussian blur mask. Native Skia blur is way more luminous
              than the SVG path-layer hack we had before. */}
      {!isLocked && (
        <Group opacity={haloOpacity}>
          <SkiaPath
            path={scoreFullPath}
            style="stroke"
            strokeWidth={haloStroke}
            strokeCap="round"
            color={ringColor}
            start={0}
            end={scoreEnd}
          >
            <BlurMask blur={6} style="solid" />
          </SkiaPath>
        </Group>
      )}

      {/* 3. Score arc */}
      {!isLocked && (
        <SkiaPath
          path={scoreFullPath}
          style="stroke"
          strokeWidth={strokeAnim}
          strokeCap="round"
          start={0}
          end={scoreEnd}
          opacity={arcOpacity}
        >
          <SweepGradient
            c={vec(CENTER, CENTER)}
            start={sweepStart}
            end={sweepEnd}
            colors={[ringColor, ringColor, "rgba(0,0,0,0)"]}
            positions={[0, 0.92, 1]}
          />
        </SkiaPath>
      )}

      {/* 4. Active-band shimmer overlay (only visible while hovered) */}
      {!isLocked && (
        <SkiaPath
          path={scoreFullPath}
          style="stroke"
          strokeWidth={strokeAnim}
          strokeCap="round"
          color="#FFFFFF"
          start={0}
          end={scoreEnd}
          opacity={shimmerOpacity}
        />
      )}
    </Group>
  );
}

// ─── SVG label (visual layer 2) ─────────────────────────────────────────────

/**
 * Renders just the dark label segment + the `<TextPath>` text for one ring.
 * Lives in an SVG layer that floats above the Skia canvas with
 * `pointerEvents="none"` so it doesn't block touches.
 */
function LongevityRingLabel({ layer, score, dimmed, hovered }: RingPropsExt) {
  const r = radiusForOrder(layer.order);
  const isLocked = score === null;
  const fillPct = Math.max(0, Math.min(100, score ?? 0));

  const stroke = hovered ? RING_STROKE_HOVER : RING_STROKE;
  const fontSize = hovered ? LABEL_FONT_HOVER : LABEL_FONT;
  const charW = hovered ? CHAR_W_HOVER : CHAR_W;

  const labelText = layer.label.toUpperCase();
  const scoreText = score === null ? "" : ` ${Math.round(fillPct)}%`;
  const fullText = labelText + scoreText;
  const textWidthPx = fullText.length * charW;
  const padArcPx = stroke;
  const radPerPx = 1 / r;
  const labelSweepDeg = ((textWidthPx + padArcPx * 2) * radPerPx * 180) / Math.PI;
  const cappedLabelSweep = Math.min(labelSweepDeg, 120);

  const labelPathId = `lblpath-${layer.id}`;
  const labelD = arcPathString(CENTER, CENTER, r, 0, cappedLabelSweep);
  const ringColor = isLocked && !dimmed ? colors.borderStrong : layer.color;

  return (
    <G>
      {/* Dark band behind the text — sits in the same arc segment so the
          characters always have a high-contrast backdrop. */}
      <SvgPath
        d={labelD}
        stroke="rgba(8,12,20,0.92)"
        strokeWidth={stroke + (hovered ? 1 : 0)}
        strokeLinecap="butt"
        fill="transparent"
      />
      <Defs>
        <SvgPath id={labelPathId} d={labelD} />
      </Defs>
      <SvgText
        fill={dimmed || isLocked ? colors.textTertiary : ringColor}
        fontSize={fontSize}
        fontWeight={hovered ? "900" : "800"}
        letterSpacing={0.6}
      >
        <TextPath
          href={`#${labelPathId}`}
          startOffset={padArcPx}
          textAnchor="start"
        >
          {labelText}
        </TextPath>
      </SvgText>
      {scoreText ? (
        <SvgText
          fill={colors.textPrimary}
          fontSize={fontSize}
          fontWeight="800"
          letterSpacing={0.4}
        >
          <TextPath
            href={`#${labelPathId}`}
            startOffset={padArcPx + labelText.length * charW}
            textAnchor="start"
          >
            {scoreText}
          </TextPath>
        </SvgText>
      ) : null}
    </G>
  );
}

// ─── Center battery (Skia) ──────────────────────────────────────────────────

const BATTERY_W = 84;
const BATTERY_H = 40;
const BATTERY_CAP_W = 6;
const BATTERY_CAP_H = 18;
const BATTERY_RADIUS = 9;
const BATTERY_INNER_PAD = 4;

// Origin of the battery inside the wheel canvas.
const BATTERY_X0 = CENTER - BATTERY_W / 2 - 3;
const BATTERY_Y0 = CENTER - BATTERY_H / 2 - 3;

type BatteryPalette = {
  primary: string;
  bright: string;
  glow: string;
};

const BATTERY_PALETTES = {
  green: { primary: "#22C55E", bright: "#4ADE80", glow: "#16A34A" },
  yellow: { primary: "#EAB308", bright: "#FACC15", glow: "#CA8A04" },
  red: { primary: "#EF4444", bright: "#F87171", glow: "#DC2626" },
} satisfies Record<string, BatteryPalette>;

function paletteForScore(score: number | null): BatteryPalette {
  if (score === null) return BATTERY_PALETTES.green;
  if (score < 50) return BATTERY_PALETTES.red;
  if (score < 67) return BATTERY_PALETTES.yellow;
  return BATTERY_PALETTES.green;
}

/**
 * Skia battery centered on the canvas. Animated charge fill (RoundedRect
 * `width` from a SharedValue), animated colour-breathe overlay and a
 * sliding white shimmer band give the impression that the battery is
 * actively charging.
 *
 * The composite score text is rendered as one Skia `Text` per glyph so
 * each character can brighten independently as the shimmer passes over it.
 */
function CenterBatterySkia({
  score,
  calibrating,
  monoFont,
}: {
  score: number | null;
  calibrating?: boolean;
  monoFont: SkFont | null;
}) {
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score));
  const palette = paletteForScore(score);

  const shimmer = useSharedValue(0);
  const pulse = useSharedValue(0);
  const fillT = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.linear }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [shimmer, pulse]);

  useEffect(() => {
    fillT.value = withTiming(pct, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct, fillT]);

  // Inner-fill coordinates inside the battery body.
  const innerX0 = BATTERY_X0 + 3 + BATTERY_INNER_PAD;
  const innerY0 = BATTERY_Y0 + 3 + BATTERY_INNER_PAD;
  const innerW = BATTERY_W - BATTERY_INNER_PAD * 2;
  const innerH = BATTERY_H - BATTERY_INNER_PAD * 2;

  const fillWidth = useDerivedValue(() =>
    Math.max(0, (fillT.value / 100) * innerW)
  );

  // Color-breathe between palette.primary and palette.bright. Runs on the
  // UI thread because `interpolateColor` is a worklet.
  const breatheColor = useDerivedValue(() =>
    interpolateColor(pulse.value, [0, 1], [palette.primary, palette.bright])
  );

  // Glow halo opacity pulses.
  const glowOpacity = useDerivedValue(() => 0.18 + pulse.value * 0.28);

  // Shimmer band sweeps across the current fill width.
  const shimmerWidth = 24;
  const shimmerX = useDerivedValue(() => {
    const w = Math.max(0, (fillT.value / 100) * innerW);
    const span = w + shimmerWidth + 4;
    return innerX0 + shimmer.value * span - shimmerWidth;
  });

  // Per-glyph score string.
  const scoreString =
    score == null ? (calibrating ? "…" : "—") : `${Math.round(pct)}%`;
  const glyphFontSize = 18;
  const glyphW = 11.2;
  const totalTextW = glyphW * scoreString.length;
  const textStartX = CENTER - totalTextW / 2;
  const textY = CENTER + 6;

  // SharedValue with the shimmer-band center, in canvas coordinates. Each
  // glyph reads it and brightens when the shimmer is within RADIUS px.
  const shimmerCenter = useDerivedValue(() => shimmerX.value + shimmerWidth / 2);

  return (
    <Group>
      {/* Glow halo behind battery (pulsing) */}
      <Group opacity={glowOpacity}>
        <RoundedRect
          x={BATTERY_X0 + 1}
          y={BATTERY_Y0 + 1}
          width={BATTERY_W + 4}
          height={BATTERY_H + 4}
          r={BATTERY_RADIUS + 4}
          color={palette.glow}
        >
          <BlurMask blur={12} style="normal" />
        </RoundedRect>
      </Group>

      {/* Battery body */}
      <RoundedRect
        x={BATTERY_X0 + 3}
        y={BATTERY_Y0 + 3}
        width={BATTERY_W}
        height={BATTERY_H}
        r={BATTERY_RADIUS}
        color="rgba(8,12,20,0.92)"
      />
      <RoundedRect
        x={BATTERY_X0 + 3}
        y={BATTERY_Y0 + 3}
        width={BATTERY_W}
        height={BATTERY_H}
        r={BATTERY_RADIUS}
        style="stroke"
        strokeWidth={1.5}
        color={colors.borderStrong}
      />

      {/* Terminal cap */}
      <RoundedRect
        x={BATTERY_X0 + 3 + BATTERY_W}
        y={BATTERY_Y0 + 3 + (BATTERY_H - BATTERY_CAP_H) / 2}
        width={BATTERY_CAP_W}
        height={BATTERY_CAP_H}
        r={2}
        color={colors.borderStrong}
      />

      {/* Charge fill (animated width) — uses Skia clip via masking with a
          RoundedRect that grows as `fillWidth` advances. */}
      <Group
        clip={{ x: innerX0, y: innerY0, width: innerW, height: innerH }}
      >
        <SkiaRect
          x={innerX0}
          y={innerY0}
          width={fillWidth}
          height={innerH}
          color={palette.primary}
        />
        {/* Subtle colour-breathe overlay */}
        <SkiaRect
          x={innerX0}
          y={innerY0}
          width={fillWidth}
          height={innerH}
          color={breatheColor}
          opacity={0.22}
        />
        {/* Shimmer band sliding across the current fill width */}
        <SkiaRect
          x={shimmerX}
          y={innerY0}
          width={shimmerWidth}
          height={innerH}
          color="rgba(255,255,255,0.55)"
        >
          <BlurMask blur={3} style="solid" />
        </SkiaRect>
      </Group>

      {/* Per-glyph score text */}
      {monoFont
        ? scoreString.split("").map((ch, i) => (
            <ShimmeringGlyph
              key={`g-${i}-${ch}`}
              ch={ch}
              x={textStartX + i * glyphW + glyphW / 2}
              y={textY}
              font={monoFont}
              shimmerCenter={shimmerCenter}
            />
          ))
        : null}
    </Group>
  );
}

/**
 * One character of the composite score text. Skia renders the glyph and
 * its colour is interpolated from dim grey to bright white based on how
 * close `shimmerCenter` is to the glyph's `x` position.
 */
function ShimmeringGlyph({
  ch,
  x,
  y,
  font,
  shimmerCenter,
}: {
  ch: string;
  x: number;
  y: number;
  font: SkFont;
  shimmerCenter: SharedValue<number>;
}) {
  // Distance in px from the glyph center to the shimmer center.
  const RADIUS = 18;
  const fillColor = useDerivedValue(() => {
    const d = Math.abs(shimmerCenter.value - x);
    const t = Math.max(0, 1 - d / RADIUS);
    return interpolateColor(t, [0, 1], ["#9CA3AF", "#FFFFFF"]);
  });

  // Skia draws text aligned to baseline, left edge at `x`. We want each
  // glyph centred on its x, so we subtract half the measured advance.
  const advance = font.measureText(ch).width;
  const drawX = x - advance / 2;

  return (
    <SkiaText
      x={drawX}
      y={y}
      text={ch}
      font={font}
      color={fillColor}
    />
  );
}

// ─── Wheel ──────────────────────────────────────────────────────────────────

export interface LongevityWheelProps {
  /** layerId -> 0..100 score (null when no data / locked). */
  layerScores: Partial<Record<WheelLayerId, number | null>>;
  /** Composite displayed in the center battery (0..100), undefined hides it. */
  composite?: number | null;
  /** When true, all rings render dimmed and pulse is off. */
  calibrating?: boolean;
  /** Tapping a layer ring. */
  onLayerPress?: (id: WheelLayerId) => void;
  /** Tapping the center battery. */
  onCenterPress?: () => void;
  /** Optional small label under composite (e.g. "+18m today"). */
  centerCaption?: string;
}

export function LongevityWheel({
  layerScores,
  composite,
  calibrating = false,
  onLayerPress,
  onCenterPress,
}: LongevityWheelProps) {
  const rings = useMemo(
    () =>
      LAYER_META_ORDERED.map((layer) => ({
        layer,
        score: layerScores[layer.id] ?? null,
      })),
    [layerScores]
  );

  // Load Geist Mono for the battery score. Falls back to a system mono
  // font when Geist isn't registered yet (first frame after cold start).
  // We match by the expo-font registered family name; matchFont returns
  // a non-null SkFont regardless (system default).
  const monoFont = useMemo(
    () =>
      matchFont({
        fontFamily: "GeistMono_700Bold",
        fontSize: 18,
        fontWeight: "700",
      }),
    []
  );

  // Hovered ring — drives the visual swell + active shimmer.
  const [hoveredId, setHoveredId] = React.useState<WheelLayerId | null>(null);
  const hoveredRef = useRef<WheelLayerId | null>(null);
  const setHovered = (id: WheelLayerId | null) => {
    if (hoveredRef.current === id) return;
    hoveredRef.current = id;
    setHoveredId(id);
    if (id !== null) {
      safeHaptic(() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      );
    }
  };

  // Precompute hit bands for polar testing. Unchanged from the SVG version.
  const hitBands = useMemo(() => {
    const halfBand = (RING_STROKE_HOVER + 4) / 2;
    return LAYER_META_ORDERED.map((layer) => {
      const r = radiusForOrder(layer.order);
      const score = layerScores[layer.id] ?? null;
      return {
        id: layer.id,
        order: layer.order,
        inner: r - halfBand,
        outer: r + halfBand,
        locked: calibrating || score === null,
      };
    });
  }, [layerScores, calibrating]);

  const ringForPoint = (lx: number, ly: number): WheelLayerId | null => {
    const dx = lx - CENTER;
    const dy = ly - CENTER;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < INNER_BATTERY_RADIUS) return null;
    let bestId: WheelLayerId | null = null;
    let bestDelta = Infinity;
    for (const band of hitBands) {
      if (band.locked) continue;
      if (d < band.inner || d > band.outer) continue;
      const center = (band.inner + band.outer) / 2;
      const delta = Math.abs(d - center);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestId = band.id;
      }
    }
    return bestId;
  };

  const handleTouch = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    setHovered(ringForPoint(locationX, locationY));
  };

  const handleRelease = (e: GestureResponderEvent) => {
    const id = ringForPoint(
      e.nativeEvent.locationX,
      e.nativeEvent.locationY
    );
    const released = id ?? hoveredRef.current;
    if (released) {
      safeHaptic(() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      );
      onLayerPress?.(released);
    }
    setHovered(null);
  };

  const handleCancel = () => setHovered(null);

  return (
    <View style={styles.wrap} accessibilityLabel="Longevity wheel">
      {/* 1. Skia visual layer — rings + battery. */}
      <Canvas style={styles.canvas} pointerEvents="none">
        {rings.map(({ layer, score }) => {
          const isHovered = hoveredId === layer.id;
          return (
            <LongevityRingSkia
              key={layer.id}
              layer={layer}
              score={calibrating ? null : score}
              dimmed={calibrating}
              hovered={isHovered}
            />
          );
        })}
        <CenterBatterySkia
          score={composite ?? null}
          calibrating={calibrating}
          monoFont={monoFont}
        />
      </Canvas>

      {/* 2. SVG label layer — text-along-arc labels only. */}
      <Svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        pointerEvents="none"
        style={styles.svgLayer}
      >
        {rings.map(({ layer, score }) => {
          const isHovered = hoveredId === layer.id;
          return (
            <LongevityRingLabel
              key={layer.id}
              layer={layer}
              score={calibrating ? null : score}
              dimmed={calibrating}
              hovered={isHovered}
            />
          );
        })}
      </Svg>

      {/* 3. Touch overlay — polar hit-testing, claims responder on touch
              start only so ScrollView keeps owning vertical drags. */}
      <View
        style={styles.touchOverlay}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => false}
        onResponderTerminationRequest={() => {
          setHovered(null);
          return true;
        }}
        onResponderGrant={handleTouch}
        onResponderMove={handleTouch}
        onResponderRelease={handleRelease}
        onResponderTerminate={handleCancel}
      />

      {/* 4. Center hit zone — battery tap. */}
      <Pressable
        style={styles.centerHit}
        onPress={() => {
          safeHaptic(() => Haptics.selectionAsync());
          onCenterPress?.();
        }}
        accessibilityRole="button"
        accessibilityLabel="Longevity battery details"
      />
    </View>
  );
}

// Slightly larger than the battery itself, but kept well inside the innermost
// ring's inner edge so it never swallows ring presses.
const CENTER_HIT = 96;
const INNER_BATTERY_RADIUS = CENTER_HIT / 2 - 2;

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  canvas: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SIZE,
    height: SIZE,
  },
  svgLayer: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  touchOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SIZE,
    height: SIZE,
  },
  centerHit: {
    position: "absolute",
    width: CENTER_HIT,
    height: CENTER_HIT,
    top: SIZE / 2 - CENTER_HIT / 2,
    left: SIZE / 2 - CENTER_HIT / 2,
    borderRadius: CENTER_HIT / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});
