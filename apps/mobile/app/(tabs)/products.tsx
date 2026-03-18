import React, { useState, useMemo } from "react";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { CatalogItem } from "@elysia/domain";
import { colors, spacing, radii, categoryColors } from "@/theme";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CategoryChips } from "@/components/ui/CategoryChips";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useHabits } from "@/context/HabitsContext";
import { mockCatalogItems, CATALOG_CATEGORIES } from "@/mocks/data";

const OFFER_LABEL: Record<string, string> = {
  affiliate: "Partner offer",
  internal: "Elysia",
  partner: "Partner service",
};

const OFFER_COLOR: Record<string, string> = {
  affiliate: "#A78BFA",
  internal: colors.accent,
  partner: "#34D399",
};

const RECOMMENDED_IDS = ["ca000001-0000-0000-0000-000000000001", "ca000002-0000-0000-0000-000000000002", "ca000003-0000-0000-0000-000000000003"];

// ─── Product Card ────────────────────────────────────────────────────────────

function ProductCard({ item, isTracked, onTrack }: { item: CatalogItem; isTracked: boolean; onTrack: () => void }) {
  const catColor = categoryColors[item.category] ?? colors.accent;
  const offerColor = OFFER_COLOR[item.offerType] ?? colors.textSecondary;
  const isSupplementOrRecurring = item.category === "supplements" || item.offerType === "affiliate";

  return (
    <View style={styles.productCard}>
      {/* Top row */}
      <View style={styles.productTop}>
        <View style={[styles.productIcon, { backgroundColor: catColor + "18" }]}>
          <Ionicons name="cube-outline" size={20} color={catColor} />
        </View>
        <View style={styles.productBadges}>
          <Badge label={item.category.replace(/_/g, " ")} category={item.category} size="sm" />
          <View style={[styles.offerTag, { backgroundColor: offerColor + "18" }]}>
            <Text style={[styles.offerTagLabel, { color: offerColor }]}>{OFFER_LABEL[item.offerType]}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.productTitle}>{item.title}</Text>
      <Text style={styles.productBenefit}>{item.benefitDescription}</Text>

      <View style={styles.rationaleBox}>
        <Ionicons name="information-circle-outline" size={13} color={colors.textTertiary} />
        <Text style={styles.rationaleText}>{item.rationale}</Text>
      </View>

      {item.alternatives.length > 0 && (
        <Text style={styles.altText}>
          <Text style={styles.altLabel}>Alternatives: </Text>
          {item.alternatives.join(" · ")}
        </Text>
      )}

      {/* Footer: pricing + CTA */}
      <View style={styles.productFooter}>
        <View>
          <Text style={styles.pricingLabel}>Pricing</Text>
          <Text style={styles.pricingValue}>{item.pricingSummary}</Text>
        </View>
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => Linking.openURL(item.ctaUrl)}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaBtnLabel}>View offer</Text>
          <Ionicons name="arrow-forward" size={12} color="#0C0F1A" />
        </TouchableOpacity>
      </View>

      {/* Track as supplement habit */}
      {isSupplementOrRecurring && (
        <TouchableOpacity
          style={[styles.trackBtn, isTracked && styles.trackBtnActive]}
          onPress={onTrack}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isTracked ? "checkmark-circle" : "add-circle-outline"}
            size={15}
            color={isTracked ? colors.success : colors.accent}
          />
          <Text style={[styles.trackBtnLabel, isTracked && { color: colors.success }]}>
            {isTracked ? "Tracked as daily habit" : "Track as daily habit"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ProductsScreen() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const { addSupplementHabit, isProductTracked } = useHabits();

  const filtered = useMemo(() => {
    if (selectedCategory === "All") return mockCatalogItems;
    return mockCatalogItems.filter(
      (i) => i.category === selectedCategory.toLowerCase().replace(/ /g, "_")
    );
  }, [selectedCategory]);

  const recommended = filtered.filter((i) => RECOMMENDED_IDS.includes(i.itemId));
  const rest = filtered.filter((i) => !RECOMMENDED_IDS.includes(i.itemId));

  const handleTrack = (item: CatalogItem) => {
    if (isProductTracked(item.itemId)) return;
    addSupplementHabit(item.title, item.category, item.itemId);
    Alert.alert(
      "Habit added",
      `"Take ${item.title}" has been added to your active habits in the Tracker.`,
      [{ text: "OK" }]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Products</Text>
          <Text style={styles.pageSub}>Curated offers aligned with your longevity goals</Text>
        </View>
      </View>

      <CategoryChips
        categories={CATALOG_CATEGORIES.map((c) => c.replace(/_/g, " "))}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Recommended */}
        {recommended.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Recommended for you"
              subtitle="Based on your goals and active habits"
            />
            {recommended.map((item) => (
              <ProductCard
                key={item.itemId}
                item={item}
                isTracked={isProductTracked(item.itemId)}
                onTrack={() => handleTrack(item)}
              />
            ))}
          </View>
        )}

        {/* Rest */}
        {rest.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="All products" />
            {rest.map((item) => (
              <ProductCard
                key={item.itemId}
                item={item}
                isTracked={isProductTracked(item.itemId)}
                onTrack={() => handleTrack(item)}
              />
            ))}
          </View>
        )}

        {filtered.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No products in this category yet.</Text>
          </View>
        )}

        {/* Partner CTA */}
        <Card variant="accent" style={styles.partnerCta}>
          <View style={styles.partnerCtaInner}>
            <Ionicons name="business-outline" size={22} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.partnerCtaTitle}>In-app purchasing · Coming in Phase 2</Text>
              <Text style={styles.partnerCtaText}>
                Direct ordering, recurring supplement delivery, and booking of partner services will launch in Phase 2.
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  pageHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md },
  pageTitle: { fontSize: 26, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.5 },
  pageSub: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.xxl, paddingBottom: 48 },
  section: { gap: spacing.md },
  productCard: { backgroundColor: colors.card, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md, overflow: "hidden" },
  productTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  productIcon: { width: 42, height: 42, borderRadius: radii.md, alignItems: "center", justifyContent: "center" },
  productBadges: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" },
  offerTag: { borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 3 },
  offerTagLabel: { fontSize: 11, fontWeight: "600" },
  productTitle: { fontSize: 17, fontWeight: "700", color: colors.textPrimary, letterSpacing: -0.2 },
  productBenefit: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  rationaleBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.md },
  rationaleText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  altText: { fontSize: 12, color: colors.textTertiary, lineHeight: 17 },
  altLabel: { fontWeight: "600" },
  productFooter: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  pricingLabel: { fontSize: 10, fontWeight: "600", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.4 },
  pricingValue: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginTop: 2 },
  ctaBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.accent, borderRadius: radii.sm, paddingVertical: 8, paddingHorizontal: 14 },
  ctaBtnLabel: { fontSize: 13, fontWeight: "700", color: "#0C0F1A" },
  trackBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.accentMuted, borderRadius: radii.md, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.accent + "30" },
  trackBtnActive: { backgroundColor: colors.successMuted, borderColor: colors.success + "40" },
  trackBtnLabel: { fontSize: 13, fontWeight: "600", color: colors.accent },
  emptyWrap: { alignItems: "center", paddingVertical: spacing.xxxl },
  emptyText: { fontSize: 14, color: colors.textSecondary },
  partnerCta: {},
  partnerCtaInner: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  partnerCtaTitle: { fontSize: 14, fontWeight: "700", color: colors.accent },
  partnerCtaText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginTop: 4 },
});
