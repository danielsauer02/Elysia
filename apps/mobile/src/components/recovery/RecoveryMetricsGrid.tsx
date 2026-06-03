/**
 * RecoveryMetricsGrid — Metrics section of the /recovery screen.
 *
 * One "Biometrics" container of full-row tiles (Resting HR, HRV, Respiratory
 * rate, Body temperature, SpO2), each with a 7-day sparkline. The metric ids
 * match the keys returned by `api.recovery.getRecoveryDay`.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { RecoveryMetricRow } from "./RecoveryMetricRow";
import { RECOVERY_METRICS } from "@/components/sleep/recoveryMetricCatalog";
import { borderTokens, colors, fontFamily, spacing } from "@/theme";

interface RecoveryMetricValues {
  rhr: number | null;
  hrv: number | null;
  rr: number | null;
  temp: number | null;
  spo2: number | null;
}

interface Props {
  metrics: RecoveryMetricValues | null;
}

export function RecoveryMetricsGrid({ metrics }: Props) {
  const valueFor = (id: string): number | null => {
    if (!metrics) return null;
    switch (id) {
      case "rhr": return metrics.rhr;
      case "hrv": return metrics.hrv;
      case "rr": return metrics.rr;
      case "temp": return metrics.temp;
      case "spo2": return metrics.spo2;
      default: return null;
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Metrics</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.container}>
          <View style={styles.rows}>
            {RECOVERY_METRICS.map((m) => (
              <RecoveryMetricRow key={m.id} metric={m} value={valueFor(m.id)} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Tighter top gap to the heading now that the inner subheading is gone.
  section: { marginTop: spacing.xxl, gap: spacing.sm },
  header: { paddingHorizontal: spacing.lg },
  title: {
    fontFamily: fontFamily.heading,
    fontSize: 18,
    color: colors.textPrimary,
  },
  body: { paddingHorizontal: spacing.lg },
  // Container just wraps the tiles — no inner heading, minimal padding.
  container: {
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: spacing.sm,
  },
  rows: { gap: spacing.sm },
});
