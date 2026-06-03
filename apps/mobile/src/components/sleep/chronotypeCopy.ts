/**
 * Long-form copy for each chronotype class, plus the shared educational
 * sections used on the /chronotype deep-dive page. Keep this list literal
 * so a missing key fails fast at compile time.
 *
 * Per class we expose:
 *   - label       short title ("Early-evening type")
 *   - shortDesc   one-liner shown on the card tile
 *   - tagline     headline on the deep-dive page ("Your schedule is flexible")
 *   - description the long, positively-framed explanation
 *   - statement   the coloured action statement ("… tend to be innovative")
 */
import type { ChronotypeClass } from "./ChronotypeCard";

export interface ChronotypeCopy {
  label: string;
  shortDesc: string;
  tagline: string;
  description: string;
  statement: string;
}

export const CHRONOTYPE_COPY: Record<
  Exclude<ChronotypeClass, "calibrating">,
  ChronotypeCopy
> = {
  early_morning: {
    label: "Early-morning type",
    shortDesc: "You rise early and feel sharpest in the first half of the day.",
    tagline: "Your mornings are your superpower",
    description:
      "Your body clock runs ahead of the social average. You wake naturally in the early hours and feel clear-headed well before most people get going. Heavy thinking and demanding workouts land best before noon, and you tend to wind down comfortably in the early evening.",
    statement: "Morning types tend to be proactive go-getters",
  },
  morning: {
    label: "Morning type",
    shortDesc: "You wake easily and peak before lunch.",
    tagline: "You thrive on an early rhythm",
    description:
      "Mornings work in your favour: focus peaks before 10am and your tolerance for exercise stays high through midday. A protein-rich breakfast and dimmer light after 9pm protect this rhythm, keeping your energy steady from wake-up to early evening.",
    statement: "Morning types tend to be consistent and organised",
  },
  late_morning: {
    label: "Late-morning type",
    shortDesc: "You hit your stride a little after the early risers.",
    tagline: "Your schedule is comfortably balanced",
    description:
      "You find your groove between 9am and 1pm. A short caffeine window early on works well, and your body would rather wind down by 11pm than push to midnight. You sit close to the social average, which makes most schedules feel natural.",
    statement: "Balanced types tend to adapt easily to change",
  },
  early_evening: {
    label: "Early-evening type",
    shortDesc: "You are more of an evening type but not to the extreme.",
    tagline: "Your schedule is flexible",
    description:
      "You are more of an evening type but not to the extreme — intermediate in some classifications. You enjoy the occasional late night but don't mind an earlier bedtime either. Keeping to social schedules feels easy, even if you'd happily do without too many early mornings.",
    statement: "Evening types tend to be innovative",
  },
  evening: {
    label: "Evening type",
    shortDesc: "Your energy peaks in the afternoon and late evening.",
    tagline: "You come alive later in the day",
    description:
      "You're a natural night-owl: deep focus arrives in the mid-afternoon and stays well into the evening. Creative and demanding work fits beautifully in those hours. Blocking bright overhead light after 10pm and protecting a full night past midnight keeps your edge sharp.",
    statement: "Evening types tend to be creative and original",
  },
  late_evening: {
    label: "Late-evening type",
    shortDesc: "Your natural window runs late into the night.",
    tagline: "You run on a late, distinctive rhythm",
    description:
      "Your natural window runs from late evening into the small hours. When your schedule allows, leaning into it pays off — your best work often happens when the world is quiet. A firm light cut-off at night and consistent wake times keep this rhythm sustainable.",
    statement: "Late types tend to be independent thinkers",
  },
};

export const LIGHT_TITLE = "Be mindful of light exposure";
export const LIGHT_BODY =
  "Keeping a regular sleep schedule has real health benefits, and light is the biggest lever you have. Get plenty of bright, ideally natural, light during the day, then minimise screens and harsh artificial light in the hours before bed to keep your rhythm aligned.";

export const HOW_TITLE = "How Elysia learns your chronotype";
export const HOW_BODY =
  "Your natural circadian rhythm shapes your body temperature, your sleep-wake cycle and when you feel most active. Elysia looks at the midpoint of your sleep across the last month of nights and matches it to the closest chronotype. As your habits shift, your type can shift with them.";

export const WHY_TITLE = "Why your chronotype matters";
export const WHY_BODY =
  "Your chronotype is the optimal sleep schedule that presets your body's daily rhythms — digestion, alertness and hormone release among them. Living closer to it can meaningfully improve your energy, the quality of your sleep and your overall well-being.";
