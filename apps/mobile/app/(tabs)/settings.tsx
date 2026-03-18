import React, { useState, useCallback } from "react";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { colors, spacing, radii } from "@/theme";
import { Card } from "@/components/ui/Card";
import { StreakBadge } from "@/components/ui/StreakBadge";
import { useHabits } from "@/context/HabitsContext";
import { useAppContext } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { mockUserSummary } from "@/mocks/data";

// ─── API helper ───────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:4000";

async function apiRequest<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `API error ${res.status}`);
  }

  const body = (await res.json()) as { data: T };
  return body.data;
}

// ─── Wearable integration types ───────────────────────────────────────────────

interface WearableSource {
  provider: string;
  status: "connected" | "disconnected";
  lastSyncedAt: string | null;
}

// ─── Oura PAT modal ───────────────────────────────────────────────────────────

function OuraConnectModal({
  visible,
  onClose,
  onConnected,
}: {
  visible: boolean;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!token.trim()) {
      setError("Please enter your Personal Access Token.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await apiRequest("/integrations/oura/connect", {
        method: "POST",
        body: JSON.stringify({ personalAccessToken: token.trim() }),
      });
      onConnected();
      onClose();
      setToken("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.modalSheet}>
          <View style={styles.dragHandle} />

          <View style={styles.modalProviderRow}>
            <View style={[styles.providerIcon, { backgroundColor: "#6366F118" }]}>
              <Ionicons name="ellipse-outline" size={22} color="#6366F1" />
            </View>
            <View>
              <Text style={styles.modalTitle}>Connect Oura Ring</Text>
              <Text style={styles.modalSub}>Enter your Personal Access Token</Text>
            </View>
          </View>

          <View style={styles.patInstructions}>
            <Text style={styles.patStep}>
              1. Open{" "}
              <Text style={styles.patLink}>cloud.ouraring.com</Text>
            </Text>
            <Text style={styles.patStep}>
              2. Go to{" "}
              <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
                Personal Access Tokens
              </Text>
            </Text>
            <Text style={styles.patStep}>3. Create a new token and paste it below</Text>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={15} color="#F87171" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.inputLabel}>Personal Access Token</Text>
          <View style={styles.patInputWrap}>
            <TextInput
              style={styles.patInput}
              value={token}
              onChangeText={setToken}
              placeholder="Paste your Oura PAT here"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={[styles.connectBtn, loading && { opacity: 0.6 }]}
            onPress={handleConnect}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0C0F1A" size="small" />
            ) : (
              <Text style={styles.connectBtnText}>Connect Oura</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Single integration row ───────────────────────────────────────────────────

const PROVIDER_META: Record<
  string,
  {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    description: string;
    authType: "oauth" | "pat" | "native";
  }
> = {
  whoop: {
    label: "Whoop",
    icon: "heart-circle-outline",
    color: "#F87171",
    description: "Recovery, HRV, sleep stages",
    authType: "oauth",
  },
  oura: {
    label: "Oura Ring",
    icon: "ellipse-outline",
    color: "#6366F1",
    description: "Readiness, sleep, activity",
    authType: "pat",
  },
  apple_health: {
    label: "Apple Health",
    icon: "heart-outline",
    color: "#EC4899",
    description: "Steps, heart rate, sleep",
    authType: "native",
  },
  garmin: {
    label: "Garmin",
    icon: "watch-outline",
    color: "#22D3EE",
    description: "GPS, VO₂ max, stress",
    authType: "oauth",
  },
};

function IntegrationRow({
  source,
  onConnect,
  onDisconnect,
}: {
  source: WearableSource;
  onConnect: (provider: string) => void;
  onDisconnect: (provider: string) => void;
}) {
  const meta = PROVIDER_META[source.provider];
  if (!meta) return null;
  const isConnected = source.status === "connected";

  return (
    <View style={styles.integrationRow}>
      <View style={[styles.providerIcon, { backgroundColor: meta.color + "18" }]}>
        <Ionicons name={meta.icon} size={20} color={meta.color} />
      </View>
      <View style={styles.integrationBody}>
        <Text style={styles.integrationName}>{meta.label}</Text>
        <Text style={styles.integrationDesc}>
          {isConnected && source.lastSyncedAt
            ? `Synced ${new Date(source.lastSyncedAt).toLocaleDateString()}`
            : meta.description}
        </Text>
      </View>
      {isConnected ? (
        <View style={styles.connectedBadge}>
          <View style={styles.connectedDot} />
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                `Disconnect ${meta.label}?`,
                "Your historical data will remain but new data will not sync.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Disconnect",
                    style: "destructive",
                    onPress: () => onDisconnect(source.provider),
                  },
                ]
              );
            }}
          >
            <Text style={styles.connectedText}>Connected</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.connectTag}
          onPress={() => onConnect(source.provider)}
        >
          <Text style={styles.connectTagText}>Connect</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Integrations section ─────────────────────────────────────────────────────

function IntegrationsSection() {
  const qc = useQueryClient();
  const [ouraModalOpen, setOuraModalOpen] = useState(false);

  const { data: sourcesData, isLoading } = useQuery({
    queryKey: ["wearable_sources"],
    queryFn: () =>
      apiRequest<{ sources: WearableSource[] }>("/integrations/sources"),
  });

  const disconnectMutation = useMutation({
    mutationFn: (provider: string) =>
      apiRequest(`/integrations/${provider}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wearable_sources"] }),
  });

  const handleConnect = useCallback(
    async (provider: string) => {
      if (provider === "oura") {
        setOuraModalOpen(true);
        return;
      }

      if (provider === "apple_health") {
        Alert.alert(
          "Apple Health",
          "Apple Health data is read automatically when you run an EAS development build on a real iPhone. No additional setup needed.",
          [{ text: "Got it" }]
        );
        return;
      }

      if (provider === "garmin") {
        Alert.alert(
          "Garmin",
          "Garmin integration requires a commercial API approval. This is planned for a future release.",
          [{ text: "OK" }]
        );
        return;
      }

      if (provider === "whoop") {
        try {
          const { url } = await apiRequest<{ url: string }>(
            "/integrations/whoop/authorize-url"
          );

          const result = await WebBrowser.openAuthSessionAsync(
            url,
            "elysia://oauth/whoop"
          );

          if (result.type === "success") {
            const urlObj = new URL(result.url);
            const code = urlObj.searchParams.get("code");
            if (code) {
              await apiRequest("/integrations/whoop/callback", {
                method: "POST",
                body: JSON.stringify({ code }),
              });
              qc.invalidateQueries({ queryKey: ["wearable_sources"] });
              Alert.alert("Whoop connected!", "Your recovery and sleep data will now sync.");
            }
          }
        } catch (e) {
          Alert.alert(
            "Connection failed",
            (e as Error).message.includes("not configured")
              ? "Whoop OAuth credentials are not yet configured on the server. Add WHOOP_CLIENT_ID and WHOOP_CLIENT_SECRET to services/api/.env"
              : (e as Error).message
          );
        }
      }
    },
    [qc]
  );

  const defaultSources: WearableSource[] = [
    { provider: "whoop", status: "disconnected", lastSyncedAt: null },
    { provider: "oura", status: "disconnected", lastSyncedAt: null },
    { provider: "apple_health", status: "disconnected", lastSyncedAt: null },
    { provider: "garmin", status: "disconnected", lastSyncedAt: null },
  ];

  const sources = sourcesData?.sources ?? defaultSources;

  return (
    <>
      <View style={styles.sectionWrap}>
        <Text style={styles.sectionTitle}>Wearable Integrations</Text>
        <Card padded={false} style={styles.sectionCard}>
          {isLoading ? (
            <View style={styles.integrationsLoading}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text style={styles.integrationsLoadingText}>Loading connections…</Text>
            </View>
          ) : (
            sources.map((source, i) => (
              <React.Fragment key={source.provider}>
                <IntegrationRow
                  source={source}
                  onConnect={handleConnect}
                  onDisconnect={(p) => disconnectMutation.mutate(p)}
                />
                {i < sources.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))
          )}
        </Card>
        <Text style={styles.integrationsNote}>
          Tap "Connect" to link your device. Data syncs automatically.
        </Text>
      </View>

      <OuraConnectModal
        visible={ouraModalOpen}
        onClose={() => setOuraModalOpen(false)}
        onConnected={() => qc.invalidateQueries({ queryKey: ["wearable_sources"] })}
      />
    </>
  );
}

// ─── Generic settings rows ────────────────────────────────────────────────────

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

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { resetOnboarding, onboardingData } = useAppContext();
  const { user, signOut } = useAuth();
  const { habits } = useHabits();
  const router = useRouter();

  const activeCount = habits.filter((h) => h.state === "active").length;
  const longestStreak = Math.max(0, ...habits.map((h) => h.streakCount));
  const name = onboardingData?.name ?? user?.email?.split("@")[0] ?? "You";
  const email = user?.email ?? "";
  const joined = new Date(user?.created_at ?? Date.now()).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const handleSignOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

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
            <Text style={styles.profileEmail}>{email}</Text>
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
              <Text style={styles.upgradeSub}>
                Unlock 100+ premium protocols, advanced analytics, priority integrations
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.accent} />
        </TouchableOpacity>

        {/* ── Wearable Integrations (fully functional) ── */}
        <IntegrationsSection />

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
            { icon: "information-circle-outline", label: "App version", value: "0.1.0" },
          ]}
        />

        <SectionBlock
          title="Developer"
          rows={[
            {
              icon: "refresh-outline",
              label: "Reset onboarding",
              onPress: () => {
                Alert.alert(
                  "Reset onboarding",
                  "This will clear your profile and return you to the welcome screen.",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Reset", style: "destructive", onPress: resetOnboarding },
                  ]
                );
              },
            },
          ]}
        />

        <SectionBlock
          title="Session"
          rows={[
            {
              icon: "log-out-outline",
              label: "Sign out",
              danger: true,
              onPress: handleSignOut,
            },
          ]}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: 110 },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  // Profile card
  profileCard: { alignItems: "center", gap: spacing.lg },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentMuted,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 30, fontWeight: "800", color: colors.accent },
  onlineRing: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.card,
  },
  profileInfo: { alignItems: "center", gap: spacing.sm, width: "100%" },
  profileName: { fontSize: 20, fontWeight: "800", color: colors.textPrimary },
  profileEmail: { fontSize: 12, color: colors.textTertiary },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  planBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.accentMuted,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  planBadgeLabel: { fontSize: 11, fontWeight: "700", color: colors.accent },
  joinedText: { fontSize: 11, color: colors.textTertiary },
  profileStats: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    width: "100%",
  },
  profileStat: { flex: 1, alignItems: "center", gap: 2 },
  profileStatValue: { fontSize: 18, fontWeight: "800", color: colors.textPrimary },
  profileStatLabel: { fontSize: 10, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.3 },
  profileStatDivider: { width: 1, height: 30, backgroundColor: colors.border },
  // Upgrade banner
  upgradeBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.accentMuted,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.accent + "40",
    padding: spacing.lg,
  },
  upgradeLeft: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, flex: 1 },
  upgradeTitle: { fontSize: 14, fontWeight: "700", color: colors.accent },
  upgradeSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  // Section blocks
  sectionWrap: { gap: spacing.sm },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingHorizontal: spacing.sm,
  },
  sectionCard: {},
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
  // Settings rows
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconDanger: { backgroundColor: colors.destructive + "15" },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: "500", color: colors.textPrimary },
  rowRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowValue: { fontSize: 13, color: colors.textTertiary },
  badge: {
    backgroundColor: colors.accentMuted,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 11, fontWeight: "700", color: colors.accent },
  // Integrations
  integrationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  providerIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  integrationBody: { flex: 1, gap: 2 },
  integrationName: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  integrationDesc: { fontSize: 11, color: colors.textTertiary },
  connectedBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  connectedDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.success,
  },
  connectedText: { fontSize: 12, fontWeight: "600", color: colors.success },
  connectTag: {
    backgroundColor: colors.accentMuted,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.accent + "40",
  },
  connectTagText: { fontSize: 11, fontWeight: "700", color: colors.accent },
  integrationsLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  integrationsLoadingText: { fontSize: 13, color: colors.textSecondary },
  integrationsNote: {
    fontSize: 11,
    color: colors.textTertiary,
    paddingHorizontal: spacing.sm,
    lineHeight: 16,
  },
  // Oura modal
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    paddingBottom: Platform.OS === "ios" ? 44 : spacing.xl,
    gap: spacing.lg,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.borderStrong,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  modalProviderRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  modalTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  modalSub: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  patInstructions: { gap: spacing.xs },
  patStep: { fontSize: 13, color: colors.textSecondary },
  patLink: { color: colors.accent, fontWeight: "600" },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "rgba(248,113,113,0.1)",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.3)",
    padding: spacing.sm,
  },
  errorText: { fontSize: 12, color: "#F87171", flex: 1 },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  patInputWrap: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 48,
    justifyContent: "center",
  },
  patInput: { fontSize: 14, color: colors.textPrimary },
  connectBtn: {
    height: 50,
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  connectBtnText: { fontSize: 15, fontWeight: "700", color: "#0C0F1A" },
});
