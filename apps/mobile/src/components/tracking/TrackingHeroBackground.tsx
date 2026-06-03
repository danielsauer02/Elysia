/**
 * TrackingHeroBackground
 *
 * The themed wallpaper that sits behind a tracking view's hero score
 * (Sleep today; Recovery / Strain / … later). It is absolutely positioned
 * at the top of the screen, behind the scroll content, and:
 *
 *   • fades into the app background toward the bottom (so the hero score and
 *     sub-KPI tiles read on a solid colour, never on a busy image),
 *   • is driven by `animatedStyle` from `useTrackingHeroScroll` — zooming on
 *     pull-down and fading out as the user scrolls past the hero.
 *
 * Stateless + presentational: all motion lives in the hook so every tracking
 * screen shares one source of truth.
 */
import React from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { getTrackingHero, type TrackingHeroKind } from "@/theme/trackingHero";

interface Props {
  kind: TrackingHeroKind;
  /** Height of the wallpaper band (the hero region). */
  height: number;
  /** Animated transform/opacity from `useTrackingHeroScroll`. */
  animatedStyle: ReturnType<typeof useAnimatedStyle>;
}

export function TrackingHeroBackground({ kind, height, animatedStyle }: Props) {
  const theme = getTrackingHero(kind);
  if (!theme) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { height }, animatedStyle] as never}
    >
      <Image source={theme.wallpaper} style={styles.image} resizeMode="cover" />
      {/* Uniform dark film over the whole wallpaper — dims the scenery for
          contrast so the hero card, calendar and tiles read cleanly
          (Bevel-style). */}
      <View pointerEvents="none" style={styles.darken} />
      {/* Fade the bottom of the wallpaper into the app background so the
          hero content sits on a clean colour and the seam is invisible. */}
      <LinearGradient
        pointerEvents="none"
        colors={["transparent", "transparent", theme.fadeColor]}
        locations={[0, 0.5, 0.92]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  darken: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
});
