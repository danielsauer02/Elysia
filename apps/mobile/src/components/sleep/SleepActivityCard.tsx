/**
 * SleepActivityCard
 *
 * 1:1 layout port of Whoop's "Sleep activities" row. Only the colour
 * accent differs (indigo from `dataColors.sleep` instead of Whoop's
 * electric blue). Every other proportion — inset tile, centred kind
 * label, the blue stripe with two white dot-caps next to the times —
 * matches the reference.
 *
 *   ┌────────────────────────────────────────────────┐
 *   │  ┌──────┐                                      │
 *   │  │  ☾   │  PRIMARY SLEEP        ●─┐  11:00 PM │   ← bedtime (top)
 *   │  │ 5:51 │                          │           │
 *   │  └──────┘                          │           │
 *   │                                  ●─┘   7:00 AM │   ← wake-time (bottom)
 *   └────────────────────────────────────────────────┘
 *
 *   • Inset tile : indigo rounded rectangle padded on all sides
 *                  inside the dark card. Whoop's signature element.
 *   • Stripe     : 1.5px indigo line between two 6px white dot-caps.
 *                  The dot positions visually mark the start- and
 *                  end-time of the sleep span.
 *   • Times      : 12h AM/PM format, mono digits, right-aligned.
 *                  Bed-time on TOP (matches the top dot), wake-time
 *                  on BOTTOM (matches the bottom dot).
 *   • Long-press : 600ms hold triggers a haptic and surfaces a small
 *                  "Edit" affordance via the `onLongPress` callback.
 *                  A short tap deliberately does nothing — protects
 *                  against accidental edits.
 */
import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  borderTokens,
  colors,
  dataColors,
  fontFamily,
  surface,
} from "@/theme";

interface Props {
  startTime: string; // ISO  → bedtime (when the user fell asleep)
  endTime: string;   // ISO  → wake-time (when the user woke up)
  kind: "primary" | "nap";
  source?: string | null; // accepted for compatibility, not rendered
  onLongPress?: () => void;
}

function localTimeAmPm(iso: string): string {
  const d = new Date(iso);
  const hh = d.getHours();
  const mm = d.getMinutes().toString().padStart(2, "0");
  const period = hh < 12 ? "AM" : "PM";
  const hh12 = hh % 12 || 12;
  return `${hh12}:${mm} ${period}`;
}

function durationColon(start: string, end: string): string {
  const ms = Math.max(0, Date.parse(end) - Date.parse(start));
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

const CARD_HEIGHT = 66;

export function SleepActivityCard({ startTime, endTime, kind, onLongPress }: Props) {
  const editable = onLongPress !== undefined;

  const handleLongPress = () => {
    if (!onLongPress) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress();
  };

  const inner = (
    <View style={styles.card}>
      {/* Inset indigo tile — moon + duration */}
      <View style={styles.tile}>
        <Ionicons
          name={kind === "nap" ? "sunny" : "moon"}
          size={13}
          color="rgba(255,255,255,0.95)"
        />
        <Text style={styles.tileDuration}>{durationColon(startTime, endTime)}</Text>
      </View>

      {/* Kind label, vertically centred */}
      <View style={styles.body}>
        <Text style={styles.kind} numberOfLines={1}>
          {kind === "primary" ? "PRIMARY SLEEP" : "NAP"}
        </Text>
      </View>

      {/* Times — bedtime on top, wake-time on bottom (left of the stripe) */}
      <View style={styles.timesCol}>
        <Text style={styles.timeText}>{localTimeAmPm(startTime)}</Text>
        <Text style={styles.timeText}>{localTimeAmPm(endTime)}</Text>
      </View>

      {/* Blue stripe with two white dot-caps — pinned to the far right */}
      <View style={styles.stripeCol}>
        <View style={styles.stripeDot} />
        <View style={styles.stripeBar} />
        <View style={styles.stripeDot} />
      </View>
    </View>
  );

  if (editable) {
    return (
      <Pressable
        onLongPress={handleLongPress}
        delayLongPress={600}
        android_ripple={{ color: "rgba(255,255,255,0.04)" }}
        style={({ pressed }) => [styles.pressableWrap, pressed && { opacity: 0.96 }]}
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={styles.pressableWrap}>{inner}</View>;
}

const styles = StyleSheet.create({
  pressableWrap: {
    borderRadius: 14,
    overflow: "hidden",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    height: CARD_HEIGHT,
    backgroundColor: surface.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tile: {
    flexDirection: "row",
    width: 78,
    height: 50,
    backgroundColor: dataColors.sleep.base,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  tileDuration: {
    fontFamily: fontFamily.monoBold,
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: -0.2,
    fontVariant: ["tabular-nums"],
  },
  body: {
    flex: 1,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  kind: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 10.5,
    letterSpacing: 1.2,
    color: colors.textPrimary,
  },
  stripeCol: {
    height: 42,
    width: 8,
    alignItems: "center",
    justifyContent: "space-between",
    marginLeft: 10,
    marginRight: 2,
  },
  stripeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  stripeBar: {
    flex: 1,
    width: 1.5,
    backgroundColor: dataColors.sleep.base,
    marginVertical: 1,
  },
  timesCol: {
    minWidth: 64,
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 42,
    paddingVertical: 2,
  },
  timeText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 10.5,
    lineHeight: 13,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
});
