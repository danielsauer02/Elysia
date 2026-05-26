import { Platform, type TextInputProps } from "react-native";

/**
 * Stops iOS Password AutoFill from painting the yellow accessory / Strong Password UI
 * over arbitrary modal fields (blocks taps). Android: opt out of aggressive autofill on
 * these fields so typing stays reliable; paste still works.
 */
export function modalTextInputAutofillProps(): Pick<
  TextInputProps,
  "textContentType" | "autoComplete" | "importantForAutofill"
> {
  if (Platform.OS === "ios") {
    return {
      textContentType: "none",
      autoComplete: "off",
    };
  }
  return {
    importantForAutofill: "no",
  };
}
