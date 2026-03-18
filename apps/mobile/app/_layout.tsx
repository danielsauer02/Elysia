import "react-native-url-polyfill/auto";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/context/AuthContext";
import { AppProvider } from "@/context/AppContext";
import { HabitsProvider } from "@/context/HabitsContext";
import { NutritionProvider } from "@/context/NutritionContext";

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppProvider>
          <HabitsProvider>
            <NutritionProvider>
              <StatusBar style="light" />
              <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="onboarding" />
                <Stack.Screen name="(tabs)" />
              </Stack>
            </NutritionProvider>
          </HabitsProvider>
        </AppProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
