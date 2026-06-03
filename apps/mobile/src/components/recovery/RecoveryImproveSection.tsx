/**
 * RecoveryImproveSection
 *
 * Always-on "How can I improve my Recovery?" block at the bottom of the
 * recovery deep-dive. Pulls per-user ranked habit recommendations from Convex
 * (via `useRecoveryRecommendations`) and renders them as a swipeable deck with
 * an "Already in place" list and a "Discover more" footer.
 *
 * Unlike `RecoveryWhySection` this is NOT collapsible — the recommendations
 * are the payload, so they stay permanently visible. A small cream-orange
 * "Updated daily" tag signals the engine re-ranks every day.
 */
import React, { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ProtocolTemplate } from "@elysia/domain";
import {
  borderTokens,
  colors,
  fontFamily,
  spacing,
  surface,
  text as textTokens,
} from "@/theme";
import { useRecoveryRecommendations } from "@/hooks/useRecoveryRecommendations";
import { useHabits } from "@/context/HabitsContext";
import { RecommendationCardStack } from "./RecommendationCardStack";
import { AlreadyInPlaceList } from "./AlreadyInPlaceList";
import {
  TemplateDetailModal,
  type HabitTargetState,
  type TimeSlot,
} from "@/components/elysia/TemplateDetailModal";

export function RecoveryImproveSection() {
  const router = useRouter();
  const { addHabitFromTemplate, isHabitAddedFromTemplate } = useHabits();
  const {
    loading,
    recommendations,
    alreadyInPlace,
    dismiss,
  } = useRecoveryRecommendations();

  const [modalTemplate, setModalTemplate] = useState<ProtocolTemplate | null>(
    null
  );
  const [modalMode, setModalMode] = useState<"detail" | "add">("detail");
  const [modalVisible, setModalVisible] = useState(false);

  // Pending dismissals — we hide the card optimistically so the swipe feels
  // instant; the server mutation backs it asynchronously.
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(
    () => new Set()
  );
  const markDismissed = useCallback((templateId: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(templateId);
      return next;
    });
  }, []);

  const visibleRecommendations = recommendations.filter(
    (r) => !dismissedIds.has(r.templateId)
  );

  const handleAdd = useCallback(
    (slot: TimeSlot, state: HabitTargetState) => {
      if (modalTemplate) addHabitFromTemplate(modalTemplate, slot, state);
    },
    [modalTemplate, addHabitFromTemplate]
  );

  const openDetail = useCallback((template: ProtocolTemplate) => {
    setModalTemplate(template);
    setModalMode("detail");
    setModalVisible(true);
  }, []);

  const openAdd = useCallback((template: ProtocolTemplate) => {
    setModalTemplate(template);
    setModalMode("add");
    setModalVisible(true);
  }, []);

  const handleDiscoverMore = useCallback(() => {
    router.push({
      pathname: "/(tabs)/elysia",
      params: { category: "recovery" },
    });
  }, [router]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>How can I improve my Recovery?</Text>
      <Text style={styles.sectionSub}>
        Based on your recent trends, these habits will have the biggest impact.
      </Text>

      <View style={styles.updatedPill}>
        <Ionicons name="refresh" size={10} color="#0B0B0B" />
        <Text style={styles.updatedPillLabel}>Updated daily</Text>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <Text style={styles.loadingLabel}>Loading recommendations…</Text>
        </View>
      ) : (
        <View style={styles.body}>
          <RecommendationCardStack
            items={visibleRecommendations}
            onPressCard={(item) => openDetail(item.template)}
            onAdd={(item) => openAdd(item.template)}
            onDismiss={(item) => {
              markDismissed(item.templateId);
              // Fire-and-forget the server-side blacklist.
              void dismiss(item.templateId);
            }}
          />

          <AlreadyInPlaceList
            items={alreadyInPlace}
            onPressItem={(item) =>
              item.template ? openDetail(item.template) : undefined
            }
          />

          <TouchableOpacity
            style={styles.discoverBtn}
            onPress={handleDiscoverMore}
            activeOpacity={0.85}
          >
            <Text style={styles.discoverLabel}>Discover more</Text>
            <Ionicons name="caret-forward" size={13} color="#0B111A" />
          </TouchableOpacity>
        </View>
      )}

      <TemplateDetailModal
        template={modalTemplate}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        isAdded={
          modalTemplate
            ? isHabitAddedFromTemplate(modalTemplate.templateId)
            : false
        }
        onAdd={handleAdd}
        mode={modalMode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.huge,
    paddingBottom: spacing.lg,
  },
  sectionTitle: {
    fontFamily: fontFamily.heading,
    fontSize: 20,
    letterSpacing: -0.2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  sectionSub: {
    fontFamily: fontFamily.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  // White tag with black text/icon. Square-ish (small radius), miniature —
  // reads as a tag, not a pill.
  updatedPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: "#FFFFFF",
    marginBottom: spacing.lg,
  },
  updatedPillLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0B0B0B",
    letterSpacing: 0.3,
  },
  body: {
    marginHorizontal: -spacing.lg, // let the card stack break out of section padding
    gap: spacing.lg,
  },
  loadingCard: {
    padding: spacing.xxl,
    backgroundColor: surface.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    alignItems: "center",
  },
  loadingLabel: {
    fontSize: 13,
    color: textTokens.tertiary,
  },
  discoverBtn: {
    marginHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
  },
  discoverLabel: {
    color: "#0B111A",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});
