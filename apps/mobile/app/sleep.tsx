/**
 * /sleep — Sleep Deep-Dive screen
 *
 * Single ScrollView that stacks the seven sections of the sleep feature.
 * The `SleepProvider` lives here (not in app/_layout) so the
 * selected-day / selected-stage state resets when the user leaves the
 * screen — perfect for a "scoped detail view" pattern.
 */
import React from "react";
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { GestureDetector } from "react-native-gesture-handler";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { SleepProvider, useSleepContext } from "@/context/SleepContext";
import { useSleepData } from "@/hooks/useSleepData";
import { SleepScoreHero } from "@/components/sleep/SleepScoreHero";
import { SleepTimeline } from "@/components/sleep/SleepTimeline";
import { SleepStagesSection } from "@/components/sleep/SleepStagesSection";
import { SleepMetricsGrid } from "@/components/sleep/SleepMetricsGrid";
import { ChronotypeCard } from "@/components/sleep/ChronotypeCard";
import { TrackingHeroBackground } from "@/components/tracking/TrackingHeroBackground";
import { useTrackingHeroScroll } from "@/hooks/useTrackingHeroScroll";
import { colors, fontFamily, spacing } from "@/theme";

const DEFAULT_HERO_HEIGHT = 380;
const DEFAULT_HEADER_HEIGHT = 52;
// Soft tail below the header where the darkening keeps fading out gently,
// so the transition launches very soft and has no hard edge.
const HEADER_FADE_EXTRA = 54;

export default function SleepScreen() {
  return (
    <SleepProvider>
      <SleepScreenInner />
    </SleepProvider>
  );
}

function SleepScreenInner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loading, week, night, chronotype } = useSleepData();
  const { setSelectedDay } = useSleepContext();

  // Hero region height (wallpaper band + fade target) — measured so the
  // wallpaper covers exactly the score + sub-KPIs and fades out below them.
  const [heroHeight, setHeroHeight] = React.useState(DEFAULT_HERO_HEIGHT);
  const onHeroLayout = React.useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h > 0) setHeroHeight(h);
  }, []);

  // Header height — the wallpaper now starts at the very top (behind the
  // transparent header), so the band must also cover the header to keep its
  // visible height (and the bottom fade position) the same as before.
  const [headerHeight, setHeaderHeight] = React.useState(DEFAULT_HEADER_HEIGHT);
  const onHeaderLayout = React.useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h > 0) setHeaderHeight(h);
  }, []);

  // Tracking-hero scroll behaviour: writes the global `scrollY` (so the
  // bottom tab bar collapses/expands), drives the pull-to-zoom rubber band
  // and the flick-up bounce, and exposes the wallpaper transform.
  const { onScroll, gesture, heroLiftStyle, wallpaperStyle, headerBlurStyle } =
    useTrackingHeroScroll({ heroHeight });

  // Default to LAST night with a recording (so 2 a.m. before tonight's
  // upload still shows yesterday's sleep). Seed once; never override a
  // manual day pick afterwards.
  const latestSleepDay = useQuery(api.sleep.getLatestSleepDay, {});
  const seeded = React.useRef(false);
  React.useEffect(() => {
    if (!seeded.current && latestSleepDay) {
      seeded.current = true;
      setSelectedDay(latestSleepDay);
    }
  }, [latestSleepDay, setSelectedDay]);

  // Prefer the daily-rollup sleepMinutes (already source-merged) and fall
  // back to summing the stage tiles when the rollup hasn't landed yet.
  const asleepMinutes = (() => {
    const rollup = night?.dailyMetrics?.sleepMinutes ?? null;
    if (rollup !== null && rollup !== undefined) return rollup;
    const d = night?.stages.deepMinutes ?? 0;
    const r = night?.stages.remMinutes ?? 0;
    const l = night?.stages.lightMinutes ?? 0;
    const sum = d + r + l;
    return sum > 0 ? sum : null;
  })();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.root}>
      {/* Themed wallpaper starts at the very top (behind the transparent
          header) and covers header + hero, so its visible height — and the
          bottom fade — stay the same as before. Zooms on pull-down, fades
          out as the user scrolls past the hero. */}
      <TrackingHeroBackground
        kind="sleep"
        height={headerHeight + heroHeight}
        animatedStyle={wallpaperStyle}
      />

      {/* GestureDetector wraps the ScrollView DIRECTLY so Gesture.Native()
          binds to the list's own scrolling (composed simultaneously with the
          pull-pan). The hero-lift transform lives on an inner wrapper. */}
      <GestureDetector gesture={gesture}>
      <Animated.ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scroll, { paddingTop: headerHeight }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        overScrollMode="never"
        bounces={false}
      >
      <Animated.View style={heroLiftStyle as never}>
        {/* Section 1 — Score hero (measured: drives the wallpaper height) */}
        <View onLayout={onHeroLayout}>
          <SleepScoreHero
            fitness={night?.fitness ?? null}
            week={week}
            asleepMinutes={asleepMinutes}
          />
        </View>

        {/* Section 2 — Timeline + tags + manual add */}
        <SleepTimeline day={night?.day ?? new Date().toISOString().slice(0, 10)} night={night} />

        {/* Section 3 — Stages chart + 2x2 tiles */}
        <SleepStagesSection
          segments={night?.stages.segments ?? []}
          primaryStart={night?.stages.primary?.start ?? null}
          primaryEnd={night?.stages.primary?.end ?? null}
          totals={{
            deepMinutes: night?.stages.deepMinutes ?? null,
            remMinutes: night?.stages.remMinutes ?? null,
            lightMinutes: night?.stages.lightMinutes ?? null,
            awakeMinutes: night?.stages.awakeMinutes ?? null,
          }}
        />

        {/* Section 4 — KPI grid */}
        <SleepMetricsGrid
          metrics={night?.metrics ?? null}
          primaryStart={night?.stages.primary?.start ?? null}
          primaryEnd={night?.stages.primary?.end ?? null}
        />

        {/* Section 6 — Chronotype / body clock */}
        <ChronotypeCard
          data={chronotype}
          primaryStart={night?.stages.primary?.start ?? null}
          primaryEnd={night?.stages.primary?.end ?? null}
          segments={night?.stages.segments ?? []}
        />

        {loading && !night ? (
          <View style={styles.loadingHint}>
            <Text style={styles.loadingText}>Loading your sleep data...</Text>
          </View>
        ) : null}
      </Animated.View>
      </Animated.ScrollView>
      </GestureDetector>

      {/* Header — absolute OVERLAY (rendered last so content scrolls
          UNDERNEATH it). Transparent while the hero/wallpaper is on screen
          (sharp wallpaper behind the back arrow); as the user scrolls past
          the hero the content slides under it and the blur fades in,
          frosting that content into a translucent bar (Bevel-style). Title
          omitted — the user reached this view deliberately via the ring. */}
      <View style={styles.header} onLayout={onHeaderLayout} pointerEvents="box-none">
        <Animated.View
          pointerEvents="none"
          style={[
            styles.headerBlur,
            {
              top: -insets.top,
              height: insets.top + headerHeight + HEADER_FADE_EXTRA,
            },
            headerBlurStyle,
          ]}
        >
          {/* Pure colour gradient — no blur. Strong at the very top, fading
              smoothly to zero across the band + ~1cm tail so the launch (near
              the content) is super soft and only intensifies toward the top. */}
          <LinearGradient
            colors={[
              "rgba(4,7,14,0.92)",
              "rgba(4,7,14,0.78)",
              "rgba(4,7,14,0.63)",
              "rgba(4,7,14,0.49)",
              "rgba(4,7,14,0.36)",
              "rgba(4,7,14,0.25)",
              "rgba(4,7,14,0.16)",
              "rgba(4,7,14,0.09)",
              "rgba(4,7,14,0.04)",
              "rgba(4,7,14,0.015)",
              "rgba(4,7,14,0)",
            ]}
            locations={[0, 0.1, 0.2, 0.31, 0.42, 0.53, 0.64, 0.75, 0.85, 0.93, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
      </View>
      </View>
{/* /root */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  // Relative positioning context for the full-bleed wallpaper (which now
  // starts behind the header); clips the zoomed wallpaper to the screen.
  root: { flex: 1, position: "relative", overflow: "hidden" },
  // Header floating over the wallpaper — absolute OVERLAY so content scrolls
  // underneath it (lets the blur frost real content). No solid bar; the blur
  // background (below) fades in on scroll. Just holds the back arrow now.
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: "transparent",
  },
  // Scroll-driven darkening bar. Extends up over the status bar so the whole
  // top reads as one soft gradient header (Bevel-style) once scrolled.
  headerBlur: {
    position: "absolute",
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  scroll: {
    // Big bottom inset so the last section never gets covered by the
    // floating tab bar or Android gesture handle.
    paddingBottom: spacing.huge * 3,
  },
  loadingHint: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  loadingText: {
    fontFamily: fontFamily.body,
    color: colors.textSecondary,
  },
});
