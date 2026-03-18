import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  FlatList,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Linking,
  Animated,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { ProtocolTemplate } from "@elysia/domain";
import { colors, spacing, radii, categoryColors } from "@/theme";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CategoryWheelPicker } from "@/components/ui/CategoryWheelPicker";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useHabits } from "@/context/HabitsContext";
import { mockTemplates, ALL_CATEGORIES, mockEntitlement } from "@/mocks/data";

const tierRank: Record<"free" | "pro" | "elite", number> = { free: 0, pro: 1, elite: 2 };
type TimeSlot = "morning" | "midday" | "afternoon" | "evening";
type HabitTargetState = "active" | "planned";
const SLOT_EMOJI: Record<TimeSlot, string> = { morning: "🌅", midday: "☀️", afternoon: "🌤", evening: "🌙" };
const TIME_SLOTS: TimeSlot[] = ["morning", "midday", "afternoon", "evening"];

// ─── Pulsating AI Recommend Button ──────────────────────────────────────────

function AIRecommendButton({
  onPress,
  active,
}: {
  onPress: () => void;
  active: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.07, duration: 1100, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 1, duration: 1100, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 1100, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.7, duration: 1100, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <Animated.View
        style={[
          styles.aiBtn,
          active && styles.aiBtnActive,
          { transform: [{ scale }], opacity: glow },
        ]}
      >
        <Text style={styles.aiBtnStars}>✦</Text>
        <Ionicons name="sparkles" size={13} color={active ? "#0C0F1A" : colors.accent} />
        <Text style={[styles.aiBtnLabel, active && styles.aiBtnLabelActive]}>
          {active ? "Showing picks" : "AI picks"}
        </Text>
        <View style={styles.aiBtnInfo}>
          <Ionicons name="information-circle-outline" size={12} color={active ? "#0C0F1A" : colors.textTertiary} />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Add to Habits Popup ─────────────────────────────────────────────────────

function AddHabitPopup({
  template,
  visible,
  onClose,
  onConfirm,
}: {
  template: ProtocolTemplate | null;
  visible: boolean;
  onClose: () => void;
  onConfirm: (slot: TimeSlot, state: HabitTargetState) => void;
}) {
  const [slot, setSlot] = useState<TimeSlot>("morning");
  const [targetState, setTargetState] = useState<HabitTargetState>("active");

  if (!template) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.popupOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.popupSheet}>
          {/* Drag handle */}
          <View style={styles.dragHandle} />

          <Text style={styles.popupTitle}>{template.title}</Text>
          <Text style={styles.popupSub}>Configure when and how you'll track this habit.</Text>

          {/* Time of day */}
          <Text style={styles.popupSectionLabel}>When will you do this?</Text>
          <View style={styles.slotGrid}>
            {TIME_SLOTS.map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setSlot(s)}
                activeOpacity={0.8}
                style={[styles.slotChip, slot === s && styles.slotChipActive]}
              >
                <Text style={styles.slotEmoji}>{SLOT_EMOJI[s]}</Text>
                <Text style={[styles.slotLabel, slot === s && { color: colors.accent }]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Add to which section */}
          <Text style={styles.popupSectionLabel}>Add to which section?</Text>
          <View style={styles.stateRow}>
            {(["active", "planned"] as HabitTargetState[]).map((st) => (
              <TouchableOpacity
                key={st}
                onPress={() => setTargetState(st)}
                activeOpacity={0.8}
                style={[styles.stateChip, targetState === st && styles.stateChipActive]}
              >
                <Ionicons
                  name={st === "active" ? "flash" : "time-outline"}
                  size={16}
                  color={targetState === st ? colors.accent : colors.textTertiary}
                />
                <View>
                  <Text style={[styles.stateChipTitle, targetState === st && { color: colors.accent }]}>
                    {st === "active" ? "Active" : "Planned"}
                  </Text>
                  <Text style={styles.stateChipSub}>
                    {st === "active" ? "Start tracking today" : "Save for later"}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <PrimaryButton
            label="Add to my habits"
            onPress={() => { onConfirm(slot, targetState); onClose(); }}
            size="lg"
            style={styles.confirmBtn}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Template Detail Modal ───────────────────────────────────────────────────

function TemplateDetailModal({
  template,
  visible,
  onClose,
  isAdded,
  onAddPress,
}: {
  template: ProtocolTemplate | null;
  visible: boolean;
  onClose: () => void;
  isAdded: boolean;
  onAddPress: () => void;
}) {
  if (!template) return null;
  const catColor = categoryColors[template.category] ?? colors.accent;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.modalHeaderLabel}>Protocol</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.modalCatRow}>
            <View style={[styles.modalCatIcon, { backgroundColor: catColor + "20" }]}>
              <Ionicons name="leaf-outline" size={22} color={catColor} />
            </View>
            <Badge label={template.category.replace(/_/g, " ")} category={template.category} />
          </View>

          <Text style={styles.modalTitle}>{template.title}</Text>
          <Text style={styles.modalSub}>{template.shortExplanation}</Text>

          {/* Video placeholder */}
          <View style={styles.videoPlaceholder}>
            <Ionicons name="play-circle-outline" size={36} color={colors.textTertiary} />
            <Text style={styles.videoPlaceholderText}>Protocol video · Coming soon</Text>
          </View>

          <InfoBlock icon="sparkles" iconColor={colors.success} title="Expected benefit">
            <Text style={styles.infoBody}>{template.expectedBenefit}</Text>
          </InfoBlock>

          <InfoBlock icon="flask" iconColor={colors.accent} title="Evidence rationale">
            <Text style={styles.infoBody}>{template.evidenceRationale}</Text>
          </InfoBlock>

          {template.references.length > 0 && (
            <InfoBlock icon="document-text-outline" iconColor={colors.textSecondary} title="References">
              {template.references.map((ref, i) => (
                <TouchableOpacity key={i} onPress={() => Linking.openURL(ref.url)} style={styles.refRow}>
                  <Text style={styles.refTitle}>{ref.title}</Text>
                  <Text style={styles.refMeta}>{ref.publicationYear} · {ref.sourceType.replace(/_/g, " ")}</Text>
                </TouchableOpacity>
              ))}
            </InfoBlock>
          )}
        </ScrollView>

        <View style={styles.modalFooter}>
          {isAdded ? (
            <View style={styles.addedRow}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.addedLabel}>Already in your habits</Text>
            </View>
          ) : (
            <PrimaryButton label="Add to my habits" onPress={onAddPress} size="lg" />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function InfoBlock({
  icon, iconColor, title, children,
}: {
  icon: keyof typeof Ionicons.glyphMap; iconColor: string; title: string; children: React.ReactNode;
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

// ─── Template Card ───────────────────────────────────────────────────────────

function TemplateCard({
  template,
  isLocked,
  isAdded,
  onPress,
}: {
  template: ProtocolTemplate;
  isLocked: boolean;
  isAdded: boolean;
  onPress: () => void;
}) {
  const catColor = categoryColors[template.category] ?? colors.accent;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} disabled={isLocked}>
      <View style={[styles.templateCard, isLocked && { opacity: 0.55 }]}>
        {isLocked && (
          <View style={styles.lockedBanner}>
            <Ionicons name="lock-closed" size={11} color={colors.textTertiary} />
            <Text style={styles.lockedBannerText}>Pro — upgrade to unlock</Text>
          </View>
        )}
        <View style={styles.templateInner}>
          <View style={styles.templateTop}>
            <View style={[styles.catDot, { backgroundColor: catColor }]} />
            <Badge label={template.category.replace(/_/g, " ")} category={template.category} size="sm" />
            {template.premiumTierRequired !== "free" && (
              <Badge label="Pro" color="#A78BFA" size="sm" />
            )}
          </View>
          <Text style={styles.templateTitle}>{template.title}</Text>
          <Text style={styles.templateSub} numberOfLines={2}>{template.shortExplanation}</Text>
          <View style={styles.benefitRow}>
            <Ionicons name="sparkles" size={12} color={colors.success} />
            <Text style={styles.benefitText} numberOfLines={2}>{template.expectedBenefit}</Text>
          </View>
          <View style={styles.templateFooter}>
            {isAdded ? (
              <View style={[styles.actionTag, { backgroundColor: colors.successMuted }]}>
                <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                <Text style={[styles.actionTagLabel, { color: colors.success }]}>In your habits</Text>
              </View>
            ) : isLocked ? (
              <View style={styles.actionTag}>
                <Ionicons name="lock-closed-outline" size={13} color={colors.textTertiary} />
                <Text style={styles.actionTagLabel}>Locked</Text>
              </View>
            ) : (
              <View style={[styles.actionTag, { backgroundColor: colors.accentMuted }]}>
                <Ionicons name="add-circle-outline" size={13} color={colors.accent} />
                <Text style={[styles.actionTagLabel, { color: colors.accent }]}>Add to habits</Text>
              </View>
            )}
            {template.references.length > 0 && (
              <View style={styles.refCountRow}>
                <Ionicons name="document-text-outline" size={11} color={colors.textTertiary} />
                <Text style={styles.refCountText}>{template.references.length} refs</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── AI recommended IDs (mock) ───────────────────────────────────────────────
const AI_PICKS = new Set(["tpl-001", "tpl-004", "tpl-007", "tpl-010"]);

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ElysiaScreen() {
  const { addHabitFromTemplate, isHabitAddedFromTemplate } = useHabits();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [aiMode, setAiMode] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<ProtocolTemplate | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [addPopupVisible, setAddPopupVisible] = useState(false);

  const filtered = useMemo(() => {
    let base = mockTemplates;
    if (aiMode) base = base.filter((t) => AI_PICKS.has(t.templateId));
    if (selectedCategory !== "All") {
      base = base.filter(
        (t) => t.category === selectedCategory.toLowerCase().replace(/ /g, "_")
      );
    }
    return base;
  }, [selectedCategory, aiMode]);

  const isLocked = (t: ProtocolTemplate) =>
    tierRank[mockEntitlement.tier] < tierRank[t.premiumTierRequired];

  const handleCardPress = (template: ProtocolTemplate) => {
    setActiveTemplate(template);
    setDetailVisible(true);
  };

  const handleAddPress = () => {
    setDetailVisible(false);
    setTimeout(() => setAddPopupVisible(true), 300);
  };

  const handleConfirmAdd = useCallback(
    (slot: TimeSlot, state: HabitTargetState) => {
      if (activeTemplate) addHabitFromTemplate(activeTemplate, slot, state);
    },
    [activeTemplate, addHabitFromTemplate]
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Page header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Elysia</Text>
          <Text style={styles.pageSub}>Longevity Library · {mockTemplates.length} protocols</Text>
        </View>
        <View style={styles.headerRight}>
          <AIRecommendButton onPress={() => setAiMode((v) => !v)} active={aiMode} />
          <TouchableOpacity style={styles.searchBtn}>
            <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Vertical category wheel — directly under header */}
      <CategoryWheelPicker
        categories={ALL_CATEGORIES}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />

      {/* Template cards — fills remaining space */}
      <FlatList
        data={filtered}
        keyExtractor={(t) => t.templateId}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TemplateCard
            template={item}
            isLocked={isLocked(item)}
            isAdded={isHabitAddedFromTemplate(item.templateId)}
            onPress={() => handleCardPress(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="leaf-outline" size={32} color={colors.textTertiary} />
            <Text style={styles.emptyText}>No protocols in this category</Text>
          </View>
        }
      />

      {/* Template detail modal (content only) */}
      <TemplateDetailModal
        template={activeTemplate}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        isAdded={activeTemplate ? isHabitAddedFromTemplate(activeTemplate.templateId) : false}
        onAddPress={handleAddPress}
      />

      {/* Add-habit popup (time slot + state selection) */}
      <AddHabitPopup
        template={activeTemplate}
        visible={addPopupVisible}
        onClose={() => setAddPopupVisible(false)}
        onConfirm={handleConfirmAdd}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  pageHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  pageTitle: { fontSize: 26, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.5 },
  pageSub: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  searchBtn: { width: 34, height: 34, borderRadius: radii.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  // AI button
  aiBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.accentMuted, borderRadius: radii.full, paddingHorizontal: 11, paddingVertical: 7, borderWidth: 1, borderColor: colors.accent + "50" },
  aiBtnActive: { backgroundColor: colors.accent },
  aiBtnStars: { fontSize: 10, color: colors.accent },
  aiBtnLabel: { fontSize: 12, fontWeight: "700", color: colors.accent },
  aiBtnLabelActive: { color: "#0C0F1A" },
  aiBtnInfo: { marginLeft: 1 },
  // List
  listContent: { padding: spacing.lg, gap: spacing.md, paddingTop: spacing.md, paddingBottom: 110 },
  emptyWrap: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 14, color: colors.textSecondary },
  // Template card
  templateCard: { backgroundColor: colors.card, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  lockedBanner: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  lockedBannerText: { fontSize: 11, fontWeight: "600", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.4 },
  templateInner: { padding: spacing.lg, gap: spacing.sm },
  templateTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  templateTitle: { fontSize: 17, fontWeight: "700", color: colors.textPrimary, letterSpacing: -0.2 },
  templateSub: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  benefitRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  benefitText: { flex: 1, fontSize: 12, color: colors.success, lineHeight: 17, fontWeight: "500" },
  templateFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  actionTag: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.surface, borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 5 },
  actionTagLabel: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  refCountRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  refCountText: { fontSize: 11, color: colors.textTertiary },
  // Add habit popup
  popupOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
  popupSheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, paddingBottom: 40, gap: spacing.lg },
  dragHandle: { width: 40, height: 4, backgroundColor: colors.borderStrong, borderRadius: 2, alignSelf: "center", marginBottom: spacing.sm },
  popupTitle: { fontSize: 18, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.3 },
  popupSub: { fontSize: 13, color: colors.textSecondary, marginTop: -spacing.sm },
  popupSectionLabel: { fontSize: 12, fontWeight: "700", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.5 },
  slotGrid: { flexDirection: "row", gap: spacing.sm },
  slotChip: { flex: 1, alignItems: "center", paddingVertical: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 4 },
  slotChipActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  slotEmoji: { fontSize: 18 },
  slotLabel: { fontSize: 11, fontWeight: "600", color: colors.textSecondary, textTransform: "capitalize" },
  stateRow: { flexDirection: "row", gap: spacing.sm },
  stateChip: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  stateChipActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  stateChipTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  stateChipSub: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  confirmBtn: {},
  // Detail modal
  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  modalHeaderLabel: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  modalContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 },
  modalCatRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  modalCatIcon: { width: 44, height: 44, borderRadius: radii.md, alignItems: "center", justifyContent: "center" },
  modalTitle: { fontSize: 24, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.4, lineHeight: 30 },
  modalSub: { fontSize: 14, color: colors.textSecondary, lineHeight: 21 },
  videoPlaceholder: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", height: 120, alignItems: "center", justifyContent: "center", gap: 8 },
  videoPlaceholderText: { fontSize: 13, color: colors.textTertiary },
  infoBlock: { backgroundColor: colors.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  infoBlockHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoBlockTitle: { fontSize: 12, fontWeight: "700", color: colors.textPrimary, textTransform: "uppercase", letterSpacing: 0.5 },
  infoBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 21 },
  refRow: { gap: 2, paddingVertical: 4 },
  refTitle: { fontSize: 13, color: colors.accent, fontWeight: "500" },
  refMeta: { fontSize: 11, color: colors.textTertiary },
  modalFooter: { padding: spacing.lg, paddingBottom: 32, borderTopWidth: 1, borderTopColor: colors.border },
  addedRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  addedLabel: { fontSize: 15, fontWeight: "600", color: colors.success },
});
