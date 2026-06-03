/**
 * AddManualSleepSheet
 *
 * Bottom-sheet for manually logging or editing a sleep session.
 *
 * Wake-day anchor:
 *   The "wake day" is always the day currently selected in the week-
 *   dots picker (passed in as `defaultDay`). The two per-field day
 *   chips allow only that day or the day before — bedtime/wake-time
 *   can never escape the selected night, which keeps the data clean.
 *
 * Type-aware defaults:
 *   • Primary  → Started = day-before · 23:00,  Woke = wake-day · 07:00
 *   • Nap      → Started = now (rounded down 5min),
 *                Woke    = now + 1h
 *   The Nap default is computed at the moment the user switches to
 *   the Nap tab so it reflects "right now" — the realistic moment a
 *   user logs a freshly-taken nap.
 *
 * Time entry:
 *   No raw text inputs — both Started and Woke up open a separate
 *   `TimePickerSheet` (idiot-proof scroll wheels). Day is chosen via
 *   per-field chips above the time button.
 *
 * Edit mode:
 *   Pre-fills with an existing manual session, swaps the CTA to
 *   "Update sleep", exposes a destructive Delete link. Update is
 *   modelled as `delete-old + add-new` since the manual sessionId is
 *   derived from the start/end timestamps server-side.
 *
 * Android-nav safety:
 *   88% snap + safe-area bottom padding keep the CTA above the system
 *   gesture pill at all times. No keyboard ever pops up here.
 */
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetModal as BottomSheetModalType,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@convex/_generated/api";
import {
  borderTokens,
  colors,
  dataColors,
  fontFamily,
  semantic,
  spacing,
  surface,
} from "@/theme";
import { TimePickerSheet, type TimePickerSheetHandle } from "./TimePickerSheet";

// ─── Types ───────────────────────────────────────────────────────────────────

type Kind = "primary" | "nap";

export interface EditSession {
  sessionId: string;
  startTime: string;
  endTime: string;
  kind: Kind;
  note?: string | null;
}

export interface AddManualSleepSheetHandle {
  presentAdd: () => void;
  presentEdit: (session: EditSession) => void;
  /**
   * Open in add-mode with times pre-filled. Used when long-pressing a
   * device-recorded session: there is no sessionId to update so the
   * user's save creates a fresh manual entry (override semantics).
   */
  presentPrefilled: (args: {
    startTime: string;
    endTime: string;
    kind: Kind;
  }) => void;
  dismiss: () => void;
}

interface Props {
  defaultDay: string; // ISO YYYY-MM-DD, the wake-day
  onSubmitted?: () => void;
}

// ─── Date helpers ────────────────────────────────────────────────────────────

function dayDate(isoDay: string): Date {
  const [y, mo, d] = isoDay.split("-").map(Number);
  return new Date(y, (mo ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

function shiftDays(base: Date, delta: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + delta);
  return d;
}

function isoFor(base: Date, h: number, m: number): string {
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function hmFromIso(iso: string): { h: number; m: number } {
  const d = new Date(iso);
  return { h: d.getHours(), m: d.getMinutes() };
}

function shortDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatAmPm(h: number, m: number): string {
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

function roundDownTo5(min: number): number {
  return Math.floor(min / 5) * 5;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const AddManualSleepSheet = forwardRef<AddManualSleepSheetHandle, Props>(
  ({ defaultDay, onSubmitted }, ref) => {
    const sheetRef = useRef<BottomSheetModalType>(null);
    const timePickerRef = useRef<TimePickerSheetHandle>(null);
    const insets = useSafeAreaInsets();
    const add = useMutation(api.sleep.addManualSleepSession);
    const remove = useMutation(api.sleep.deleteManualSleepSession);

    const snapPoints = useMemo(() => ["80%"], []);

    const [editing, setEditing] = useState<EditSession | null>(null);
    const [kind, setKind] = useState<Kind>("primary");
    // 0 = day before wake-day, 1 = wake-day itself
    const [startDayOffset, setStartDayOffset] = useState<0 | 1>(0);
    const [endDayOffset, setEndDayOffset] = useState<0 | 1>(1);
    const [startHour, setStartHour] = useState(23);
    const [startMin, setStartMin] = useState(0);
    const [endHour, setEndHour] = useState(7);
    const [endMin, setEndMin] = useState(0);
    const [note, setNote] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const wakeDay = useMemo(() => dayDate(defaultDay), [defaultDay]);
    const dayBefore = useMemo(() => shiftDays(wakeDay, -1), [wakeDay]);

    const resetForAdd = useCallback(
      (nextKind: Kind = "primary") => {
        setEditing(null);
        setKind(nextKind);
        setNote("");
        if (nextKind === "primary") {
          setStartDayOffset(0);
          setEndDayOffset(1);
          setStartHour(23);
          setStartMin(0);
          setEndHour(7);
          setEndMin(0);
        } else {
          // Nap → "now" / "now + 1h" rounded to nearest 5 minutes,
          // both anchored to the wake-day (selected day).
          const now = new Date();
          const startH = now.getHours();
          const startM = roundDownTo5(now.getMinutes());
          let endH = startH + 1;
          if (endH > 23) endH = 23;
          setStartDayOffset(1);
          setEndDayOffset(1);
          setStartHour(startH);
          setStartMin(startM);
          setEndHour(endH);
          setEndMin(startM);
        }
      },
      []
    );

    const hydrateFromEdit = useCallback(
      (session: EditSession) => {
        setEditing(session);
        setKind(session.kind);
        setNote(session.note ?? "");
        const s = hmFromIso(session.startTime);
        const e = hmFromIso(session.endTime);
        setStartHour(s.h);
        setStartMin(s.m);
        setEndHour(e.h);
        setEndMin(e.m);
        const startMidnight = new Date(session.startTime);
        startMidnight.setHours(0, 0, 0, 0);
        const endMidnight = new Date(session.endTime);
        endMidnight.setHours(0, 0, 0, 0);
        const wakeMs = wakeDay.getTime();
        const startDelta = Math.round((startMidnight.getTime() - wakeMs) / 86_400_000);
        const endDelta = Math.round((endMidnight.getTime() - wakeMs) / 86_400_000);
        setStartDayOffset(startDelta === 0 ? 1 : 0);
        setEndDayOffset(endDelta === 0 ? 1 : 0);
      },
      [wakeDay]
    );

    const hydrateFromPrefill = useCallback(
      (args: { startTime: string; endTime: string; kind: Kind }) => {
        setEditing(null);
        setKind(args.kind);
        setNote("");
        const s = hmFromIso(args.startTime);
        const e = hmFromIso(args.endTime);
        setStartHour(s.h);
        setStartMin(s.m);
        setEndHour(e.h);
        setEndMin(e.m);
        const startMidnight = new Date(args.startTime);
        startMidnight.setHours(0, 0, 0, 0);
        const endMidnight = new Date(args.endTime);
        endMidnight.setHours(0, 0, 0, 0);
        const wakeMs = wakeDay.getTime();
        const startDelta = Math.round((startMidnight.getTime() - wakeMs) / 86_400_000);
        const endDelta = Math.round((endMidnight.getTime() - wakeMs) / 86_400_000);
        setStartDayOffset(startDelta === 0 ? 1 : 0);
        setEndDayOffset(endDelta === 0 ? 1 : 0);
      },
      [wakeDay]
    );

    useImperativeHandle(
      ref,
      (): AddManualSleepSheetHandle => ({
        presentAdd: () => {
          resetForAdd("primary");
          sheetRef.current?.present();
        },
        presentEdit: (session) => {
          hydrateFromEdit(session);
          sheetRef.current?.present();
        },
        presentPrefilled: (args) => {
          hydrateFromPrefill(args);
          sheetRef.current?.present();
        },
        dismiss: () => sheetRef.current?.dismiss(),
      }),
      [resetForAdd, hydrateFromEdit, hydrateFromPrefill]
    );

    const onChangeKind = useCallback(
      (next: Kind) => {
        if (editing) {
          setKind(next);
          return;
        }
        resetForAdd(next);
      },
      [editing, resetForAdd]
    );

    const openStartPicker = () => {
      timePickerRef.current?.present(
        { hours: startHour, minutes: startMin, title: "Start time" },
        (h, m) => {
          setStartHour(h);
          setStartMin(m);
        }
      );
    };

    const openEndPicker = () => {
      timePickerRef.current?.present(
        { hours: endHour, minutes: endMin, title: "Wake time" },
        (h, m) => {
          setEndHour(h);
          setEndMin(m);
        }
      );
    };

    const submit = async () => {
      const startBase = startDayOffset === 0 ? dayBefore : wakeDay;
      const endBase = endDayOffset === 0 ? dayBefore : wakeDay;
      const startIso = isoFor(startBase, startHour, startMin);
      const endIso = isoFor(endBase, endHour, endMin);

      if (Date.parse(endIso) <= Date.parse(startIso)) {
        Alert.alert(
          "Invalid window",
          "End must be after start. Tip: check whether the bedtime belongs to the day before."
        );
        return;
      }

      setSubmitting(true);
      try {
        if (editing) {
          await remove({ sessionId: editing.sessionId });
        }
        await add({
          startTime: startIso,
          endTime: endIso,
          kind,
          note: note || undefined,
        });
        onSubmitted?.();
        sheetRef.current?.dismiss();
      } catch (err) {
        Alert.alert("Save failed", (err as Error).message);
      } finally {
        setSubmitting(false);
      }
    };

    const onDelete = () => {
      if (!editing) return;
      Alert.alert("Delete sleep entry?", "This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setSubmitting(true);
            try {
              await remove({ sessionId: editing.sessionId });
              onSubmitted?.();
              sheetRef.current?.dismiss();
            } catch (err) {
              Alert.alert("Delete failed", (err as Error).message);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]);
    };

    const onDismiss = useCallback(() => {
      setEditing(null);
    }, []);

    const cta = editing ? "Update sleep" : "Save sleep";
    const title = editing ? "Edit sleep entry" : "Log sleep manually";
    const bottomPad = Math.max(insets.bottom, 16) + spacing.lg;

    return (
      <>
        <BottomSheetModal
          ref={sheetRef}
          snapPoints={snapPoints}
          onDismiss={onDismiss}
          bottomInset={0}
          backgroundStyle={{ backgroundColor: surface.raised }}
          handleIndicatorStyle={{ backgroundColor: borderTokens.strong }}
          backdropComponent={(p) => (
            <BottomSheetBackdrop
              {...p}
              appearsOnIndex={0}
              disappearsOnIndex={-1}
              opacity={0.6}
            />
          )}
        >
          <BottomSheetView style={[styles.container, { paddingBottom: bottomPad }]}>
            <Text style={styles.title}>{title}</Text>

            {/* TYPE */}
            <View style={styles.fieldRow}>
              <Text style={styles.label}>Type</Text>
              <View style={styles.segment}>
                {(["primary", "nap"] as const).map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => onChangeKind(opt)}
                    style={[styles.segmentBtn, kind === opt && styles.segmentBtnActive]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        kind === opt && styles.segmentTextActive,
                      ]}
                    >
                      {opt === "primary" ? "Primary sleep" : "Nap"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* STARTED */}
            <DayTimeField
              label="Started"
              hint="Bed time"
              offset={startDayOffset}
              onOffsetChange={setStartDayOffset}
              valueLabel={formatAmPm(startHour, startMin)}
              onOpenPicker={openStartPicker}
              dayBefore={dayBefore}
              wakeDay={wakeDay}
            />

            {/* WOKE UP */}
            <DayTimeField
              label="Woke up"
              hint="Wake time"
              offset={endDayOffset}
              onOffsetChange={setEndDayOffset}
              valueLabel={formatAmPm(endHour, endMin)}
              onOpenPicker={openEndPicker}
              dayBefore={dayBefore}
              wakeDay={wakeDay}
            />

            {/* NOTE */}
            <View style={styles.fieldRow}>
              <Text style={styles.label}>Note (optional)</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Anything noteworthy"
                placeholderTextColor={colors.textTertiary}
                style={styles.noteInput}
                multiline
              />
            </View>

            <View style={{ flex: 1 }} />

            <Pressable
              onPress={submit}
              disabled={submitting}
              style={[styles.submit, submitting && { opacity: 0.5 }]}
            >
              <Text style={styles.submitText}>{submitting ? "Saving..." : cta}</Text>
            </Pressable>

            {editing ? (
              <Pressable
                onPress={onDelete}
                disabled={submitting}
                style={styles.deleteBtn}
                hitSlop={10}
              >
                <Ionicons name="trash-outline" size={14} color={semantic.destructive} />
                <Text style={styles.deleteText}>Delete entry</Text>
              </Pressable>
            ) : null}
          </BottomSheetView>
        </BottomSheetModal>

        <TimePickerSheet ref={timePickerRef} />
      </>
    );
  }
);

AddManualSleepSheet.displayName = "AddManualSleepSheet";

// ─── Subcomponent: per-field day + time picker button ────────────────────────

function DayTimeField({
  label,
  hint,
  offset,
  onOffsetChange,
  valueLabel,
  onOpenPicker,
  dayBefore,
  wakeDay,
}: {
  label: string;
  hint?: string;
  offset: 0 | 1;
  onOffsetChange: (next: 0 | 1) => void;
  valueLabel: string;
  onOpenPicker: () => void;
  dayBefore: Date;
  wakeDay: Date;
}) {
  return (
    <View style={styles.fieldRow}>
      <View style={styles.fieldHeaderRow}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>

      <View style={styles.daySegment}>
        {[
          { off: 0 as const, date: dayBefore },
          { off: 1 as const, date: wakeDay },
        ].map(({ off, date }) => (
          <Pressable
            key={off}
            onPress={() => onOffsetChange(off)}
            style={[styles.dayChip, offset === off && styles.dayChipActive]}
          >
            <Text
              style={[styles.dayChipText, offset === off && styles.dayChipTextActive]}
            >
              {shortDate(date)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={onOpenPicker} style={styles.timeButton}>
        <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.timeButtonText}>{valueLabel}</Text>
        <Ionicons
          name="chevron-down"
          size={14}
          color={colors.textTertiary}
          style={{ marginLeft: "auto" }}
        />
      </Pressable>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  title: {
    fontFamily: fontFamily.heading,
    fontSize: 20,
    color: colors.textPrimary,
  },
  fieldRow: { gap: 8 },
  fieldHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  hint: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    color: colors.textTertiary,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: surface.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    overflow: "hidden",
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  segmentBtnActive: {
    backgroundColor: dataColors.sleep.base + "33",
  },
  segmentText: {
    fontFamily: fontFamily.bodyMedium,
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
  },
  daySegment: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  dayChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: surface.card,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
  },
  dayChipActive: {
    backgroundColor: dataColors.sleep.base + "26",
    borderColor: dataColors.sleep.base,
  },
  dayChipText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  dayChipTextActive: {
    color: colors.textPrimary,
    fontFamily: fontFamily.bodyBold,
  },
  timeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: surface.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  timeButtonText: {
    fontFamily: fontFamily.monoBold,
    color: colors.textPrimary,
    fontSize: 18,
    fontVariant: ["tabular-nums"],
  },
  noteInput: {
    minHeight: 60,
    backgroundColor: surface.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    color: colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fontFamily.body,
    fontSize: 14,
  },
  submit: {
    marginTop: spacing.sm,
    backgroundColor: dataColors.sleep.base,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitText: {
    fontFamily: fontFamily.bodyBold,
    color: "#0B1020",
    fontSize: 16,
  },
  deleteBtn: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  deleteText: {
    fontFamily: fontFamily.bodyMedium,
    color: semantic.destructive,
    fontSize: 13,
  },
});
