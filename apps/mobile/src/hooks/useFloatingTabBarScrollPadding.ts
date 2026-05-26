import { useSafeAreaInsets } from "react-native-safe-area-context";
import { floatingTabBarScrollPaddingBottom } from "@/constants/floatingTabBar";

export function useFloatingTabBarScrollPadding(): number {
  const insets = useSafeAreaInsets();
  return floatingTabBarScrollPaddingBottom(insets.bottom);
}
