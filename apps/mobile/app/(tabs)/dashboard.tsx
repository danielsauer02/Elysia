import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
} from "react-native";
import RNAnimated from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  colors,
  radii,
  spacing,
  surface,
  text,
  typography,
} from "@/theme";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { LongevityPerformanceView, type TimeFilter, type LockedPillar } from "@/components/ui/LongevityPerformanceView";
import { HourglassDnaAnimation } from "@/components/longevity/HourglassDnaAnimation";
import { AgingFactorScale } from "@/components/longevity/AgingFactorScale";
import { LifeTrajectoryModal } from "@/components/longevity/LifeTrajectoryModal";
import { useLongevityData } from "@/hooks/useLongevityData";
import { PerformanceCircles } from "@/components/ui/PerformanceCircles";
import { useAppContext } from "@/context/AppContext";
import { useNutrition } from "@/context/NutritionContext";
import { useFloatingTabBarScrollPadding } from "@/hooks/useFloatingTabBarScrollPadding";
import { useAppTopBarHeight } from "@/components/navigation/AppTopBar";
import { EnergyBalanceCard } from "@/components/analytics/EnergyBalanceCard";
import { InsightsFeed } from "@/components/ai/InsightsFeed";
import { HealthDataGrid } from "@/components/dashboard/HealthDataGrid";
import { useStickyRingsHeader } from "@/components/dashboard/StickyRingsHeader";
import type { SummaryRingValue } from "@/components/dashboard/DailySummaryRings";

// ─── Mock aging data ─────────────────────────────────────────────────────────
/**
 * Tier 2 / Tier 3 pillars surfaced as locked entries in the contributions
 * waterfall so the user sees the roadmap.
 */
const LOCKED_PILLARS: LockedPillar[] = [
  { category: "blood",    label: "Blood Panel",    tier: 2, icon: "water-outline" },
  { category: "bodyComp", label: "Body Composition", tier: 2, icon: "fitness-outline" },
  { category: "genetic",  label: "Genetics",       tier: 3, icon: "git-network-outline" },
  { category: "skin",     label: "Skin Age",       tier: 3, icon: "scan-outline" },
];

function calcChronoAge(dob?: string): number {
  if (!dob) return 32;
  const ms = Date.now() - new Date(dob).getTime();
  return ms / (1000 * 60 * 60 * 24 * 365.25);
}

// ─── Stat pill ────────────────────────────────────────────────────────────────
function StatPill({
  icon, label, value, color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={[styles.statPill, { backgroundColor: color + "12", borderColor: color + "30" }]}>
      <Ionicons name={icon} size={14} color={color} />
      <View>
        <Text style={[styles.statPillValue, { color }]}>{value}</Text>
        <Text style={styles.statPillLabel}>{label}</Text>
      </View>
    </View>
  );
}

// ─── Time filter labels ───────────────────────────────────────────────────────
const TIME_FILTER_LABELS: Record<TimeFilter, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  "6months": "6 Months",
  all: "All time",
};

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

// ─── Diagnostics nav card ─────────────────────────────────────────────────────
function DiagnosticNavCard({
  icon,
  title,
  tier,
  description,
  href,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  tier: "pro" | "premium";
  description: string;
  href: "/diagnostics-genetics" | "/diagnostics-hair" | "/diagnostics-skin";
}) {
  const router = useRouter();
  const tierColor = tier === "premium" ? "#A78BFA" : colors.accent;
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={() => router.push(href)}>
      <Card style={styles.comingSoonCard}>
        <View style={styles.comingSoonRow}>
          <View style={[styles.comingSoonIcon, { backgroundColor: tierColor + "15" }]}>
            <Ionicons name={icon} size={20} color={tierColor} />
          </View>
          <View style={styles.comingSoonBody}>
            <View style={styles.comingSoonTitleRow}>
              <Text style={styles.comingSoonTitle}>{title}</Text>
              <View style={[styles.tierBadge, { backgroundColor: tierColor + "20" }]}>
                <Ionicons name="chevron-forward" size={12} color={tierColor} />
                <Text style={[styles.tierBadgeLabel, { color: tierColor }]}>Open</Text>
              </View>
            </View>
            <Text style={styles.comingSoonDesc}>{description}</Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

// ─── Coming Soon Card ─────────────────────────────────────────────────────────
function ComingSoonCard({
  icon,
  title,
  tier,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  tier: "pro" | "premium";
  description: string;
}) {
  const tierColor = tier === "premium" ? "#A78BFA" : colors.accent;
  return (
    <Card style={styles.comingSoonCard}>
      <View style={styles.comingSoonRow}>
        <View style={[styles.comingSoonIcon, { backgroundColor: tierColor + "15" }]}>
          <Ionicons name={icon} size={20} color={tierColor} />
        </View>
        <View style={styles.comingSoonBody}>
          <View style={styles.comingSoonTitleRow}>
            <Text style={styles.comingSoonTitle}>{title}</Text>
            <View style={[styles.tierBadge, { backgroundColor: tierColor + "20" }]}>
              <Ionicons name="lock-closed-outline" size={10} color={tierColor} />
              <Text style={[styles.tierBadgeLabel, { color: tierColor }]}>
                {tier === "premium" ? "Premium" : "Pro"}
              </Text>
            </View>
          </View>
          <Text style={styles.comingSoonDesc}>{description}</Text>
        </View>
        <View style={styles.soonPill}>
          <Text style={styles.soonPillLabel}>Coming soon</Text>
        </View>
      </View>
    </Card>
  );
}

// ─── Time Filter Modal ────────────────────────────────────────────────────────
function TimeFilterModal({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: TimeFilter;
  onSelect: (f: TimeFilter) => void;
  onClose: () => void;
}) {
  const filters: TimeFilter[] = ["daily", "weekly", "monthly", "6months", "all"];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.filterOverlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.filterSheet}>
        <Text style={styles.filterTitle}>Time window</Text>
        {filters.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterOption, f === selected && styles.filterOptionActive]}
            onPress={() => { onSelect(f); onClose(); }}
          >
            <Text style={[styles.filterOptionLabel, f === selected && { color: colors.accent }]}>
              {TIME_FILTER_LABELS[f]}
            </Text>
            {f === selected && <Ionicons name="checkmark" size={16} color={colors.accent} />}
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
type CardView = "aging" | "longevity";

export default function DashboardScreen() {
  const tabScrollPad = useFloatingTabBarScrollPadding();
  const topBarHeight = useAppTopBarHeight();
  const router = useRouter();
  const { onboardingData } = useAppContext();
  const { macroTargets, getDayTotals, isGoalSet } = useNutrition();

  const firstName = onboardingData?.name?.split(" ")[0] ?? "there";
  const chronoAgeFromDob = calcChronoAge(onboardingData?.dateOfBirth);
  const foodTotals = getDayTotals();

  // Card view toggle — Performance is default per v1.2.0 wheel redesign.
  const [cardView, setCardView] = useState<CardView>("longevity");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("daily");
  const [timeFilterVisible, setTimeFilterVisible] = useState(false);
  const [lifeModalOpen, setLifeModalOpen] = useState(false);

  // Live Elysia Age + Longevity data from Convex.
  const longevity = useLongevityData(timeFilter);
  const chronoAge = longevity.chronoAge ?? chronoAgeFromDob;
  const bioAge = longevity.elysiaAge ?? Math.max(10, chronoAge - 1.8);
  const calibrating = longevity.calibration?.status === "calibrating";

  // Animated sliding pill for the segmented toggle
  // Order on screen: [Performance | Trajectory] — Performance is the default
  // and lives on the left.
  const TOGGLE_OPTION_W = 92;
  const toggleAnim = useRef(new Animated.Value(0)).current;
  const handleSetView = (view: CardView) => {
    setCardView(view);
    Animated.spring(toggleAnim, {
      toValue: view === "longevity" ? 0 : TOGGLE_OPTION_W,
      useNativeDriver: true,
      tension: 90,
      friction: 14,
    }).start();
  };

  // Today's date in a Bevel-style "Today, 26 May" format.
  const today = new Date();
  const todayLabel = today.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // ─── Summary rings (Whoop trio) — drives both the in-flow expanded
  // header and the sticky compact bar.
  // We map onto the v1.2.0 wheel layers:
  //   sleep    = recoverySleep   (sleep + autonomic recovery aggregate)
  //   recovery = stressPsyche    (HRV / stress proxy)
  //   strain   = movement        (activity / strain proxy)
  // The composite is shown in the inner Longevity Battery further below.
  const layers = (longevity.layerScores ?? {}) as Record<string, number | null | undefined>;
  const summaryValues: SummaryRingValue[] = useMemo(
    () => [
      {
        id: "sleep",
        label: "Sleep",
        value: layers.recoverySleep ?? null,
      },
      {
        id: "recovery",
        label: "Recovery",
        value: layers.stressPsyche ?? longevity.composite ?? null,
      },
      {
        id: "strain",
        label: "Strain",
        value: layers.movement ?? null,
      },
    ],
    [layers.recoverySleep, layers.stressPsyche, layers.movement, longevity.composite]
  );

  const summaryContext = calibrating
    ? `Calibrating · day ${longevity.calibration?.daysCalibrated ?? 0} of ${
        longevity.calibration?.daysRequired ?? 14
      }`
    : firstSummaryLine(summaryValues);

  const onRingPress = useCallback(
    (_id: string) => {
      // Future: route to the pillar's detail screen.
    },
    []
  );

  const { onScroll, header } = useStickyRingsHeader({
    values: summaryValues,
    topOffset: topBarHeight,
    contextLine: summaryContext,
    onPressRing: onRingPress,
  });

  return (
    <View style={styles.safe}>
      <RNAnimated.ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topBarHeight + spacing.xs, paddingBottom: tabScrollPad },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        removeClippedSubviews
      >
        {/* Greeting + date header — sits below TopBar, above the rings. */}
        <View style={styles.greetingRow}>
          <View style={styles.greetingBlock}>
            <Text style={styles.dateLabel}>{todayLabel}</Text>
            <Text style={styles.greetingText}>
              <Text style={styles.greetingDim}>Hi, </Text>
              <Text style={styles.greetingStrong}>{firstName}</Text>
            </Text>
          </View>
        </View>

        {/* Whoop-style summary trio — collapses into the sticky header. */}
        {header}

        {/* ── Main Age Card (Aging Trajectory / Longevity Performance) ── */}
      <View style={styles.sectionPad}>
        <Card variant="elevated" style={styles.ageCard}>
          {/* Card header: toggle + time filter */}
          <View style={styles.cardTopRow}>
            {/* Segmented toggle with sliding pill */}
            <View style={styles.viewToggle}>
              <Animated.View
                style={[styles.toggleIndicator, { transform: [{ translateX: toggleAnim }] }]}
              />
              <TouchableOpacity onPress={() => handleSetView("longevity")} style={styles.toggleOption}>
                <Text style={[styles.toggleOptionLabel, cardView === "longevity" && { color: colors.accent }]}>
                  Performance
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleSetView("aging")} style={styles.toggleOption}>
                <Text style={[styles.toggleOptionLabel, cardView === "aging" && { color: colors.accent }]}>
                  Trajectory
                </Text>
              </TouchableOpacity>
            </View>

            {/* Time filter */}
            <TouchableOpacity style={styles.timeFilterBtn} onPress={() => setTimeFilterVisible(true)}>
              <Text style={styles.timeFilterLabel}>{TIME_FILTER_LABELS[timeFilter]}</Text>
              <Ionicons name="chevron-down" size={12} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* ── Aging Trajectory View (v1.2.0: Hourglass + factor scale + modal) ── */}
          {cardView === "aging" && (
            <View style={styles.trajectoryBlock}>
              <View style={styles.hourglassWrap}>
                <HourglassDnaAnimation
                  elysiaAge={longevity.elysiaAge}
                  delta={
                    longevity.elysiaAge !== undefined && longevity.chronoAge !== undefined
                      ? longevity.elysiaAge - longevity.chronoAge
                      : undefined
                  }
                  calibrating={calibrating}
                  calibrationLabel={
                    longevity.calibration?.daysRequired
                      ? `day ${longevity.calibration.daysCalibrated}/${longevity.calibration.daysRequired}`
                      : undefined
                  }
                />
              </View>

              <AgingFactorScale velocity28d={longevity.velocity28d} />

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.lifeTrajBtn}
                onPress={() => setLifeModalOpen(true)}
              >
                <Ionicons name="trending-up-outline" size={16} color={colors.accent} />
                <Text style={styles.lifeTrajLabel}>Life Trajectory</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.accent} />
              </TouchableOpacity>

              <View style={styles.ageStatsRow}>
                <StatPill
                  icon="person-outline"
                  label="Chronological"
                  value={`${chronoAge.toFixed(1)} yrs`}
                  color={colors.textSecondary}
                />
                <StatPill
                  icon="leaf-outline"
                  label="Elysia"
                  value={`${bioAge.toFixed(1)} yrs`}
                  color={
                    bioAge < chronoAge ? colors.success : bioAge > chronoAge ? colors.destructive : colors.textPrimary
                  }
                />
              </View>
            </View>
          )}

          {/* ── Longevity Performance View ── */}
          {cardView === "longevity" && (
            <LongevityPerformanceView
              elysiaAge={bioAge}
              contributions={longevity.contributions}
              lockedPillars={LOCKED_PILLARS}
              timeFilter={timeFilter}
              calibrationDaysCompleted={longevity.calibration?.daysCalibrated}
              calibrationDaysRequired={longevity.calibration?.daysRequired}
              layerScores={longevity.layerScores as Record<string, number | null> | undefined}
              pillarScores={longevity.pillarScores as Record<string, number | null> | undefined}
              composite={longevity.composite}
              healthspanCreditsToday={longevity.healthspanCreditsToday}
              trajectoryStatus={longevity.trajectoryStatus}
            />
          )}
        </Card>
      </View>

        {/* Time filter modal */}
        <TimeFilterModal
          visible={timeFilterVisible}
          selected={timeFilter}
          onSelect={setTimeFilter}
          onClose={() => setTimeFilterVisible(false)}
        />

        {/* Life Trajectory modal */}
        <LifeTrajectoryModal
          visible={lifeModalOpen}
          onClose={() => setLifeModalOpen(false)}
          history={longevity.trajectoryHistory}
          chronoAge={longevity.chronoAge ?? chronoAge}
          elysiaAge={longevity.elysiaAge ?? bioAge}
          velocity28d={longevity.velocity28d}
          sex={"male"}
        />

        {/* ── Nutrition Summary ─────────────────────────────── */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => router.push("/(tabs)/tracker")} style={styles.sectionPad}>
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

        {/* ── Performance Circles ───────────────────────────── */}
        <View style={styles.sectionPad}>
          <SectionHeader title="Daily overview" subtitle="Tap a circle for details" />
          <Card><PerformanceCircles /></Card>
        </View>

        {/* ── AI Insights Feed (Phase 5) ──────────────────────── */}
        <View style={styles.sectionPad}>
          <SectionHeader
            title="Insights"
            subtitle="AI-generated, refreshed nightly"
          />
          <InsightsFeed />
        </View>

        {/* ── Energy Balance (Phase 4) ────────────────────────── */}
        <View style={styles.sectionPad}>
          <SectionHeader
            title="Energy & analytics"
            subtitle="Calories in vs out, balance, recovery"
          />
          <EnergyBalanceCard />
        </View>

        {/* ── Health Modules ─────────────────────────────────── */}
        <HealthDataGrid />

        {/* ── Coming Soon Sections ───────────────────────────── */}
        <View style={[styles.comingSoonSection, styles.sectionPad]}>
          <SectionHeader title="Advanced analytics" subtitle="Unlock deeper insights" />
          <ComingSoonCard
            icon="body-outline"
            title="Body Analysis"
            tier="pro"
            description="Advanced body composition, metabolic rate, and physique tracking."
          />
          <ComingSoonCard
            icon="git-network-outline"
            title="Genetics Analysis"
            tier="premium"
            description="Personalized longevity insights from your genetic profile."
          />
          <ComingSoonCard
            icon="scan-outline"
            title="Skin Analysis"
            tier="premium"
            description="AI-powered skin age assessment and photoaging tracking."
          />
        </View>

        {/* ── Weekly habit trend ────────────────────────────── */}
        <View style={styles.sectionPad}>
          <SectionHeader title="This week" subtitle="Habit completion rate" />
          <Card><WeeklyChart /></Card>
        </View>
      </RNAnimated.ScrollView>
    </View>
  );
}

/** Pick a one-liner summary from the three ring values. */
function firstSummaryLine(values: SummaryRingValue[]): string {
  const recovery = values.find((v) => v.id === "recovery")?.value;
  if (recovery == null) return "We're still gathering today's data.";
  if (recovery >= 80) return "Strong recovery — push the day.";
  if (recovery >= 60) return "Solid recovery. Train moderate.";
  if (recovery >= 40) return "Moderate recovery. Keep it light today.";
  return "Low recovery. Prioritise sleep and nutrition.";
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: surface.base },
  content: {
    paddingHorizontal: 0,
    gap: spacing.xl,
  },

  // Greeting row (below the global TopBar)
  greetingRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  greetingBlock: { gap: 2 },
  dateLabel: {
    ...typography.eyebrow,
    color: text.tertiary,
  },
  greetingText: {
    ...typography.title1,
    fontSize: 24,
  },
  greetingDim: { color: text.secondary },
  greetingStrong: { color: text.primary },

  // Horizontal inset that all "card sections" use so cards sit inset from
  // the screen edges (Whoop / Bevel feel) instead of going edge-to-edge.
  sectionPad: { paddingHorizontal: spacing.lg },

  // Age card
  ageCard: { gap: spacing.lg },
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  // Segmented toggle
  viewToggle: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: 2, position: "relative", overflow: "hidden" },
  toggleIndicator: { position: "absolute", top: 2, left: 2, bottom: 2, width: 92, backgroundColor: colors.card, borderRadius: radii.sm - 1, zIndex: 0 },
  toggleOption: { width: 92, paddingVertical: spacing.xs, alignItems: "center", borderRadius: radii.sm - 1, zIndex: 1 },
  toggleOptionActive: {},
  toggleOptionLabel: { fontSize: 12, fontWeight: "600", color: colors.textTertiary },

  // Time filter
  timeFilterBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surface, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs },
  timeFilterLabel: { fontSize: 11, fontWeight: "600", color: colors.textTertiary },

  // Trajectory block (v1.2.0)
  trajectoryBlock: { gap: spacing.md, alignItems: "stretch" },
  hourglassWrap: { alignItems: "center", paddingVertical: spacing.xs },
  lifeTrajBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.accent + "18",
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.accent + "40",
  },
  lifeTrajLabel: { fontSize: 13, fontWeight: "700", color: colors.accent, letterSpacing: 0.2 },
  ageStatsRow: { flexDirection: "row", gap: spacing.sm },
  statPill: { flex: 1, flexDirection: "row", alignItems: "center", gap: 7, borderRadius: radii.md, borderWidth: 1, padding: spacing.sm + 2 },
  statPillValue: { fontSize: 13, fontWeight: "700" },
  statPillLabel: { fontSize: 10, color: colors.textTertiary, marginTop: 1 },
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

  // Coming soon
  comingSoonSection: { gap: spacing.md },
  comingSoonCard: { gap: 0 },
  comingSoonRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  comingSoonIcon: { width: 44, height: 44, borderRadius: radii.md, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  comingSoonBody: { flex: 1, gap: 3 },
  comingSoonTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  comingSoonTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  tierBadge: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: radii.full, paddingHorizontal: 7, paddingVertical: 2 },
  tierBadgeLabel: { fontSize: 10, fontWeight: "700" },
  comingSoonDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  soonPill: { backgroundColor: colors.surface, borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.border },
  soonPillLabel: { fontSize: 10, fontWeight: "600", color: colors.textTertiary },

  // Chart
  chart: { flexDirection: "row", alignItems: "flex-end", height: 80, gap: spacing.xs },
  chartCol: { flex: 1, alignItems: "center", gap: 5, height: "100%" },
  chartBarWrap: { flex: 1, justifyContent: "flex-end", width: "100%" },
  chartBar: { width: "100%", borderRadius: radii.sm },
  chartDay: { fontSize: 10, fontWeight: "600", color: colors.textTertiary },

  // Time filter modal
  filterOverlay: { flex: 1, backgroundColor: colors.overlay },
  filterSheet: {
    position: "absolute",
    top: "35%",
    right: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minWidth: 160,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  filterTitle: { fontSize: 12, fontWeight: "700", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: spacing.sm, paddingHorizontal: spacing.sm },
  filterOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radii.sm },
  filterOptionActive: { backgroundColor: colors.surface },
  filterOptionLabel: { fontSize: 14, color: colors.textPrimary },
});
