// ─── Dark Design System ────────────────────────────────────────────────────
// Elysia uses a deep navy/slate dark palette with a vibrant cyan-teal accent.
// Inspired by premium health-tech aesthetics; not a copy of any single app.

export const colors = {
  // Layered dark backgrounds
  background: "#0C0F1A",
  surface: "#131825",
  card: "#1A2035",
  cardAlt: "#1E2540",

  // Borders (replaces shadows on dark)
  border: "#252D3E",
  borderStrong: "#374151",

  // Text
  textPrimary: "#EDF2FF",
  textSecondary: "#8892A8",
  textTertiary: "#4B5568",

  // Primary accent — vibrant cyan-teal
  accent: "#22D3EE",
  accentMuted: "#0A2535",
  accentDark: "#06B6D4",

  // Semantic
  success: "#34D399",
  successMuted: "#052E22",
  warning: "#FBBF24",
  warningMuted: "#261900",
  destructive: "#F87171",
  destructiveMuted: "#2D0808",

  overlay: "rgba(0,0,0,0.75)",
};

// Category-specific colors (Tailwind 400-level for dark-bg legibility)
export const categoryColors: Record<string, string> = {
  sleep: "#818CF8",
  recovery: "#22D3EE",
  training: "#FB923C",
  nutrition: "#4ADE80",
  supplementation: "#A78BFA",
  cold_exposure: "#38BDF8",
  meditation: "#F472B6",
  skincare: "#FBBF24",
  mobility: "#2DD4BF",
  stress: "#F87171",
  productivity: "#94A3B8",
  preventive: "#34D399",
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

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

// On dark mode: rely on borders for depth, not shadows
export const shadows = {
  sm: {},
  card: {},
  elevated: {},
};

export const typography = {
  largeTitle: { fontSize: 32, fontWeight: "700" as const, letterSpacing: -0.5 },
  title1: { fontSize: 26, fontWeight: "700" as const, letterSpacing: -0.3 },
  title2: { fontSize: 20, fontWeight: "700" as const, letterSpacing: -0.2 },
  headline: { fontSize: 17, fontWeight: "600" as const },
  body: { fontSize: 16, fontWeight: "400" as const },
  callout: { fontSize: 15, fontWeight: "400" as const },
  subheadline: { fontSize: 14, fontWeight: "500" as const },
  caption: { fontSize: 12, fontWeight: "400" as const },
};
