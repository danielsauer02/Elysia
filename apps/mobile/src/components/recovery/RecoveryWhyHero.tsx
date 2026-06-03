/**
 * RecoveryWhyHero
 *
 * Futuristic centrepiece for the "Why recovery matters" block.
 *
 *   • A generated holographic body (warm amber/gold colorway, to match the
 *     Recovery section) sits at the centre on a glowing platform.
 *   • A soft warm radial glow sits behind the base (SVG gradient — renders
 *     identically on iOS + Android, unlike a shadowed View).
 *   • Two thin floor rings slowly counter-rotate at the base, giving a living,
 *     sci-fi feel.
 *   • A faint dashed orbit ellipse carries five benefit nodes (evenly placed
 *     by angle). Pressing a node (finger down) gives it a neon-blue highlight —
 *     larger bubble + icon, a cyan halo and a brighter white label; releasing
 *     opens its detail sheet.
 */
import React, { useEffect } from "react";
import {
  Image,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  RadialGradient,
  Stop,
} from "react-native-svg";
import {
  RECOVERY_WHY_BENEFITS,
  type IconFamily,
  type RecoveryBenefit,
} from "./recoveryWhyContent";
import { brand, fontFamily, spacing } from "@/theme";

const HERO_H = 360;
const FIG_W = 224;
const FIG_H = 300;
const FIG_TOP = 18;

// Warm "recovery" colorway for the figure / rings / glow.
const AMBER = "#F59E0B";
const GOLD = "#FBBF24";
const ORANGE = "#FB923C";
const CREAM = "#FCE3BD";
// Neon-blue used only for the press/hover highlight (app accent).
const HOVER = brand.primary;

// Orbit ellipse the nodes ride on (fractions of width / hero height).
const ORBIT_RX = 0.4;
const ORBIT_RY = 0.34;
const ORBIT_CY = 0.44;

interface Props {
  pressedId: string | null;
  onPressIn: (id: string) => void;
  onPressOut: () => void;
  onSelect: (benefit: RecoveryBenefit) => void;
}

function BenefitIcon({
  family,
  name,
  size,
  color,
}: {
  family: IconFamily;
  name: string;
  size: number;
  color: string;
}) {
  if (family === "mci") {
    return (
      <MaterialCommunityIcons name={name as never} size={size} color={color} />
    );
  }
  return <Ionicons name={name as never} size={size} color={color} />;
}

/** A dashed circle squashed into a floor ellipse, rotating continuously. */
function FloorRing({
  size,
  squash,
  dash,
  color,
  opacity,
  durationMs,
  reverse,
}: {
  size: number;
  squash: number;
  dash: string;
  color: string;
  opacity: number;
  durationMs: number;
  reverse?: boolean;
}) {
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = withRepeat(
      withTiming(reverse ? -360 : 360, {
        duration: durationMs,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, [spin, durationMs, reverse]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  const r = size / 2 - 2;
  return (
    <View style={{ transform: [{ scaleY: squash }] }} pointerEvents="none">
      <Animated.View style={style}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={1.4}
            strokeDasharray={dash}
            opacity={opacity}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

export function RecoveryWhyHero({
  pressedId,
  onPressIn,
  onPressOut,
  onSelect,
}: Props) {
  const { width: screenW } = useWindowDimensions();
  const [w, setW] = React.useState(screenW - spacing.lg * 2);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    if (next > 0 && Math.abs(next - w) > 1) setW(next);
  };

  const cx = w / 2;
  const cy = HERO_H * ORBIT_CY;
  const rx = w * ORBIT_RX;
  const ry = HERO_H * ORBIT_RY;
  const baseY = FIG_TOP + FIG_H - 30;

  const glow = useSharedValue(0.5);
  useEffect(() => {
    glow.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.55 + glow.value * 0.35 }));

  const nodeAt = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + rx * Math.cos(rad), y: cy + ry * Math.sin(rad) };
  };

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {/* Warm base glow (SVG radial — consistent on iOS + Android) */}
      <Animated.View style={[StyleSheet.absoluteFill, glowStyle]} pointerEvents="none">
        <Svg width={w} height={HERO_H}>
          <Defs>
            <RadialGradient id="baseGlow" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor={ORANGE} stopOpacity={0.5} />
              <Stop offset="45%" stopColor={AMBER} stopOpacity={0.22} />
              <Stop offset="100%" stopColor={AMBER} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={cx} cy={baseY - 6} rx={150} ry={62} fill="url(#baseGlow)" />
        </Svg>
      </Animated.View>

      {/* Holographic figure */}
      <View style={[styles.figureClip, { left: cx - FIG_W / 2 }]} pointerEvents="none">
        <Image
          source={require("../../../assets/recovery/why-hero-figure.png")}
          style={styles.figure}
          resizeMode="cover"
        />
      </View>

      {/* Faint dashed orbit ellipse(s) the nodes ride on — drawn over the
          figure so the dashed path stays continuous (the figure PNG has an
          opaque dark background that would otherwise occlude it). */}
      <Svg width={w} height={HERO_H} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          fill="none"
          stroke={CREAM}
          strokeWidth={0.9}
          strokeDasharray="2 6"
          opacity={0.32}
        />
        <Ellipse
          cx={cx}
          cy={cy}
          rx={rx * 0.72}
          ry={ry * 0.72}
          fill="none"
          stroke={AMBER}
          strokeWidth={0.6}
          strokeDasharray="1 8"
          opacity={0.18}
        />
      </Svg>

      {/* Rotating floor rings at the base */}
      <View style={[styles.floor, { left: cx - 130, top: baseY - 28 }]} pointerEvents="none">
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.floorCenter}>
            <FloorRing size={236} squash={0.3} dash="3 10" color={ORANGE} opacity={0.55} durationMs={26000} />
          </View>
        </View>
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.floorCenter}>
            <FloorRing size={176} squash={0.3} dash="2 8" color={GOLD} opacity={0.6} durationMs={18000} reverse />
          </View>
        </View>
      </View>

      {/* Benefit nodes */}
      {RECOVERY_WHY_BENEFITS.map((b) => {
        const { x: nx, y: ny } = nodeAt(b.angleDeg);
        const active = pressedId === b.id;
        return (
          <Pressable
            key={b.id}
            onPressIn={() => onPressIn(b.id)}
            onPressOut={onPressOut}
            onPress={() => onSelect(b)}
            hitSlop={10}
            style={[styles.node, { left: nx - 50, top: ny - 50 }]}
          >
            <View style={styles.bubbleSlot}>
              <View style={[styles.bubble, active && styles.bubbleActive]}>
                <BenefitIcon
                  family={b.nodeIconFamily}
                  name={b.nodeIcon}
                  size={active ? 32 : 26}
                  color={active ? "#FFFFFF" : "rgba(255,255,255,0.92)"}
                />
              </View>
            </View>
            <Text
              style={[styles.label, active && styles.labelActive]}
              numberOfLines={2}
            >
              {b.shortLabel[0]}
              {"\n"}
              {b.shortLabel[1]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    height: HERO_H,
    marginTop: spacing.md,
  },
  figureClip: {
    position: "absolute",
    top: FIG_TOP,
    width: FIG_W,
    height: FIG_H,
    overflow: "hidden",
  },
  figure: { width: "100%", height: "100%" },
  floor: { position: "absolute", width: 260, height: 90 },
  floorCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  node: {
    position: "absolute",
    width: 100,
    alignItems: "center",
  },
  bubbleSlot: {
    width: 84,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(11,15,26,0.82)",
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleActive: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: HOVER,
    backgroundColor: "rgba(34,211,238,0.16)",
  },
  label: {
    marginTop: 6,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 10.5,
    lineHeight: 13,
    color: "#FFFFFF",
    textAlign: "center",
  },
  labelActive: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11.5,
    lineHeight: 14,
    color: "#FFFFFF",
  },
});
