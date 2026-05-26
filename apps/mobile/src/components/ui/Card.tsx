/**
 * Card — the single surface primitive of Elysia v2.
 *
 * Variants:
 *   • default  → standard data card (surface.card + subtle border)
 *   • raised   → muted bg, no glow, for grouped sub-sections
 *   • elevated → slightly brighter, used for the screen's "hero" tile
 *   • hero     → cyan-bordered + cool-tinted gradient bg + soft cyan glow
 *   • warmHero → amber-bordered + warm gradient bg + soft amber glow
 *   • muted    → flat surface bg, no border emphasis
 *
 * All variants share the same border radius + padding so the layout grid
 * stays homogeneous. The visual "depth" comes from the elevation token
 * + an optional inner gradient + optional glow shadow.
 */
import React from "react";
import { StyleSheet, View, ViewProps, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  borderTokens,
  brand,
  elevation,
  glows,
  radii,
  spacing,
  surface,
} from "@/theme";

export type CardVariant =
  | "default"
  | "raised"
  | "elevated"
  | "hero"
  // legacy alias for "hero" (kept so existing callsites keep compiling)
  | "accent"
  | "warmHero"
  | "muted";

export interface CardProps extends ViewProps {
  children: React.ReactNode;
  variant?: CardVariant;
  padded?: boolean;
  /** Visual padding scale. Defaults to `lg` (16px). */
  paddingScale?: keyof typeof spacing;
  style?: ViewStyle;
}

export function Card({
  children,
  variant = "default",
  padded = true,
  paddingScale = "lg",
  style,
  ...rest
}: CardProps) {
  const isHero = variant === "hero" || variant === "accent";
  const isWarmHero = variant === "warmHero";

  return (
    <View
      {...rest}
      style={[
        styles.base,
        variant === "default" && elevation.card,
        variant === "raised" && elevation.raised,
        variant === "elevated" && elevation.elevated,
        (variant === "hero" || variant === "accent") && elevation.hero,
        variant === "warmHero" && elevation.warmHero,
        variant === "muted" && stylesMuted,
        isHero && glows.primarySm,
        isWarmHero && glows.secondarySm,
        padded && { padding: spacing[paddingScale] },
        style,
      ]}
    >
      {/* Heroes get a faint inner gradient so they feel "lit" from the
          top-left without us having to layer real shadows on dark. */}
      {isHero && (
        <LinearGradient
          colors={[
            "rgba(34,211,238,0.10)",
            "rgba(34,211,238,0.02)",
            "rgba(0,0,0,0)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radii.lg }]}
          pointerEvents="none"
        />
      )}
      {isWarmHero && (
        <LinearGradient
          colors={[
            "rgba(245,158,11,0.10)",
            "rgba(245,158,11,0.02)",
            "rgba(0,0,0,0)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radii.lg }]}
          pointerEvents="none"
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    overflow: "hidden",
  },
});

const stylesMuted: ViewStyle = {
  backgroundColor: surface.raised,
  borderColor: borderTokens.hairline,
  borderWidth: 1,
};
// Re-export brand to silence unused warnings while debugging
void brand;
