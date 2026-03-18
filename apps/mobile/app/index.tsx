import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useAppContext } from "@/context/AppContext";
import { colors } from "@/theme";

export default function Index() {
  const { session, isLoading: authLoading } = useAuth();
  const { isOnboarded, isProfileLoading } = useAppContext();

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

  if (!session) return <Redirect href="/(auth)/login" />;
  if (!isOnboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/dashboard" />;
}
