/**
 * StickyRingsHeader — Whoop-style collapsible summary at the top of Home.
 *
 * Two visual states driven by scroll position:
 *   • Expanded (scrollY ≈ 0) — 3 big rings with labels + chevrons + a
 *     contextual one-liner below ("How you slept" / "How recovered").
 *   • Collapsed (scrollY > THRESHOLD) — 3 mini rings packed in a single
 *     row pinned to the very top of the screen (under AppTopBar) with a
 *     small TODAY tag on the right.
 *
 * The scroll handler is exposed via `onScroll` so the parent ScrollView /
 * Animated.ScrollView can wire it without us mounting our own scroll.
 *
 * Usage:
 *   const { onScroll, header, expandedHeight } = useStickyRingsHeader({...})
 *   <Animated.ScrollView onScroll={onScroll}> {...content} </Animated.ScrollView>
 *   {header}
 */
import React, { useCallback, useMemo } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import {
  borderTokens,
  glass,
  spacing,
  surface,
  text,
  typography,
} from "@/theme";
import {
  DailySummaryRings,
  type SummaryRingId,
  type SummaryRingValue,
} from "@/components/dashboard/DailySummaryRings";

const EXPANDED_HEIGHT = 220;
const COLLAPSED_HEIGHT = 78;
const COLLAPSE_DISTANCE = 90;

interface UseStickyRingsHeaderArgs {
  values: SummaryRingValue[];
  /** Offset where the sticky bar should pin (typically AppTopBar height). */
  topOffset: number;
  contextLine?: string;
  onPressRing?: (id: SummaryRingId) => void;
}

export function useStickyRingsHeader({
  values,
  topOffset,
  contextLine,
  onPressRing,
}: UseStickyRingsHeaderArgs) {
  const scrollY = useSharedValue(0);
  const { width: windowW } = useWindowDimensions();

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  // Expanded block fades + slides up as we scroll.
  const expandedStyle = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, scrollY.value / COLLAPSE_DISTANCE));
    return {
      opacity: interpolate(t, [0, 0.6, 1], [1, 0.6, 0]),
      transform: [{ translateY: interpolate(t, [0, 1], [0, -24]) }],
    };
  });

  // Collapsed (sticky) bar fades in from invisible.
  const collapsedStyle = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, scrollY.value / COLLAPSE_DISTANCE));
    return {
      opacity: interpolate(t, [0, 0.5, 1], [0, 0.6, 1]),
      transform: [{ translateY: interpolate(t, [0, 1], [-12, 0]) }],
    };
  });

  const expandedHeight = useMemo(() => EXPANDED_HEIGHT, []);

  const handleRing = useCallback(
    (id: SummaryRingId) => onPressRing?.(id),
    [onPressRing]
  );

  const header = (
    <>
      {/* Expanded hero (in-flow content of the scroll view) */}
      <View
        style={{
          height: expandedHeight,
          paddingTop: spacing.sm,
          paddingBottom: spacing.md,
        }}
      >
        <Animated.View style={[styles.expanded, expandedStyle]}>
          <DailySummaryRings
            values={values}
            width={windowW}
            onPressRing={handleRing}
          />
          {contextLine ? (
            <Text style={styles.contextLine} numberOfLines={2}>
              {contextLine}
            </Text>
          ) : null}
        </Animated.View>
      </View>

      {/* Collapsed sticky bar (absolute, pinned just below AppTopBar) */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.sticky,
          { top: topOffset, height: COLLAPSED_HEIGHT },
          collapsedStyle,
        ]}
      >
        <BlurView
          intensity={glass.anthracite.blurIntensity}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, styles.stickyTint]} />
        <View style={styles.stickyRow}>
          <DailySummaryRings values={values} width={windowW} compact />
          <View style={styles.stickyMeta} pointerEvents="none">
            <Text style={styles.stickyTag}>TODAY</Text>
          </View>
        </View>
        <View style={styles.hairline} />
      </Animated.View>
    </>
  );

  return { onScroll, header, expandedHeight, scrollY };
}

const styles = StyleSheet.create({
  expanded: {
    gap: spacing.sm,
    alignItems: "center",
  },
  contextLine: {
    ...typography.body,
    color: text.secondary,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
    marginTop: 2,
  },

  // Sticky bar
  sticky: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 50,
    overflow: "hidden",
  },
  stickyTint: {
    backgroundColor:
      Platform.OS === "android"
        ? surface.overlay
        : glass.anthracite.tint,
  },
  stickyRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  stickyMeta: {
    position: "absolute",
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  stickyTag: {
    ...typography.eyebrow,
    color: text.tertiary,
  },
  hairline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: borderTokens.subtle,
  },
});
