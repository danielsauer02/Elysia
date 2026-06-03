/**
 * RecoveryWeekDotsBar
 *
 * Recovery twin of the sleep WeekDotsBar: 7 weekday columns (oldest left,
 * today right), each with a quality-coloured dot. Reads/writes the selected
 * day from RecoveryContext.
 *
 * Dot colour mirrors the recovery quality band:
 *   high     → success-green
 *   moderate → off-white
 *   low      → red
 *   missing  → very dim
 */
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRecoveryContext } from "@/context/RecoveryContext";
import { colors, dataColors, fontFamily, semantic, spacing } from "@/theme";

const DAY_MS = 86_400_000;
const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

type RecoveryQuality = "high" | "moderate" | "low";

interface Props {
  /** Output of getRecoveryFitnessRange. */
  week: Array<{ day: string; recovery: { quality: RecoveryQuality } | null }>;
}

function colorForQuality(q: RecoveryQuality | null): string {
  if (q === "high") return semantic.success;
  if (q === "moderate") return colors.textPrimary;
  if (q === "low") return semantic.destructive;
  return "rgba(255,255,255,0.18)";
}

function isoMinusDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) - n * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function RecoveryWeekDotsBar({ week }: Props) {
  const { selectedDay, setSelectedDay } = useRecoveryContext();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const entries = useMemo(() => {
    const byDay = new Map(week.map((r) => [r.day, r] as const));
    const out: Array<{
      day: string;
      quality: RecoveryQuality | null;
      letter: string;
      isToday: boolean;
      isSelected: boolean;
    }> = [];
    for (let i = 6; i >= 0; i--) {
      const day = isoMinusDays(today, i);
      const row = byDay.get(day);
      const dow = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
      out.push({
        day,
        quality: row?.recovery?.quality ?? null,
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
                e.isToday && styles.pillToday,
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
  cellWrap: { flex: 1, alignItems: "center" },
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
  pillToday: { backgroundColor: dataColors.recovery.base + "26" },
  pillSelected: { borderColor: "rgba(255,255,255,0.18)" },
  letter: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.4,
    color: "rgba(255,255,255,0.85)",
  },
  letterActive: { color: colors.textPrimary, fontFamily: fontFamily.bodyBold },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
