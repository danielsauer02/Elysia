/**
 * ProtocolTemplateCard — Bevel-style stack card for a single protocol
 * template in the Elysia library. Layout (top → bottom):
 *
 *   ┌──────────────────────────────────────────┐
 *   │ [icon badge]  Category eyebrow           │
 *   │ Title (1–2 lines, bold)                  │
 *   │ Short explanation (2 lines, secondary)   │
 *   │ ─────────────────────────────────────────│
 *   │ Sparkle benefit row (1 line)             │
 *   │ ─────────────────────────────────────────│
 *   │ [Schedule pill] · [Refs pill]   [Add ▸]  │
 *   └──────────────────────────────────────────┘
 *
 * A lock overlay (full-card scrim + chip) is applied when the user's tier
 * doesn't satisfy `template.premiumTierRequired`.
 */
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ProtocolTemplate } from "@elysia/domain";
import {
  borderTokens,
  brand,
  categoryColors,
  categoryIcons,
  radii,
  semantic,
  spacing,
  surface,
  text,
  typography,
} from "@/theme";

interface ProtocolTemplateCardProps {
  template: ProtocolTemplate;
  isLocked: boolean;
  isAdded: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function ProtocolTemplateCard({
  template,
  isLocked,
  isAdded,
  onPress,
  style,
}: ProtocolTemplateCardProps) {
  const catColor = categoryColors[template.category] ?? brand.primary;
  const catIcon =
    (categoryIcons[template.category] as
      | keyof typeof Ionicons.glyphMap
      | undefined) ?? "leaf-outline";

  const schedule = formatSchedule(template);

  return (
    <Pressable
      onPress={onPress}
      disabled={isLocked}
      style={({ pressed }) => [
        styles.card,
        style,
        pressed && !isLocked && { opacity: 0.92, transform: [{ scale: 0.995 }] },
      ]}
    >
      {/* Top row: icon badge + category eyebrow + premium tag */}
      <View style={styles.topRow}>
        <View
          style={[
            styles.iconBadge,
            {
              backgroundColor: hexToRgba(catColor, 0.18),
              borderColor: hexToRgba(catColor, 0.40),
            },
          ]}
        >
          <Ionicons name={catIcon} size={18} color={catColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: catColor }]}>
            {humanise(template.category)}
          </Text>
          {template.premiumTierRequired !== "free" && (
            <Text style={styles.premiumTag}>PRO</Text>
          )}
        </View>
        {isAdded && (
          <View style={styles.addedDot}>
            <Ionicons name="checkmark" size={11} color={semantic.success} />
          </View>
        )}
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {template.title}
      </Text>
      <Text style={styles.sub} numberOfLines={2}>
        {template.shortExplanation}
      </Text>

      <View style={styles.divider} />

      <View style={styles.benefitRow}>
        <Ionicons name="sparkles" size={12} color={semantic.success} />
        <Text style={styles.benefitText} numberOfLines={2}>
          {template.expectedBenefit}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <View style={styles.metaPill}>
            <Ionicons
              name="time-outline"
              size={11}
              color={text.tertiary}
            />
            <Text style={styles.metaPillText}>{schedule}</Text>
          </View>
          {template.references.length > 0 && (
            <View style={styles.metaPill}>
              <Ionicons
                name="document-text-outline"
                size={11}
                color={text.tertiary}
              />
              <Text style={styles.metaPillText}>
                {template.references.length} ref
                {template.references.length === 1 ? "" : "s"}
              </Text>
            </View>
          )}
        </View>
        {isAdded ? (
          <View style={[styles.cta, styles.ctaAdded]}>
            <Ionicons
              name="checkmark-circle"
              size={14}
              color={semantic.success}
            />
            <Text style={[styles.ctaLabel, { color: semantic.success }]}>
              Added
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.cta,
              { backgroundColor: hexToRgba(catColor, 0.18) },
            ]}
          >
            <Ionicons name="add" size={15} color={catColor} />
            <Text style={[styles.ctaLabel, { color: catColor }]}>Add</Text>
          </View>
        )}
      </View>

      {isLocked && (
        <View pointerEvents="none" style={styles.lockScrim}>
          <View style={styles.lockChip}>
            <Ionicons
              name="lock-closed"
              size={11}
              color={text.tertiary}
            />
            <Text style={styles.lockChipText}>Pro — upgrade to unlock</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

function humanise(category: string): string {
  return category.replace(/_/g, " ").toUpperCase();
}

function formatSchedule(template: ProtocolTemplate): string {
  const f = template.defaultSchedule?.frequencyPerWeek;
  if (!f) return "Flexible";
  if (f >= 7) return "Daily";
  if (f === 1) return "Weekly";
  return `${f}× / week`;
}

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-fA-F0-9]{6})$/.exec(hex.trim());
  if (!m) return hex;
  const num = parseInt(m[1]!, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  card: {
    position: "relative",
    backgroundColor: surface.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    padding: spacing.lg,
    gap: spacing.sm,
    overflow: "hidden",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 2,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    ...typography.eyebrow,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  premiumTag: {
    ...typography.micro,
    color: "#A78BFA",
    letterSpacing: 0.8,
    marginTop: 1,
  },
  addedDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: hexToRgba(semantic.success, 0.18),
    borderWidth: 1,
    borderColor: hexToRgba(semantic.success, 0.4),
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...typography.title3,
    color: text.primary,
    fontSize: 17,
  },
  sub: {
    ...typography.callout,
    color: text.secondary,
    lineHeight: 19,
  },
  divider: {
    height: 1,
    backgroundColor: borderTokens.hairline,
    marginVertical: 2,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  benefitText: {
    flex: 1,
    ...typography.subhead,
    color: semantic.success,
    lineHeight: 18,
    fontSize: 12,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: surface.raised,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
  },
  metaPillText: {
    ...typography.micro,
    color: text.tertiary,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  ctaAdded: {
    backgroundColor: hexToRgba(semantic.success, 0.15),
  },
  ctaLabel: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: "700",
  },
  lockScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  lockChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: surface.raised,
    borderWidth: 1,
    borderColor: borderTokens.strong,
  },
  lockChipText: {
    ...typography.caption,
    color: text.tertiary,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
});
