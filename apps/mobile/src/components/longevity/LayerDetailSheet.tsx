/**
 * LayerDetailSheet
 *
 * Bottom sheet shown when the user taps a ring on the Longevity Wheel.
 *
 * Layout:
 *   - header (layer name + composite score + tier badge)
 *   - per-pillar list with sub-score progress bars + key metric chips
 *   - heuristic summary line ("Driven by HRV uplift today.")
 *   - "Get tips" CTA that hands control to the AI assistant with a
 *     pre-filled prompt mentioning the layer
 *
 * Pure presentation. Driven by `layerId`; pillarScores and metrics are
 * supplied by the parent.
 */

import React, { useCallback, useMemo, forwardRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetModal as BottomSheetModalType,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radii } from "@/theme";
import {
  LAYER_META,
  LAYER_TO_PILLARS,
  PILLAR_LABELS,
  type PillarId,
  type WheelLayerId,
} from "@/lib/displayLayers";
import { useAiAssistant } from "@/context/AiAssistantContext";

// ─── Heuristic summary ──────────────────────────────────────────────────────

function summariseLayer(
  layerId: WheelLayerId,
  pillarScores: Partial<Record<PillarId, number | null>>
): string {
  const pillars = LAYER_TO_PILLARS[layerId];
  const scored = pillars
    .map((p) => ({ id: p, score: pillarScores[p] }))
    .filter((p): p is { id: PillarId; score: number } => typeof p.score === "number");
  if (scored.length === 0) return "No data yet. Connect a source to light this layer up.";
  const best = scored.reduce((a, b) => (a.score >= b.score ? a : b));
  const worst = scored.reduce((a, b) => (a.score <= b.score ? a : b));
  if (best.id === worst.id) {
    return `Driven by ${PILLAR_LABELS[best.id]} at ${best.score}%.`;
  }
  if (worst.score < 50) {
    return `${PILLAR_LABELS[worst.id]} is dragging this layer down (${worst.score}%). Focus there for the biggest lift.`;
  }
  return `${PILLAR_LABELS[best.id]} (${best.score}%) is leading; ${PILLAR_LABELS[worst.id]} trails at ${worst.score}%.`;
}

// ─── Sub-score row ──────────────────────────────────────────────────────────

function PillarRow({
  pillar,
  score,
  color,
  metrics,
}: {
  pillar: PillarId;
  score: number | null;
  color: string;
  metrics?: Array<{ label: string; value: string }>;
}) {
  const widthPct = score == null ? 0 : Math.max(0, Math.min(100, score));
  return (
    <View style={pillarStyles.row}>
      <View style={pillarStyles.headerRow}>
        <Text style={pillarStyles.label}>{PILLAR_LABELS[pillar]}</Text>
        <Text style={[pillarStyles.score, { color }]}>
          {score == null ? "—" : `${Math.round(score)}`}
        </Text>
      </View>
      <View style={pillarStyles.track}>
        <View
          style={[
            pillarStyles.bar,
            { width: `${widthPct}%`, backgroundColor: color },
          ]}
        />
      </View>
      {metrics && metrics.length > 0 ? (
        <View style={pillarStyles.metricsRow}>
          {metrics.map((m) => (
            <View key={m.label} style={pillarStyles.metricChip}>
              <Text style={pillarStyles.metricLabel}>{m.label}</Text>
              <Text style={pillarStyles.metricValue}>{m.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const pillarStyles = StyleSheet.create({
  row: { gap: 6, paddingVertical: spacing.sm },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  score: { fontSize: 13, fontWeight: "800" },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  bar: { height: 6, borderRadius: 3 },
  metricsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  metricChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metricLabel: { fontSize: 10, color: colors.textTertiary, fontWeight: "600" },
  metricValue: { fontSize: 11, color: colors.textPrimary, fontWeight: "700" },
});

// ─── Sheet ──────────────────────────────────────────────────────────────────

export interface LayerDetailSheetProps {
  /** Map of pillarId -> 0..100 score (or null). */
  pillarScores: Partial<Record<PillarId, number | null>>;
  /** Optional metrics shown under each pillar row. */
  metricsByPillar?: Partial<Record<PillarId, Array<{ label: string; value: string }>>>;
}

export interface LayerDetailSheetHandle {
  present: (layerId: WheelLayerId) => void;
  dismiss: () => void;
}

export const LayerDetailSheet = forwardRef<
  LayerDetailSheetHandle,
  LayerDetailSheetProps
>(function LayerDetailSheet({ pillarScores, metricsByPillar }, ref) {
  const sheetRef = React.useRef<BottomSheetModalType>(null);
  const [layerId, setLayerId] = React.useState<WheelLayerId | null>(null);
  const snapPoints = useMemo(() => ["55%", "85%"], []);
  const assistant = useAiAssistant();

  React.useImperativeHandle(ref, () => ({
    present: (id: WheelLayerId) => {
      setLayerId(id);
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const layer = layerId ? LAYER_META[layerId] : null;
  const pillars = layer ? LAYER_TO_PILLARS[layer.id] : [];

  const layerScore = useMemo(() => {
    if (!layer) return null;
    const scored = pillars
      .map((p) => pillarScores[p])
      .filter((s): s is number => typeof s === "number");
    if (scored.length === 0) return null;
    return Math.round(scored.reduce((s, v) => s + v, 0) / scored.length);
  }, [layer, pillars, pillarScores]);

  const handleGetTips = useCallback(() => {
    if (!layer) return;
    sheetRef.current?.dismiss();
    requestAnimationFrame(() => {
      assistant.presentAssistant({
        initialPrompt: `Give me 3 concrete tips to lift my ${layer.label} score this week. Anchor each tip to a specific habit I can do today.`,
      });
    });
  }, [layer, assistant]);

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
        {layer ? (
          <>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View
                  style={[
                    styles.layerDot,
                    { backgroundColor: layer.color + "30", borderColor: layer.color + "60" },
                  ]}
                />
                <View>
                  <Text style={styles.title}>{layer.label}</Text>
                  <Text style={styles.tierBadge}>Tier {layer.tier}</Text>
                </View>
              </View>
              <View style={styles.scoreBox}>
                <Text style={[styles.scoreValue, { color: layer.color }]}>
                  {layerScore == null ? "—" : layerScore}
                </Text>
                <Text style={styles.scoreUnit}>/ 100</Text>
              </View>
            </View>

            <Text style={styles.summary}>
              {summariseLayer(layer.id, pillarScores)}
            </Text>

            <View style={styles.pillarList}>
              {pillars.map((p) => (
                <PillarRow
                  key={p}
                  pillar={p}
                  score={pillarScores[p] ?? null}
                  color={layer.color}
                  metrics={metricsByPillar?.[p]}
                />
              ))}
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.cta, { backgroundColor: layer.color + "22", borderColor: layer.color + "60" }]}
              onPress={handleGetTips}
            >
              <Ionicons name="sparkles-outline" size={16} color={layer.color} />
              <Text style={[styles.ctaLabel, { color: layer.color }]}>
                Get tips for {layer.label}
              </Text>
            </TouchableOpacity>
          </>
        ) : null}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  bg: { backgroundColor: colors.card },
  handle: { backgroundColor: colors.borderStrong, width: 36 },
  body: { padding: spacing.lg, gap: spacing.md },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  layerDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  tierBadge: { fontSize: 11, color: colors.textTertiary, fontWeight: "600" },
  scoreBox: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  scoreValue: { fontSize: 32, fontWeight: "800", letterSpacing: -1 },
  scoreUnit: { fontSize: 12, color: colors.textTertiary, fontWeight: "600" },
  summary: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  pillarList: { gap: 0, marginTop: spacing.xs },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  ctaLabel: { fontSize: 14, fontWeight: "700" },
});
