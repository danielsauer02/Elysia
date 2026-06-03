/**
 * EnergyReserveCard
 *
 * Ultra-thin Bevel-style "body battery" strip for the /recovery main view.
 * Just a heading + a single slim pill: a standalone lightning bolt (tinted by
 * level), a vertical-stroke scale (filled strokes + grey remainder), and a
 * small right-aligned percentage. No descriptive copy — tapping opens the
 * /energy-reserve deep dive.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { energyLevelColor } from "./energyColors";
import {
  borderTokens,
  colors,
  fontFamily,
  spacing,
  surface,
} from "@/theme";

interface Props {
  day: string;
}

const STROKE_COUNT = 34;

export function EnergyReserveCard({ day }: Props) {
  const router = useRouter();
  const data = useQuery(api.recovery.getEnergyReserve, { day });

  const current = data?.current ?? null;
  const pct = current === null ? 0 : Math.max(0, Math.min(100, current));
  const filled = Math.round((pct / 100) * STROKE_COUNT);
  const tint = energyLevelColor(current);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Energy Reserve</Text>
      </View>

      <View style={styles.body}>
        <Pressable
          onPress={() =>
            router.push({ pathname: "/energy-reserve", params: { day } })
          }
          style={styles.pill}
        >
          <Ionicons name="flash" size={16} color={tint} style={styles.bolt} />

          <View style={styles.strokes}>
            {Array.from({ length: STROKE_COUNT }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.stroke,
                  { backgroundColor: i < filled ? tint : "rgba(255,255,255,0.10)" },
                ]}
              />
            ))}
          </View>

          <Text style={styles.pct}>{current === null ? "—" : `${current}%`}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xxl, gap: spacing.sm },
  header: { paddingHorizontal: spacing.lg },
  title: { fontFamily: fontFamily.heading, fontSize: 18, color: colors.textPrimary },
  body: { paddingHorizontal: spacing.lg },
  pill: {
    backgroundColor: surface.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    height: 46,
    gap: 10,
  },
  bolt: { width: 16 },
  strokes: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stroke: {
    width: 3,
    height: 18,
    borderRadius: 1.5,
  },
  pct: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 14,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
    minWidth: 38,
    textAlign: "right",
  },
});
