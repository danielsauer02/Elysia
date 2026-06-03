import { Tabs } from "expo-router";
import { View } from "react-native";
import { colors } from "@/theme";
import { AppTopBar } from "@/components/navigation/AppTopBar";

/**
 * Tabs layout — the bottom tab bar itself is rendered GLOBALLY at the
 * root layout (`GlobalTabBarOverlay`) so it remains visible inside
 * deep-dive routes (e.g. /sleep) too. Here we just opt the React
 * Navigation tab bar OUT (`tabBar={() => null}`) and keep the
 * `Tabs.Screen` declarations for routing.
 *
 * The persistent top bar lives here because deep-dive screens supply
 * their own header.
 *
 * `ScrollProvider` has also been hoisted to the root layout so deep
 * dives can drive the same shared `scrollY` / `navCollapsed` values.
 */
export default function TabLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        tabBar={() => null}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen name="dashboard" />
        <Tabs.Screen name="elysia" />
        <Tabs.Screen name="tracker" />
        <Tabs.Screen name="products" />
        <Tabs.Screen name="settings" options={{ href: null }} />
      </Tabs>
      {/* Global persistent top bar — sits above every tab screen.
         Animates out of the way when the active screen scrolls. */}
      <AppTopBar />
    </View>
  );
}
