/**
 * SleepTimeline
 *
 * Sleep activities card + influencing-factor tags + manual-add CTA.
 *
 * Edit flow:
 *   • Long-press (~600ms) on a manual session → haptic via the card
 *     itself → opens a small contextual menu with an Edit action.
 *   • Tap Edit → opens the `AddManualSleepSheet` in edit mode
 *     (prefilled, with destructive Delete inside the sheet).
 *   • Primary (device-recorded) sessions are read-only — long-press
 *     simply does nothing because no callback is wired.
 */
import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SleepActivityCard } from "./SleepActivityCard";
import { SleepActivityEditMenu } from "./SleepActivityEditMenu";
import { NightTagsRow } from "./NightTagsRow";
import {
  AddManualSleepSheet,
  type AddManualSleepSheetHandle,
  type EditSession,
} from "./AddManualSleepSheet";
import {
  borderTokens,
  colors,
  fontFamily,
  spacing,
  surface,
} from "@/theme";

interface NightPayload {
  stages?: {
    primary?: { start: string; end: string; source: string } | null;
  };
  manualSessions: Array<{
    sessionId: string;
    startTime: string;
    endTime: string;
    kind: "primary" | "nap";
    note?: string | null;
  }>;
  tags: string[];
}

interface Props {
  day: string;
  night: NightPayload | null;
}

type MenuTarget =
  | { mode: "edit"; session: EditSession }
  | { mode: "prefill"; startTime: string; endTime: string; kind: "primary" | "nap" };

export function SleepTimeline({ day, night }: Props) {
  const sheetRef = useRef<AddManualSleepSheetHandle>(null);
  const [menuFor, setMenuFor] = useState<MenuTarget | null>(null);

  const primary = night?.stages?.primary ?? null;
  const manuals = night?.manualSessions ?? [];
  const showEmpty = !primary && manuals.length === 0;

  const closeMenu = () => setMenuFor(null);
  const openEditFromMenu = () => {
    const target = menuFor;
    setMenuFor(null);
    if (!target) return;
    if (target.mode === "edit") {
      sheetRef.current?.presentEdit(target.session);
    } else {
      sheetRef.current?.presentPrefilled({
        startTime: target.startTime,
        endTime: target.endTime,
        kind: target.kind,
      });
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Sleep activities</Text>
        <Pressable
          onPress={() => sheetRef.current?.presentAdd()}
          style={styles.addBtn}
          hitSlop={10}
        >
          <Ionicons name="add" size={18} color={colors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.list}>
        {primary ? (
          <SleepActivityCard
            startTime={primary.start}
            endTime={primary.end}
            kind="primary"
            source={primary.source}
            onLongPress={() =>
              setMenuFor({
                mode: "prefill",
                startTime: primary.start,
                endTime: primary.end,
                kind: "primary",
              })
            }
          />
        ) : null}
        {manuals.map((m) => (
          <SleepActivityCard
            key={m.sessionId}
            startTime={m.startTime}
            endTime={m.endTime}
            kind={m.kind}
            source="manual"
            onLongPress={() =>
              setMenuFor({
                mode: "edit",
                session: {
                  sessionId: m.sessionId,
                  startTime: m.startTime,
                  endTime: m.endTime,
                  kind: m.kind,
                  note: m.note ?? null,
                },
              })
            }
          />
        ))}
        {showEmpty ? (
          <View style={styles.empty}>
            <Ionicons name="bed-outline" size={24} color={colors.textTertiary} />
            <Text style={styles.emptyText}>
              No sleep recorded yet. Connect a wearable or add it manually.
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.subHeaderRow}>
        <Text style={styles.subHeader}>What affected last night?</Text>
      </View>
      <NightTagsRow serverTags={night?.tags ?? []} />

      <AddManualSleepSheet defaultDay={day} ref={sheetRef} />
      <SleepActivityEditMenu
        visible={menuFor !== null}
        onClose={closeMenu}
        onEdit={openEditFromMenu}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md, marginTop: spacing.xl },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
  },
  headerTitle: {
    fontFamily: fontFamily.heading,
    fontSize: 18,
    color: colors.textPrimary,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: borderTokens.strong,
    backgroundColor: surface.card,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  empty: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: surface.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    padding: spacing.md,
  },
  emptyText: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  subHeaderRow: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  subHeader: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    color: colors.textPrimary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
});
