import React, { useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, spacing, radii, typography } from "@/theme";
import { useAppContext } from "@/context/AppContext";
import { useRevenueCat } from "@/context/RevenueCatContext";
import { track } from "@/lib/analytics";

const BENEFITS = [
  { icon: "sparkles-outline" as const, text: "Personalised longevity protocols" },
  { icon: "chatbubble-ellipses-outline" as const, text: "AI wellness coach" },
  { icon: "checkmark-done-outline" as const, text: "Habit tracking & analytics" },
  { icon: "nutrition-outline" as const, text: "Nutrition planning" },
  { icon: "watch-outline" as const, text: "Wearable integrations" },
  { icon: "shield-checkmark-outline" as const, text: "Priority support" },
];

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { presentPaywall, restorePurchases, isProUser } = useRevenueCat();
  const { grantTemporarySubscriptionAccess } = useAppContext();

  useEffect(() => {
    track("paywall_viewed");
  }, []);

  const handleStartTrial = useCallback(async () => {
    track("paywall_cta_tapped");
    await presentPaywall();
    grantTemporarySubscriptionAccess();
    track("paywall_trial_started");
    router.replace("/(tabs)/dashboard");
  }, [grantTemporarySubscriptionAccess, presentPaywall, router]);

  const handleRestore = useCallback(async () => {
    await restorePurchases();
  }, [restorePurchases]);

  if (isProUser) {
    router.replace("/(tabs)/dashboard");
    return null;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconWrap}>
          <LinearGradient
            colors={[colors.accent, colors.accentDark]}
            style={styles.iconGradient}
          >
            <Ionicons name="diamond-outline" size={40} color="#fff" />
          </LinearGradient>
        </View>

        <Text style={styles.title}>Unlock Elysia Pro</Text>
        <Text style={styles.subtitle}>
          Your all-in-one longevity companion, powered by AI
        </Text>

        <View style={styles.benefitsList}>
          {BENEFITS.map((b) => (
            <View key={b.text} style={styles.benefitRow}>
              <View style={styles.checkCircle}>
                <Ionicons name={b.icon} size={18} color={colors.accent} />
              </View>
              <Text style={styles.benefitText}>{b.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <Pressable
          style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaPressed]}
          onPress={handleStartTrial}
        >
          <Text style={styles.ctaText}>Start free trial</Text>
        </Pressable>

        <Pressable onPress={handleRestore} style={styles.restoreBtn}>
          <Text style={styles.restoreText}>Restore purchase</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.xxl,
    paddingTop: 48,
    paddingBottom: 24,
    alignItems: "center",
  },
  iconWrap: {
    marginBottom: spacing.xxl,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...typography.largeTitle,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xxxl,
    paddingHorizontal: spacing.lg,
  },
  benefitsList: {
    width: "100%",
    gap: spacing.lg,
    marginBottom: spacing.xxxl,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  checkCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  bottomBar: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  ctaButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 16,
    alignItems: "center",
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaText: {
    ...typography.headline,
    color: "#000",
  },
  restoreBtn: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  restoreText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
