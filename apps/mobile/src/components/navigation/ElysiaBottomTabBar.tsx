import { BottomTabBar, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useCallback, useState } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { FLOATING_TAB_BAR } from "@/constants/floatingTabBar";
import { colors } from "@/theme";
import { useAiAssistant } from "@/context/AiAssistantContext";

const HIDDEN_TAB_NAMES = new Set(["settings"]);

type Props = BottomTabBarProps & {
  /** Distance from screen bottom to bottom edge of bar row */
  tabBarBottom: number;
};

function filterTabBarProps(props: BottomTabBarProps): BottomTabBarProps {
  const routes = props.state.routes.filter((r) => !HIDDEN_TAB_NAMES.has(r.name));
  const descriptors: BottomTabBarProps["descriptors"] = { ...props.descriptors };
  for (const key of Object.keys(descriptors)) {
    if (!routes.some((r) => r.key === key)) {
      delete descriptors[key];
    }
  }
  const current = props.state.routes[props.state.index];
  let index = 0;
  if (current && !HIDDEN_TAB_NAMES.has(current.name)) {
    const found = routes.findIndex((r) => r.key === current.key);
    if (found >= 0) index = found;
  }
  return {
    ...props,
    state: {
      ...props.state,
      routes,
      index,
      routeNames: routes.map((r) => r.name),
    },
    descriptors,
  };
}

/**
 * Left-aligned glass pill (4 tabs) + AI “E” tile; settings is reachable via hamburger only.
 */
export function ElysiaBottomTabBar({ tabBarBottom, ...props }: Props) {
  const { width: winW } = useWindowDimensions();
  const [hostW, setHostW] = useState(winW);
  const { present } = useAiAssistant();

  const onLayerLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setHostW(w);
  }, []);

  const gutter = FLOATING_TAB_BAR.horizontalInset;
  const { height, borderRadius, aiTileSize, aiTileGap } = FLOATING_TAB_BAR;
  const pillWidth = Math.max(
    120,
    Math.round(hostW - 2 * gutter - aiTileGap - aiTileSize)
  );
  const shadeHeight = tabBarBottom + height;
  const filtered = filterTabBarProps(props);

  return (
    <View
      style={styles.layer}
      pointerEvents="box-none"
      onLayout={onLayerLayout}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[
          "rgba(0,0,0,0.14)",
          "rgba(0,0,0,0.42)",
          "rgba(0,0,0,0.58)",
          "rgba(0,0,0,0.68)",
        ]}
        locations={[0, 0.35, 0.72, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.bottomShade, { height: shadeHeight }]}
      />

      <View
        style={[styles.barRow, { bottom: tabBarBottom, paddingHorizontal: gutter }]}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.pillHost,
            {
              width: pillWidth,
              height,
              borderRadius,
              marginRight: aiTileGap,
            },
          ]}
          pointerEvents="box-none"
        >
          <BottomTabBar {...filtered} />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Elysia assistant"
          onPress={present}
          style={({ pressed }) => [
            styles.aiTile,
            {
              width: aiTileSize,
              height: aiTileSize,
              borderRadius: aiTileSize / 2,
              opacity: pressed ? 0.88 : 1,
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
            style={[StyleSheet.absoluteFill, { backgroundColor: FLOATING_TAB_BAR.tintOverlay }]}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: aiTileSize / 2,
                borderWidth: StyleSheet.hairlineWidth * 2,
                borderColor: FLOATING_TAB_BAR.borderColor,
              },
            ]}
          />
          <Text style={styles.aiLetter}>E</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    justifyContent: "flex-end",
  },
  bottomShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  barRow: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  pillHost: {
    overflow: "hidden",
  },
  aiTile: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  aiLetter: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.accent,
    letterSpacing: -0.5,
  },
});
