import {
  query,
  mutation,
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "./_helpers";
import {
  normalizeWhoopCycles,
  normalizeWhoopRecoveries,
  normalizeWhoopSleeps,
  normalizeWhoopWorkouts,
  normalizeOuraSleeps,
  normalizeOuraActivity,
  normalizeFitbitHeart,
  normalizeFitbitActivity,
} from "./wearableNormalizers";
import { encryptToken, decryptToken } from "./dataPrivacy";

const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const WHOOP_API_BASE = "https://api.prod.whoop.com/developer/v2";
const WHOOP_SCOPES = [
  "read:profile",
  "read:recovery",
  "read:sleep",
  "read:body_measurement",
  "read:cycles",
  "read:workout",
  "offline",
].join(" ");

const OURA_API_BASE = "https://api.ouraring.com/v2";

const FITBIT_AUTH_URL = "https://www.fitbit.com/oauth2/authorize";
const FITBIT_TOKEN_URL = "https://api.fitbit.com/oauth2/token";
const FITBIT_API_BASE = "https://api.fitbit.com/1/user/-";
const FITBIT_SCOPES = ["activity", "heartrate", "sleep", "profile"].join(" ");

// ─── Queries ──────────────────────────────────────────────────────────────────

export const getSources = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const connections = await ctx.db
      .query("wearableConnections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const connMap = new Map(connections.map((c) => [c.provider, c]));
    const allProviders = ["whoop", "oura", "fitbit", "garmin", "apple_health"];

    return allProviders.map((p) => ({
      provider: p,
      status: connMap.has(p)
        ? connMap.get(p)?.isActive
          ? "connected"
          : "disconnected"
        : "disconnected",
      lastSyncedAt: connMap.get(p)?.lastSyncedAt ?? null,
    }));
  },
});

/**
 * Creates a short-lived nonce server-side bound to the authenticated user,
 * then returns the OAuth authorize URL with the nonce embedded as `state`.
 * The unauthenticated callback action looks the user up by nonce, avoiding
 * the auth race after the external browser session.
 */
async function createOAuthNonce(
  ctx: { auth: any; db: any },
  provider: string
): Promise<string> {
  const userId = await getAuthUserId(ctx as any);
  const nonce =
    typeof crypto !== "undefined" && (crypto as any).randomUUID
      ? (crypto as any).randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  await (ctx.db as any).insert("oauthStates", {
    nonce,
    provider,
    userId,
    createdAt: Date.now(),
  });
  return nonce;
}

export const getFitbitAuthorizeUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const clientId = process.env.FITBIT_CLIENT_ID;
    const redirectUri = process.env.FITBIT_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      return { url: null, error: "Fitbit OAuth not configured" };
    }
    const nonce = await createOAuthNonce(ctx as any, "fitbit");
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: FITBIT_SCOPES,
      state: nonce,
    });
    return { url: `${FITBIT_AUTH_URL}?${params.toString()}`, error: null };
  },
});

export const getWhoopAuthorizeUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const clientId = process.env.WHOOP_CLIENT_ID;
    const redirectUri = process.env.WHOOP_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return { url: null, error: "Whoop OAuth not configured" };
    }

    const nonce = await createOAuthNonce(ctx as any, "whoop");
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: WHOOP_SCOPES,
      state: nonce,
    });

    return { url: `${WHOOP_AUTH_URL}?${params.toString()}`, error: null };
  },
});

/**
 * Internal mutation: resolve and consume a nonce → userId. Single-use.
 * Returns null if the nonce is missing, expired, or for the wrong provider.
 */
/**
 * Validate an OAuth `state` nonce and return the userId it was created for.
 *
 * Behaviour:
 * - Returns null if no row matches the nonce, the provider mismatches, or
 *   the nonce is older than NONCE_TTL_MS (hard expiry).
 * - First call marks the row as consumed and returns the userId.
 * - Subsequent calls within IDEMPOTENT_WINDOW_MS keep returning the same
 *   userId. This is intentional — Android can deliver the OAuth redirect
 *   twice (once via WebBrowser, once via the deep-link fallback in
 *   `app/oauth/[provider].tsx`), and both calls should succeed.
 * - After the idempotent window, the row is rejected; a periodic sweep
 *   removes it.
 */
export const consumeOAuthNonce = internalMutation({
  args: { nonce: v.string(), provider: v.string() },
  handler: async (ctx, { nonce, provider }) => {
    const row = await ctx.db
      .query("oauthStates")
      .withIndex("by_nonce", (q) => q.eq("nonce", nonce))
      .unique();
    if (!row) return null;
    if (row.provider !== provider) return null;

    const NONCE_TTL_MS = 30 * 60 * 1000; // 30 minutes — covers 2FA delays.
    const IDEMPOTENT_WINDOW_MS = 60 * 1000; // 60s for duplicate callbacks.
    const now = Date.now();

    if (now - row.createdAt > NONCE_TTL_MS) {
      await ctx.db.delete(row._id);
      return null;
    }

    if (row.consumedAt !== undefined) {
      // Idempotent replay within the grace window.
      if (now - row.consumedAt <= IDEMPOTENT_WINDOW_MS) {
        return row.userId;
      }
      // Truly stale duplicate — reject.
      return null;
    }

    await ctx.db.patch(row._id, { consumedAt: now });
    return row.userId;
  },
});

// ─── Internal mutations (called from actions) ────────────────────────────────

export const upsertConnection = internalMutation({
  args: {
    userId: v.string(),
    provider: v.string(),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.string()),
    isActive: v.boolean(),
    lastSyncedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("wearableConnections")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", args.userId).eq("provider", args.provider)
      )
      .unique();

    // Tokens are stored encrypted at rest via dataPrivacy.encryptToken.
    // Only encrypt + persist tokens if a new value was provided; otherwise
    // keep the previously stored ciphertext (refresh-only / sync-only calls
    // must not wipe credentials).
    const encryptedAccessToken = args.accessToken
      ? await encryptToken(args.accessToken)
      : undefined;
    const encryptedRefreshToken = args.refreshToken
      ? await encryptToken(args.refreshToken)
      : undefined;

    const baseData = {
      userId: args.userId,
      provider: args.provider,
      isActive: args.isActive,
      lastSyncedAt: args.lastSyncedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      const patchData: Record<string, unknown> = { ...baseData };
      if (encryptedAccessToken !== undefined)
        patchData.accessToken = encryptedAccessToken;
      if (encryptedRefreshToken !== undefined)
        patchData.refreshToken = encryptedRefreshToken;
      if (args.expiresAt !== undefined) patchData.expiresAt = args.expiresAt;
      await ctx.db.patch(existing._id, patchData);
      return existing._id;
    }

    return await ctx.db.insert("wearableConnections", {
      ...baseData,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      expiresAt: args.expiresAt,
    });
  },
});

/** Must be declared before actions that call it (avoids TS circular inference). */
export const getConnectionInternal = internalQuery({
  args: { userId: v.string(), provider: v.string() },
  handler: async (ctx, { userId, provider }) => {
    return await ctx.db
      .query("wearableConnections")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", userId).eq("provider", provider)
      )
      .unique();
  },
});

type DecryptedConnection = {
  _id: string;
  userId: string;
  provider: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  isActive: boolean;
  lastSyncedAt?: string;
  updatedAt?: string;
};

/**
 * Returns a connection with tokens decrypted in-memory. Used by pull actions.
 * Never expose the decrypted version to clients.
 */
export const getDecryptedConnectionInternal = internalAction({
  args: { userId: v.string(), provider: v.string() },
  handler: async (ctx, { userId, provider }): Promise<DecryptedConnection | null> => {
    const conn: DecryptedConnection | null = await ctx.runQuery(
      internal.integrations.getConnectionInternal,
      { userId, provider }
    );
    if (!conn) return null;
    return {
      ...conn,
      accessToken: conn.accessToken ? await decryptToken(conn.accessToken) : conn.accessToken,
      refreshToken: conn.refreshToken ? await decryptToken(conn.refreshToken) : conn.refreshToken,
    };
  },
});

// ─── Actions (external HTTP calls) ───────────────────────────────────────────

/**
 * Detects an OAuth duplicate-callback race by parsing the provider error body
 * and confirming an active connection already exists. Android delivers the
 * OAuth redirect twice on some browsers (once via WebBrowser, once as a real
 * deep link), and the second call burns an already-spent authorization code.
 * The first call has already stored tokens, so the second should silently
 * succeed instead of bubbling up `invalid_grant`.
 */
async function isDuplicateOAuthCallback(
  ctx: ActionLike,
  userId: string,
  provider: string,
  errBody: string
): Promise<boolean> {
  let parsed: { error?: string; status_code?: number } | null = null;
  try {
    parsed = JSON.parse(errBody) as { error?: string; status_code?: number };
  } catch {
    /* not JSON */
  }

  // Match the patterns providers emit when an authorization code is reused.
  // Whoop in particular returns either `invalid_grant` or, less helpfully,
  // a 500 with `error: "server_error"` when the same code is replayed by
  // Android's double-redirect. We treat any of these as a possible duplicate
  // and confirm via the existing-active-connection check below.
  const looksLikeDuplicate =
    parsed?.error === "invalid_grant" ||
    parsed?.error === "server_error" ||
    parsed?.status_code === 500 ||
    /already been used|already used|reused|duplicate/i.test(errBody);

  if (!looksLikeDuplicate) return false;

  // The companion callback's upsert may still be in-flight when we check.
  // Poll briefly (up to 1.5s) for the active connection before giving up.
  for (let i = 0; i < 6; i++) {
    const existing = await ctx.runQuery(
      internal.integrations.getConnectionInternal,
      { userId, provider }
    );
    if (existing?.isActive) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

export const exchangeWhoopCode = action({
  args: { code: v.string(), state: v.string() },
  handler: async (ctx, { code, state }) => {
    const userId: string | null = await ctx.runMutation(
      internal.integrations.consumeOAuthNonce,
      { nonce: state, provider: "whoop" }
    );
    if (!userId) {
      throw new Error(
        "OAuth state expired or invalid. Please retry the connection."
      );
    }
    const clientId = process.env.WHOOP_CLIENT_ID ?? "";
    const clientSecret = process.env.WHOOP_CLIENT_SECRET ?? "";
    const redirectUri = process.env.WHOOP_REDIRECT_URI ?? "";

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });

    const res = await fetch(WHOOP_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      if (await isDuplicateOAuthCallback(ctx, userId, "whoop", err)) {
        return { connected: true, provider: "whoop", deduped: true };
      }
      throw new Error(`Whoop token exchange failed: ${err}`);
    }

    const tokens = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    await ctx.runMutation(internal.integrations.upsertConnection, {
      userId,
      provider: "whoop",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(
        Date.now() + tokens.expires_in * 1000
      ).toISOString(),
      isActive: true,
      lastSyncedAt: new Date().toISOString(),
    });

    // Trigger an initial backfill so the dashboard has data immediately.
    await ctx.scheduler.runAfter(0, internal.integrations.pullWhoopInternal, {
      userId,
    });

    return { connected: true, provider: "whoop", deduped: false };
  },
});

export const fetchWhoopData = action({
  args: { daysBack: v.optional(v.number()) },
  handler: async (ctx, { daysBack }) => {
    const userId = await getAuthUserId(ctx);
    return await pullWhoopForUser(ctx, userId, daysBack);
  },
});

export const pullWhoopInternal = internalAction({
  args: { userId: v.string(), daysBack: v.optional(v.number()) },
  handler: async (ctx, { userId, daysBack }) => {
    return await pullWhoopForUser(ctx, userId, daysBack);
  },
});

/** Pull all active OAuth wearable sources, then roll up daily metrics. */
export const syncWearablesForUserInternal = internalAction({
  args: { userId: v.string(), daysBack: v.optional(v.number()) },
  handler: async (
    ctx,
    { userId, daysBack }
  ): Promise<{
    providers: string[];
    samplesInserted: number;
    samplesSkipped: number;
    daysRolledUp: number;
    diagnostics: Record<string, unknown>;
  }> => {
    const n = Math.max(1, Math.min(90, daysBack ?? 30));
    const connections = await ctx.runQuery(
      internal.integrations.getActiveConnectionsInternal,
      { userId }
    );
    const providers = connections as string[];
    let samplesInserted = 0;
    let samplesSkipped = 0;
    const diagnostics: Record<string, unknown> = {};

    for (const provider of providers) {
      try {
        if (provider === "whoop") {
          const r = await pullWhoopForUser(ctx, userId, n);
          samplesInserted += r.inserted;
          samplesSkipped += r.skipped;
          diagnostics.whoop = {
            inserted: r.inserted,
            skipped: r.skipped,
            endpoints: r.diagnostics,
          };
        } else if (provider === "oura") {
          const r = await pullOuraForUser(ctx, userId, n);
          samplesInserted += r.inserted;
          samplesSkipped += r.skipped;
          diagnostics.oura = { inserted: r.inserted, skipped: r.skipped };
        } else if (provider === "fitbit") {
          const r = await pullFitbitForUser(ctx, userId, n);
          samplesInserted += r.inserted;
          samplesSkipped += r.skipped;
          diagnostics.fitbit = { inserted: r.inserted, skipped: r.skipped };
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[syncWearables] ${provider}`, e);
        diagnostics[provider] = { error: msg };
      }
    }

    const today = new Date();
    const from = new Date(today.getTime() - (n - 1) * 86400_000)
      .toISOString()
      .slice(0, 10);
    const to = today.toISOString().slice(0, 10);
    const rollup: { daysRolledUp: number } = await ctx.runAction(
      internal.wearables.rollupSampleDaysInRange,
      { userId, from, to }
    );

    return {
      providers,
      samplesInserted,
      samplesSkipped,
      daysRolledUp: rollup.daysRolledUp,
      diagnostics,
    };
  },
});

export const getActiveConnectionsInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("wearableConnections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.filter((r) => r.isActive).map((r) => r.provider);
  },
});

export const connectOura = action({
  args: { personalAccessToken: v.string() },
  handler: async (ctx, { personalAccessToken }) => {
    const userId = await getAuthUserId(ctx);

    const testRes = await fetch(
      `${OURA_API_BASE}/usercollection/personal_info`,
      { headers: { Authorization: `Bearer ${personalAccessToken}` } }
    );

    if (!testRes.ok) {
      throw new Error("Invalid Oura Personal Access Token");
    }

    await ctx.runMutation(internal.integrations.upsertConnection, {
      userId,
      provider: "oura",
      accessToken: personalAccessToken,
      isActive: true,
      lastSyncedAt: new Date().toISOString(),
    });

    await ctx.scheduler.runAfter(0, internal.integrations.pullOuraInternal, {
      userId,
    });

    return { connected: true, provider: "oura" };
  },
});

type OuraFetchResult = {
  inserted: number;
  skipped: number;
};

export const fetchOuraData = action({
  args: {},
  handler: async (ctx): Promise<OuraFetchResult> => {
    const userId = await getAuthUserId(ctx);
    return await pullOuraForUser(ctx, userId);
  },
});

export const pullOuraInternal = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await pullOuraForUser(ctx, userId);
  },
});

// ─── Fitbit ──────────────────────────────────────────────────────────────────

export const exchangeFitbitCode = action({
  args: { code: v.string(), state: v.string() },
  handler: async (ctx, { code, state }) => {
    const userId: string | null = await ctx.runMutation(
      internal.integrations.consumeOAuthNonce,
      { nonce: state, provider: "fitbit" }
    );
    if (!userId) {
      throw new Error(
        "OAuth state expired or invalid. Please retry the connection."
      );
    }
    const clientId = process.env.FITBIT_CLIENT_ID ?? "";
    const clientSecret = process.env.FITBIT_CLIENT_SECRET ?? "";
    const redirectUri = process.env.FITBIT_REDIRECT_URI ?? "";

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
    });

    const res = await fetch(FITBIT_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      if (await isDuplicateOAuthCallback(ctx, userId, "fitbit", err)) {
        return { connected: true, provider: "fitbit", deduped: true };
      }
      throw new Error(`Fitbit token exchange failed: ${err}`);
    }

    const tokens = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    await ctx.runMutation(internal.integrations.upsertConnection, {
      userId,
      provider: "fitbit",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      isActive: true,
      lastSyncedAt: new Date().toISOString(),
    });

    await ctx.scheduler.runAfter(0, internal.integrations.pullFitbitInternal, {
      userId,
    });

    return { connected: true, provider: "fitbit", deduped: false };
  },
});

export const fetchFitbitData = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    return await pullFitbitForUser(ctx, userId);
  },
});

export const pullFitbitInternal = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await pullFitbitForUser(ctx, userId);
  },
});

// ─── Mutations ───────────────────────────────────────────────────────────────

export const disconnectProvider = mutation({
  args: {
    provider: v.string(),
  },
  handler: async (ctx, { provider }) => {
    const userId = await getAuthUserId(ctx);
    const conn = await ctx.db
      .query("wearableConnections")
      .withIndex("by_user_provider", (q) =>
        q.eq("userId", userId).eq("provider", provider)
      )
      .unique();

    if (conn) {
      await ctx.db.patch(conn._id, { isActive: false });
    }
    return { disconnected: true, provider };
  },
});

// ─── Pull helpers (shared by user-triggered and scheduled actions) ──────────

type ActionLike = {
  runQuery: (ref: any, args: any) => Promise<any>;
  runMutation: (ref: any, args: any) => Promise<any>;
  runAction?: (ref: any, args: any) => Promise<any>;
};

type WhoopPagedResponse = { records?: unknown[]; next_token?: string | null };

type EndpointDiagnostic = {
  path: string;
  records: number;
  status: number | null;
  errorBody?: string;
};

/**
 * Token bag passed by reference so a single 401 retry can refresh + share the
 * new bearer across all endpoint calls within the same pull.
 */
type WhoopAuth = {
  ctx: ActionLike;
  userId: string;
  token: string;
  refreshed?: boolean;
};

async function fetchWhoopRecords(
  path: string,
  auth: WhoopAuth,
  start: string,
  end: string
): Promise<{ records: unknown[]; diag: EndpointDiagnostic }> {
  const out: unknown[] = [];
  const diag: EndpointDiagnostic = { path, records: 0, status: null };
  let nextToken: string | null = null;
  do {
    const params = new URLSearchParams({
      start,
      end,
      limit: "25",
    });
    if (nextToken) params.set("nextToken", nextToken);
    const url = `${WHOOP_API_BASE}${path}?${params.toString()}`;
    let res = await fetch(url, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    diag.status = res.status;

    // On 401, force-refresh the token once and retry — Whoop access tokens
    // live ~1h, and the cached `expiresAt` check can be stale.
    if (res.status === 401 && !auth.refreshed) {
      const newToken = await forceRefreshWhoopToken(auth.ctx, auth.userId);
      if (newToken) {
        auth.token = newToken;
        auth.refreshed = true;
        res = await fetch(url, {
          headers: { Authorization: `Bearer ${auth.token}` },
        });
        diag.status = res.status;
      }
    }

    if (!res.ok) {
      try {
        const body = await res.text();
        diag.errorBody = body.slice(0, 240);
      } catch {
        /* ignore */
      }
      console.error(
        `[whoop] ${path} HTTP ${res.status}: ${diag.errorBody ?? "<no body>"}`
      );
      break;
    }
    const data = (await res.json()) as WhoopPagedResponse;
    if (Array.isArray(data.records)) out.push(...data.records);
    nextToken = data.next_token ?? null;
  } while (nextToken);
  diag.records = out.length;
  return { records: out, diag };
}

/**
 * Force a refresh of the Whoop access token regardless of expiresAt. Returns
 * the new plaintext access token, or null if the refresh request failed (e.g.
 * refresh token revoked → user must re-OAuth).
 */
async function forceRefreshWhoopToken(
  ctx: ActionLike,
  userId: string
): Promise<string | null> {
  const conn = await ctx.runQuery(
    internal.integrations.getConnectionInternal,
    { userId, provider: "whoop" }
  );
  if (!conn?.refreshToken) return null;
  const refreshToken = await decryptToken(conn.refreshToken);

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.WHOOP_CLIENT_ID ?? "",
    client_secret: process.env.WHOOP_CLIENT_SECRET ?? "",
    // Whoop V2 requires `scope=offline` on refresh requests to get a new
    // refresh token back. Without it the refresh succeeds once but the
    // returned tokens cannot be refreshed again.
    scope: "offline",
  });

  const res = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error(
      `[whoop] refresh failed HTTP ${res.status}: ${errBody.slice(0, 240)}`
    );
    return null;
  }

  const tokens = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  await ctx.runMutation(internal.integrations.upsertConnection, {
    userId,
    provider: "whoop",
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? refreshToken,
    expiresAt: new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString(),
    isActive: true,
    lastSyncedAt: new Date().toISOString(),
  });

  return tokens.access_token;
}

type WhoopPullResult = {
  inserted: number;
  skipped: number;
  diagnostics: EndpointDiagnostic[];
};

async function pullWhoopForUser(
  ctx: ActionLike,
  userId: string,
  daysBack = 7
): Promise<WhoopPullResult> {
  const token = await getWhoopAccessToken(ctx, userId);
  if (!token) throw new Error("Whoop not connected");

  const days = Math.max(1, Math.min(90, daysBack));
  const start = new Date(Date.now() - days * 86_400_000).toISOString();
  const end = new Date().toISOString();

  // Shared auth bag — if /recovery 401s we refresh once and reuse the new
  // token for the remaining endpoints (instead of every endpoint trying
  // to refresh independently in parallel).
  const auth: WhoopAuth = { ctx, userId, token };

  // Validate the token first with /user/profile/basic; if THAT returns 401
  // after refresh, the user needs to disconnect + reconnect (refresh token
  // revoked or scopes changed).
  const profileDiag = await validateWhoopToken(auth);

  // Run sequentially so a token refresh during /recovery propagates.
  const recovery = await fetchWhoopRecords("/recovery", auth, start, end);
  const sleep = await fetchWhoopRecords("/activity/sleep", auth, start, end);
  const workout = await fetchWhoopRecords("/activity/workout", auth, start, end);
  const cycle = await fetchWhoopRecords("/cycle", auth, start, end);

  let inserted = 0;
  let skipped = 0;

  const recoverySamples = normalizeWhoopRecoveries(
    recovery.records as Parameters<typeof normalizeWhoopRecoveries>[0]
  );
  if (recoverySamples.length > 0) {
    const r = await ctx.runMutation(
      internal.wearables.ingestSamplesForUserInternal,
      { userId, samples: recoverySamples }
    );
    inserted += r.inserted;
    skipped += r.skipped;
  }

  const sleepSamples = normalizeWhoopSleeps(
    sleep.records as Parameters<typeof normalizeWhoopSleeps>[0]
  );
  if (sleepSamples.length > 0) {
    const r = await ctx.runMutation(
      internal.wearables.ingestSamplesForUserInternal,
      { userId, samples: sleepSamples }
    );
    inserted += r.inserted;
    skipped += r.skipped;
  }

  const workouts = normalizeWhoopWorkouts(
    workout.records as Parameters<typeof normalizeWhoopWorkouts>[0]
  );
  if (workouts.length > 0) {
    const r = await ctx.runMutation(
      internal.wearables.ingestWorkoutsForUserInternal,
      { userId, workouts }
    );
    inserted += r.inserted;
    skipped += r.skipped;
  }

  const cycleSamples = normalizeWhoopCycles(
    cycle.records as Parameters<typeof normalizeWhoopCycles>[0]
  );
  if (cycleSamples.length > 0) {
    const r = await ctx.runMutation(
      internal.wearables.upsertCycleSamplesInternal,
      { userId, samples: cycleSamples }
    );
    inserted += r.inserted;
    skipped += r.skipped;
  }

  const diagnostics = [
    profileDiag,
    recovery.diag,
    sleep.diag,
    workout.diag,
    cycle.diag,
  ];

  await ctx.runMutation(internal.integrations.upsertConnection, {
    userId,
    provider: "whoop",
    isActive: true,
    lastSyncedAt: new Date().toISOString(),
  });

  return { inserted, skipped, diagnostics };
}

/**
 * Probes /user/profile/basic to verify the bearer token is accepted. Used
 * up-front so we can distinguish "token is dead" from "user has no data".
 * Records errorBody so the alert can suggest disconnect + reconnect.
 */
async function validateWhoopToken(auth: WhoopAuth): Promise<EndpointDiagnostic> {
  const diag: EndpointDiagnostic = {
    path: "/user/profile/basic",
    records: 0,
    status: null,
  };
  let res = await fetch(`${WHOOP_API_BASE}/user/profile/basic`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  diag.status = res.status;
  if (res.status === 401 && !auth.refreshed) {
    const newToken = await forceRefreshWhoopToken(auth.ctx, auth.userId);
    if (newToken) {
      auth.token = newToken;
      auth.refreshed = true;
      res = await fetch(`${WHOOP_API_BASE}/user/profile/basic`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      diag.status = res.status;
    }
  }
  if (!res.ok) {
    try {
      const body = await res.text();
      diag.errorBody = body.slice(0, 240);
    } catch {
      /* ignore */
    }
    console.error(
      `[whoop] profile probe HTTP ${res.status}: ${diag.errorBody ?? "<no body>"}`
    );
  } else {
    diag.records = 1;
  }
  return diag;
}

async function pullOuraForUser(ctx: ActionLike, userId: string, daysBack = 7) {
  const conn: { accessToken?: string } | null = await ctx.runQuery(
    internal.integrations.getConnectionInternal,
    { userId, provider: "oura" }
  );
  if (!conn?.accessToken) throw new Error("Oura not connected");
  const token = await decryptToken(conn.accessToken);
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const days = Math.max(1, Math.min(90, daysBack));
  const today = new Date().toISOString().split("T")[0]!;
  const startDate = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .split("T")[0]!;

  const [sleepRes, activityRes] = await Promise.allSettled([
    fetch(
      `${OURA_API_BASE}/usercollection/sleep?start_date=${startDate}&end_date=${today}`,
      { headers }
    ),
    fetch(
      `${OURA_API_BASE}/usercollection/daily_activity?start_date=${startDate}&end_date=${today}`,
      { headers }
    ),
  ]);

  let inserted = 0;
  let skipped = 0;

  if (sleepRes.status === "fulfilled" && sleepRes.value.ok) {
    const data = (await sleepRes.value.json()) as { data?: any[] };
    const samples = normalizeOuraSleeps(data.data ?? []);
    if (samples.length > 0) {
      const r = await ctx.runMutation(
        internal.wearables.ingestSamplesForUserInternal,
        { userId, samples }
      );
      inserted += r.inserted;
      skipped += r.skipped;
    }
  }

  if (activityRes.status === "fulfilled" && activityRes.value.ok) {
    const data = (await activityRes.value.json()) as { data?: any[] };
    const samples = normalizeOuraActivity(data.data ?? []);
    if (samples.length > 0) {
      const r = await ctx.runMutation(
        internal.wearables.ingestSamplesForUserInternal,
        { userId, samples }
      );
      inserted += r.inserted;
      skipped += r.skipped;
    }
  }

  await ctx.runMutation(internal.integrations.upsertConnection, {
    userId,
    provider: "oura",
    isActive: true,
    lastSyncedAt: new Date().toISOString(),
  });

  return { inserted, skipped };
}

async function pullFitbitForUser(ctx: ActionLike, userId: string, daysBack = 7) {
  const token = await getFitbitAccessToken(ctx, userId);
  if (!token) throw new Error("Fitbit not connected");
  const headers = { Authorization: `Bearer ${token}` };

  let inserted = 0;
  let skipped = 0;
  const days = Math.max(1, Math.min(90, daysBack));
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(today.getTime() - i * 86_400_000)
      .toISOString()
      .split("T")[0]!;

    const [hrRes, actRes] = await Promise.allSettled([
      fetch(
        `${FITBIT_API_BASE}/activities/heart/date/${date}/1d/1min.json`,
        { headers }
      ),
      fetch(`${FITBIT_API_BASE}/activities/date/${date}.json`, { headers }),
    ]);

    if (hrRes.status === "fulfilled" && hrRes.value.ok) {
      const data = (await hrRes.value.json()) as Parameters<typeof normalizeFitbitHeart>[1];
      const samples = normalizeFitbitHeart(date, data);
      if (samples.length > 0) {
        const r = await ctx.runMutation(
          internal.wearables.ingestSamplesForUserInternal,
          { userId, samples }
        );
        inserted += r.inserted;
        skipped += r.skipped;
      }
    }

    if (actRes.status === "fulfilled" && actRes.value.ok) {
      const data = (await actRes.value.json()) as Parameters<typeof normalizeFitbitActivity>[1];
      const samples = normalizeFitbitActivity(date, data);
      if (samples.length > 0) {
        const r = await ctx.runMutation(
          internal.wearables.ingestSamplesForUserInternal,
          { userId, samples }
        );
        inserted += r.inserted;
        skipped += r.skipped;
      }
    }
  }

  await ctx.runMutation(internal.integrations.upsertConnection, {
    userId,
    provider: "fitbit",
    isActive: true,
    lastSyncedAt: new Date().toISOString(),
  });

  return { inserted, skipped };
}

async function getFitbitAccessToken(ctx: ActionLike, userId: string): Promise<string | null> {
  const conn = await ctx.runQuery(internal.integrations.getConnectionInternal, {
    userId,
    provider: "fitbit",
  });
  if (!conn?.accessToken) return null;
  const accessToken = await decryptToken(conn.accessToken);
  const refreshToken = conn.refreshToken ? await decryptToken(conn.refreshToken) : null;

  const expiresAt = conn.expiresAt ? new Date(conn.expiresAt) : null;
  const isExpired = expiresAt ? expiresAt < new Date(Date.now() + 60_000) : false;
  if (!isExpired) return accessToken;
  if (!refreshToken) return null;

  const clientId = process.env.FITBIT_CLIENT_ID ?? "";
  const clientSecret = process.env.FITBIT_CLIENT_SECRET ?? "";
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(FITBIT_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: body.toString(),
  });
  if (!res.ok) return null;
  const tokens = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  await ctx.runMutation(internal.integrations.upsertConnection, {
    userId,
    provider: "fitbit",
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    isActive: true,
    lastSyncedAt: new Date().toISOString(),
  });

  return tokens.access_token;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getWhoopAccessToken(
  ctx: { runQuery: (ref: any, args: any) => Promise<any>; runMutation: (ref: any, args: any) => Promise<any> },
  userId: string
): Promise<string | null> {
  const conn = await ctx.runQuery(
    internal.integrations.getConnectionInternal,
    { userId, provider: "whoop" }
  );

  if (!conn?.accessToken) return null;

  const accessToken = await decryptToken(conn.accessToken);
  const refreshToken = conn.refreshToken ? await decryptToken(conn.refreshToken) : null;

  const expiresAt = conn.expiresAt ? new Date(conn.expiresAt) : null;
  // If we have no expiry we assume stale (force refresh). Previously we
  // returned the cached token here which caused 401s after the original
  // 1h window passed.
  const isExpired = expiresAt
    ? expiresAt < new Date(Date.now() + 60_000)
    : true;

  if (!isExpired) return accessToken;

  if (!refreshToken) return accessToken; // best effort with current token

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.WHOOP_CLIENT_ID ?? "",
    client_secret: process.env.WHOOP_CLIENT_SECRET ?? "",
    scope: "offline",
  });

  const res = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error(
      `[whoop] preflight refresh HTTP ${res.status}: ${errBody.slice(0, 240)}`
    );
    // Fall back to the cached access token — the retry-with-refresh logic
    // in fetchWhoopRecords will surface the real 401 body to the alert.
    return accessToken;
  }

  const tokens = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  await ctx.runMutation(internal.integrations.upsertConnection, {
    userId,
    provider: "whoop",
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? refreshToken,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    isActive: true,
    lastSyncedAt: new Date().toISOString(),
  });

  return tokens.access_token;
}
