/**
 * TemplateDetailModal
 *
 * Shared protocol-detail sheet used both by the Elysia library tab and the
 * Recovery deep-dive recommendation stack. Renders the full ProtocolTemplate
 * (benefit, evidence, references) and an Add flow that picks a time slot
 * (morning / midday / afternoon / evening) and a target state
 * (active / planned), then calls back into whatever `onAdd` the caller wires
 * to `HabitsContext.addHabitFromTemplate`.
 *
 * Two display modes via `mode`:
 *   - "detail" (default): only renders the protocol overview, no Add UI.
 *     Used when the user taps the card body in the recommendation stack.
 *   - "add": renders overview + the slot / state picker + an "Add to my
 *     habits" CTA. Used when the user taps the "+ Add" button.
 *
 * Extracted from app/(tabs)/elysia.tsx so the recovery surface can reuse the
 * exact same UX (and the Add UX stays in lock-step between the two surfaces).
 */
import React, { useEffect, useState } from "react";
import {
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { ProtocolTemplate } from "@elysia/domain";
import { Badge } from "@/components/ui/Badge";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import {
  borderTokens,
  categoryColors,
  categoryIcons,
  colors,
  radii,
  spacing,
} from "@/theme";

export type TimeSlot = "morning" | "midday" | "afternoon" | "evening";
export type HabitTargetState = "active" | "planned";

export type TemplateDetailMode = "detail" | "add";

const TIME_SLOTS: TimeSlot[] = ["morning", "midday", "afternoon", "evening"];
const SLOT_EMOJI: Record<TimeSlot, string> = {
  morning: "🌅",
  midday: "☀️",
  afternoon: "🌤",
  evening: "🌙",
};

export interface TemplateDetailModalProps {
  template: ProtocolTemplate | null;
  visible: boolean;
  onClose: () => void;
  /** When true, "Already in your habits" footer replaces the Add CTA. */
  isAdded: boolean;
  /** Required when `mode === "add"`. Ignored in "detail" mode. */
  onAdd?: (slot: TimeSlot, state: HabitTargetState) => void;
  /** Defaults to "detail". */
  mode?: TemplateDetailMode;
  /** Header label above the close button. Defaults to "Protocol". */
  headerLabel?: string;
}

export function TemplateDetailModal({
  template,
  visible,
  onClose,
  isAdded,
  onAdd,
  mode = "detail",
  headerLabel = "Protocol",
}: TemplateDetailModalProps) {
  const [slot, setSlot] = useState<TimeSlot>("morning");
  const [targetState, setTargetState] = useState<HabitTargetState>("active");
  const [justAdded, setJustAdded] = useState(false);

  // Reset the success flag whenever the modal closes so the next open starts
  // clean. Without this, dismissing right after Add leaves the success state
  // stuck on the next protocol viewed.
  useEffect(() => {
    if (!visible) setJustAdded(false);
  }, [visible]);

  if (!template) return null;
  const catColor = categoryColors[template.category] ?? colors.accent;
  const catIcon =
    (categoryIcons[template.category] as keyof typeof Ionicons.glyphMap) ||
    "sparkles-outline";

  const showAddSection = mode === "add" && !isAdded && !justAdded;
  const showAddFooter = mode === "add";

  const handleAdd = () => {
    if (!onAdd) return;
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
          <Text style={styles.modalHeaderLabel}>{headerLabel}</Text>
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
              <Ionicons name={catIcon} size={22} color={catColor} />
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

          {showAddSection && (
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

        {showAddFooter && (
          <View style={styles.modalFooter}>
            {isAdded || justAdded ? (
              <View style={styles.addedRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.success}
                />
                <Text style={styles.addedLabel}>
                  {justAdded ? "Added to your habits" : "Already in your habits"}
                </Text>
              </View>
            ) : (
              <PrimaryButton
                label="Add to my habits"
                onPress={handleAdd}
                size="lg"
              />
            )}
          </View>
        )}
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

const styles = StyleSheet.create({
  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: borderTokens.subtle,
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
    borderColor: borderTokens.subtle,
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
    borderColor: borderTokens.subtle,
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
    borderColor: borderTokens.subtle,
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
    borderColor: borderTokens.subtle,
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
    borderTopColor: borderTokens.subtle,
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
