import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radii } from "@/theme";

interface StreakBadgeProps {
  count: number;
  showZero?: boolean;
  large?: boolean;
}

export function StreakBadge({ count, showZero = false, large = false }: StreakBadgeProps) {
  if (!showZero && count === 0) return null;

  const isHot = count >= 7;
  const isOnFire = count >= 14;
  const emoji = isOnFire ? "🔥" : isHot ? "⚡️" : "✦";

  return (
    <View
      style={[
        styles.badge,
        isHot ? styles.hot : styles.cool,
        large && styles.largeBadge,
      ]}
    >
      <Text style={large ? styles.largeEmoji : styles.emoji}>{emoji}</Text>
      <Text style={[styles.count, isHot && styles.hotCount, large && styles.largeCount]}>
        {count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  cool: {
    backgroundColor: colors.warningMuted,
  },
  hot: {
    backgroundColor: "#2D1B00",
  },
  largeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  emoji: { fontSize: 12 },
  largeEmoji: { fontSize: 18 },
  count: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.warning,
  },
  hotCount: {
    color: "#FCA44D",
  },
  largeCount: {
    fontSize: 18,
    fontWeight: "800",
  },
});
