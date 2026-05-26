/**
 * TierBadge
 *
 * Tiny "Level 1 - Wearable + Nutrition + Habits · Upgrade →" chip pinned to
 * the top-left of the Longevity Performance card. Press → routes to the
 * Paywall screen.
 *
 * Tier semantics:
 *   - 1 = unlocked today (Tier-1 pillars active)
 *   - 2 = adds biomarkers (blood / body comp / metabolic)
 *   - 3 = adds skin / hair / genetics
 */

import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, radii, spacing } from "@/theme";

export interface TierBadgeProps {
  /** Current unlock level the user is at. Default: 1. */
  level?: 1 | 2 | 3;
  /** Short copy after the level. */
  scope?: string;
}

const LEVEL_LABELS: Record<1 | 2 | 3, string> = {
  1: "Wearable · Nutrition · Habits",
  2: "+ Biomarkers",
  3: "+ Skin · Hair · Genetics",
};

export function TierBadge({
  level = 1,
  scope,
}: TierBadgeProps) {
  const router = useRouter();
  const showUpgrade = level < 3;
  const sub = scope ?? LEVEL_LABELS[level];

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.badge}
      onPress={() => router.push("/paywall")}
      accessibilityRole="button"
      accessibilityLabel={`Tier ${level} - tap to view upgrade options`}
    >
      <Text style={styles.levelLabel}>L{level}</Text>
      <Text style={styles.scope} numberOfLines={1}>
        {sub}
      </Text>
      {showUpgrade ? (
        <>
          <Text style={styles.divider}>·</Text>
          <Text style={styles.upgrade}>Upgrade</Text>
          <Ionicons name="chevron-forward" size={11} color={colors.accent} />
        </>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  levelLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.accent,
    letterSpacing: 0.5,
  },
  scope: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.textSecondary,
    maxWidth: 180,
  },
  divider: { color: colors.textTertiary, fontSize: 10 },
  upgrade: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.accent,
  },
});
