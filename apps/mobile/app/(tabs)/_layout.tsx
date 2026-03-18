import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme";
import { Platform } from "react-native";

const iconByRoute: Record<string, keyof typeof Ionicons.glyphMap> = {
  dashboard: "analytics-outline",
  elysia: "leaf-outline",
  tracker: "activity-outline",
  products: "storefront-outline",
  settings: "person-circle-outline",
};

const labelByRoute: Record<string, string> = {
  dashboard: "Dashboard",
  elysia: "Elysia",
  tracker: "Tracker",
  products: "Products",
  settings: "Profile",
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          height: Platform.OS === "ios" ? 84 : 66,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 26 : 10,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.2,
        },
        tabBarLabel: labelByRoute[route.name] ?? route.name,
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={iconByRoute[route.name] ?? "ellipse-outline"}
            color={color}
            size={size}
          />
        ),
      })}
    >
      <Tabs.Screen name="dashboard" />
      <Tabs.Screen name="elysia" />
      <Tabs.Screen name="tracker" />
      <Tabs.Screen name="products" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
