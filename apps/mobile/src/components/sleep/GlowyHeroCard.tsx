/**
 * GlowyHeroCard
 *
 * Visual atom shared by the sleep hero card and the trend-route cards
 * (D-view bow, W/M/6M/Y chart). One deep navy surface with a soft
 * indigo glow radiating down from the top-centre — the 8sleep
 * "lighting from above" treatment.
 *
 * The trend variant is intentionally a hair darker than the home hero
 * so navigating from /sleep → /sleep-trend feels like stepping further
 * into the screen instead of into a different surface family.
 */
import React from "react";
import { View, StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { borderTokens } from "@/theme";

type Variant = "hero" | "deep";

interface Props {
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

const BG: Record<Variant, string> = {
  hero: "#0A0F1C",
  deep: "#070B14",
};

export function GlowyHeroCard({ variant = "deep", style, children }: Props) {
  return (
    <View style={[styles.card, { backgroundColor: BG[variant] }, style]}>
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(165,180,252,0.18)", "rgba(165,180,252,0.05)", "transparent"]}
        locations={[0, 0.4, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.glow}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    overflow: "hidden",
    position: "relative",
  },
  glow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 140,
  },
});
