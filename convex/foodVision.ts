/**
 * Food photo recognition via OpenAI Vision (gpt-4o).
 *
 * Flow:
 *   1) Mobile uploads JPEG to Convex storage and calls `recognizeFromPhoto`.
 *   2) Action checks daily quota (free: 30/day, pro: 200/day).
 *   3) Action streams the image URL into OpenAI Vision with a strict JSON
 *      output schema requesting items, quantities, macros and confidence.
 *   4) Result is persisted to `foodPhotos` and returned for user confirmation.
 *
 * The user always reviews + edits before logging via `nutrition.addFoodEntry`.
 */

import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
  mutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "./_helpers";

const MODEL = "gpt-4o";
const MODEL_VERSION = "gpt-4o-2024-08-06";
const FREE_DAILY_LIMIT = 30;
const PRO_DAILY_LIMIT = 200;

export type RecognizedItem = {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  confidence: number;
};

export type RecognizeResult = {
  photoId: string;
  items: RecognizedItem[];
  modelVersion: string;
  remaining: number;
};

const SYSTEM_PROMPT = [
  "You are a precise nutrition analyst. The user uploaded a single photo of a meal.",
  "Identify each distinct food item and produce realistic macros and quantities.",
  "Use grams (g) for solids and millilitres (ml) for liquids; use 'piece' only when natural (e.g. 1 banana).",
  "Do not include garnishes/spices below ~5 kcal.",
  "Return ONLY valid JSON. No prose. Follow the schema exactly.",
].join(" ");

const JSON_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "quantity", "unit", "calories", "proteinG", "carbsG", "fatG", "confidence"],
        properties: {
          name: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string", enum: ["g", "ml", "piece", "serving"] },
          calories: { type: "number" },
          proteinG: { type: "number" },
          carbsG: { type: "number" },
          fatG: { type: "number" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
  },
  required: ["items"],
} as const;

// ─── Storage upload URL ──────────────────────────────────────────────────────

export const getUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await getAuthUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// ─── Recognition action ──────────────────────────────────────────────────────

export const recognizeFromPhoto = action({
  args: { storageId: v.string(), isProUser: v.optional(v.boolean()) },
  handler: async (ctx, { storageId, isProUser }): Promise<RecognizeResult> => {
    const userId = await getAuthUserId(ctx);

    const limit = isProUser ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;
    const remaining = (await ctx.runMutation(internal.foodVision.consumeQuotaInternal, {
      userId,
      feature: "food_vision",
      limit,
    })) as number;
    if (remaining < 0) {
      throw new Error(
        `Daily limit reached (${limit}/day). Upgrade to Pro for ${PRO_DAILY_LIMIT}/day.`
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured in Convex.");
    }

    const url: string | null = await ctx.storage.getUrl(storageId as any);
    if (!url) throw new Error("Photo not found in storage");

    const photoId = (await ctx.runMutation(internal.foodVision.recordPhotoInternal, {
      userId,
      storageId,
    })) as string;

    try {
      const items = await callOpenAIVision(apiKey, url);
      await ctx.runMutation(internal.foodVision.savePhotoResultInternal, {
        photoId: photoId as any,
        items,
      });
      return { photoId, items, modelVersion: MODEL_VERSION, remaining };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(internal.foodVision.savePhotoErrorInternal, {
        photoId: photoId as any,
        error: msg,
      });
      throw e;
    }
  },
});

async function callOpenAIVision(apiKey: string, imageUrl: string): Promise<RecognizedItem[]> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Identify each food item in this photo and respond using this JSON schema: ${JSON.stringify(JSON_SCHEMA)}`,
            },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI Vision failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");

  let parsed: { items?: RecognizedItem[] };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Model returned invalid JSON");
  }
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  return items.map((it) => ({
    name: String(it.name ?? "Unknown"),
    quantity: clampNumber(Number(it.quantity ?? 0), 0, 5000),
    unit: String(it.unit ?? "g"),
    calories: clampNumber(Number(it.calories ?? 0), 0, 5000),
    proteinG: clampNumber(Number(it.proteinG ?? 0), 0, 500),
    carbsG: clampNumber(Number(it.carbsG ?? 0), 0, 1000),
    fatG: clampNumber(Number(it.fatG ?? 0), 0, 500),
    confidence: clampNumber(Number(it.confidence ?? 0), 0, 1),
  }));
}

function clampNumber(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

// ─── Internal helpers ───────────────────────────────────────────────────────

export const recordPhotoInternal = internalMutation({
  args: { userId: v.string(), storageId: v.string() },
  handler: async (ctx, { userId, storageId }): Promise<string> => {
    const id = await ctx.db.insert("foodPhotos", {
      userId,
      storageId,
      modelVersion: MODEL_VERSION,
      createdAt: new Date().toISOString(),
    });
    return id;
  },
});

export const savePhotoResultInternal = internalMutation({
  args: { photoId: v.id("foodPhotos"), items: v.any() },
  handler: async (ctx, { photoId, items }) => {
    await ctx.db.patch(photoId, {
      recognizedItems: items,
      recognizedAt: new Date().toISOString(),
    });
  },
});

export const savePhotoErrorInternal = internalMutation({
  args: { photoId: v.id("foodPhotos"), error: v.string() },
  handler: async (ctx, { photoId, error }) => {
    await ctx.db.patch(photoId, { error, recognizedAt: new Date().toISOString() });
  },
});

/**
 * Consumes one quota unit. Returns remaining after this call (-1 if over).
 */
export const consumeQuotaInternal = internalMutation({
  args: { userId: v.string(), feature: v.string(), limit: v.number() },
  handler: async (ctx, { userId, feature, limit }): Promise<number> => {
    const day = new Date().toISOString().slice(0, 10);
    const existing = await ctx.db
      .query("aiUsageDaily")
      .withIndex("by_user_day_feature", (q) =>
        q.eq("userId", userId).eq("day", day).eq("feature", feature)
      )
      .unique();
    const now = new Date().toISOString();
    if (!existing) {
      await ctx.db.insert("aiUsageDaily", { userId, day, feature, count: 1, updatedAt: now });
      return limit - 1;
    }
    if (existing.count >= limit) return -1;
    const newCount = existing.count + 1;
    await ctx.db.patch(existing._id, { count: newCount, updatedAt: now });
    return limit - newCount;
  },
});

export const getMyPhoto = query({
  args: { photoId: v.id("foodPhotos") },
  handler: async (ctx, { photoId }) => {
    const userId = await getAuthUserId(ctx);
    const p = await ctx.db.get(photoId);
    if (!p || p.userId !== userId) return null;
    return p;
  },
});

export const getQuotaInfo = query({
  args: { isProUser: v.optional(v.boolean()) },
  handler: async (ctx, { isProUser }) => {
    const userId = await getAuthUserId(ctx);
    const day = new Date().toISOString().slice(0, 10);
    const usage = await ctx.db
      .query("aiUsageDaily")
      .withIndex("by_user_day_feature", (q) =>
        q.eq("userId", userId).eq("day", day).eq("feature", "food_vision")
      )
      .unique();
    const limit = isProUser ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;
    return { used: usage?.count ?? 0, limit, remaining: limit - (usage?.count ?? 0) };
  },
});
