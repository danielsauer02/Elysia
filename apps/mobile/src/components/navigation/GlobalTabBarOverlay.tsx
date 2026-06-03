/**
 * GlobalTabBarOverlay — root-level bottom tab bar that floats above
 * every screen, including deep-dive routes outside the `(tabs)`
 * navigator.
 *
 * Why root-level? Historically the bar lived inside `(tabs)/_layout`
 * and disappeared the moment the user navigated into a sibling route
 * such as `/sleep` or `/sleep-metric/...`. The user wants the bar to
 * persist on those screens too — so we hoist it to the root layout
 * and select the active tab from the current segments via
 * `useSegments()`.
 *
 * Routing model:
 *   • On tab screens (`segments[0] === "(tabs)"`) the active tab is
 *     `segments[1]` (one of dashboard | elysia | tracker | products).
 *   • On deep-dive screens (`sleep`, `sleep-trend`, `sleep-metric`)
 *     no tab is technically active. We remember the LAST active tab
 *     in state so the bar — both expanded and collapsed — still
 *     shows the user the tab they came from.
 *
 * Visibility gate: the bar only renders on screens where it makes
 * sense (tab routes + sleep deep-dives). Hidden on `index`, `(auth)`,
 * `onboarding`, `paywall`.
 *
 * Collapse logic: drives the shared `navCollapsed` SharedValue from
 * `scrollY` (writes target via `useAnimatedReaction`). Scroll DOWN
 * past a small delta → collapse. Re-expand at `scrollY ≈ 0` OR when
 * the user taps the collapsed circle (handled via `navManualExpand`).
 */
import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Easing,
  useAnimatedReaction,
  withTiming,
} from "react-native-reanimated";
import { FLOATING_TAB_BAR } from "@/constants/floatingTabBar";
import {
  useActiveScrollY,
  useNavCollapsed,
  useNavManualExpand,
} from "@/context/ScrollContext";
import { ElysiaBottomTabBar } from "@/components/navigation/ElysiaBottomTabBar";
import type { MagneticTabBarTab } from "@/components/navigation/MagneticTabBar";
import { useAiAssistant } from "@/context/AiAssistantContext";

// ── Tab catalog (single source of truth) ────────────────────────────
interface TabSpec extends MagneticTabBarTab {
  /** Full pathname used by `router.navigate(...)`. */
  route: string;
}

const TABS: TabSpec[] = [
  {
    key: "dashboard",
    iconName: "home-outline",
    label: "Home",
    route: "/(tabs)/dashboard",
  },
  {
    key: "elysia",
    iconName: "leaf-outline",
    label: "Elysia",
    route: "/(tabs)/elysia",
  },
  {
    key: "tracker",
    iconName: "fitness-outline",
    label: "Tracker",
    route: "/(tabs)/tracker",
  },
  {
    key: "products",
    iconName: "storefront-outline",
    label: "Products",
    route: "/(tabs)/products",
  },
];
const TAB_KEYS = new Set(TABS.map((t) => t.key));

// ── Visibility gate ──────────────────────────────────────────────────
/**
 * Top-level segments where the bar is allowed to render. Anything
 * not in this set hides the bar (welcome screen, auth flow,
 * onboarding, paywall, etc).
 */
const VISIBLE_TOP_SEGMENTS = new Set<string>([
  "(tabs)",
  "sleep",
  "sleep-trend",
  "sleep-metric",
  "recovery",
  "recovery-trend",
  "recovery-metric",
  "energy-reserve",
]);

// ── Collapse tunables ────────────────────────────────────────────────
const AT_TOP_THRESHOLD = 6;
const SCROLL_DOWN_THRESHOLD = 6;
const COLLAPSE_TWEEN_MS = 220;

export function GlobalTabBarOverlay() {
  const segments = useSegments();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { present } = useAiAssistant();

  const scrollY = useActiveScrollY();
  const navCollapsed = useNavCollapsed();
  const navManualExpand = useNavManualExpand();

  // Track the last tab the user was on. Updated whenever we're on a
  // (tabs) screen with a recognised tab segment; persists across
  // deep-dive navigations.
  const [lastActiveTabKey, setLastActiveTabKey] = useState<string>("dashboard");

  const topSeg = segments[0] ?? "";
  const subSeg = (segments[1] as string | undefined) ?? "";

  useEffect(() => {
    if (topSeg === "(tabs)" && TAB_KEYS.has(subSeg)) {
      setLastActiveTabKey(subSeg);
    }
  }, [topSeg, subSeg]);

  const activeKey =
    topSeg === "(tabs)" && TAB_KEYS.has(subSeg) ? subSeg : lastActiveTabKey;

  // Visibility — hide the bar on screens like onboarding / auth.
  // `topSeg` is the empty string until the first navigation event fires,
  // in which case `VISIBLE_TOP_SEGMENTS.has("")` is false and the bar
  // stays hidden until we know which screen we're on.
  const visible = useMemo(
    () => VISIBLE_TOP_SEGMENTS.has(topSeg),
    [topSeg]
  );

  // ── Drive `navCollapsed` from scroll ──────────────────────────────
  // Position-aware: scrollY ≈ 0 → 0 (expanded), scroll-down past a
  // delta threshold → 1 (collapsed). Re-expand also on manual tap
  // (handled via `navManualExpand`).
  // Reset manual-expand whenever the segments change (new screen, new
  // gesture context) so each screen starts fresh.
  useEffect(() => {
    navManualExpand.value = 0;
  }, [topSeg, subSeg, navManualExpand]);

  useAnimatedReaction(
    () => scrollY.value,
    (y, prev) => {
      "worklet";
      const previousY = prev ?? 0;
      const dy = y - previousY;

      // Scrolling DOWN with meaningful velocity always collapses and
      // clears any prior manual-expand override (so the next scroll
      // motion can re-collapse a previously-tapped-expanded bar).
      if (dy > SCROLL_DOWN_THRESHOLD) {
        navManualExpand.value = 0;
        navCollapsed.value = withTiming(1, {
          duration: COLLAPSE_TWEEN_MS,
          easing: Easing.out(Easing.cubic),
        });
        return;
      }

      // Re-expand on the two cases the user described:
      //  • at the very top of content, OR
      //  • user manually requested expansion via the collapsed circle
      if (y < AT_TOP_THRESHOLD || navManualExpand.value === 1) {
        navCollapsed.value = withTiming(0, {
          duration: COLLAPSE_TWEEN_MS,
          easing: Easing.out(Easing.cubic),
        });
      }
    }
  );

  if (!visible) return null;

  const handleSelect = (key: string) => {
    const tab = TABS.find((t) => t.key === key);
    if (!tab) return;
    router.navigate(tab.route as never);
  };

  const handleTapWhenCollapsed = () => {
    // Tap-to-expand: drive the morph DIRECTLY (the reaction only fires
    // when scrollY changes, and a tap doesn't change scrollY). Also
    // set the manual flag so the next scroll event keeps us expanded
    // until the user scrolls DOWN past the threshold again.
    navManualExpand.value = 1;
    navCollapsed.value = withTiming(0, {
      duration: COLLAPSE_TWEEN_MS,
      easing: Easing.out(Easing.cubic),
    });
  };

  const tabBarBottom = insets.bottom + FLOATING_TAB_BAR.bottomLift;

  return (
    <ElysiaBottomTabBar
      tabBarBottom={tabBarBottom}
      tabs={TABS}
      activeKey={activeKey}
      onSelect={handleSelect}
      onTapWhenCollapsed={handleTapWhenCollapsed}
      collapsed={navCollapsed}
      onPressAi={present}
    />
  );
}
