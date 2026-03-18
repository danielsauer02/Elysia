/**
 * Vertical drum-roll category selector.
 * Shows 3 items at a time: previous (top, dimmed), selected (center, highlighted),
 * next (bottom, dimmed). Swipe up/down to change selection.
 */
import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, categoryColors, categoryIcons, radii, spacing } from "@/theme";

const ITEM_HEIGHT = 58;
const VISIBLE = 3;

// Insert null padding at top and bottom so first/last items can be centered
const PADDING = 1; // 1 empty slot above and below

interface CategoryWheelPickerProps {
  categories: string[];   // raw keys like "sleep", "cold_exposure"
  selected: string;       // "All" or a raw key
  onSelect: (category: string) => void;
}

function categoryLabel(key: string): string {
  return key === "All" ? "All" : key.replace(/_/g, " ");
}

function categoryColor(key: string): string {
  return key === "All" ? colors.accent : (categoryColors[key] ?? colors.accent);
}

function categoryIcon(key: string): keyof typeof Ionicons.glyphMap {
  if (key === "All") return "grid-outline";
  return (categoryIcons[key] ?? "ellipse-outline") as keyof typeof Ionicons.glyphMap;
}

export function CategoryWheelPicker({
  categories,
  selected,
  onSelect,
}: CategoryWheelPickerProps) {
  const allItems = ["All", ...categories];
  const padded = [null, ...allItems, null];

  const initialIdx = Math.max(0, allItems.indexOf(selected));
  const [centerIdx, setCenterIdx] = useState(initialIdx);
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!mounted) return;
    const targetIdx = allItems.indexOf(selected);
    if (targetIdx >= 0 && targetIdx !== centerIdx) {
      scrollRef.current?.scrollTo({ y: targetIdx * ITEM_HEIGHT, animated: true });
      setCenterIdx(targetIdx);
    }
  }, [selected, mounted]);

  useEffect(() => {
    if (mounted) {
      scrollRef.current?.scrollTo({ y: initialIdx * ITEM_HEIGHT, animated: false });
    }
  }, [mounted]);

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const idx = Math.round(y / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(allItems.length - 1, idx));
      setCenterIdx(clamped);
      onSelect(allItems[clamped]!);
    },
    [allItems, onSelect]
  );

  const selectedKey = allItems[centerIdx] ?? "All";
  const accentColor = categoryColor(selectedKey);

  return (
    <View style={styles.container}>
      {/* Center highlight band */}
      <View
        style={[
          styles.centerHighlight,
          { backgroundColor: accentColor + "14", borderColor: accentColor + "40" },
        ]}
        pointerEvents="none"
      />

      {/* Fade gradients top + bottom */}
      <View style={styles.fadeTop} pointerEvents="none" />
      <View style={styles.fadeBottom} pointerEvents="none" />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        scrollEventThrottle={16}
        onLayout={() => setMounted(true)}
      >
        {padded.map((key, i) => {
          const dataIdx = i - PADDING;
          const distance = Math.abs(dataIdx - centerIdx);
          const isCenter = distance === 0 && key !== null;
          const isAdjacent = distance === 1 && key !== null;
          const itemColor = key ? categoryColor(key) : "transparent";
          const icon = key ? categoryIcon(key) : "ellipse-outline";

          return (
            <View key={i} style={[styles.item, { height: ITEM_HEIGHT }]}>
              {key !== null && (
                <View
                  style={[
                    styles.pill,
                    isCenter && {
                      backgroundColor: itemColor + "18",
                      borderColor: itemColor + "50",
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={icon}
                    size={isCenter ? 15 : 13}
                    color={isCenter ? itemColor : colors.textTertiary}
                    style={styles.pillIcon}
                  />
                  <Text
                    style={[
                      styles.pillLabel,
                      {
                        color: isCenter
                          ? itemColor
                          : isAdjacent
                          ? colors.textTertiary
                          : "transparent",
                        fontSize: isCenter ? 16 : 13,
                        fontWeight: isCenter ? "700" : "500",
                        opacity: isCenter ? 1 : isAdjacent ? 0.55 : 0,
                      },
                    ]}
                  >
                    {categoryLabel(key)}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const TOTAL_HEIGHT = ITEM_HEIGHT * VISIBLE;

const styles = StyleSheet.create({
  container: {
    height: TOTAL_HEIGHT,
    overflow: "hidden",
    position: "relative",
    marginHorizontal: spacing.lg,
  },
  centerHighlight: {
    position: "absolute",
    top: ITEM_HEIGHT * PADDING,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    borderRadius: radii.lg,
    borderWidth: 1,
    zIndex: 1,
  },
  fadeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    zIndex: 2,
    backgroundColor: "transparent",
    // Pointer events none so scroll still works
  },
  fadeBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    zIndex: 2,
    backgroundColor: "transparent",
  },
  scroll: { flex: 1 },
  item: {
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.full,
    gap: 7,
    borderWidth: 0,
    borderColor: "transparent",
    minWidth: 160,
    justifyContent: "center",
  },
  pillIcon: {},
  pillLabel: {
    textTransform: "capitalize",
    letterSpacing: 0.1,
  },
});
