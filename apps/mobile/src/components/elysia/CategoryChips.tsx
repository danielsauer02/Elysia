/**
 * CategoryChips — horizontal Bevel/Whoop-style slicer.
 *
 * One chip per protocol category + a leading "All" chip. The active chip
 * is tinted with the category's `categoryColors[…]` value (or cyan for
 * "All") so the user always knows what they're filtering by at a glance.
 *
 * Designed to sit immediately below the summary rings on the Elysia tab,
 * but the component is generic — pass any string list.
 */
import React, { useCallback } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  borderTokens,
  brand,
  categoryColors,
  categoryIcons,
  radii,
  spacing,
  text,
  typography,
} from "@/theme";

const ALL_LABEL = "All";

interface CategoryChipsProps {
  /** All categories to show (already humanised, e.g. "cold exposure"). */
  categories: string[];
  /** Currently selected category label (use "All" for no filter). */
  selected: string;
  onSelect: (label: string) => void;
  /** Optional count next to "All" — e.g. total template count. */
  totalCount?: number;
}

export function CategoryChips({
  categories,
  selected,
  onSelect,
  totalCount,
}: CategoryChipsProps) {
  const handlePress = useCallback(
    (label: string) => {
      if (label === selected) return;
      void Haptics.selectionAsync().catch(() => {});
      onSelect(label);
    },
    [onSelect, selected]
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      <Chip
        label={ALL_LABEL}
        tint={brand.primary}
        iconName="apps-outline"
        active={selected === ALL_LABEL}
        onPress={() => handlePress(ALL_LABEL)}
        countSuffix={totalCount}
      />
      {categories.map((cat) => {
        const key = humanToKey(cat);
        const tint = categoryColors[key] ?? brand.primary;
        const iconName =
          (categoryIcons[key] as keyof typeof Ionicons.glyphMap | undefined) ??
          "ellipse-outline";
        return (
          <Chip
            key={cat}
            label={cat}
            tint={tint}
            iconName={iconName}
            active={selected === cat}
            onPress={() => handlePress(cat)}
          />
        );
      })}
    </ScrollView>
  );
}

function Chip({
  label,
  tint,
  iconName,
  active,
  onPress,
  countSuffix,
}: {
  label: string;
  tint: string;
  iconName: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
  countSuffix?: number;
}) {
  const tintedBg = active ? hexToRgba(tint, 0.18) : "transparent";
  const tintedBorder = active ? hexToRgba(tint, 0.55) : borderTokens.subtle;
  const tintedText = active ? tint : text.secondary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: tintedBg,
          borderColor: tintedBorder,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      hitSlop={4}
    >
      <Ionicons name={iconName} size={13} color={tintedText} />
      <Text style={[styles.chipLabel, { color: tintedText }]} numberOfLines={1}>
        {capitalize(label)}
      </Text>
      {countSuffix !== undefined && (
        <Text style={[styles.chipCount, { color: tintedText, opacity: 0.7 }]}>
          {countSuffix}
        </Text>
      )}
    </Pressable>
  );
}

/** "cold exposure" → "cold_exposure" so we can index categoryColors. */
function humanToKey(label: string): string {
  return label.toLowerCase().replace(/ /g, "_");
}

function capitalize(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** #RRGGBB → rgba(r,g,b,alpha). Falls back to the hex if format is off. */
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-fA-F0-9]{6})$/.exec(hex.trim());
  if (!m) return hex;
  const num = parseInt(m[1]!, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
    marginRight: spacing.xs,
  },
  chipLabel: {
    ...typography.caption,
    fontSize: 12,
    letterSpacing: 0.1,
  },
  chipCount: {
    ...typography.numberSm,
    fontSize: 11,
    marginLeft: 2,
  },
  // Layout guard — view that gets typechecked but never rendered, keeps
  // some imports warm if styles.chip changes externally.
  _guard: { color: text.primary },
});

// Avoid Haptics import being elided during typechecks in environments
// where it's optional (no-op if the module isn't present).
void Haptics;
