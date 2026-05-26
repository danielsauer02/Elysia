import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { colors } from "@/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FLOATING_TAB_BAR } from "@/constants/floatingTabBar";
import { FloatingGlassTabBarBackground } from "@/components/navigation/FloatingGlassTabBarBackground";
import { ElysiaBottomTabBar } from "@/components/navigation/ElysiaBottomTabBar";
import { AppTopBar } from "@/components/navigation/AppTopBar";

const iconByRoute: Record<string, keyof typeof Ionicons.glyphMap> = {
  // `dashboard` segment is now labeled "Home"; the file path keeps the
  // existing route slug to avoid a deeplink break for existing builds.
  dashboard: "home-outline",
  elysia: "leaf-outline",
  tracker: "fitness-outline",
  products: "storefront-outline",
};

const labelByRoute: Record<string, string> = {
  dashboard: "Home",
  elysia: "Elysia",
  tracker: "Tracker",
  products: "Products",
};

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  /** Used by ElysiaBottomTabBar wrapper only; inner bar uses bottom:0 inside wrapper */
  const tabBarBottom = insets.bottom + FLOATING_TAB_BAR.bottomLift;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        tabBar={(props) => <ElysiaBottomTabBar {...props} tabBarBottom={tabBarBottom} />}
        screenOptions={({ route }) => ({
        headerShown: false,
        sceneContainerStyle: { flex: 1, backgroundColor: colors.background },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarBackground: () => <FloatingGlassTabBarBackground />,
        /**
         * Geometry: ElysiaBottomTabBar wraps us in a centered pill.
         * This style fills that wrapper (bottom:0) — NOT screen bottom (avoids double offset).
         */
        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: FLOATING_TAB_BAR.height,
          borderRadius: FLOATING_TAB_BAR.borderRadius,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          borderWidth: 0,
          paddingHorizontal: 0,
          paddingTop: 0,
          paddingBottom: 0,
          margin: 0,
          marginHorizontal: 0,
          elevation: 18,
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.5,
          shadowRadius: 28,
        },
        tabBarItemStyle: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingVertical: 0,
          height: FLOATING_TAB_BAR.height,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: "700",
          letterSpacing: 0.15,
          marginTop: 0,
          marginBottom: 0,
          lineHeight: 11,
        },
        tabBarIconStyle: {
          marginTop: 0,
          marginBottom: 0,
        },
        tabBarLabel: labelByRoute[route.name] ?? route.name,
        tabBarIcon: ({ color }) => (
          <View style={{ marginTop: -2 }}>
            <Ionicons
              name={iconByRoute[route.name] ?? "ellipse-outline"}
              color={color}
              size={20}
            />
          </View>
        ),
      })}
    >
        <Tabs.Screen name="dashboard" />
        <Tabs.Screen name="elysia" />
        <Tabs.Screen name="tracker" />
        <Tabs.Screen name="products" />
        <Tabs.Screen name="settings" options={{ href: null }} />
      </Tabs>
      {/* Global persistent top bar — appears above every tab screen. */}
      <AppTopBar />
    </View>
  );
}
