import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { categoryColors, radii } from "@/theme";

interface BadgeProps {
  label: string;
  category?: string;
  color?: string;
  size?: "sm" | "md";
}

export function Badge({ label, category, color, size = "md" }: BadgeProps) {
  const resolvedColor =
    color ??
    (category
      ? (categoryColors[category.toLowerCase().replace(/ /g, "_")] ?? "#94A3B8")
      : "#94A3B8");

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: resolvedColor + "20", borderColor: resolvedColor + "35" },
        size === "sm" && styles.small,
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: resolvedColor },
          size === "sm" && styles.smallLabel,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
    borderWidth: 1,
  },
  small: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  smallLabel: {
    fontSize: 11,
  },
});
