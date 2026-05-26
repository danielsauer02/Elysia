/**
 * Shared “anthracite” glass (WHOOP-style) — tab bar + category wheel.
 * Android-friendly dark gray glass, not blue-navy.
 */
export const glassAnthracite = {
  blurIntensity: 78,
  /** Anthracite-tinted frosted layer over blur */
  tintOverlay: "rgba(36, 36, 38, 0.74)",
  borderColor: "rgba(255, 255, 255, 0.085)",
} as const;

/** Scroll-content vignette: transparent above → darker at widget edge */
export const glassScrollShadow = {
  /** Height of fade band above tab bar */
  tabFadeHeight: 52,
  /** Top (light) → bottom (dark, meets bar top) */
  tabFadeColors: ["rgba(0,0,0,0)", "rgba(0,0,0,0.52)"] as const,
  /** Inside category glass: shadow along top edge of pill */
  panelTopFade: ["rgba(0,0,0,0.38)", "rgba(0,0,0,0)"] as const,
  /** Inside category glass: shadow along bottom edge */
  panelBottomFade: ["rgba(0,0,0,0)", "rgba(0,0,0,0.38)"] as const,
  panelEdgeHeight: 36,
} as const;
