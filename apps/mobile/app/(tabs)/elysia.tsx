/**
 * Elysia tab — Longevity Library.
 *
 * v2 layout (matches Home tab feel):
 *   1. Greeting block ("LIBRARY · Protocols", AI picks pill on the right)
 *   2. Sticky Whoop-style summary trio (Active / Consistency / Planned)
 *   3. CategoryChips horizontal slicer
 *   4. ProtocolTemplateCard stack (Bevel-style)
 *
 * Detail / AI picks modals are preserved verbatim from the previous
 * implementation so habit-add UX doesn't regress.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import RNAnimated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { ProtocolTemplate } from "@elysia/domain";
import {
  borderTokens,
  brand,
  colors,
  radii,
  semantic,
  spacing,
  surface,
  text,
  typography,
} from "@/theme";
import { useAppTopBarHeight } from "@/components/navigation/AppTopBar";
import { useStickyRingsHeader } from "@/components/dashboard/StickyRingsHeader";
import { useOverscrollBounce } from "@/hooks/useOverscrollBounce";
import { useElysiaSummaryRingValues } from "@/components/elysia/ElysiaSummaryRings";
import { CategoryChips } from "@/components/elysia/CategoryChips";
import { ProtocolTemplateCard } from "@/components/elysia/ProtocolTemplateCard";
import {
  TemplateDetailModal,
  type HabitTargetState,
  type TimeSlot,
} from "@/components/elysia/TemplateDetailModal";
import { useFloatingTabBarScrollPadding } from "@/hooks/useFloatingTabBarScrollPadding";
import { useHabits } from "@/context/HabitsContext";
import { mockTemplates, ALL_CATEGORIES, mockEntitlement } from "@/mocks/data";

const tierRank: Record<"free" | "pro" | "elite", number> = {
  free: 0,
  pro: 1,
  elite: 2,
};

const AI_PICKS_ORANGE = "#F97316";
const ALL_LABEL = "All";

// ─── AI picks ───────────────────────────────────────────────────────────────

function AiPicksPill({ onPress }: { onPress: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.78,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={{ opacity: pulse }}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={styles.aiPicksPill}
      >
        <Ionicons name="sparkles" size={14} color="#FFFFFF" />
        <Text style={styles.aiPicksPillLabel}>AI picks</Text>
        <Ionicons
          name="information-circle-outline"
          size={14}
          color="#FFFFFF"
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function ElysiaScreen() {
  const { addHabitFromTemplate, isHabitAddedFromTemplate } = useHabits();

  // Deep-link entry: e.g. /recovery → "Discover more" pushes
  // /(tabs)/elysia?category=recovery so the user lands inside the right slice.
  // The param is `snake_case` (matches ALL_CATEGORIES); CategoryChips wants
  // the humanised form, so we normalise via the same `_ → space` mapping
  // that drives the local filter.
  const params = useLocalSearchParams<{ category?: string }>();
  const initialCategory = useMemo(() => {
    const raw = params.category;
    if (!raw) return ALL_LABEL;
    const human = raw.replace(/_/g, " ");
    return ALL_CATEGORIES.map((c) => c.replace(/_/g, " ")).includes(human)
      ? human
      : ALL_LABEL;
  }, [params.category]);

  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  // Keep the chip in sync if the tab is already mounted and the user
  // re-enters with a different category param.
  useEffect(() => {
    setSelectedCategory(initialCategory);
  }, [initialCategory]);

  const [activeTemplate, setActiveTemplate] =
    useState<ProtocolTemplate | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [picksVisible, setPicksVisible] = useState(false);

  const topBarHeight = useAppTopBarHeight();
  const tabScrollPad = useFloatingTabBarScrollPadding();
  const { width: windowWidth } = useWindowDimensions();

  // Sticky Whoop-style header reused from the Home tab.
  const ringValues = useElysiaSummaryRingValues();
  const { onScroll, placeholderHeight, overlay: ringsOverlay } =
    useStickyRingsHeader({
      values: ringValues,
      topOffset: topBarHeight,
    });
  const bounceStyle = useOverscrollBounce();

  const humanCategories = useMemo(
    () => ALL_CATEGORIES.map((c) => c.replace(/_/g, " ")),
    []
  );

  /** Deterministic curated picks (free-tier first). */
  const aiPickTemplates = useMemo(
    () =>
      [...mockTemplates]
        .sort((a, b) => a.templateId.localeCompare(b.templateId))
        .filter((t) => t.premiumTierRequired === "free")
        .slice(0, 8),
    []
  );

  const filtered = useMemo(() => {
    if (selectedCategory === ALL_LABEL) return mockTemplates;
    const key = selectedCategory.toLowerCase().replace(/ /g, "_");
    return mockTemplates.filter((t) => t.category === key);
  }, [selectedCategory]);

  const handleAdd = useCallback(
    (slot: TimeSlot, state: HabitTargetState) => {
      if (activeTemplate) addHabitFromTemplate(activeTemplate, slot, state);
    },
    [activeTemplate, addHabitFromTemplate]
  );

  const isLocked = useCallback(
    (t: ProtocolTemplate) =>
      tierRank[mockEntitlement.tier] < tierRank[t.premiumTierRequired],
    []
  );

  const handleTemplatePress = useCallback((t: ProtocolTemplate) => {
    setActiveTemplate(t);
    setModalVisible(true);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <RNAnimated.View style={[styles.flex, bounceStyle] as never}>
      <RNAnimated.ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            // Reserves space for the morphing rings overlay (already
            // includes the AppTopBar height) so the AI-picks pill +
            // category chips land cleanly under the expanded trio.
            paddingTop: placeholderHeight,
            paddingBottom: tabScrollPad,
          },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        overScrollMode="never"
        bounces={false}
        removeClippedSubviews
      >
        {/* AI picks pill — sits flush right, no greeting text above it. */}
        <View style={styles.aiPicksRow}>
          <AiPicksPill onPress={() => setPicksVisible(true)} />
        </View>

        {/* Category slicer */}
        <View style={styles.chipsWrap}>
          <CategoryChips
            categories={humanCategories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
            totalCount={mockTemplates.length}
          />
        </View>

        {/* Protocol stack */}
        <View style={styles.sectionPad}>
          <View style={styles.cardStack}>
            {filtered.map((template) => (
              <ProtocolTemplateCard
                key={template.templateId}
                template={template}
                isLocked={isLocked(template)}
                isAdded={isHabitAddedFromTemplate(template.templateId)}
                onPress={() => handleTemplatePress(template)}
              />
            ))}
            {filtered.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons
                  name="search-outline"
                  size={20}
                  color={text.tertiary}
                />
                <Text style={styles.emptyText}>
                  No protocols in this category yet
                </Text>
              </View>
            )}
          </View>
        </View>
      </RNAnimated.ScrollView>
      </RNAnimated.View>

      {/* Morphing rings overlay — single continuous element that
          shrinks expanded → mini as the user scrolls. Screen-level
          sibling of the ScrollView, layered above the AppTopBar. */}
      {ringsOverlay}

      {/* AI picks sheet */}
      <Modal
        visible={picksVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPicksVisible(false)}
      >
        <SafeAreaView style={styles.picksModalSafe}>
          <View style={styles.picksModalHeader}>
            <TouchableOpacity
              onPress={() => setPicksVisible(false)}
              style={styles.picksClose}
            >
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.picksModalTitle}>AI picks for you</Text>
            <View style={{ width: 36 }} />
          </View>
          <Text style={styles.picksModalSub}>
            Curated free protocols (deterministic). Tap one to jump to its
            category.
          </Text>
          <FlatList
            data={aiPickTemplates}
            keyExtractor={(t) => t.templateId}
            contentContainerStyle={styles.picksList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.pickRow}
                onPress={() => {
                  setSelectedCategory(item.category.replace(/_/g, " "));
                  setPicksVisible(false);
                }}
              >
                <Ionicons
                  name="leaf-outline"
                  size={18}
                  color={AI_PICKS_ORANGE}
                />
                <View style={styles.pickRowText}>
                  <Text style={styles.pickTitle}>{item.title}</Text>
                  <Text style={styles.pickSub} numberOfLines={2}>
                    {item.shortExplanation}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      <TemplateDetailModal
        template={activeTemplate}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        isAdded={
          activeTemplate
            ? isHabitAddedFromTemplate(activeTemplate.templateId)
            : false
        }
        onAdd={handleAdd}
        mode="add"
      />

      {/* keep `windowWidth` referenced (used implicitly by useStickyRingsHeader
          which calls useWindowDimensions internally — kept for future layout
          guards if we want to size the trio differently from full width). */}
      {windowWidth > 0 ? null : null}
    </SafeAreaView>
  );
}

/** Friendly one-liner under the rings — adapts to the current habit state. */
function ringHelperLine(values: ReturnType<typeof useElysiaSummaryRingValues>) {
  const active = values.find((v) => v.id === "active");
  const consistency = values.find((v) => v.id === "consistency");
  const activeCount = Number(active?.centerOverride ?? "0");
  if (activeCount === 0) {
    return "Pick a protocol below to start your habit stack";
  }
  if (consistency?.value == null) {
    return `${activeCount} active habits — log a few days to see consistency`;
  }
  const cPct = Math.round(consistency.value);
  if (cPct >= 80) return `${activeCount} active habits · staying ${cPct}% consistent`;
  if (cPct >= 50) return `${activeCount} active · ${cPct}% consistent this month`;
  return `${activeCount} active · ${cPct}% consistent — keep building the streak`;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scrollContent: { gap: spacing.lg },

  // AI picks pill row (sits flush right under the rings overlay).
  aiPicksRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    flexDirection: "row",
    justifyContent: "flex-end",
  },

  // Chips section
  chipsWrap: {
    marginTop: -spacing.sm,
  },

  // Card section
  sectionPad: { paddingHorizontal: spacing.lg },
  cardStack: { gap: spacing.md },
  emptyState: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    backgroundColor: surface.raised,
    justifyContent: "center",
  },
  emptyText: {
    ...typography.body,
    color: text.secondary,
  },

  // AI picks pill
  aiPicksPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: AI_PICKS_ORANGE,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  aiPicksPillLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },

  // ─── AI picks modal ─────────────────────────────────────────────────────
  picksModalSafe: { flex: 1, backgroundColor: colors.background },
  picksModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  picksClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  picksModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  picksModalSub: {
    fontSize: 13,
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  picksList: { padding: spacing.lg, gap: spacing.sm, paddingBottom: 48 },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  pickRowText: { flex: 1, gap: 4 },
  pickTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  pickSub: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },

});

// Quiet exports — keep theme tokens referenced in case lint checks
// for unused imports; these are intentionally part of the design contract.
void brand;
void semantic;
