import "react-native-url-polyfill/auto";
import { Stack, Redirect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AppProvider, useAppContext } from "@/context/AppContext";
import { HabitsProvider } from "@/context/HabitsContext";
import { NutritionProvider } from "@/context/NutritionContext";
import { colors } from "@/theme";

function RootNavigator() {
  const { session, isLoading: authLoading } = useAuth();
  const { isOnboarded, isProfileLoading } = useAppContext();

  // Show splash while determining auth + profile state
  if (authLoading || isProfileLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  // Not authenticated → auth screens
  if (!session) {
    return (
      <>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
        </Stack>
        <Redirect href="/(auth)/login" />
      </>
    );
  }

  // Authenticated but not onboarded → onboarding
  if (!isOnboarded) {
    return (
      <>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="onboarding" />
        </Stack>
        <Redirect href="/onboarding" />
      </>
    );
  }

  // Authenticated + onboarded → main app
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppProvider>
          <HabitsProvider>
            <NutritionProvider>
              <RootNavigator />
            </NutritionProvider>
          </HabitsProvider>
        </AppProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
