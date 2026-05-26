import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { colors, spacing, radii } from "@/theme";
import { Card } from "@/components/ui/Card";

const todayISO = () => new Date().toISOString().slice(0, 10);
const isoFromOffset = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

function EnergyBalanceCardInner() {
  const today = todayISO();
  const sevenAgo = isoFromOffset(6);
  const energy = useQuery(api.analytics.getEnergyBalanceRange, { from: sevenAgo, to: today });
  const wearable = useQuery(api.wearables.getDailyMetrics, { from: today, to: today });
  const correlations = useQuery(api.analytics.getCorrelations, { days: 30 });
  const [provenanceOpen, setProvenanceOpen] = useState(false);

  const todayRow = energy?.find((e) => e.day === today);
  const wearableRow = wearable?.[0];

  const tdee = todayRow?.tdeeEstimate ?? null;
  const intake = todayRow?.intakeKcal ?? 0;
  const balance = todayRow?.balanceKcal ?? null;
  const protein = todayRow?.proteinG ?? 0;
  const proteinPerKg = todayRow?.proteinPerKg ?? null;
  const recoveryProxy = todayRow?.recoveryProxy ?? null;

  // Provenance for Energy out: prefer wearable when basal+active are present,
  // otherwise the value is computed from the Mifflin-St-Jeor estimate.
  const energyOutSource: string | null = (() => {
    const sources = (wearableRow?.metricSources ?? null) as
      | Record<string, string>
      | null;
    if (!sources) return null;
    return (
      sources.total_calories ??
      sources.active_calories ??
      sources.basal_calories ??
      sources.workout ??
      null
    );
  })();
  const energyOutBadge =
    tdee == null
      ? null
      : energyOutSource
      ? `via ${energyOutSource}`
      : "estimated";

  const balanceColor = useMemo(() => {
    if (balance === null) return colors.textSecondary;
    if (Math.abs(balance) <= 200) return colors.success;
    if (Math.abs(balance) <= 500) return colors.warning;
    return colors.destructive;
  }, [balance]);

  const trend7d = useMemo(() => {
    if (!energy || energy.length === 0) return null;
    const sum = energy.reduce((s, r) => s + (r.balanceKcal ?? 0), 0);
    return Math.round(sum / energy.length);
  }, [energy]);

  return (
    <>
      <Card style={styles.card} variant="elevated">
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Energy balance</Text>
          <TouchableOpacity
            onPress={() => setProvenanceOpen(true)}
            hitSlop={8}
            style={styles.provenanceBtn}
          >
            <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.provenanceLabel}>Sources</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <Stat label="Intake" value={`${intake}`} unit="kcal" color={colors.accent} />
          <Stat
            label="Energy out"
            value={tdee != null ? `${tdee}` : "—"}
            unit="kcal"
            color={colors.textSecondary}
            caption={energyOutBadge ?? undefined}
          />
          <Stat
            label="Balance"
            value={balance != null ? `${balance > 0 ? "+" : ""}${balance}` : "—"}
            unit="kcal"
            color={balanceColor}
          />
        </View>

        <View style={styles.subRow}>
          <Text style={styles.subText}>
            Protein {Math.round(protein)} g
            {proteinPerKg != null ? ` · ${proteinPerKg.toFixed(1)} g/kg` : ""}
          </Text>
          {recoveryProxy != null && (
            <Text style={styles.subText}>Recovery {recoveryProxy}%</Text>
          )}
        </View>

        {trend7d !== null && (
          <Text style={styles.trendText}>
            7-day average: {trend7d > 0 ? "+" : ""}
            {trend7d} kcal/day
          </Text>
        )}

        {correlations && correlations.sampleSize >= 5 && (
          <View style={styles.correlationsRow}>
            <CorrelationChip
              label="Sleep ↔ Balance"
              value={correlations.sleepVsBalance}
            />
            <CorrelationChip
              label="Training ↔ Recovery"
              value={correlations.trainingVsRecovery}
            />
            <CorrelationChip
              label="Protein ↔ Recovery"
              value={correlations.proteinVsRecovery}
            />
          </View>
        )}
      </Card>

      <Modal visible={provenanceOpen} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Data sources</Text>
              <TouchableOpacity onPress={() => setProvenanceOpen(false)}>
                <Ionicons name="close" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLine}>
              Intake: sum of every entry in today's food log.
            </Text>
            <Text style={styles.modalLine}>
              Energy out: total daily calories burned. Uses your wearable's
              basal + active calories when both are present, otherwise the
              Mifflin-St-Jeor BMR estimate multiplied by your activity level
              plus any workout calories from a connected wearable (Whoop,
              Fitbit, Apple Health, …).
            </Text>
            <Text style={styles.modalLine}>
              Balance: Intake − Energy out. Negative means a deficit.
            </Text>
            {wearableRow?.metricSources && (
              <>
                <Text style={[styles.modalLine, styles.modalSection]}>Per-metric sources</Text>
                {Object.entries(wearableRow.metricSources as Record<string, string>).map(
                  ([metric, source]) => (
                    <Text key={metric} style={styles.modalLine}>
                      {metric}: {source}
                    </Text>
                  )
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

function Stat({
  label,
  value,
  unit,
  color,
  caption,
}: {
  label: string;
  value: string;
  unit?: string;
  color: string;
  caption?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {unit && <Text style={styles.statUnit}>{unit}</Text>}
      <Text style={styles.statLabel}>{label}</Text>
      {caption && <Text style={styles.statCaption}>{caption}</Text>}
    </View>
  );
}

function CorrelationChip({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  const strength = Math.abs(value);
  const color =
    strength < 0.2 ? colors.textTertiary : strength < 0.5 ? colors.textSecondary : colors.accent;
  const sign = value > 0 ? "+" : "";
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={[styles.chipValue, { color }]}>
        {sign}
        {value.toFixed(2)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, gap: spacing.sm },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" },
  provenanceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  provenanceLabel: { color: colors.textSecondary, fontSize: 12 },
  statsRow: { flexDirection: "row", gap: spacing.md, marginTop: 4 },
  stat: { flex: 1 },
  statValue: { fontSize: 22, fontWeight: "700" },
  statUnit: { fontSize: 11, color: colors.textTertiary, marginTop: -2 },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statCaption: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 2,
  },
  subRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  subText: { color: colors.textSecondary, fontSize: 12 },
  trendText: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },
  correlationsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: spacing.sm },
  chip: {
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radii.md,
    gap: 2,
  },
  chipLabel: { color: colors.textTertiary, fontSize: 10 },
  chipValue: { fontSize: 12, fontWeight: "700" },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: 6,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  modalTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  modalLine: { color: colors.textSecondary, fontSize: 13 },
  modalSection: { marginTop: 8, color: colors.textPrimary, fontWeight: "700" },
});

/** Memoised: no props, only re-renders when its Convex queries change. */
export const EnergyBalanceCard = React.memo(EnergyBalanceCardInner);
