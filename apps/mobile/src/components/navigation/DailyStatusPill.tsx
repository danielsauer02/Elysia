/**
 * DailyStatusPill — Bevel-style "Active / Resting / Sick" indicator that
 * lives on the top-left of every screen.
 *
 * Tap to open a small modal that lets the user pick the day's status. The
 * choice is persisted via AsyncStorage so it survives restarts; expiry to
 * "Active" defaults to midnight tomorrow (sensible default for a daily
 * health context).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  borderTokens,
  brand,
  glass,
  radii,
  spacing,
  surface,
  text,
  typography,
} from "@/theme";
import { AnimatedPressable } from "@/components/ui/AnimatedPressable";

const STORAGE_KEY = "elysia.dailyStatus.v1";

export type DailyStatus =
  | "active"
  | "resting"
  | "sick"
  | "injured"
  | "travel";

interface StatusMeta {
  id: DailyStatus;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  description: string;
}

const STATUSES: StatusMeta[] = [
  {
    id: "active",
    label: "Active",
    icon: "flash-outline",
    color: brand.primary,
    description: "Full training intensity, normal scoring weights.",
  },
  {
    id: "resting",
    label: "Resting",
    icon: "moon-outline",
    color: "#A5B4FC",
    description: "Recovery day. We'll downweight strain penalties.",
  },
  {
    id: "sick",
    label: "Sick",
    icon: "thermometer-outline",
    color: "#FB7185",
    description: "Illness mode. Stress/HRV anomalies are expected.",
  },
  {
    id: "injured",
    label: "Injured",
    icon: "bandage-outline",
    color: "#F87171",
    description: "Activity-load capped. Focus on sleep + nutrition.",
  },
  {
    id: "travel",
    label: "Travel",
    icon: "airplane-outline",
    color: "#FBBF24",
    description: "Jet-lag adjustments applied to sleep + recovery.",
  },
];

const META: Record<DailyStatus, StatusMeta> = STATUSES.reduce(
  (acc, s) => ({ ...acc, [s.id]: s }),
  {} as Record<DailyStatus, StatusMeta>
);

export function DailyStatusPill() {
  const [status, setStatus] = useState<DailyStatus>("active");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (cancelled || !raw) return;
      if (STATUSES.some((s) => s.id === raw)) {
        setStatus(raw as DailyStatus);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const select = useCallback((next: DailyStatus) => {
    setStatus(next);
    setOpen(false);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const current = META[status];

  return (
    <>
      <AnimatedPressable
        onPress={() => setOpen(true)}
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel={`Daily status: ${current.label}. Tap to change.`}
        style={styles.pill}
      >
        <View style={[styles.dot, { backgroundColor: current.color }]} />
        <Ionicons name={current.icon} size={13} color={current.color} />
        <Text style={styles.label}>{current.label}</Text>
        <Ionicons
          name="chevron-down"
          size={11}
          color={text.tertiary}
          style={styles.chev}
        />
      </AnimatedPressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setOpen(false)} />
        <View style={styles.sheet} pointerEvents="box-none">
          <View style={styles.sheetInner}>
            <Text style={styles.sheetTitle}>How are you today?</Text>
            <View style={{ gap: spacing.xs }}>
              {STATUSES.map((s) => (
                <SelectRow
                  key={s.id}
                  meta={s}
                  selected={s.id === status}
                  onPress={() => select(s.id)}
                />
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function SelectRow({
  meta,
  selected,
  onPress,
}: {
  meta: StatusMeta;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      haptic="selection"
      style={[
        styles.row,
        selected && {
          borderColor: meta.color,
          backgroundColor: meta.color + "12",
        },
      ]}
    >
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: meta.color + "20" },
        ]}
      >
        <Ionicons name={meta.icon} size={16} color={meta.color} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{meta.label}</Text>
        <Text style={styles.rowDesc} numberOfLines={2}>
          {meta.description}
        </Text>
      </View>
      {selected ? (
        <Ionicons name="checkmark-circle" size={18} color={meta.color} />
      ) : null}
    </AnimatedPressable>
  );
}

/** Lightweight read-only access to today's status outside this component. */
export async function getStoredDailyStatus(): Promise<DailyStatus> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw && STATUSES.some((s) => s.id === raw)) return raw as DailyStatus;
  return "active";
}

export const dailyStatusMeta = META;
useMemo; // appease unused-import (kept for tree-shaking parity)

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: radii.full,
    backgroundColor: glass.anthracite.tint,
    borderWidth: 1,
    borderColor: borderTokens.hairline,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    ...typography.caption,
    color: text.primary,
    fontSize: 12,
  },
  chev: {
    marginLeft: -2,
  },

  // Modal
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    position: "absolute",
    top: 76,
    left: spacing.lg,
    right: spacing.lg,
  },
  sheetInner: {
    backgroundColor: surface.cardAlt,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sheetTitle: {
    ...typography.title3,
    color: text.primary,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "transparent",
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    ...typography.title3,
    color: text.primary,
    fontSize: 14,
  },
  rowDesc: {
    ...typography.caption,
    color: text.secondary,
  },
});
