/**
 * useStickyRingsHeader — Whoop-style **morphing** summary rings.
 *
 * Unlike a crossfade between two separate ring sets, this renders ONE
 * continuous ring strip that physically shrinks as you scroll. Driven
 * by a single `progress` SharedValue derived from scroll position:
 *
 *     progress = clamp(scrollY / COLLAPSE_DISTANCE, 0, 1)
 *
 * Everything interpolates against `progress`:
 *
 *   • Ring radius and stroke width  → Skia Paths rebuilt each frame
 *     via `useDerivedValue` (true geometric resize, not transform-
 *     scale, so stroke stays crisp at every size).
 *   • Ring slot left/top            → ring centred in slot in expanded
 *     state, anchored left in mini state.
 *   • Label position + font size    → label sits BELOW the ring in
 *     expanded state, slides to the RIGHT of the ring in mini state.
 *   • Inner percent text opacity    → fades out as rings collapse.
 *   • Backdrop height + opacity     → invisible at the top, blurs in
 *     as the rings collapse so content can scroll cleanly beneath.
 *   • Container vertical position   → follows `headerProgress` so the
 *     bar sits under the AppTopBar when visible, snaps to top:0 when
 *     the header slides away.
 *
 * The bar is rendered **outside** the ScrollView as a Screen-level
 * sibling (`overlay` JSX). The ScrollView reserves equivalent space
 * via `placeholderHeight` so the very first content item lands right
 * below the expanded rings at scrollY = 0.
 *
 * Header visibility is scroll-DIRECTION aware (Whoop / Instagram):
 *
 *     scrollY ≈ 0  → headerProgress → 1  (force-show at top)
 *     scrolling ↓ → headerProgress → 0  (slide AppTopBar away)
 *     scrolling ↑ → headerProgress → 1  (snap it back on the tiniest
 *                                         reverse swipe)
 */
import React, { useCallback, useEffect, useMemo } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import {
  Canvas,
  Group,
  Path,
  Skia,
  SweepGradient,
  vec,
} from "@shopify/react-native-skia";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { borderTokens, dataColors, fontFamily, text } from "@/theme";

// Solid opaque counterpart of the AppTopBar's translucent anthracite
// glass tint (glass.anthracite.tint = rgba(20, 24, 36, 0.66)). Used as
// the rings overlay backdrop AND as the AppTopBar's scrolled backdrop
// so the two surfaces stack as one seamless block when both visible.
export const BAR_SOLID = "#141824";
import {
  type SummaryRingId,
  type SummaryRingValue,
} from "@/components/dashboard/DailySummaryRings";
import {
  useActiveHeaderProgress,
  useActiveScrollY,
} from "@/context/ScrollContext";

// ── Geometry tunables ────────────────────────────────────────────────
const RING_MAX = 110; // expanded ring outer diameter
const RING_MIN = 30; // mini ring outer diameter
const STROKE_MAX = 9;
const STROKE_MIN = 3.5;
const LABEL_FS_MAX = 12;
const LABEL_FS_MIN = 11;

const EXPANDED_HEIGHT = 200; // overlay height in expanded state (incl. bottom breathing room before the first card)
const MINI_HEIGHT = 56; // overlay height in fully-collapsed state
const COLLAPSE_DISTANCE = 110; // scroll px over which the morph happens

// ── Behaviour tunables ───────────────────────────────────────────────
const SCROLL_DIRECTION_THRESHOLD = 4;
const AT_TOP_THRESHOLD = 6;
const HEADER_TWEEN_MS = 220;

interface UseStickyRingsHeaderArgs {
  values: SummaryRingValue[];
  /** Offset where the bar sits when the AppTopBar is visible. */
  topOffset: number;
  onPressRing?: (id: SummaryRingId) => void;
}

interface UseStickyRingsHeaderResult {
  /** Wire into the parent `RNAnimated.ScrollView`'s `onScroll`. */
  onScroll: ReturnType<typeof useAnimatedScrollHandler>;
  /**
   * paddingTop the parent ScrollView needs so the first real content
   * item lands directly beneath the expanded rings at scrollY = 0.
   * Already includes `topOffset` (the AppTopBar height).
   */
  placeholderHeight: number;
  /** Render OUTSIDE the ScrollView as a Screen-level sibling. */
  overlay: React.ReactNode;
}

export function useStickyRingsHeader({
  values,
  topOffset,
  onPressRing,
}: UseStickyRingsHeaderArgs): UseStickyRingsHeaderResult {
  const scrollY = useActiveScrollY();
  const headerProgress = useActiveHeaderProgress();
  const { width: windowW } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // ── Header show/hide based on scroll direction ─────────────────────
  const headerTarget = useSharedValue(1);
  const lastY = useSharedValue(0);

  useAnimatedReaction(
    () => headerTarget.value,
    (target, prev) => {
      if (prev === null || target !== prev) {
        headerProgress.value = withTiming(target, {
          duration: HEADER_TWEEN_MS,
          easing: Easing.out(Easing.cubic),
        });
      }
    },
    []
  );

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      "worklet";
      const y = e.contentOffset.y;
      const dy = y - lastY.value;

      if (y < AT_TOP_THRESHOLD) {
        headerTarget.value = 1;
      } else if (dy > SCROLL_DIRECTION_THRESHOLD) {
        headerTarget.value = 0;
      } else if (dy < -SCROLL_DIRECTION_THRESHOLD) {
        headerTarget.value = 1;
      }

      lastY.value = y;
      scrollY.value = y;
    },
  });

  // ── Continuous morph progress (0 = expanded, 1 = mini) ─────────────
  const progress = useDerivedValue(() =>
    interpolate(
      scrollY.value,
      [0, COLLAPSE_DISTANCE],
      [0, 1],
      Extrapolation.CLAMP
    )
  );

  const handleRing = useCallback(
    (id: SummaryRingId) => onPressRing?.(id),
    [onPressRing]
  );

  // ── Overlay container — slides under/over the AppTopBar ────────────
  const overlayStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: topOffset * headerProgress.value }],
  }));

  // ── Backdrop (SOLID opaque) — only visible as we collapse ──────────
  // Height intentionally includes `insets.top` so the bar extends
  // flush from the top of the screen (covering the status-bar safe
  // area) and seamlessly meets the AppTopBar when the user scrolls
  // up. Opacity ramps from 0 (expanded, rings sit on the page bg) to
  // 1 (mini state, fully opaque).
  const backdropStyle = useAnimatedStyle(() => ({
    height: interpolate(
      progress.value,
      [0, 1],
      [insets.top + EXPANDED_HEIGHT, insets.top + MINI_HEIGHT],
      Extrapolation.CLAMP
    ),
    opacity: interpolate(
      progress.value,
      [0, 0.35, 1],
      [0, 0.5, 1],
      Extrapolation.CLAMP
    ),
  }));

  // ── Ring row layout ────────────────────────────────────────────────
  const slotWidth = windowW / Math.max(1, values.length);

  const placeholderHeight = topOffset + EXPANDED_HEIGHT;

  const overlay = (
    <Animated.View
      // Sits above AppTopBar (zIndex 110 vs 100) so when collapsed the
      // mini bar can fully cover the area the AppTopBar normally
      // occupies. `pointerEvents="box-none"` lets scroll/tap pass
      // through wherever no child is hit.
      style={[styles.overlay, { width: windowW }, overlayStyle]}
      pointerEvents="box-none"
    >
      {/* Solid opaque backdrop — anchored at top: 0 so it covers the
          status-bar safe area too. Height + opacity interpolate so it
          draws exactly the rectangle the rings currently occupy. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.backdrop, backdropStyle]}
      />

      {/* Ring row — three morphing items distributed across the width.
          Offset by `insets.top` so the actual rings clear the status
          bar even though the backdrop extends underneath it. */}
      <View
        style={[
          styles.itemsRow,
          { height: EXPANDED_HEIGHT, marginTop: insets.top },
        ]}
        pointerEvents="box-none"
      >
        {values.map((v) => (
          <MorphingRingItem
            key={v.id}
            value={v}
            progress={progress}
            slotWidth={slotWidth}
            onPress={handleRing}
          />
        ))}
      </View>
    </Animated.View>
  );

  return { onScroll, placeholderHeight, overlay };
}

// ────────────────────────────────────────────────────────────────────
// Per-ring morphing item.
//
// The item slot is `slotWidth` wide and EXPANDED_HEIGHT tall. Inside,
// the ring (a fixed-size Skia Canvas) is wrapped in an absolutely-
// positioned Animated.View whose `left`/`top` interpolate between
// expanded and mini layouts. Skia path radius+stroke interpolate
// against `progress` for a true geometric resize.
//
// The label is a separate absolutely-positioned Animated.Text whose
// `left`/`top`/`width`/`fontSize` interpolate from "below ring,
// centred" to "right of ring, slightly compact".
// ────────────────────────────────────────────────────────────────────

const PERCENT_FS_MAX = 17;
const PERCENT_FS_MIN = 0; // fully hidden in mini state

function MorphingRingItem({
  value,
  progress,
  slotWidth,
  onPress,
}: {
  value: SummaryRingValue;
  progress: SharedValue<number>;
  slotWidth: number;
  onPress?: (id: SummaryRingId) => void;
}) {
  const color = resolveColor(value);
  const pctTarget =
    value.value == null ? 0 : Math.max(0, Math.min(100, value.value));

  // ── Ring fill animation (one-shot when value lands) ───────────────
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withTiming(pctTarget, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [pctTarget, fill]);

  // Soft pulse on the halo for "alive" feel.
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (value.value == null) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [pulse, value.value]);

  // ── Geometry (Skia, rebuilt each frame for true geometric resize) ─
  // Canvas size is fixed at RING_MAX so the ring can grow to its
  // maximum without re-laying out the Canvas widget. The ring itself
  // is drawn centered with an interpolated radius + stroke.
  const canvasCenter = RING_MAX / 2;

  const trackPath = useDerivedValue(() => {
    "worklet";
    const p = Skia.Path.Make();
    const size = interpolate(progress.value, [0, 1], [RING_MAX, RING_MIN]);
    const stroke = interpolate(
      progress.value,
      [0, 1],
      [STROKE_MAX, STROKE_MIN]
    );
    const r = (size - stroke) / 2;
    if (r > 0) p.addCircle(canvasCenter, canvasCenter, r);
    return p;
  });

  const arcPath = useDerivedValue(() => {
    "worklet";
    const p = Skia.Path.Make();
    const sweep = (fill.value / 100) * 360;
    if (sweep <= 0.1) return p;
    const size = interpolate(progress.value, [0, 1], [RING_MAX, RING_MIN]);
    const stroke = interpolate(
      progress.value,
      [0, 1],
      [STROKE_MAX, STROKE_MIN]
    );
    const r = (size - stroke) / 2;
    if (r <= 0) return p;
    p.addArc(
      {
        x: canvasCenter - r,
        y: canvasCenter - r,
        width: r * 2,
        height: r * 2,
      },
      -90,
      sweep
    );
    return p;
  });

  const strokeWidth = useDerivedValue(() => {
    "worklet";
    return interpolate(progress.value, [0, 1], [STROKE_MAX, STROKE_MIN]);
  });

  const haloStroke = useDerivedValue(() => {
    "worklet";
    return interpolate(progress.value, [0, 1], [STROKE_MAX + 6, STROKE_MIN + 2]);
  });

  const haloOpacity = useDerivedValue(() => {
    "worklet";
    return 0.18 + pulse.value * 0.2;
  });

  // ── Layout: ring wrapper position ─────────────────────────────────
  // The Canvas is RING_MAX × RING_MAX. We translate the wrapper so
  // that the visible ring's CENTRE lands where it should be in each
  // state. In expanded: ring centred in slot, near top. In mini:
  // ring's left edge sits at slotPadding, vertically centred in
  // MINI_HEIGHT.
  const expandedRingLeft = (slotWidth - RING_MAX) / 2;
  const expandedRingTop = 4; // small top breathing room

  // In mini state we want the ring's *outer edge* to be at slotPaddingLeft.
  const miniSlotPadding = 14;
  const miniRingLeft = miniSlotPadding - (RING_MAX - RING_MIN) / 2;
  const miniRingTop = (MINI_HEIGHT - RING_MIN) / 2 - (RING_MAX - RING_MIN) / 2;

  const ringWrapStyle = useAnimatedStyle(() => ({
    left: interpolate(
      progress.value,
      [0, 1],
      [expandedRingLeft, miniRingLeft],
      Extrapolation.CLAMP
    ),
    top: interpolate(
      progress.value,
      [0, 1],
      [expandedRingTop, miniRingTop],
      Extrapolation.CLAMP
    ),
  }));

  // ── Inner percent text — fades out as we collapse ─────────────────
  const percentStyle = useAnimatedStyle(() => ({
    left: interpolate(
      progress.value,
      [0, 1],
      [expandedRingLeft, miniRingLeft],
      Extrapolation.CLAMP
    ),
    top: interpolate(
      progress.value,
      [0, 1],
      [expandedRingTop, miniRingTop],
      Extrapolation.CLAMP
    ),
    opacity: interpolate(
      progress.value,
      [0, 0.35],
      [1, 0],
      Extrapolation.CLAMP
    ),
    fontSize: interpolate(
      progress.value,
      [0, 1],
      [PERCENT_FS_MAX, PERCENT_FS_MIN],
      Extrapolation.CLAMP
    ),
  }));

  // ── Label — morphs position from below ring → right of ring ───────
  // Expanded: label spans the full slot, centred under the ring.
  // Mini: label sits to the right of the ring, vertically centred.
  const expandedLabelLeft = 0;
  const expandedLabelTop = expandedRingTop + RING_MAX + 8;
  const expandedLabelWidth = slotWidth;

  const labelRowGap = 10;
  const miniLabelLeft = miniSlotPadding + RING_MIN + labelRowGap;
  const miniLabelTop = (MINI_HEIGHT - LABEL_FS_MIN - 2) / 2;
  const miniLabelWidth = slotWidth - miniLabelLeft - 6;

  const labelStyle = useAnimatedStyle(() => ({
    left: interpolate(
      progress.value,
      [0, 1],
      [expandedLabelLeft, miniLabelLeft],
      Extrapolation.CLAMP
    ),
    top: interpolate(
      progress.value,
      [0, 1],
      [expandedLabelTop, miniLabelTop],
      Extrapolation.CLAMP
    ),
    width: interpolate(
      progress.value,
      [0, 1],
      [expandedLabelWidth, miniLabelWidth],
      Extrapolation.CLAMP
    ),
    fontSize: interpolate(
      progress.value,
      [0, 1],
      [LABEL_FS_MAX, LABEL_FS_MIN],
      Extrapolation.CLAMP
    ),
  }));

  // textAlign can't be smoothly animated, so we flip it once we cross
  // the midpoint of the morph. The flip happens behind the position
  // crossfade so it's visually imperceptible.
  const [isMiniAlign, setIsMiniAlign] = React.useState(false);
  useAnimatedReaction(
    () => progress.value > 0.55,
    (mini, prev) => {
      if (mini !== prev) {
        runOnJS(setIsMiniAlign)(mini);
      }
    },
    []
  );

  const display =
    value.centerOverride !== undefined
      ? value.centerOverride
      : value.value == null
        ? "—"
        : `${Math.round(pctTarget)}${value.unit ?? "%"}`;

  return (
    <Pressable
      onPress={onPress ? () => onPress(value.id) : undefined}
      style={[styles.slot, { width: slotWidth }]}
      hitSlop={4}
    >
      {/* Ring (Skia Canvas wrapped in an animated positioning view) */}
      <Animated.View style={[styles.ringWrap, ringWrapStyle]}>
        <Canvas style={{ width: RING_MAX, height: RING_MAX }}>
          {/* Track */}
          <Path
            path={trackPath}
            style="stroke"
            strokeWidth={strokeWidth}
            strokeCap="round"
            color={color.glow}
            opacity={0.55}
          />
          {/* Halo behind score arc */}
          <Group opacity={haloOpacity}>
            <Path
              path={arcPath}
              style="stroke"
              strokeWidth={haloStroke}
              strokeCap="round"
              color={color.base}
            />
          </Group>
          {/* Foreground arc with sweep gradient */}
          <Path
            path={arcPath}
            style="stroke"
            strokeWidth={strokeWidth}
            strokeCap="round"
          >
            <SweepGradient
              c={vec(canvasCenter, canvasCenter)}
              colors={[color.gradient[1], color.gradient[0], color.gradient[1]]}
            />
          </Path>
        </Canvas>
      </Animated.View>

      {/* Center percent text — sits in the same animated layer as the
          ring so it tracks the ring's centre while fading out. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.percentLayer, percentStyle]}
      >
        <View style={styles.percentInner}>
          <Animated.Text
            style={[styles.percentText, { fontSize: PERCENT_FS_MAX }]}
            numberOfLines={1}
          >
            {display}
          </Animated.Text>
        </View>
      </Animated.View>

      {/* Label — morphs from below ring → right of ring. */}
      <Animated.Text
        numberOfLines={1}
        style={[
          styles.label,
          { textAlign: isMiniAlign ? "left" : "center" },
          labelStyle,
        ]}
      >
        {value.label.toUpperCase()}
      </Animated.Text>
    </Pressable>
  );
}

/** Mirror of DailySummaryRings' colour resolver. */
function resolveColor(value: SummaryRingValue): {
  base: string;
  gradient: readonly [string, string];
  glow: string;
} {
  if (value.color?.kind === "custom") {
    return {
      base: value.color.base,
      gradient: value.color.gradient,
      glow: value.color.glow,
    };
  }
  if (value.color?.kind === "data") return dataColors[value.color.key];
  switch (value.id) {
    case "sleep":
      return dataColors.sleep;
    case "recovery":
      return dataColors.recovery;
    case "strain":
      return dataColors.strain;
    case "active":
      return dataColors.habits;
    case "consistency":
      return dataColors.recovery;
    case "planned":
      return dataColors.activity;
  }
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 110,
    elevation: 12,
  },
  backdrop: {
    position: "absolute",
    top: 0, // covers from screen top (includes status-bar safe area)
    left: 0,
    right: 0,
    backgroundColor: BAR_SOLID,
    overflow: "hidden",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: borderTokens.subtle,
  },
  itemsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  slot: {
    height: EXPANDED_HEIGHT,
    position: "relative",
  },
  ringWrap: {
    position: "absolute",
    width: RING_MAX,
    height: RING_MAX,
    // Allow the Skia ring to render its halo bleed without being clipped
    // when the wrapper is positioned at an offset.
    overflow: "visible",
  },
  percentLayer: {
    position: "absolute",
    width: RING_MAX,
    height: RING_MAX,
    alignItems: "center",
    justifyContent: "center",
  },
  percentInner: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  percentText: {
    fontFamily: fontFamily.monoBold,
    color: text.primary,
    letterSpacing: -0.2,
  },
  label: {
    position: "absolute",
    fontFamily: fontFamily.bodyBold,
    color: text.primary,
    letterSpacing: 1.1,
  },
});
