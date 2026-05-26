/**
 * AgingFactorScale
 *
 * Horizontal slider-like scale from -1.5x to +3.0x with `1.0x` (chrono pace)
 * marked. Animated dot marker sits at the user's `factor = 1 + velocity28d`.
 *
 * - When velocity28d is undefined the marker collapses onto 1.0x and the
 *   caption reads "no trajectory yet".
 * - Marker pulses via Reanimated; tick labels are pure SVG text.
 */

import React, { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/theme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const TRACK_PAD = 18;
const SCALE_HEIGHT = 64;
const MIN_FACTOR = -1.5;
const MAX_FACTOR = 3.0;
const TICKS = [-1.5, -0.5, 0, 1, 2, 3] as const;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export interface AgingFactorScaleProps {
  /**
   * 28-day rolling aging-rate slope. Negative = aging slower than chrono,
   * positive = faster. `factor = 1 + velocity28d`.
   */
  velocity28d?: number;
  /** Total width to render. */
  width?: number;
}

export function AgingFactorScale({
  velocity28d,
  width = 320,
}: AgingFactorScaleProps) {
  const trackY = SCALE_HEIGHT - 24;
  const trackW = width - TRACK_PAD * 2;

  const factor = useMemo(
    () => 1 + (velocity28d ?? 0),
    [velocity28d]
  );
  const clamped = clamp(factor, MIN_FACTOR, MAX_FACTOR);
  const norm = (clamped - MIN_FACTOR) / (MAX_FACTOR - MIN_FACTOR); // 0..1
  const markerX = TRACK_PAD + norm * trackW;

  const markerColor = useMemo(() => {
    if (velocity28d === undefined) return colors.textTertiary;
    if (velocity28d < -0.05) return colors.success;
    if (velocity28d > 0.05) return colors.destructive;
    return colors.accent;
  }, [velocity28d]);

  // Pulse the marker
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(2.2, { duration: 1100 }), -1, true);
  }, [pulse]);
  const haloProps = useAnimatedProps(() => ({
    r: 7 + pulse.value * 4,
    opacity: 0.35 / pulse.value,
  }));

  const caption =
    velocity28d === undefined
      ? "No trajectory yet — calibration in progress"
      : `${factor.toFixed(2)}× · ${velocity28d < 0 ? "slower" : velocity28d > 0 ? "faster" : "matches"} than chrono`;

  return (
    <View style={[styles.wrap, { width }]} accessibilityLabel="Aging factor scale">
      <Svg width={width} height={SCALE_HEIGHT} viewBox={`0 0 ${width} ${SCALE_HEIGHT}`}>
        {/* Track */}
        <Line
          x1={TRACK_PAD}
          x2={width - TRACK_PAD}
          y1={trackY}
          y2={trackY}
          stroke={colors.borderStrong}
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Major ticks + labels */}
        {TICKS.map((t) => {
          const tNorm = (t - MIN_FACTOR) / (MAX_FACTOR - MIN_FACTOR);
          const x = TRACK_PAD + tNorm * trackW;
          const isChrono = t === 1;
          const color = isChrono ? colors.accent : colors.textTertiary;
          return (
            <React.Fragment key={t}>
              <Line
                x1={x}
                x2={x}
                y1={trackY - (isChrono ? 8 : 5)}
                y2={trackY + (isChrono ? 8 : 5)}
                stroke={color}
                strokeWidth={isChrono ? 2 : 1.2}
                strokeLinecap="round"
              />
              <SvgText
                x={x}
                y={trackY - 13}
                fill={color}
                fontSize={isChrono ? 11 : 9}
                fontWeight={isChrono ? "800" : "600"}
                textAnchor="middle"
              >
                {t}×
              </SvgText>
            </React.Fragment>
          );
        })}
        {/* Pulse halo */}
        <AnimatedCircle
          cx={markerX}
          cy={trackY}
          fill={markerColor}
          animatedProps={haloProps}
        />
        {/* Marker core */}
        <Circle
          cx={markerX}
          cy={trackY}
          r={6}
          fill={markerColor}
          stroke={colors.background}
          strokeWidth={1.5}
        />
      </Svg>
      <Text style={[styles.caption, { color: markerColor }]}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 4 },
  caption: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
});
