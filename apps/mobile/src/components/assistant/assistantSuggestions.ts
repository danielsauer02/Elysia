import type { AssistantChatMessage } from "@/components/assistant/AssistantChatSheet";

export const DEFAULT_ASSISTANT_CHIPS = [
  "Why was my recovery low today?",
  "How am I doing on my calorie balance?",
  "What should I eat for my next meal?",
  "Am I sleeping enough this week?",
  "Review my active habits",
  "What does my HRV trend tell you?",
];

/**
 * Deterministic follow-ups from the latest user + assistant text (no extra API).
 */
export function computeAssistantSuggestions(
  messages: AssistantChatMessage[]
): string[] {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const lastAsst = [...messages].reverse().find((m) => m.role === "assistant");
  const blob = `${lastUser?.content ?? ""} ${lastAsst?.content ?? ""}`.toLowerCase();

  const followUps: string[] = [];

  if (/sleep|rest|insomnia|schlaf|tired|fatigue/i.test(blob)) {
    followUps.push(
      "What sleep window should I aim for?",
      "How does sleep affect recovery?"
    );
  }
  if (/nutrition|food|protein|carb|meal|diet|calorie|kcal/i.test(blob)) {
    followUps.push(
      "How do I hit protein without overthinking?",
      "Meal timing for energy?"
    );
  }
  if (/habit|routine|track|streak/i.test(blob)) {
    followUps.push(
      "How do I stick to new habits?",
      "Which habit should I prioritize?"
    );
  }
  if (/train|workout|exercise|cardio|strength|muscle/i.test(blob)) {
    followUps.push(
      "Minimum effective training dose?",
      "Balance cardio and strength?"
    );
  }
  if (/stress|anxiety|mindful|meditat/i.test(blob)) {
    followUps.push("Quick stress reset?", "Breathing practice basics?");
  }
  if (/supplement|vitamin|omega|magnesium/i.test(blob)) {
    followUps.push("Supplements worth considering first?", "What to avoid?");
  }
  if (/weight|fat loss|cut|bulk|body comp/i.test(blob)) {
    followUps.push("Sustainable fat loss pace?", "Protein while cutting?");
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...followUps, ...DEFAULT_ASSISTANT_CHIPS]) {
    const t = s.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 6) break;
  }
  return out;
}
