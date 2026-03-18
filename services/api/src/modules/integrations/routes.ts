import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { withResponseEnvelope } from "../../plugins/response.js";
import { supabaseAdmin } from "../../lib/supabase.js";

// ─── Whoop API constants ──────────────────────────────────────────────────────
const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const WHOOP_API_BASE = "https://api.prod.whoop.com/developer/v1";
const WHOOP_SCOPES = [
  "read:profile",
  "read:recovery",
  "read:sleep",
  "read:body_measurement",
  "read:cycles",
  "offline",
].join(" ");

// ─── Oura API constants ───────────────────────────────────────────────────────
const OURA_API_BASE = "https://api.ouraring.com/v2";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function refreshWhoopToken(userId: string): Promise<string | null> {
  const { data: conn } = await supabaseAdmin
    .from("wearable_connections")
    .select("refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("provider", "whoop")
    .eq("is_active", true)
    .maybeSingle();

  if (!conn?.refresh_token) return null;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: conn.refresh_token,
    client_id: process.env.WHOOP_CLIENT_ID ?? "",
    client_secret: process.env.WHOOP_CLIENT_SECRET ?? "",
  });

  const res = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) return null;

  const tokens = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  await supabaseAdmin.from("wearable_connections").upsert({
    user_id: userId,
    provider: "whoop",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    is_active: true,
    last_synced_at: new Date().toISOString(),
  });

  return tokens.access_token;
}

async function getWhoopToken(userId: string): Promise<string | null> {
  const { data: conn } = await supabaseAdmin
    .from("wearable_connections")
    .select("access_token, expires_at")
    .eq("user_id", userId)
    .eq("provider", "whoop")
    .eq("is_active", true)
    .maybeSingle();

  if (!conn) return null;

  const expiresAt = conn.expires_at ? new Date(conn.expires_at as string) : null;
  const isExpired = expiresAt ? expiresAt < new Date(Date.now() + 60_000) : false;

  if (isExpired) return refreshWhoopToken(userId);
  return (conn.access_token as string) ?? null;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export const registerIntegrationRoutes = async (
  app: FastifyInstance
): Promise<void> => {

  // ── GET /integrations/sources ─────────────────────────────────────────────
  // Returns all connected providers for the authenticated user.
  app.get(
    "/integrations/sources",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const { data, error } = await supabaseAdmin
        .from("wearable_connections")
        .select("provider, is_active, last_synced_at")
        .eq("user_id", request.userId);

      if (error) {
        return reply.code(500).send({ ok: false, error: error.message });
      }

      const connectedProviders = new Map(
        (data ?? []).map((c) => [c.provider, c])
      );

      const allProviders = ["whoop", "oura", "garmin", "apple_health"];
      const sources = allProviders.map((p) => ({
        provider: p,
        status: connectedProviders.has(p)
          ? connectedProviders.get(p)?.is_active
            ? "connected"
            : "disconnected"
          : "disconnected",
        lastSyncedAt: connectedProviders.get(p)?.last_synced_at ?? null,
      }));

      withResponseEnvelope(request, reply, { sources });
    }
  );

  // ── GET /integrations/whoop/authorize-url ─────────────────────────────────
  // Returns the URL for the user to authorise Whoop in the mobile browser.
  app.get(
    "/integrations/whoop/authorize-url",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const clientId = process.env.WHOOP_CLIENT_ID;
      const redirectUri = process.env.WHOOP_REDIRECT_URI;

      if (!clientId || !redirectUri) {
        return reply.code(501).send({
          ok: false,
          error:
            "Whoop OAuth not configured. Set WHOOP_CLIENT_ID and WHOOP_REDIRECT_URI in the API environment.",
        });
      }

      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: WHOOP_SCOPES,
        state: request.userId,
      });

      withResponseEnvelope(request, reply, {
        url: `${WHOOP_AUTH_URL}?${params.toString()}`,
      });
    }
  );

  // ── POST /integrations/whoop/callback ─────────────────────────────────────
  // Body: { code: string }
  // Exchanges auth code for tokens and stores them.
  app.post(
    "/integrations/whoop/callback",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const schema = z.object({ code: z.string().min(1) });
      const { code } = schema.parse(request.body);

      const clientId = process.env.WHOOP_CLIENT_ID;
      const clientSecret = process.env.WHOOP_CLIENT_SECRET;
      const redirectUri = process.env.WHOOP_REDIRECT_URI;

      if (!clientId || !clientSecret || !redirectUri) {
        return reply.code(501).send({
          ok: false,
          error: "Whoop OAuth credentials not configured on the server.",
        });
      }

      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      });

      const tokenRes = await fetch(WHOOP_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        return reply.code(400).send({ ok: false, error: `Whoop token exchange failed: ${err}` });
      }

      const tokens = (await tokenRes.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
      };

      await supabaseAdmin.from("wearable_connections").upsert({
        user_id: request.userId,
        provider: "whoop",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        is_active: true,
        last_synced_at: new Date().toISOString(),
      });

      withResponseEnvelope(request, reply, { connected: true, provider: "whoop" });
    }
  );

  // ── GET /integrations/whoop/data ─────────────────────────────────────────
  // Fetches the latest recovery, sleep, and cycle data from Whoop.
  app.get(
    "/integrations/whoop/data",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const token = await getWhoopToken(request.userId);
      if (!token) {
        return reply.code(401).send({
          ok: false,
          error: "Whoop not connected. Please authorise Whoop first.",
        });
      }

      const headers = { Authorization: `Bearer ${token}` };

      const [recoveryRes, sleepRes, cycleRes] = await Promise.allSettled([
        fetch(`${WHOOP_API_BASE}/recovery?limit=1`, { headers }),
        fetch(`${WHOOP_API_BASE}/sleep?limit=1`, { headers }),
        fetch(`${WHOOP_API_BASE}/cycle?limit=1`, { headers }),
      ]);

      const recovery =
        recoveryRes.status === "fulfilled" && recoveryRes.value.ok
          ? await recoveryRes.value.json()
          : null;

      const sleep =
        sleepRes.status === "fulfilled" && sleepRes.value.ok
          ? await sleepRes.value.json()
          : null;

      const cycle =
        cycleRes.status === "fulfilled" && cycleRes.value.ok
          ? await cycleRes.value.json()
          : null;

      // Update last synced timestamp
      await supabaseAdmin
        .from("wearable_connections")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("user_id", request.userId)
        .eq("provider", "whoop");

      withResponseEnvelope(request, reply, { recovery, sleep, cycle });
    }
  );

  // ── POST /integrations/oura/connect ──────────────────────────────────────
  // Body: { personalAccessToken: string }
  // Validates and stores the Oura personal access token.
  app.post(
    "/integrations/oura/connect",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const schema = z.object({ personalAccessToken: z.string().min(10) });
      const { personalAccessToken } = schema.parse(request.body);

      // Validate the token by fetching the user's profile
      const testRes = await fetch(`${OURA_API_BASE}/usercollection/personal_info`, {
        headers: { Authorization: `Bearer ${personalAccessToken}` },
      });

      if (!testRes.ok) {
        return reply.code(400).send({
          ok: false,
          error: "Invalid Oura Personal Access Token. Please check and try again.",
        });
      }

      await supabaseAdmin.from("wearable_connections").upsert({
        user_id: request.userId,
        provider: "oura",
        access_token: personalAccessToken,
        refresh_token: null,
        expires_at: null,
        is_active: true,
        last_synced_at: new Date().toISOString(),
      });

      withResponseEnvelope(request, reply, { connected: true, provider: "oura" });
    }
  );

  // ── GET /integrations/oura/data ───────────────────────────────────────────
  // Fetches today's readiness, sleep, and activity from Oura.
  app.get(
    "/integrations/oura/data",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const { data: conn } = await supabaseAdmin
        .from("wearable_connections")
        .select("access_token")
        .eq("user_id", request.userId)
        .eq("provider", "oura")
        .eq("is_active", true)
        .maybeSingle();

      if (!conn?.access_token) {
        return reply.code(401).send({
          ok: false,
          error: "Oura not connected. Please provide a Personal Access Token.",
        });
      }

      const today = new Date().toISOString().split("T")[0]!;
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0]!;
      const token = conn.access_token as string;
      const headers = { Authorization: `Bearer ${token}` };

      const [readinessRes, sleepRes, activityRes] = await Promise.allSettled([
        fetch(`${OURA_API_BASE}/usercollection/daily_readiness?start_date=${yesterday}&end_date=${today}`, { headers }),
        fetch(`${OURA_API_BASE}/usercollection/daily_sleep?start_date=${yesterday}&end_date=${today}`, { headers }),
        fetch(`${OURA_API_BASE}/usercollection/daily_activity?start_date=${yesterday}&end_date=${today}`, { headers }),
      ]);

      const readiness =
        readinessRes.status === "fulfilled" && readinessRes.value.ok
          ? await readinessRes.value.json()
          : null;
      const sleep =
        sleepRes.status === "fulfilled" && sleepRes.value.ok
          ? await sleepRes.value.json()
          : null;
      const activity =
        activityRes.status === "fulfilled" && activityRes.value.ok
          ? await activityRes.value.json()
          : null;

      await supabaseAdmin
        .from("wearable_connections")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("user_id", request.userId)
        .eq("provider", "oura");

      withResponseEnvelope(request, reply, { readiness, sleep, activity });
    }
  );

  // ── DELETE /integrations/:provider ───────────────────────────────────────
  // Disconnects a wearable integration.
  app.delete(
    "/integrations/:provider",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const schema = z.object({
        provider: z.enum(["whoop", "oura", "garmin", "apple_health"]),
      });
      const { provider } = schema.parse(request.params);

      await supabaseAdmin
        .from("wearable_connections")
        .update({ is_active: false })
        .eq("user_id", request.userId)
        .eq("provider", provider);

      withResponseEnvelope(request, reply, { disconnected: true, provider });
    }
  );
};
