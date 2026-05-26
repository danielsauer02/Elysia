/**
 * GDPR-style data privacy operations:
 *  - exportMyData: returns the user's full record across every table.
 *  - deleteAllMyData: hard-deletes all user-owned rows (idempotent).
 *
 * Plus token-encryption helpers used by integration actions to encrypt
 * OAuth secrets at rest (`wearableConnections.accessToken/refreshToken`).
 * Encryption uses AES-GCM with a key from `TOKEN_ENCRYPTION_KEY`
 * (base64, 32 bytes). When the env var is unset we fall back to plaintext
 * for dev convenience.
 */

import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "./_helpers";

// ─── Encryption helpers ──────────────────────────────────────────────────────

const ENC_PREFIX = "enc_v1:";

function getKeyMaterial(): Uint8Array | null {
  const b64 = process.env.TOKEN_ENCRYPTION_KEY;
  if (!b64) return null;
  try {
    const raw = atob(b64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    if (out.length !== 32) return null;
    return out;
  } catch {
    return null;
  }
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  // Slice to detach from any underlying SharedArrayBuffer / view offset.
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function encryptToken(plaintext: string): Promise<string> {
  if (!plaintext) return plaintext;
  if (plaintext.startsWith(ENC_PREFIX)) return plaintext;
  const keyBytes = getKeyMaterial();
  if (!keyBytes) return plaintext;
  const subtle = (globalThis.crypto as Crypto | undefined)?.subtle;
  if (!subtle) return plaintext;
  const key = await subtle.importKey(
    "raw",
    asArrayBuffer(keyBytes),
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const iv = (globalThis.crypto as Crypto).getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(plaintext);
  const ct = new Uint8Array(
    await subtle.encrypt({ name: "AES-GCM", iv: asArrayBuffer(iv) }, key, asArrayBuffer(enc))
  );
  const combined = new Uint8Array(iv.length + ct.length);
  combined.set(iv, 0);
  combined.set(ct, iv.length);
  return ENC_PREFIX + bytesToBase64(combined);
}

export async function decryptToken(value: string): Promise<string> {
  if (!value || !value.startsWith(ENC_PREFIX)) return value;
  const keyBytes = getKeyMaterial();
  if (!keyBytes) return value;
  const subtle = (globalThis.crypto as Crypto | undefined)?.subtle;
  if (!subtle) return value;
  try {
    const combined = base64ToBytes(value.slice(ENC_PREFIX.length));
    const iv = combined.slice(0, 12);
    const ct = combined.slice(12);
    const key = await subtle.importKey(
      "raw",
      asArrayBuffer(keyBytes),
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    const pt = new Uint8Array(
      await subtle.decrypt({ name: "AES-GCM", iv: asArrayBuffer(iv) }, key, asArrayBuffer(ct))
    );
    return new TextDecoder().decode(pt);
  } catch {
    return value;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ─── Export ──────────────────────────────────────────────────────────────────

export const exportMyData = action({
  args: {},
  handler: async (ctx): Promise<Record<string, unknown>> => {
    const userId = await getAuthUserId(ctx);
    return (await ctx.runQuery(internal.dataPrivacy.collectUserDataInternal, {
      userId,
    })) as Record<string, unknown>;
  },
});

export const collectUserDataInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", userId))
      .unique();

    const [
      habits,
      habitCompletions,
      nutritionGoals,
      foodLog,
      weightLog,
      wearableConnections,
      wearableSamples,
      wearableWorkouts,
      wearableDailyMetrics,
      wearableSyncState,
      energyBalanceDaily,
      insights,
      recipes,
      mealTemplates,
      foodPhotos,
    ] = await Promise.all([
      ctx.db.query("habits").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db
        .query("habitCompletions")
        .withIndex("by_user_date", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("nutritionGoals")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db.query("foodLog").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("weightLog").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db
        .query("wearableConnections")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      // Sample tables can be large; cap at most recent 5000 to keep export under HTTP body size.
      ctx.db
        .query("wearableSamples")
        .withIndex("by_user_metric_time", (q) => q.eq("userId", userId))
        .order("desc")
        .take(5000),
      ctx.db
        .query("wearableWorkouts")
        .withIndex("by_user_time", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("wearableDailyMetrics")
        .withIndex("by_user_day", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("wearableSyncState")
        .withIndex("by_user_source_metric", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("energyBalanceDaily")
        .withIndex("by_user_day", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db.query("insights").withIndex("by_user_day", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("recipes").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db
        .query("mealTemplates")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db.query("foodPhotos").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ]);

    // Strip OAuth tokens before export (security best practice).
    const sanitizedConnections = wearableConnections.map((c) => ({
      ...c,
      accessToken: undefined,
      refreshToken: undefined,
    }));

    return {
      exportedAt: new Date().toISOString(),
      userId,
      profile,
      habits,
      habitCompletions,
      nutritionGoals,
      foodLog,
      weightLog,
      wearableConnections: sanitizedConnections,
      wearableSamples,
      wearableWorkouts,
      wearableDailyMetrics,
      wearableSyncState,
      energyBalanceDaily,
      insights,
      recipes,
      mealTemplates,
      foodPhotos,
    };
  },
});

// ─── Delete ──────────────────────────────────────────────────────────────────

export const deleteAllMyData = action({
  args: {},
  handler: async (ctx): Promise<{ deletedRows: number }> => {
    const userId = await getAuthUserId(ctx);
    return (await ctx.runMutation(internal.dataPrivacy.deleteUserDataInternal, {
      userId,
    })) as { deletedRows: number };
  },
});

export const deleteUserDataInternal = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    let deleted = 0;

    // Helper to delete by index for performance.
    const purge = async <T extends { _id: any }>(rows: T[]) => {
      for (const r of rows) {
        await ctx.db.delete(r._id);
        deleted++;
      }
    };

    await purge(
      await ctx.db.query("habits").withIndex("by_user", (q) => q.eq("userId", userId)).collect()
    );
    await purge(
      await ctx.db
        .query("habitCompletions")
        .withIndex("by_user_date", (q) => q.eq("userId", userId))
        .collect()
    );
    await purge(
      await ctx.db
        .query("nutritionGoals")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
    );
    await purge(
      await ctx.db.query("foodLog").withIndex("by_user", (q) => q.eq("userId", userId)).collect()
    );
    await purge(
      await ctx.db
        .query("weightLog")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
    );
    await purge(
      await ctx.db
        .query("wearableConnections")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
    );
    await purge(
      await ctx.db
        .query("wearableSamples")
        .withIndex("by_user_metric_time", (q) => q.eq("userId", userId))
        .collect()
    );
    await purge(
      await ctx.db
        .query("wearableWorkouts")
        .withIndex("by_user_time", (q) => q.eq("userId", userId))
        .collect()
    );
    await purge(
      await ctx.db
        .query("wearableDailyMetrics")
        .withIndex("by_user_day", (q) => q.eq("userId", userId))
        .collect()
    );
    await purge(
      await ctx.db
        .query("wearableSyncState")
        .withIndex("by_user_source_metric", (q) => q.eq("userId", userId))
        .collect()
    );
    await purge(
      await ctx.db
        .query("wearableSourceDevices")
        .withIndex("by_user_day_metric", (q) => q.eq("userId", userId))
        .collect()
    );
    await purge(
      await ctx.db
        .query("energyBalanceDaily")
        .withIndex("by_user_day", (q) => q.eq("userId", userId))
        .collect()
    );
    await purge(
      await ctx.db.query("insights").withIndex("by_user_day", (q) => q.eq("userId", userId)).collect()
    );
    await purge(
      await ctx.db.query("recipes").withIndex("by_user", (q) => q.eq("userId", userId)).collect()
    );
    await purge(
      await ctx.db
        .query("mealTemplates")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
    );
    await purge(
      await ctx.db.query("foodPhotos").withIndex("by_user", (q) => q.eq("userId", userId)).collect()
    );

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_clerk_user", (q) => q.eq("clerkUserId", userId))
      .unique();
    if (profile) {
      await ctx.db.delete(profile._id);
      deleted++;
    }

    return { deletedRows: deleted };
  },
});

// Convenience for the AI usage table (separate index name).
export const purgeAiUsage = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const all = await ctx.db
      .query("aiUsageDaily")
      .withIndex("by_user_day_feature", (q) => q.eq("userId", userId))
      .collect();
    for (const r of all) await ctx.db.delete(r._id);
    return all.length;
  },
});

// Lightweight read-only query so the mobile app can show a confirmation count.
export const myDataSummary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const counts = await Promise.all([
      ctx.db.query("foodLog").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db
        .query("wearableSamples")
        .withIndex("by_user_metric_time", (q) => q.eq("userId", userId))
        .take(20000),
      ctx.db.query("habits").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("insights").withIndex("by_user_day", (q) => q.eq("userId", userId)).collect(),
    ]);
    return {
      foodEntries: counts[0].length,
      wearableSamples: counts[1].length,
      habits: counts[2].length,
      insights: counts[3].length,
    };
  },
});
