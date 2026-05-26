import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const tokenCache = {
  async getToken(key: string): Promise<string | undefined | null> {
    if (Platform.OS === "web") return null;
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") return;
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Silently fail on web or when storage is unavailable
    }
  },
};
