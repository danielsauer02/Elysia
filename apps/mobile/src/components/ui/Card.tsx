import React from "react";
import { View, ViewStyle, StyleSheet } from "react-native";
import { colors, radii } from "@/theme";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  variant?: "default" | "elevated" | "muted" | "accent";
}

export function Card({
  children,
  style,
  padded = true,
  variant = "default",
}: CardProps) {
  return (
    <View
      style={[
        styles.base,
        padded && styles.padded,
        variant === "elevated" && styles.elevated,
        variant === "muted" && styles.muted,
        variant === "accent" && styles.accent,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  padded: {
    padding: 16,
  },
  elevated: {
    backgroundColor: colors.cardAlt,
    borderColor: colors.borderStrong,
  },
  muted: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  accent: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent + "40",
  },
});
