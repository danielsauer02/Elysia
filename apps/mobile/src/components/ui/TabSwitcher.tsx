import React, { useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@/theme";

interface TabOption {
  id: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  count?: number;
}

interface TabSwitcherProps {
  options: TabOption[];
  active: string;
  onChange: (id: string) => void;
  variant?: "pills" | "underline";
}

export function TabSwitcher({
  options,
  active,
  onChange,
  variant = "pills",
}: TabSwitcherProps) {
  if (variant === "underline") {
    return (
      <View style={styles.underlineContainer}>
        {options.map((opt) => {
          const isActive = opt.id === active;
          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => onChange(opt.id)}
              activeOpacity={0.75}
              style={styles.underlineTab}
            >
              <View style={styles.underlineTabInner}>
                {opt.icon && (
                  <Ionicons
                    name={opt.icon}
                    size={15}
                    color={isActive ? colors.accent : colors.textTertiary}
                  />
                )}
                <Text
                  style={[
                    styles.underlineLabel,
                    isActive ? styles.underlineLabelActive : styles.underlineLabelInactive,
                  ]}
                >
                  {opt.label}
                  {opt.count !== undefined ? ` (${opt.count})` : ""}
                </Text>
              </View>
              <View
                style={[
                  styles.underlineBar,
                  isActive && styles.underlineBarActive,
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.pillsContainer}>
      {options.map((opt) => {
        const isActive = opt.id === active;
        return (
          <TouchableOpacity
            key={opt.id}
            onPress={() => onChange(opt.id)}
            activeOpacity={0.8}
            style={[styles.pill, isActive && styles.pillActive]}
          >
            {opt.icon && (
              <Ionicons
                name={opt.icon}
                size={14}
                color={isActive ? "#0C0F1A" : colors.textSecondary}
              />
            )}
            <Text style={[styles.pillLabel, isActive && styles.pillLabelActive]}>
              {opt.label}
              {opt.count !== undefined ? ` · ${opt.count}` : ""}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Underline variant
  underlineContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  underlineTab: {
    marginRight: spacing.xl,
    paddingBottom: spacing.sm,
  },
  underlineTabInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.sm,
  },
  underlineLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  underlineLabelActive: {
    color: colors.textPrimary,
  },
  underlineLabelInactive: {
    color: colors.textTertiary,
  },
  underlineBar: {
    height: 2,
    borderRadius: radii.full,
    backgroundColor: "transparent",
  },
  underlineBarActive: {
    backgroundColor: colors.accent,
  },

  // Pills variant
  pillsContainer: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 4,
    gap: 4,
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: radii.md,
  },
  pillActive: {
    backgroundColor: colors.accent,
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  pillLabelActive: {
    color: "#0C0F1A",
  },
});
