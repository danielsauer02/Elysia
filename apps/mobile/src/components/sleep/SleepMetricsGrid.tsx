/**
 * SleepMetricsGrid — Metrics section
 *
 * Stacks, in order:
 *   1. Time to fall asleep (hero scale)
 *   2. Sleep stress flagship window (Whoop-style)
 *   3. "Sleep-specific" container — 2x2 compact tiles, no sparkline
 *   4. "Biometrics" container — full-row tiles with sparkline on the right
 *
 * The metric ids match the keys returned by `api.sleep.getSleepNight`, so
 * the `night.metrics` payload feeds straight in.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { TimeToFallAsleepCard } from "./TimeToFallAsleepCard";
import { SleepStressCard } from "./SleepStressCard";
import { SleepSpecificTile } from "./SleepSpecificTile";
import { BiometricRow } from "./BiometricRow";
import { metricsForGroup } from "./sleepMetricCatalog";
import { borderTokens, colors, fontFamily, spacing } from "@/theme";

interface NightMetrics {
  timeToFallAsleep: number | null;
  hr: number | null;
  hrv: number | null;
  rr: number | null;
  spo2: number | null;
  efficiency: number | null;
  consistency: number | null;
  performance: number | null;
  stress: number | null;
  debtMinutes: number;
  nightDeficitMinutes: number | null;
  restorativeMinutes: number | null;
  hrDip: number | null;
}

interface Props {
  metrics: NightMetrics | null;
  primaryStart: string | null;
  primaryEnd: string | null;
}

export function SleepMetricsGrid({ metrics, primaryStart, primaryEnd }: Props) {
  const valueFor = (id: string): number | null => {
    if (!metrics) return null;
    switch (id) {
      case "hr": return metrics.hr;
      case "hrv": return metrics.hrv;
      case "rr": return metrics.rr;
      case "spo2": return metrics.spo2;
      case "performance": return metrics.performance;
      case "consistency": return metrics.consistency;
      case "debt": return metrics.nightDeficitMinutes;
      case "restorative": return metrics.restorativeMinutes;
      case "hrDip": return metrics.hrDip;
      default: return null;
    }
  };

  const sleepSpecific = metricsForGroup("sleepSpecific");
  const biometrics = metricsForGroup("biometric");

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Metrics</Text>
      </View>

      <View style={styles.body}>
        <TimeToFallAsleepCard value={metrics?.timeToFallAsleep ?? null} />

        <SleepStressCard primaryStart={primaryStart} primaryEnd={primaryEnd} />

        {/* Sleep-specific container */}
        <View style={styles.container}>
          <Text style={styles.subheading}>Sleep-specific</Text>
          <View style={styles.grid}>
            {sleepSpecific.map((m) => (
              <SleepSpecificTile key={m.id} metric={m} value={valueFor(m.id)} />
            ))}
          </View>
        </View>

        {/* Biometrics container */}
        <View style={styles.container}>
          <Text style={styles.subheading}>Biometrics</Text>
          <View style={styles.rows}>
            {biometrics.map((m) => (
              <BiometricRow key={m.id} metric={m} value={valueFor(m.id)} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  header: { paddingHorizontal: spacing.lg },
  title: {
    fontFamily: fontFamily.heading,
    fontSize: 18,
    color: colors.textPrimary,
  },
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  // Subtle container that frames a metric group without stealing tile width.
  container: {
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: spacing.sm,
    gap: spacing.sm,
  },
  subheading: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 12,
    color: colors.textPrimary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  rows: {
    gap: spacing.sm,
  },
});
