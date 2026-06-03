/**
 * WeekDotsBar
 *
 * Eight-Sleep style weekday calendar:
 *   - 7 columns, oldest on the left, today on the right
 *   - weekday initial (M T W T F S S) on top, quality-coloured dot below
 *   - "today" sits inside a soft blue pill (8sleep uses grey; we go blue
 *     because that's the sleep brand accent)
 *   - tapping a cell sets `selectedDay` in SleepContext; the selected
 *     cell gets a subtle outline so it never disappears visually
 *
 * Dot colour mirrors the sleep quality classification:
 *   optimal   → success-green
 *   in_range  → off-white
 *   poor      → red
 *   missing   → very dim
 */
import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSleepContext } from "@/context/SleepContext";
import {
  brand,
  colors,
  dataColors,
  fontFamily,
  semantic,
  spacing,
} from "@/theme";

const DAY_MS = 86_400_000;
const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

type Quality = "optimal" | "in_range" | "poor";

interface WeekEntry {
  day: string;
  quality: Quality | null;
  letter: string;
  isToday: boolean;
  isSelected: boolean;
}

interface Props {
  /** Output of getSleepFitnessRange. */
  week: Array<{ day: string; fitness: { quality: Quality } | null }>;
}

function colorForQuality(q: Quality | null): string {
  if (q === "optimal") return semantic.success;
  if (q === "in_range") return colors.textPrimary;
  if (q === "poor") return semantic.destructive;
  return "rgba(255,255,255,0.18)";
}

function isoMinusDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) - n * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function WeekDotsBar({ week }: Props) {
  const { selectedDay, setSelectedDay } = useSleepContext();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const entries = useMemo<WeekEntry[]>(() => {
    const byDay = new Map(week.map((r) => [r.day, r] as const));
    const out: WeekEntry[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = isoMinusDays(today, i);
      const row = byDay.get(day);
      const dow = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
      out.push({
        day,
        quality: row?.fitness?.quality ?? null,
        letter: WEEKDAY_LETTERS[dow] ?? "?",
        isToday: day === today,
        isSelected: day === selectedDay,
      });
    }
    return out;
  }, [week, today, selectedDay]);

  return (
    <View style={styles.row}>
      {entries.map((e) => {
        const dotColor = colorForQuality(e.quality);
        const showPill = e.isToday;
        const showSelectedRing = e.isSelected && !e.isToday;
        return (
          <Pressable
            key={e.day}
            onPress={() => setSelectedDay(e.day)}
            hitSlop={6}
            style={styles.cellWrap}
          >
            <View
              style={[
                styles.pill,
                showPill && styles.pillToday,
                showSelectedRing && styles.pillSelected,
              ]}
            >
              <Text
                style={[
                  styles.letter,
                  (e.isToday || e.isSelected) && styles.letterActive,
                ]}
              >
                {e.letter}
              </Text>
              <View style={[styles.dot, { backgroundColor: dotColor }]} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xs,
  },
  cellWrap: {
    flex: 1,
    alignItems: "center",
  },
  pill: {
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: "transparent",
  },
  pillToday: {
    backgroundColor: dataColors.sleep.base + "26",
  },
  pillSelected: {
    borderColor: "rgba(255,255,255,0.18)",
  },
  letter: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.4,
    // White on the wallpaper glass so every weekday stays readable.
    color: "rgba(255,255,255,0.85)",
  },
  letterActive: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

void brand;
