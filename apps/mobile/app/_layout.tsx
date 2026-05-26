import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { ClerkProvider, useAuth as useClerkAuth } from "@clerk/clerk-expo";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { convex } from "@/lib/convex";
import { AuthProvider } from "@/context/AuthContext";
import { AppProvider } from "@/context/AppContext";
import { HabitsProvider } from "@/context/HabitsContext";
import { NutritionProvider } from "@/context/NutritionContext";
import { RevenueCatProvider } from "@/context/RevenueCatContext";
import { WearableProvider } from "@/context/WearableContext";
import { AiAssistantProvider } from "@/context/AiAssistantContext";
import { tokenCache } from "@/lib/tokenCache";
import { navigationTheme } from "@/theme/navigation";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { initAnalytics } from "@/lib/analytics";
import {
  useFonts as useGeist,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from "@expo-google-fonts/geist";
import {
  GeistMono_500Medium,
  GeistMono_700Bold,
} from "@expo-google-fonts/geist-mono";
import { colors } from "@/theme";

const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

if (!clerkPublishableKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Add it to apps/mobile/.env (see .env.example)."
  );
}

initAnalytics();

/**
 * Apply Geist as the default font for every Text + TextInput in the app
 * without having to touch every screen. Component-level `style={{...}}`
 * still wins because per-instance styles are merged on top.
 *
 * Numbers should still go through `typography.numberLg/Md/Sm` which set
 * Geist Mono + tabular-nums explicitly.
 */
function applyDefaultFont() {
  const TextAny = Text as unknown as {
    defaultProps?: Record<string, unknown>;
  };
  const TextInputAny = TextInput as unknown as {
    defaultProps?: Record<string, unknown>;
  };
  TextAny.defaultProps = TextAny.defaultProps ?? {};
  TextAny.defaultProps.style = [
    (TextAny.defaultProps.style as object) ?? null,
    { fontFamily: "Geist_400Regular" },
  ];
  TextInputAny.defaultProps = TextInputAny.defaultProps ?? {};
  TextInputAny.defaultProps.style = [
    (TextInputAny.defaultProps.style as object) ?? null,
    { fontFamily: "Geist_400Regular" },
  ];
}

export default function RootLayout() {
  const [fontsLoaded] = useGeist({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_500Medium,
    GeistMono_700Bold,
  });

  // Hold a pure-black splash until Geist is on the JS bridge. Without this
  // gate the first paint uses system fonts, then snaps to Geist a tick
  // later — looks like a flicker. Pre-paint stays branded.
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }
  applyDefaultFont();

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <ConvexProviderWithClerk client={convex} useAuth={useClerkAuth}>
        <AuthProvider>
          <RevenueCatProvider>
            <AppProvider>
              <HabitsProvider>
                <NutritionProvider>
                  <WearableProvider>
                  <GestureHandlerRootView style={styles.flex}>
                    <BottomSheetModalProvider>
                      <AiAssistantProvider>
                        <StatusBar style="light" />
                        <ThemeProvider value={navigationTheme}>
                          <Stack
                            screenOptions={{
                              headerShown: false,
                              animation: "fade",
                              contentStyle: {
                                backgroundColor: navigationTheme.colors.background,
                              },
                            }}
                          >
                            <Stack.Screen name="index" />
                            <Stack.Screen name="(auth)" />
                            <Stack.Screen name="onboarding" />
                            <Stack.Screen name="paywall" />
                            <Stack.Screen name="(tabs)" />
                          </Stack>
                        </ThemeProvider>
                      </AiAssistantProvider>
                    </BottomSheetModalProvider>
                  </GestureHandlerRootView>
                  </WearableProvider>
                </NutritionProvider>
              </HabitsProvider>
            </AppProvider>
          </RevenueCatProvider>
        </AuthProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
