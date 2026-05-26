import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { colors, spacing } from "@/theme";
import { markOAuthStateHandled, wasRecentlyHandled } from "@/lib/oauthGuard";

/**
 * Fallback OAuth callback screen.
 *
 * The primary OAuth flow uses `WebBrowser.openAuthSessionAsync` (in
 * `app/(tabs)/settings.tsx`), which captures the redirect inside the in-app
 * browser session and never triggers a real deep link. However, on some
 * Android browsers (notably when the user dismisses the custom tab manually,
 * or when Chrome forwards the redirect to the OS instead of the calling app),
 * the OAuth provider's redirect arrives as an `elysia://oauth/<provider>`
 * deep link. This route handles that case so that users do not land on the
 * "Unmatched Route" screen.
 */
export default function OAuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    provider?: string;
    code?: string;
    state?: string;
  }>();
  const exchangeWhoop = useAction(api.integrations.exchangeWhoopCode);
  const exchangeFitbit = useAction(api.integrations.exchangeFitbitCode);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const provider = String(params.provider ?? "").toLowerCase();
      const code = typeof params.code === "string" ? params.code : null;
      const state = typeof params.state === "string" ? params.state : null;
      if (!code || !state) {
        if (!cancelled) router.replace("/(tabs)/settings");
        return;
      }
      // If the WebBrowser flow (settings.tsx) already handled (or is in
      // flight on) this exact nonce, skip the duplicate exchange.
      if (wasRecentlyHandled(state)) {
        if (!cancelled) router.replace("/(tabs)/settings");
        return;
      }
      markOAuthStateHandled(state);
      try {
        if (provider === "whoop") {
          await exchangeWhoop({ code, state });
        } else if (provider === "fitbit") {
          await exchangeFitbit({ code, state });
        }
      } catch {}
      if (!cancelled) router.replace("/(tabs)/settings");
    })();
    return () => {
      cancelled = true;
    };
  }, [params.provider, params.code, params.state, router, exchangeWhoop, exchangeFitbit]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.text}>Finishing connection…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  text: {
    color: colors.textPrimary,
    fontSize: 16,
  },
});
