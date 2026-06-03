/**
 * MagneticTabBar — Liquid Glass / iOS 26-style tab bar with a
 * water-balloon magnifying lens.
 *
 * This component is fully **routing-agnostic**: it knows nothing
 * about React Navigation. The parent (`GlobalTabBarOverlay`) passes
 * in the tabs array, the active key and an `onSelect` callback, so
 * the bar can sit at the root layer and navigate via expo-router
 * regardless of whether the user is currently on a tab screen or
 * inside a deep-dive view.
 *
 * Behaviour (verbatim per spec):
 *
 *   1. Water-balloon lens
 *      An ELLIPSE-shaped glass lens — visibly wider than it is tall —
 *      appears on press and follows the finger STRICTLY along the
 *      horizontal centre line of the bar. As the finger flicks left
 *      or right, the lens "squashes" horizontally (scaleY > 1,
 *      scaleX < 1) and springs back to its rest shape, mimicking a
 *      water balloon's give. Vertical drag is fully suppressed.
 *
 *   2. Bar grows on press
 *      The whole bar transforms to `scale(BAR_PRESS_SCALE)` while the
 *      finger is down — subtle, ~1.04.
 *
 *   3. Bar tint shift
 *      Faint white wash fades in across the bar on press.
 *
 *   4. Selected-tab pill
 *      Active tab gets a tinted accent pill BEHIND its icon + label.
 *
 *   5. Deselect-on-drag
 *      While the finger is down (drag in progress) the active-tab
 *      highlight (pill + accent colour) fades out and a neutral copy
 *      fades in. On release the new highlight snaps to whichever
 *      slot the finger ended up in.
 *
 *   6. Collapse morph
 *      Driven by a SharedValue `navCollapsed` (0 = full pill,
 *      1 = circle). When fully collapsed the pill width shrinks to
 *      the bar height (so a perfect circle), all tab cells fade
 *      out, and a single centred icon for the active tab fades in.
 *      Tapping the circle calls `onTapWhenCollapsed` which the
 *      overlay uses to mark "manually expanded".
 */
import React, { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { FLOATING_TAB_BAR } from "@/constants/floatingTabBar";
import { brand, colors, text as textTokens } from "@/theme";

export interface MagneticTabBarTab {
  key: string;
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
}

// ── Tunables ─────────────────────────────────────────────────────────
/**
 * Lens geometry — a rounded bubble that is TALLER than the bar height
 * (so it bulges a few px over the top and bottom edges, à la WhatsApp /
 * iOS) and not too wide, so it reads as a focus bubble rather than a
 * flat squished pill.
 */
const LENS_W = 84;
const LENS_H = 64;
/** Magnification factor of the content inside the lens. */
const LENS_SCALE = 1.5;
/** Bar scale during press (~4 % growth). */
const BAR_PRESS_SCALE = 1.04;
/** Initial lens scale (it pops in from this size on press). */
const LENS_REST_SCALE = 0.7;
/** Px/s of horizontal finger speed at which the squash maxes out. */
const SQUASH_VELOCITY_CAP = 1200;
/**
 * Water-balloon squash. Moving fast horizontally squishes the bubble
 * FLATTER (scaleY < 1) and stretches it a touch wider (scaleX > 1),
 * then a spring follower lets it wobble back to rest with overshoot.
 */
const MAX_SQUASH_X = 0.14;
const MAX_SQUASH_Y = 0.24;

// Tinted accent pill behind the active tab in the resting state.
const SELECTED_PILL_TINT = "rgba(34, 211, 238, 0.10)";
const SELECTED_PILL_BORDER = "rgba(34, 211, 238, 0.20)";

interface Props {
  tabs: MagneticTabBarTab[];
  activeKey: string;
  onSelect: (key: string) => void;
  /** Tap-to-expand handler called when the bar is fully collapsed. */
  onTapWhenCollapsed?: () => void;
  /** Full expanded width of the pill. */
  width: number;
  /** Bar height. */
  height: number;
  borderRadius: number;
  /**
   * 0 = fully expanded pill (default), 1 = fully collapsed circle.
   * Continuous animation value driven from the overlay.
   */
  collapsed: SharedValue<number>;
}

export function MagneticTabBar({
  tabs,
  activeKey,
  onSelect,
  onTapWhenCollapsed,
  width,
  height,
  borderRadius,
  collapsed,
}: Props) {
  const activeIdx = useMemo(() => {
    const idx = tabs.findIndex((t) => t.key === activeKey);
    return idx >= 0 ? idx : 0;
  }, [tabs, activeKey]);

  const tabCount = Math.max(1, tabs.length);
  const tabWidth = width / tabCount;

  // The lens travels strictly along the bar's horizontal centre line.
  const centerY = height / 2;
  /** Collapsed shape is a perfect circle whose diameter == bar height. */
  const collapsedSize = height;

  // ── Shared animation values ───────────────────────────────────────
  const pressed = useSharedValue(0); // 0..1 tween, drives bar + lens
  const fingerX = useSharedValue(width / 2);
  /**
   * Raw squash target in [-1, 1], written each frame from the finger's
   * horizontal velocity. `squash` is a SPRING FOLLOWER of this target,
   * so when the finger stops/reverses, the bubble wobbles back to its
   * rest shape with a little overshoot — the water-balloon feel.
   */
  const squashTarget = useSharedValue(0);
  const squash = useDerivedValue(() =>
    withSpring(squashTarget.value, {
      damping: 10,
      stiffness: 200,
      mass: 0.6,
    })
  );

  // JS-side mirror of the collapse state: true when the bar is mostly
  // shrunk so the expanded gesture layer should stop intercepting
  // touches and the CollapsedTapTarget should take over.
  const [isCollapsed, setIsCollapsed] = useState(false);
  useAnimatedReaction(
    () => collapsed.value > 0.5,
    (next, prev) => {
      "worklet";
      if (next !== prev) runOnJS(setIsCollapsed)(next);
    }
  );

  // Bar grows ~4 % while pressed.
  const barScale = useDerivedValue(() =>
    withTiming(1 + pressed.value * (BAR_PRESS_SCALE - 1), { duration: 220 })
  );

  // ── Outer pill width/borderRadius morph ────────────────────────────
  // The pill physically shrinks from `width × height` (rounded pill)
  // to `collapsedSize × collapsedSize` (perfect circle).
  const barWrapStyle = useAnimatedStyle(() => {
    const w = interpolate(
      collapsed.value,
      [0, 1],
      [width, collapsedSize],
      Extrapolation.CLAMP
    );
    return {
      width: w,
      height,
      borderRadius,
      transform: [{ scale: barScale.value }],
    };
  });

  // Faint warmer tint fades in across the whole bar on press.
  const barTintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      pressed.value,
      [0, 1],
      [0, 0.55],
      Extrapolation.CLAMP
    ),
  }));

  // Lens follows the finger horizontally only (Y pinned to the bar
  // centre) and grows from rest → full size on press. The squash uses
  // the spring-followed `squash` value so the bubble wobbles and
  // overshoots like a water balloon when the finger flicks/stops.
  const lensPosStyle = useAnimatedStyle(() => {
    const absV = Math.min(1, Math.abs(squash.value));
    const sx = 1 + absV * MAX_SQUASH_X;
    const sy = 1 - absV * MAX_SQUASH_Y;
    return {
      transform: [
        { translateX: fingerX.value - LENS_W / 2 },
        { translateY: centerY - LENS_H / 2 },
        {
          scale: interpolate(
            pressed.value,
            [0, 1],
            [LENS_REST_SCALE, 1],
            Extrapolation.CLAMP
          ),
        },
        { scaleX: sx },
        { scaleY: sy },
      ],
      opacity: pressed.value,
    };
  });

  // Inside the lens, we render a row of MagnifiedTabItems pre-scaled
  // on the JS side (no transform-scale composition issues). Translate-
  // only math: bring source-point (fingerX, centerY) to the lens
  // centre.
  const lensContentStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: LENS_W / 2 - fingerX.value * LENS_SCALE },
      { translateY: LENS_H / 2 - centerY * LENS_SCALE },
    ],
  }));

  // Static-row dims while a finger is down (so the magnified lens reads
  // as the in-focus region) and fades fully while the bar collapses.
  const expandedRowStyle = useAnimatedStyle(() => {
    const collapseFade = interpolate(
      collapsed.value,
      [0, 1],
      [1, 0],
      Extrapolation.CLAMP
    );
    const pressDim = interpolate(
      pressed.value,
      [0, 1],
      [1, 0.5],
      Extrapolation.CLAMP
    );
    return { opacity: collapseFade * pressDim };
  });

  // Collapsed-state single-icon style — fades in as the pill shrinks.
  const collapsedIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      collapsed.value,
      [0.4, 1],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  // While the bar is collapsing we want the lens-press gesture to be
  // suppressed (the whole shape is too small for a useful lens). The
  // collapsed circle uses a Pressable for tap-to-expand.
  const interactiveStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      collapsed.value,
      [0, 0.4],
      [1, 0],
      Extrapolation.CLAMP
    ),
  }));

  // ── Navigation helper (runs on JS thread) ──────────────────────────
  const handleNavigateByIndex = useCallback(
    (idx: number) => {
      const tab = tabs[idx];
      if (!tab) return;
      onSelect(tab.key);
    },
    [tabs, onSelect]
  );

  // ── Gesture: a single Pan covers tap + drag + release ──────────────
  const pan = Gesture.Pan()
    .minDistance(0)
    .maxPointers(1)
    .shouldCancelWhenOutside(false)
    .onBegin((e) => {
      "worklet";
      pressed.value = withTiming(1, { duration: 170 });
      fingerX.value = clamp(e.x, LENS_W / 3, width - LENS_W / 3);
      squashTarget.value = 0;
    })
    .onUpdate((e) => {
      "worklet";
      fingerX.value = clamp(e.x, LENS_W / 3, width - LENS_W / 3);
      // Feed the finger's instantaneous horizontal velocity into the
      // squash target; the spring follower turns it into the wobble.
      squashTarget.value = clamp(
        e.velocityX / SQUASH_VELOCITY_CAP,
        -1,
        1
      );
    })
    .onEnd((e) => {
      "worklet";
      const finalX = clamp(e.x, 0, width);
      const idx = clamp(Math.floor(finalX / tabWidth), 0, tabCount - 1);
      runOnJS(handleNavigateByIndex)(idx);
      pressed.value = withTiming(0, { duration: 240 });
      // Target back to rest — the spring follower wobbles it home.
      squashTarget.value = 0;
    })
    .onFinalize(() => {
      "worklet";
      pressed.value = withTiming(0, { duration: 240 });
      squashTarget.value = 0;
    });

  // The active tab's icon when collapsed (shown centred in the circle).
  const activeTab = tabs[activeIdx];

  return (
    <Animated.View style={[styles.outer, barWrapStyle]}>
      {/* Anthracite glass background (blur + tint + border). */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius,
            overflow: "hidden",
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: FLOATING_TAB_BAR.borderColor,
          },
        ]}
      >
        <BlurView
          intensity={FLOATING_TAB_BAR.blurIntensity}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: FLOATING_TAB_BAR.tintOverlay },
          ]}
        />
      </View>

      {/* Press-state tint shift overlay. */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius,
            backgroundColor: "rgba(255, 255, 255, 0.05)",
          },
          barTintStyle,
        ]}
      />

      {/* Expanded-state layer: gesture + tab row + lens. Fades to 0
          as the bar collapses so the collapsed circle can take over.
          When `isCollapsed` flips true the layer also stops receiving
          touches so the CollapsedTapTarget below can catch the tap. */}
      <Animated.View
        style={[StyleSheet.absoluteFill, interactiveStyle]}
        pointerEvents={isCollapsed ? "none" : "box-none"}
      >
        <GestureDetector gesture={pan}>
          <Animated.View
            style={{
              width,
              height,
              borderRadius,
            }}
          >
            {/* Static tab row — the icons / labels that always show. */}
            <Animated.View style={[styles.row, expandedRowStyle]}>
              {tabs.map((tab, idx) => (
                <TabItem
                  key={tab.key}
                  iconName={tab.iconName}
                  label={tab.label}
                  isFocused={idx === activeIdx}
                  width={tabWidth}
                  height={height}
                  pressedSV={pressed}
                />
              ))}
            </Animated.View>

            {/* Water-balloon lens overlay — invisible until pressed. */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.lens,
                {
                  width: LENS_W,
                  height: LENS_H,
                  borderRadius: LENS_H / 2,
                },
                lensPosStyle,
              ]}
            >
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    borderRadius: LENS_H / 2,
                    overflow: "hidden",
                    // OPAQUE so the static row underneath never bleeds
                    // through — that bleed-through is what caused the
                    // "doubled words" (e.g. seeing "Tracker" twice).
                    // The lens now shows ONLY its own magnified copy.
                    backgroundColor: "rgb(40, 47, 64)",
                  },
                ]}
              >
                <Animated.View
                  style={[
                    {
                      position: "absolute",
                      left: 0,
                      top: 0,
                      width: width * LENS_SCALE,
                      height: height * LENS_SCALE,
                      flexDirection: "row",
                    },
                    lensContentStyle,
                  ]}
                >
                  {tabs.map((tab) => (
                    <MagnifiedTabItem
                      key={`lens-${tab.key}`}
                      iconName={tab.iconName}
                      label={tab.label}
                      isFocused={false}
                      width={tabWidth * LENS_SCALE}
                      height={height * LENS_SCALE}
                      scale={LENS_SCALE}
                    />
                  ))}
                </Animated.View>
              </View>

              {/* Glass edge ring — top-left highlight + bottom-right shade. */}
              <LinearGradient
                pointerEvents="none"
                colors={[
                  "rgba(255, 255, 255, 0.22)",
                  "rgba(255, 255, 255, 0.04)",
                  "rgba(0, 0, 0, 0.22)",
                ]}
                start={{ x: 0.15, y: 0.05 }}
                end={{ x: 0.85, y: 0.95 }}
                style={[
                  StyleSheet.absoluteFill,
                  { borderRadius: LENS_H / 2, opacity: 0.9 },
                ]}
              />

              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  {
                    borderRadius: LENS_H / 2,
                    borderWidth: 1.5,
                    borderColor: "rgba(255, 255, 255, 0.24)",
                  },
                ]}
              />
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </Animated.View>

      {/* Collapsed-state single-icon layer — fades in as the pill
          shrinks to a circle. Positioned absolutely at the centre of
          the collapsed circle. Non-interactive so the Pressable
          on top catches the tap-to-expand. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.collapsedIconLayer,
          { width: collapsedSize, height: collapsedSize },
          collapsedIconStyle,
        ]}
      >
        {activeTab ? (
          <Ionicons
            name={activeTab.iconName}
            size={22}
            color={colors.accent}
          />
        ) : null}
      </Animated.View>

      {/* Tap-to-expand layer — rendered LAST so it sits above
          everything in the z-order, but `pointerEvents="none"` while
          the bar is expanded so it doesn't steal the lens gestures. */}
      <CollapsedTapTarget
        enabled={isCollapsed}
        onPress={onTapWhenCollapsed}
        size={collapsedSize}
      />
    </Animated.View>
  );
}

// ────────────────────────────────────────────────────────────────────
// CollapsedTapTarget — a Pressable that occupies the collapsed-circle
// footprint and only intercepts touches when the bar is in collapsed
// state. It's how the user re-expands the bar by tapping the circle.
// ────────────────────────────────────────────────────────────────────

function CollapsedTapTarget({
  enabled,
  onPress,
  size,
}: {
  enabled: boolean;
  onPress?: () => void;
  size: number;
}) {
  if (!onPress) return null;
  return (
    <Pressable
      onPress={enabled ? onPress : undefined}
      style={[
        styles.collapsedTap,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
      pointerEvents={enabled ? "auto" : "none"}
      accessibilityRole="button"
      accessibilityLabel="Expand navigation"
      hitSlop={6}
    />
  );
}

// ────────────────────────────────────────────────────────────────────
// TabItem — a single tab cell. The active highlight (tinted pill +
// accent colour) is suspended while the finger is down: as `pressed`
// rises the accent + pill fade out and a neutral copy fades in, so
// no tab looks selected during a drag. On release the highlight
// returns at whichever tab is now focused.
// ────────────────────────────────────────────────────────────────────

interface TabItemProps {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  isFocused: boolean;
  width: number;
  height: number;
  /** 0..1 press progress; while >0 the active highlight is suspended. */
  pressedSV: SharedValue<number>;
}

function TabItem({
  iconName,
  label,
  isFocused,
  width,
  height,
  pressedSV,
}: TabItemProps) {
  const highlightStyle = useAnimatedStyle(() => ({
    opacity: isFocused ? 1 - pressedSV.value : 0,
  }));
  const neutralStyle = useAnimatedStyle(() => ({
    opacity: isFocused ? pressedSV.value : 1,
  }));

  return (
    <View style={[styles.item, { width, height }]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.selectedPill, highlightStyle]}
      />

      <Animated.View
        pointerEvents="none"
        style={[styles.itemContent, neutralStyle]}
      >
        <Ionicons name={iconName} size={20} color={textTokens.tertiary} />
        <Text
          numberOfLines={1}
          style={[styles.label, { color: textTokens.tertiary }]}
        >
          {label}
        </Text>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[styles.itemContent, highlightStyle]}
      >
        <Ionicons name={iconName} size={20} color={colors.accent} />
        <Text
          numberOfLines={1}
          style={[styles.label, { color: colors.accent }]}
        >
          {label}
        </Text>
      </Animated.View>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────
// MagnifiedTabItem — visually identical to TabItem but pre-scaled on
// the JS side (icon, font, gap multiplied by `scale`) so the lens
// shows a true magnified copy WITHOUT transform-scale composition
// issues with Reanimated.
// ────────────────────────────────────────────────────────────────────

interface MagnifiedTabItemProps {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  isFocused: boolean;
  width: number;
  height: number;
  scale: number;
}

function MagnifiedTabItem({
  iconName,
  label,
  isFocused,
  width,
  height,
  scale,
}: MagnifiedTabItemProps) {
  const tint = isFocused ? colors.accent : textTokens.tertiary;
  return (
    <View
      style={{
        width,
        height,
        alignItems: "center",
        justifyContent: "center",
        gap: 2 * scale,
      }}
    >
      <Ionicons name={iconName} size={20 * scale} color={tint} />
      <Text
        numberOfLines={1}
        style={{
          fontSize: 9 * scale,
          fontWeight: "700",
          letterSpacing: 0.15 * scale,
          lineHeight: 11 * scale,
          marginTop: 2 * scale,
          color: tint,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// ── helpers ──────────────────────────────────────────────────────────
function clamp(value: number, min: number, max: number): number {
  "worklet";
  return Math.max(min, Math.min(max, value));
}

// Keep brand referenced so the design-token contract stays warm.
void brand;

const styles = StyleSheet.create({
  outer: {
    position: "relative",
    // Visible so the lens bubble can bulge a few px over the bar's top
    // and bottom edges. The glass background view clips itself, so the
    // bar's rounded shape is preserved regardless.
    overflow: "visible",
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    width: "100%",
    height: "100%",
  },
  item: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  itemContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  selectedPill: {
    position: "absolute",
    top: 5,
    left: 6,
    right: 6,
    bottom: 5,
    borderRadius: 18,
    backgroundColor: SELECTED_PILL_TINT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SELECTED_PILL_BORDER,
  },
  label: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.15,
    lineHeight: 11,
    marginTop: 2,
  },
  lens: {
    position: "absolute",
    top: 0,
    left: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  collapsedIconLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  collapsedTap: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 5,
  },
});
