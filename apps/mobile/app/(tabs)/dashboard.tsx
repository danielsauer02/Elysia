import React, { useState, useEffect, useCallback } from "react";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radii } from "@/theme";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { AgingCurveChart } from "@/components/ui/AgingCurveChart";
import { useHabits } from "@/context/HabitsContext";
import { useAppContext } from "@/context/AppContext";
import { useNutrition } from "@/context/NutritionContext";
import {
  readTodayHealthData,
  requestHealthPermissions,
  isHealthAvailable,
  type HealthData,
} from "@/lib/healthkit";
import { mockUserSummary } from "@/mocks/data";
import { getGreeting } from "@/utils/date";

// ─── Mock aging data ─────────────────────────────────────────────────────────
// Simulates 3 months of biological age tracking since the user joined.
const MOCK_AGING_HISTORY = [
  { chronoAge: 31.75, bioAge: 32.3 },
  { chronoAge: 31.83, bioAge: 32.1 },
  { chronoAge: 31.92, bioAge: 31.8 },
  { chronoAge: 32.0, bioAge: 31.5 },
];

function calcChronoAge(dob?: string): number {
  if (!dob) return 32;
  const ms = Date.now() - new Date(dob).getTime();
  return ms / (1000 * 60 * 60 * 24 * 365.25);
}

// ─── Small stat card ─────────────────────────────────────────────────────────
function StatPill({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={[styles.statPill, { backgroundColor: color + "12", borderColor: color + "30" }]}>
      <Ionicons name={icon} size={14} color={color} />
      <View style={styles.statPillText}>
        <Text style={[styles.statPillValue, { color }]}>{value}</Text>
        <Text style={styles.statPillLabel}>{label}</Text>
      </View>
    </View>
  );
}

// ─── Health data hook ─────────────────────────────────────────────────────────

function useHealthData() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const available = isHealthAvailable();

  const requestAndRead = useCallback(async () => {
    if (!available) return;
    setLoading(true);
    try {
      const granted = await requestHealthPermissions();
      setPermissionsGranted(granted);
      if (granted) {
        const healthData = await readTodayHealthData();
        setData(healthData);
      }
    } finally {
      setLoading(false);
    }
  }, [available]);

  useEffect(() => {
    if (available) {
      void requestAndRead();
    }
  }, [available, requestAndRead]);

  return { data, loading, permissionsGranted, available, requestAndRead };
}

// ─── Health module row ───────────────────────────────────────────────────────
interface ModuleData {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  status: "connected" | "connect" | "coming_soon";
  value?: string;
  unit?: string;
  sub?: string;
  color: string;
}

function buildHealthModules(data: HealthData | null): ModuleData[] {
  const isConnected = (v: number | null | undefined): v is number => v != null;
  return [
    {
      title: "HRV",
      icon: "pulse-outline" as const,
      color: "#818CF8",
      status: (isConnected(data?.hrvMs) ? "connected" : "connect") as ModuleData["status"],
      value: isConnected(data?.hrvMs) ? String(Math.round(data!.hrvMs!)) : undefined,
      unit: "ms",
      sub: "Heart rate variability",
    },
    {
      title: "Sleep",
      icon: "moon-outline" as const,
      color: "#A78BFA",
      status: (isConnected(data?.sleepHours) ? "connected" : "connect") as ModuleData["status"],
      value: isConnected(data?.sleepHours) ? String(data!.sleepHours) : undefined,
      unit: "h",
      sub: "Last night's sleep",
    },
    {
      title: "Resting HR",
      icon: "heart-outline" as const,
      color: "#F87171",
      status: (isConnected(data?.restingHeartRateBpm) ? "connected" : "connect") as ModuleData["status"],
      value: isConnected(data?.restingHeartRateBpm) ? String(data!.restingHeartRateBpm) : undefined,
      unit: "bpm",
      sub: "Baseline cardiovascular",
    },
    {
      title: "Steps",
      icon: "footsteps-outline" as const,
      color: "#34D399",
      status: (isConnected(data?.steps) ? "connected" : "connect") as ModuleData["status"],
      value: isConnected(data?.steps) ? data!.steps!.toLocaleString() : undefined,
      sub: "Daily activity",
    },
    {
      title: "Active kcal",
      icon: "flame-outline" as const,
      color: "#FB923C",
      status: (isConnected(data?.activeCalories) ? "connected" : "connect") as ModuleData["status"],
      value: isConnected(data?.activeCalories) ? String(data!.activeCalories) : undefined,
      unit: "kcal",
      sub: "Active calories burned",
    },
    {
      title: "Blood Glucose",
      icon: "analytics-outline",
      color: "#FBBF24",
      status: "coming_soon",
      sub: "CGM integration · Phase 4",
    },
    {
      title: "VO₂ Max",
      icon: "fitness-outline",
      color: "#38BDF8",
      status: "coming_soon",
      sub: "Cardiorespiratory · Phase 4",
    },
  ];
}

function ModuleTile({ mod }: { mod: ModuleData }) {
  return (
    <View style={styles.moduleTile}>
      <View style={[styles.moduleIcon, { backgroundColor: mod.color + "18" }]}>
        <Ionicons name={mod.icon} size={17} color={mod.color} />
      </View>
      <View style={styles.moduleBody}>
        <Text style={styles.moduleTitle}>{mod.title}</Text>
        {mod.status === "connected" && mod.value ? (
          <Text style={[styles.moduleValue, { color: mod.color }]}>
            {mod.value}{mod.unit ? ` ${mod.unit}` : ""}
          </Text>
        ) : (
          <Text style={styles.moduleSub} numberOfLines={1}>{mod.sub}</Text>
        )}
      </View>
      {mod.status === "connect" && (
        <View style={styles.connectTag}>
          <Text style={styles.connectTagLabel}>Connect</Text>
        </View>
      )}
      {mod.status === "coming_soon" && (
        <View style={styles.soonTag}>
          <Text style={styles.soonTagLabel}>Phase 2</Text>
        </View>
      )}
    </View>
  );
}

// ─── Weekly chart ─────────────────────────────────────────────────────────────
function WeeklyChart() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const values = [0.85, 1.0, 0.6, 0.9, 0.75, 0.5, 0.4];
  const todayIdx = 4;
  return (
    <View style={styles.chart}>
      {days.map((day, i) => {
        const isToday = i === todayIdx;
        const v = values[i] ?? 0;
        const barColor = isToday
          ? colors.accent
          : v >= 0.8 ? colors.success
          : v >= 0.6 ? colors.warning
          : colors.textTertiary;
        return (
          <View key={day} style={styles.chartCol}>
            <View style={styles.chartBarWrap}>
              <View style={[styles.chartBar, { height: `${v * 100}%`, backgroundColor: barColor }]} />
            </View>
            <Text style={[styles.chartDay, isToday && { color: colors.accent, fontWeight: "700" }]}>
              {day}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const router = useRouter();
  const { onboardingData } = useAppContext();
  const { getTodayProgress } = useHabits();
  const { macroTargets, getDayTotals, isGoalSet } = useNutrition();
  const { data: healthData, loading: healthLoading, available: healthAvailable, requestAndRead } = useHealthData();
  const { completed, total } = getTodayProgress();
  const firstName = onboardingData?.name?.split(" ")[0] ?? "there";
  const greeting = getGreeting();

  const chronoAge = calcChronoAge(onboardingData?.dateOfBirth);
  const bioAge = Math.max(10, chronoAge - 1.8);

  const foodTotals = getDayTotals();
  const healthModules = buildHealthModules(healthData);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.name}>{firstName}</Text>
          </View>
          <TouchableOpacity style={styles.notifBtn}>
            <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Longevity Score + Aging Curve ────────────────── */}
        <Card variant="elevated" style={styles.ageCard}>
          {/* Score row */}
          <View style={styles.ageScoreRow}>
            <View style={styles.ageScoreLeft}>
              <Text style={styles.ageScoreLabel}>Biological Age</Text>
              <Text style={styles.ageNumber}>{bioAge.toFixed(1)}</Text>
              <Text style={styles.ageUnit}>years</Text>
            </View>
            <View style={styles.ageScoreRight}>
              <View style={styles.scoreRing}>
                <Text style={styles.scoreValue}>{mockUserSummary.longevityScore}</Text>
                <Text style={styles.scoreSubLabel}>score</Text>
              </View>
              <Text style={styles.scoreCaption}>Longevity{"\n"}Index</Text>
            </View>
          </View>

          <View style={styles.ageMetaRow}>
            <StatPill icon="person-outline" label="Chronological" value={`${chronoAge.toFixed(1)} yrs`} color={colors.textSecondary} />
            <StatPill icon="trending-down-outline" label="Biological" value={`${bioAge.toFixed(1)} yrs`} color={colors.success} />
          </View>

          <Text style={styles.chartTitle}>Aging Trajectory</Text>
          <Text style={styles.chartSub}>
            Below the dashed line = biologically younger · Cyan dot = you today
          </Text>

          <AgingCurveChart
            chronoAge={chronoAge}
            bioAge={bioAge}
            history={MOCK_AGING_HISTORY}
            lifeExpectancy={85}
          />
        </Card>

        {/* ── Nutrition Summary ─────────────────────────────── */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => router.push("/(tabs)/tracker")}>
          <Card style={styles.nutritionCard}>
            <View style={styles.nutritionHeader}>
              <View style={styles.nutritionHeaderLeft}>
                <View style={styles.nutritionIcon}>
                  <Ionicons name="nutrition-outline" size={14} color="#4ADE80" />
                </View>
                <Text style={styles.nutritionTitle}>Today's nutrition</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
            </View>
            {isGoalSet && macroTargets ? (
              <>
                <View style={styles.nutritionRow}>
                  <View style={styles.nutritionStat}>
                    <Text style={styles.nutritionValue}>{Math.round(foodTotals.calories)}</Text>
                    <Text style={styles.nutritionUnit}>kcal</Text>
                  </View>
                  <View style={styles.nutritionDivider} />
                  <View style={styles.nutritionStat}>
                    <Text style={styles.nutritionValue}>{Math.round(foodTotals.proteinG)}g</Text>
                    <Text style={styles.nutritionUnit}>protein</Text>
                  </View>
                  <View style={styles.nutritionDivider} />
                  <View style={styles.nutritionStat}>
                    <Text style={styles.nutritionValue}>
                      {macroTargets.calories > 0
                        ? Math.round((foodTotals.calories / macroTargets.calories) * 100)
                        : 0}%
                    </Text>
                    <Text style={styles.nutritionUnit}>of target</Text>
                  </View>
                </View>
                <ProgressBar
                  value={macroTargets.calories > 0 ? foodTotals.calories / macroTargets.calories : 0}
                  color="#4ADE80"
                  height={4}
                />
              </>
            ) : (
              <Text style={styles.nutritionSetupHint}>
                Tap to set up your nutrition goal →
              </Text>
            )}
          </Card>
        </TouchableOpacity>

        {/* ── Health Modules ─────────────────────────────────── */}
        <View>
          <SectionHeader
            title="Health data"
            subtitle={
              healthData
                ? `Updated ${new Date(healthData.lastUpdated ?? "").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : healthAvailable
                ? "Reading device health…"
                : "Connect a wearable or device"
            }
            action={{ label: "Manage", onPress: () => router.push("/(tabs)/settings") }}
            paddingHorizontal={0}
          />

          {/* Connect device prompt (EAS build required) */}
          {!healthAvailable && (
            <View style={styles.connectPrompt}>
              <Ionicons name="watch-outline" size={20} color={colors.textTertiary} />
              <Text style={styles.connectPromptText}>
                Health data requires an EAS development build.{"\n"}
                Apple Health and Google Health Connect will activate automatically.
              </Text>
            </View>
          )}

          {/* Loading spinner */}
          {healthAvailable && healthLoading && (
            <View style={styles.healthLoading}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text style={styles.healthLoadingText}>Reading health data…</Text>
            </View>
          )}

          <Card padded={false} style={styles.modulesCard}>
            {healthModules.map((mod, i) => (
              <React.Fragment key={mod.title}>
                <ModuleTile mod={mod} />
                {i < healthModules.length - 1 && <View style={styles.modDivider} />}
              </React.Fragment>
            ))}
          </Card>
        </View>

        {/* ── Weekly habit trend ───────────────────────────── */}
        <View>
          <SectionHeader title="This week" subtitle="Habit completion rate" paddingHorizontal={0} />
          <Card><WeeklyChart /></Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: 110 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingTop: spacing.sm },
  greeting: { fontSize: 13, color: colors.textTertiary, fontWeight: "500" },
  name: { fontSize: 26, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.5, marginTop: 2 },
  notifBtn: { width: 36, height: 36, borderRadius: radii.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  // Age card
  ageCard: { gap: spacing.lg },
  ageScoreRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  ageScoreLeft: { gap: 2 },
  ageScoreLabel: { fontSize: 12, fontWeight: "600", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.5 },
  ageNumber: { fontSize: 64, fontWeight: "800", color: colors.accent, letterSpacing: -3, lineHeight: 68 },
  ageUnit: { fontSize: 14, color: colors.textSecondary, fontWeight: "500", marginTop: -4 },
  ageScoreRight: { alignItems: "center", gap: 6 },
  scoreRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 2.5, borderColor: colors.success, alignItems: "center", justifyContent: "center" },
  scoreValue: { fontSize: 26, fontWeight: "800", color: colors.success },
  scoreSubLabel: { fontSize: 9, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.3 },
  scoreCaption: { fontSize: 11, color: colors.textTertiary, textAlign: "center", lineHeight: 15 },
  ageMetaRow: { flexDirection: "row", gap: spacing.sm },
  statPill: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7, borderRadius: radii.md, borderWidth: 1, padding: spacing.sm + 2 },
  statPillText: {},
  statPillValue: { fontSize: 13, fontWeight: "700" },
  statPillLabel: { fontSize: 10, color: colors.textTertiary, marginTop: 1 },
  chartTitle: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  chartSub: { fontSize: 11, color: colors.textTertiary, lineHeight: 16 },
  // Nutrition
  nutritionCard: { gap: spacing.md },
  nutritionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nutritionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  nutritionIcon: { width: 26, height: 26, borderRadius: radii.sm, backgroundColor: "#4ADE8018", alignItems: "center", justifyContent: "center" },
  nutritionTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  nutritionRow: { flexDirection: "row", alignItems: "center" },
  nutritionStat: { flex: 1, alignItems: "center" },
  nutritionValue: { fontSize: 20, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.3 },
  nutritionUnit: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  nutritionDivider: { width: 1, height: 36, backgroundColor: colors.border },
  nutritionSetupHint: { fontSize: 13, color: colors.textTertiary, textAlign: "center", paddingVertical: spacing.sm },
  // Health connect prompt
  connectPrompt: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, backgroundColor: colors.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", padding: spacing.md },
  connectPromptText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  healthLoading: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  healthLoadingText: { fontSize: 12, color: colors.textTertiary },
  // Modules
  modulesCard: {},
  moduleTile: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2 },
  moduleIcon: { width: 38, height: 38, borderRadius: radii.md, alignItems: "center", justifyContent: "center" },
  moduleBody: { flex: 1, gap: 2 },
  moduleTitle: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  moduleValue: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  moduleSub: { fontSize: 12, color: colors.textTertiary },
  connectTag: { backgroundColor: colors.accentMuted, borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.accent + "40" },
  connectTagLabel: { fontSize: 11, fontWeight: "700", color: colors.accent },
  soonTag: { backgroundColor: colors.surface, borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 4 },
  soonTagLabel: { fontSize: 11, fontWeight: "600", color: colors.textTertiary },
  modDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
  // Chart
  chart: { flexDirection: "row", alignItems: "flex-end", height: 80, gap: spacing.xs },
  chartCol: { flex: 1, alignItems: "center", gap: 5, height: "100%" },
  chartBarWrap: { flex: 1, justifyContent: "flex-end", width: "100%" },
  chartBar: { width: "100%", borderRadius: radii.sm },
  chartDay: { fontSize: 10, fontWeight: "600", color: colors.textTertiary },
});
