import { Stack, Redirect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppProvider, useAppContext } from "@/context/AppContext";
import { HabitsProvider } from "@/context/HabitsContext";

function RootNavigator() {
  const { isOnboarded } = useAppContext();

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
    <AppProvider>
      <HabitsProvider>
        <RootNavigator />
      </HabitsProvider>
    </AppProvider>
  );
}
