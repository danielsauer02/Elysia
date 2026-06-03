/**
 * useNavScrollHandler — wires a screen's vertical scroll position into
 * the shared `scrollY` so the global bottom tab bar can derive its
 * collapsed/expanded state.
 *
 * On mount the hook RESETS `scrollY` to 0 so a freshly entered screen
 * always starts with the bar in the expanded state, regardless of how
 * the previous screen left it.
 *
 * For screens that already use `useStickyRingsHeader` (dashboard,
 * elysia) — DO NOT compose this hook on top; the sticky-rings hook
 * already writes `scrollY` itself.
 */
import { useEffect } from "react";
import {
  useAnimatedScrollHandler,
  type SharedValue,
} from "react-native-reanimated";
import { useActiveScrollY } from "@/context/ScrollContext";

export interface UseNavScrollHandlerResult {
  /** Pass to `<Animated.ScrollView onScroll={...} scrollEventThrottle={16} />`. */
  onScroll: ReturnType<typeof useAnimatedScrollHandler>;
  /** The shared scrollY value (exposed so callers can compose further animations). */
  scrollY: SharedValue<number>;
}

export function useNavScrollHandler(): UseNavScrollHandlerResult {
  const scrollY = useActiveScrollY();

  // Force the global bar to be in its "expanded" state when a screen
  // mounts — otherwise navigating from a scrolled screen would leave
  // the new screen with a stale collapsed bar until its first scroll
  // event fires.
  useEffect(() => {
    scrollY.value = 0;
  }, [scrollY]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      "worklet";
      scrollY.value = e.contentOffset.y;
    },
  });

  return { onScroll, scrollY };
}
