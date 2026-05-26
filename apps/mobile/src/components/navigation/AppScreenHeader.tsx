import React, { type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "@/theme";

type Props = {
  /** Hamburger opens Profile (settings). Set false on settings screen. */
  showMenu?: boolean;
  center?: ReactNode;
  /** Title when not using custom `center` */
  title?: string;
  subtitle?: string;
  right?: ReactNode;
};

/**
 * Shared top row: hamburger → Profile, optional title block, trailing actions.
 */
export function AppScreenHeader({
  showMenu = true,
  center,
  title,
  subtitle,
  right,
}: Props) {
  const router = useRouter();

  const middle =
    center ??
    (title ? (
      <View style={styles.titleBlock}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    ) : (
      <View style={styles.titleBlock} />
    ));

  return (
    <View style={styles.row}>
      {showMenu ? (
        <Pressable
          onPress={() => router.push("/(tabs)/settings")}
          hitSlop={10}
          style={styles.menuBtn}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
        >
          <Ionicons name="menu-outline" size={26} color={colors.textPrimary} />
        </Pressable>
      ) : (
        <View style={styles.menuPlaceholder} />
      )}
      <View style={styles.center}>{middle}</View>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  menuBtn: {
    width: 40,
    height: 40,
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -4,
  },
  menuPlaceholder: { width: 36 },
  center: { flex: 1, minWidth: 0 },
  titleBlock: { gap: 2, paddingRight: spacing.xs },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 12, color: colors.textTertiary, marginTop: 1 },
  right: { minWidth: 40, alignItems: "flex-end", justifyContent: "flex-start" },
});
