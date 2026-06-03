/**
 * trackingHero
 *
 * Shared registry for the "Tracking View" hero pattern (Sleep today,
 * Recovery / Strain / Stress / Biology later). Each tracking view gets a
 * themed nature-illustration wallpaper that sits behind the hero score,
 * fades into the app background toward the bottom, and only shows in the
 * hero region (it disappears as the user scrolls down).
 *
 * To add a new tracking view: drop a portrait wallpaper into
 * `assets/tracking/<kind>-hero.png` and register it here. Every consumer
 * (`TrackingHeroBackground`, `useTrackingHeroScroll`) reads from this map
 * so the look stays consistent across views.
 */
import type { ImageSourcePropType } from "react-native";

export type TrackingHeroKind =
  | "sleep"
  | "recovery"
  | "strain"
  | "stress"
  | "biology";

interface TrackingHeroTheme {
  /** Bundled wallpaper rendered behind the hero. */
  wallpaper: ImageSourcePropType;
  /**
   * Colour the wallpaper fades into at the bottom of the hero. Matches the
   * app background so the seam is invisible.
   */
  fadeColor: string;
}

// All wallpapers fade into pure black to match `surface.base`.
const FADE = "#000000";

export const trackingHero: Partial<Record<TrackingHeroKind, TrackingHeroTheme>> = {
  sleep: {
    wallpaper: require("../../assets/tracking/sleep-hero.png"),
    fadeColor: FADE,
  },
  recovery: {
    wallpaper: require("../../assets/tracking/recovery-hero.png"),
    fadeColor: FADE,
  },
};

export function getTrackingHero(kind: TrackingHeroKind): TrackingHeroTheme | null {
  return trackingHero[kind] ?? null;
}
