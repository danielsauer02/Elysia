/**
 * useOverscrollBounce — soft iOS-style bounce when a scroll view hits
 * the very top of its content, applied universally so Android gets
 * the same feel (Android's native overscroll is only a glow).
 *
 * This hook is an OBSERVER on the global `scrollY` shared value: it
 * fires whenever scrollY transitions toward 0 with a strong upward
 * flick. It does NOT write scrollY itself — pair it with
 * `useNavScrollHandler` (for screens that have no other scroll
 * handler) or with the existing `useStickyRingsHeader` (dashboard,
 * elysia) which already writes scrollY.
 *
 * Behaviour:
 *   • While scrolling normally — nothing happens.
 *   • When `scrollY` reaches 0 with a strong upward velocity, the
 *     wrapper briefly shifts DOWN ~14 px and springs back to 0.
 *   • Not a full rebound — just a soft "give" so the top edge no
 *     longer feels like a brick wall.
 *
 * Usage:
 *   const bounceStyle = useOverscrollBounce();
 *   return (
 *     <Animated.View style={[styles.flex, bounceStyle]}>
 *       <Animated.ScrollView
 *         onScroll={onScroll}
 *         scrollEventThrottle={16}
 *         overScrollMode="never"  // Android: kill the native glow
 *         bounces={false}         // iOS: kill the native bounce so ours wins
 *       >
 *         {children}
 *       </Animated.ScrollView>
 *     </Animated.View>
 *   );
 */
import {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useActiveScrollY } from "@/context/ScrollContext";

const VELOCITY_TRIGGER_PX_PER_S = 650; // upward flick speed (px/s) needed
const BOUNCE_DISTANCE_PX = 14;
const BOUNCE_OUT_MS = 140;
const RE_ARM_DISTANCE = 14;

export function useOverscrollBounce(): ReturnType<typeof useAnimatedStyle> {
  const scrollY = useActiveScrollY();
  const bounce = useSharedValue(0); // translateY applied to the wrapper
  const armed = useSharedValue(0); // 1 when a bounce is allowed; reset after firing
  const prevY = useSharedValue(0);
  const prevT = useSharedValue(0);

  useAnimatedReaction(
    () => scrollY.value,
    (y) => {
      "worklet";
      const now = Date.now();
      const dt = now - prevT.value;
      // Velocity in px/s (negative = scrolling upward toward top).
      const vy = dt > 0 ? ((y - prevY.value) / dt) * 1000 : 0;
      prevY.value = y;
      prevT.value = now;

      // Re-arm once the user is comfortably away from the top so a
      // second flick can bounce again.
      if (y > RE_ARM_DISTANCE) armed.value = 1;

      // Fire once when we hit y ≈ 0 with a strong upward flick.
      if (y <= 0.5 && armed.value === 1 && vy < -VELOCITY_TRIGGER_PX_PER_S) {
        armed.value = 0;
        bounce.value = withSequence(
          withTiming(BOUNCE_DISTANCE_PX, {
            duration: BOUNCE_OUT_MS,
            easing: Easing.out(Easing.quad),
          }),
          withSpring(0, {
            damping: 11,
            stiffness: 110,
            mass: 0.7,
          })
        );
      }
    }
  );

  return useAnimatedStyle(() => ({
    transform: [{ translateY: bounce.value }],
  }));
}
