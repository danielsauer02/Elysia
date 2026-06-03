/**
 * /chronotype — Chronotype deep-dive
 *
 * Oura-style explainer page for the user's classified chronotype. An
 * idyllic soft-bubble background frames the type description and a
 * positively-framed action statement, followed by the optimal sleep
 * schedule (body-clock wheel, optimal window only + Asleep/Midpoint/Awake)
 * and two educational sections.
 */
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { GlowyHeroCard } from "@/components/sleep/GlowyHeroCard";
import { BodyClockWheel } from "@/components/sleep/BodyClockWheel";
import {
  CHRONOTYPE_COPY,
  HOW_BODY,
  HOW_TITLE,
  LIGHT_BODY,
  LIGHT_TITLE,
  WHY_BODY,
  WHY_TITLE,
} from "@/components/sleep/chronotypeCopy";
import type { ChronotypeClass } from "@/components/sleep/ChronotypeCard";
import {
  borderTokens,
  colors,
  dataColors,
  fontFamily,
  spacing,
} from "@/theme";

const WHEEL = 260;

function formatHour(h: number | null): string {
  if (h === null || !Number.isFinite(h)) return "—";
  const whole = Math.floor(h);
  const m = Math.round((h - whole) * 60);
  const hh = (whole + Math.floor(m / 60)) % 24;
  const mm = m % 60;
  const ampm = hh < 12 ? "AM" : "PM";
  const display = ((hh + 11) % 12) + 1;
  return `${display}:${mm.toString().padStart(2, "0")} ${ampm}`;
}

export default function ChronotypeDeepDive() {
  const router = useRouter();
  const data = useQuery(api.sleep.getChronotype, {});

  const klass = (data?.class ?? "calibrating") as ChronotypeClass;
  const copy = klass !== "calibrating" ? CHRONOTYPE_COPY[klass] : null;
  const optimal = data?.optimal ?? null;

  const schedule = useMemo(
    () => ({
      asleep: formatHour(optimal?.asleepHour ?? null),
      midpoint: formatHour(optimal?.midpointHour ?? null),
      awake: formatHour(optimal?.awakeHour ?? null),
    }),
    [optimal]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Idyllic backdrop */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient
          colors={["#171B3A", "#0B0F1E", colors.background]}
          locations={[0, 0.4, 0.85]}
          style={StyleSheet.absoluteFill}
        />
        <Svg width="100%" height={360} style={{ position: "absolute", top: 0 }}>
          <Defs>
            <RadialGradient id="bubble" cx="50%" cy="38%" r="55%">
              <Stop offset="0" stopColor="#A78BFA" stopOpacity={0.42} />
              <Stop offset="0.55" stopColor="#7C6CF0" stopOpacity={0.14} />
              <Stop offset="1" stopColor="#7C6CF0" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx="58%" cy="150" r="150" fill="url(#bubble)" />
        </Svg>
      </View>

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Chronotype</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {copy ? (
          <>
            <View style={styles.introBlock}>
              <Text style={styles.typeKicker}>{copy.label.toUpperCase()}</Text>
              <Text style={styles.tagline}>{copy.tagline}</Text>
              <Text style={styles.paragraph}>{copy.description}</Text>
            </View>

            <View style={styles.block}>
              <Text style={styles.subhead}>{LIGHT_TITLE}</Text>
              <Text style={styles.paragraph}>{LIGHT_BODY}</Text>
            </View>

            <View style={styles.divider} />
            <Text style={styles.statement}>{copy.statement}</Text>
            <View style={styles.divider} />

            <Text style={styles.scheduleHead}>Optimal sleep schedule for you</Text>
            <GlowyHeroCard variant="deep" style={styles.scheduleCard}>
              <View style={styles.wheelWrap}>
                <BodyClockWheel size={WHEEL} optimal={optimal} mode="optimalOnly" />
              </View>
              <View style={styles.scheduleRow}>
                <ScheduleCol label="Asleep" value={schedule.asleep} />
                <ScheduleCol label="Midpoint" value={schedule.midpoint} />
                <ScheduleCol label="Awake" value={schedule.awake} />
              </View>
            </GlowyHeroCard>

            <View style={styles.divider} />

            <View style={styles.block}>
              <Text style={styles.subhead}>{HOW_TITLE}</Text>
              <Text style={styles.paragraph}>{HOW_BODY}</Text>
            </View>
            <View style={styles.block}>
              <Text style={styles.subhead}>{WHY_TITLE}</Text>
              <Text style={styles.paragraph}>{WHY_BODY}</Text>
            </View>
          </>
        ) : (
          <View style={styles.introBlock}>
            <Text style={styles.tagline}>Still learning your rhythm</Text>
            <Text style={styles.paragraph}>
              Elysia needs at least {data?.daysRequired ?? 14} nights of sleep
              data to classify your chronotype. Keep logging your nights and
              your type — plus your optimal sleep schedule — will appear here.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ScheduleCol({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.scheduleCol}>
      <Text style={styles.scheduleColLabel}>{label}</Text>
      <Text style={styles.scheduleColValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: fontFamily.heading, fontSize: 17, color: colors.textPrimary },

  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.huge * 2,
    gap: spacing.lg,
  },
  introBlock: { gap: spacing.sm, marginTop: spacing.xl },
  block: { gap: spacing.xs },
  typeKicker: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    letterSpacing: 1.4,
    color: colors.textSecondary,
  },
  tagline: {
    fontFamily: fontFamily.heading,
    fontSize: 26,
    lineHeight: 32,
    color: colors.textPrimary,
  },
  subhead: {
    fontFamily: fontFamily.heading,
    fontSize: 18,
    color: colors.textPrimary,
  },
  paragraph: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: borderTokens.subtle,
  },
  statement: {
    fontFamily: fontFamily.heading,
    fontSize: 22,
    lineHeight: 28,
    textAlign: "center",
    color: dataColors.sleep.base,
    paddingHorizontal: spacing.md,
  },
  scheduleHead: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 15,
    color: colors.textPrimary,
    textAlign: "center",
  },
  scheduleCard: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.lg,
  },
  wheelWrap: { alignItems: "center", justifyContent: "center" },
  scheduleRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: borderTokens.subtle,
    paddingTop: spacing.md,
  },
  scheduleCol: { alignItems: "center", gap: 4 },
  scheduleColLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    color: colors.textTertiary,
  },
  scheduleColValue: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 15,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
});
