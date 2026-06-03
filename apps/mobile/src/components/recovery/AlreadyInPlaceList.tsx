/**
 * AlreadyInPlaceList
 *
 * Compact row list under the recommendation stack showing every active
 * recovery-relevant habit the user already has. Mirrors the "Already in
 * place" block from the mockup so the user gets credit for what they're
 * already doing instead of seeing the same cards re-surfaced as suggestions.
 *
 * Each row reuses the same `HabitVisual` (slug-bundled image with category
 * gradient fallback) the recommendation cards use, so the two surfaces feel
 * like one library.
 */
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { radii, semantic, spacing, text } from "@/theme";
import { GlowyHeroCard } from "@/components/sleep/GlowyHeroCard";
import type { ResolvedActiveHabit } from "@/hooks/useRecoveryRecommendations";

interface Props {
  items: ResolvedActiveHabit[];
  onPressItem?: (item: ResolvedActiveHabit) => void;
}

export function AlreadyInPlaceList({ items, onPressItem }: Props) {
  if (items.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.headerLabel}>Already in place</Text>
      <View style={styles.list}>
        {items.map((item) => (
          <Row key={item.habitId} item={item} onPress={onPressItem} />
        ))}
      </View>
    </View>
  );
}

function Row({
  item,
  onPress,
}: {
  item: ResolvedActiveHabit;
  onPress?: (item: ResolvedActiveHabit) => void;
}) {
  const description =
    item.template?.shortExplanation ?? item.category.replace(/_/g, " ");
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.85 : 1}
      onPress={onPress ? () => onPress(item) : undefined}
    >
      <GlowyHeroCard variant="hero" style={styles.rowCard}>
        <View style={styles.rowInner}>
          <View style={styles.thumbWrap}>
            {item.visual.image ? (
              <Image
                source={item.visual.image}
                style={styles.thumb}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient colors={item.visual.gradient} style={styles.thumb} />
            )}
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.rowSub} numberOfLines={2}>
              {description}
            </Text>
          </View>
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={14} color="#0B111A" />
          </View>
        </View>
      </GlowyHeroCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  headerLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: text.primary,
    letterSpacing: -0.1,
    paddingHorizontal: spacing.xs,
  },
  list: { gap: spacing.sm },
  // Dark-navy card with the top-centre glow (matches the sleep "Stress" hero).
  rowCard: { borderRadius: radii.md },
  rowInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  thumbWrap: {
    width: 52,
    height: 52,
    borderRadius: radii.sm,
    overflow: "hidden",
  },
  thumb: { width: "100%", height: "100%" },
  rowText: { flex: 1, gap: 3 },
  rowTitle: {
    color: text.primary,
    fontSize: 14.5,
    fontWeight: "700",
  },
  rowSub: {
    color: text.secondary,
    fontSize: 12.5,
    lineHeight: 17,
  },
  checkBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: semantic.success,
  },
});
