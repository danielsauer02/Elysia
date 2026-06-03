/**
 * AppTopBar — global persistent top bar shown above every tab.
 *
 * Layout (left → right):
 *   • DailyStatusPill   (Active / Resting / Sick / Injured / Travel)
 *   • Centered ELYSIA wordmark (small, spaced)
 *   • Notifications bell
 *   • Avatar / Settings entry
 *
 * Visual: blurred anthracite glass background that floats over the screen
 * content. Height accounts for the safe-area inset so it lines up flush
 * with the status bar on every device. Drop into `(tabs)/_layout.tsx` as
 * a static header above the Tabs router output.
 */
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  borderTokens,
  fontFamily,
  glass,
  spacing,
  surface,
  text,
} from "@/theme";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";
import { DailyStatusPill } from "@/components/navigation/DailyStatusPill";
import {
  useActiveHeaderProgress,
  useActiveScrollY,
} from "@/context/ScrollContext";
import { BAR_SOLID } from "@/components/dashboard/StickyRingsHeader";

const BAR_HEIGHT = 52;

export function AppTopBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const headerProgress = useActiveHeaderProgress();
  const scrollY = useActiveScrollY();

  const totalHeight = BAR_HEIGHT + insets.top;

  // Slides off-screen when `headerProgress` is 0 (scrolling down),
  // back into place when 1 (scrolling up or at top). The value is
  // already smoothly animated upstream via `withTiming`, so this
  // mapping stays direct — no further easing needed here.
  const wrapStyle = useAnimatedStyle(() => {
    const p = headerProgress.value;
    return {
      opacity: p,
      transform: [{ translateY: -totalHeight * (1 - p) }],
    };
  }, [totalHeight]);

  // When the user has scrolled at all we swap the translucent blurred
  // glass look for a fully opaque dark surface. Reason: in the
  // "header visible + mini rings bar visible" state the two surfaces
  // need to look like one continuous opaque block — a translucent
  // blur would let card content show through and break the visual.
  // In the resting state (scrollY ≈ 0) the cool blur is preserved.
  const solidStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, 20],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <Animated.View
      // When the bar slides out of view we want the touches that would
      // have hit the avatar / bell to fall through to whatever is
      // underneath (the mini rings bar). `auto` still respects opacity
      // so this is purely a defensive setting; the visible-state UX
      // remains unchanged.
      pointerEvents="box-none"
      style={[styles.wrap, { height: totalHeight }, wrapStyle]}
    >
      <BlurView
        intensity={glass.anthracite.blurIntensity}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.tint]} />
      {/* Solid opaque layer — invisible at rest, fades in once the
          user starts scrolling so the bar matches the mini rings
          backdrop seamlessly. */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.solid, solidStyle]}
      />
      <View style={[styles.row, { paddingTop: insets.top }]}>
        <View style={styles.left}>
          <DailyStatusPill />
        </View>

        <View style={styles.center} pointerEvents="none">
          <Text style={styles.wordmark}>ELYSIA</Text>
        </View>

        <View style={styles.right}>
          <AnimatedPressable
            haptic="light"
            onPress={() => {
              /* notifications screen — placeholder until we build it */
            }}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={18} color={text.primary} />
          </AnimatedPressable>
          <AnimatedPressable
            haptic="light"
            onPress={() => router.push("/(tabs)/settings")}
            style={styles.avatar}
            accessibilityRole="button"
            accessibilityLabel="Profile and settings"
          >
            <Ionicons name="person-outline" size={16} color={text.primary} />
          </AnimatedPressable>
        </View>
      </View>
      {/* Hairline divider at the bottom edge */}
      <View style={styles.hairline} pointerEvents="none" />
    </Animated.View>
  );
}

/** Height the bar occupies, including safe-area inset. Useful when a child
 *  scroll view needs to know its content offset to avoid jumping under
 *  the bar on first render. */
export function useAppTopBarHeight(): number {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + insets.top;
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    overflow: "hidden",
  },
  tint: {
    backgroundColor:
      Platform.OS === "android"
        ? surface.overlay
        : glass.anthracite.tint,
  },
  solid: {
    backgroundColor: BAR_SOLID,
  },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  left: {
    minWidth: 90,
    flexDirection: "row",
    alignItems: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 13,
    letterSpacing: 4.2,
    color: text.primary,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: borderTokens.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: borderTokens.hairline,
    alignItems: "center",
    justifyContent: "center",
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
