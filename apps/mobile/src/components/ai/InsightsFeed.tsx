import React, { useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { colors, spacing, radii } from "@/theme";
import { useAiAssistant } from "@/context/AiAssistantContext";

const SEVERITY_COLORS: Record<string, string> = {
  positive: colors.success,
  warning: colors.warning,
  neutral: colors.accent,
};

const ICON_BY_CATEGORY: Record<string, keyof typeof Ionicons.glyphMap> = {
  recovery: "battery-charging-outline",
  nutrition: "nutrition-outline",
  training: "barbell-outline",
  sleep: "moon-outline",
  balance: "trending-down-outline",
  streak: "flame-outline",
};

function InsightsFeedInner() {
  const insights = useQuery(api.insights.listMyInsights, { limit: 10 });
  const dismiss = useMutation(api.insights.dismissInsight);
  const generateNow = useAction(api.insights.generateForMyselfNow);
  const { presentAssistant } = useAiAssistant();

  const handleAsk = useCallback(
    (title: string, body: string) => {
      presentAssistant({ initialPrompt: `${title}\n\nContext: ${body}` });
    },
    [presentAssistant]
  );

  if (insights === undefined) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Loading insights…</Text>
      </View>
    );
  }
  if (insights.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="sparkles-outline" size={20} color={colors.textTertiary} />
        <Text style={styles.emptyText}>
          No insights yet. We will generate fresh ones tonight as your data fills in.
        </Text>
        <TouchableOpacity onPress={() => void generateNow({})} style={styles.genBtn}>
          <Text style={styles.genLabel}>Generate now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
    >
      {insights.map((ins) => {
        const color = SEVERITY_COLORS[ins.severity] ?? colors.accent;
        const icon = ICON_BY_CATEGORY[ins.category] ?? "bulb-outline";
        return (
          <View key={ins._id} style={[styles.card, { borderLeftColor: color }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconWrap, { backgroundColor: color + "22" }]}>
                <Ionicons name={icon} size={16} color={color} />
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {ins.title}
              </Text>
              <TouchableOpacity
                onPress={() => void dismiss({ insightId: ins._id as Id<"insights"> })}
                hitSlop={8}
              >
                <Ionicons name="close" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.cardBody} numberOfLines={4}>
              {ins.body}
            </Text>
            <TouchableOpacity
              onPress={() => handleAsk(ins.title, ins.body)}
              style={styles.askBtn}
            >
              <Ionicons name="chatbubble-outline" size={13} color={color} />
              <Text style={[styles.askLabel, { color }]}>Ask Elysia</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingRight: spacing.lg },
  card: {
    width: 270,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    padding: spacing.md,
    gap: 8,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconWrap: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardTitle: { flex: 1, color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
  cardBody: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  askBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radii.sm,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  askLabel: { fontSize: 12, fontWeight: "700" },
  empty: {
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
  },
  genBtn: {
    marginTop: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
  genLabel: { color: "#0B1020", fontSize: 13, fontWeight: "700" },
});

/** Memoised: no props, only re-renders when its Convex queries change. */
export const InsightsFeed = React.memo(InsightsFeedInner);
