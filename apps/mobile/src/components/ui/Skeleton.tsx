/**
 * Skeleton — shimmer placeholder for loading content.
 *
 * Apple-Health-grade loading states without spinners. Renders a rounded
 * rectangle of arbitrary size that shimmers from left to right (cool,
 * subtle highlight passing through a darker base).
 *
 * Compose multiple Skeletons to mock a card layout while data loads.
 */
import React, { useEffect } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { borderTokens, radii, surface } from "@/theme";

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

const AnimatedLinearGradient =
  Animated.createAnimatedComponent(LinearGradient);

export function Skeleton({
  width = "100%",
  height = 16,
  radius = radii.sm,
  style,
}: SkeletonProps) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      false
    );
  }, [t]);

  // Slide a highlight band across the width of the skeleton. We over-shoot
  // on each side so the highlight enters and exits cleanly.
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t.value, [0, 1], [-160, 320]) },
    ],
    opacity: interpolate(t.value, [0, 0.5, 1], [0, 0.55, 0]),
  }));

  return (
    <View
      style={[
        styles.base,
        {
          width: width as ViewStyle["width"],
          height,
          borderRadius: radius,
        },
        style,
      ]}
    >
      <AnimatedLinearGradient
        colors={[
          "rgba(255,255,255,0)",
          "rgba(255,255,255,0.10)",
          "rgba(255,255,255,0)",
        ]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.sweep, sweepStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: surface.raised,
    borderWidth: 1,
    borderColor: borderTokens.hairline,
    overflow: "hidden",
  },
  sweep: {
    ...StyleSheet.absoluteFillObject,
    width: 160,
  },
});
