/**
 * DailySummaryRings — the Whoop-style trio at the top of the Home tab.
 *
 * Three thin rings (Sleep / Recovery / Strain) drawn with Skia for a smooth
 * Apple-Health-grade look. Each ring has a glowing gradient track. The
 * center of each ring shows the score % in tabular monospace. A label
 * sits beneath each ring with a chevron that opens the detail screen.
 *
 * Sized to gracefully collapse: when `size` shrinks past ~80px we hide the
 * descriptions and pack the rings tight (used by the sticky scroll header).
 */
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Canvas,
  Group,
  Path,
  Skia,
  SweepGradient,
  vec,
} from "@shopify/react-native-skia";
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import {
  borderTokens,
  dataColors,
  spacing,
  text,
  typography,
} from "@/theme";

export type SummaryRingId =
  | "sleep"
  | "recovery"
  | "strain"
  // Elysia-tab rings — habit composition.
  | "active"
  | "consistency"
  | "planned";

// Either a domain DataColor key (`dataColors[…]`) or a fully-custom tint.
export type SummaryRingColor =
  | { kind: "data"; key: keyof typeof dataColors }
  | { kind: "custom"; base: string; gradient: [string, string]; glow: string };

export interface SummaryRingValue {
  id: SummaryRingId;
  label: string;
  /** Numeric fill (0..100). `null` = no data → ring stays empty, center shows `—`. */
  value: number | null;
  /** Optional unit override for the auto-generated center text. Default = `%`. */
  unit?: string;
  /**
   * Optional custom center label. When set, this completely overrides the
   * default `<percent><unit>` rendering — used for absolute counts like
   * "12 active" rather than "%". Keep it short — max ~3 chars looks best.
   */
  centerOverride?: string;
  /**
   * Optional per-ring color override. When omitted, `colorForRing(id)` picks
   * a sensible default from `dataColors`.
   */
  color?: SummaryRingColor;
}

interface DailySummaryRingsProps {
  values: SummaryRingValue[];
  /** Total horizontal width available. Determines ring size. */
  width: number;
  /** Compact mode (used by the sticky header). Hides labels, shrinks rings. */
  compact?: boolean;
  onPressRing?: (id: SummaryRingId) => void;
}

export function DailySummaryRings({
  values,
  width,
  compact = false,
  onPressRing,
}: DailySummaryRingsProps) {
  // Geometry — sized so 3 rings + side padding fit comfortably.
  const horizontalPad = compact ? spacing.md : spacing.lg;
  const availableW = Math.max(0, width - horizontalPad * 2);
  const ringGap = compact ? spacing.sm : spacing.md;
  const ringSize = Math.min(
    compact ? 56 : 110,
    Math.floor((availableW - ringGap * (values.length - 1)) / values.length)
  );

  return (
    <View
      style={[
        styles.row,
        { gap: ringGap, paddingHorizontal: horizontalPad },
      ]}
    >
      {values.map((v) => (
        <SummaryRing
          key={v.id}
          value={v}
          size={ringSize}
          compact={compact}
          onPress={onPressRing}
        />
      ))}
    </View>
  );
}

function SummaryRing({
  value,
  size,
  compact,
  onPress,
}: {
  value: SummaryRingValue;
  size: number;
  compact: boolean;
  onPress?: (id: SummaryRingId) => void;
}) {
  const color = resolveRingColor(value);
  const pct = value.value == null ? 0 : Math.max(0, Math.min(100, value.value));

  const strokeWidth = compact ? 5 : 8;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  // Animated fill 0 → pct over 1s on first paint, retriggers when pct changes.
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withTiming(pct, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct, fill]);

  // Subtle pulse for an "alive" feel — only when there's data.
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (value.value == null) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [pulse, value.value]);

  // The arc path — open ring (starts at top, sweeps clockwise).
  const path = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const sweep = (fill.value / 100) * 360;
    if (sweep <= 0.1) return p;
    // Skia uses degrees in addArc with start angle measured from 3-o'clock
    // (X-axis). We want 12 o'clock so we shift by -90.
    const rect = {
      x: center - radius,
      y: center - radius,
      width: radius * 2,
      height: radius * 2,
    };
    p.addArc(rect, -90, sweep);
    return p;
  });

  // Track (full circle) path — drawn once as a static, dimmed background.
  const trackPath = React.useMemo(() => {
    const p = Skia.Path.Make();
    p.addCircle(center, center, radius);
    return p;
  }, [center, radius]);

  const glowOpacity = useDerivedValue(() => 0.18 + pulse.value * 0.2);

  const display =
    value.centerOverride !== undefined
      ? value.centerOverride
      : value.value == null
        ? "—"
        : `${Math.round(pct)}${value.unit ?? "%"}`;

  return (
    <Pressable
      onPress={onPress ? () => onPress(value.id) : undefined}
      style={[styles.ringWrap, { width: size }]}
      hitSlop={6}
    >
      <View style={{ width: size, height: size }}>
        <Canvas style={{ width: size, height: size }}>
          {/* Track */}
          <Path
            path={trackPath}
            style="stroke"
            strokeWidth={strokeWidth}
            strokeCap="round"
            color={color.glow}
            opacity={0.55}
          />
          {/* Halo behind score arc */}
          <Group opacity={glowOpacity}>
            <Path
              path={path}
              style="stroke"
              strokeWidth={strokeWidth + 6}
              strokeCap="round"
              color={color.base}
            />
          </Group>
          {/* Foreground arc with sweep gradient (gives that "energy lit"
              luminous feel — brightest at the tip). */}
          <Path
            path={path}
            style="stroke"
            strokeWidth={strokeWidth}
            strokeCap="round"
          >
            <SweepGradient
              c={vec(center, center)}
              colors={[color.gradient[1], color.gradient[0], color.gradient[1]]}
            />
          </Path>
        </Canvas>
        {/* Center label (RN text on top of the canvas). */}
        <View pointerEvents="none" style={styles.centerLabel}>
          <Text
            style={[
              compact ? typography.numberSm : typography.numberMd,
              { color: text.primary, fontSize: compact ? 11 : 17 },
            ]}
            numberOfLines={1}
          >
            {display}
          </Text>
        </View>
      </View>
      {!compact && (
        <View style={styles.captionRow}>
          <Text style={styles.captionLabel}>{value.label}</Text>
          <Ionicons
            name="chevron-forward"
            size={12}
            color={text.tertiary}
            style={{ marginTop: 1 }}
          />
        </View>
      )}
    </Pressable>
  );
}

/**
 * Resolve the visual tint for a ring. Falls back to a per-id default from
 * `dataColors` if no `value.color` override is provided. Custom overrides
 * (Elysia tab) skip the default entirely.
 */
function resolveRingColor(value: SummaryRingValue): {
  base: string;
  gradient: readonly [string, string];
  glow: string;
} {
  if (value.color?.kind === "custom") {
    return {
      base: value.color.base,
      gradient: value.color.gradient,
      glow: value.color.glow,
    };
  }
  if (value.color?.kind === "data") {
    return dataColors[value.color.key];
  }
  // Defaults per built-in id.
  switch (value.id) {
    case "sleep":
      return dataColors.sleep;
    case "recovery":
      return dataColors.recovery;
    case "strain":
      return dataColors.strain;
    case "active":
      return dataColors.habits;
    case "consistency":
      return dataColors.recovery;
    case "planned":
      return dataColors.activity;
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  ringWrap: {
    alignItems: "center",
    gap: spacing.xs,
  },
  centerLabel: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  captionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  captionLabel: {
    ...typography.caption,
    color: text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontSize: 10,
  },
  // appease lint
  _: { borderColor: borderTokens.subtle },
});
