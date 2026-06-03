/**
 * SleepStageTile
 *
 * One tile of the 2x2 stage grid, homogeneous with the Section-1 score
 * card. Layout:
 *
 *   ◯ AWAKE                 ← white ring (the toggle) + stage name
 *   0:41                    ← value h:mm (Section-1 KPI font)
 *   10%                     ← percent in the stage colour
 *   ███████░░|╌╌|░░░        ← WhoopStageBar (normal or exploded)
 *
 * Selection is driven by tapping the WHITE CIRCLE (not the whole tile):
 *   • empty ring  → not selected
 *   • filled ring → selected; the bar of every tile "explodes" into the
 *     night timeline and this tile stays bright while the others dim.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { WhoopStageBar, type ExplosionSegment } from "@/components/ui";
import { fmtHourMin, fmtPctOfTotal } from "@/constants/sleepStages";
import {
  borderTokens,
  colors,
  fontFamily,
  spacing,
  surface,
} from "@/theme";
import type { SleepStageId } from "@/context/SleepContext";

interface Props {
  stage: SleepStageId;
  label: string;
  color: string;
  minutes: number | null;
  totalMinutes: number | null;
  typicalRange?: [number, number] | null; // minutes
  isSelected: boolean;
  /** Any stage is selected → all bars explode; this tile dims if not the one. */
  anySelected: boolean;
  dim: boolean;
  onToggle: () => void;
  // Explosion data
  segments?: ExplosionSegment[];
  nightStart?: number;
  nightEnd?: number;
}

export function SleepStageTile({
  color,
  label,
  minutes,
  totalMinutes,
  typicalRange,
  isSelected,
  anySelected,
  dim,
  onToggle,
  segments,
  nightStart,
  nightEnd,
}: Props) {
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    opacity.value = withTiming(dim ? 0.45 : 1, { duration: 220 });
  }, [dim, opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.card, animStyle]}>
        <View style={styles.headerRow}>
          <Pressable onPress={onToggle} hitSlop={10} style={styles.ringHit}>
            <View
              style={[
                styles.ring,
                { borderColor: isSelected ? color : "rgba(255,255,255,0.6)" },
              ]}
            >
              {isSelected ? (
                <View style={[styles.ringDot, { backgroundColor: color }]} />
              ) : null}
            </View>
          </Pressable>
          <Text style={styles.label}>{label}</Text>
        </View>

        <Text style={styles.value}>{fmtHourMin(minutes)}</Text>
        <Text style={[styles.pct, { color }]}>
          {fmtPctOfTotal(minutes, totalMinutes)}
        </Text>

        <View style={styles.barWrap}>
          <WhoopStageBar
            value={minutes ?? 0}
            max={totalMinutes ?? 0}
            color={color}
            typicalRange={typicalRange ?? null}
            width={132}
            height={18}
            exploded={anySelected}
            segments={segments}
            nightStart={nightStart}
            nightEnd={nightEnd}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  card: {
    backgroundColor: surface.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    padding: spacing.md,
    gap: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ringHit: {
    padding: 2,
  },
  ring: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  ringDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  value: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 24,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.5,
  },
  pct: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  barWrap: {
    marginTop: 6,
  },
});
