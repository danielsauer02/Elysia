import React from "react";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radii, categoryColors } from "@/theme";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StreakBadge } from "@/components/ui/StreakBadge";
import { useHabits } from "@/context/HabitsContext";
import { useAppContext } from "@/context/AppContext";
import { mockUserSummary, mockFoodLog, mockMacroTarget } from "@/mocks/data";
import { getGreeting } from "@/utils/date";

// ─── Score Ring ──────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const grade =
    score >= 85 ? { label: "Excellent", color: colors.success } :
    score >= 70 ? { label: "Good", color: colors.accent } :
    score >= 55 ? { label: "Fair", color: colors.warning } :
    { label: "Needs work", color: colors.destructive };

  return (
    <View style={styles.scoreRingWrap}>
      <View style={[styles.scoreRing, { borderColor: grade.color }]}>
        <Text style={[styles.scoreNumber, { color: grade.color }]}>{score}</Text>
        <Text style={styles.scoreMax}>/100</Text>
      </View>
      <Text style={[styles.scoreGrade, { color: grade.color }]}>{grade.label}</Text>
    </View>
  );
}

// ─── Stat Tile ────────────────────────────────────────────────────────────────

function StatTile({ label, value, unit, icon, color }: {
  label: string; value: string | number; unit?: string;
  icon: keyof typeof Ionicons.glyphMap; color: string;
}) {
  return (
    <View style={styles.statTile}>
      <View style={[styles.statIcon, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={15} color={color} />
      </View>
      <View>
        <Text style={styles.statValue}>{value}<Text style={styles.statUnit}>{unit ? ` ${unit}` : ""}</Text></Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

// ─── Health Module Tile ───────────────────────────────────────────────────────

interface ModuleData {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  status: "connected" | "connect" | "coming_soon";
  value?: string;
  unit?: string;
  sub?: string;
  progress?: number;
  color: string;
}

const HEALTH_MODULES: ModuleData[] = [
  { title: "HRV", icon: "pulse-outline", status: "connect", color: "#818CF8", sub: "Heart rate variability — connects with Oura, Whoop, Garmin" },
  { title: "Sleep Score", icon: "moon-outline", status: "connect", color: "#A78BFA", sub: "Detailed sleep stages and recovery" },
  { title: "Resting HR", icon: "heart-outline", status: "connect", color: "#F87171", sub: "Baseline cardiovascular fitness" },
  { title: "Steps", icon: "footsteps-outline", status: "connect", color: "#34D399", sub: "Daily activity and movement" },
  { title: "Blood Glucose", icon: "analytics-outline", status: "coming_soon", color: "#FBBF24", sub: "CGM integration · Phase 2" },
  { title: "VO₂ Max", icon: "fitness-outline", status: "coming_soon", color: "#38BDF8", sub: "Cardiorespiratory fitness · Phase 2" },
];

function HealthModuleTile({ module }: { module: ModuleData }) {
  const isConnect = module.status === "connect";
  const isComingSoon = module.status === "coming_soon";

  return (
    <TouchableOpacity activeOpacity={isComingSoon ? 1 : 0.8} style={styles.moduleTile}>
      <View style={[styles.moduleIcon, { backgroundColor: module.color + "18" }]}>
        <Ionicons name={module.icon} size={18} color={module.color} />
      </View>
      <View style={styles.moduleBody}>
        <Text style={styles.moduleTitle}>{module.title}</Text>
        {module.status === "connected" && module.value ? (
          <>
            <Text style={[styles.moduleValue, { color: module.color }]}>
              {module.value}
              {module.unit ? <Text style={styles.moduleUnit}> {module.unit}</Text> : null}
            </Text>
            {module.progress !== undefined && (
              <ProgressBar value={module.progress} color={module.color} height={3} />
            )}
          </>
        ) : (
          <Text style={styles.moduleSub} numberOfLines={2}>{module.sub}</Text>
        )}
      </View>
      {isConnect && (
        <View style={styles.connectBadge}>
          <Text style={styles.connectBadgeLabel}>Connect</Text>
        </View>
      )}
      {isComingSoon && (
        <View style={styles.comingSoonBadge}>
          <Text style={styles.comingSoonBadgeLabel}>Phase 2</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const router = useRouter();
  const { onboardingData } = useAppContext();
  const { habits, getTodayProgress } = useHabits();
  const { completed, total } = getTodayProgress();
  const activeStreaks = habits.filter((h) => h.state === "active" && h.streakCount > 0);
  const longestStreak = Math.max(0, ...activeStreaks.map((h) => h.streakCount));

  const foodTotals = mockFoodLog.reduce(
    (acc, e) => ({ calories: acc.calories + e.calories, protein: acc.protein + e.proteinG }),
    { calories: 0, protein: 0 }
  );

  const firstName = onboardingData?.name?.split(" ")[0] ?? "there";
  const greeting = getGreeting();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.name}>{firstName}</Text>
          </View>
          <TouchableOpacity style={styles.notifBtn}>
            <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Longevity Score ───────────────────────────────── */}
        <Card variant="elevated" style={styles.scoreCard}>
          <ScoreRing score={mockUserSummary.longevityScore} />
          <View style={styles.scoreRight}>
            <Text style={styles.scoreCardTitle}>Longevity Score</Text>
            <Text style={styles.scoreCardSub}>
              Updated daily based on habits, sleep, recovery, and nutrition.
            </Text>
            <View style={styles.scoreStats}>
              <StatTile label="Habits today" value={`${completed}/${total}`} icon="checkmark-done-outline" color={colors.accent} />
              <StatTile label="Best streak" value={longestStreak} unit="d" icon="flame-outline" color={colors.warning} />
            </View>
          </View>
        </Card>

        {/* ── Nutrition Summary ─────────────────────────────── */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push("/(tabs)/tracker")}
        >
          <Card style={styles.nutritionCard}>
            <View style={styles.nutritionHeader}>
              <View style={styles.nutritionHeaderLeft}>
                <View style={styles.nutritionIcon}>
                  <Ionicons name="nutrition-outline" size={15} color="#4ADE80" />
                </View>
                <Text style={styles.nutritionTitle}>Today's nutrition</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
            </View>
            <View style={styles.nutritionRow}>
              <View style={styles.nutritionStat}>
                <Text style={styles.nutritionValue}>{Math.round(foodTotals.calories)}</Text>
                <Text style={styles.nutritionUnit}>kcal</Text>
              </View>
              <View style={styles.nutritionDivider} />
              <View style={styles.nutritionStat}>
                <Text style={styles.nutritionValue}>{Math.round(foodTotals.protein)}g</Text>
                <Text style={styles.nutritionUnit}>protein</Text>
              </View>
              <View style={styles.nutritionDivider} />
              <View style={styles.nutritionStat}>
                <Text style={styles.nutritionValue}>
                  {Math.round((foodTotals.calories / mockMacroTarget.calories) * 100)}%
                </Text>
                <Text style={styles.nutritionUnit}>of target</Text>
              </View>
            </View>
            <ProgressBar
              value={foodTotals.calories / mockMacroTarget.calories}
              color="#4ADE80"
              height={4}
            />
          </Card>
        </TouchableOpacity>

        {/* ── Health Modules ────────────────────────────────── */}
        <View>
          <SectionHeader
            title="Health data"
            subtitle="Connect a wearable to see live metrics"
            action={{ label: "Manage", onPress: () => router.push("/(tabs)/settings") }}
            paddingHorizontal={0}
          />
          <Card padded={false} style={styles.modulesCard}>
            {HEALTH_MODULES.map((mod, i) => (
              <React.Fragment key={mod.title}>
                <HealthModuleTile module={mod} />
                {i < HEALTH_MODULES.length - 1 && <View style={styles.moduleDivider} />}
              </React.Fragment>
            ))}
          </Card>
        </View>

        {/* ── Weekly Habit Trend ───────────────────────────── */}
        <View>
          <SectionHeader
            title="This week"
            subtitle="Habit completion trend"
            paddingHorizontal={0}
          />
          <Card>
            <WeeklyChart />
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Weekly Chart (simple bars) ───────────────────────────────────────────────

function WeeklyChart() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const values = [0.85, 1.0, 0.6, 0.9, 0.75, 0.5, 0.4];
  const todayIdx = 4; // Friday placeholder

  return (
    <View style={styles.chartContainer}>
      {days.map((day, i) => {
        const isToday = i === todayIdx;
        const barColor = isToday ? colors.accent : values[i]! >= 0.8 ? colors.success : values[i]! >= 0.6 ? colors.warning : colors.destructiveMuted;
        return (
          <View key={day} style={styles.chartColumn}>
            <View style={styles.chartBarWrap}>
              <View
                style={[
                  styles.chartBar,
                  { height: `${(values[i] ?? 0) * 100}%`, backgroundColor: barColor },
                  isToday && { borderWidth: 1, borderColor: colors.accent },
                ]}
              />
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingTop: spacing.sm },
  greeting: { fontSize: 14, color: colors.textTertiary, fontWeight: "500" },
  name: { fontSize: 28, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.6, marginTop: 2 },
  notifBtn: { width: 36, height: 36, borderRadius: radii.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  // Score card
  scoreCard: { flexDirection: "row", gap: spacing.lg, alignItems: "center" },
  scoreRingWrap: { alignItems: "center", gap: 4 },
  scoreRing: { width: 86, height: 86, borderRadius: 43, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  scoreNumber: { fontSize: 28, fontWeight: "800" },
  scoreMax: { fontSize: 11, color: colors.textTertiary },
  scoreGrade: { fontSize: 11, fontWeight: "700" },
  scoreRight: { flex: 1, gap: 6 },
  scoreCardTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  scoreCardSub: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  scoreStats: { flexDirection: "row", gap: spacing.lg, marginTop: 4 },
  statTile: { flexDirection: "row", alignItems: "center", gap: 8 },
  statIcon: { width: 28, height: 28, borderRadius: radii.sm, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  statUnit: { fontSize: 11, color: colors.textTertiary, fontWeight: "400" },
  statLabel: { fontSize: 10, color: colors.textTertiary, marginTop: 1 },
  // Nutrition card
  nutritionCard: { gap: spacing.md },
  nutritionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nutritionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  nutritionIcon: { width: 26, height: 26, borderRadius: radii.sm, backgroundColor: "#4ADE8018", alignItems: "center", justifyContent: "center" },
  nutritionTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  nutritionRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  nutritionStat: { flex: 1, alignItems: "center" },
  nutritionValue: { fontSize: 20, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.3 },
  nutritionUnit: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  nutritionDivider: { width: 1, height: 36, backgroundColor: colors.border },
  // Modules
  modulesCard: {},
  moduleTile: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  moduleIcon: { width: 40, height: 40, borderRadius: radii.md, alignItems: "center", justifyContent: "center" },
  moduleBody: { flex: 1, gap: 3 },
  moduleTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  moduleValue: { fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  moduleUnit: { fontSize: 13, fontWeight: "400" },
  moduleSub: { fontSize: 12, color: colors.textTertiary, lineHeight: 17 },
  moduleDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
  connectBadge: { backgroundColor: colors.accentMuted, borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.accent + "40" },
  connectBadgeLabel: { fontSize: 11, fontWeight: "700", color: colors.accent },
  comingSoonBadge: { backgroundColor: colors.surface, borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 4 },
  comingSoonBadgeLabel: { fontSize: 11, fontWeight: "600", color: colors.textTertiary },
  // Chart
  chartContainer: { flexDirection: "row", alignItems: "flex-end", height: 80, gap: spacing.xs },
  chartColumn: { flex: 1, alignItems: "center", gap: 5, height: "100%" },
  chartBarWrap: { flex: 1, justifyContent: "flex-end", width: "100%" },
  chartBar: { width: "100%", borderRadius: radii.sm },
  chartDay: { fontSize: 10, fontWeight: "600", color: colors.textTertiary },
});
