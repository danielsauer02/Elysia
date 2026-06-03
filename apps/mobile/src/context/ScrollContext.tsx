/**
 * ScrollContext — global scroll + nav-bar state.
 *
 * SharedValues exposed:
 *
 *   • `scrollY` — raw vertical scroll offset of the active screen.
 *     Written by the screen's `useAnimatedScrollHandler`; read by any
 *     component that wants to animate based on scroll position.
 *
 *   • `headerProgress` — animated 0..1 value: 1 = top bar fully
 *     visible, 0 = fully hidden (slid out of the way). Direction-aware
 *     (Whoop / Instagram pattern): scrolling down → 0, scrolling up
 *     → 1, scrollY ≈ 0 → snap to 1.
 *
 *   • `navCollapsed` — animated 0..1 value driving the bottom tab bar
 *     morph: 0 = full pill (expanded), 1 = small circle (collapsed).
 *     Position-aware: collapses on scroll DOWN past a threshold, re-
 *     expands when scrollY ≈ 0. Also re-expandable via tap on the
 *     collapsed circle (handled in the overlay component via
 *     `navManualExpand`).
 *
 *   • `navManualExpand` — 0 or 1 flag. Set to 1 when the user taps the
 *     collapsed circle. Cleared back to 0 once the user starts
 *     scrolling DOWN again (so a subsequent scroll-down can collapse
 *     the bar again).
 *
 * The provider is mounted at the ROOT layout so that ALL screens —
 * tab screens AND deep-dive screens like /sleep — share the same
 * SharedValues and can drive the global tab bar overlay.
 */
import React, { createContext, useContext, type ReactNode } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

interface ScrollContextValue {
  scrollY: SharedValue<number>;
  headerProgress: SharedValue<number>;
  navCollapsed: SharedValue<number>;
  navManualExpand: SharedValue<number>;
}

const ScrollContext = createContext<ScrollContextValue | null>(null);

export function ScrollProvider({ children }: { children: ReactNode }) {
  const scrollY = useSharedValue(0);
  const headerProgress = useSharedValue(1);
  const navCollapsed = useSharedValue(0);
  const navManualExpand = useSharedValue(0);
  return (
    <ScrollContext.Provider
      value={{ scrollY, headerProgress, navCollapsed, navManualExpand }}
    >
      {children}
    </ScrollContext.Provider>
  );
}

/** Returns the shared scrollY for the active screen (raw position). */
export function useActiveScrollY(): SharedValue<number> {
  const ctx = useContext(ScrollContext);
  const fallback = useSharedValue(0);
  return ctx?.scrollY ?? fallback;
}

/** Returns the animated header visibility (0..1) for the active screen. */
export function useActiveHeaderProgress(): SharedValue<number> {
  const ctx = useContext(ScrollContext);
  const fallback = useSharedValue(1);
  return ctx?.headerProgress ?? fallback;
}

/** Returns the animated nav-bar collapse value (0 expanded .. 1 collapsed). */
export function useNavCollapsed(): SharedValue<number> {
  const ctx = useContext(ScrollContext);
  const fallback = useSharedValue(0);
  return ctx?.navCollapsed ?? fallback;
}

/** Returns the manual-expand override flag (0 or 1). */
export function useNavManualExpand(): SharedValue<number> {
  const ctx = useContext(ScrollContext);
  const fallback = useSharedValue(0);
  return ctx?.navManualExpand ?? fallback;
}
