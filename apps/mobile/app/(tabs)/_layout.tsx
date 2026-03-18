import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme";
import { Platform } from "react-native";

const iconByRoute: Record<string, keyof typeof Ionicons.glyphMap> = {
  dashboard: "analytics-outline",
  elysia: "leaf-outline",
  tracker: "fitness-outline",
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
          // Floating pill tab bar
          marginHorizontal: 14,
          marginBottom: Platform.OS === "ios" ? 14 : 10,
          borderRadius: 22,
          height: Platform.OS === "ios" ? 68 : 62,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 12 : 8,
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: colors.border,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 0.2,
          marginTop: 2,
        },
        tabBarLabel: labelByRoute[route.name] ?? route.name,
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={iconByRoute[route.name] ?? "ellipse-outline"}
            color={color}
            size={22}
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
