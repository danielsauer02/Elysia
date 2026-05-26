/**
 * AnimatedPressable
 *
 * Drop-in replacement for `<Pressable>` that adds:
 *   • A subtle scale-down on press (springy, configurable)
 *   • Optional haptic feedback on press-in
 *   • Identical API to RN's Pressable (children, onPress, accessibility…)
 *
 * Use this in place of `<Pressable>` / `<TouchableOpacity>` everywhere we
 * want a tactile, "alive" feel. It's the single source of micro-interaction
 * truth so the app feels homogeneous.
 */
import React from "react";
import {
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { motion } from "@/theme";

type HapticKind = "selection" | "light" | "medium" | "none";

export interface AnimatedPressableProps
  extends Omit<PressableProps, "style" | "children"> {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** How much to scale down on press. Defaults to 0.97. */
  pressedScale?: number;
  /** Haptic feedback on press-in. Defaults to "selection". */
  haptic?: HapticKind;
  /** Disable the scale animation entirely. */
  noScale?: boolean;
}

function safeHaptic(kind: HapticKind) {
  if (kind === "none") return;
  try {
    const promise =
      kind === "selection"
        ? Haptics.selectionAsync()
        : Haptics.impactAsync(
            kind === "medium"
              ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Light
          );
    promise.catch(() => {
      /* native module not linked yet — ignore */
    });
  } catch {
    /* synchronous throw on older versions — ignore */
  }
}

export function AnimatedPressable({
  children,
  style,
  pressedScale = motion.pressScale,
  haptic = "selection",
  noScale = false,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        if (!noScale && !disabled) {
          scale.value = withTiming(pressedScale, {
            duration: motion.pressDuration,
            easing: Easing.out(Easing.quad),
          });
        }
        if (!disabled) safeHaptic(haptic);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!noScale) {
          scale.value = withTiming(1, {
            duration: motion.releaseDuration,
            easing: Easing.out(Easing.cubic),
          });
        }
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[animatedStyle, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
