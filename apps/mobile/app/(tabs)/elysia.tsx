import React, { useState, useMemo } from "react";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { ProtocolTemplate } from "@elysia/domain";
import { colors, spacing, radii, categoryColors } from "@/theme";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CategoryChips } from "@/components/ui/CategoryChips";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useHabits } from "@/context/HabitsContext";
import { mockTemplates, ALL_CATEGORIES, mockEntitlement } from "@/mocks/data";

const tierRank: Record<"free" | "pro" | "elite", number> = { free: 0, pro: 1, elite: 2 };
type TimeSlot = "morning" | "midday" | "afternoon" | "evening";
type HabitTargetState = "active" | "planned";

const TIME_SLOTS: TimeSlot[] = ["morning", "midday", "afternoon", "evening"];
const SLOT_EMOJI: Record<TimeSlot, string> = { morning: "🌅", midday: "☀️", afternoon: "🌤", evening: "🌙" };

// ─── Template Card ──────────────────────────────────────────────────────────

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
      <View
        style={[
          styles.templateCard,
          isLocked && { opacity: 0.55 },
        ]}
      >
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
          <Text style={styles.templateSub} numberOfLines={2}>
            {template.shortExplanation}
          </Text>
          <View style={styles.benefitRow}>
            <Ionicons name="sparkles" size={12} color={colors.success} />
            <Text style={styles.benefitText} numberOfLines={2}>
              {template.expectedBenefit}
            </Text>
          </View>
          <View style={styles.templateActions}>
            {isLocked ? (
              <View style={styles.actionTag}>
                <Ionicons name="lock-closed-outline" size={13} color={colors.textTertiary} />
                <Text style={styles.actionTagLabel}>Locked</Text>
              </View>
            ) : isAdded ? (
              <View style={[styles.actionTag, { backgroundColor: colors.successMuted }]}>
                <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                <Text style={[styles.actionTagLabel, { color: colors.success }]}>In your habits</Text>
              </View>
            ) : (
              <View style={[styles.actionTag, { backgroundColor: colors.accentMuted }]}>
                <Ionicons name="add-circle-outline" size={13} color={colors.accent} />
                <Text style={[styles.actionTagLabel, { color: colors.accent }]}>Add to habits</Text>
              </View>
            )}
            {template.references.length > 0 && (
              <View style={styles.refTag}>
                <Ionicons name="document-text-outline" size={11} color={colors.textTertiary} />
                <Text style={styles.refTagText}>{template.references.length}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

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
    setTimeout(() => { setJustAdded(false); onClose(); }, 800);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe}>
        {/* Header */}
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

          {!isAdded && !justAdded && (
            <>
              {/* Time of day */}
              <View style={styles.addSection}>
                <Text style={styles.addSectionTitle}>When will you do this?</Text>
                <View style={styles.slotGrid}>
                  {TIME_SLOTS.map((s) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setSlot(s)}
                      activeOpacity={0.8}
                      style={[styles.slotChip, slot === s && styles.slotChipActive]}
                    >
                      <Text style={styles.slotEmoji}>{SLOT_EMOJI[s]}</Text>
                      <Text style={[styles.slotLabel, slot === s && { color: colors.accent }]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Active vs Planned */}
              <View style={styles.addSection}>
                <Text style={styles.addSectionTitle}>Add to which section?</Text>
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
                        size={15}
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
              </View>
            </>
          )}
        </ScrollView>

        <View style={styles.modalFooter}>
          {isAdded || justAdded ? (
            <View style={styles.addedRow}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.addedLabel}>
                {justAdded ? "Added — opening Tracker..." : "Already in your habits"}
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
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activeTemplate, setActiveTemplate] = useState<ProtocolTemplate | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const filtered = useMemo(() => {
    if (selectedCategory === "All") return mockTemplates;
    return mockTemplates.filter(
      (t) => t.category === selectedCategory.toLowerCase().replace(/ /g, "_")
    );
  }, [selectedCategory]);

  const handleAdd = (slot: TimeSlot, state: HabitTargetState) => {
    if (activeTemplate) addHabitFromTemplate(activeTemplate, slot, state);
  };

  const isLocked = (t: ProtocolTemplate) =>
    tierRank[mockEntitlement.tier] < tierRank[t.premiumTierRequired];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Elysia</Text>
          <Text style={styles.pageSub}>Longevity Library · {mockTemplates.length} protocols</Text>
        </View>
        <TouchableOpacity style={styles.searchBtn}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <CategoryChips
        categories={ALL_CATEGORIES.map((c) => c.replace(/_/g, " "))}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {filtered.map((template) => (
          <TemplateCard
            key={template.templateId}
            template={template}
            isLocked={isLocked(template)}
            isAdded={isHabitAddedFromTemplate(template.templateId)}
            onPress={() => { setActiveTemplate(template); setModalVisible(true); }}
          />
        ))}
      </ScrollView>

      <TemplateDetailModal
        template={activeTemplate}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        isAdded={activeTemplate ? isHabitAddedFromTemplate(activeTemplate.templateId) : false}
        onAdd={handleAdd}
      />
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  pageHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md },
  pageTitle: { fontSize: 26, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.5 },
  pageSub: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  searchBtn: { width: 36, height: 36, borderRadius: radii.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingTop: spacing.md },
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
  templateActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  actionTag: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.surface, borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 5 },
  actionTagLabel: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  refTag: { flexDirection: "row", alignItems: "center", gap: 3 },
  refTagText: { fontSize: 11, color: colors.textTertiary, fontWeight: "600" },
  // Modal
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
  addSection: { gap: spacing.sm },
  addSectionTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  slotGrid: { flexDirection: "row", gap: spacing.sm },
  slotChip: { flex: 1, alignItems: "center", paddingVertical: spacing.md, borderRadius: radii.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 4 },
  slotChipActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  slotEmoji: { fontSize: 18 },
  slotLabel: { fontSize: 11, fontWeight: "600", color: colors.textSecondary, textTransform: "capitalize" },
  stateRow: { flexDirection: "row", gap: spacing.sm },
  stateChip: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  stateChipActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  stateChipTitle: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  stateChipSub: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  modalFooter: { padding: spacing.lg, paddingBottom: 32, borderTopWidth: 1, borderTopColor: colors.border },
  addedRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  addedLabel: { fontSize: 15, fontWeight: "600", color: colors.success },
});
