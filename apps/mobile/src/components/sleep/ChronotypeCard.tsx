/**
 * ChronotypeCard — Section 6 of the sleep deep-dive.
 *
 * Oura-style body-clock hero: a 24h dial showing the chronotype's optimal
 * sleep window (inner band) against last night's recorded sleep (outer
 * ring, broken where awake). Below sit a "Sleep alignment" verdict and a
 * tappable chronotype tile that opens the /chronotype deep-dive page.
 *
 * While calibrating (<14 nights) we still draw last night's arc if we have
 * it and show how many more nights are needed.
 */
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { GlowyHeroCard } from "./GlowyHeroCard";
import { BodyClockWheel, type WheelActual } from "./BodyClockWheel";
import { CHRONOTYPE_COPY } from "./chronotypeCopy";
import {
  borderTokens,
  colors,
  fontFamily,
  semantic,
  spacing,
} from "@/theme";

export type ChronotypeClass =
  | "calibrating"
  | "early_morning"
  | "morning"
  | "late_morning"
  | "early_evening"
  | "evening"
  | "late_evening";

export type Alignment = "aligned" | "slightly_off" | "off";

interface ChronoData {
  class: ChronotypeClass;
  midpointHour: number | null;
  asleepHour: number | null;
  awakeHour: number | null;
  optimal: { asleepHour: number; midpointHour: number; awakeHour: number } | null;
  daysCounted: number;
  daysRequired: number;
  alignment: Alignment | null;
  lastNightDeltaHours: number | null;
}

interface Props {
  data: ChronoData | null;
  primaryStart: string | null;
  primaryEnd: string | null;
  segments: { stage: string; start: string; end: string }[];
}

const WHEEL = 248;

/** UTC clock-hour of an ISO timestamp (matches the chronotype maths). */
function hourOf(iso: string): number {
  const d = new Date(iso);
  return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
}

function midpointOf(startIso: string, endIso: string): number {
  const s = Date.parse(startIso);
  const e = Date.parse(endIso);
  const m = new Date(s + (e - s) / 2);
  return m.getUTCHours() + m.getUTCMinutes() / 60 + m.getUTCSeconds() / 3600;
}

const ALIGN_WORD: Record<Alignment, string> = {
  aligned: "Aligned",
  slightly_off: "Slightly off",
  off: "Off",
};

const ALIGN_BODY: Record<Alignment, string> = {
  aligned: "The midpoint of your sleep was aligned with your chronotype.",
  slightly_off:
    "Your sleep midpoint drifted a little from your chronotype last night.",
  off: "Your sleep midpoint sat well outside your chronotype last night.",
};

function alignColor(a: Alignment): string {
  if (a === "aligned") return semantic.success;
  if (a === "slightly_off") return semantic.warning;
  return semantic.destructive;
}

export function ChronotypeCard({ data, primaryStart, primaryEnd, segments }: Props) {
  const router = useRouter();

  const calibrating = !data || data.class === "calibrating";
  const klass = data?.class ?? "calibrating";
  const copy = klass !== "calibrating" ? CHRONOTYPE_COPY[klass] : null;

  const actual = useMemo<WheelActual | null>(() => {
    if (!primaryStart || !primaryEnd) return null;
    return {
      asleepHour: hourOf(primaryStart),
      awakeHour: hourOf(primaryEnd),
      midpointHour: midpointOf(primaryStart, primaryEnd),
      // Only genuine short wake intervals break the ring. Whoop ships
      // *aggregate* stage rows where the "awake" entry spans the whole
      // night — those must NOT carve out the entire arc, so we drop any
      // break longer than ~2h (and zero/negative ones).
      breaks: segments
        .filter((s) => s.stage === "awake")
        .map((s) => ({
          from: hourOf(s.start),
          to: hourOf(s.end),
          durH: (Date.parse(s.end) - Date.parse(s.start)) / 3_600_000,
        }))
        .filter((b) => b.durH > 0 && b.durH <= 2)
        .map(({ from, to }) => ({ from, to })),
    };
  }, [primaryStart, primaryEnd, segments]);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Chronotype</Text>
      </View>

      <View style={styles.body}>
        <GlowyHeroCard variant="deep" style={styles.hero}>
          <View style={styles.wheelWrap}>
            <BodyClockWheel
              size={WHEEL}
              optimal={data?.optimal ?? null}
              actual={actual}
              mode="dual"
            />
          </View>
        </GlowyHeroCard>

        {!calibrating && data?.alignment ? (
          <View style={styles.alignCard}>
            <Text style={styles.alignLabel}>Sleep alignment</Text>
            <View style={styles.alignHeadlineRow}>
              <Text style={styles.alignHeadline}>
                {ALIGN_WORD[data.alignment]}
              </Text>
              <View
                style={[styles.alignDot, { backgroundColor: alignColor(data.alignment) }]}
              />
            </View>
            <Text style={styles.alignBody}>{ALIGN_BODY[data.alignment]}</Text>
          </View>
        ) : (
          <View style={styles.alignCard}>
            <Text style={styles.alignLabel}>Sleep alignment</Text>
            <Text style={styles.alignBody}>
              Calibrating — {Math.max(0, (data?.daysRequired ?? 14) - (data?.daysCounted ?? 0))}{" "}
              more nights of sleep data needed to learn your chronotype.
            </Text>
          </View>
        )}

        {copy ? (
          <Pressable
            style={styles.typeTile}
            onPress={() => router.push("/chronotype")}
          >
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.textTertiary}
              style={styles.typeChevron}
            />
            <View style={styles.typeTextCol}>
              <Text style={styles.typeLabel}>{copy.label}</Text>
              <Text style={styles.typeDesc}>{copy.shortDesc}</Text>
            </View>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xxl, gap: spacing.md },
  header: { paddingHorizontal: spacing.lg },
  title: {
    fontFamily: fontFamily.heading,
    fontSize: 18,
    color: colors.textPrimary,
  },
  body: { paddingHorizontal: spacing.lg, gap: spacing.md },
  hero: {
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  wheelWrap: { alignItems: "center", justifyContent: "center" },

  alignCard: {
    backgroundColor: "#0A0F1C",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 4,
  },
  alignLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  alignHeadlineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  alignHeadline: {
    fontFamily: fontFamily.heading,
    fontSize: 22,
    color: colors.textPrimary,
  },
  alignDot: { width: 8, height: 8, borderRadius: 4 },
  alignBody: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  typeTile: {
    backgroundColor: "#0A0F1C",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  typeChevron: { position: "absolute", top: 10, right: 12 },
  typeTextCol: { gap: 3, paddingRight: spacing.lg },
  typeLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  typeDesc: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
});
