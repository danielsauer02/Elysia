import React from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "@/theme";
import { Card } from "@/components/ui/Card";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useFloatingTabBarScrollPadding } from "@/hooks/useFloatingTabBarScrollPadding";

const REF_URL = "https://www.aad.org/public/everyday-care/skin-care-basics";

export default function DiagnosticsSkinScreen() {
  const router = useRouter();
  const scrollPad = useFloatingTabBarScrollPadding();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.topTitle}>Skin analysis</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: scrollPad }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lead}>
          Photoaging and routine adherence — honest V1: guided self-assessment and habit links, not a replacement for
          a dermatologist.
        </Text>

        <Card variant="elevated" style={styles.card}>
          <View style={styles.stepRow}>
            <Text style={styles.stepNum}>1</Text>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>Daily routine checklist</Text>
              <Text style={styles.stepText}>
                SPF, retinoid tolerance, barrier repair — log what you actually do; we’ll surface consistency trends.
              </Text>
            </View>
          </View>
          <View style={styles.stepRow}>
            <Text style={styles.stepNum}>2</Text>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>Photo timeline (optional)</Text>
              <Text style={styles.stepText}>
                Same pose weekly photos help you see change; any future AI scoring will be opt-in and explainable.
              </Text>
            </View>
          </View>
          <View style={styles.stepRow}>
            <Text style={styles.stepNum}>3</Text>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>Escalation paths</Text>
              <Text style={styles.stepText}>
                Suspicious lesions always belong in clinic care — we’ll keep in-app language conservative and link out
                to professional resources.
              </Text>
            </View>
          </View>
        </Card>

        <PrimaryButton
          label="Skin care basics (AAD)"
          onPress={() => WebBrowser.openBrowserAsync(REF_URL)}
          size="lg"
        />
        <Pressable onPress={() => Linking.openURL("mailto:support@elysia.app")} style={styles.linkRow}>
          <Ionicons name="mail-outline" size={18} color={colors.accent} />
          <Text style={styles.linkText}>Partner with Elysia (clinics)</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: 17, fontWeight: "800", color: colors.textPrimary },
  content: { padding: spacing.lg, gap: spacing.lg },
  lead: { fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  card: { gap: spacing.lg },
  stepRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.accentMuted,
    color: colors.accent,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 28,
    fontSize: 13,
  },
  stepBody: { flex: 1, gap: 4 },
  stepTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  stepText: { fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  linkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "center" },
  linkText: { fontSize: 14, fontWeight: "600", color: colors.accent },
});
