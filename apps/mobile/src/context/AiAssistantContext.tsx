import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Alert, Keyboard, Platform } from "react-native";
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetFooter,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { AssistantChatSheetContent, AssistantChatFooter } from "@/components/assistant/AssistantChatSheet";
import type { AssistantChatMessage } from "@/components/assistant/AssistantChatSheet";
import { computeAssistantSuggestions } from "@/components/assistant/assistantSuggestions";
import { useAssistantContextPayload } from "@/hooks/useAssistantContextPayload";
import { FLOATING_TAB_BAR } from "@/constants/floatingTabBar";

function formatActionError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (
    e &&
    typeof e === "object" &&
    "message" in e &&
    typeof (e as { message: unknown }).message === "string"
  ) {
    return (e as { message: string }).message;
  }
  if (
    e &&
    typeof e === "object" &&
    "data" in e &&
    (e as { data: unknown }).data != null
  ) {
    try {
      return JSON.stringify((e as { data: unknown }).data);
    } catch {
      /* fall through */
    }
  }
  return "Something went wrong";
}

const WELCOME: AssistantChatMessage = {
  role: "assistant",
  content:
    "Hi — I'm Elysia. Ask about habits, nutrition, or longevity protocols.",
};

export type PresentAssistantOptions = {
  initialPrompt?: string;
};

export type AiAssistantContextValue = {
  present: () => void;
  presentAssistant: (opts?: PresentAssistantOptions) => void;
  dismiss: () => void;
};

const AiAssistantContext = createContext<AiAssistantContextValue | null>(null);

export function AiAssistantProvider({ children }: { children: ReactNode }) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const messagesRef = useRef<AssistantChatMessage[]>([WELCOME]);

  const snapPoints = useMemo(() => ["52%", "100%"], []);
  const insets = useSafeAreaInsets();
  const contextSummary = useAssistantContextPayload();

  const [messages, setMessages] = useState<AssistantChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [attachedUri, setAttachedUri] = useState<string | null>(null);
  const [attachedBase64, setAttachedBase64] = useState<string>("");
  const [attachedMime, setAttachedMime] = useState<string>("image/jpeg");
  const [scrollTrigger, setScrollTrigger] = useState(0);
  const [footerH, setFooterH] = useState(100);
  const [keyboardUp, setKeyboardUp] = useState(false);

  useEffect(() => {
    const showEvt =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(
      showEvt as "keyboardDidShow",
      () => setKeyboardUp(true),
    );
    const hideSub = Keyboard.addListener(
      hideEvt as "keyboardDidHide",
      () => setKeyboardUp(false),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const composerBottomPad = keyboardUp
    ? 4
    : insets.bottom + FLOATING_TAB_BAR.bottomLift;

  const chat = useAction(api.assistant.chat);
  const chatWithCtx = useAction(api.assistant.chatWithContext);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const bumpScroll = useCallback(() => {
    setScrollTrigger((n) => n + 1);
  }, []);

  const present = useCallback(() => {
    sheetRef.current?.present();
    requestAnimationFrame(() => {
      sheetRef.current?.snapToIndex(0);
    });
  }, []);

  const presentAssistant = useCallback(
    (opts?: PresentAssistantOptions) => {
      sheetRef.current?.present();
      requestAnimationFrame(() => {
        sheetRef.current?.snapToIndex(1);
      });
      if (opts?.initialPrompt) {
        setInput(opts.initialPrompt);
      }
    },
    []
  );

  const dismiss = useCallback(() => {
    sheetRef.current?.dismiss();
  }, []);

  const onComposerFocus = useCallback(() => {
    sheetRef.current?.snapToIndex(1);
    requestAnimationFrame(bumpScroll);
  }, [bumpScroll]);

  const onClearChat = useCallback(() => {
    messagesRef.current = [WELCOME];
    setMessages([WELCOME]);
    setAttachedUri(null);
    setAttachedBase64("");
  }, []);

  const onMicPress = useCallback(() => {
    Alert.alert(
      "Voice input",
      Platform.OS === "ios"
        ? "Tap the microphone on the bottom-right of the keyboard to use dictation."
        : "Use your keyboard's voice typing / dictation if your device supports it.",
    );
  }, []);

  const onPickImage = useCallback(async () => {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Allow photo library access to attach an image.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.42,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    setAttachedUri(a.uri);
    setAttachedBase64(a.base64 ?? "");
    setAttachedMime(a.mimeType ?? "image/jpeg");
  }, []);

  const onRemoveAttachment = useCallback(() => {
    setAttachedUri(null);
    setAttachedBase64("");
  }, []);

  const submitUserTurn = useCallback(
    async (
      userText: string,
      imageB64?: string,
      imageMime?: string,
    ) => {
      const hasImage = Boolean(imageB64?.trim());
      const trimmed = userText.trim();
      const content =
        trimmed ||
        (hasImage
          ? "What can you tell me about this image for my health and longevity goals?"
          : "");
      if (!content && !hasImage) return;
      if (sending) return;

      const next: AssistantChatMessage[] = [
        ...messagesRef.current,
        { role: "user", content },
      ];
      messagesRef.current = next;
      setMessages(next);
      bumpScroll();

      const imgB64 = imageB64?.trim() || undefined;
      const imgMime = imageMime || undefined;

      setSending(true);
      try {
        const today = new Date().toISOString().slice(0, 10);
        const { reply } = await chatWithCtx({
          messages: next,
          today,
          userImageBase64: imgB64,
          userImageMimeType: imgMime,
        });
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
        bumpScroll();
      } catch (e: unknown) {
        const msg = formatActionError(e);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Sorry — ${msg}` },
        ]);
        bumpScroll();
      } finally {
        setSending(false);
      }
    },
    [sending, chatWithCtx, bumpScroll],
  );

  // Keep `chat`, `contextSummary` referenced so unused-warnings stay quiet.
  void chat;
  void contextSummary;

  const sendProposal = useCallback(
    async (proposalText: string) => {
      const t = proposalText.trim();
      if (!t) return;
      await submitUserTurn(t, undefined, undefined);
    },
    [submitUserTurn],
  );

  const send = useCallback(async () => {
    const hasImage = Boolean(attachedBase64?.trim());
    const text =
      input.trim() ||
      (hasImage
        ? "What can you tell me about this image for my health and longevity goals?"
        : "");
    if (!text.trim() && !hasImage) return;

    const imageB64 = attachedBase64.trim() || undefined;
    const imageMime = attachedMime || undefined;
    setInput("");
    setAttachedUri(null);
    setAttachedBase64("");
    setAttachedMime("image/jpeg");

    await submitUserTurn(text, imageB64, imageMime);
  }, [input, attachedBase64, attachedMime, submitUserTurn]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.45}
      />
    ),
    [],
  );

  const suggestionChips = useMemo(
    () => computeAssistantSuggestions(messages),
    [messages],
  );

  const onFooterLayout = useCallback((h: number) => setFooterH(h), []);

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props}>
        <AssistantChatFooter
          suggestionChips={suggestionChips}
          input={input}
          setInput={setInput}
          sending={sending}
          onSend={send}
          onProposalSend={sendProposal}
          onComposerFocus={onComposerFocus}
          attachedPreviewUri={attachedUri}
          onRemoveAttachment={onRemoveAttachment}
          onPickImage={onPickImage}
          onMicPress={onMicPress}
          onClearChat={onClearChat}
          bottomPad={composerBottomPad}
          onLayout={onFooterLayout}
        />
      </BottomSheetFooter>
    ),
    [
      composerBottomPad,
      suggestionChips,
      input,
      setInput,
      sending,
      send,
      sendProposal,
      onComposerFocus,
      attachedUri,
      onRemoveAttachment,
      onPickImage,
      onMicPress,
      onClearChat,
      onFooterLayout,
    ],
  );

  const value = useMemo(
    (): AiAssistantContextValue => ({ present, presentAssistant, dismiss }),
    [present, presentAssistant, dismiss],
  );

  return (
    <AiAssistantContext.Provider value={value}>
      {children}
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        topInset={insets.top}
        enablePanDownToClose
        enableDynamicSizing={false}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backdropComponent={renderBackdrop}
        footerComponent={renderFooter}
        backgroundStyle={{
          backgroundColor: "#0a0c14",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        }}
        handleIndicatorStyle={handleStyles.indicator}
      >
        <AssistantChatSheetContent
          messages={messages}
          scrollTrigger={scrollTrigger}
          onDismiss={dismiss}
          footerPadding={footerH}
        />
      </BottomSheetModal>
    </AiAssistantContext.Provider>
  );
}

const handleStyles = {
  indicator: {
    backgroundColor: "#5c6478",
    width: 40,
    height: 4,
  },
};

export function useAiAssistant(): AiAssistantContextValue {
  const ctx = useContext(AiAssistantContext);
  if (!ctx) {
    throw new Error("useAiAssistant must be used within AiAssistantProvider");
  }
  return ctx;
}
