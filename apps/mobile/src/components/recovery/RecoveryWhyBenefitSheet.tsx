/**
 * RecoveryWhyBenefitSheet
 *
 * Near-fullscreen detail sheet for one recovery benefit. Opens from the orbit
 * hero. The whole sheet scrolls inside a BottomSheetScrollView; the "Got it"
 * button sits at the end of the content with generous bottom padding so it
 * clears the device nav bar. Dismiss via "Got it" or swipe down.
 */
import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetModal as BottomSheetModalType,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RecoveryBenefit } from "./recoveryWhyContent";
import {
  borderTokens,
  brand,
  colors,
  dataColors,
  fontFamily,
  radii,
  spacing,
  surface,
} from "@/theme";

export interface RecoveryWhyBenefitSheetHandle {
  present: (benefit: RecoveryBenefit) => void;
  dismiss: () => void;
}

export const RecoveryWhyBenefitSheet = forwardRef<RecoveryWhyBenefitSheetHandle>(
  function RecoveryWhyBenefitSheet(_, ref) {
    const sheetRef = useRef<BottomSheetModalType>(null);
    const insets = useSafeAreaInsets();
    const [benefit, setBenefit] = useState<RecoveryBenefit | null>(null);
    const snapPoints = useMemo(() => ["95%"], []);

    useImperativeHandle(
      ref,
      (): RecoveryWhyBenefitSheetHandle => ({
        present: (b) => {
          setBenefit(b);
          sheetRef.current?.present();
        },
        dismiss: () => sheetRef.current?.dismiss(),
      }),
      []
    );

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        topInset={insets.top}
        enablePanDownToClose
        backdropComponent={(p) => (
          <BottomSheetBackdrop {...p} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} />
        )}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.handle}
      >
        {benefit ? (
          <BottomSheetScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scroll,
              { paddingBottom: insets.bottom + spacing.xxxl },
            ]}
          >
            <View style={styles.vizWrap}>
              <Image source={benefit.image} style={styles.viz} resizeMode="contain" />
              <LinearGradient
                colors={["transparent", surface.card]}
                locations={[0.55, 1]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
            </View>

            <Text style={styles.title}>{benefit.label}</Text>
            <Text style={styles.lead}>{benefit.sheetBody}</Text>

            <View style={styles.facts}>
              {benefit.facts.map((f, i) => (
                <View key={i} style={styles.factRow}>
                  <View style={styles.factIcon}>
                    <Ionicons name={f.icon as never} size={17} color="#FFFFFF" />
                  </View>
                  <View style={styles.factBody}>
                    <Text style={styles.factText}>{f.text}</Text>
                    <Text style={styles.factSource}>{f.source}</Text>
                  </View>
                </View>
              ))}
            </View>

            <Pressable
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
              onPress={() => sheetRef.current?.dismiss()}
            >
              <LinearGradient
                colors={[dataColors.sleep.gradient[0], brand.primary]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.ctaGrad}
              >
                <Text style={styles.ctaLabel}>Got it</Text>
              </LinearGradient>
            </Pressable>
          </BottomSheetScrollView>
        ) : null}
      </BottomSheetModal>
    );
  }
);

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: surface.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
  },
  handle: { backgroundColor: borderTokens.strong, width: 40 },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  vizWrap: {
    height: 196,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: "#06080F",
    marginBottom: spacing.md,
  },
  viz: { width: "100%", height: "100%" },
  title: {
    fontFamily: fontFamily.heading,
    fontSize: 24,
    color: colors.textPrimary,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  lead: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  facts: { gap: spacing.sm },
  factRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: surface.raised,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    padding: spacing.md,
  },
  factIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  factBody: { flex: 1, gap: 4 },
  factText: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textPrimary,
  },
  factSource: {
    fontFamily: fontFamily.body,
    fontSize: 10,
    color: colors.textTertiary,
    textAlign: "right",
    fontStyle: "italic",
  },
  cta: { borderRadius: radii.lg, overflow: "hidden", marginTop: spacing.xl },
  ctaPressed: { opacity: 0.92 },
  ctaGrad: {
    paddingVertical: spacing.md,
    alignItems: "center",
    borderRadius: radii.lg,
  },
  ctaLabel: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
});
