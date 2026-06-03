/**
 * /recovery — Recovery Deep-Dive screen
 *
 * Recovery twin of /sleep. A single ScrollView stacking the recovery
 * sections under a themed wallpaper hero. The `RecoveryProvider` lives here
 * (not in app/_layout) so the selected-day state resets when the user leaves
 * the screen.
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
import { RecoveryProvider, useRecoveryContext } from "@/context/RecoveryContext";
import { useRecoveryData } from "@/hooks/useRecoveryData";
import { RecoveryScoreHero } from "@/components/recovery/RecoveryScoreHero";
import { RecoveryMetricsGrid } from "@/components/recovery/RecoveryMetricsGrid";
import { EnergyReserveCard } from "@/components/recovery/EnergyReserveCard";
import { RecoveryWhySection } from "@/components/recovery/RecoveryWhySection";
import { RecoveryImproveSection } from "@/components/recovery/RecoveryImproveSection";
import { TrackingHeroBackground } from "@/components/tracking/TrackingHeroBackground";
import { useTrackingHeroScroll } from "@/hooks/useTrackingHeroScroll";
import { colors, fontFamily, spacing } from "@/theme";

const DEFAULT_HERO_HEIGHT = 380;
const DEFAULT_HEADER_HEIGHT = 52;
const HEADER_FADE_EXTRA = 54;

export default function RecoveryScreen() {
  return (
    <RecoveryProvider>
      <RecoveryScreenInner />
    </RecoveryProvider>
  );
}

function RecoveryScreenInner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loading, week, day } = useRecoveryData();
  const { selectedDay, setSelectedDay } = useRecoveryContext();

  const [heroHeight, setHeroHeight] = React.useState(DEFAULT_HERO_HEIGHT);
  const onHeroLayout = React.useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h > 0) setHeroHeight(h);
  }, []);

  const [headerHeight, setHeaderHeight] = React.useState(DEFAULT_HEADER_HEIGHT);
  const onHeaderLayout = React.useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h > 0) setHeaderHeight(h);
  }, []);

  const { onScroll, gesture, heroLiftStyle, wallpaperStyle, headerBlurStyle } =
    useTrackingHeroScroll({ heroHeight });

  // Default to the most recent day with a recovery signal.
  const latestRecoveryDay = useQuery(api.recovery.getLatestRecoveryDay, {});
  const seeded = React.useRef(false);
  React.useEffect(() => {
    if (!seeded.current && latestRecoveryDay) {
      seeded.current = true;
      setSelectedDay(latestRecoveryDay);
    }
  }, [latestRecoveryDay, setSelectedDay]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.root}>
        <TrackingHeroBackground
          kind="recovery"
          height={headerHeight + heroHeight}
          animatedStyle={wallpaperStyle}
        />

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
              <View onLayout={onHeroLayout}>
                <RecoveryScoreHero
                  recovery={day?.recovery ?? null}
                  week={week}
                  hrvMs={day?.metrics.hrv ?? null}
                  restingHr={day?.metrics.rhr ?? null}
                  sleepScore={day?.sleepScore ?? null}
                />
              </View>

              <RecoveryMetricsGrid metrics={day?.metrics ?? null} />

              <EnergyReserveCard day={selectedDay} />

              <RecoveryWhySection />

              <RecoveryImproveSection />

              {loading && !day ? (
                <View style={styles.loadingHint}>
                  <Text style={styles.loadingText}>Loading your recovery data...</Text>
                </View>
              ) : null}
            </Animated.View>
          </Animated.ScrollView>
        </GestureDetector>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  root: { flex: 1, position: "relative", overflow: "hidden" },
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
  headerBlur: {
    position: "absolute",
    left: 0,
    right: 0,
    overflow: "hidden",
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  scroll: {
    paddingBottom: spacing.huge * 3,
  },
  loadingHint: { alignItems: "center", paddingVertical: spacing.xl },
  loadingText: { fontFamily: fontFamily.body, color: colors.textSecondary },
});
