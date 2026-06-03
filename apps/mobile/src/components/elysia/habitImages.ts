/**
 * Slug-based background-image lookup for habit cards.
 *
 * Bundled PNGs live at `apps/mobile/assets/habits/<slug>.png` and are
 * registered statically below so Metro can resolve them at build time.
 * Anything not yet illustrated falls back to a per-category gradient, so
 * the recommendation stack still renders even before every card has a
 * bespoke image.
 *
 * To add a new card image:
 *   1. Drop the PNG in `apps/mobile/assets/habits/<slug>.png` (≥ 1080 px).
 *   2. Add `"<slug>": require("@/.../habits/<slug>.png"),` to HABIT_IMAGES.
 * No other code change is needed — the resolver picks it up automatically.
 */

import type { ImageSourcePropType } from "react-native";
import { categoryColors } from "@/theme";

// ─── Bundled images ──────────────────────────────────────────────────────────
//
// Keys are the slugs from `mockTemplates` in apps/mobile/src/mocks/data.ts.
// The require() entries are added in `withImage()` below once a matching PNG
// exists in `apps/mobile/assets/habits/<slug>.png`. Slugs not listed here
// render with the category gradient.
//
// We keep the map sparse on purpose: a missing PNG is a graceful degradation,
// not a bundle error. Add a new slug to `HABIT_IMAGES` only when its asset
// has actually been created.
const HABIT_IMAGES: Record<string, ImageSourcePropType> = {
  "sleep-wind-down-protocol": require("../../../assets/habits/sleep-wind-down-protocol.png"),
  "caffeine-cutoff-2pm": require("../../../assets/habits/caffeine-cutoff-2pm.png"),
  "screen-curfew-90min": require("../../../assets/habits/screen-curfew-90min.png"),
  "bedroom-cooling-18c": require("../../../assets/habits/bedroom-cooling-18c.png"),
  "consistent-bed-wake-time": require("../../../assets/habits/consistent-bed-wake-time.png"),
  "magnesium-evening-protocol": require("../../../assets/habits/magnesium-evening-protocol.png"),
  "sauna-heat-exposure-protocol": require("../../../assets/habits/sauna-heat-exposure-protocol.png"),
  "alcohol-free-weeknights": require("../../../assets/habits/alcohol-free-weeknights.png"),
  "post-workout-cooldown": require("../../../assets/habits/post-workout-cooldown.png"),
  "box-breathing-practice": require("../../../assets/habits/box-breathing-practice.png"),
  "resonance-breathing-6bpm": require("../../../assets/habits/resonance-breathing-6bpm.png"),
  "yoga-nidra-20min": require("../../../assets/habits/yoga-nidra-20min.png"),
  "forest-walk-decompression": require("../../../assets/habits/forest-walk-decompression.png"),
  "cold-shower-protocol": require("../../../assets/habits/cold-shower-protocol.png"),
  "morning-sunlight-routine": require("../../../assets/habits/morning-sunlight-routine.png"),
  "hip-thoracic-mobility": require("../../../assets/habits/hip-thoracic-mobility.png"),
  "hrv-stress-management": require("../../../assets/habits/hrv-stress-management.png"),
  "zone-2-cardio-protocol": require("../../../assets/habits/zone-2-cardio-protocol.png"),
  "ice-bath-cold-immersion": require("../../../assets/habits/ice-bath-cold-immersion.png"),
  "gratitude-journaling": require("../../../assets/habits/gratitude-journaling.png"),
  "omega-3-daily-protocol": require("../../../assets/habits/omega-3-daily-protocol.png"),
  "foam-rolling-evening": require("../../../assets/habits/foam-rolling-evening.png"),
  "hydration-baseline": require("../../../assets/habits/hydration-baseline.png"),
};

export interface HabitVisual {
  /** Bundled background image, or null if no asset exists for this slug. */
  image: ImageSourcePropType | null;
  /** Two-stop gradient based on the card's category — always present. */
  gradient: readonly [string, string];
  /** Accent color for the eyebrow / accents — always present. */
  accent: string;
}

/** Darken+brighten a hex color into a two-stop top-down gradient. */
function gradientForCategory(category: string): readonly [string, string] {
  const base = categoryColors[category] ?? "#22D3EE";
  // Deep top → category-tinted bottom. Keeps text readable without an image.
  return ["#0B1220", `${base}33`] as const;
}

/** Look up the visual treatment for a habit by slug + category. */
export function getHabitVisual(
  slug: string | undefined,
  category: string
): HabitVisual {
  const image = (slug && HABIT_IMAGES[slug]) || null;
  return {
    image,
    gradient: gradientForCategory(category),
    accent: categoryColors[category] ?? "#22D3EE",
  };
}
