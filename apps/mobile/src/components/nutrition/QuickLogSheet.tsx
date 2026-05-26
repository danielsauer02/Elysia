import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetModal as BottomSheetModalType,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radii } from "@/theme";
import { useNutrition } from "@/context/NutritionContext";
import { searchProductsByName, type OffParsedProduct } from "@/lib/openFoodFacts";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
type MealType = (typeof MEAL_TYPES)[number];

type Props = { initialMealType?: MealType };

export const QuickLogSheet = React.forwardRef<BottomSheetModalType, Props>(
  ({ initialMealType = "lunch" }, ref) => {
    const snapPoints = useMemo(() => ["75%", "92%"], []);
    const { recentFoods, suggestionsForMeal, addFoodEntry } = useNutrition();
    const [mealType, setMealType] = useState<MealType>(initialMealType);
    const [searchTerm, setSearchTerm] = useState("");
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<OffParsedProduct[]>([]);

    const suggestions = suggestionsForMeal(mealType);
    const recent = recentFoods.slice(0, 12);

    const search = useCallback(async () => {
      if (!searchTerm.trim()) return;
      setSearching(true);
      try {
        const results = await searchProductsByName(searchTerm.trim(), 10);
        setSearchResults(results);
      } catch (e) {
        Alert.alert("Search failed", (e as Error).message);
      } finally {
        setSearching(false);
      }
    }, [searchTerm]);

    const logItem = useCallback(
      async (item: { name: string; brand?: string; calories: number; proteinG: number; carbsG: number; fatG: number; quantity: number; unit: string }) => {
        try {
          await addFoodEntry({
            name: item.name,
            brand: item.brand,
            mealType,
            calories: item.calories,
            proteinG: item.proteinG,
            carbsG: item.carbsG,
            fatG: item.fatG,
            quantity: item.quantity,
            unit: item.unit,
          });
          if (typeof ref === "object" && ref?.current) ref.current.dismiss();
        } catch (e) {
          Alert.alert("Save failed", (e as Error).message);
        }
      },
      [addFoodEntry, mealType, ref]
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        backdropComponent={(p) => (
          <BottomSheetBackdrop {...p} appearsOnIndex={0} disappearsOnIndex={-1} />
        )}
        backgroundStyle={styles.bg}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetView style={styles.body}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Quick log</Text>
            <TouchableOpacity onPress={() => (typeof ref === "object" && ref?.current?.dismiss())}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.mealTabs}>
            {MEAL_TYPES.map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setMealType(m)}
                style={[styles.mealTab, mealType === m && styles.mealTabActive]}
              >
                <Text style={[styles.mealTabText, mealType === m && styles.mealTabTextActive]}>
                  {m[0]!.toUpperCase() + m.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Search Open Food Facts..."
              placeholderTextColor={colors.textTertiary}
              onSubmitEditing={search}
              returnKeyType="search"
            />
            {searching && <ActivityIndicator color={colors.textPrimary} />}
          </View>

          <ScrollView style={styles.scroller} contentContainerStyle={{ paddingBottom: 24 }}>
            {searchResults.length > 0 && (
              <Section title={`Search results (${searchResults.length})`}>
                {searchResults.map((r, i) => (
                  <Row key={`s-${i}`} item={r} onPress={() => logItem(r)} />
                ))}
              </Section>
            )}
            {suggestions.length > 0 && (
              <Section title={`Frequent for ${mealType}`}>
                {suggestions.map((r, i) => (
                  <Row key={`f-${i}`} item={r} onPress={() => logItem(r)} hint={r.frequency ? `${r.frequency}x` : undefined} />
                ))}
              </Section>
            )}
            {recent.length > 0 && (
              <Section title="Recent">
                {recent.map((r, i) => (
                  <Row key={`r-${i}`} item={r} onPress={() => logItem(r)} />
                ))}
              </Section>
            )}
            {recent.length === 0 && suggestions.length === 0 && searchResults.length === 0 && (
              <Text style={styles.empty}>
                Nothing here yet. Search a food above or use the photo button to start.
              </Text>
            )}
          </ScrollView>
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

QuickLogSheet.displayName = "QuickLogSheet";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({
  item,
  onPress,
  hint,
}: {
  item: { name: string; brand?: string; calories: number; proteinG: number; quantity: number; unit: string };
  onPress: () => void;
  hint?: string;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {item.brand ? `${item.brand} · ` : ""}
          {item.calories} kcal · {item.proteinG}P · {item.quantity}{item.unit}
        </Text>
      </View>
      {hint && <Text style={styles.rowHint}>{hint}</Text>}
      <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bg: { backgroundColor: colors.surface },
  handle: { backgroundColor: colors.textSecondary, width: 40 },
  body: { flex: 1, padding: spacing.md },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  headerTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "700" },
  mealTabs: { flexDirection: "row", gap: 6, marginBottom: 8 },
  mealTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  mealTabActive: { backgroundColor: colors.accent },
  mealTabText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
  mealTabTextActive: { color: "#0B1020" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: spacing.sm,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  scroller: { flex: 1, marginTop: spacing.sm },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  rowName: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  rowSub: { color: colors.textTertiary, fontSize: 12, marginTop: 2 },
  rowHint: { color: colors.textSecondary, fontSize: 12, marginRight: 8 },
  empty: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    marginTop: 24,
  },
});
