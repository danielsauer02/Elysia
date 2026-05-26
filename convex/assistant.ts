"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "./_helpers";

const messageValidator = v.object({
  role: v.union(v.literal("user"), v.literal("assistant")),
  content: v.string(),
});

const MAX_IMAGE_BASE64_LEN = 550_000;

const BASE_SYSTEM =
  "You are Elysia, a concise longevity and wellness coach. Be direct and on-point: short paragraphs or bullets, no filler. Aim for roughly 80–180 words unless the user explicitly asks for depth. Give practical, evidence-aware tips. Do not diagnose or treat medical conditions.";

function buildSystemPrompt(contextSummary?: string): string {
  const ctx = contextSummary?.trim();
  const tail = ctx
    ? `\n\nUser app context (facts only; do not invent beyond this):\n${ctx}\n\nUse this context when relevant. If something is missing, say you don't have that data yet.`
    : "";
  return (
    BASE_SYSTEM +
    tail +
    "\n\nAlways respond directly to the user's **latest** message. Quote or address their question; do not reply with only a generic acknowledgment."
  );
}

type OpenAIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type OpenAIMessage =
  | { role: "system"; content: string }
  | { role: "user" | "assistant"; content: string | OpenAIContentPart[] };

async function callOpenAI(args: {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  contextSummary?: string;
  userImageBase64?: string;
  userImageMimeType?: string;
}): Promise<{ reply: string }> {
  const { messages, contextSummary, userImageBase64, userImageMimeType } = args;

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        "Assistant is not configured. Set OPENAI_API_KEY in your Convex deployment."
      );
    }
    const model = (process.env.OPENAI_MODEL ?? "gpt-4o-mini").trim();

    let imageB64 = userImageBase64?.trim();
    if (imageB64 && imageB64.length > MAX_IMAGE_BASE64_LEN) {
      throw new Error("Image is too large. Try a smaller photo.");
    }
    const mime = (userImageMimeType ?? "image/jpeg").trim() || "image/jpeg";

    const systemPrompt = buildSystemPrompt(contextSummary);

    const openaiMessages: OpenAIMessage[] = [
      { role: "system", content: systemPrompt },
    ];

    const lastIdx = messages.length - 1;
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (!m) continue;
      const isLastUserWithImage =
        i === lastIdx &&
        m.role === "user" &&
        Boolean(imageB64) &&
        mime.startsWith("image/");

      if (isLastUserWithImage && imageB64) {
        const textPart = m.content.trim() || "What do you see in this image?";
        const content: OpenAIContentPart[] = [
          { type: "text", text: textPart },
          {
            type: "image_url",
            image_url: { url: `data:${mime};base64,${imageB64}` },
          },
        ];
        openaiMessages.push({ role: "user", content });
      } else {
        openaiMessages.push({ role: m.role, content: m.content });
      }
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: openaiMessages,
        temperature: 0.55,
        max_tokens: 420,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      let detail = errText.slice(0, 400);
      try {
        const j = JSON.parse(errText) as { error?: { message?: string } };
        if (j?.error?.message) detail = j.error.message;
      } catch {
        /* keep raw */
      }
      if (res.status === 401) {
        throw new Error(
          "OpenAI rejected the API key (401). Check OPENAI_API_KEY in Convex."
        );
      }
      if (res.status === 429) {
        throw new Error("OpenAI rate limit (429). Try again in a moment.");
      }
      throw new Error(`Assistant request failed (${res.status}): ${detail}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const reply = json.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      throw new Error("Empty assistant response from the model.");
    }
    return { reply };
  }

/** OpenAI chat — OPENAI_API_KEY + optional OPENAI_MODEL in Convex dashboard. */
export const chat = action({
  args: {
    messages: v.array(messageValidator),
    contextSummary: v.optional(v.string()),
    userImageBase64: v.optional(v.string()),
    userImageMimeType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);
    return await callOpenAI(args);
  },
});

/**
 * Convenience: builds the full user context server-side, then calls OpenAI.
 * Mobile clients call this for the in-app assistant; no need to ship facts
 * from the device every turn.
 */
export const chatWithContext = action({
  args: {
    messages: v.array(messageValidator),
    today: v.string(),
    userImageBase64: v.optional(v.string()),
    userImageMimeType: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ reply: string }> => {
    const userId = await getAuthUserId(ctx);
    const built: { summary: string } = await ctx.runQuery(
      internal.assistantContext.buildContextForUser,
      { userId, today: args.today }
    );
    return await callOpenAI({
      messages: args.messages,
      contextSummary: built.summary,
      userImageBase64: args.userImageBase64,
      userImageMimeType: args.userImageMimeType,
    });
  },
});

// ─── Longevity-wheel advice ──────────────────────────────────────────────────

const PILLAR_LABELS: Record<string, string> = {
  sleep: "Sleep",
  recovery: "Autonomic Recovery",
  cardio: "Cardiorespiratory",
  activity: "Daily Movement",
  bodyBasic: "Body Basics",
  nutrition: "Nutrition",
  habits: "Habits",
  stress: "Stress & Mental Load",
  blood: "Blood Panel",
  bodyComp: "Body Composition",
  metabolic: "Metabolic Rate",
};

const LAYER_LABELS: Record<string, string> = {
  recoverySleep: "Sleep & Recovery",
  stressPsyche: "Stress & Mind",
  movement: "Movement",
  cardioMetabolic: "Cardio & Metabolic",
  nutrition: "Nutrition",
  biomarkers: "Biomarkers",
};

function describeScores(
  scores: Record<string, number | null>,
  labels: Record<string, string>
): string {
  const entries = Object.entries(scores)
    .filter(
      (e): e is [string, number] => typeof e[1] === "number" && e[1] !== null
    )
    .sort((a, b) => a[1] - b[1]);
  if (entries.length === 0) return "(no scores yet)";
  return entries
    .map(([id, v]) => `${labels[id] ?? id}: ${Math.round(v)}/100`)
    .join(", ");
}

/**
 * Generates 3–5 concrete, actionable tips for raising the Longevity Battery
 * over the next 24h. We send the composite + per-layer + per-pillar scores
 * so the model can prioritise the weakest leverage points.
 */
export const getLongevityAdvice = action({
  args: {
    composite: v.union(v.number(), v.null()),
    layerScores: v.record(v.string(), v.union(v.number(), v.null())),
    pillarScores: v.record(v.string(), v.union(v.number(), v.null())),
    today: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ advice: string; reply: string }> => {
    const userId = await getAuthUserId(ctx);
    const builtCtx: { summary: string } = await ctx.runQuery(
      internal.assistantContext.buildContextForUser,
      { userId, today: args.today }
    );

    const layerStr = describeScores(args.layerScores, LAYER_LABELS);
    const pillarStr = describeScores(args.pillarScores, PILLAR_LABELS);
    const compositeStr =
      args.composite == null ? "(calibrating)" : `${Math.round(args.composite)}/100`;

    const prompt = [
      `My Longevity Battery score is ${compositeStr}.`,
      `Layer scores (lowest first): ${layerStr}.`,
      `Pillar scores (lowest first): ${pillarStr}.`,
      "",
      "Give me 3–5 concrete tips to raise this score over the next 24 hours.",
      "Focus on the lowest-scoring pillars first. For each tip:",
      "• Start with a short imperative title (e.g. \"Push sleep earlier\").",
      "• One sentence on the WHY tied to my data above.",
      "• One sentence on the HOW with a specific time, dose, or count.",
      "Acknowledge that sleep and stress recovery are largely set by the time the day is over — bias today's actions toward movement, nutrition, and environment, and reserve sleep tips for tonight.",
      "Skip generic wellness platitudes. No medical claims.",
    ].join("\n");

    const { reply } = await callOpenAI({
      messages: [{ role: "user", content: prompt }],
      contextSummary: builtCtx.summary,
    });
    return { advice: reply, reply };
  },
});
