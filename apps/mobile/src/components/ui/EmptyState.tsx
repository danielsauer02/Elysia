import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "@/theme";
import { PrimaryButton } from "./PrimaryButton";

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={34} color={colors.accent} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {action ? (
        <PrimaryButton label={action.label} onPress={action.onPress} style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 32,
    gap: 10,
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: radii.full,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: colors.accent + "40",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },
  button: {
    marginTop: 8,
    alignSelf: "stretch",
  },
});
