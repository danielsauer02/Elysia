/**
 * AboutSleepScoreCard
 *
 * Mirrors the 8sleep "About Sleep Fitness Score" expandable widget that
 * sits at the bottom of every timeframe in the trend view.
 */
import React, { useState } from "react";
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  borderTokens,
  colors,
  fontFamily,
  spacing,
  surface,
} from "@/theme";

const DEFAULT_BODY =
  "Your Elysia Sleep Score combines three things: how long you slept, the quality of that sleep (REM and deep sleep, awakenings, resting heart rate) and how consistent your bed and wake times are. A score of 80 or higher sits in the optimal range and means your body had everything it needed to recover well.";

interface Props {
  /** Heading text — defaults to the Sleep Fitness Score copy. */
  title?: string;
  /** Body text revealed on expand. */
  body?: string;
}

export function AboutSleepScoreCard({ title, body }: Props = {}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOpen((v) => !v);
        }}
        style={styles.header}
        accessibilityRole="button"
      >
        <Text style={styles.title}>{title ?? "About Sleep Fitness Score"}</Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>
      {open ? <Text style={styles.body}>{body ?? DEFAULT_BODY}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: surface.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  body: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginTop: spacing.sm,
  },
});
