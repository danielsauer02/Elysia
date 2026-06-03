/**
 * EnergyBattery
 *
 * Bevel-style large battery for the Energy Reserve deep-dive: a glossy
 * horizontal cell that fills to the current reserve, glows outward in the
 * level colour (green/amber/red), and runs a subtle "charging" shimmer — a
 * white vertical highlight that wanders across the fill.
 *
 * Outline is a Bevel-style double contour: a thin inner grey border, a tiny
 * gap with a faint grey wash, and an even thinner outer grey border that
 * echoes the cell's shape. Glow is a soft SVG radial gradient behind the cell.
 */
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { energyLevelColor } from "./energyColors";
import { fontFamily } from "@/theme";

interface Props {
  /** Current reserve %, or null when no data. */
  level: number | null;
}

const W = 200; // inner cell width
const H = 96; // inner cell height
const INNER_BORDER = 2.5;
const GAP = 3;
const OUTER_BORDER = 1;
const FRAME_PAD = GAP + OUTER_BORDER;
const FRAME_W = W + FRAME_PAD * 2;
const FRAME_H = H + FRAME_PAD * 2;
const GLOW_PAD = 86;
const SHIMMER_W = 40;
const SHELL_GREY = "#9AA1AC"; // inner contour
const OUTER_GREY = "rgba(154,161,172,0.55)"; // thinner outer contour

export function EnergyBattery({ level }: Props) {
  const pct = level === null ? 0 : Math.max(0, Math.min(100, level));
  const tint = energyLevelColor(level);

  const innerW = W - INNER_BORDER * 2 - 6;
  const fillW = Math.max(6, (pct / 100) * innerW);

  const shimmer = useSharedValue(0);
  useEffect(() => {
    shimmer.value = 0;
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.quad) }),
      -1,
      false
    );
  }, [shimmer, fillW]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -SHIMMER_W + shimmer.value * (fillW + SHIMMER_W) }],
  }));

  return (
    <View style={styles.wrap}>
      {/* Outward glow */}
      <Svg
        width={FRAME_W + GLOW_PAD * 2}
        height={FRAME_H + GLOW_PAD * 2}
        style={styles.glow}
        pointerEvents="none"
      >
        <Defs>
          <RadialGradient id="batglow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={tint} stopOpacity={0.45} />
            <Stop offset="55%" stopColor={tint} stopOpacity={0.18} />
            <Stop offset="100%" stopColor={tint} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse
          cx={(FRAME_W + GLOW_PAD * 2) / 2}
          cy={(FRAME_H + GLOW_PAD * 2) / 2}
          rx={(FRAME_W + GLOW_PAD * 2) / 2}
          ry={(FRAME_H + GLOW_PAD * 2) / 2}
          fill="url(#batglow)"
        />
      </Svg>

      {/* Outer contour + faint gap wash */}
      <View style={styles.frame}>
        {/* Battery cell (inner contour) */}
        <View style={styles.shell}>
          <View style={styles.fillTrack}>
            <View style={[styles.fill, { width: fillW }]}>
              <LinearGradient
                colors={[lighten(tint), tint, darken(tint)]}
                locations={[0, 0.45, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.gloss} />
              <Animated.View style={[styles.shimmerClip, shimmerStyle]}>
                <LinearGradient
                  colors={[
                    "rgba(255,255,255,0)",
                    "rgba(255,255,255,0.55)",
                    "rgba(255,255,255,0)",
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>
          </View>

          {/* centred percentage readout */}
          <View style={styles.readout} pointerEvents="none">
            <View style={styles.pctRow}>
              <Text style={styles.pct}>{level === null ? "—" : pct}</Text>
              <Text style={styles.pctSign}>%</Text>
            </View>
          </View>

          {/* bolt parked near the cap, vertically centred */}
          <Ionicons
            name="flash"
            size={16}
            color="rgba(255,255,255,0.92)"
            style={styles.bolt}
            pointerEvents="none"
          />
        </View>
      </View>

      {/* terminal nub on the outer contour */}
      <View style={styles.terminal} />
    </View>
  );
}

function lighten(hex: string): string {
  return mix(hex, 255, 0.4);
}
function darken(hex: string): string {
  return mix(hex, 0, 0.22);
}
function mix(hex: string, target: number, amt: number): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return hex;
  const r = Math.round(parseInt(m.slice(0, 2), 16) * (1 - amt) + target * amt);
  const g = Math.round(parseInt(m.slice(2, 4), 16) * (1 - amt) + target * amt);
  const b = Math.round(parseInt(m.slice(4, 6), 16) * (1 - amt) + target * amt);
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

const styles = StyleSheet.create({
  wrap: {
    width: FRAME_W,
    height: FRAME_H,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  glow: { position: "absolute", top: -GLOW_PAD, left: -GLOW_PAD },
  frame: {
    width: FRAME_W,
    height: FRAME_H,
    borderRadius: 24 + FRAME_PAD,
    borderWidth: OUTER_BORDER,
    borderColor: OUTER_GREY,
    backgroundColor: "rgba(154,161,172,0.06)",
    padding: GAP,
  },
  shell: {
    flex: 1,
    borderRadius: 22,
    borderWidth: INNER_BORDER,
    borderColor: SHELL_GREY,
    backgroundColor: "rgba(255,255,255,0.04)",
    overflow: "hidden",
    justifyContent: "center",
  },
  fillTrack: {
    ...StyleSheet.absoluteFillObject,
    margin: 3,
    borderRadius: 17,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 15, overflow: "hidden" },
  gloss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "42%",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  shimmerClip: { position: "absolute", top: 0, bottom: 0, width: SHIMMER_W },
  terminal: {
    position: "absolute",
    right: -6,
    top: FRAME_H / 2 - 15,
    width: 7,
    height: 30,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: SHELL_GREY,
  },
  readout: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  pctRow: { flexDirection: "row", alignItems: "flex-end" },
  pct: {
    fontFamily: fontFamily.heading,
    fontSize: 34,
    lineHeight: 36,
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
  },
  pctSign: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 18,
    color: "#FFFFFF",
    marginLeft: 2,
  },
  bolt: { position: "absolute", right: 14, top: H / 2 - 11 },
});
