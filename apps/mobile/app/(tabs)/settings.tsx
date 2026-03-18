import React from "react";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radii } from "@/theme";
import { Card } from "@/components/ui/Card";
import { StreakBadge } from "@/components/ui/StreakBadge";
import { useHabits } from "@/context/HabitsContext";
import { useAppContext } from "@/context/AppContext";
import { mockUserSummary } from "@/mocks/data";

interface SettingRow {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  badge?: string;
  danger?: boolean;
  onPress?: () => void;
}

function SettingsRow({ icon, label, value, badge, danger, onPress }: SettingRow) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
      style={styles.row}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Ionicons name={icon} size={16} color={danger ? colors.destructive : colors.accent} />
      </View>
      <Text style={[styles.rowLabel, danger && { color: colors.destructive }]}>{label}</Text>
      <View style={styles.rowRight}>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {onPress && !value && !badge ? (
          <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function SectionBlock({ title, rows }: { title: string; rows: SettingRow[] }) {
  return (
    <View style={styles.sectionWrap}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Card padded={false} style={styles.sectionCard}>
        {rows.map((row, i) => (
          <React.Fragment key={row.label}>
            <SettingsRow {...row} />
            {i < rows.length - 1 && <View style={styles.divider} />}
          </React.Fragment>
        ))}
      </Card>
    </View>
  );
}

export default function SettingsScreen() {
  const { resetOnboarding, onboardingData } = useAppContext();
  const { habits } = useHabits();
  const activeCount = habits.filter((h) => h.state === "active").length;
  const longestStreak = Math.max(0, ...habits.map((h) => h.streakCount));
  const name = onboardingData?.name ?? "Your Profile";
  const joined = "March 2026";

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Profile</Text>

        {/* Profile card */}
        <Card variant="elevated" style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.onlineRing} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{name}</Text>
            <View style={styles.planRow}>
              <View style={styles.planBadge}>
                <Ionicons name="sparkles" size={10} color={colors.accent} />
                <Text style={styles.planBadgeLabel}>Free tier</Text>
              </View>
              <Text style={styles.joinedText}>Member since {joined}</Text>
            </View>
            <View style={styles.profileStats}>
              <View style={styles.profileStat}>
                <Text style={styles.profileStatValue}>{activeCount}</Text>
                <Text style={styles.profileStatLabel}>Active habits</Text>
              </View>
              <View style={styles.profileStatDivider} />
              <View style={styles.profileStat}>
                <Text style={styles.profileStatValue}>{mockUserSummary.longevityScore}</Text>
                <Text style={styles.profileStatLabel}>Longevity score</Text>
              </View>
              <View style={styles.profileStatDivider} />
              <View style={styles.profileStat}>
                <StreakBadge count={longestStreak} showZero large />
              </View>
            </View>
          </View>
        </Card>

        {/* Upgrade banner */}
        <TouchableOpacity activeOpacity={0.88} style={styles.upgradeBanner}>
          <View style={styles.upgradeLeft}>
            <Ionicons name="sparkles" size={18} color={colors.accent} />
            <View>
              <Text style={styles.upgradeTitle}>Upgrade to Elysia Pro</Text>
              <Text style={styles.upgradeSub}>Unlock 100+ premium protocols, advanced analytics, priority integrations</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.accent} />
        </TouchableOpacity>

        <SectionBlock
          title="Integrations"
          rows={[
            { icon: "watch-outline", label: "Apple Watch", badge: "Connect", onPress: () => {} },
            { icon: "ellipse-outline", label: "Oura Ring", badge: "Connect", onPress: () => {} },
            { icon: "heart-circle-outline", label: "Whoop", badge: "Connect", onPress: () => {} },
            { icon: "fitness-outline", label: "Garmin", badge: "Connect", onPress: () => {} },
          ]}
        />

        <SectionBlock
          title="Account"
          rows={[
            { icon: "person-outline", label: "Edit profile", onPress: () => {} },
            { icon: "notifications-outline", label: "Notifications", onPress: () => {} },
            { icon: "lock-closed-outline", label: "Privacy & data", onPress: () => {} },
            { icon: "card-outline", label: "Subscription", value: "Free", onPress: () => {} },
          ]}
        />

        <SectionBlock
          title="App"
          rows={[
            { icon: "star-outline", label: "Rate Elysia", onPress: () => {} },
            { icon: "chatbubble-outline", label: "Send feedback", onPress: () => {} },
            { icon: "document-text-outline", label: "Terms & Privacy", onPress: () => {} },
            { icon: "information-circle-outline", label: "App version", value: "0.1.0 (MVP)" },
          ]}
        />

        <SectionBlock
          title="Developer"
          rows={[
            {
              icon: "refresh-outline",
              label: "Reset onboarding",
              onPress: () => {
                Alert.alert("Reset onboarding", "This will return you to the welcome screen.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Reset", style: "destructive", onPress: resetOnboarding },
                ]);
              },
            },
          ]}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: 48 },
  pageTitle: { fontSize: 26, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.5 },
  // Profile card
  profileCard: { gap: spacing.lg },
  avatarWrap: { position: "relative", alignSelf: "flex-start" },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  onlineRing: { position: "absolute", bottom: 1, right: 1, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.success, borderWidth: 2, borderColor: colors.card },
  avatarText: { fontSize: 28, fontWeight: "700", color: "#0C0F1A" },
  profileInfo: { gap: spacing.sm },
  profileName: { fontSize: 22, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.3 },
  planRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  planBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.accentMuted, borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 3 },
  planBadgeLabel: { fontSize: 11, fontWeight: "700", color: colors.accent },
  joinedText: { fontSize: 12, color: colors.textTertiary },
  profileStats: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: 4 },
  profileStat: { alignItems: "flex-start" },
  profileStatValue: { fontSize: 20, fontWeight: "800", color: colors.textPrimary },
  profileStatLabel: { fontSize: 10, color: colors.textTertiary, marginTop: 1 },
  profileStatDivider: { width: 1, height: 28, backgroundColor: colors.border },
  // Upgrade banner
  upgradeBanner: { backgroundColor: colors.accentMuted, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.accent + "40", padding: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  upgradeLeft: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, flex: 1 },
  upgradeTitle: { fontSize: 15, fontWeight: "700", color: colors.accent },
  upgradeSub: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginTop: 2, maxWidth: 240 },
  // Section
  sectionWrap: { gap: 6 },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.8, paddingLeft: 4 },
  sectionCard: {},
  row: { flexDirection: "row", alignItems: "center", padding: spacing.lg, gap: spacing.md },
  rowIcon: { width: 32, height: 32, borderRadius: radii.sm, backgroundColor: colors.accentMuted, alignItems: "center", justifyContent: "center" },
  rowIconDanger: { backgroundColor: colors.destructiveMuted },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: "500", color: colors.textPrimary },
  rowRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowValue: { fontSize: 14, color: colors.textSecondary },
  badge: { backgroundColor: colors.surface, borderRadius: radii.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.border },
  badgeText: { fontSize: 11, fontWeight: "600", color: colors.accent },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 64 },
});
