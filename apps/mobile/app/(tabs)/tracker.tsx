import React, { useState, useCallback, useEffect } from "react";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Alert,
  TextInput,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { UserHabit, HabitState } from "@elysia/domain";
import { colors, spacing, radii, categoryColors } from "@/theme";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TabSwitcher } from "@/components/ui/TabSwitcher";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StreakBadge } from "@/components/ui/StreakBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useHabits } from "@/context/HabitsContext";
import {
  useNutrition,
  type NutritionGoal,
  type GoalType,
  type ActivityLevel,
  type DietaryApproach,
  type MealType,
  type FoodEntry,
  ACTIVITY_LABELS,
  DIETARY_LABELS,
  calculateTargets,
} from "@/context/NutritionContext";
import { useAppContext } from "@/context/AppContext";

// ─── Habit state filter ───────────────────────────────────────────────────────
type HabitFilter = "active" | "planned" | "abandoned";

// ─── Custom habit modal ───────────────────────────────────────────────────────

const HABIT_CATEGORIES = [
  "sleep", "training", "nutrition", "meditation",
  "mobility", "cold_exposure", "supplementation", "productivity", "stress", "recovery",
];

function CreateHabitModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (title: string, category: string, state: "active" | "planned") => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("training");
  const [state, setState] = useState<"active" | "planned">("active");

  const reset = () => { setTitle(""); setCategory("training"); setState("active"); };

  const handleSave = () => {
    if (!title.trim()) return;
    onSave(title.trim(), category, state);
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.popupOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.popupSheet}>
          <View style={styles.dragHandle} />
          <Text style={styles.popupTitle}>Create custom habit</Text>

          <Text style={styles.fieldLabel}>Habit name</Text>
          <TextInput
            style={styles.textInput}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Evening walk, Cold shower..."
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.accent}
            autoFocus
          />

          <Text style={styles.fieldLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
            <View style={styles.catRow}>
              {HABIT_CATEGORIES.map((cat) => {
                const isSelected = cat === category;
                const color = categoryColors[cat] ?? colors.accent;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={[styles.catChip, isSelected && { backgroundColor: color, borderColor: color }]}
                  >
                    <Text style={[styles.catChipLabel, { color: isSelected ? "#0C0F1A" : color }]}>
                      {cat.replace(/_/g, " ")}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <Text style={styles.fieldLabel}>Add to</Text>
          <View style={styles.stateRow}>
            {(["active", "planned"] as const).map((st) => (
              <TouchableOpacity
                key={st}
                onPress={() => setState(st)}
                style={[styles.stateChip, state === st && styles.stateChipActive]}
              >
                <Ionicons
                  name={st === "active" ? "flash" : "time-outline"}
                  size={15}
                  color={state === st ? colors.accent : colors.textTertiary}
                />
                <Text style={[styles.stateChipTitle, state === st && { color: colors.accent }]}>
                  {st === "active" ? "Active" : "Planned"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <PrimaryButton
            label="Save habit"
            onPress={handleSave}
            variant={title.trim() ? "primary" : "disabled"}
            size="lg"
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Habit card ────────────────────────────────────────────────────────────────

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
    ...(habit.state !== "active"   ? [{ label: "Move to Active",    state: "active"    as HabitState }] : []),
    ...(habit.state !== "planned"  ? [{ label: "Save as Planned",   state: "planned"   as HabitState }] : []),
    ...(habit.state !== "abandoned"? [{ label: "Mark as Abandoned", state: "abandoned" as HabitState }] : []),
    { label: "Remove permanently", danger: true },
  ];

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <View style={[styles.habitCard, completed && styles.habitCardDone]}>
        <View style={styles.habitCardInner}>
          {habit.state === "active" ? (
            <TouchableOpacity onPress={handleCheck} activeOpacity={0.8} style={styles.checkArea}>
              <View style={[styles.checkbox, completed && styles.checkboxDone]}>
                {completed && <Ionicons name="checkmark" size={14} color="#0C0F1A" />}
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.checkArea}>
              <View style={[styles.stateDot, habit.state === "planned" ? styles.dotPlanned : styles.dotAbandoned]} />
            </View>
          )}

          <View style={styles.habitBody}>
            <View style={styles.habitTop}>
              <Text
                style={[
                  styles.habitTitle,
                  completed && styles.habitTitleDone,
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

            {habit.state === "planned" && habit.schedule.startsOn && (
              <Text style={styles.plannedNote}>
                Starting {new Date(habit.schedule.startsOn).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </Text>
            )}
          </View>

          <TouchableOpacity onPress={() => setMenuOpen(true)} style={styles.menuBtn}>
            <Ionicons name="ellipsis-vertical" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
          <TouchableOpacity style={styles.menuOverlay} onPress={() => setMenuOpen(false)} activeOpacity={1}>
            <View style={styles.menuSheet}>
              <Text style={styles.menuTitle} numberOfLines={1}>{habit.title}</Text>
              {stateActions.map((action) => (
                <TouchableOpacity
                  key={action.label}
                  onPress={() => {
                    setMenuOpen(false);
                    if (action.danger) {
                      Alert.alert("Remove habit", "Permanently remove this habit?", [
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

// ─── Habits section ────────────────────────────────────────────────────────────

function HabitsSection() {
  const router = useRouter();
  const { habits, completedTodayIds, completeToday, updateHabitState, getTodayProgress, addCustomHabit } = useHabits();
  const [filter, setFilter] = useState<HabitFilter>("active");
  const [createModalVisible, setCreateModalVisible] = useState(false);

  const visible = habits.filter((h) => {
    if (filter === "abandoned") return h.state === "abandoned" || h.state === "paused";
    return h.state === filter;
  });

  const { completed, total } = getTodayProgress();
  const completionRate = total > 0 ? completed / total : 0;

  const filterOpts = [
    { id: "active",    label: "Active",    icon: "flash-outline"   as const, count: habits.filter((h) => h.state === "active").length },
    { id: "planned",   label: "Planned",   icon: "time-outline"    as const, count: habits.filter((h) => h.state === "planned").length },
    { id: "abandoned", label: "Abandoned", icon: "archive-outline" as const, count: habits.filter((h) => h.state === "abandoned" || h.state === "paused").length },
  ];

  return (
    <ScrollView contentContainerStyle={styles.sectionContent} showsVerticalScrollIndicator={false}>
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
            <Text style={styles.allDone}>All habits completed today 🎉</Text>
          )}
        </Card>
      )}

      <TabSwitcher options={filterOpts} active={filter} onChange={(id) => setFilter(id as HabitFilter)} variant="underline" />

      <View style={styles.habitList}>
        {visible.length === 0 ? (
          <EmptyState
            icon={filter === "active" ? "flash-outline" : filter === "planned" ? "time-outline" : "archive-outline"}
            title={filter === "active" ? "No active habits" : filter === "planned" ? "Nothing planned" : "Nothing abandoned"}
            description={
              filter === "active"
                ? "Browse the Elysia library to add evidence-based habits, or create your own."
                : filter === "planned"
                ? "Save habits for later when browsing the Elysia library."
                : "Habits you've tried and paused will appear here."
            }
            action={filter === "active" ? { label: "Browse Elysia Library", onPress: () => router.push("/(tabs)/elysia") } : undefined}
          />
        ) : (
          visible.map((habit) => (
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

        {/* Add custom habit button */}
        <TouchableOpacity
          style={styles.addHabitBtn}
          onPress={() => setCreateModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
          <Text style={styles.addHabitBtnLabel}>Create custom habit</Text>
        </TouchableOpacity>
      </View>

      <CreateHabitModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSave={(title, cat, state) => {
          addCustomHabit(title, cat, state);
        }}
      />
    </ScrollView>
  );
}

// ─── Nutrition: Goal Setup ─────────────────────────────────────────────────────

const GOAL_OPTIONS: { type: GoalType; label: string; sub: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: "lose_weight", label: "Lose weight",    sub: "Create a calorie deficit",     icon: "trending-down-outline" },
  { type: "maintain",    label: "Maintain",        sub: "Stay at current weight",       icon: "remove-outline" },
  { type: "gain_muscle", label: "Build muscle",   sub: "Lean calorie surplus",          icon: "trending-up-outline" },
];

const RATE_OPTIONS = [0.25, 0.5, 0.75, 1.0];
const ACTIVITY_LEVELS: ActivityLevel[] = ["sedentary", "light", "moderate", "active", "very_active"];
const DIETARY_OPTIONS: DietaryApproach[] = ["balanced", "high_protein", "low_carb", "mediterranean", "keto"];

function NutritionGoalSetup({ onComplete }: { onComplete: (g: NutritionGoal) => void }) {
  const [step, setStep] = useState(0);
  const [goalType, setGoalType] = useState<GoalType>("lose_weight");
  const [rate, setRate] = useState(0.5);
  const [activity, setActivity] = useState<ActivityLevel>("moderate");
  const [approach, setApproach] = useState<DietaryApproach>("balanced");

  const handleFinish = () => {
    onComplete({
      type: goalType,
      weeklyChangeKg: goalType === "maintain" ? 0 : rate,
      activityLevel: activity,
      dietaryApproach: approach,
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.goalSetupContent} showsVerticalScrollIndicator={false}>
      <View style={styles.goalSetupHeader}>
        <View style={styles.goalSetupIconWrap}>
          <Ionicons name="nutrition-outline" size={28} color="#0C0F1A" />
        </View>
        <Text style={styles.goalSetupTitle}>Set nutrition goal</Text>
        <Text style={styles.goalSetupSub}>
          We'll calculate your daily calorie target and macros using the Mifflin-St Jeor equation,
          adapted to your goal and activity level.
        </Text>
      </View>

      {/* Step 0: Goal type */}
      <View style={styles.goalStep}>
        <Text style={styles.goalStepLabel}>1. What is your goal?</Text>
        {GOAL_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.type}
            onPress={() => setGoalType(opt.type)}
            activeOpacity={0.8}
            style={[styles.goalOption, goalType === opt.type && styles.goalOptionActive]}
          >
            <View style={[styles.goalOptionIcon, goalType === opt.type && { backgroundColor: colors.accent + "25" }]}>
              <Ionicons name={opt.icon} size={18} color={goalType === opt.type ? colors.accent : colors.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.goalOptionLabel, goalType === opt.type && { color: colors.accent }]}>{opt.label}</Text>
              <Text style={styles.goalOptionSub}>{opt.sub}</Text>
            </View>
            {goalType === opt.type && <Ionicons name="checkmark-circle" size={18} color={colors.accent} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Step 1: Rate (only for non-maintain) */}
      {goalType !== "maintain" && (
        <View style={styles.goalStep}>
          <Text style={styles.goalStepLabel}>
            2. How fast? (kg/week)
          </Text>
          <Text style={styles.goalStepHint}>
            0.5 kg/week is sustainable. Above 1.0 risks muscle loss.
          </Text>
          <View style={styles.rateRow}>
            {RATE_OPTIONS.map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => setRate(r)}
                style={[styles.rateChip, rate === r && styles.rateChipActive]}
              >
                <Text style={[styles.rateChipLabel, rate === r && { color: colors.accent }]}>
                  {r} kg
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Step 2: Activity level */}
      <View style={styles.goalStep}>
        <Text style={styles.goalStepLabel}>3. Activity level</Text>
        {ACTIVITY_LEVELS.map((lvl) => (
          <TouchableOpacity
            key={lvl}
            onPress={() => setActivity(lvl)}
            style={[styles.activityOption, activity === lvl && styles.activityOptionActive]}
          >
            <Text style={[styles.activityOptionLabel, activity === lvl && { color: colors.accent }]}>
              {ACTIVITY_LABELS[lvl]}
            </Text>
            {activity === lvl && <Ionicons name="checkmark-circle" size={16} color={colors.accent} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Step 3: Dietary approach */}
      <View style={styles.goalStep}>
        <Text style={styles.goalStepLabel}>4. Dietary approach</Text>
        {DIETARY_OPTIONS.map((d) => (
          <TouchableOpacity
            key={d}
            onPress={() => setApproach(d)}
            style={[styles.activityOption, approach === d && styles.activityOptionActive]}
          >
            <Text style={[styles.activityOptionLabel, approach === d && { color: colors.accent }]}>
              {DIETARY_LABELS[d]}
            </Text>
            {approach === d && <Ionicons name="checkmark-circle" size={16} color={colors.accent} />}
          </TouchableOpacity>
        ))}
      </View>

      <PrimaryButton label="Calculate my targets" onPress={handleFinish} size="lg" />
    </ScrollView>
  );
}

// ─── Nutrition: Food Search ────────────────────────────────────────────────────

interface OFProduct {
  product_name: string;
  code: string;
  brands?: string;
  nutriments: {
    "energy-kcal_100g"?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
  };
}

interface Per100 {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

function calcForQty(per100: Per100, qty: number) {
  const f = qty / 100;
  return {
    calories: Math.round(per100.calories * f),
    proteinG: Math.round(per100.proteinG * f * 10) / 10,
    carbsG: Math.round(per100.carbsG * f * 10) / 10,
    fatG: Math.round(per100.fatG * f * 10) / 10,
  };
}

function FoodSearchModal({
  visible,
  mealType,
  onClose,
  onAdd,
}: {
  visible: boolean;
  mealType: MealType;
  onClose: () => void;
  onAdd: (entry: Omit<FoodEntry, "id" | "loggedAt">) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OFProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selected, setSelected] = useState<OFProduct | null>(null);
  const [quantity, setQuantity] = useState("100");

  const per100: Per100 = selected
    ? {
        calories: selected.nutriments["energy-kcal_100g"] ?? 0,
        proteinG: selected.nutriments["proteins_100g"] ?? 0,
        carbsG: selected.nutriments["carbohydrates_100g"] ?? 0,
        fatG: selected.nutriments["fat_100g"] ?? 0,
      }
    : { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };

  const qty = Math.max(1, parseInt(quantity, 10) || 100);
  const preview = calcForQty(per100, qty);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&json=1&action=process&page_size=20&fields=code,product_name,brands,nutriments`
      );
      const data = await res.json();
      setResults(data.products ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleConfirmAdd = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await onAdd({
        name: selected.product_name || "Unknown",
        brand: selected.brands,
        mealType,
        ...preview,
        quantity: qty,
        unit: "g",
        barcode: selected.code,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.searchModal}>
        {/* ── Header ─────────────────────────────────────── */}
        <View style={styles.searchHeader}>
          <TouchableOpacity
            onPress={selected ? () => setSelected(null) : onClose}
            style={styles.closeBtn}
          >
            <Ionicons
              name={selected ? "arrow-back" : "close"}
              size={20}
              color={colors.textPrimary}
            />
          </TouchableOpacity>
          <Text style={styles.searchHeaderTitle}>
            {selected ? "Set serving size" : "Add food"}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {selected ? (
          /* ── Quantity confirmation step ─────────────────── */
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView contentContainerStyle={styles.qtyContent}>
              {/* Product info */}
              <View style={styles.qtyProductCard}>
                <Text style={styles.qtyProductName}>{selected.product_name || "Unknown"}</Text>
                {selected.brands ? (
                  <Text style={styles.qtyProductBrand}>{selected.brands}</Text>
                ) : null}
              </View>

              {/* Quantity input */}
              <View style={styles.qtyRow}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => setQuantity((v) => String(Math.max(1, (parseInt(v, 10) || 100) - 10)))}
                >
                  <Ionicons name="remove" size={20} color={colors.accent} />
                </TouchableOpacity>
                <View style={styles.qtyInputWrap}>
                  <TextInput
                    style={styles.qtyInput}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="numeric"
                    selectTextOnFocus
                  />
                  <Text style={styles.qtyUnit}>g</Text>
                </View>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => setQuantity((v) => String((parseInt(v, 10) || 100) + 10))}
                >
                  <Ionicons name="add" size={20} color={colors.accent} />
                </TouchableOpacity>
              </View>

              {/* Macro preview */}
              <View style={styles.qtyMacros}>
                <View style={styles.qtyMacroItem}>
                  <Text style={styles.qtyMacroValue}>{preview.calories}</Text>
                  <Text style={styles.qtyMacroLabel}>kcal</Text>
                </View>
                <View style={styles.qtyMacroDivider} />
                <View style={styles.qtyMacroItem}>
                  <Text style={styles.qtyMacroValue}>{preview.proteinG}g</Text>
                  <Text style={styles.qtyMacroLabel}>Protein</Text>
                </View>
                <View style={styles.qtyMacroDivider} />
                <View style={styles.qtyMacroItem}>
                  <Text style={styles.qtyMacroValue}>{preview.carbsG}g</Text>
                  <Text style={styles.qtyMacroLabel}>Carbs</Text>
                </View>
                <View style={styles.qtyMacroDivider} />
                <View style={styles.qtyMacroItem}>
                  <Text style={styles.qtyMacroValue}>{preview.fatG}g</Text>
                  <Text style={styles.qtyMacroLabel}>Fat</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.addConfirmBtn, saving && { opacity: 0.6 }]}
                onPress={handleConfirmAdd}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#0C0F1A" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#0C0F1A" />
                    <Text style={styles.addConfirmBtnText}>Add to {MEAL_LABELS[mealType]}</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        ) : (
          /* ── Search step ─────────────────────────────────── */
          <>
            <View style={styles.searchInputRow}>
              <View style={styles.searchInputWrap}>
                <Ionicons name="search-outline" size={16} color={colors.textTertiary} style={{ marginLeft: 12 }} />
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search foods..."
                  placeholderTextColor={colors.textTertiary}
                  selectionColor={colors.accent}
                  returnKeyType="search"
                  onSubmitEditing={() => search(query)}
                  autoFocus
                />
              </View>
              <TouchableOpacity
                style={styles.scanBtn}
                onPress={() => setScannerOpen(true)}
              >
                <Ionicons name="scan-outline" size={20} color={colors.accent} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.loadingText}>Searching OpenFoodFacts…</Text>
              </View>
            ) : (
              <FlatList
                data={results}
                keyExtractor={(_, i) => `${i}`}
                contentContainerStyle={styles.searchResults}
                renderItem={({ item }) => {
                  const kcal = item.nutriments["energy-kcal_100g"] ?? 0;
                  const prot = item.nutriments["proteins_100g"] ?? 0;
                  return (
                    <TouchableOpacity
                      style={styles.searchResult}
                      onPress={() => { setSelected(item); setQuantity("100"); }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.searchResultLeft}>
                        <Text style={styles.searchResultName} numberOfLines={2}>
                          {item.product_name || "Unknown"}
                        </Text>
                        <Text style={styles.searchResultMeta}>
                          {Math.round(kcal)} kcal · {Math.round(prot)}g protein{" "}
                          <Text style={styles.searchResultPer}>per 100g</Text>
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.noResults}>
                    <Text style={styles.noResultsText}>
                      {query.trim()
                        ? "No results. Try a different search."
                        : "Search for a food or scan a barcode."}
                    </Text>
                  </View>
                }
              />
            )}

            {/* Barcode scanner overlay */}
            {scannerOpen && (
              <BarcodeScannerOverlay
                onClose={() => setScannerOpen(false)}
                onScanned={async (code) => {
                  setScannerOpen(false);
                  setLoading(true);
                  try {
                    const res = await fetch(
                      `https://world.openfoodfacts.org/api/v0/product/${code}.json?fields=product_name,brands,nutriments,code`
                    );
                    const data = await res.json();
                    if (data.product?.product_name) {
                      setSelected(data.product);
                      setQuantity("100");
                    } else {
                      Alert.alert("Not found", "Product not found in OpenFoodFacts database.");
                    }
                  } catch {
                    Alert.alert("Error", "Could not fetch product details.");
                  } finally {
                    setLoading(false);
                  }
                }}
              />
            )}
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// Barcode scanner — uses expo-camera
function BarcodeScannerOverlay({ onClose, onScanned }: { onClose: () => void; onScanned: (code: string) => void }) {
  const [scanned, setScanned] = useState(false);

  let CameraView: any = null;
  let useCameraPermissions: any = null;
  try {
    const cam = require("expo-camera");
    CameraView = cam.CameraView;
    useCameraPermissions = cam.useCameraPermissions;
  } catch {
    return (
      <View style={styles.scanOverlay}>
        <Text style={styles.scanOverlayText}>expo-camera not available</Text>
        <TouchableOpacity onPress={onClose}><Text style={{ color: colors.accent }}>Close</Text></TouchableOpacity>
      </View>
    );
  }

  function ScannerView() {
    const [permission, requestPermission] = useCameraPermissions();

    if (!permission) return <ActivityIndicator color={colors.accent} />;
    if (!permission.granted) {
      return (
        <View style={styles.scanPermission}>
          <Text style={styles.scanPermissionText}>Camera access needed to scan barcodes.</Text>
          <PrimaryButton label="Allow camera" onPress={requestPermission} size="sm" />
        </View>
      );
    }

    return (
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"] }}
        onBarcodeScanned={scanned ? undefined : ({ data }: { data: string }) => {
          setScanned(true);
          onScanned(data);
        }}
      />
    );
  }

  return (
    <View style={[StyleSheet.absoluteFillObject, styles.scanOverlay]}>
      <ScannerView />
      <View style={styles.scanFrame} />
      <TouchableOpacity style={styles.scanCloseBtn} onPress={onClose}>
        <Ionicons name="close" size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.scanHint}>Point at a barcode to scan</Text>
    </View>
  );
}

// ─── Nutrition tracker section ─────────────────────────────────────────────────

const MEAL_LABELS: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" };
const MEAL_ICONS: Record<MealType, keyof typeof Ionicons.glyphMap> = { breakfast: "sunny-outline", lunch: "restaurant-outline", dinner: "moon-outline", snack: "cafe-outline" };
const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

function MacroBar({ label, current, target, color }: { label: string; current: number; target: number; color: string }) {
  return (
    <View style={styles.macroBarWrap}>
      <View style={styles.macroBarTop}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>{Math.round(current)}<Text style={styles.macroTarget}>/{target}g</Text></Text>
      </View>
      <ProgressBar value={target > 0 ? current / target : 0} color={color} height={5} />
    </View>
  );
}

function NutritionSection() {
  const { isGoalSet, macroTargets, tdee, foodLog, setGoal, addFoodEntry, removeFoodEntry, getDayTotals, clearGoal } = useNutrition();
  const { onboardingData } = useAppContext();
  const [addingMeal, setAddingMeal] = useState<MealType | null>(null);

  const totals = getDayTotals();
  const targets = macroTargets;

  if (!isGoalSet || !targets) {
    const weight = onboardingData?.weightKg ?? 75;
    const height = onboardingData?.heightCm ?? 175;
    const dob = onboardingData?.dateOfBirth;
    const ageYears = dob
      ? (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
      : 30;

    return (
      <NutritionGoalSetup
        onComplete={(g) => { void setGoal(g, weight, height, ageYears); }}
      />
    );
  }

  const calPct = targets.calories > 0 ? totals.calories / targets.calories : 0;
  // foodLog already contains only today's entries (fetched by logged_date from Supabase)
  const todayEntries = foodLog;

  return (
    <ScrollView contentContainerStyle={styles.sectionContent} showsVerticalScrollIndicator={false}>
      {/* Calorie + macro summary */}
      <Card variant="elevated" style={styles.nutritionSummary}>
        <View style={styles.calRow}>
          <View>
            <Text style={styles.calValue}>{Math.round(totals.calories)}</Text>
            <Text style={styles.calTarget}>of {targets.calories} kcal target</Text>
            {tdee && <Text style={styles.tdeeNote}>TDEE: {tdee} kcal · Deficit: {tdee - targets.calories} kcal</Text>}
          </View>
          <View style={[styles.calRing, { borderColor: calPct > 1 ? colors.destructive : colors.accent }]}>
            <Text style={[styles.calRingPct, { color: calPct > 1 ? colors.destructive : colors.accent }]}>
              {Math.round(calPct * 100)}%
            </Text>
            <Text style={styles.calRingLabel}>today</Text>
          </View>
        </View>
        <ProgressBar
          value={calPct}
          color={calPct > 1 ? colors.destructive : colors.accent}
          height={6}
        />
        <View style={styles.macroRow}>
          <MacroBar label="Protein" current={totals.proteinG} target={targets.proteinG} color="#4ADE80" />
          <MacroBar label="Carbs"   current={totals.carbsG}   target={targets.carbsG}   color="#FBBF24" />
          <MacroBar label="Fat"     current={totals.fatG}     target={targets.fatG}     color="#F87171" />
        </View>
      </Card>

      {/* Meal sections */}
      {MEAL_TYPES.map((meal) => {
        const entries = todayEntries.filter((e) => e.mealType === meal);
        const mealCals = entries.reduce((s, e) => s + e.calories, 0);
        return (
          <View key={meal} style={styles.mealSection}>
            <View style={styles.mealHeader}>
              <View style={styles.mealHeaderLeft}>
                <View style={styles.mealIconWrap}>
                  <Ionicons name={MEAL_ICONS[meal]} size={14} color={colors.accent} />
                </View>
                <Text style={styles.mealTitle}>{MEAL_LABELS[meal]}</Text>
                {mealCals > 0 && <Text style={styles.mealCals}>{mealCals} kcal</Text>}
              </View>
              <TouchableOpacity style={styles.addFoodBtn} onPress={() => setAddingMeal(meal)}>
                <Ionicons name="add" size={15} color={colors.accent} />
                <Text style={styles.addFoodLabel}>Add</Text>
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
                    <Text style={styles.foodName} numberOfLines={1}>{entry.name}</Text>
                    <Text style={styles.foodMeta}>{entry.quantity}{entry.unit} · P:{entry.proteinG}g · C:{entry.carbsG}g · F:{entry.fatG}g</Text>
                  </View>
                  <View style={styles.foodEntryRight}>
                    <Text style={styles.foodCals}>{entry.calories} kcal</Text>
                    <TouchableOpacity onPress={() => { void removeFoodEntry(entry.id); }}>
                      <Ionicons name="trash-outline" size={14} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        );
      })}

      {/* Reset goal */}
      <TouchableOpacity onPress={() => { void clearGoal(); }} style={styles.resetGoalBtn}>
        <Ionicons name="refresh-outline" size={14} color={colors.textTertiary} />
        <Text style={styles.resetGoalLabel}>Reset nutrition goal</Text>
      </TouchableOpacity>

      {addingMeal && (
        <FoodSearchModal
          visible={true}
          mealType={addingMeal}
          onClose={() => setAddingMeal(null)}
          onAdd={addFoodEntry}
        />
      )}
    </ScrollView>
  );
}

// ─── Tracker screen ────────────────────────────────────────────────────────────

export default function TrackerScreen() {
  const [section, setSection] = useState<"habits" | "nutrition">("habits");
  const { habits, getTodayProgress } = useHabits();
  const { completed, total } = getTodayProgress();
  const router = useRouter();

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
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push("/(tabs)/elysia")}>
            <Ionicons name="leaf-outline" size={18} color={colors.accent} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.subNav}>
        <TabSwitcher
          options={[
            { id: "habits",    label: "Habits",    icon: "checkmark-done-outline" },
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  pageHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  pageTitle: { fontSize: 26, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.5 },
  pageSub: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  addBtn: { width: 36, height: 36, borderRadius: radii.md, backgroundColor: colors.accentMuted, borderWidth: 1, borderColor: colors.accent + "40", alignItems: "center", justifyContent: "center" },
  subNav: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  sectionContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 110 },
  // Progress card
  progressCard: { gap: spacing.md },
  progressTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  progressTitle: { fontSize: 16, fontWeight: "700", color: colors.accent },
  progressSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  progressCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.accent, alignItems: "center", justifyContent: "center" },
  progressPct: { fontSize: 14, fontWeight: "800", color: colors.accent },
  allDone: { fontSize: 13, color: colors.success, fontWeight: "600", textAlign: "center" },
  habitList: { gap: spacing.md },
  // Habit card
  habitCard: { backgroundColor: colors.card, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  habitCardDone: { borderLeftWidth: 2.5, borderLeftColor: colors.success },
  habitCardInner: { flexDirection: "row", alignItems: "flex-start", padding: spacing.lg, gap: spacing.md },
  checkArea: { paddingTop: 3, width: 28, alignItems: "center" },
  checkbox: { width: 24, height: 24, borderRadius: radii.sm, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  checkboxDone: { backgroundColor: colors.success, borderColor: colors.success },
  stateDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  dotPlanned: { backgroundColor: colors.warning },
  dotAbandoned: { backgroundColor: colors.textTertiary },
  habitBody: { flex: 1, gap: 6 },
  habitTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  habitTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.textPrimary, letterSpacing: -0.1 },
  habitTitleDone: { textDecorationLine: "line-through", color: colors.textTertiary },
  habitMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  habitSchedule: { fontSize: 11, color: colors.textTertiary },
  plannedNote: { fontSize: 12, color: colors.warning, fontWeight: "500" },
  menuBtn: { padding: 4 },
  menuOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
  menuSheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, paddingBottom: 40, gap: 2 },
  menuTitle: { fontSize: 13, fontWeight: "600", color: colors.textTertiary, marginBottom: spacing.md, textAlign: "center" },
  menuItem: { paddingVertical: spacing.md },
  menuItemLabel: { fontSize: 16, fontWeight: "600", color: colors.textPrimary, textAlign: "center" },
  // Custom habit creation
  popupOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
  popupSheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, paddingBottom: 40, gap: spacing.lg },
  dragHandle: { width: 40, height: 4, backgroundColor: colors.borderStrong, borderRadius: 2, alignSelf: "center", marginBottom: spacing.sm },
  popupTitle: { fontSize: 18, fontWeight: "800", color: colors.textPrimary },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.5 },
  textInput: { backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: 16, color: colors.textPrimary },
  catScroll: { marginHorizontal: -spacing.xl },
  catRow: { flexDirection: "row", paddingHorizontal: spacing.xl, gap: spacing.sm },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  catChipLabel: { fontSize: 13, fontWeight: "600", textTransform: "capitalize" },
  stateRow: { flexDirection: "row", gap: spacing.sm },
  stateChip: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  stateChipActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  stateChipTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  // Add habit button
  addHabitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", paddingVertical: spacing.lg },
  addHabitBtnLabel: { fontSize: 14, fontWeight: "600", color: colors.accent },
  // Goal setup
  goalSetupContent: { padding: spacing.lg, gap: spacing.xl, paddingBottom: 110 },
  goalSetupHeader: { alignItems: "center", gap: spacing.md },
  goalSetupIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  goalSetupTitle: { fontSize: 24, fontWeight: "800", color: colors.textPrimary, textAlign: "center" },
  goalSetupSub: { fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
  goalStep: { gap: spacing.sm },
  goalStepLabel: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  goalStepHint: { fontSize: 12, color: colors.textTertiary },
  goalOption: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  goalOptionActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  goalOptionIcon: { width: 36, height: 36, borderRadius: radii.sm, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  goalOptionLabel: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  goalOptionSub: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  rateRow: { flexDirection: "row", gap: spacing.sm },
  rateChip: { flex: 1, alignItems: "center", paddingVertical: spacing.md, backgroundColor: colors.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  rateChipActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  rateChipLabel: { fontSize: 15, fontWeight: "700", color: colors.textSecondary },
  activityOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md, backgroundColor: colors.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  activityOptionActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  activityOptionLabel: { fontSize: 14, fontWeight: "500", color: colors.textSecondary, flex: 1 },
  // Nutrition section
  nutritionSummary: { gap: spacing.md },
  calRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  calValue: { fontSize: 42, fontWeight: "800", color: colors.textPrimary, letterSpacing: -1.5 },
  calTarget: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  tdeeNote: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  calRing: { width: 58, height: 58, borderRadius: 29, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  calRingPct: { fontSize: 15, fontWeight: "800" },
  calRingLabel: { fontSize: 9, color: colors.textTertiary, textTransform: "uppercase" },
  macroRow: { flexDirection: "row", gap: spacing.md },
  macroBarWrap: { flex: 1, gap: 4 },
  macroBarTop: { flexDirection: "row", justifyContent: "space-between" },
  macroLabel: { fontSize: 10, fontWeight: "700", color: colors.textTertiary, textTransform: "uppercase" },
  macroValue: { fontSize: 11, fontWeight: "700", color: colors.textPrimary },
  macroTarget: { fontWeight: "400", color: colors.textTertiary },
  mealSection: { gap: spacing.sm },
  mealHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mealHeaderLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  mealIconWrap: { width: 26, height: 26, borderRadius: radii.sm, backgroundColor: colors.accentMuted, alignItems: "center", justifyContent: "center" },
  mealTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  mealCals: { fontSize: 11, color: colors.textTertiary },
  addFoodBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.accentMuted, borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 5 },
  addFoodLabel: { fontSize: 12, fontWeight: "700", color: colors.accent },
  emptyMeal: { padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  emptyMealText: { fontSize: 12, color: colors.textTertiary },
  foodEntry: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, paddingHorizontal: spacing.lg },
  foodEntryLeft: { flex: 1, gap: 2 },
  foodName: { fontSize: 13, fontWeight: "600", color: colors.textPrimary },
  foodMeta: { fontSize: 11, color: colors.textTertiary },
  foodEntryRight: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  foodCals: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  resetGoalBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  resetGoalLabel: { fontSize: 12, color: colors.textTertiary },
  // Food search modal
  searchModal: { flex: 1, backgroundColor: colors.background },
  searchHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  searchHeaderTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  searchInputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.lg },
  searchInputWrap: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, padding: spacing.md, fontSize: 15, color: colors.textPrimary },
  scanBtn: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.accentMuted, borderWidth: 1, borderColor: colors.accent + "40", alignItems: "center", justifyContent: "center" },
  searchResults: { padding: spacing.lg, gap: spacing.sm, paddingBottom: 60 },
  searchResult: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  searchResultLeft: { flex: 1, gap: 3 },
  searchResultName: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  searchResultMeta: { fontSize: 12, color: colors.textSecondary },
  searchResultPer: { color: colors.textTertiary },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  loadingText: { fontSize: 13, color: colors.textSecondary },
  noResults: { alignItems: "center", paddingVertical: 40 },
  noResultsText: { fontSize: 14, color: colors.textSecondary },
  // Quantity confirmation step
  qtyContent: { padding: spacing.lg, gap: spacing.xl, paddingBottom: 60 },
  qtyProductCard: { backgroundColor: colors.card, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: 4 },
  qtyProductName: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  qtyProductBrand: { fontSize: 12, color: colors.textTertiary },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, justifyContent: "center" },
  qtyBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentMuted, borderWidth: 1, borderColor: colors.accent + "40", alignItems: "center", justifyContent: "center" },
  qtyInputWrap: { flexDirection: "row", alignItems: "baseline", gap: 4, backgroundColor: colors.card, borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.accent, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, minWidth: 110, justifyContent: "center" },
  qtyInput: { fontSize: 28, fontWeight: "800", color: colors.textPrimary, textAlign: "center", minWidth: 60 },
  qtyUnit: { fontSize: 14, color: colors.textTertiary, fontWeight: "600" },
  qtyMacros: { flexDirection: "row", backgroundColor: colors.card, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, justifyContent: "space-around", alignItems: "center" },
  qtyMacroItem: { alignItems: "center", gap: 4 },
  qtyMacroValue: { fontSize: 18, fontWeight: "800", color: colors.textPrimary },
  qtyMacroLabel: { fontSize: 11, color: colors.textTertiary, fontWeight: "600" },
  qtyMacroDivider: { width: 1, height: 30, backgroundColor: colors.border },
  addConfirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 52, backgroundColor: colors.accent, borderRadius: radii.lg },
  addConfirmBtnText: { fontSize: 16, fontWeight: "700", color: "#0C0F1A" },
  // Barcode scanner
  scanOverlay: { backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  scanOverlayText: { color: "#fff", fontSize: 14 },
  scanPermission: { alignItems: "center", gap: spacing.lg, padding: 40 },
  scanPermissionText: { fontSize: 14, color: colors.textSecondary, textAlign: "center" },
  scanFrame: { position: "absolute", width: 240, height: 180, borderWidth: 2, borderColor: colors.accent, borderRadius: 12 },
  scanCloseBtn: { position: "absolute", top: 50, right: 20, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 20, padding: 8 },
  scanHint: { position: "absolute", bottom: 100, color: "#fff", fontSize: 14, fontWeight: "600" },
});
