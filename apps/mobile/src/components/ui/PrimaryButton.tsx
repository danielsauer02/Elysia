import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from "react-native";
import { colors, radii } from "@/theme";

type Variant = "primary" | "secondary" | "ghost" | "success" | "destructive" | "disabled";
type Size = "sm" | "md" | "lg";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  size?: Size;
  style?: ViewStyle;
}

const bgMap: Record<Variant, string> = {
  primary: colors.accent,
  secondary: colors.accentMuted,
  ghost: "transparent",
  success: colors.success,
  destructive: colors.destructive,
  disabled: colors.surface,
};

const textMap: Record<Variant, string> = {
  primary: "#0C0F1A",
  secondary: colors.accent,
  ghost: colors.accent,
  success: "#0C0F1A",
  destructive: "#fff",
  disabled: colors.textTertiary,
};

const borderMap: Record<Variant, string> = {
  primary: "transparent",
  secondary: colors.accent + "50",
  ghost: colors.accent + "40",
  success: "transparent",
  destructive: "transparent",
  disabled: colors.border,
};

export function PrimaryButton({
  label,
  onPress,
  variant = "primary",
  loading = false,
  size = "md",
  style,
}: PrimaryButtonProps) {
  const isDisabled = variant === "disabled" || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.82}
      style={[
        styles.base,
        {
          backgroundColor: bgMap[variant],
          borderColor: borderMap[variant],
          borderWidth: variant === "ghost" || variant === "secondary" ? 1 : 0,
        },
        size === "sm" && styles.small,
        size === "lg" && styles.large,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textMap[variant]} size="small" />
      ) : (
        <Text
          style={[
            styles.label,
            { color: textMap[variant] },
            size === "sm" && styles.smallLabel,
            size === "lg" && styles.largeLabel,
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  small: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.sm,
  },
  large: {
    paddingVertical: 16,
    borderRadius: radii.lg,
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
  },
  smallLabel: {
    fontSize: 13,
  },
  largeLabel: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
});
