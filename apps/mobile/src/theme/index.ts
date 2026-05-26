// ─── Elysia Design System v2 ────────────────────────────────────────────────
// Inspired by Whoop (rings + data density), Bevel (tile composition),
// Oura (atmospheric arcs) and Apple Health (typography). Dark-first.
//
// Two-accent system:
//   • PRIMARY  = cyan-teal      → longevity / recovery / cool data
//   • SECONDARY = warm amber    → activity / strain / energy data
// Per-data-type colors live in `dataColors` and each carries a gradient pair
// + a soft glow so charts, rings and tiles look the same way everywhere.

// ─── Brand ─────────────────────────────────────────────────────────────────
export const brand = {
  primary: "#22D3EE",          // cyan-teal (longevity / recovery)
  primarySoft: "#0A2535",      // tinted bg for primary-on-dark
  primaryGlow: "rgba(34, 211, 238, 0.45)",
  secondary: "#F59E0B",        // amber / honey (activity / strain)
  secondarySoft: "#2A1A03",    // tinted bg for secondary-on-dark
  secondaryGlow: "rgba(245, 158, 11, 0.45)",
} as const;

// ─── Per-data-type palette ─────────────────────────────────────────────────
// Each pillar gets a base color, a two-stop gradient (light → dark) and a
// pre-baked glow rgba for shadow tints. Use these instead of hard-coding
// colors in cards / charts / rings.
type DataColor = {
  base: string;
  gradient: readonly [string, string];
  glow: string;
};

export const dataColors = {
  sleep:       { base: "#818CF8", gradient: ["#A5B4FC", "#4F46E5"] as const, glow: "rgba(99,102,241,0.45)" },
  recovery:    { base: "#22D3EE", gradient: ["#67E8F9", "#0891B2"] as const, glow: "rgba(34,211,238,0.45)" },
  strain:      { base: "#F59E0B", gradient: ["#FBBF24", "#D97706"] as const, glow: "rgba(245,158,11,0.45)" },
  activity:    { base: "#FB923C", gradient: ["#FDBA74", "#EA580C"] as const, glow: "rgba(251,146,60,0.45)" },
  nutrition:   { base: "#84CC16", gradient: ["#A3E635", "#65A30D"] as const, glow: "rgba(132,204,22,0.45)" },
  heart:       { base: "#FB7185", gradient: ["#FDA4AF", "#E11D48"] as const, glow: "rgba(251,113,133,0.45)" },
  stress:      { base: "#E879F9", gradient: ["#F0ABFC", "#A21CAF"] as const, glow: "rgba(232,121,249,0.45)" },
  body:        { base: "#2DD4BF", gradient: ["#5EEAD4", "#0D9488"] as const, glow: "rgba(45,212,191,0.45)" },
  habits:      { base: "#34D399", gradient: ["#6EE7B7", "#059669"] as const, glow: "rgba(52,211,153,0.45)" },
  cardio:      { base: "#22D3EE", gradient: ["#67E8F9", "#0891B2"] as const, glow: "rgba(34,211,238,0.45)" },
  bodyBasic:   { base: "#2DD4BF", gradient: ["#5EEAD4", "#0D9488"] as const, glow: "rgba(45,212,191,0.45)" },
} satisfies Record<string, DataColor>;

// ─── Surface stack (layered dark backgrounds) ──────────────────────────────
export const surface = {
  base: "#000000",            // pure black — root + scroll area
  raised: "#0C0F1A",          // surface — section bg
  card: "#131825",            // standard card
  cardAlt: "#1A2035",         // elevated card / hero
  overlay: "rgba(13, 17, 28, 0.72)", // glass overlay
  blur: "rgba(8, 12, 20, 0.55)",     // blur tint behind expo-blur
} as const;

// ─── Borders ───────────────────────────────────────────────────────────────
export const borderTokens = {
  subtle: "#252D3E",
  strong: "#374151",
  accent: "rgba(34, 211, 238, 0.30)",
  warm: "rgba(245, 158, 11, 0.30)",
  hairline: "rgba(255, 255, 255, 0.06)",
} as const;

// ─── Text ──────────────────────────────────────────────────────────────────
export const text = {
  primary: "#EDF2FF",
  secondary: "#8892A8",
  tertiary: "#4B5568",
  inverse: "#0B1020",
  accent: "#22D3EE",
  warm: "#F59E0B",
} as const;

// ─── Semantic ──────────────────────────────────────────────────────────────
export const semantic = {
  success: "#34D399",
  successSoft: "#052E22",
  warning: "#FBBF24",
  warningSoft: "#261900",
  destructive: "#F87171",
  destructiveSoft: "#2D0808",
  info: "#22D3EE",
  infoSoft: "#0A2535",
} as const;

// ─── Spacing ───────────────────────────────────────────────────────────────
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

// ─── Radii ─────────────────────────────────────────────────────────────────
export const radii = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 9999,
} as const;

// ─── Elevation (background + border + glow combo) ──────────────────────────
// Use this ONCE on a card to get a consistent depth treatment.
export const elevation = {
  flat: {
    backgroundColor: surface.base,
    borderWidth: 0,
  },
  raised: {
    backgroundColor: surface.raised,
    borderColor: borderTokens.subtle,
    borderWidth: 1,
  },
  card: {
    backgroundColor: surface.card,
    borderColor: borderTokens.subtle,
    borderWidth: 1,
  },
  elevated: {
    backgroundColor: surface.cardAlt,
    borderColor: borderTokens.strong,
    borderWidth: 1,
  },
  hero: {
    backgroundColor: surface.card,
    borderColor: borderTokens.accent,
    borderWidth: 1,
  },
  warmHero: {
    backgroundColor: surface.card,
    borderColor: borderTokens.warm,
    borderWidth: 1,
  },
} as const;

// ─── Glows (color + alpha + radius, no offset — symmetric) ─────────────────
export const glows = {
  primarySm: {
    shadowColor: brand.primary,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  primaryMd: {
    shadowColor: brand.primary,
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  secondarySm: {
    shadowColor: brand.secondary,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  secondaryMd: {
    shadowColor: brand.secondary,
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  cardSoft: {
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;

// ─── Glass tokens (for blurred surfaces) ───────────────────────────────────
export const glass = {
  anthracite: {
    blurIntensity: 78,
    tint: "rgba(20, 24, 36, 0.66)",
    border: "rgba(255, 255, 255, 0.085)",
  },
  cool: {
    blurIntensity: 64,
    tint: "rgba(10, 20, 32, 0.62)",
    border: "rgba(34, 211, 238, 0.18)",
  },
  warm: {
    blurIntensity: 64,
    tint: "rgba(28, 18, 8, 0.60)",
    border: "rgba(245, 158, 11, 0.20)",
  },
} as const;

// ─── Typography ────────────────────────────────────────────────────────────
// Font families are loaded by `expo-font` in app/_layout.tsx. We always
// fall back to system fonts in case the user opens before fonts hydrate.
// Numbers go through Geist Mono with `fontVariant: ["tabular-nums"]` to
// keep digit widths constant across cards — the "premium" data look.
export const fontFamily = {
  display: "Geist_700Bold",
  heading: "Geist_600SemiBold",
  body: "Geist_400Regular",
  bodyMedium: "Geist_500Medium",
  bodyBold: "Geist_700Bold",
  mono: "GeistMono_500Medium",
  monoBold: "GeistMono_700Bold",
} as const;

export const typography = {
  // Display: very large hero numbers (e.g. Move 46/250 CAL)
  displayXL: { fontFamily: fontFamily.monoBold, fontSize: 48, letterSpacing: -1, lineHeight: 52 },
  displayLg: { fontFamily: fontFamily.monoBold, fontSize: 36, letterSpacing: -0.8, lineHeight: 40 },
  displayMd: { fontFamily: fontFamily.monoBold, fontSize: 28, letterSpacing: -0.5, lineHeight: 32 },
  // Titles for sections
  title1: { fontFamily: fontFamily.display, fontSize: 26, letterSpacing: -0.4, lineHeight: 30 },
  title2: { fontFamily: fontFamily.heading, fontSize: 20, letterSpacing: -0.2, lineHeight: 24 },
  title3: { fontFamily: fontFamily.heading, fontSize: 17, letterSpacing: -0.1, lineHeight: 22 },
  // Body
  body: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: fontFamily.bodyMedium, fontSize: 15, lineHeight: 22 },
  callout: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  subhead: { fontFamily: fontFamily.bodyMedium, fontSize: 13, lineHeight: 18 },
  // Smalls
  caption: { fontFamily: fontFamily.bodyMedium, fontSize: 11, lineHeight: 14, letterSpacing: 0.2 },
  micro: { fontFamily: fontFamily.bodyMedium, fontSize: 10, lineHeight: 12, letterSpacing: 0.4 },
  // Eyebrow (small uppercase labels above sections)
  eyebrow: { fontFamily: fontFamily.bodyBold, fontSize: 10, lineHeight: 12, letterSpacing: 1.4 },
  // Legacy aliases (used by older screens; kept for parity during the
  // ui-system migration so we don't break paywall + onboarding screens).
  largeTitle: { fontFamily: fontFamily.display, fontSize: 32, letterSpacing: -0.6, lineHeight: 36 },
  headline: { fontFamily: fontFamily.bodyBold, fontSize: 17, letterSpacing: -0.1, lineHeight: 22 },
  // Tabular numbers — use for any aligned data column
  numberLg: {
    fontFamily: fontFamily.monoBold,
    fontSize: 28,
    letterSpacing: -0.4,
    lineHeight: 30,
    fontVariant: ["tabular-nums"] as ["tabular-nums"],
  },
  numberMd: {
    fontFamily: fontFamily.monoBold,
    fontSize: 20,
    letterSpacing: -0.2,
    lineHeight: 24,
    fontVariant: ["tabular-nums"] as ["tabular-nums"],
  },
  numberSm: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    lineHeight: 18,
    fontVariant: ["tabular-nums"] as ["tabular-nums"],
  },
} as const;

// ─── Motion ────────────────────────────────────────────────────────────────
export const motion = {
  springGentle: { stiffness: 220, damping: 22, mass: 1 },
  springSnappy: { stiffness: 320, damping: 24, mass: 1 },
  fadeIn: { duration: 260 },
  pressScale: 0.97,
  pressDuration: 110,
  releaseDuration: 180,
} as const;

// ─── Backwards-compat exports ──────────────────────────────────────────────
// The rest of the codebase still imports `colors`, `categoryColors`,
// `categoryIcons`, `shadows`. Keep these names so existing screens
// don't break while we migrate them card-by-card.

// NOTE: not `as const` — we want each field to widen to `string` so callers
// can reassign between brand / semantic colors without a type error.
export const colors: Record<string, string> = {
  background: surface.base,
  surface: surface.raised,
  card: surface.card,
  cardAlt: surface.cardAlt,

  border: borderTokens.subtle,
  borderStrong: borderTokens.strong,

  textPrimary: text.primary,
  textSecondary: text.secondary,
  textTertiary: text.tertiary,

  accent: brand.primary,
  accentMuted: brand.primarySoft,
  accentDark: "#06B6D4",
  warm: brand.secondary,
  warmMuted: brand.secondarySoft,

  success: semantic.success,
  successMuted: semantic.successSoft,
  warning: semantic.warning,
  warningMuted: semantic.warningSoft,
  destructive: semantic.destructive,
  destructiveMuted: semantic.destructiveSoft,

  overlay: "rgba(0,0,0,0.75)",
};

// Category colors mapping (legacy → new dataColors)
export const categoryColors: Record<string, string> = {
  sleep: dataColors.sleep.base,
  recovery: dataColors.recovery.base,
  training: dataColors.activity.base,
  nutrition: dataColors.nutrition.base,
  supplementation: "#A78BFA",
  cold_exposure: "#38BDF8",
  meditation: "#F472B6",
  skincare: "#FBBF24",
  mobility: "#2DD4BF",
  stress: dataColors.stress.base,
  productivity: "#94A3B8",
  preventive: dataColors.habits.base,
};

export const categoryIcons: Record<string, string> = {
  sleep: "moon-outline",
  recovery: "medkit-outline",
  training: "barbell-outline",
  nutrition: "leaf-outline",
  supplementation: "flask-outline",
  cold_exposure: "snow-outline",
  meditation: "flower-outline",
  skincare: "sparkles-outline",
  mobility: "body-outline",
  stress: "heart-outline",
  productivity: "briefcase-outline",
  preventive: "shield-checkmark-outline",
};

// On dark mode we use glows + borders instead of drop-shadows; keep these
// empty objects so the existing `shadows.card` style spread is a no-op.
export const shadows = {
  sm: {},
  card: {},
  elevated: {},
} as const;
