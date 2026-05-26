import React, { useCallback, useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth as useClerkAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useAction, useConvex } from "convex/react";
import { api } from "@convex/_generated/api";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { colors, spacing, radii } from "@/theme";
import { Card } from "@/components/ui/Card";
import { StreakBadge } from "@/components/ui/StreakBadge";
import { useHabits } from "@/context/HabitsContext";
import { useAppContext } from "@/context/AppContext";
import { useRevenueCat } from "@/context/RevenueCatContext";
import { useWearable } from "@/context/WearableContext";
import { Platform } from "react-native";
import { mockUserSummary } from "@/mocks/data";
import { useFloatingTabBarScrollPadding } from "@/hooks/useFloatingTabBarScrollPadding";
import { useAppTopBarHeight } from "@/components/navigation/AppTopBar";
import { markOAuthStateHandled } from "@/lib/oauthGuard";
import {
  openHealthConnectPlayStore,
  openHealthConnectSettings,
  openIOSHealthSettings,
  type HealthPermissionResult,
} from "@/lib/healthkit";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}

type ConnectorOAuthStarter = (provider: "whoop" | "oura" | "fitbit") => Promise<void>;

function providerRow(
  provider: "whoop" | "oura" | "fitbit",
  label: string,
  icon: keyof typeof Ionicons.glyphMap,
  sourceMap: Map<string, { status: string; lastSyncedAt: string | null }>,
  startConnect: ConnectorOAuthStarter,
  onManageConnected?: (provider: "whoop" | "oura" | "fitbit", label: string) => void
): SettingRow {
  const s = sourceMap.get(provider);
  const connected = s?.status === "connected";
  return {
    icon,
    label,
    badge: connected
      ? s?.lastSyncedAt
        ? `Synced ${formatRelative(s.lastSyncedAt)}`
        : "Connected"
      : "Connect",
    onPress: () => {
      if (connected && onManageConnected) {
        onManageConnected(provider, label);
        return;
      }
      void startConnect(provider);
    },
  };
}

/**
 * Walks the user through Health Connect / HealthKit connection. On any failure
 * we show targeted next-step Alerts (Install, Update, Open settings, Retry)
 * instead of a generic "Permission denied" so the user is never stranded.
 */
function handleHealthPermissionResult(
  result: HealthPermissionResult,
  opts: {
    platformLabel: string;
    onRetry: () => void;
    onSyncNow: () => Promise<unknown> | void;
  }
): void {
  const { platformLabel, onRetry, onSyncNow } = opts;
  const isAndroid = Platform.OS === "android";
  const openProviderSettings = () => {
    if (isAndroid) {
      void openHealthConnectSettings();
    } else {
      void openIOSHealthSettings();
    }
  };

  if (result.ok) {
    if (result.partial) {
      Alert.alert(
        `${platformLabel} connected`,
        `Granted ${result.granted.length} of ${result.totalRequested} metrics. Some signals (e.g. HRV, VO2 Max) will be missing until you grant the rest in ${platformLabel}.`,
        [
          { text: "Later", style: "cancel" },
          { text: `Open ${platformLabel}`, onPress: openProviderSettings },
        ]
      );
    } else {
      Alert.alert(
        "Connected",
        `${platformLabel} is now syncing. The first backfill takes ~30s.`
      );
    }
    void onSyncNow();
    return;
  }

  switch (result.reason) {
    case "not_supported":
      Alert.alert(
        "Not available",
        `${platformLabel} requires a development or production build. Apple Health (iOS) and Health Connect (Android) cannot be reached from Expo Go.`
      );
      return;

    case "not_installed":
      if (isAndroid) {
        Alert.alert(
          "Install Health Connect",
          "Elysia uses Google Health Connect to read steps, heart rate, sleep and other metrics from your wearable. Install it from the Play Store to continue.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Install", onPress: () => void openHealthConnectPlayStore() },
          ]
        );
      } else {
        Alert.alert(
          "Health app missing",
          "Apple Health is not available on this device. Please install it from the App Store and try again."
        );
      }
      return;

    case "update_required":
      Alert.alert(
        "Update Health Connect",
        "Your installed version of Google Health Connect is too old. Update it from the Play Store to grant Elysia access.",
        [
          { text: "Later", style: "cancel" },
          { text: "Update", onPress: () => void openHealthConnectPlayStore() },
        ]
      );
      return;

    case "no_permissions_granted":
      Alert.alert(
        "Permissions needed",
        isAndroid
          ? "Elysia did not receive any health permissions. Tap 'Open Health Connect' to grant Elysia read access manually, or 'Try Again' to retry the system prompt."
          : "Elysia did not receive any health permissions. Tap 'Open Health' to grant access in the Health app under Sharing → Apps.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Try Again", onPress: onRetry },
          {
            text: isAndroid ? "Open Health Connect" : "Open Health",
            onPress: openProviderSettings,
          },
        ]
      );
      return;

    case "error":
    default:
      Alert.alert(
        "Connection failed",
        result.detail ?? `Could not connect to ${platformLabel}. Please try again.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Try Again", onPress: onRetry },
        ]
      );
  }
}

function useStartConnectorOAuth(): ConnectorOAuthStarter {
  const convex = useConvex();
  const exchangeWhoop = useAction(api.integrations.exchangeWhoopCode);
  const exchangeFitbit = useAction(api.integrations.exchangeFitbitCode);
  const connectOuraAction = useAction(api.integrations.connectOura);

  return React.useCallback(
    async (provider: "whoop" | "oura" | "fitbit") => {
      try {
        if (provider === "oura") {
          Alert.prompt?.(
            "Connect Oura",
            "Paste your Oura Personal Access Token (Settings -> Personal Access Tokens at cloud.ouraring.com).",
            async (token?: string) => {
              if (!token) return;
              try {
                await connectOuraAction({ personalAccessToken: token.trim() });
                Alert.alert("Connected", "Oura is now syncing.");
              } catch (e) {
                Alert.alert("Connection failed", (e as Error).message);
              }
            }
          );
          return;
        }

        const authMutation =
          provider === "whoop"
            ? api.integrations.getWhoopAuthorizeUrl
            : api.integrations.getFitbitAuthorizeUrl;
        const res = (await convex.mutation(authMutation, {})) as {
          url: string | null;
          error: string | null;
        };
        if (!res.url) {
          Alert.alert(
            "Not configured",
            res.error ?? `OAuth env vars are missing for ${provider}.`
          );
          return;
        }

        const redirectUrl = Linking.createURL(`oauth/${provider}`);
        const result = await WebBrowser.openAuthSessionAsync(res.url, redirectUrl);
        if (result.type !== "success" || !result.url) return;
        const params = new URL(result.url).searchParams;
        const code = params.get("code");
        const state = params.get("state");
        if (!code || !state) {
          Alert.alert("OAuth error", "Missing authorization code or state.");
          return;
        }
        // Pre-register the nonce so the deep-link fallback route
        // (apps/mobile/app/oauth/[provider].tsx) does NOT also exchange it.
        markOAuthStateHandled(state);
        if (provider === "whoop") {
          await exchangeWhoop({ code, state });
        } else if (provider === "fitbit") {
          await exchangeFitbit({ code, state });
        }
        Alert.alert("Connected", `${provider} is now syncing.`);
      } catch (e) {
        Alert.alert("Connection failed", (e as Error).message);
      }
    },
    [convex, exchangeWhoop, exchangeFitbit, connectOuraAction]
  );
}

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
  const router = useRouter();
  const { signOut } = useClerkAuth();
  const { resetOnboarding, onboardingData, resetTemporarySubscriptionAccess } =
    useAppContext();
  const { isProUser, presentPaywall, presentCustomerCenter } = useRevenueCat();
  const wearable = useWearable();
  const scrollPad = useFloatingTabBarScrollPadding();
  const topBarHeight = useAppTopBarHeight();
  const { habits } = useHabits();
  const sources = useQuery(api.integrations.getSources);
  const exportData = useAction(api.dataPrivacy.exportMyData);
  const deleteData = useAction(api.dataPrivacy.deleteAllMyData);
  const backfillScores = useAction(api.scoring.backfillMyHealthScores);
  const disconnectProvider = useMutation(api.integrations.disconnectProvider);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const sourceMap = useMemo(() => {
    const m = new Map<string, { status: string; lastSyncedAt: string | null }>();
    (sources ?? []).forEach((s) => m.set(s.provider, s));
    return m;
  }, [sources]);
  const startConnectorOAuth = useStartConnectorOAuth();

  const onManageConnected = useCallback(
    (provider: "whoop" | "oura" | "fitbit", providerLabel: string) => {
      Alert.alert(
        providerLabel,
        `${providerLabel} is connected. What would you like to do?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Sync now",
            onPress: () => {
              void wearable.syncNow();
            },
          },
          {
            text: "Disconnect & reconnect",
            style: "destructive",
            onPress: async () => {
              try {
                await disconnectProvider({ provider });
                await new Promise((r) => setTimeout(r, 250));
                await startConnectorOAuth(provider);
              } catch (e) {
                Alert.alert(
                  "Could not reconnect",
                  e instanceof Error ? e.message : String(e)
                );
              }
            },
          },
        ]
      );
    },
    [disconnectProvider, startConnectorOAuth, wearable]
  );
  const activeCount = habits.filter((h) => h.state === "active").length;
  const longestStreak = Math.max(0, ...habits.map((h) => h.streakCount));
  const name = onboardingData?.name ?? "Your Profile";
  const joined = "March 2026";

  const emailInfo = useQuery(api.profiles.getEmailInfo);
  const updateEmailMut = useMutation(api.profiles.updateEmail);

  const email = emailInfo?.email ?? null;
  const emailChangedAt = emailInfo?.emailChangedAt ?? null;

  const emailCooldown = useMemo(() => {
    if (!emailChangedAt) return null;
    const elapsed = Date.now() - new Date(emailChangedAt).getTime();
    if (elapsed >= SEVEN_DAYS_MS) return null;
    return Math.ceil((SEVEN_DAYS_MS - elapsed) / (24 * 60 * 60 * 1000));
  }, [emailChangedAt]);

  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  const handleEmailChange = async () => {
    if (!newEmail.trim() || !newEmail.includes("@")) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }
    try {
      await updateEmailMut({ email: newEmail.trim() });
      setEmailModalVisible(false);
      setNewEmail("");
      Alert.alert("Success", "Email updated successfully.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to update email.";
      Alert.alert("Error", msg);
    }
  };

  const maskedEmail = email
    ? email.replace(/^(.{2})(.*)(@.*)$/, (_m, a, b, c) => a + "*".repeat(b.length) + c)
    : "Not set";

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topBarHeight + spacing.md, paddingBottom: scrollPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Profile</Text>

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
                <Text style={styles.planBadgeLabel}>{isProUser ? "Pro" : "Free tier"}</Text>
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

        {!isProUser && (
          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.upgradeBanner}
            onPress={() => presentPaywall()}
          >
            <View style={styles.upgradeLeft}>
              <Ionicons name="sparkles" size={18} color={colors.accent} />
              <View>
                <Text style={styles.upgradeTitle}>Upgrade to Elysia Pro</Text>
                <Text style={styles.upgradeSub}>Unlock 100+ premium protocols, advanced analytics, priority integrations</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.accent} />
          </TouchableOpacity>
        )}

        {isProUser && (
          <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.upgradeBanner, { borderColor: colors.success + "40" }]}
            onPress={() => presentCustomerCenter()}
          >
            <View style={styles.upgradeLeft}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <View>
                <Text style={[styles.upgradeTitle, { color: colors.success }]}>Elysia Pro active</Text>
                <Text style={styles.upgradeSub}>Manage your subscription</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.success} />
          </TouchableOpacity>
        )}

        <SectionBlock
          title="Integrations"
          rows={[
            {
              icon: Platform.OS === "ios" ? "watch-outline" : "phone-portrait-outline",
              label: Platform.OS === "ios" ? "Apple Health" : "Health Connect",
              badge: !wearable.isHealthSupported
                ? "Unavailable"
                : wearable.isSyncing
                ? "Syncing..."
                : wearable.hasPermission
                ? wearable.lastSyncAt
                  ? `Synced ${formatRelative(wearable.lastSyncAt)}`
                  : "Connected"
                : "Connect",
              onPress: async () => {
                const platformLabel =
                  Platform.OS === "ios" ? "Apple Health" : "Health Connect";
                if (!wearable.isHealthSupported) {
                  handleHealthPermissionResult(
                    { ok: false, reason: "not_supported" },
                    {
                      platformLabel,
                      onRetry: () => {},
                      onSyncNow: () => undefined,
                    }
                  );
                  return;
                }
                if (wearable.hasPermission) {
                  await wearable.syncNow();
                  return;
                }
                const result = await wearable.requestPermissions();
                handleHealthPermissionResult(result, {
                  platformLabel,
                  onRetry: () => {
                    void (async () => {
                      const retry = await wearable.requestPermissions();
                      handleHealthPermissionResult(retry, {
                        platformLabel,
                        onRetry: () => {},
                        onSyncNow: () => wearable.syncNow(),
                      });
                    })();
                  },
                  onSyncNow: () => wearable.syncNow(),
                });
              },
            },
            providerRow(
              "oura",
              "Oura Ring",
              "ellipse-outline",
              sourceMap,
              startConnectorOAuth,
              onManageConnected
            ),
            providerRow(
              "whoop",
              "Whoop",
              "heart-circle-outline",
              sourceMap,
              startConnectorOAuth,
              onManageConnected
            ),
            providerRow(
              "fitbit",
              "Fitbit",
              "fitness-outline",
              sourceMap,
              startConnectorOAuth,
              onManageConnected
            ),
            { icon: "fitness-outline", label: "Garmin", badge: "Soon", onPress: () => {} },
          ]}
        />

        <SectionBlock
          title="Account"
          rows={[
            { icon: "person-outline", label: "Edit profile", onPress: () => {} },
            {
              icon: "mail-outline",
              label: "Email",
              value: emailCooldown
                ? `Change in ${emailCooldown}d`
                : maskedEmail,
              onPress: emailCooldown
                ? () => Alert.alert(
                    "Email change restricted",
                    `Only allowed to change account settings every 7 days. Wait ${emailCooldown} day${emailCooldown === 1 ? "" : "s"}.`,
                  )
                : () => { setNewEmail(email ?? ""); setEmailModalVisible(true); },
            },
            { icon: "notifications-outline", label: "Notifications", onPress: () => {} },
            {
              icon: "download-outline",
              label: "Export my data",
              onPress: async () => {
                try {
                  const data = await exportData({});
                  Alert.alert(
                    "Export ready",
                    `Your data dump (${JSON.stringify(data).length.toLocaleString()} bytes) was generated. We'll add file/email delivery in a follow-up.`
                  );
                } catch (e) {
                  Alert.alert("Export failed", (e as Error).message);
                }
              },
            },
            {
              icon: "trash-outline",
              label: "Delete all my data",
              danger: true,
              onPress: () => {
                Alert.alert(
                  "Delete everything",
                  "Wipes all habits, food, wearable, analytics and insights. This cannot be undone.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          const res = await deleteData({});
                          Alert.alert("Deleted", `Removed ${res.deletedRows} rows.`);
                        } catch (e) {
                          Alert.alert("Delete failed", (e as Error).message);
                        }
                      },
                    },
                  ]
                );
              },
            },
            {
              icon: "card-outline",
              label: "Subscription",
              value: isProUser ? "Pro" : "Free",
              onPress: isProUser ? () => presentCustomerCenter() : () => presentPaywall(),
            },
            {
              icon: "log-out-outline",
              label: "Sign out",
              danger: true,
              onPress: () => {
                Alert.alert("Sign out", "You will need to sign in again to use Elysia.", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Sign out",
                    style: "destructive",
                    onPress: async () => {
                      resetTemporarySubscriptionAccess();
                      await signOut();
                      router.replace("/(auth)/login");
                    },
                  },
                ]);
              },
            },
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
            {
              icon: "trending-up-outline",
              label: isBackfilling ? "Backfilling…" : "Backfill 90-day Elysia scores",
              onPress: async () => {
                if (isBackfilling) return;
                setIsBackfilling(true);
                try {
                  const r = await backfillScores({ days: 90 });
                  const syncLine = r.wearableSync
                    ? `\n\nSynced ${r.wearableSync.providers.join(", ") || "no providers"}: ${r.wearableSync.samplesInserted} new samples, ${r.wearableSync.daysRolledUp} days rolled up.`
                    : "";

                  // Whoop diagnostics: if any endpoint returned a non-2xx, show
                  // the HTTP status + first 200 chars of body so we can debug
                  // missing scopes, expired tokens etc. from the device alert.
                  let diagLine = "";
                  const whoopDiag = (
                    r.wearableSync?.diagnostics as
                      | { whoop?: { endpoints?: Array<{ path: string; status: number | null; records: number; errorBody?: string }>; } }
                      | undefined
                  )?.whoop;
                  if (whoopDiag?.endpoints) {
                    const issues = whoopDiag.endpoints.filter(
                      (e) => e.status === null || e.status < 200 || e.status >= 300
                    );
                    if (issues.length > 0) {
                      const all401 = issues.every((e) => e.status === 401);
                      const summary = all401
                        ? "Whoop rejected the access token after a refresh attempt. Disconnect Whoop below and reconnect — make sure to grant ALL permissions on the consent screen."
                        : "Whoop API errors:";
                      diagLine =
                        "\n\n" +
                        summary +
                        "\n" +
                        issues
                          .map(
                            (e) =>
                              `• ${e.path} → ${e.status ?? "no response"}: ${e.errorBody ?? "(empty)"}`
                          )
                          .join("\n");
                    } else {
                      diagLine =
                        "\n\nWhoop endpoints OK:\n" +
                        whoopDiag.endpoints
                          .map((e) => `• ${e.path}: ${e.records} records`)
                          .join("\n");
                    }
                  }

                  const statusLine =
                    r.baselineStatus === "ready"
                      ? `Aging Engine ready (${r.daysCalibrated} days with wearable data in the last 14). ${r.trajectoryWritten} trajectory points written.`
                      : r.daysCalibrated === 0
                      ? `No wearable data in the last 14 days yet. Connect Whoop or Health Connect, wait ~1 min, then run backfill again. Scores were still re-computed for ${r.recomputed} days using defaults.`
                      : `Calibrating: ${r.daysCalibrated}/14 days with wearable data in the last 14. The trajectory unlocks at 14.`;
                  Alert.alert(
                    "Backfill complete",
                    `Re-scored ${r.recomputed} days.${syncLine}${diagLine}\n\n${statusLine}`
                  );
                } catch (e: unknown) {
                  Alert.alert("Backfill failed", e instanceof Error ? e.message : "Unknown error");
                } finally {
                  setIsBackfilling(false);
                }
              },
            },
          ]}
        />
      </ScrollView>

      <Modal
        visible={emailModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setEmailModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEmailModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Change email</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="New email address"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={newEmail}
              onChangeText={setNewEmail}
            />
            <View style={styles.modalButtons}>
              <Pressable style={styles.modalCancel} onPress={() => setEmailModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSave} onPress={handleEmailChange}>
                <Text style={styles.modalSaveText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl },
  pageTitle: { fontSize: 26, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.5 },
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
  upgradeBanner: { backgroundColor: colors.accentMuted, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.accent + "40", padding: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  upgradeLeft: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, flex: 1 },
  upgradeTitle: { fontSize: 15, fontWeight: "700", color: colors.accent },
  upgradeSub: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, marginTop: 2, maxWidth: 240 },
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
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "center", alignItems: "center", padding: spacing.xxl },
  modalContent: { backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.xxl, width: "100%", maxWidth: 360, gap: spacing.lg },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  modalInput: { backgroundColor: colors.surface, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontSize: 15, color: colors.textPrimary },
  modalButtons: { flexDirection: "row", gap: spacing.md, justifyContent: "flex-end" },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: radii.sm },
  modalCancelText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  modalSave: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: radii.sm, backgroundColor: colors.accent },
  modalSaveText: { fontSize: 14, fontWeight: "600", color: "#000" },
});
