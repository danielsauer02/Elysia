/**
 * EnergyEventLog
 *
 * "Today's Events" log for the Energy Reserve deep dive — a real log of the
 * day's COMPLETED events (the night's sleep charge + finished workouts).
 * Borrows the sleep-log row rhythm: an icon-only tile on the left, the label
 * with grey start–end times underneath, and the reserve impact (+/− %) on the
 * right, green for charge / red for drain. No "Now" placeholder rows.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ENERGY_GREEN, ENERGY_RED } from "./energyColors";
import { borderTokens, colors, dataColors, fontFamily, surface } from "@/theme";

export interface LogEvent {
  kind: "sleep" | "workout";
  tStart: string;
  tEnd: string;
  label: string;
  delta: number;
}

interface Props {
  events: LogEvent[];
}

function clock(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCHours().toString().padStart(2, "0")}:${d
    .getUTCMinutes()
    .toString()
    .padStart(2, "0")}`;
}

function titleFor(ev: LogEvent): string {
  if (ev.kind === "sleep") return "Primary Sleep";
  return prettyActivity(ev.label);
}

/**
 * A workout's `label` is the raw `activityType`. Wearable feeds often hand us a
 * numeric sport id (Whoop `sport_id`, e.g. "45") or a generic "other" — neither
 * is meaningful to the user, so we render "Activity". Once the (future) Activity
 * section lets the user classify a session, that real name flows straight
 * through here unchanged (e.g. "Badminton").
 */
function prettyActivity(raw: string): string {
  const v = (raw ?? "").trim();
  if (!v || /^\d+$/.test(v) || v.toLowerCase() === "other" || v.toLowerCase() === "unknown") {
    return "Activity";
  }
  const t = v.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function EnergyEventLog({ events }: Props) {
  if (events.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No completed events yet today.</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {events.map((ev, i) => {
        const isSleep = ev.kind === "sleep";
        const tint = isSleep ? dataColors.sleep.base : dataColors.activity.base;
        const positive = ev.delta >= 0;
        return (
          <View key={i} style={styles.row}>
            <View style={[styles.iconTile, { backgroundColor: tint }]}>
              <Ionicons
                name={isSleep ? "moon" : "barbell"}
                size={18}
                color="rgba(255,255,255,0.95)"
              />
            </View>

            <View style={styles.body}>
              <Text style={styles.title} numberOfLines={1}>
                {titleFor(ev)}
              </Text>
              <Text style={styles.times}>
                {clock(ev.tStart)} - {clock(ev.tEnd)}
              </Text>
            </View>

            <Text style={[styles.delta, { color: positive ? ENERGY_GREEN : ENERGY_RED }]}>
              {positive ? "+" : "−"}
              {Math.abs(ev.delta)}%
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: surface.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  iconTile: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, paddingHorizontal: 14, gap: 2 },
  title: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  times: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  delta: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
  empty: {
    backgroundColor: surface.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    padding: 16,
    alignItems: "center",
  },
  emptyText: { fontFamily: fontFamily.body, fontSize: 13, color: colors.textSecondary },
});
