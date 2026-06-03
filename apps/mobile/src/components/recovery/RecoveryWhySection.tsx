/**
 * RecoveryWhySection
 *
 * Collapsible education block on /recovery. Collapsed by default: a section
 * heading + a grey expander row ("The most important drivers of good
 * recovery"). Expanding reveals the animated orbit hero with five benefits,
 * plus an insight card; tapping a benefit opens its detail sheet.
 */
import React, { useRef, useState } from "react";
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RecoveryWhyHero } from "./RecoveryWhyHero";
import {
  RecoveryWhyBenefitSheet,
  type RecoveryWhyBenefitSheetHandle,
} from "./RecoveryWhyBenefitSheet";
import { RECOVERY_WHY_INSIGHT, type RecoveryBenefit } from "./recoveryWhyContent";
import {
  borderTokens,
  brand,
  colors,
  fontFamily,
  spacing,
  surface,
} from "@/theme";

export function RecoveryWhySection() {
  const sheetRef = useRef<RecoveryWhyBenefitSheetHandle>(null);
  const [open, setOpen] = useState(false);
  const [pressedId, setPressedId] = useState<string | null>(null);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  const openBenefit = (b: RecoveryBenefit) => {
    setPressedId(null);
    sheetRef.current?.present(b);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Why Recovery Matters</Text>

      <Pressable style={styles.expander} onPress={toggle} accessibilityRole="button">
        <Text style={styles.expanderText}>
          The most important drivers of good recovery
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>

      {open ? (
        <View style={styles.expanded}>
          <Text style={styles.intro}>
            Recovery is not a luxury — it is the foundation of your performance,
            health and longevity. Tap a driver to see the science.
          </Text>

          <RecoveryWhyHero
            pressedId={pressedId}
            onPressIn={setPressedId}
            onPressOut={() => setPressedId(null)}
            onSelect={openBenefit}
          />

          <View style={styles.insight}>
            <View style={styles.insightIcon}>
              <Ionicons name="bulb" size={18} color={brand.primary} />
            </View>
            <View style={styles.insightCopy}>
              <Text style={styles.insightTitle}>
                Your body adapts and grows stronger when you recover.
              </Text>
              <Text style={styles.insightBody}>{RECOVERY_WHY_INSIGHT}</Text>
            </View>
          </View>
        </View>
      ) : null}

      <RecoveryWhyBenefitSheet ref={sheetRef} />
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
    marginBottom: spacing.md,
  },
  expander: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    backgroundColor: surface.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  expanderText: {
    flex: 1,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  expanded: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  intro: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  insight: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: surface.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(34,211,238,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  insightCopy: { flex: 1, gap: 4 },
  insightTitle: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  insightBody: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
});
