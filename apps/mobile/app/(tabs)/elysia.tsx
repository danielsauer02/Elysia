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
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import RNAnimated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { ProtocolTemplate } from "@elysia/domain";
import {
  borderTokens,
  brand,
  categoryColors,
  colors,
  radii,
  semantic,
  spacing,
  surface,
  text,
  typography,
} from "@/theme";
import { Badge } from "@/components/ui/Badge";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useAppTopBarHeight } from "@/components/navigation/AppTopBar";
import { useStickyRingsHeader } from "@/components/dashboard/StickyRingsHeader";
import { useElysiaSummaryRingValues } from "@/components/elysia/ElysiaSummaryRings";
import { CategoryChips } from "@/components/elysia/CategoryChips";
import { ProtocolTemplateCard } from "@/components/elysia/ProtocolTemplateCard";
import { useFloatingTabBarScrollPadding } from "@/hooks/useFloatingTabBarScrollPadding";
import { useHabits } from "@/context/HabitsContext";
import { mockTemplates, ALL_CATEGORIES, mockEntitlement } from "@/mocks/data";

const tierRank: Record<"free" | "pro" | "elite", number> = {
  free: 0,
  pro: 1,
  elite: 2,
};
type TimeSlot = "morning" | "midday" | "afternoon" | "evening";
type HabitTargetState = "active" | "planned";

const TIME_SLOTS: TimeSlot[] = ["morning", "midday", "afternoon", "evening"];
const SLOT_EMOJI: Record<TimeSlot, string> = {
  morning: "🌅",
  midday: "☀️",
  afternoon: "🌤",
  evening: "🌙",
};
const AI_PICKS_ORANGE = "#F97316";
const ALL_LABEL = "All";

// ─── Detail Modal ───────────────────────────────────────────────────────────

function TemplateDetailModal({
  template,
  visible,
  onClose,
  isAdded,
  onAdd,
}: {
  template: ProtocolTemplate | null;
  visible: boolean;
  onClose: () => void;
  isAdded: boolean;
  onAdd: (slot: TimeSlot, state: HabitTargetState) => void;
}) {
  const [slot, setSlot] = useState<TimeSlot>("morning");
  const [targetState, setTargetState] = useState<HabitTargetState>("active");
  const [justAdded, setJustAdded] = useState(false);

  if (!template) return null;
  const catColor = categoryColors[template.category] ?? colors.accent;

  const handleAdd = () => {
    onAdd(slot, targetState);
    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
      onClose();
    }, 800);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.modalHeaderLabel}>Protocol</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.modalContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.modalCatRow}>
            <View
              style={[
                styles.modalCatIcon,
                { backgroundColor: catColor + "20" },
              ]}
            >
              <Ionicons name="leaf-outline" size={22} color={catColor} />
            </View>
            <Badge
              label={template.category.replace(/_/g, " ")}
              category={template.category}
            />
          </View>

          <Text style={styles.modalTitle}>{template.title}</Text>
          <Text style={styles.modalSub}>{template.shortExplanation}</Text>

          <View style={styles.videoPlaceholder}>
            <Ionicons
              name="play-circle-outline"
              size={36}
              color={colors.textTertiary}
            />
            <Text style={styles.videoPlaceholderText}>
              Protocol video · Coming soon
            </Text>
          </View>

          <InfoBlock
            icon="sparkles"
            iconColor={colors.success}
            title="Expected benefit"
          >
            <Text style={styles.infoBody}>{template.expectedBenefit}</Text>
          </InfoBlock>

          <InfoBlock
            icon="flask"
            iconColor={colors.accent}
            title="Evidence rationale"
          >
            <Text style={styles.infoBody}>{template.evidenceRationale}</Text>
          </InfoBlock>

          {template.references.length > 0 && (
            <InfoBlock
              icon="document-text-outline"
              iconColor={colors.textSecondary}
              title="References"
            >
              {template.references.map((ref, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => Linking.openURL(ref.url)}
                  style={styles.refRow}
                >
                  <Text style={styles.refTitle}>{ref.title}</Text>
                  <Text style={styles.refMeta}>
                    {ref.publicationYear} ·{" "}
                    {ref.sourceType.replace(/_/g, " ")}
                  </Text>
                </TouchableOpacity>
              ))}
            </InfoBlock>
          )}

          {!isAdded && !justAdded && (
            <>
              <View style={styles.addSection}>
                <Text style={styles.addSectionTitle}>
                  When will you do this?
                </Text>
                <View style={styles.slotGrid}>
                  {TIME_SLOTS.map((s) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setSlot(s)}
                      activeOpacity={0.8}
                      style={[
                        styles.slotChip,
                        slot === s && styles.slotChipActive,
                      ]}
                    >
                      <Text style={styles.slotEmoji}>{SLOT_EMOJI[s]}</Text>
                      <Text
                        style={[
                          styles.slotLabel,
                          slot === s && { color: colors.accent },
                        ]}
                      >
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.addSection}>
                <Text style={styles.addSectionTitle}>
                  Add to which section?
                </Text>
                <View style={styles.stateRow}>
                  {(["active", "planned"] as HabitTargetState[]).map((st) => (
                    <TouchableOpacity
                      key={st}
                      onPress={() => setTargetState(st)}
                      activeOpacity={0.8}
                      style={[
                        styles.stateChip,
                        targetState === st && styles.stateChipActive,
                      ]}
                    >
                      <Ionicons
                        name={st === "active" ? "flash" : "time-outline"}
                        size={15}
                        color={
                          targetState === st
                            ? colors.accent
                            : colors.textTertiary
                        }
                      />
                      <View>
                        <Text
                          style={[
                            styles.stateChipTitle,
                            targetState === st && { color: colors.accent },
                          ]}
                        >
                          {st === "active" ? "Active" : "Planned"}
                        </Text>
                        <Text style={styles.stateChipSub}>
                          {st === "active"
                            ? "Start tracking today"
                            : "Save for later"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}
        </ScrollView>

        <View style={styles.modalFooter}>
          {isAdded || justAdded ? (
            <View style={styles.addedRow}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={colors.success}
              />
              <Text style={styles.addedLabel}>
                {justAdded
                  ? "Added — opening Tracker..."
                  : "Already in your habits"}
              </Text>
            </View>
          ) : (
            <PrimaryButton label="Add to my habits" onPress={handleAdd} size="lg" />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

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

function InfoBlock({
  icon,
  iconColor,
  title,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.infoBlock}>
      <View style={styles.infoBlockHeader}>
        <Ionicons name={icon} size={14} color={iconColor} />
        <Text style={styles.infoBlockTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function ElysiaScreen() {
  const { addHabitFromTemplate, isHabitAddedFromTemplate } = useHabits();
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_LABEL);
  const [activeTemplate, setActiveTemplate] =
    useState<ProtocolTemplate | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [picksVisible, setPicksVisible] = useState(false);

  const topBarHeight = useAppTopBarHeight();
  const tabScrollPad = useFloatingTabBarScrollPadding();
  const { width: windowWidth } = useWindowDimensions();

  // Sticky Whoop-style header reused from the Home tab.
  const ringValues = useElysiaSummaryRingValues();
  const { onScroll, header } = useStickyRingsHeader({
    values: ringValues,
    topOffset: topBarHeight,
    contextLine: ringHelperLine(ringValues),
  });

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
      <RNAnimated.ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: topBarHeight + spacing.xs,
            paddingBottom: tabScrollPad,
          },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        removeClippedSubviews
      >
        {/* Greeting + AI picks */}
        <View style={styles.greetingRow}>
          <View style={styles.greetingBlock}>
            <Text style={styles.dateLabel}>LIBRARY</Text>
            <Text style={styles.greetingText}>
              <Text style={styles.greetingDim}>Protocols </Text>
              <Text style={styles.greetingStrong}>· {mockTemplates.length}</Text>
            </Text>
          </View>
          <AiPicksPill onPress={() => setPicksVisible(true)} />
        </View>

        {/* Sticky Whoop-style trio (Active / Consistency / Planned) */}
        {header}

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
  scrollContent: { gap: spacing.lg },

  // Greeting (mirrors Home tab)
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

  // ─── Detail modal ───────────────────────────────────────────────────────
  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeaderLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  modalContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 },
  modalCatRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  modalCatIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  modalSub: { fontSize: 14, color: colors.textSecondary, lineHeight: 21 },
  videoPlaceholder: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  videoPlaceholderText: { fontSize: 13, color: colors.textTertiary },
  infoBlock: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  infoBlockHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoBlockTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textPrimary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 21 },
  refRow: { gap: 2, paddingVertical: 4 },
  refTitle: { fontSize: 13, color: colors.accent, fontWeight: "500" },
  refMeta: { fontSize: 11, color: colors.textTertiary },
  addSection: { gap: spacing.sm },
  addSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  slotGrid: { flexDirection: "row", gap: spacing.sm },
  slotChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  slotChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  slotEmoji: { fontSize: 18 },
  slotLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "capitalize",
  },
  stateRow: { flexDirection: "row", gap: spacing.sm },
  stateChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stateChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  stateChipTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  stateChipSub: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  modalFooter: {
    padding: spacing.lg,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  addedLabel: { fontSize: 15, fontWeight: "600", color: colors.success },
});

// Quiet exports — keep theme tokens referenced in case lint checks
// for unused imports; these are intentionally part of the design contract.
void brand;
void semantic;
