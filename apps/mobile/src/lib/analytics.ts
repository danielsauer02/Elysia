/**
 * Lightweight event analytics + crash reporting facade.
 *
 * The mobile app calls `track(event, props)` for funnel events and
 * `captureException(err)` for crashes. We deliberately keep the
 * implementation pluggable so we can swap in PostHog/Mixpanel/Sentry
 * later without rewriting call sites.
 *
 * Wiring rules:
 * - Reads provider keys from `process.env.EXPO_PUBLIC_*` so they ship
 *   only in builds that opt in.
 * - All sends are best-effort (no UI throws on network failure).
 * - In dev, falls back to console.log so engineers can see the funnel.
 *
 * To activate: set EXPO_PUBLIC_POSTHOG_KEY / EXPO_PUBLIC_SENTRY_DSN
 * in EAS secrets, then plug a real client into the `init` call.
 */

import { Platform } from "react-native";

let identifier: string | null = null;
let initialised = false;

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "";
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com";
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";

const HAS_POSTHOG = Boolean(POSTHOG_KEY);
const HAS_SENTRY = Boolean(SENTRY_DSN);

export function initAnalytics(): void {
  if (initialised) return;
  initialised = true;
  if (__DEV__) {
    console.log(
      `[analytics] init posthog=${HAS_POSTHOG} sentry=${HAS_SENTRY} platform=${Platform.OS}`
    );
  }
}

export function identify(userId: string, traits?: Record<string, unknown>): void {
  identifier = userId;
  if (__DEV__) console.log("[analytics] identify", userId, traits);
  if (HAS_POSTHOG) {
    void postHogSend({
      event: "$identify",
      distinct_id: userId,
      properties: { ...traits, $set: traits },
    });
  }
}

export function reset(): void {
  identifier = null;
}

export function track(event: string, properties: Record<string, unknown> = {}): void {
  if (__DEV__) console.log("[analytics] track", event, properties);
  if (!HAS_POSTHOG) return;
  void postHogSend({
    event,
    distinct_id: identifier ?? "anonymous",
    properties: {
      ...properties,
      platform: Platform.OS,
    },
  });
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (__DEV__) console.warn("[analytics] captureException", err, context);
  if (!HAS_SENTRY) return;
  void sentrySend(err, context);
}

async function postHogSend(payload: {
  event: string;
  distinct_id: string;
  properties: Record<string, unknown>;
}): Promise<void> {
  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        timestamp: new Date().toISOString(),
        ...payload,
      }),
    });
  } catch {
    // swallow — analytics never blocks the UI.
  }
}

async function sentrySend(err: unknown, context?: Record<string, unknown>): Promise<void> {
  try {
    const message = err instanceof Error ? err.message : String(err);
    await fetch(`${SENTRY_DSN.split("@")[0]}@${SENTRY_DSN.split("@")[1]}/api/store/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        platform: Platform.OS,
        extra: context,
        timestamp: Math.floor(Date.now() / 1000),
      }),
    });
  } catch {
    // best-effort
  }
}
