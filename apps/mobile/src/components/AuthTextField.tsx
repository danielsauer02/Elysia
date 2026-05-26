import React from "react";
import {
  Platform,
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
} from "react-native";
import { colors } from "@/theme";

export type AuthTextFieldVariant =
  /** Sign-in identifier (email). iOS uses `username` so Keychain pairs with password without the yellow Strong-Password strip. */
  | "emailLogin"
  /** Sign-up email. */
  | "emailRegister"
  | "passwordLogin"
  /**
   * New password on register — use `password`, not `newPassword`, on iOS so the system
   * does not paint the full-field yellow “Strong Password” overlay that blocks typing.
   */
  | "passwordNew"
  | "passwordConfirm"
  /** Email/SMS code — avoid `oneTimeCode` on iOS when it draws a blocking bar; manual + paste still work. */
  | "otp";

export type AuthTextFieldProps = Omit<
  TextInputProps,
  "style" | "textContentType" | "autoComplete" | "passwordRules" | "importantForAutofill"
> & {
  variant: AuthTextFieldVariant;
  /** Merged with base field styles (flex, font, colors). */
  style?: StyleProp<TextStyle>;
};

/**
 * Auth fields tuned so iOS Password AutoFill can still suggest credentials without the
 * yellow Strong-Password overlay blocking manual input (common with `newPassword` + `emailAddress`).
 */
export function AuthTextField({
  variant,
  style,
  autoCorrect,
  spellCheck,
  ...rest
}: AuthTextFieldProps) {
  const isEmailLogin = variant === "emailLogin";
  const isEmailRegister = variant === "emailRegister";
  const isAnyEmail = isEmailLogin || isEmailRegister;
  const isOtp = variant === "otp";

  const textContentType = (() => {
    if (isOtp) {
      return "none" as const;
    }
    if (isEmailLogin) {
      return "username" as const;
    }
    if (isEmailRegister) {
      return "emailAddress" as const;
    }
    return "password" as const;
  })();

  const autoComplete = (() => {
    if (isOtp) {
      return "off" as const;
    }
    if (isEmailLogin) {
      return Platform.OS === "android" ? ("username" as const) : ("username" as const);
    }
    if (isEmailRegister) {
      return "email" as const;
    }
    if (variant === "passwordNew") {
      return Platform.OS === "android" ? ("password-new" as const) : ("password" as const);
    }
    return "password" as const;
  })();

  const importantForAutofill = (() => {
    if (isOtp) {
      return "no" as const;
    }
    return "yes" as const;
  })();

  return (
    <TextInput
      {...rest}
      style={[baseStyles.input, style]}
      textContentType={textContentType}
      autoComplete={autoComplete}
      importantForAutofill={importantForAutofill}
      autoCorrect={isAnyEmail || isOtp ? false : autoCorrect}
      spellCheck={isAnyEmail || isOtp ? false : spellCheck}
      selectionColor={colors.accent}
      cursorColor={colors.accent}
      underlineColorAndroid="transparent"
    />
  );
}

const baseStyles = StyleSheet.create({
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: "transparent",
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    ...Platform.select({
      ios: { zIndex: 1 },
      default: {},
    }),
  },
});
