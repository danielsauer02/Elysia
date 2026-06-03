/**
 * TimePickerSheet
 *
 * Idiot-proof HH:MM picker shown as a separate bottom sheet on top of
 * `AddManualSleepSheet`. Two snap-and-decelerate scroll columns:
 *   • hours   0–23 (24-hour internal model, displayed as 12h AM/PM)
 *   • minutes 0–59
 * A central highlight bar marks the selection; momentum-end snaps to
 * the nearest item. No raw text input → no `63:99` typos possible.
 *
 * The picker is compact (~210px tall body + safe-area) so it sits on
 * top of the manual-add sheet without obscuring the day-chips above.
 *
 * Open / close handled via an imperative ref handle:
 *   ref.current?.present({ hours, minutes, title }, onConfirm)
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetModal as BottomSheetModalType,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  borderTokens,
  colors,
  dataColors,
  fontFamily,
  spacing,
  surface,
} from "@/theme";

const ITEM_H = 40;
const VISIBLE = 5; // odd
const PAD = Math.floor(VISIBLE / 2);

interface PresentArgs {
  hours: number;
  minutes: number;
  title: string;
}

export interface TimePickerSheetHandle {
  present: (args: PresentArgs, onConfirm: (h: number, m: number) => void) => void;
  dismiss: () => void;
}

export const TimePickerSheet = forwardRef<TimePickerSheetHandle>((_, ref) => {
  const sheetRef = useRef<BottomSheetModalType>(null);
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(0);
  const onConfirmRef = useRef<((h: number, m: number) => void) | null>(null);

  // Snap to compact height that fits both wheels + a Done button.
  const bodyHeight = ITEM_H * VISIBLE;
  const sheetHeight = bodyHeight + 180 + insets.bottom; // header + cta + safe
  const snapPoints = useMemo(() => [sheetHeight], [sheetHeight]);

  useImperativeHandle(
    ref,
    (): TimePickerSheetHandle => ({
      present: (args, cb) => {
        setTitle(args.title);
        setHour(Math.max(0, Math.min(23, Math.floor(args.hours))));
        setMinute(Math.max(0, Math.min(59, Math.floor(args.minutes))));
        onConfirmRef.current = cb;
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
    }),
    []
  );

  const confirm = () => {
    onConfirmRef.current?.(hour, minute);
    sheetRef.current?.dismiss();
  };

  const ampm = useMemo(() => {
    const period = hour < 12 ? "AM" : "PM";
    const h12 = hour % 12 || 12;
    return `${h12}:${minute.toString().padStart(2, "0")} ${period}`;
  }, [hour, minute]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      backgroundStyle={{ backgroundColor: surface.raised }}
      handleIndicatorStyle={{ backgroundColor: borderTokens.strong }}
      backdropComponent={(p) => (
        <BottomSheetBackdrop
          {...p}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.55}
          pressBehavior="close"
        />
      )}
    >
      <BottomSheetView
        style={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom, 12) + spacing.md },
        ]}
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.preview}>{ampm}</Text>

        <View style={styles.wheelRow}>
          <WheelColumn
            range={24}
            value={hour}
            onChange={setHour}
            renderLabel={(v) => {
              const period = v < 12 ? "AM" : "PM";
              const h12 = v % 12 || 12;
              return `${h12.toString().padStart(2, " ")}`;
            }}
            secondary={(v) => (v < 12 ? "AM" : "PM")}
          />
          <Text style={styles.colon}>:</Text>
          <WheelColumn
            range={60}
            value={minute}
            onChange={setMinute}
            renderLabel={(v) => v.toString().padStart(2, "0")}
          />
        </View>

        <Pressable onPress={confirm} style={styles.cta}>
          <Text style={styles.ctaText}>Done</Text>
        </Pressable>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

TimePickerSheet.displayName = "TimePickerSheet";

// ─── Wheel column ────────────────────────────────────────────────────────────

interface WheelColumnProps {
  range: number; // 0..range-1
  value: number;
  onChange: (v: number) => void;
  renderLabel: (v: number) => string;
  secondary?: (v: number) => string;
}

function WheelColumn({ range, value, onChange, renderLabel, secondary }: WheelColumnProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [mounted, setMounted] = useState(false);
  const values = useMemo(() => Array.from({ length: range }, (_, i) => i), [range]);

  useEffect(() => {
    if (!mounted) return;
    scrollRef.current?.scrollTo({ y: value * ITEM_H, animated: false });
    // Sync once after mount; subsequent value changes from outside ignored
    // to avoid fighting the user's gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const idx = Math.round(y / ITEM_H);
      const clamped = Math.max(0, Math.min(range - 1, idx));
      if (clamped !== value) onChange(clamped);
    },
    [onChange, range, value]
  );

  const padded: (number | null)[] = [
    ...Array<null>(PAD).fill(null),
    ...values,
    ...Array<null>(PAD).fill(null),
  ];

  return (
    <View style={styles.wheelCol}>
      <View
        pointerEvents="none"
        style={[styles.wheelHighlight, { top: ITEM_H * PAD, height: ITEM_H }]}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
        onLayout={() => setMounted(true)}
      >
        {padded.map((v, i) => {
          const dataIdx = i - PAD;
          const distance = Math.abs(dataIdx - value);
          const opacity = distance === 0 ? 1 : distance === 1 ? 0.55 : 0.22;
          const isCenter = distance === 0 && v !== null;
          return (
            <View key={i} style={styles.wheelItem}>
              {v !== null ? (
                <View style={styles.wheelLabelRow}>
                  <Text
                    style={[styles.wheelLabel, isCenter && styles.wheelLabelActive, { opacity }]}
                  >
                    {renderLabel(v)}
                  </Text>
                  {secondary ? (
                    <Text style={[styles.wheelMeridiem, { opacity }]}>{secondary(v)}</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    alignItems: "stretch",
  },
  title: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 13,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    textAlign: "center",
  },
  preview: {
    fontFamily: fontFamily.monoBold,
    fontSize: 26,
    color: colors.textPrimary,
    textAlign: "center",
    marginTop: 6,
    marginBottom: spacing.md,
    fontVariant: ["tabular-nums"],
  },
  wheelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  wheelCol: {
    width: 96,
    height: ITEM_H * VISIBLE,
    position: "relative",
  },
  wheelHighlight: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: dataColors.sleep.base + "1F",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: dataColors.sleep.base + "60",
    borderRadius: 8,
  },
  wheelItem: {
    height: ITEM_H,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelLabelRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  wheelLabel: {
    fontFamily: fontFamily.mono,
    color: colors.textPrimary,
    fontSize: 22,
    fontVariant: ["tabular-nums"],
  },
  wheelLabelActive: {
    fontFamily: fontFamily.monoBold,
  },
  wheelMeridiem: {
    fontFamily: fontFamily.bodyBold,
    color: colors.textSecondary,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  colon: {
    fontFamily: fontFamily.monoBold,
    color: colors.textPrimary,
    fontSize: 26,
  },
  cta: {
    marginTop: spacing.lg,
    backgroundColor: dataColors.sleep.base,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaText: {
    fontFamily: fontFamily.bodyBold,
    color: "#0B1020",
    fontSize: 16,
  },
});
