/**
 * useTrackingHeroScroll
 *
 * Drives the shared "Tracking View" hero behaviour (Sleep today; Recovery /
 * Strain / Stress / … later). It bundles three things a tracking screen
 * needs so the feel stays identical everywhere:
 *
 *   1. scrollY wiring — writes the global `scrollY` (so the persistent
 *      bottom tab bar collapses/expands) and resets it on mount.
 *
 *   2. Deliberate pull-to-zoom — a `Gesture.Pan` that runs *simultaneously*
 *      with the ScrollView. While the list is at the very top and the user
 *      drags DOWN with the finger held, the hero content is pushed down
 *      with rubber-band resistance (asymptotic — "gets heavier", caps at a
 *      few cm) and the wallpaper zooms in. Releasing springs everything
 *      back. This is the strong / long effect.
 *
 *   3. Flick-up bounce — when the user flicks UP into the top edge, a short,
 *      weak bounce + tiny zoom fires (reusing the velocity-trigger idea from
 *      `useOverscrollBounce`). Shorter and weaker than the deliberate pull.
 *
 * It also exposes a wallpaper transform/opacity so the background image only
 * shows in the hero region (it fades out as the user scrolls down and
 * reappears on the way back up).
 *
 * Pair with:
 *   <Animated.ScrollView
 *     ref={scrollRef}
 *     onScroll={onScroll}
 *     scrollEventThrottle={16}
 *     overScrollMode="never"   // Android: no native glow
 *     bounces={false}          // iOS: our pull/bounce wins
 *   />
 *   wrapped in <GestureDetector gesture={pan}>.
 */
import {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture } from "react-native-gesture-handler";
import { useEffect } from "react";
import { useActiveScrollY } from "@/context/ScrollContext";

// ─── Tunables ────────────────────────────────────────────────────────────
const TOP_EPS = 1; // px — "at the very top" threshold
const MAX_PULL_PX = 120; // ≈ 2–3 cm — asymptotic cap on the deliberate pull
const PULL_RESIST = 0.6; // <1 = finger travels further than the hero
const PULL_ZOOM = 0.2; // wallpaper scale gained at full pull (+20%)

const FLICK_VELOCITY = 650; // px/s upward flick needed to trigger the bounce
const FLICK_LIFT_PX = 16; // short bounce distance
const FLICK_ZOOM = 0.05; // tiny zoom on the flick bounce (+5%)
const FLICK_OUT_MS = 130;
const RE_ARM_DISTANCE = 14;

interface Params {
  /** Pixel height of the hero region — used to fade the wallpaper out. */
  heroHeight: number;
}

export function useTrackingHeroScroll({ heroHeight }: Params) {
  const scrollY = useActiveScrollY();

  // Deliberate pull (>= 0) and the raw accumulated finger travel while
  // pinned at the top (lets us avoid a jump when the top is reached mid-drag).
  const pull = useSharedValue(0);
  const pullRaw = useSharedValue(0);
  // Previous gesture translationY, so we can derive a per-frame delta
  // (this RNGH version doesn't expose `changeY`).
  const prevTransY = useSharedValue(0);

  // Short flick bounce (>= 0).
  const bounce = useSharedValue(0);
  const armed = useSharedValue(0);
  const prevY = useSharedValue(0);
  const prevT = useSharedValue(0);

  // Reset to expanded nav state on mount.
  useEffect(() => {
    scrollY.value = 0;
  }, [scrollY]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      "worklet";
      scrollY.value = e.contentOffset.y;
    },
  });

  // Flick-up bounce observer.
  useAnimatedReaction(
    () => scrollY.value,
    (y) => {
      "worklet";
      const now = Date.now();
      const dt = now - prevT.value;
      const vy = dt > 0 ? ((y - prevY.value) / dt) * 1000 : 0;
      prevY.value = y;
      prevT.value = now;

      if (y > RE_ARM_DISTANCE) armed.value = 1;

      if (y <= 0.5 && armed.value === 1 && vy < -FLICK_VELOCITY) {
        armed.value = 0;
        bounce.value = withSequence(
          withTiming(FLICK_LIFT_PX, {
            duration: FLICK_OUT_MS,
            easing: Easing.out(Easing.quad),
          }),
          withSpring(0, { damping: 12, stiffness: 120, mass: 0.7 })
        );
      }
    }
  );

  const settle = () => {
    "worklet";
    pullRaw.value = 0;
    prevTransY.value = 0;
    pull.value = withSpring(0, { damping: 15, stiffness: 130, mass: 0.8 });
  };

  // The ScrollView's own scrolling, expressed as a gesture so we can run it
  // *simultaneously* with the pull-pan. Without this, a bare Pan claims the
  // vertical gesture and blocks the list from scrolling at all.
  const nativeGesture = Gesture.Native();

  const pan = Gesture.Pan()
    .simultaneousWithExternalGesture(nativeGesture)
    // Vertical-only: activate on vertical intent and BAIL on horizontal drags
    // so nested horizontal lists (e.g. the night-tags chip row) keep working.
    .activeOffsetY([-12, 12])
    .failOffsetX([-12, 12])
    .onBegin(() => {
      "worklet";
      prevTransY.value = 0;
    })
    .onUpdate((e) => {
      "worklet";
      // Per-frame finger delta (no `changeY` in this RNGH version).
      const dy = e.translationY - prevTransY.value;
      prevTransY.value = e.translationY;

      // Only engage the pull while pinned at the very top AND dragging down.
      // Otherwise leave the gesture inert so the native scroll owns the drag.
      if (scrollY.value > TOP_EPS) {
        pullRaw.value = 0;
        pull.value = 0;
        return;
      }
      // Accumulate finger travel (clamped >= 0) so reaching the top
      // mid-drag doesn't snap the hero down.
      pullRaw.value = Math.max(0, pullRaw.value + dy);
      // Asymptotic rubber band: approaches MAX_PULL_PX but never exceeds it.
      pull.value =
        MAX_PULL_PX * (1 - Math.exp((-pullRaw.value * PULL_RESIST) / MAX_PULL_PX));
    })
    .onEnd(settle)
    .onFinalize(settle);

  // Both recognisers active at once: the list always scrolls; the pull only
  // adds the rubber-band/zoom when the user drags down from the top.
  const gesture = Gesture.Simultaneous(nativeGesture, pan);

  // Hero content lift = deliberate pull + short flick bounce.
  const heroLiftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pull.value + bounce.value }],
  }));

  // Header blur: invisible while the hero (wallpaper) is on screen — so the
  // back arrow sits on the sharp wallpaper — then fades in as the user
  // scrolls past the hero, morphing into a translucent blurred bar (Bevel).
  // Wide window + eased curve so the morph is gradual, never a snap-in.
  const headerBlurStyle = useAnimatedStyle(() => {
    const t = interpolate(
      scrollY.value,
      [heroHeight * 0.12, heroHeight * 0.92],
      [0, 1],
      Extrapolation.CLAMP
    );
    // Smoothstep easing — soft at both ends for a true morph, no hard onset.
    const opacity = t * t * (3 - 2 * t);
    return { opacity };
  });

  // Wallpaper: zoom from pull (strong) + flick (weak), slight downward drift
  // with the pull, parallax up + fade as the hero scrolls away.
  const wallpaperStyle = useAnimatedStyle(() => {
    const scale =
      1 +
      (pull.value / MAX_PULL_PX) * PULL_ZOOM +
      (bounce.value / FLICK_LIFT_PX) * FLICK_ZOOM;
    const opacity = interpolate(
      scrollY.value,
      [0, heroHeight * 0.7],
      [1, 0],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [
        { translateY: -scrollY.value * 0.25 + pull.value * 0.12 },
        { scale },
      ],
    };
  });

  return { onScroll, gesture, heroLiftStyle, wallpaperStyle, headerBlurStyle };
}
