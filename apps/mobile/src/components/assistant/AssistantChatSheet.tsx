import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  Platform,
  ActionSheetIOS,
  Alert,
  ActivityIndicator,
} from "react-native";
import { BottomSheetFlatList, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radii } from "@/theme";
import { DEFAULT_ASSISTANT_CHIPS } from "@/components/assistant/assistantSuggestions";

export type AssistantChatMessage = { role: "user" | "assistant"; content: string };

const ESTIMATED_ROW_H = 90;

function lastUserIndex(msgs: AssistantChatMessage[]): number {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === "user") return i;
  }
  return -1;
}

/* ─── Scrollable message list (direct child of BottomSheetModal) ────── */

type ContentProps = {
  messages: AssistantChatMessage[];
  scrollTrigger: number;
  onDismiss: () => void;
  footerPadding: number;
};

export function AssistantChatSheetContent({
  messages,
  scrollTrigger,
  onDismiss,
  footerPadding,
}: ContentProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listRef = useRef<any>(null);
  const rowHeights = useRef<number[]>([]);
  const headerHRef = useRef(0);

  useEffect(() => {
    if (messages.length < rowHeights.current.length) {
      rowHeights.current = rowHeights.current.slice(0, messages.length);
    }
  }, [messages.length]);

  useEffect(() => {
    if (scrollTrigger === 0) return;

    const scroll = (delay: number) =>
      setTimeout(() => {
        const list = listRef.current;
        if (!list?.scrollToOffset) return;

        const idx = lastUserIndex(messages);
        if (idx < 0) {
          list.scrollToOffset({ offset: 0, animated: true });
          return;
        }

        let offset = headerHRef.current;
        for (let i = 0; i < idx; i++) {
          offset += rowHeights.current[i] ?? ESTIMATED_ROW_H;
        }
        list.scrollToOffset({ offset, animated: true });
      }, delay);

    const t1 = scroll(100);
    const t2 = scroll(350);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTrigger]);

  const historyPress = useCallback(() => {
    Alert.alert("History", "Saved chat history will be available in a future update.");
  }, []);

  const header = useMemo(
    () => (
      <View
        style={styles.header}
        onLayout={(e) => {
          headerHRef.current = e.nativeEvent.layout.height;
        }}
      >
        <View style={styles.headerLeft}>
          <View style={styles.brandCircle}>
            <Text style={styles.brandLetter}>E</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Pressable onPress={onDismiss} hitSlop={10} accessibilityLabel="Close">
            <Ionicons name="chevron-down" size={22} color={colors.textTertiary} />
          </Pressable>
          <Pressable
            onPress={historyPress}
            hitSlop={10}
            style={styles.headerIcon}
            accessibilityLabel="History"
          >
            <Ionicons name="time-outline" size={22} color={colors.textTertiary} />
          </Pressable>
        </View>
      </View>
    ),
    [onDismiss, historyPress],
  );

  return (
    <BottomSheetFlatList<AssistantChatMessage>
      ref={listRef}
      data={messages}
      keyboardShouldPersistTaps="always"
      keyExtractor={(_item: AssistantChatMessage, i: number) => `m-${i}`}
      contentContainerStyle={[styles.listContent, { paddingBottom: footerPadding + 8 }]}
      ListHeaderComponent={header}
      renderItem={({
        item,
        index,
      }: {
        item: AssistantChatMessage;
        index: number;
      }) => (
        <View
          onLayout={(e) => {
            rowHeights.current[index] = e.nativeEvent.layout.height;
          }}
        >
          {item.role === "user" ? (
            <View style={styles.userRow}>
              <Text style={styles.userText}>{item.content}</Text>
            </View>
          ) : (
            <View style={styles.asstRow}>
              <Text style={styles.asstText}>{item.content}</Text>
              <View style={styles.asstActions}>
                <Ionicons name="copy-outline" size={16} color={colors.textTertiary} />
                <Ionicons name="thumbs-up-outline" size={16} color={colors.textTertiary} />
                <Ionicons name="thumbs-down-outline" size={16} color={colors.textTertiary} />
              </View>
            </View>
          )}
        </View>
      )}
    />
  );
}

/* ─── Sticky footer (rendered via BottomSheetModal footerComponent) ─── */

export type FooterProps = {
  suggestionChips: string[];
  input: string;
  setInput: (t: string) => void;
  sending: boolean;
  onSend: () => void;
  onProposalSend: (text: string) => void | Promise<void>;
  onComposerFocus: () => void;
  attachedPreviewUri: string | null;
  onRemoveAttachment: () => void;
  onPickImage: () => void;
  onMicPress: () => void;
  onClearChat: () => void;
  bottomPad: number;
  onLayout?: (height: number) => void;
};

export function AssistantChatFooter({
  suggestionChips,
  input,
  setInput,
  sending,
  onSend,
  onProposalSend,
  onComposerFocus,
  attachedPreviewUri,
  onRemoveAttachment,
  onPickImage,
  onMicPress,
  onClearChat,
  bottomPad,
  onLayout,
}: FooterProps) {
  const openPlusMenu = useCallback(() => {
    const clear = () => {
      Alert.alert("Clear chat", "Remove all messages in this session?", [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: onClearChat },
      ]);
    };
    const newChat = () => {
      Alert.alert("New chat", "Start fresh?", [
        { text: "Cancel", style: "cancel" },
        { text: "Start new", style: "destructive", onPress: onClearChat },
      ]);
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Clear chat", "New chat", "Photo library"],
          cancelButtonIndex: 0,
        },
        (i) => {
          if (i === 1) clear();
          if (i === 2) newChat();
          if (i === 3) onPickImage();
        },
      );
    } else {
      Alert.alert("More", undefined, [
        { text: "Cancel", style: "cancel" },
        { text: "Clear chat", style: "destructive", onPress: clear },
        { text: "New chat", onPress: newChat },
        { text: "Photo library", onPress: onPickImage },
      ]);
    }
  }, [onClearChat, onPickImage]);

  return (
    <View
      style={styles.footerRoot}
      onLayout={onLayout ? (e) => onLayout(e.nativeEvent.layout.height) : undefined}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.suggestScroll}
        keyboardShouldPersistTaps="always"
        nestedScrollEnabled
      >
        {suggestionChips.map((s, i) => (
          <Pressable
            key={`${s}-${i}`}
            onPress={() => void onProposalSend(s)}
            disabled={sending}
            style={[styles.suggestChip, sending && styles.suggestChipDisabled]}
          >
            <Text
              style={styles.suggestChipText}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {s}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {attachedPreviewUri ? (
        <View style={styles.previewRow}>
          <Image source={{ uri: attachedPreviewUri }} style={styles.previewImg} />
          <Pressable onPress={onRemoveAttachment} style={styles.previewRemove}>
            <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.composerWrap, { paddingBottom: Math.max(bottomPad, 8) }]}>
        <Pressable style={styles.plusBtn} onPress={openPlusMenu}>
          <Ionicons name="add" size={24} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.inputShell}>
          <BottomSheetTextInput
            style={styles.sheetInput}
            placeholder="Ask Elysia anything…"
            placeholderTextColor={colors.textTertiary}
            value={input}
            onChangeText={setInput}
            editable={!sending}
            multiline
            maxLength={4000}
            returnKeyType="default"
            onFocus={onComposerFocus}
          />
          <Pressable style={styles.micInner} onPress={onMicPress} hitSlop={8}>
            <Ionicons name="mic-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <Pressable
          onPress={onSend}
          disabled={sending || (!input.trim() && !attachedPreviewUri)}
          style={[
            styles.sendCircle,
            (sending || (!input.trim() && !attachedPreviewUri)) && styles.sendDisabled,
          ]}
        >
          {sending ? (
            <ActivityIndicator color="#0C0F1A" size="small" />
          ) : (
            <Ionicons name="arrow-up" size={22} color="#0C0F1A" />
          )}
        </Pressable>
      </View>
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  brandCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.accent + "55",
  },
  brandLetter: { fontSize: 15, fontWeight: "900", color: colors.accent },
  headerRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerIcon: { padding: 4 },
  listContent: {
    paddingHorizontal: spacing.lg,
  },
  userRow: { alignItems: "flex-end", marginBottom: spacing.md },
  userText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
    fontWeight: "500",
    maxWidth: "92%",
    textAlign: "right",
  },
  asstRow: { alignItems: "flex-start", marginBottom: spacing.lg, maxWidth: "96%" },
  asstText: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.textPrimary,
    fontWeight: "400",
  },
  asstActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
    opacity: 0.7,
  },
  footerRoot: {
    backgroundColor: "#06080f",
    paddingTop: 4,
  },
  suggestScroll: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  suggestChip: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    marginRight: spacing.sm,
    flexShrink: 0,
  },
  suggestChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0C0F1A",
  },
  suggestChipDisabled: { opacity: 0.45 },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  previewImg: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  previewRemove: { padding: 4 },
  composerWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  plusBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  inputShell: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.accent + "99",
    backgroundColor: colors.card,
    paddingLeft: spacing.md,
    paddingRight: 44,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    justifyContent: "center",
  },
  sheetInput: {
    fontSize: 15,
    color: colors.textPrimary,
    maxHeight: 100,
    paddingVertical: 0,
  },
  micInner: {
    position: "absolute",
    right: 10,
    bottom: 10,
    padding: 4,
  },
  sendCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  sendDisabled: { opacity: 0.4 },
});
