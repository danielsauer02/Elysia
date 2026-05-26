/**
 * LongevityAdviceSheet
 *
 * Bottom sheet opened from the "How can I improve this score?" button below
 * the Longevity Wheel. Calls `assistant.getLongevityAdvice` which feeds the
 * user's pillar + layer scores to OpenAI and returns 3–5 concrete tips
 * scoped to today/tomorrow.
 *
 * Loading state shows a shimmering placeholder. Error state surfaces the
 * server error message and offers a retry.
 *
 * Pure presentation aside from the Convex action call.
 */

import React, { forwardRef, useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetModal as BottomSheetModalType,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { colors, spacing, radii } from "@/theme";
import type { PillarId, WheelLayerId } from "@/lib/displayLayers";

export interface LongevityAdviceSheetHandle {
  present: () => void;
  dismiss: () => void;
}

interface LongevityAdviceSheetProps {
  composite: number | null;
  layerScores: Partial<Record<WheelLayerId, number | null>>;
  pillarScores: Partial<Record<PillarId, number | null>>;
}

export const LongevityAdviceSheet = forwardRef<
  LongevityAdviceSheetHandle,
  LongevityAdviceSheetProps
>(function LongevityAdviceSheet(
  { composite, layerScores, pillarScores },
  ref
) {
  const sheetRef = React.useRef<BottomSheetModalType>(null);
  const snapPoints = useMemo(() => ["65%", "92%"], []);
  const [advice, setAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAdvice = useAction(api.assistant.getLongevityAdvice);

  const requestAdvice = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAdvice(null);
    try {
      const res = await getAdvice({
        composite: composite ?? null,
        layerScores: layerScores as Record<string, number | null>,
        pillarScores: pillarScores as Record<string, number | null>,
        today: new Date().toISOString().slice(0, 10),
      });
      setAdvice(res.advice);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [composite, getAdvice, layerScores, pillarScores]);

  React.useImperativeHandle(ref, () => ({
    present: () => {
      sheetRef.current?.present();
      void requestAdvice();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      backdropComponent={(p) => (
        <BottomSheetBackdrop {...p} appearsOnIndex={0} disappearsOnIndex={-1} />
      )}
      backgroundStyle={styles.bg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={styles.body}>
        <View style={styles.header}>
          <Ionicons name="sparkles" size={20} color={colors.accent} />
          <Text style={styles.title}>How to improve your battery</Text>
        </View>
        <Text style={styles.subtitle}>
          {composite == null
            ? "Personalised tips for the next 24 hours."
            : `Your battery is at ${Math.round(composite)}%. Here is what moves the needle the most today and tomorrow.`}
        </Text>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.skeletonGroup}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.skeletonRow}>
                  <View style={styles.skeletonDot} />
                  <View style={styles.skeletonText} />
                </View>
              ))}
              <Text style={styles.loadingNote}>Elysia is analysing your data…</Text>
            </View>
          ) : error ? (
            <View style={styles.errorBox}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={colors.destructive}
              />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={requestAdvice} style={styles.retryBtn}>
                <Text style={styles.retryLabel}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : advice ? (
            <Text style={styles.adviceText}>{advice}</Text>
          ) : null}
        </ScrollView>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  bg: { backgroundColor: colors.card },
  handle: { backgroundColor: colors.borderStrong, width: 36 },
  body: { padding: spacing.lg, gap: spacing.sm, flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xl },
  adviceText: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textPrimary,
  },
  skeletonGroup: { gap: spacing.md },
  skeletonRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  skeletonDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
  },
  skeletonText: {
    flex: 1,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.borderStrong,
    opacity: 0.55,
  },
  loadingNote: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: "center",
  },
  errorBox: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.destructive + "12",
    borderWidth: 1,
    borderColor: colors.destructive + "40",
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: colors.destructive,
    lineHeight: 18,
  },
  retryBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.destructive + "20",
  },
  retryLabel: { fontSize: 12, fontWeight: "700", color: colors.destructive },
});
