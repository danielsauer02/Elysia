import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, spacing } from "@/theme";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
  paddingHorizontal?: number;
}

export function SectionHeader({
  title,
  subtitle,
  action,
  paddingHorizontal = spacing.lg,
}: SectionHeaderProps) {
  return (
    <View style={[styles.container, { paddingHorizontal }]}>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action ? (
        <TouchableOpacity onPress={action.onPress} activeOpacity={0.7}>
          <Text style={styles.action}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  text: { flex: 1 },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 2,
  },
  action: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.accent,
  },
});
