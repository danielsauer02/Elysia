import React, { useState, useMemo } from "react";
import {
  FlatList,
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
import { CategoryWheelPicker } from "@/components/ui/CategoryWheelPicker";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useHabits } from "@/context/HabitsContext";
import { mockCatalogItems, CATALOG_CATEGORIES } from "@/mocks/data";

const OFFER_LABEL: Record<string, string> = { affiliate: "Partner offer", internal: "Elysia", partner: "Partner service" };
const OFFER_COLOR: Record<string, string> = { affiliate: "#A78BFA", internal: colors.accent, partner: "#34D399" };
const RECOMMENDED_IDS = new Set(["ca000001-0000-0000-0000-000000000001", "ca000002-0000-0000-0000-000000000002", "ca000003-0000-0000-0000-000000000003"]);

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ item, isTracked, onTrack }: { item: CatalogItem; isTracked: boolean; onTrack: () => void }) {
  const catColor = categoryColors[item.category] ?? colors.accent;
  const offerColor = OFFER_COLOR[item.offerType] ?? colors.textSecondary;
  const isTrackable = item.category === "supplements" || item.offerType === "affiliate";

  return (
    <View style={styles.productCard}>
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
        {RECOMMENDED_IDS.has(item.itemId) && (
          <View style={styles.recBadge}>
            <Ionicons name="sparkles" size={10} color={colors.accent} />
            <Text style={styles.recBadgeLabel}>Recommended</Text>
          </View>
        )}
      </View>

      <Text style={styles.productTitle}>{item.title}</Text>
      <Text style={styles.productBenefit}>{item.benefitDescription}</Text>

      <View style={styles.rationaleBox}>
        <Ionicons name="information-circle-outline" size={13} color={colors.textTertiary} />
        <Text style={styles.rationaleText}>{item.rationale}</Text>
      </View>

      <View style={styles.productFooter}>
        <View>
          <Text style={styles.pricingLabel}>Pricing</Text>
          <Text style={styles.pricingValue}>{item.pricingSummary}</Text>
        </View>
        <TouchableOpacity style={styles.ctaBtn} onPress={() => Linking.openURL(item.ctaUrl)} activeOpacity={0.8}>
          <Text style={styles.ctaBtnLabel}>View offer</Text>
          <Ionicons name="arrow-forward" size={12} color="#0C0F1A" />
        </TouchableOpacity>
      </View>

      {isTrackable && (
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProductsScreen() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const { addSupplementHabit, isProductTracked } = useHabits();

  const filtered = useMemo(() => {
    if (selectedCategory === "All") return mockCatalogItems;
    return mockCatalogItems.filter(
      (i) => i.category === selectedCategory.toLowerCase().replace(/ /g, "_")
    );
  }, [selectedCategory]);

  const handleTrack = (item: CatalogItem) => {
    if (isProductTracked(item.itemId)) return;
    addSupplementHabit(item.title, item.category, item.itemId);
    Alert.alert("Habit added", `"Take ${item.title}" added to your active habits.`, [{ text: "OK" }]);
  };

  const renderItem = ({ item }: { item: CatalogItem }) => (
    <ProductCard
      item={item}
      isTracked={isProductTracked(item.itemId)}
      onTrack={() => handleTrack(item)}
    />
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Products</Text>
        <Text style={styles.pageSub}>Curated for your longevity goals</Text>
      </View>

      {/* Vertical category wheel */}
      <CategoryWheelPicker
        categories={CATALOG_CATEGORIES}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />

      {/* Product cards fill remaining space */}
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.itemId}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={renderItem}
        ListFooterComponent={
          <Card variant="accent" style={styles.partnerCta}>
            <View style={styles.partnerCtaInner}>
              <Ionicons name="business-outline" size={20} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.partnerCtaTitle}>In-app purchasing · Phase 2</Text>
                <Text style={styles.partnerCtaText}>
                  Direct ordering, recurring supplement delivery, and partner service booking launch in Phase 2.
                </Text>
              </View>
            </View>
          </Card>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No products in this category yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  pageHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  pageTitle: { fontSize: 26, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.5 },
  pageSub: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  listContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 110 },
  productCard: { backgroundColor: colors.card, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  productTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, flexWrap: "wrap" },
  productIcon: { width: 42, height: 42, borderRadius: radii.md, alignItems: "center", justifyContent: "center" },
  productBadges: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" },
  offerTag: { borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 3 },
  offerTagLabel: { fontSize: 11, fontWeight: "600" },
  recBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.accentMuted, borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 3 },
  recBadgeLabel: { fontSize: 10, fontWeight: "700", color: colors.accent },
  productTitle: { fontSize: 17, fontWeight: "700", color: colors.textPrimary, letterSpacing: -0.2 },
  productBenefit: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  rationaleBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.md },
  rationaleText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  productFooter: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  pricingLabel: { fontSize: 10, fontWeight: "600", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.4 },
  pricingValue: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginTop: 2 },
  ctaBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.accent, borderRadius: radii.sm, paddingVertical: 8, paddingHorizontal: 14 },
  ctaBtnLabel: { fontSize: 13, fontWeight: "700", color: "#0C0F1A" },
  trackBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.accentMuted, borderRadius: radii.md, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.accent + "30" },
  trackBtnActive: { backgroundColor: colors.successMuted, borderColor: colors.success + "40" },
  trackBtnLabel: { fontSize: 13, fontWeight: "600", color: colors.accent },
  emptyWrap: { alignItems: "center", paddingVertical: 40 },
  emptyText: { fontSize: 14, color: colors.textSecondary },
  partnerCta: { marginTop: spacing.md },
  partnerCtaInner: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  partnerCtaTitle: { fontSize: 14, fontWeight: "700", color: colors.accent },
  partnerCtaText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginTop: 4 },
});
