/**
 * React Navigation theme — keeps the area behind the floating tab bar pure black.
 * Default themes use off-white / light "card" in places that show through margins
 * and safe areas (especially Android).
 */
import { DarkTheme, type Theme } from "@react-navigation/native";
import { colors } from "./index";

export const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.background,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.accent,
  },
};
