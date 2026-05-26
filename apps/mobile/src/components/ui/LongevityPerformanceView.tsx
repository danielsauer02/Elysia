/**
 * LongevityPerformanceView (v1.2.0 — Longevity Wheel redesign)
 *
 * Replaces the WHOOP-style orb + waterfall with:
 *   - TierBadge (top-left, → paywall)
 *   - LongevityWheel (6 SVG rings + center battery)
 *   - LongevityContributionsView (driver/drain columns, opened from center)
 *   - LayerDetailSheet (bottom sheet, opened from a ring tap)
 *   - Habits chip (consistency lives outside the wheel)
 *   - Calibration banner still surfaces during the 14-day warm-up.
 *
 * Existing prop contract preserved so dashboard.tsx wiring is unchanged.
 */

import React, { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Ionicons as IoniconsType } from "@expo/vector-icons";
import { colors, radii, spacing } from "@/theme";
import { LongevityWheel } from "@/components/longevity/LongevityWheel";
import {
  LayerDetailSheet,
  type LayerDetailSheetHandle,
} from "@/components/longevity/LayerDetailSheet";
import { LongevityContributionsView } from "@/components/longevity/LongevityContributionsView";
import { TierBadge } from "@/components/longevity/TierBadge";
import {
  LongevityAdviceSheet,
  type LongevityAdviceSheetHandle,
} from "@/components/longevity/LongevityAdviceSheet";
import {
  type PillarId,
  type WheelLayerId,
} from "@/lib/displayLayers";

// ─── Types (preserved for dashboard wiring) ────────────────────────────────

export type TimeFilter = "daily" | "weekly" | "monthly" | "6months" | "all";

export interface LongevityContribution {
  category: string;
  label: string;
  deltaMinutes: number;
  icon: keyof typeof IoniconsType.glyphMap;
}

export interface LockedPillar {
  category: string;
  label: string;
  tier: 2 | 3;
  icon: keyof typeof IoniconsType.glyphMap;
}

interface LongevityPerformanceViewProps {
  /** Latest Elysia Age (years). Used only by trajectory tab; surfaced here as a small caption. */
  elysiaAge: number;
  contributions: LongevityContribution[];
  timeFilter: TimeFilter;
  lockedPillars?: LockedPillar[];
  calibrationDaysCompleted?: number;
  calibrationDaysRequired?: number;
  /** v1.2.0 inputs from useLongevityData. */
  layerScores?: Partial<Record<WheelLayerId, number | null>>;
  pillarScores?: Partial<Record<PillarId, number | null>>;
  composite?: number;
  healthspanCreditsToday?: number;
  trajectoryStatus?: "improving" | "stable" | "declining";
  rationaleByPillar?: Record<string, string>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatMinutes(min: number): string {
  const abs = Math.abs(min);
  const sign = min >= 0 ? "+" : "−";
  if (abs < 60) return `${sign}${Math.round(abs)}m`;
  const h = Math.floor(abs / 60);
  const m = Math.round(abs % 60);
  return m > 0 ? `${sign}${h}h${m}m` : `${sign}${h}h`;
}

// ─── Component ──────────────────────────────────────────────────────────────

function LongevityPerformanceViewInner({
  contributions,
  layerScores,
  pillarScores,
  composite,
  healthspanCreditsToday,
  calibrationDaysCompleted,
  calibrationDaysRequired,
  rationaleByPillar,
}: LongevityPerformanceViewProps) {
  const [showContributions, setShowContributions] = useState(false);
  const sheetRef = useRef<LayerDetailSheetHandle>(null);
  const adviceRef = useRef<LongevityAdviceSheetHandle>(null);

  const isCalibrating =
    calibrationDaysRequired !== undefined &&
    calibrationDaysCompleted !== undefined &&
    calibrationDaysCompleted < calibrationDaysRequired;

  const onLayerPress = useCallback((id: WheelLayerId) => {
    sheetRef.current?.present(id);
  }, []);

  const credits = healthspanCreditsToday ?? 0;

  return (
    <View style={styles.container}>
      {/* Tier badge alone — the trajectory status chip has been retired. */}
      <View style={styles.headerRow}>
        <TierBadge level={1} />
      </View>

      {isCalibrating ? (
        <View style={styles.calibrationBanner}>
          <Ionicons name="sparkles-outline" size={14} color={colors.accent} />
          <Text style={styles.calibrationText}>
            Calibrating — day {calibrationDaysCompleted} of {calibrationDaysRequired}. Wheel
            unlocks once we&apos;ve learned your baseline.
          </Text>
        </View>
      ) : null}

      {/* Wheel OR contributions, swapped via center-tap */}
      {showContributions ? (
        <View>
          <Pressable
            style={styles.backRow}
            onPress={() => setShowContributions(false)}
          >
            <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
            <Text style={styles.backLabel}>Back to wheel</Text>
          </Pressable>
          <LongevityContributionsView
            contributions={contributions}
            rationaleByPillar={rationaleByPillar}
          />
        </View>
      ) : (
        <View style={styles.wheelWrap}>
          <LongevityWheel
            layerScores={layerScores ?? {}}
            composite={composite ?? null}
            calibrating={isCalibrating}
            onLayerPress={onLayerPress}
            onCenterPress={() => setShowContributions(true)}
          />
          <Text style={styles.batteryLabel}>LONGEVITY BATTERY</Text>
          {credits !== 0 ? (
            <Text style={styles.creditsCaption}>
              {formatMinutes(credits)} lifespan gained today
            </Text>
          ) : null}
        </View>
      )}

      {/* Replaces the Consistency pill: opens an AI-generated advice sheet. */}
      <View style={styles.adviceRow}>
        <Pressable
          style={({ pressed }) => [
            styles.adviceBtn,
            pressed && { opacity: 0.7 },
          ]}
          onPress={() => adviceRef.current?.present()}
          accessibilityRole="button"
          accessibilityLabel="Ask Elysia how to improve your longevity score"
        >
          <Ionicons name="sparkles" size={14} color={colors.accent} />
          <Text style={styles.adviceLabel}>How can I improve this score?</Text>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={colors.textSecondary}
          />
        </Pressable>
      </View>

      <LayerDetailSheet ref={sheetRef} pillarScores={pillarScores ?? {}} />
      <LongevityAdviceSheet
        ref={adviceRef}
        composite={composite ?? null}
        layerScores={layerScores ?? {}}
        pillarScores={pillarScores ?? {}}
      />
    </View>
  );
}

/**
 * Memoised so re-renders from dashboard.tsx (driven by Convex hook updates
 * that don't actually change any of *our* props) don't propagate into the
 * SVG-heavy wheel + sheet subtrees. Shallow prop compare is correct here:
 * all props are scalars or stable object references owned by the parent.
 */
export const LongevityPerformanceView = React.memo(LongevityPerformanceViewInner);

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  calibrationBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: spacing.sm + 2,
    backgroundColor: colors.accent + "12",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accent + "30",
  },
  calibrationText: {
    flex: 1,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  wheelWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    gap: 4,
  },
  batteryLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
    color: colors.textTertiary,
  },
  creditsCaption: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.accent,
  },
  adviceRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  adviceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.accent + "18",
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.accent + "55",
  },
  adviceLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.xs,
  },
  backLabel: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
});
