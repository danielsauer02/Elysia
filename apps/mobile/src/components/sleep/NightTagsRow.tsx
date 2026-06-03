/**
 * NightTagsRow
 *
 * Horizontal chip row that lets the user tag last night's influences
 * (caffeine, alcohol, ...). Tap toggles the chip immediately for
 * snappy feedback; a debounced 400ms timer flushes the full set to
 * `api.sleep.setNightTags`. Server-returned tag set then re-syncs.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useSleepContext } from "@/context/SleepContext";
import {
  borderTokens,
  colors,
  dataColors,
  fontFamily,
  spacing,
  surface,
} from "@/theme";

type TagId = string;

interface TagMeta {
  id: TagId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const TAG_LIBRARY: TagMeta[] = [
  { id: "coffee", label: "Coffee", icon: "cafe-outline" },
  { id: "alcohol", label: "Alcohol", icon: "wine-outline" },
  { id: "late_meal", label: "Late meal", icon: "restaurant-outline" },
  { id: "stress", label: "Stress", icon: "alert-circle-outline" },
  { id: "exercise", label: "Exercise", icon: "fitness-outline" },
  { id: "travel", label: "Travel", icon: "airplane-outline" },
  { id: "late_screen", label: "Late screen", icon: "phone-portrait-outline" },
  { id: "medication", label: "Medication", icon: "medkit-outline" },
  { id: "sick", label: "Sick", icon: "thermometer-outline" },
  { id: "argument", label: "Argument", icon: "chatbubbles-outline" },
  { id: "cold_room", label: "Cold room", icon: "snow-outline" },
];

interface Props {
  serverTags: TagId[];
}

export function NightTagsRow({ serverTags }: Props) {
  const { selectedDay } = useSleepContext();
  const setTags = useMutation(api.sleep.setNightTags);
  const [local, setLocal] = useState<Set<TagId>>(() => new Set(serverTags));
  const debouncedRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef<Set<TagId> | null>(null);

  // When the server payload changes (day switch, mutation result) reset
  // our optimistic set — unless we have a pending mutation in flight,
  // in which case the user's clicks win until the round-trip lands.
  useEffect(() => {
    if (inflightRef.current) return;
    setLocal(new Set(serverTags));
  }, [serverTags, selectedDay]);

  const toggle = (id: TagId) => {
    setLocal((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      schedule(next);
      return next;
    });
  };

  const schedule = (set: Set<TagId>) => {
    if (debouncedRef.current) clearTimeout(debouncedRef.current);
    debouncedRef.current = setTimeout(() => {
      inflightRef.current = set;
      void setTags({ day: selectedDay, tags: [...set] }).finally(() => {
        inflightRef.current = null;
      });
    }, 400);
  };

  useEffect(() => {
    return () => {
      if (debouncedRef.current) clearTimeout(debouncedRef.current);
    };
  }, []);

  const tagsToRender = useMemo(() => TAG_LIBRARY, []);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {tagsToRender.map((tag) => {
        const active = local.has(tag.id);
        return (
          <Pressable
            key={tag.id}
            onPress={() => toggle(tag.id)}
            style={[
              styles.chip,
              active && {
                borderColor: dataColors.sleep.base,
                backgroundColor: "rgba(129,140,248,0.16)",
              },
            ]}
          >
            <Ionicons
              name={tag.icon}
              size={14}
              color={active ? dataColors.sleep.base : colors.textSecondary}
            />
            <Text
              style={[
                styles.label,
                active && { color: colors.textPrimary, fontFamily: fontFamily.bodyBold },
              ]}
            >
              {tag.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    backgroundColor: surface.card,
  },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
