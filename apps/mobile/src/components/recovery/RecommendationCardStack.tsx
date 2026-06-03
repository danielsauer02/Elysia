/**
 * RecommendationCardStack
 *
 * Swipeable, image-backed deck of recovery habit recommendations. The front
 * card is fully interactive; the next two cards fan out to the right + down
 * (shorter) so the deck reads as a physical stack. Card body tap opens the
 * detail modal, an explicit "+ Add" button opens the add flow, and a paired
 * "Not now" button / swipe-left dismisses (7-day blacklist server-side).
 *
 * Built with `react-native-reanimated` + `react-native-gesture-handler` so
 * the deck feels native and the dot indicator stays in lock-step with the
 * card position even mid-swipe.
 */
import React, { useEffect, useState } from "react";
import {
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolate,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { borderTokens, colors, radii, semantic, spacing, text } from "@/theme";
import { EfficiencyRing } from "@/components/recovery/EfficiencyRing";
import type { ResolvedRecommendation } from "@/hooks/useRecoveryRecommendations";

const CARD_HEIGHT = 420;
const SWIPE_THRESHOLD = 120;
// Width reserved on the right edge for the fanned peek cards.
const RIGHT_FAN = 22;

interface Props {
  items: ResolvedRecommendation[];
  /** Tapping the card body. */
  onPressCard: (item: ResolvedRecommendation) => void;
  /** Tapping the explicit "+ Add" button. */
  onAdd: (item: ResolvedRecommendation) => void;
  /** Dismissed by swipe-left or "Not now". */
  onDismiss: (item: ResolvedRecommendation) => void;
}

export function RecommendationCardStack({
  items,
  onPressCard,
  onAdd,
  onDismiss,
}: Props) {
  // Local working queue so a swipe can re-order without touching the server.
  // "Not now" (button) blacklists + removes; a swipe just rotates the card to
  // the back so it resurfaces once the user has been through the rest.
  const [queue, setQueue] = useState<ResolvedRecommendation[]>(items);
  const [rotations, setRotations] = useState(0);

  // Reconcile the local queue whenever the server set changes (add / dismiss /
  // daily refresh): keep the current rotation for ids still present, append any
  // new ids, drop the rest. Keyed on the id set so the rotation survives the
  // identity churn of useQuery returning a fresh array each render.
  const idsKey = items.map((i) => i.templateId).join("|");
  useEffect(() => {
    setQueue((prev) => {
      const incoming = new Map(items.map((i) => [i.templateId, i]));
      const kept = prev
        .filter((p) => incoming.has(p.templateId))
        .map((p) => incoming.get(p.templateId)!);
      const keptIds = new Set(kept.map((k) => k.templateId));
      const added = items.filter((i) => !keptIds.has(i.templateId));
      return [...kept, ...added];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const active = queue[0] ?? null;
  const peek1 = queue[1] ?? null;
  const peek2 = queue[2] ?? null;

  // Swipe → send the front card to the back of the queue (no blacklist).
  const requeue = () => {
    setQueue((q) => (q.length <= 1 ? q : [...q.slice(1), q[0]!]));
    setRotations((r) => r + 1);
  };

  // "Not now" → blacklist server-side (7 days) and drop it locally.
  const notNow = () => {
    if (active) onDismiss(active);
    setQueue((q) => q.slice(1));
  };

  if (queue.length === 0) {
    return items.length === 0 ? <EmptyStack /> : <ExhaustedStack />;
  }
  if (!active) {
    return <ExhaustedStack />;
  }

  const activeDot = queue.length > 0 ? rotations % queue.length : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.deck}>
        {peek2 ? <PeekCard item={peek2} depth={2} /> : null}
        {peek1 ? <PeekCard item={peek1} depth={1} /> : null}
        <FrontCard
          key={active.templateId}
          item={active}
          onPressCard={() => onPressCard(active)}
          onAdd={() => onAdd(active)}
          onNotNow={notNow}
          onSwiped={requeue}
        />
      </View>

      {/* Dots indicator — a rotating pointer so the deck reads as a cycle the
          user is moving through, not a finite list. */}
      <View style={styles.dots}>
        {queue.map((it, i) => (
          <View
            key={it.templateId}
            style={[
              styles.dot,
              i === activeDot && styles.dotActive,
              i < activeDot && styles.dotPassed,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Cards ───────────────────────────────────────────────────────────────────

function FrontCard({
  item,
  onPressCard,
  onAdd,
  onNotNow,
  onSwiped,
}: {
  item: ResolvedRecommendation;
  onPressCard: () => void;
  onAdd: () => void;
  onNotNow: () => void;
  onSwiped: (dir: "left" | "right") => void;
}) {
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);

  // Reset whenever the active card changes — keeps the spring from snapping
  // mid-flight when the parent advances index.
  useEffect(() => {
    translateX.value = 0;
    rotate.value = 0;
  }, [item.templateId, translateX, rotate]);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      translateX.value = e.translationX;
      rotate.value = e.translationX / 18; // gentle tilt while dragging
    })
    .onEnd((e) => {
      if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-500, { duration: 220 });
        rotate.value = withTiming(-25, { duration: 220 });
        runOnJS(onSwiped)("left");
      } else if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(500, { duration: 220 });
        rotate.value = withTiming(25, { duration: 220 });
        runOnJS(onSwiped)("right");
      } else {
        translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
        rotate.value = withSpring(0, { damping: 18, stiffness: 180 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  const dismissHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, -30, 0],
      [1, 0.4, 0],
      Extrapolate.CLAMP
    ),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.cardLayer, styles.front, cardStyle]}>
        <CardSurface
          item={item}
          onPressCard={onPressCard}
          onAdd={onAdd}
          onNotNow={onNotNow}
        />
        <Animated.View
          pointerEvents="none"
          style={[styles.dismissHint, dismissHintStyle]}
        >
          <Ionicons name="play-skip-forward-outline" size={16} color="#FFFFFF" />
          <Text style={styles.dismissHintLabel}>Skip</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

function PeekCard({
  item,
  depth,
}: {
  item: ResolvedRecommendation;
  depth: 1 | 2;
}) {
  // Cards behind fan to the RIGHT and shrink in height (scaleY) so the deck
  // reads as a stack with the next picks peeking out on the right edge.
  const translateX = depth === 1 ? RIGHT_FAN * 0.5 : RIGHT_FAN;
  const translateY = depth === 1 ? 9 : 18;
  const scaleY = depth === 1 ? 0.965 : 0.93;
  const opacity = depth === 1 ? 0.9 : 0.72;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.cardLayer,
        { transform: [{ translateX }, { translateY }, { scaleY }], opacity },
      ]}
    >
      <CardSurface item={item} compact />
    </View>
  );
}

function CardSurface({
  item,
  onPressCard,
  onAdd,
  onNotNow,
  compact = false,
}: {
  item: ResolvedRecommendation;
  onPressCard?: () => void;
  onAdd?: () => void;
  onNotNow?: () => void;
  compact?: boolean;
}) {
  const { template, visual, efficiency, reasons } = item;
  const accent = visual.accent;

  return (
    <Pressable
      disabled={compact}
      onPress={onPressCard}
      style={({ pressed }) => [
        styles.cardSurface,
        pressed && !compact && { transform: [{ scale: 0.99 }] },
      ]}
    >
      {visual.image ? (
        <ImageBackground
          source={visual.image}
          style={styles.bg}
          resizeMode="cover"
        >
          <CardScrim />
          <CardContent
            template={template}
            efficiency={efficiency}
            reasons={reasons}
            accent={accent}
            onAdd={onAdd}
            onNotNow={onNotNow}
            compact={compact}
          />
        </ImageBackground>
      ) : (
        <LinearGradient colors={visual.gradient} style={styles.bg}>
          <CardScrim />
          <CardContent
            template={template}
            efficiency={efficiency}
            reasons={reasons}
            accent={accent}
            onAdd={onAdd}
            onNotNow={onNotNow}
            compact={compact}
          />
        </LinearGradient>
      )}
    </Pressable>
  );
}

/**
 * Legibility scrim: a faint darkening at the very top (for the category box +
 * efficiency ring) and a strong fade that starts at the vertical middle and
 * deepens toward the bottom so the title / description / buttons always read.
 */
function CardScrim() {
  return (
    <LinearGradient
      colors={[
        "rgba(8,12,20,0.42)",
        "transparent",
        "rgba(6,10,16,0.62)",
        "rgba(6,10,16,0.97)",
      ]}
      locations={[0, 0.3, 0.5, 1]}
      style={StyleSheet.absoluteFill}
    />
  );
}

function CardContent({
  template,
  efficiency,
  reasons,
  accent,
  onAdd,
  onNotNow,
  compact,
}: {
  template: ResolvedRecommendation["template"];
  efficiency: number;
  reasons: string[];
  accent: string;
  onAdd?: () => void;
  onNotNow?: () => void;
  compact: boolean;
}) {
  return (
    <View style={styles.content}>
      <View style={styles.topRow}>
        <View style={styles.categoryBox}>
          <Text style={styles.categoryLabel}>
            {template.category.replace(/_/g, " ")}
          </Text>
        </View>
        <View style={styles.ringCol}>
          <View style={styles.ringDisc}>
            <EfficiencyRing value={efficiency} size={52} label={null} />
          </View>
          <Text style={styles.ringCaption}>Efficiency</Text>
        </View>
      </View>

      <View style={styles.bottomBlock}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {template.title}
        </Text>
        <Text style={styles.cardSub} numberOfLines={2}>
          {template.shortExplanation}
        </Text>
        {reasons.length > 0 ? (
          <Text style={styles.reason} numberOfLines={1}>
            {reasons[0]}
          </Text>
        ) : null}
        {!compact && onAdd ? (
          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={onAdd}
              activeOpacity={0.85}
              style={[styles.addBtn, { backgroundColor: accent }]}
            >
              <Ionicons name="add" size={16} color="#0B111A" />
              <Text style={styles.addBtnLabel}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onNotNow}
              activeOpacity={0.85}
              style={styles.notNowBtn}
            >
              <Text style={styles.notNowBtnLabel}>Not now</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ─── Empty / done states ─────────────────────────────────────────────────────

function EmptyStack() {
  return (
    <View style={styles.emptyWrap}>
      <Ionicons name="sparkles-outline" size={20} color={text.tertiary} />
      <Text style={styles.emptyTitle}>No new recommendations</Text>
      <Text style={styles.emptySub}>
        Log a few more days of wearable data to unlock fresh picks.
      </Text>
    </View>
  );
}

function ExhaustedStack() {
  return (
    <View style={styles.emptyWrap}>
      <Ionicons name="checkmark-done" size={20} color={text.tertiary} />
      <Text style={styles.emptyTitle}>You've seen them all</Text>
      <Text style={styles.emptySub}>
        Fresh picks will appear after tomorrow's recovery update.
      </Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  deck: {
    height: CARD_HEIGHT + 24, // breathing room for fanned peek cards
  },
  cardLayer: {
    position: "absolute",
    top: 0,
    left: spacing.lg,
    right: spacing.lg + RIGHT_FAN,
    height: CARD_HEIGHT,
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
  },
  front: {
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  cardSurface: { flex: 1 },
  bg: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    // Extra bottom gap so the buttons sit lower with breathing room to the
    // card's bottom edge (the deck fades to black down here anyway).
    paddingBottom: spacing.xl,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  // Gray translucent tag — square-ish, no border, slightly off-white text.
  categoryBox: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "rgba(120,130,150,0.30)",
  },
  categoryLabel: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "capitalize",
  },
  ringCol: { alignItems: "center", gap: 3 },
  ringDisc: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8,12,20,0.55)",
  },
  ringCaption: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  bottomBlock: { gap: spacing.sm },
  cardTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.4,
    lineHeight: 27,
  },
  cardSub: {
    fontSize: 13.5,
    color: "rgba(255,255,255,0.80)",
    lineHeight: 19,
  },
  reason: {
    fontSize: 11.5,
    fontWeight: "700",
    // Always green — a recommendation targets a positive opportunity.
    color: semantic.success,
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  addBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: radii.md,
  },
  addBtnLabel: {
    color: "#0B111A",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 0.3,
  },
  notNowBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  notNowBtnLabel: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.2,
  },
  dismissHint: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: "rgba(15, 23, 38, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(252, 165, 165, 0.45)",
  },
  dismissHintLabel: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  dotActive: { backgroundColor: "#FFFFFF", width: 18 },
  dotPassed: { backgroundColor: "rgba(255,255,255,0.45)" },
  emptyWrap: {
    marginHorizontal: spacing.lg,
    padding: spacing.xxl,
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: borderTokens.subtle,
    backgroundColor: colors.surface,
  },
  emptyTitle: {
    color: text.primary,
    fontSize: 15,
    fontWeight: "700",
  },
  emptySub: {
    color: text.tertiary,
    fontSize: 12.5,
    textAlign: "center",
    lineHeight: 18,
  },
});
