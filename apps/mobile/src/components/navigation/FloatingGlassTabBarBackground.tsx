import { StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { FLOATING_TAB_BAR } from "@/constants/floatingTabBar";

/**
 * Anthracite frosted glass behind tab bar icons.
 */
export function FloatingGlassTabBarBackground() {
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: FLOATING_TAB_BAR.borderRadius,
          overflow: "hidden",
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: FLOATING_TAB_BAR.borderColor,
        },
      ]}
    >
      <BlurView
        intensity={FLOATING_TAB_BAR.blurIntensity}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: FLOATING_TAB_BAR.tintOverlay },
        ]}
      />
    </View>
  );
}
