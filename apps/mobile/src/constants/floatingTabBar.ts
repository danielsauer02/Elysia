import { glassAnthracite } from "@/theme/glass";

/**
 * WHOOP-style floating glass tab bar — single source of truth for layout + scroll padding.
 * Tab bar is absolutely positioned so scenes extend full height; lists pad content so
 * the last items clear the bar.
 */
export const FLOATING_TAB_BAR = {
  /** Matches screen content horizontal padding (spacing.lg) */
  horizontalInset: 16,
  /**
   * Tiny breathing room above the home-indicator safe area so the bar
   * sits *flush* with the Android navigation buttons (or iOS home
   * indicator). The user explicitly wants no gap below the bar.
   */
  bottomLift: 2,
  /** Visual height of the pill (icons + labels) */
  height: 54,
  /** Square AI launcher tile (matches pill height) */
  aiTileSize: 54,
  /** Gap between tab pill and AI tile */
  aiTileGap: 8,
  borderRadius: 27,
  blurIntensity: glassAnthracite.blurIntensity,
  tintOverlay: glassAnthracite.tintOverlay,
  borderColor: glassAnthracite.borderColor,
} as const;

/** Bottom padding for ScrollView / FlatList content so it scrolls under the bar but stays readable */
export function floatingTabBarScrollPaddingBottom(safeAreaBottom: number): number {
  const shadeSlack = 36;
  return (
    safeAreaBottom +
    FLOATING_TAB_BAR.bottomLift +
    FLOATING_TAB_BAR.height +
    28 +
    shadeSlack
  );
}
