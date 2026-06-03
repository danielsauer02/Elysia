/**
 * SleepScoreHero
 *
 * Top hero of the /sleep screen, modelled 1:1 on Eight Sleep's home
 * "Sleep Fitness Score" card:
 *
 *   1. WeekDotsBar (M..S, today pinned on the right)
 *   2. BowGauge with the score in the centre, plus a thin white
 *      qualitative label ("Optimal" / "In range" / "Poor") followed by
 *      a coloured dot (green/white/red)
 *   3. "ELYSIA SLEEP SCORE" caps label + relative date ("Today",
 *      "Yesterday" or the actual day)
 *   4. A contrasting card containing 3 sub-KPI tiles, in the explicit
 *      order Time slept · Quality · Consistency, each with a Bevel-style
 *      coloured progress strip beneath the value
 *
 * The hero is `Pressable` and navigates to /sleep-trend with the
 * currently selected day as a query param so the trend view can pin the
 * correct date.
 *
 * Time-slept strip normalisation: 100% of the bar = the age-banded
 * optimal sleep target (NSF guidance). The visible value (e.g.
 * "9h 44m") is unchanged — only the bar fill % is age-normalised.
 */
import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { BowGauge } from "@/components/ui";
import { WeekDotsBar } from "./WeekDotsBar";
import { SubKpiBar } from "./SubKpiBar";
import { useSleepContext } from "@/context/SleepContext";
import {
  colors,
  dataColors,
  fontFamily,
  semantic,
  spacing,
} from "@/theme";

type Quality = "optimal" | "in_range" | "poor";

interface FitnessLike {
  score: number;
  subTime: number;
  subQuality: number | null;
  subConsistency: number | null;
  quality: Quality;
}

interface Props {
  fitness: FitnessLike | null;
  week: Array<{ day: string; fitness: { quality: Quality } | null }>;
  asleepMinutes: number | null;
}

const DASH = "—";

function qualityLabel(q: Quality): string {
  if (q === "optimal") return "Optimal";
  if (q === "in_range") return "In range";
  return "Poor";
}

function qualityDotColor(q: Quality): string {
  if (q === "optimal") return semantic.success;
  if (q === "poor") return semantic.destructive;
  return "#FFFFFF";
}

function fmtHm(min: number | null): string {
  if (min === null || !Number.isFinite(min) || min <= 0) return DASH;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function fmtPct(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return DASH;
  return `${Math.round(n)}%`;
}

export function SleepScoreHero({ fitness, week, asleepMinutes }: Props) {
  const router = useRouter();
  const { selectedDay } = useSleepContext();
  const score = fitness?.score ?? null;
  const quality = fitness?.quality ?? null;

  // The bar fill mirrors the backend's non-linear time-vs-target score,
  // so the hero and the trend D-view stay in lockstep. The "9h 44m"
  // text above the bar still shows raw clock time.
  const timeSleptPct = fitness?.subTime ?? null;

  return (
    <View style={styles.wrap}>
      {/* Calendar in a frosted-glass panel so the weekdays stay legible
          over the bright wallpaper. */}
      <View style={styles.calendarGlass}>
        <BlurView
          intensity={24}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={styles.calendarGlassTint} />
        <View style={styles.calendarGlassInner}>
          <WeekDotsBar week={week} />
        </View>
      </View>

      <Pressable
        onPress={() =>
          router.push({
            pathname: "/sleep-trend",
            params: { day: selectedDay },
          })
        }
        accessibilityRole="button"
        accessibilityLabel="Sleep score detail"
      >
        {/* Heading sits ABOVE the card now (out of the box), bold, with a
            clear gap down to the bow. */}
        <Text style={styles.headingCaps}>ELYSIA SLEEP SCORE</Text>

        {/* Compact, square glass card (frosted like the calendar, a touch
            darker, still translucent) holding just the bow, score and the
            qualitative indicator — vertically centred. */}
        <View style={styles.scoreCard}>
          <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={styles.scoreGlassTint} />
          {/* translateY nudges the bow's visible cluster (arc sits in the top
              half, leaving empty space below) into the card's vertical centre. */}
          <View style={styles.bowWrap}>
          <BowGauge
            value={score ?? 0}
            size={150}
            ticks={56}
            tickInnerRatio={0.88}
            tickWidth={2}
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
                        { backgroundColor: qualityDotColor(quality) },
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
          <SubKpi
            label="Time slept"
            value={fmtHm(asleepMinutes)}
            score={timeSleptPct}
          />
          <SubKpi
            label="Quality"
            value={fmtPct(fitness?.subQuality ?? null)}
            score={fitness?.subQuality ?? null}
          />
          <SubKpi
            label="Consistency"
            value={fmtPct(fitness?.subConsistency ?? null)}
            score={fitness?.subConsistency ?? null}
          />
        </View>
      </Pressable>
    </View>
  );
}

function dotColorForScore(score: number | null): string | null {
  if (score === null || !Number.isFinite(score)) return null;
  if (score >= 80) return semantic.success;
  if (score >= 60) return "#FFFFFF";
  return semantic.destructive;
}

function SubKpi({
  label,
  value,
  score,
}: {
  label: string;
  value: string;
  score: number | null;
}) {
  // The strip itself carries the qualitative colour (green/white/red) — the
  // separate label dot is dropped for these three tiles.
  const barColor = dotColorForScore(score) ?? "rgba(255,255,255,0.9)";
  return (
    <View style={styles.subKpi}>
      <View style={styles.subKpiLabelRow}>
        <Text style={styles.subKpiLabel}>{label}</Text>
      </View>
      <Text style={styles.subKpiValue}>{value}</Text>
      <SubKpiBar value={score} height={9} color={barColor} />
    </View>
  );
}

// Glassy indigo-tinted tile that reads cleanly whether it sits over the
// wallpaper or over the faded-to-black bottom of the hero.
const TILE_BG = "rgba(31, 39, 66, 0.62)";

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    // Calendar sits a touch higher now that the wallpaper begins behind the
    // header (score block stays put via the heading's larger top margin).
    paddingTop: spacing.xxs,
  },
  // ── Calendar glass ──────────────────────────────────────────────
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
  // ── Score card (frosted glass, square, vertically centred) ──────
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
  // A touch darker than the calendar glass for more contrast on the hero.
  scoreGlassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8,12,24,0.42)",
  },
  bowWrap: {
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateY: 14 }],
  },
  centre: {
    alignItems: "center",
    gap: 4,
  },
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
  qualityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headingCaps: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 13,
    color: "#D7DDEC",
    letterSpacing: 2.4,
    fontWeight: "700",
    textAlign: "center",
    // Push the score block down from the (now higher) calendar and open a
    // ~1cm gap to the bow below — keeps the score/sub-KPIs at the same spot.
    marginTop: spacing.xxxl,
    marginBottom: spacing.lg,
  },
  subRow: {
    flexDirection: "row",
    gap: 8,
    // Push the sub-KPIs a touch lower, below the score card.
    marginTop: spacing.lg,
  },
  subKpi: {
    flex: 1,
    gap: 8,
    paddingTop: spacing.sm,
    paddingBottom: 10,
    paddingHorizontal: spacing.sm,
    backgroundColor: TILE_BG,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  subKpiLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  subKpiLabel: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    color: "#FFFFFF",
    opacity: 0.92,
  },
  subKpiValue: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 16,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
});

void dataColors;
