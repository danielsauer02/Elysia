/**
 * RecoveryScoreHero
 *
 * Top hero of the /recovery screen — the recovery twin of SleepScoreHero:
 *
 *   1. RecoveryWeekDotsBar (M..S, today pinned on the right)
 *   2. BowGauge (creme → orange) with the score in the centre, plus a thin
 *      white qualitative label ("High" / "Moderate" / "Low") + coloured dot
 *   3. "ELYSIA RECOVERY SCORE" caps label
 *   4. Three SubKpiStat tiles — HRV · Resting HR · Sleep — each a large
 *      reading with its unit and a quality dot
 *
 * Pressing the hero opens /recovery-trend pinned to the selected day.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { BowGauge } from "@/components/ui";
import { RecoveryWeekDotsBar } from "./RecoveryWeekDotsBar";
import { SubKpiStat } from "./SubKpiStat";
import { useRecoveryContext } from "@/context/RecoveryContext";
import { colors, fontFamily, semantic, spacing } from "@/theme";

type RecoveryQuality = "high" | "moderate" | "low";

interface RecoveryLike {
  score: number;
  subHrv: number | null;
  subRhr: number | null;
  subSleep: number | null;
  quality: RecoveryQuality;
}

interface Props {
  recovery: RecoveryLike | null;
  week: Array<{ day: string; recovery: { quality: RecoveryQuality } | null }>;
  hrvMs: number | null;
  restingHr: number | null;
  sleepScore: number | null;
}

const DASH = "—";
// Creme → warm orange: the recovery-view bow (vs the sleep view's indigo).
const RECOVERY_BOW: readonly [string, string] = ["#F6E7C5", "#F2994A"];

function qualityLabel(q: RecoveryQuality): string {
  if (q === "high") return "High";
  if (q === "moderate") return "Moderate";
  return "Low";
}

function dotColorForScore(score: number | null): string | null {
  if (score === null || !Number.isFinite(score)) return null;
  if (score >= 80) return semantic.success;
  if (score >= 60) return "#FFFFFF";
  return semantic.destructive;
}

function fmtInt(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return DASH;
  return String(Math.round(v));
}

export function RecoveryScoreHero({
  recovery,
  week,
  hrvMs,
  restingHr,
  sleepScore,
}: Props) {
  const router = useRouter();
  const { selectedDay } = useRecoveryContext();
  const score = recovery?.score ?? null;
  const quality = recovery?.quality ?? null;

  return (
    <View style={styles.wrap}>
      <View style={styles.calendarGlass}>
        <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={styles.calendarGlassTint} />
        <View style={styles.calendarGlassInner}>
          <RecoveryWeekDotsBar week={week} />
        </View>
      </View>

      <Pressable
        onPress={() =>
          router.push({
            pathname: "/recovery-trend",
            params: { day: selectedDay },
          })
        }
        accessibilityRole="button"
        accessibilityLabel="Recovery score detail"
      >
        <Text style={styles.headingCaps}>ELYSIA RECOVERY SCORE</Text>

        <View style={styles.scoreCard}>
          <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={styles.scoreGlassTint} />
          <View style={styles.bowWrap}>
            <BowGauge
              value={score ?? 0}
              size={150}
              ticks={56}
              tickInnerRatio={0.88}
              tickWidth={2}
              gradient={RECOVERY_BOW}
              centre={
                <View style={styles.centre}>
                  <Text style={styles.scoreNumber}>
                    {score === null ? DASH : score}
                  </Text>
                  {quality ? (
                    <View style={styles.qualityRow}>
                      <Text style={styles.qualityLabel}>
                        {qualityLabel(quality)}
                      </Text>
                      <View
                        style={[
                          styles.qualityDot,
                          { backgroundColor: dotColorForScore(score) ?? "#FFF" },
                        ]}
                      />
                    </View>
                  ) : (
                    <Text style={styles.qualityLabelDim}>No data</Text>
                  )}
                </View>
              }
            />
          </View>
        </View>

        <View style={styles.subRow}>
          <SubKpiStat
            label="HRV"
            value={fmtInt(hrvMs)}
            unit="ms"
            dotColor={dotColorForScore(recovery?.subHrv ?? null)}
          />
          <SubKpiStat
            label="Resting HR"
            value={fmtInt(restingHr)}
            unit="bpm"
            dotColor={dotColorForScore(recovery?.subRhr ?? null)}
          />
          <SubKpiStat
            label="Sleep"
            value={fmtInt(sleepScore)}
            unit="%"
            dotColor={dotColorForScore(recovery?.subSleep ?? null)}
          />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxs,
  },
  calendarGlass: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.16)",
  },
  calendarGlassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10,15,28,0.28)",
  },
  calendarGlassInner: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  scoreCard: {
    alignSelf: "center",
    width: 184,
    height: 184,
    borderRadius: 26,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.16)",
  },
  scoreGlassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8,12,24,0.42)",
  },
  bowWrap: {
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateY: 14 }],
  },
  centre: { alignItems: "center", gap: 4 },
  scoreNumber: {
    fontFamily: fontFamily.monoBold,
    fontSize: 46,
    lineHeight: 52,
    color: colors.textPrimary,
    letterSpacing: -1.5,
    fontVariant: ["tabular-nums"],
  },
  qualityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: -2,
  },
  qualityLabel: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    color: colors.textPrimary,
    letterSpacing: 0.2,
    fontWeight: "300",
  },
  qualityLabelDim: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    color: colors.textTertiary,
  },
  qualityDot: { width: 6, height: 6, borderRadius: 3 },
  headingCaps: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 13,
    color: "#D7DDEC",
    letterSpacing: 2.4,
    fontWeight: "700",
    textAlign: "center",
    marginTop: spacing.xxxl,
    marginBottom: spacing.lg,
  },
  subRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: spacing.lg,
  },
});
