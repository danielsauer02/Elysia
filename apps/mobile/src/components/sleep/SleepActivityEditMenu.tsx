/**
 * SleepActivityEditMenu
 *
 * Small contextual popover that appears after a long-press on a
 * `SleepActivityCard`. Renders a centred floating card with a single
 * action — Edit — to keep the interaction unambiguous and protect
 * against accidental destructive moves (delete still lives inside
 * the edit sheet itself, gated behind a confirmation dialog).
 *
 *   ┌────────────────┐
 *   │  ✏  Edit       │  ← single CTA
 *   │  Cancel        │
 *   └────────────────┘
 *
 * Open / close handled via the `visible` prop. Backdrop tap and
 * Cancel both call `onClose`. Tap on Edit fires `onEdit` and the
 * parent is responsible for closing the menu + opening the sheet.
 */
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  borderTokens,
  colors,
  dataColors,
  fontFamily,
  spacing,
  surface,
} from "@/theme";

interface Props {
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
}

export function SleepActivityEditMenu({ visible, onClose, onEdit }: Props) {
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1,
          duration: 140,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scale.setValue(0.92);
      opacity.setValue(0);
    }
  }, [visible, scale, opacity]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View
          style={[
            styles.menu,
            { opacity, transform: [{ scale }] },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <Pressable style={styles.row} onPress={onEdit} android_ripple={{ color: "rgba(255,255,255,0.08)" }}>
            <Ionicons name="create-outline" size={18} color={dataColors.sleep.base} />
            <Text style={styles.rowText}>Edit</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.row} onPress={onClose} android_ripple={{ color: "rgba(255,255,255,0.08)" }}>
            <Text style={[styles.rowText, styles.cancelText]}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  menu: {
    minWidth: 220,
    backgroundColor: surface.raised,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: borderTokens.strong,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  rowText: {
    fontFamily: fontFamily.bodyBold,
    color: colors.textPrimary,
    fontSize: 15,
  },
  cancelText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.bodyMedium,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: borderTokens.subtle,
  },
});
