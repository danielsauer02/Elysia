import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radii } from "@/theme";
import { useAppContext } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { WheelPicker } from "@/components/ui/WheelPicker";

// ─── Data ──────────────────────────────────────────────────────────────────

const GOALS = [
  "Improve sleep quality",
  "Build exercise habits",
  "Optimize nutrition",
  "Reduce stress",
  "Improve recovery and HRV",
  "Increase energy levels",
  "Manage weight",
  "Longevity and prevention",
  "Mental clarity and focus",
  "Physical performance",
];

const WEARABLES = ["Apple Watch", "Oura Ring", "Whoop", "Garmin", "Fitbit", "None yet"];

const HEIGHT_CM = Array.from({ length: 81 }, (_, i) => i + 140); // 140–220 cm
const WEIGHT_KG = Array.from({ length: 141 }, (_, i) => i + 40); // 40–180 kg

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const YEARS = Array.from({ length: 61 }, (_, i) => 1950 + i); // 1950–2010

const TOTAL_STEPS = 5;
const DEFAULT_HEIGHT_IDX = 35; // 175 cm
const DEFAULT_WEIGHT_IDX = 35; // 75 kg
const DEFAULT_BIRTH_YEAR_IDX = 24; // 1974 (50 y/o)
const DEFAULT_BIRTH_MONTH_IDX = 0; // Jan
const DEFAULT_BIRTH_DAY_IDX = 0; // 1st

// ─── Small Components ──────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.stepDots}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i < current
              ? styles.dotDone
              : i === current
              ? styles.dotActive
              : styles.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

function SelectChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      {selected && (
        <Ionicons name="checkmark" size={12} color="#0C0F1A" style={{ marginRight: 3 }} />
      )}
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeOnboarding } = useAppContext();
  const { session } = useAuth();
  const [saving, setSaving] = useState(false);

  // Guard: redirect to login if not authenticated
  useEffect(() => {
    if (!session) {
      router.replace("/(auth)/login");
    }
  }, [session]);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [birthDay, setBirthDay] = useState(DEFAULT_BIRTH_DAY_IDX);
  const [birthMonth, setBirthMonth] = useState(DEFAULT_BIRTH_MONTH_IDX);
  const [birthYear, setBirthYear] = useState(DEFAULT_BIRTH_YEAR_IDX);
  const [heightIdx, setHeightIdx] = useState(DEFAULT_HEIGHT_IDX);
  const [weightIdx, setWeightIdx] = useState(DEFAULT_WEIGHT_IDX);
  const [goals, setGoals] = useState<string[]>([]);
  const [wearables, setWearables] = useState<string[]>([]);

  // Text input letters for name
  const [nameLetters, setNameLetters] = useState<string[]>([]);

  const toggleGoal = (g: string) =>
    setGoals((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  const toggleWearable = (w: string) =>
    setWearables((prev) => (prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]));

  const currentHeight = HEIGHT_CM[heightIdx] ?? 175;
  const currentWeight = WEIGHT_KG[weightIdx] ?? 75;
  const currentDOB = `${YEARS[birthYear]}-${String((birthMonth ?? 0) + 1).padStart(2, "0")}-${String(DAYS[birthDay]).padStart(2, "0")}`;

  const canProceed = (): boolean => {
    if (step === 0) return name.trim().length >= 2;
    if (step === 3) return goals.length >= 1;
    return true;
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await completeOnboarding({
        name: name.trim(),
        dateOfBirth: currentDOB,
        heightCm: currentHeight,
        weightKg: currentWeight,
        goals,
        wearables,
      });
      router.replace("/(tabs)/dashboard");
    } catch (err) {
      setSaving(false);
      Alert.alert(
        "Could not save profile",
        err instanceof Error ? err.message : "Please check your connection and try again.",
        [{ text: "OK" }]
      );
    }
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      void handleFinish();
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          {step > 0 ? (
            <TouchableOpacity onPress={() => setStep((s) => s - 1)} style={styles.headerBtn}>
              <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerBtn} />
          )}
          <StepDots current={step} total={TOTAL_STEPS} />
          <TouchableOpacity
            onPress={() => {
              void (async () => {
                try {
                  await completeOnboarding({
                    name: "Alex",
                    dateOfBirth: "1990-06-15",
                    heightCm: 178,
                    weightKg: 78,
                    goals: ["Longevity and prevention"],
                    wearables: [],
                  });
                  router.replace("/(tabs)/dashboard");
                } catch {
                  router.replace("/(tabs)/dashboard");
                }
              })();
            }}
            style={styles.headerBtn}
          >
            <Text style={styles.skipLabel}>Skip</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Step 0: Welcome + Name ─────────────────────── */}
          {step === 0 && (
            <View style={styles.stepWrap}>
              <View style={styles.logoArea}>
                <View style={styles.logoIcon}>
                  <Ionicons name="leaf" size={34} color="#0C0F1A" />
                </View>
                <Text style={styles.appName}>Elysia</Text>
                <Text style={styles.appTagline}>Your longevity operating system</Text>
              </View>

              <Text style={styles.stepTitle}>What's your name?</Text>
              <Text style={styles.stepSubtitle}>
                We'll personalise your experience around you.
              </Text>

              {/* Letter-by-letter display — no keyboard, use preset letters for demo */}
              {/* Using a native TextInput with the right dark styling */}
              <View style={styles.nameInputWrap}>
                <Ionicons name="person-outline" size={18} color={colors.textTertiary} style={{ marginLeft: 16 }} />
                <TextInputField
                  value={name}
                  onChange={setName}
                  placeholder="Your first name"
                />
              </View>
            </View>
          )}

          {/* ── Step 1: Date of Birth (3 wheel pickers) ──── */}
          {step === 1 && (
            <View style={styles.stepWrap}>
              <Text style={styles.stepTitle}>When were you born?</Text>
              <Text style={styles.stepSubtitle}>
                We use your age to personalise longevity benchmarks and health-score baselines.
              </Text>
              <View style={styles.datePickerRow}>
                <View style={styles.dateColumn}>
                  <Text style={styles.dateColumnLabel}>Day</Text>
                  <WheelPicker
                    values={DAYS}
                    initialIndex={birthDay}
                    onChange={(idx) => setBirthDay(idx)}
                    width={80}
                  />
                </View>
                <View style={styles.dateColumn}>
                  <Text style={styles.dateColumnLabel}>Month</Text>
                  <WheelPicker
                    values={MONTHS}
                    initialIndex={birthMonth}
                    onChange={(idx) => setBirthMonth(idx)}
                    width={90}
                  />
                </View>
                <View style={styles.dateColumn}>
                  <Text style={styles.dateColumnLabel}>Year</Text>
                  <WheelPicker
                    values={YEARS}
                    initialIndex={birthYear}
                    onChange={(idx) => setBirthYear(idx)}
                    width={90}
                  />
                </View>
              </View>
              <View style={styles.selectedDate}>
                <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
                <Text style={styles.selectedDateText}>Selected: {currentDOB}</Text>
              </View>
            </View>
          )}

          {/* ── Step 2: Height + Weight (wheel pickers) ─── */}
          {step === 2 && (
            <View style={styles.stepWrap}>
              <Text style={styles.stepTitle}>Body metrics</Text>
              <Text style={styles.stepSubtitle}>
                Used to calculate BMI, caloric needs, and personalise your health baselines.
              </Text>

              <View style={styles.metricsRow}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricCardLabel}>Height</Text>
                  <WheelPicker
                    values={HEIGHT_CM}
                    initialIndex={heightIdx}
                    onChange={(idx) => setHeightIdx(idx)}
                    unit="cm"
                    width={130}
                  />
                  <Text style={styles.metricSummary}>{currentHeight} cm</Text>
                </View>

                <View style={styles.metricCard}>
                  <Text style={styles.metricCardLabel}>Weight</Text>
                  <WheelPicker
                    values={WEIGHT_KG}
                    initialIndex={weightIdx}
                    onChange={(idx) => setWeightIdx(idx)}
                    unit="kg"
                    width={130}
                  />
                  <Text style={styles.metricSummary}>{currentWeight} kg</Text>
                </View>
              </View>
            </View>
          )}

          {/* ── Step 3: Goals ─────────────────────────────── */}
          {step === 3 && (
            <View style={styles.stepWrap}>
              <Text style={styles.stepTitle}>What are your goals?</Text>
              <Text style={styles.stepSubtitle}>
                Select everything that matters to you. We'll personalise your library and recommendations.
              </Text>
              <View style={styles.chipGrid}>
                {GOALS.map((g) => (
                  <SelectChip
                    key={g}
                    label={g}
                    selected={goals.includes(g)}
                    onPress={() => toggleGoal(g)}
                  />
                ))}
              </View>
              {goals.length === 0 && (
                <Text style={styles.selectHint}>Select at least one goal to continue.</Text>
              )}
            </View>
          )}

          {/* ── Step 4: Wearables ─────────────────────────── */}
          {step === 4 && (
            <View style={styles.stepWrap}>
              <Text style={styles.stepTitle}>Do you use any wearables?</Text>
              <Text style={styles.stepSubtitle}>
                We'll show you integration options for devices you own. You can connect them from your profile later.
              </Text>
              <View style={styles.chipGrid}>
                {WEARABLES.map((w) => (
                  <SelectChip
                    key={w}
                    label={w}
                    selected={wearables.includes(w)}
                    onPress={() => toggleWearable(w)}
                  />
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer CTA */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={handleNext}
            disabled={!canProceed() || saving}
            activeOpacity={0.85}
            style={[styles.nextBtn, (!canProceed() || saving) && styles.nextBtnDisabled]}
          >
            {saving ? (
              <ActivityIndicator color="#0C0F1A" size="small" />
            ) : (
              <>
                <Text style={[styles.nextBtnLabel, !canProceed() && styles.nextBtnLabelDisabled]}>
                  {step === TOTAL_STEPS - 1 ? "Start my journey" : "Continue"}
                </Text>
                <Ionicons
                  name={step === TOTAL_STEPS - 1 ? "leaf" : "arrow-forward"}
                  size={17}
                  color={!canProceed() ? colors.textTertiary : "#0C0F1A"}
                  style={{ marginLeft: 6 }}
                />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Inline text input (dark styled) ──────────────────────────────────────
import { TextInput } from "react-native";

function TextInputField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <TextInput
      style={styles.textInput}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.textTertiary}
      autoCapitalize="words"
      autoFocus
      selectionColor={colors.accent}
    />
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  skipLabel: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  stepDots: { flexDirection: "row", gap: 6 },
  dot: { height: 4, borderRadius: radii.full },
  dotActive: { width: 24, backgroundColor: colors.accent },
  dotDone: { width: 16, backgroundColor: colors.success },
  dotInactive: { width: 16, backgroundColor: colors.border },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  stepWrap: { gap: spacing.xl },
  logoArea: { alignItems: "center", gap: spacing.sm, marginBottom: spacing.xl },
  logoIcon: {
    width: 72,
    height: 72,
    borderRadius: radii.xl,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.8,
  },
  appTagline: { fontSize: 14, color: colors.textSecondary },
  stepTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  stepSubtitle: { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },
  nameInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  textInput: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md + 2,
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  // Date picker
  datePickerRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  dateColumn: { alignItems: "center", gap: spacing.sm },
  dateColumnLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  selectedDate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
  },
  selectedDateText: { fontSize: 13, color: colors.textTertiary },
  // Body metrics
  metricsRow: {
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "center",
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  metricCardLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  metricSummary: { fontSize: 14, fontWeight: "700", color: colors.accent },
  // Goal/Wearable chips
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipLabel: { fontSize: 14, fontWeight: "500", color: colors.textSecondary },
  chipLabelSelected: { color: "#0C0F1A", fontWeight: "700" },
  selectHint: { fontSize: 13, color: colors.textTertiary, textAlign: "center" },
  // Footer
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: Platform.OS === "ios" ? 40 : spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nextBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  nextBtnDisabled: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  nextBtnLabel: { fontSize: 17, fontWeight: "700", color: "#0C0F1A", letterSpacing: -0.2 },
  nextBtnLabelDisabled: { color: colors.textTertiary },
});
