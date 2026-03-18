import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { colors, radii } from "@/theme";

const ITEM_HEIGHT = 52;
const VISIBLE_COUNT = 5; // must be odd
const PADDING = Math.floor(VISIBLE_COUNT / 2); // 2

interface WheelPickerProps {
  values: (string | number)[];
  initialIndex?: number;
  onChange: (index: number, value: string | number) => void;
  unit?: string;
  width?: number;
}

export function WheelPicker({
  values,
  initialIndex = 0,
  onChange,
  unit = "",
  width = 120,
}: WheelPickerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [selectedIdx, setSelectedIdx] = useState(initialIndex);
  const [mounted, setMounted] = useState(false);

  // Scroll to initial position after layout
  useEffect(() => {
    if (!mounted) return;
    scrollRef.current?.scrollTo({ y: initialIndex * ITEM_HEIGHT, animated: false });
  }, [mounted, initialIndex]);

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const idx = Math.round(y / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(values.length - 1, idx));
      setSelectedIdx(clamped);
      onChange(clamped, values[clamped]!);
    },
    [values, onChange]
  );

  const padded = [
    ...Array(PADDING).fill(null),
    ...values,
    ...Array(PADDING).fill(null),
  ];

  return (
    <View style={[styles.container, { width }]}>
      {/* Center highlight bar */}
      <View
        style={[
          styles.highlightBar,
          { top: ITEM_HEIGHT * PADDING, height: ITEM_HEIGHT },
        ]}
        pointerEvents="none"
      />
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
        contentContainerStyle={{ paddingVertical: 0 }}
      >
        {padded.map((val, i) => {
          const dataIndex = i - PADDING;
          const distance = Math.abs(dataIndex - selectedIdx);
          const opacity = distance === 0 ? 1 : distance === 1 ? 0.45 : 0.18;
          const isCenter = distance === 0 && val !== null;

          return (
            <View key={i} style={styles.item}>
              {val !== null ? (
                <Text
                  style={[
                    styles.itemText,
                    isCenter && styles.centerText,
                    { opacity },
                  ]}
                >
                  {val}
                  {unit ? ` ${unit}` : ""}
                </Text>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: ITEM_HEIGHT * VISIBLE_COUNT,
    overflow: "hidden",
    position: "relative",
  },
  highlightBar: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: colors.accent + "18",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.accent + "50",
    borderRadius: radii.sm,
    zIndex: 1,
  },
  scroll: {
    flex: 1,
  },
  item: {
    height: ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: {
    fontSize: 18,
    fontWeight: "500",
    color: colors.textPrimary,
  },
  centerText: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.accent,
  },
});
