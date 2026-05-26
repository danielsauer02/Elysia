import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, categoryIcons, radii, spacing } from "@/theme";

/** Compact 3-row slicer; tighter vertical footprint. */
const ITEM_HEIGHT = 34;
const VISIBLE_COUNT = 3;
const PADDING = Math.floor(VISIBLE_COUNT / 2);

export type CategoryWheelPickerProps = {
  /** Category labels without "All". "All" is prepended automatically. */
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
};

/**
 * Plain background, accent-only typography/icons; prev / center / next emphasis via scroll position.
 */
export function CategoryWheelPicker({
  categories,
  selected,
  onSelect,
}: CategoryWheelPickerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const labels = useMemo(() => ["All", ...categories], [categories]);

  const indexOf = useCallback(
    (label: string) => {
      const i = labels.indexOf(label);
      return i >= 0 ? i : 0;
    },
    [labels]
  );

  const [selectedIdx, setSelectedIdx] = useState(() => indexOf(selected));
  const [mounted, setMounted] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    setSelectedIdx(indexOf(selected));
  }, [selected, indexOf]);

  useEffect(() => {
    if (!mounted) return;
    scrollRef.current?.scrollTo({
      y: selectedIdx * ITEM_HEIGHT,
      animated: false,
    });
    setScrollY(selectedIdx * ITEM_HEIGHT);
  }, [mounted, labels.length, selectedIdx]);

  const applyIndex = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(labels.length - 1, idx));
      setSelectedIdx(clamped);
      const label = labels[clamped];
      if (label) onSelect(label);
    },
    [labels, onSelect]
  );

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const idx = Math.round(y / ITEM_HEIGHT);
      applyIndex(idx);
    },
    [applyIndex]
  );

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollY(e.nativeEvent.contentOffset.y);
  }, []);

  const padded = useMemo(
    () => [...Array(PADDING).fill(null), ...labels, ...Array(PADDING).fill(null)],
    [labels]
  );

  const wheelHeight = ITEM_HEIGHT * VISIBLE_COUNT;

  const rowMetrics = useCallback(
    (contentIndex: number) => {
      const viewportCenter = scrollY + wheelHeight / 2;
      const rowCenter = contentIndex * ITEM_HEIGHT + ITEM_HEIGHT / 2;
      const distRows = Math.abs(rowCenter - viewportCenter) / ITEM_HEIGHT;
      const focus = Math.max(0, 1 - Math.min(distRows, 1.2) / 1.2);
      const opacity = 0.28 + focus * 0.72;
      const fontSize = 12 + focus * 5;
      const iconSize = 15 + focus * 5;
      const fontWeight = focus > 0.65 ? ("800" as const) : ("600" as const);
      return { opacity, fontSize, iconSize, fontWeight };
    },
    [scrollY, wheelHeight]
  );

  return (
    <View style={styles.outer}>
      <View style={[styles.shell, { height: wheelHeight }]}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onLayout={() => setMounted(true)}
        >
          {padded.map((label, i) => {
            const isPad = label === null;
            const m = rowMetrics(i);

            const rawKey =
              typeof label === "string"
                ? label.toLowerCase().replace(/ /g, "_")
                : "";
            const iconName = (
              label === "All"
                ? "grid-outline"
                : categoryIcons[rawKey] ?? "ellipse-outline"
            ) as keyof typeof Ionicons.glyphMap;

            return (
              <View key={`${i}-${label ?? "pad"}`} style={styles.itemRow}>
                {!isPad ? (
                  <View style={styles.itemInner}>
                    <Ionicons
                      name={iconName}
                      size={m.iconSize}
                      color={colors.accent}
                      style={{ opacity: m.opacity }}
                    />
                    <Text
                      style={[
                        styles.itemLabel,
                        {
                          opacity: m.opacity,
                          fontSize: m.fontSize,
                          fontWeight: m.fontWeight,
                          color: colors.accent,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    alignItems: "center",
  },
  shell: {
    width: "100%",
    maxWidth: 300,
    borderRadius: radii.md,
    overflow: "hidden",
    position: "relative",
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  scroll: {
    flex: 1,
  },
  itemRow: {
    height: ITEM_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  itemInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  itemLabel: {
    flexShrink: 1,
    letterSpacing: -0.2,
  },
});
