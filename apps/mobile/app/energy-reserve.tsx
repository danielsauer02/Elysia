/**
 * /energy-reserve
 *
 * Energy Reserve deep dive — the Bevel-style "body battery".
 *
 *   Battery (glowing, animated)  →  date + expandable calendar  →
 *   two tiles (total charged / total drained)  →  Summary  →
 *   energy-level curve  →  Today's Events log  →  About.
 */
import React, { useMemo, useRef, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavScrollHandler } from "@/hooks/useNavScrollHandler";
import { useOverscrollBounce } from "@/hooks/useOverscrollBounce";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { GlowyHeroCard } from "@/components/sleep/GlowyHeroCard";
import { AboutSleepScoreCard } from "@/components/sleep/AboutSleepScoreCard";
import { EnergyCurveChart } from "@/components/recovery/EnergyCurveChart";
import { EnergyBattery } from "@/components/recovery/EnergyBattery";
import {
  EnergyCalendarSheet,
  type EnergyCalendarSheetHandle,
} from "@/components/recovery/EnergyCalendar";
import { EnergyEventLog } from "@/components/recovery/EnergyEventLog";
import { ENERGY_GREEN, ENERGY_RED } from "@/components/recovery/energyColors";
import { floatingTabBarScrollPaddingBottom } from "@/constants/floatingTabBar";
import {
  borderTokens,
  colors,
  fontFamily,
  spacing,
  surface,
} from "@/theme";

const ABOUT_BODY =
  "Your Energy Reserve is a model of how much usable energy your body has left today, like a phone battery. It charges overnight from sleep — a fully restorative night tops you up, a poor one leaves you starting low. Across the day it drains slowly from baseline metabolism (about 2.5% per hour) and faster around workouts, scaled by how hard the session was. The curve is rebuilt from your real sleep and workout data each time, so the dips line up with what you actually did. Use it to time hard efforts when the reserve is high and protect rest when it's running low.";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const HEADER_HEIGHT = 44;
// Soft tail below the back button where the darkening fades out, mirroring the
// main tracking view's transparent fade header.
const HEADER_FADE_EXTRA = 54;

function formatDayLabel(day: string, today: string): string {
  const y = Number(day.slice(0, 4));
  const m0 = Number(day.slice(5, 7)) - 1;
  const d = Number(day.slice(8, 10));
  const base = `${MONTHS[m0]} ${d}`;
  if (day === today) return `Today, ${base}`;
  return `${base}, ${y}`;
}

function buildSummary(
  current: number,
  charged: number,
  drained: number
): string {
  const state =
    current > 50 ? "well charged" : current >= 0 ? "running a little low" : "depleted";
  return `Your reserve is ${state} at ${current}%. Last night's sleep charged it +${charged}%, and you've spent ${drained}% since waking.`;
}

export default function EnergyReserveScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string }>();
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [day, setDay] = useState<string>(
    (params.day as string | undefined) ?? todayIso
  );
  const calendarRef = useRef<EnergyCalendarSheetHandle>(null);
  const insets = useSafeAreaInsets();
  const { onScroll } = useNavScrollHandler();
  const bounceStyle = useOverscrollBounce();

  const data = useQuery(api.recovery.getEnergyReserve, { day });

  const chartWidth = Dimensions.get("window").width - spacing.lg * 2 - spacing.md * 2;
  const current = data?.current ?? null;

  const handleSelectDay = (d: string) => {
    setDay(d);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.root}>
        <Animated.View style={[styles.flex, bounceStyle] as never}>
          <Animated.ScrollView
            contentContainerStyle={[
              styles.scroll,
              {
                paddingTop: HEADER_HEIGHT,
                paddingBottom: floatingTabBarScrollPaddingBottom(insets.bottom),
              },
            ]}
            onScroll={onScroll}
            scrollEventThrottle={16}
            overScrollMode="never"
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
          {/* Title above the battery */}
          <Text style={styles.title}>Energy Reserve</Text>

          {/* Battery */}
          <View style={styles.batteryWrap}>
            <EnergyBattery level={current} />
          </View>

          {/* Date + calendar toggle */}
          <Pressable
            style={styles.dateRow}
            onPress={() => calendarRef.current?.present()}
            hitSlop={8}
          >
            <Text style={styles.dateText}>{formatDayLabel(day, todayIso)}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
          </Pressable>

          {/* Total charged / drained tiles */}
          <View style={styles.tilesRow}>
            <View style={styles.tile}>
              <Text style={[styles.tileValue, { color: ENERGY_GREEN }]}>
                +{data?.totalCharged ?? 0}%
              </Text>
              <Text style={styles.tileLabel}>Total charged</Text>
            </View>
            <View style={styles.tile}>
              <Text style={[styles.tileValue, { color: ENERGY_RED }]}>
                −{data?.totalDischarged ?? 0}%
              </Text>
              <Text style={styles.tileLabel}>Total drained</Text>
            </View>
          </View>

          {/* Summary */}
          {data ? (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Summary</Text>
              <Text style={styles.summaryBody}>
                {buildSummary(
                  data.current,
                  data.totalCharged,
                  data.totalDischarged
                )}
              </Text>
            </View>
          ) : null}

          {/* Energy-level curve */}
          <View>
            <Text style={styles.chartHeading}>{formatDayLabel(day, todayIso)}</Text>
            <Text style={styles.chartSubheading}>ENERGY LEVEL</Text>
            <GlowyHeroCard variant="deep" style={styles.chartCardPadding}>
              {!data ? (
                <Text style={styles.dataNote}>Loading…</Text>
              ) : data.samples.length < 2 ? (
                <Text style={styles.dataNote}>
                  Not enough of the day has elapsed yet to draw the reserve curve.
                </Text>
              ) : (
                <EnergyCurveChart
                  samples={data.samples}
                  events={data.events}
                  xStart={data.xStart}
                  xEnd={data.xEnd}
                  width={chartWidth}
                  height={240}
                />
              )}
            </GlowyHeroCard>
          </View>

          {/* Today's events */}
          {data ? (
            <View style={styles.eventsSection}>
              <Text style={styles.sectionHeading}>TODAY'S EVENTS</Text>
              <EnergyEventLog events={data.events} />
            </View>
          ) : null}

          <AboutSleepScoreCard title="About Energy Reserve" body={ABOUT_BODY} />
          </Animated.ScrollView>
        </Animated.View>

        {/* Transparent fade header — darkens toward the top, just the back
            button (mirrors the main tracking view). Content scrolls under it. */}
        <View style={styles.header} pointerEvents="box-none">
          <LinearGradient
            pointerEvents="none"
            colors={[
              "rgba(4,7,14,0.92)",
              "rgba(4,7,14,0.7)",
              "rgba(4,7,14,0.45)",
              "rgba(4,7,14,0.22)",
              "rgba(4,7,14,0.08)",
              "rgba(4,7,14,0)",
            ]}
            locations={[0, 0.25, 0.45, 0.65, 0.83, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[
              styles.headerFade,
              { top: -insets.top, height: insets.top + HEADER_HEIGHT + HEADER_FADE_EXTRA },
            ]}
          />
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>

        <EnergyCalendarSheet ref={calendarRef} selectedDay={day} onSelect={handleSelectDay} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  root: { flex: 1, position: "relative" },
  flex: { flex: 1 },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    height: HEADER_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    backgroundColor: "transparent",
  },
  headerFade: { position: "absolute", left: 0, right: 0 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: {
    fontFamily: fontFamily.heading,
    fontSize: 20,
    color: colors.textPrimary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  batteryWrap: { alignItems: "center", paddingTop: spacing.md, paddingBottom: spacing.xs },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  dateText: { fontFamily: fontFamily.bodyMedium, fontSize: 15, color: colors.textSecondary },
  tilesRow: { flexDirection: "row", gap: spacing.sm },
  tile: {
    flex: 1,
    backgroundColor: surface.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: 4,
  },
  tileValue: {
    fontFamily: fontFamily.heading,
    fontSize: 24,
    fontVariant: ["tabular-nums"],
  },
  tileLabel: { fontFamily: fontFamily.body, fontSize: 12, color: colors.textSecondary },
  summaryCard: {
    backgroundColor: surface.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    padding: spacing.md,
    gap: 6,
  },
  summaryLabel: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    color: colors.textTertiary,
    letterSpacing: 0.4,
  },
  summaryBody: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  chartHeading: {
    fontFamily: fontFamily.heading,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: 1,
  },
  chartSubheading: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  chartCardPadding: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  eventsSection: { gap: spacing.sm },
  sectionHeading: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    letterSpacing: 1.6,
    color: "#FFFFFF",
    opacity: 0.85,
  },
  dataNote: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
});
