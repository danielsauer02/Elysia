/**
 * SleepStagesSection
 *
 * Bevel-style stage block:
 *   1. hypnogram chart (glowy hero-card surface, stepped line)
 *   2. bedtime / wake-time pills directly BELOW the chart window
 *   3. a legend row — "Typical range" (left) + total "Duration h:mm"
 *      (right), in one shared muted style
 *   4. a 2x2 tile grid in Bevel order: Awake, REM, Light, Deep
 *
 * The hypnogram is built once here (real timeline when available, a
 * representative cycle shape from the Whoop totals otherwise) and shared
 * with both the chart and the tiles' explosion view, so selecting a
 * stage lights up the same intervals everywhere.
 */
import React, { useMemo } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SleepStagesChart } from "./SleepStagesChart";
import { SleepStageTile } from "./SleepStageTile";
import { useSleepContext } from "@/context/SleepContext";
import { buildHypnogram, type HypnoSegment } from "@/lib/hypnogram";
import {
  GRID_ORDER,
  STAGE_COLORS,
  STAGE_LABELS,
  fmtClock,
  fmtHourMin,
  typicalRangeMinutes,
} from "@/constants/sleepStages";
import { colors, fontFamily, spacing } from "@/theme";
import type { SleepStageId } from "@/context/SleepContext";

interface SegmentRow {
  stage: string;
  start: string;
  end: string;
  minutes: number;
}

interface Props {
  segments: SegmentRow[];
  primaryStart: string | null;
  primaryEnd: string | null;
  totals: {
    deepMinutes: number | null;
    remMinutes: number | null;
    lightMinutes: number | null;
    awakeMinutes: number | null;
  };
}

function minutesFor(stage: SleepStageId, totals: Props["totals"]): number | null {
  switch (stage) {
    case "awake":
      return totals.awakeMinutes;
    case "rem":
      return totals.remMinutes;
    case "light":
      return totals.lightMinutes;
    case "deep":
      return totals.deepMinutes;
  }
}

export function SleepStagesSection({ segments, primaryStart, primaryEnd, totals }: Props) {
  const { selectedStage, toggleStage } = useSleepContext();
  const width = Dimensions.get("window").width - spacing.lg * 2;

  const totalAll =
    (totals.deepMinutes ?? 0) +
    (totals.remMinutes ?? 0) +
    (totals.lightMinutes ?? 0) +
    (totals.awakeMinutes ?? 0);
  const hasTotal = totalAll > 0;

  const nightStart = primaryStart ? Date.parse(primaryStart) : NaN;
  const nightEnd = primaryEnd ? Date.parse(primaryEnd) : NaN;

  const built = useMemo(
    () => buildHypnogram(segments, primaryStart, primaryEnd, totals),
    [segments, primaryStart, primaryEnd, totals]
  );

  // Per-stage segment lists for the tile explosion view.
  const segmentsByStage = useMemo(() => {
    const map: Record<SleepStageId, HypnoSegment[]> = {
      awake: [],
      rem: [],
      light: [],
      deep: [],
    };
    for (const s of built.segments) map[s.stage].push(s);
    return map;
  }, [built]);

  const rows: SleepStageId[][] = [
    [GRID_ORDER[0]!, GRID_ORDER[1]!],
    [GRID_ORDER[2]!, GRID_ORDER[3]!],
  ];

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Sleep stages</Text>
      </View>

      <View style={{ paddingHorizontal: spacing.lg }}>
        <SleepStagesChart
          segments={built.segments}
          nightStart={nightStart}
          nightEnd={nightEnd}
          selectedStage={selectedStage}
          width={width}
        />

        {/* Bedtime / wake-time pills below the chart window */}
        {Number.isFinite(nightStart) && Number.isFinite(nightEnd) ? (
          <View style={styles.timeRow}>
            <View style={styles.timePill}>
              <Ionicons name="moon" size={10} color={colors.textSecondary} />
              <Text style={styles.timeText}>{fmtClock(primaryStart)}</Text>
            </View>
            <View style={styles.timePill}>
              <Ionicons name="sunny" size={10} color={colors.textPrimary} />
              <Text style={styles.timeText}>{fmtClock(primaryEnd)}</Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Legend + duration (one shared muted style) */}
      <View style={styles.legendRow}>
        <View style={styles.legendLeft}>
          <View style={styles.legendBox} />
          <Text style={styles.metaText}>Typical range</Text>
        </View>
        {hasTotal ? (
          <Text style={styles.metaText}>
            Duration{"  "}
            <Text style={styles.metaStrong}>{fmtHourMin(totalAll)}</Text>
          </Text>
        ) : null}
      </View>

      <View style={styles.grid}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.row}>
            {row.map((stage) => (
              <SleepStageTile
                key={stage}
                stage={stage}
                label={STAGE_LABELS[stage]}
                color={STAGE_COLORS[stage]}
                minutes={minutesFor(stage, totals)}
                totalMinutes={totalAll}
                typicalRange={hasTotal ? typicalRangeMinutes(stage, totalAll) : null}
                isSelected={selectedStage === stage}
                anySelected={selectedStage !== null}
                dim={selectedStage !== null && selectedStage !== stage}
                onToggle={() => toggleStage(stage)}
                segments={segmentsByStage[stage]}
                nightStart={Number.isFinite(nightStart) ? nightStart : undefined}
                nightEnd={Number.isFinite(nightEnd) ? nightEnd : undefined}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  header: { paddingHorizontal: spacing.lg },
  title: {
    fontFamily: fontFamily.heading,
    fontSize: 18,
    color: colors.textPrimary,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  timePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  timeText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
  },
  legendLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendBox: {
    width: 22,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    borderStyle: "dashed",
  },
  // Typical range + Duration share this exact style (colour + font).
  metaText: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    color: colors.textTertiary,
  },
  metaStrong: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  grid: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  row: { flexDirection: "row", gap: spacing.sm },
});
