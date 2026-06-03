/**
 * EnergyCalendarSheet
 *
 * Bevel-style month calendar presented as a tall bottom sheet that slides up
 * over the screen (drag the handle down to dismiss). Month navigation with
 * ‹ ›, a "Today" jump, and an info button toggling a legend. Tapping a day
 * selects it and closes the sheet.
 *
 * Each past day with data shows a mini battery: a colour fill at the day's
 * end-of-day level plus a dashed marker for the peak it reached.
 *
 * Imperative API (mirrors the app's other sheets):
 *   ref.current?.present()  /  ref.current?.dismiss()
 */
import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetModal as BottomSheetModalType,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  ENERGY_AMBER,
  ENERGY_GREEN,
  ENERGY_RED,
  energyLevelColor,
} from "./energyColors";
import { borderTokens, colors, dataColors, fontFamily, spacing, surface } from "@/theme";

export interface EnergyCalendarSheetHandle {
  present: () => void;
  dismiss: () => void;
}

interface Props {
  selectedDay: string; // YYYY-MM-DD (UTC)
  onSelect: (day: string) => void;
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
function dayStr(y: number, m0: number, d: number): string {
  return `${y}-${pad(m0 + 1)}-${pad(d)}`;
}
/** Monday-first weekday index (0=Mon..6=Sun) of the month's first day. */
function firstWeekdayMon(y: number, m0: number): number {
  return (new Date(Date.UTC(y, m0, 1)).getUTCDay() + 6) % 7;
}
function daysInMonth(y: number, m0: number): number {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
}

export const EnergyCalendarSheet = forwardRef<EnergyCalendarSheetHandle, Props>(
  ({ selectedDay, onSelect }, ref) => {
    const sheetRef = useRef<BottomSheetModalType>(null);
    const insets = useSafeAreaInsets();
    const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
    const [year, setYear] = useState(() => Number(selectedDay.slice(0, 4)));
    const [month0, setMonth0] = useState(() => Number(selectedDay.slice(5, 7)) - 1);
    const [showLegend, setShowLegend] = useState(false);

    const snapPoints = useMemo(() => ["92%"], []);

    useImperativeHandle(
      ref,
      (): EnergyCalendarSheetHandle => ({
        present: () => {
          setYear(Number(selectedDay.slice(0, 4)));
          setMonth0(Number(selectedDay.slice(5, 7)) - 1);
          sheetRef.current?.present();
        },
        dismiss: () => sheetRef.current?.dismiss(),
      }),
      [selectedDay]
    );

    const from = dayStr(year, month0, 1);
    const to = dayStr(year, month0, daysInMonth(year, month0));
    const monthData = useQuery(api.recovery.getEnergyReserveMonth, { from, to });

    const byDay = useMemo(() => {
      const m = new Map<string, { endLevel: number; maxLevel: number }>();
      for (const d of monthData ?? []) m.set(d.day, { endLevel: d.endLevel, maxLevel: d.maxLevel });
      return m;
    }, [monthData]);

    const lead = firstWeekdayMon(year, month0);
    const total = daysInMonth(year, month0);
    const cells: Array<number | null> = [
      ...Array.from({ length: lead }, () => null),
      ...Array.from({ length: total }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const stepMonth = (dir: -1 | 1) => {
      let m = month0 + dir;
      let y = year;
      if (m < 0) { m = 11; y -= 1; }
      if (m > 11) { m = 0; y += 1; }
      setMonth0(m);
      setYear(y);
    };

    const goToday = () => {
      setYear(Number(today.slice(0, 4)));
      setMonth0(Number(today.slice(5, 7)) - 1);
      onSelect(today);
      sheetRef.current?.dismiss();
    };

    const pick = (ds: string) => {
      onSelect(ds);
      sheetRef.current?.dismiss();
    };

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: surface.raised }}
        handleIndicatorStyle={{ backgroundColor: borderTokens.strong }}
        backdropComponent={(p) => (
          <BottomSheetBackdrop {...p} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.55} pressBehavior="close" />
        )}
      >
        <BottomSheetView style={[styles.body, { paddingBottom: insets.bottom + spacing.lg }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.monthLabel}>
              {MONTHS[month0]} {year}
            </Text>
            <View style={styles.navRow}>
              <Pressable style={styles.navBtn} onPress={() => stepMonth(-1)} hitSlop={8}>
                <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
              </Pressable>
              <Pressable style={styles.navBtn} onPress={() => stepMonth(1)} hitSlop={8}>
                <Ionicons name="chevron-forward" size={18} color={colors.textPrimary} />
              </Pressable>
            </View>
          </View>

          {/* Weekday row */}
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={styles.weekday}>{w}</Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.grid}>
            {cells.map((dom, i) => {
              if (dom === null) return <View key={`e${i}`} style={styles.cell} />;
              const ds = dayStr(year, month0, dom);
              const entry = byDay.get(ds);
              const isToday = ds === today;
              const isSelected = ds === selectedDay;
              const isFuture = ds > today;
              return (
                <Pressable
                  key={ds}
                  style={[styles.cell, isSelected && styles.cellSelected]}
                  onPress={() => pick(ds)}
                  disabled={isFuture}
                >
                  {entry && !isFuture ? (
                    <DayBattery endLevel={entry.endLevel} maxLevel={entry.maxLevel} />
                  ) : (
                    <View style={styles.emptyRing} />
                  )}
                  <Text style={[styles.dom, isToday && styles.domToday, isFuture && styles.domFuture]}>
                    {dom}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable style={styles.todayBtn} onPress={goToday} hitSlop={8}>
              <Text style={styles.todayText}>Today</Text>
            </Pressable>
            <Pressable style={styles.infoBtn} onPress={() => setShowLegend((s) => !s)} hitSlop={8}>
              <Ionicons name="information" size={16} color={colors.textPrimary} />
            </Pressable>
          </View>

          {showLegend ? (
            <View style={styles.legend}>
              <LegendRow color={ENERGY_GREEN} label="Above 50% — well charged" />
              <LegendRow color={ENERGY_AMBER} label="25–50% — running low" />
              <LegendRow color={ENERGY_RED} label="Below 25% — depleted" />
              <View style={styles.legendRow}>
                <View style={styles.legendDash} />
                <Text style={styles.legendText}>Dashed marks the day's peak</Text>
              </View>
            </View>
          ) : null}
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

EnergyCalendarSheet.displayName = "EnergyCalendarSheet";

function DayBattery({ endLevel, maxLevel }: { endLevel: number; maxLevel: number }) {
  const pct = Math.max(0, Math.min(100, endLevel));
  const max = Math.max(0, Math.min(100, maxLevel));
  const tint = energyLevelColor(endLevel);
  return (
    <View style={styles.dayBatt}>
      <View style={[styles.dayBattFill, { width: `${pct}%`, backgroundColor: tint }]} />
      <View style={[styles.dayBattMax, { left: `${max}%` }]} />
    </View>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthLabel: { fontFamily: fontFamily.heading, fontSize: 20, color: colors.textPrimary },
  navRow: { flexDirection: "row", gap: 8 },
  navBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  weekRow: { flexDirection: "row" },
  weekday: {
    flex: 1, textAlign: "center", fontFamily: fontFamily.body,
    fontSize: 11, color: colors.textSecondary,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 6 },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 0.66,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 4,
    borderRadius: 16,
  },
  cellSelected: { backgroundColor: "rgba(255,255,255,0.06)" },
  emptyRing: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.12)",
  },
  dayBatt: {
    width: 26, height: 13, borderRadius: 4,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.25)",
    overflow: "hidden", justifyContent: "center",
  },
  dayBattFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 2 },
  dayBattMax: {
    position: "absolute", top: -1, bottom: -1, width: 1.5,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  dom: { fontFamily: fontFamily.body, fontSize: 12, color: colors.textSecondary },
  domToday: { color: dataColors.recovery.base, fontFamily: fontFamily.bodyBold },
  domFuture: { opacity: 0.4 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  todayBtn: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  todayText: { fontFamily: fontFamily.bodyBold, fontSize: 14, color: dataColors.recovery.base },
  infoBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  legend: {
    gap: 8, padding: spacing.md,
    borderRadius: 14, backgroundColor: "rgba(255,255,255,0.03)",
  },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendDash: { width: 12, height: 0, borderTopWidth: 1.5, borderColor: "rgba(255,255,255,0.55)", borderStyle: "dashed" },
  legendText: { fontFamily: fontFamily.body, fontSize: 13, color: colors.textSecondary },
});
