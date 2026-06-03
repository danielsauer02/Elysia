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
import { type SharedValue } from "react-native-reanimated";
import { FLOATING_TAB_BAR } from "@/constants/floatingTabBar";
import { colors } from "@/theme";
import {
  MagneticTabBar,
  type MagneticTabBarTab,
} from "@/components/navigation/MagneticTabBar";

interface Props {
  /** Distance from screen bottom to bottom edge of the bar row */
  tabBarBottom: number;
  tabs: MagneticTabBarTab[];
  activeKey: string;
  onSelect: (key: string) => void;
  onTapWhenCollapsed?: () => void;
  /** 0 = expanded pill, 1 = collapsed circle. Continuous SharedValue. */
  collapsed: SharedValue<number>;
  /** Called when the AI tile (E) is pressed. */
  onPressAi: () => void;
}

/**
 * Left-aligned glass pill (4 tabs) + AI "E" tile. Both elements are
 * morph-aware: as `collapsed` rises the magnetic pill shrinks to a
 * circle while the AI tile stays a fixed circle on the right.
 *
 * Fully routing-agnostic — the parent (`GlobalTabBarOverlay`) feeds
 * in the tabs, the active key, and the navigate handler. This lets
 * the bar render at the ROOT layer so it stays visible on deep-dive
 * screens too.
 */
export function ElysiaBottomTabBar({
  tabBarBottom,
  tabs,
  activeKey,
  onSelect,
  onTapWhenCollapsed,
  collapsed,
  onPressAi,
}: Props) {
  const { width: winW } = useWindowDimensions();
  const [hostW, setHostW] = useState(winW);

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

  // The pill host keeps a CONSTANT footprint (pillWidth) so the AI "E"
  // tile next to it never shifts. The magnetic bar collapses to a
  // circle *inside* this host, left-anchored, while the host's width
  // stays put — so the E circle on the right stays fixed in place.

  return (
    <View
      style={styles.layer}
      pointerEvents="box-none"
      onLayout={onLayerLayout}
    >
      {/* Soft gradient shade behind the bar so the icons stay legible over
          busy content. The fade STARTS at the top edge of the bar (fully
          transparent there) and darkens evenly all the way down to the
          Android controls — never fully black, so content stays faintly
          visible at the very bottom. A true graduated fade, not a hard edge. */}
      <LinearGradient
        pointerEvents="none"
        colors={[
          "rgba(0,0,0,0)",
          "rgba(0,0,0,0.03)",
          "rgba(0,0,0,0.08)",
          "rgba(0,0,0,0.14)",
          "rgba(0,0,0,0.21)",
          "rgba(0,0,0,0.29)",
          "rgba(0,0,0,0.37)",
          "rgba(0,0,0,0.45)",
          "rgba(0,0,0,0.52)",
          "rgba(0,0,0,0.58)",
          "rgba(0,0,0,0.62)",
        ]}
        locations={[0, 0.1, 0.2, 0.31, 0.42, 0.53, 0.64, 0.75, 0.85, 0.93, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        // Starts exactly at the bar's top edge (transparent) and darkens
        // continuously down to the screen bottom / Android controls — never
        // fully black, so the controls stay faintly visible.
        style={[styles.bottomShade, { height: tabBarBottom + height }]}
      />

      <View
        style={[
          styles.barRow,
          { bottom: tabBarBottom, paddingHorizontal: gutter },
        ]}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.pillHost,
            { width: pillWidth, height, marginRight: aiTileGap },
          ]}
          pointerEvents="box-none"
        >
          <MagneticTabBar
            tabs={tabs}
            activeKey={activeKey}
            onSelect={onSelect}
            onTapWhenCollapsed={onTapWhenCollapsed}
            width={pillWidth}
            height={height}
            borderRadius={borderRadius}
            collapsed={collapsed}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Elysia assistant"
          onPress={onPressAi}
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
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: FLOATING_TAB_BAR.tintOverlay },
            ]}
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
    // Intentionally NO `overflow: hidden` — MagneticTabBar owns its own
    // clipping AND grows ~4 % on press; clipping here would crop both.
  },
  aiTile: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  aiLetter: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.accent,
    letterSpacing: -0.5,
  },
});
