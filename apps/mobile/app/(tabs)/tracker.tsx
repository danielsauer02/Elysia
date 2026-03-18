import React, { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { UserHabit, HabitState } from "@elysia/domain";
import { colors, spacing, radii, categoryColors } from "@/theme";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TabSwitcher } from "@/components/ui/TabSwitcher";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StreakBadge } from "@/components/ui/StreakBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useHabits } from "@/context/HabitsContext";
import { mockFoodLog, mockMacroTarget, type FoodEntry } from "@/mocks/data";

// ─── Types ──────────────────────────────────────────────────────────────────

type HabitFilter = "active" | "planned" | "abandoned";

// ─── Habits Section ─────────────────────────────────────────────────────────

function HabitCard({
  habit,
  completed,
  onToggle,
  onStateChange,
  onDelete,
}: {
  habit: UserHabit;
  completed: boolean;
  onToggle: () => void;
  onStateChange: (state: HabitState) => void;
  onDelete: () => void;
}) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const [menuOpen, setMenuOpen] = useState(false);
  const catColor = categoryColors[habit.category] ?? colors.accent;

  const handleCheck = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, speed: 60 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
    onToggle();
  };

  const stateActions: { label: string; state?: HabitState; danger?: boolean }[] = [
    ...(habit.state !== "active" ? [{ label: "Move to Active", state: "active" as HabitState }] : []),
    ...(habit.state !== "planned" ? [{ label: "Save as Planned", state: "planned" as HabitState }] : []),
    ...(habit.state !== "abandoned" ? [{ label: "Mark Abandoned", state: "abandoned" as HabitState }] : []),
    { label: "Remove completely", danger: true },
  ];

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <View
        style={[
          styles.habitCard,
          completed && { borderLeftWidth: 2.5, borderLeftColor: colors.success },
        ]}
      >
        <View style={styles.habitCardInner}>
          {/* Checkbox — only shown for active habits */}
          {habit.state === "active" ? (
            <TouchableOpacity onPress={handleCheck} activeOpacity={0.8} style={styles.checkArea}>
              <View
                style={[
                  styles.checkbox,
                  completed
                    ? { backgroundColor: colors.success, borderColor: colors.success }
                    : { backgroundColor: "transparent", borderColor: colors.borderStrong },
                ]}
              >
                {completed && <Ionicons name="checkmark" size={14} color="#0C0F1A" />}
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.checkArea}>
              <View
                style={[
                  styles.stateDot,
                  habit.state === "planned"
                    ? { backgroundColor: colors.warning }
                    : { backgroundColor: colors.textTertiary },
                ]}
              />
            </View>
          )}

          {/* Body */}
          <View style={styles.habitBody}>
            <View style={styles.habitTop}>
              <Text
                style={[
                  styles.habitTitle,
                  completed && { textDecorationLine: "line-through", color: colors.textTertiary },
                  habit.state !== "active" && { color: colors.textSecondary },
                ]}
                numberOfLines={2}
              >
                {habit.title}
              </Text>
              {habit.state === "active" && <StreakBadge count={habit.streakCount} />}
            </View>

            <View style={styles.habitMeta}>
              <Badge label={habit.category.replace(/_/g, " ")} category={habit.category} size="sm" />
              <Text style={styles.habitSchedule}>
                {habit.schedule.frequencyPerWeek}×/wk · {habit.schedule.targetTimesOfDay[0]}
              </Text>
            </View>

            {habit.state === "active" && (
              <ProgressBar
                value={habit.completionRate30d}
                color={catColor}
                height={3}
                showLabel
                label={`${Math.round(habit.completionRate30d * 100)}% last 30d`}
              />
            )}

            {habit.state === "planned" && (
              <Text style={styles.plannedNote}>
                Starting {new Date(habit.schedule.startsOn).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </Text>
            )}
          </View>

          {/* Menu */}
          <TouchableOpacity onPress={() => setMenuOpen(true)} style={styles.menuBtn}>
            <Ionicons name="ellipsis-vertical" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Inline action sheet */}
        <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
          <TouchableOpacity style={styles.menuOverlay} onPress={() => setMenuOpen(false)} activeOpacity={1}>
            <View style={styles.menuSheet}>
              <Text style={styles.menuTitle}>{habit.title}</Text>
              {stateActions.map((action) => (
                <TouchableOpacity
                  key={action.label}
                  onPress={() => {
                    setMenuOpen(false);
                    if (action.danger) {
                      Alert.alert("Remove habit", "This will permanently remove this habit.", [
                        { text: "Cancel", style: "cancel" },
                        { text: "Remove", style: "destructive", onPress: onDelete },
                      ]);
                    } else if (action.state) {
                      onStateChange(action.state);
                    }
                  }}
                  style={styles.menuItem}
                >
                  <Text style={[styles.menuItemLabel, action.danger && { color: colors.destructive }]}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </Animated.View>
  );
}

function HabitsSection() {
  const router = useRouter();
  const { habits, completedTodayIds, completeToday, updateHabitState, getTodayProgress } = useHabits();
  const [filter, setFilter] = useState<HabitFilter>("active");

  const visibleHabits = habits.filter((h) => {
    if (filter === "abandoned") return h.state === "abandoned" || h.state === "paused";
    return h.state === filter;
  });

  const { completed, total } = getTodayProgress();
  const completionRate = total > 0 ? completed / total : 0;

  const filterOptions = [
    { id: "active", label: "Active", icon: "flash-outline" as const, count: habits.filter((h) => h.state === "active").length },
    { id: "planned", label: "Planned", icon: "time-outline" as const, count: habits.filter((h) => h.state === "planned").length },
    { id: "abandoned", label: "Abandoned", icon: "archive-outline" as const, count: habits.filter((h) => h.state === "abandoned" || h.state === "paused").length },
  ];

  return (
    <ScrollView contentContainerStyle={styles.sectionContent} showsVerticalScrollIndicator={false}>
      {/* Today progress (only on active tab) */}
      {filter === "active" && (
        <Card variant="accent" style={styles.progressCard}>
          <View style={styles.progressTop}>
            <View>
              <Text style={styles.progressTitle}>Today</Text>
              <Text style={styles.progressSub}>{completed} of {total} completed</Text>
            </View>
            <View style={styles.progressCircle}>
              <Text style={styles.progressPct}>{Math.round(completionRate * 100)}%</Text>
            </View>
          </View>
          <ProgressBar
            value={completionRate}
            color={completionRate === 1 ? colors.success : colors.accent}
            trackColor={colors.accent + "25"}
            height={6}
          />
          {completionRate === 1 && total > 0 && (
            <Text style={styles.allDone}>🎉 All habits done for today!</Text>
          )}
        </Card>
      )}

      {/* Filter tabs */}
      <TabSwitcher
        options={filterOptions}
        active={filter}
        onChange={(id) => setFilter(id as HabitFilter)}
        variant="underline"
      />

      <View style={styles.habitList}>
        {visibleHabits.length === 0 ? (
          <EmptyState
            icon={filter === "active" ? "flash-outline" : filter === "planned" ? "time-outline" : "archive-outline"}
            title={filter === "active" ? "No active habits" : filter === "planned" ? "Nothing planned yet" : "Nothing abandoned"}
            description={
              filter === "active"
                ? "Browse Elysia to add evidence-based habits to your active tracking."
                : filter === "planned"
                ? "Save habits for later when you browse the Elysia library."
                : "Habits you've tried and stopped will appear here."
            }
            action={
              filter === "active"
                ? { label: "Browse Elysia Library", onPress: () => router.push("/(tabs)/elysia") }
                : undefined
            }
          />
        ) : (
          visibleHabits.map((habit) => (
            <HabitCard
              key={habit.habitId}
              habit={habit}
              completed={completedTodayIds.has(habit.habitId)}
              onToggle={() => completeToday(habit.habitId)}
              onStateChange={(state) => updateHabitState(habit.habitId, state)}
              onDelete={() => updateHabitState(habit.habitId, "abandoned")}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

// ─── Nutrition Section ──────────────────────────────────────────────────────

const MEAL_LABELS: Record<FoodEntry["mealType"], string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

const MEAL_ICONS: Record<FoodEntry["mealType"], keyof typeof Ionicons.glyphMap> = {
  breakfast: "sunny-outline",
  lunch: "restaurant-outline",
  dinner: "moon-outline",
  snack: "cafe-outline",
};

function MacroBar({ label, current, target, color }: { label: string; current: number; target: number; color: string }) {
  return (
    <View style={styles.macroBarWrap}>
      <View style={styles.macroBarTop}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>{Math.round(current)}<Text style={styles.macroTarget}>/{target}g</Text></Text>
      </View>
      <ProgressBar value={current / target} color={color} trackColor={colors.surface} height={5} />
    </View>
  );
}

function NutritionSection() {
  const [log] = useState<FoodEntry[]>(mockFoodLog);
  const mealTypes: FoodEntry["mealType"][] = ["breakfast", "lunch", "dinner", "snack"];

  const totals = log.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      proteinG: acc.proteinG + e.proteinG,
      carbsG: acc.carbsG + e.carbsG,
      fatG: acc.fatG + e.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );

  const caloriesPct = totals.calories / mockMacroTarget.calories;

  return (
    <ScrollView contentContainerStyle={styles.sectionContent} showsVerticalScrollIndicator={false}>
      {/* Daily summary */}
      <Card style={styles.nutritionSummary} variant="elevated">
        <View style={styles.calorieHeader}>
          <View>
            <Text style={styles.calorieValue}>{Math.round(totals.calories)}</Text>
            <Text style={styles.calorieTarget}>of {mockMacroTarget.calories} kcal</Text>
          </View>
          <View style={styles.calorieRing}>
            <Text style={styles.calorieRingPct}>{Math.round(caloriesPct * 100)}%</Text>
            <Text style={styles.calorieRingLabel}>today</Text>
          </View>
        </View>
        <ProgressBar value={caloriesPct} color={caloriesPct > 1 ? colors.destructive : colors.accent} height={6} />

        <View style={styles.macroRow}>
          <MacroBar label="Protein" current={totals.proteinG} target={mockMacroTarget.proteinG} color="#4ADE80" />
          <MacroBar label="Carbs" current={totals.carbsG} target={mockMacroTarget.carbsG} color="#FBBF24" />
          <MacroBar label="Fat" current={totals.fatG} target={mockMacroTarget.fatG} color="#F87171" />
        </View>
      </Card>

      {/* Meal sections */}
      {mealTypes.map((mealType) => {
        const entries = log.filter((e) => e.mealType === mealType);
        const mealCals = entries.reduce((s, e) => s + e.calories, 0);

        return (
          <View key={mealType} style={styles.mealSection}>
            <View style={styles.mealHeader}>
              <View style={styles.mealHeaderLeft}>
                <View style={styles.mealIconWrap}>
                  <Ionicons name={MEAL_ICONS[mealType]} size={15} color={colors.accent} />
                </View>
                <Text style={styles.mealTitle}>{MEAL_LABELS[mealType]}</Text>
                {mealCals > 0 && <Text style={styles.mealCals}>{mealCals} kcal</Text>}
              </View>
              <TouchableOpacity style={styles.addFoodBtn}>
                <Ionicons name="add" size={16} color={colors.accent} />
                <Text style={styles.addFoodLabel}>Add food</Text>
              </TouchableOpacity>
            </View>

            {entries.length === 0 ? (
              <View style={styles.emptyMeal}>
                <Text style={styles.emptyMealText}>Nothing logged yet</Text>
              </View>
            ) : (
              entries.map((entry) => (
                <View key={entry.id} style={styles.foodEntry}>
                  <View style={styles.foodEntryLeft}>
                    <Text style={styles.foodName}>{entry.name}</Text>
                    <Text style={styles.foodMeta}>
                      {entry.quantity} {entry.unit} · P: {entry.proteinG}g · C: {entry.carbsG}g · F: {entry.fatG}g
                    </Text>
                  </View>
                  <Text style={styles.foodCals}>{entry.calories} kcal</Text>
                </View>
              ))
            )}
          </View>
        );
      })}

      {/* Scan placeholder */}
      <TouchableOpacity style={styles.scanBtn} activeOpacity={0.8}>
        <Ionicons name="scan-outline" size={20} color={colors.accent} />
        <Text style={styles.scanBtnLabel}>Scan barcode</Text>
        <View style={styles.comingSoonTag}>
          <Text style={styles.comingSoonTagLabel}>Phase 2</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Main Tracker Screen ────────────────────────────────────────────────────

export default function TrackerScreen() {
  const [section, setSection] = useState<"habits" | "nutrition">("habits");
  const router = useRouter();
  const { habits, getTodayProgress } = useHabits();
  const activeCount = habits.filter((h) => h.state === "active").length;
  const { completed, total } = getTodayProgress();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Tracker</Text>
          <Text style={styles.pageSub}>
            {section === "habits" ? `${completed}/${total} habits today` : "Daily nutrition log"}
          </Text>
        </View>
        {section === "habits" && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push("/(tabs)/elysia")}
          >
            <Ionicons name="add" size={20} color={colors.accent} />
          </TouchableOpacity>
        )}
      </View>

      {/* Sub-navigation */}
      <View style={styles.subNav}>
        <TabSwitcher
          options={[
            { id: "habits", label: "Habits", icon: "checkmark-done-outline" },
            { id: "nutrition", label: "Nutrition", icon: "nutrition-outline" },
          ]}
          active={section}
          onChange={(id) => setSection(id as "habits" | "nutrition")}
          variant="pills"
        />
      </View>

      {section === "habits" ? <HabitsSection /> : <NutritionSection />}
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  pageHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.sm },
  pageTitle: { fontSize: 26, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.5 },
  pageSub: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  addBtn: { width: 36, height: 36, borderRadius: radii.md, backgroundColor: colors.accentMuted, borderWidth: 1, borderColor: colors.accent + "40", alignItems: "center", justifyContent: "center" },
  subNav: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  sectionContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 },
  // Progress card
  progressCard: { gap: spacing.md },
  progressTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  progressTitle: { fontSize: 16, fontWeight: "700", color: colors.accent },
  progressSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  progressCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.accent, alignItems: "center", justifyContent: "center" },
  progressPct: { fontSize: 14, fontWeight: "800", color: colors.accent },
  allDone: { fontSize: 13, color: colors.success, fontWeight: "600", textAlign: "center" },
  // Filter tabs (underline)
  habitList: { gap: spacing.md },
  // Habit card
  habitCard: { backgroundColor: colors.card, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  habitCardInner: { flexDirection: "row", alignItems: "flex-start", padding: spacing.lg, gap: spacing.md },
  checkArea: { paddingTop: 3, width: 28, alignItems: "center" },
  checkbox: { width: 24, height: 24, borderRadius: radii.sm, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  stateDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  habitBody: { flex: 1, gap: 6 },
  habitTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  habitTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.textPrimary, letterSpacing: -0.1 },
  habitMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  habitSchedule: { fontSize: 11, color: colors.textTertiary },
  plannedNote: { fontSize: 12, color: colors.warning, fontWeight: "500" },
  menuBtn: { padding: 4 },
  // Inline menu modal
  menuOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
  menuSheet: { backgroundColor: colors.card, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, paddingBottom: 40, gap: 2 },
  menuTitle: { fontSize: 13, fontWeight: "600", color: colors.textTertiary, marginBottom: spacing.md, textAlign: "center" },
  menuItem: { paddingVertical: spacing.md, borderRadius: radii.md },
  menuItemLabel: { fontSize: 16, fontWeight: "600", color: colors.textPrimary, textAlign: "center" },
  // Nutrition
  nutritionSummary: { gap: spacing.md },
  calorieHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  calorieValue: { fontSize: 36, fontWeight: "800", color: colors.textPrimary, letterSpacing: -1 },
  calorieTarget: { fontSize: 13, color: colors.textTertiary, marginTop: 2 },
  calorieRing: { width: 58, height: 58, borderRadius: 29, borderWidth: 2.5, borderColor: colors.accent, alignItems: "center", justifyContent: "center" },
  calorieRingPct: { fontSize: 15, fontWeight: "800", color: colors.accent },
  calorieRingLabel: { fontSize: 9, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.4 },
  macroRow: { flexDirection: "row", gap: spacing.md },
  macroBarWrap: { flex: 1, gap: 4 },
  macroBarTop: { flexDirection: "row", justifyContent: "space-between" },
  macroLabel: { fontSize: 11, fontWeight: "700", color: colors.textTertiary, textTransform: "uppercase" },
  macroValue: { fontSize: 12, fontWeight: "700", color: colors.textPrimary },
  macroTarget: { fontWeight: "400", color: colors.textTertiary },
  mealSection: { gap: spacing.sm },
  mealHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mealHeaderLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  mealIconWrap: { width: 28, height: 28, borderRadius: radii.sm, backgroundColor: colors.accentMuted, alignItems: "center", justifyContent: "center" },
  mealTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  mealCals: { fontSize: 12, color: colors.textTertiary },
  addFoodBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.accentMuted, borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 5 },
  addFoodLabel: { fontSize: 12, fontWeight: "700", color: colors.accent },
  emptyMeal: { padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  emptyMealText: { fontSize: 13, color: colors.textTertiary },
  foodEntry: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, paddingHorizontal: spacing.lg },
  foodEntryLeft: { flex: 1, gap: 2 },
  foodName: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  foodMeta: { fontSize: 12, color: colors.textTertiary },
  foodCals: { fontSize: 14, fontWeight: "700", color: colors.textSecondary },
  scanBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", borderRadius: radii.lg, paddingVertical: spacing.lg },
  scanBtnLabel: { fontSize: 15, fontWeight: "600", color: colors.accent },
  comingSoonTag: { backgroundColor: colors.surface, borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 3 },
  comingSoonTagLabel: { fontSize: 10, fontWeight: "700", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.5 },
});
