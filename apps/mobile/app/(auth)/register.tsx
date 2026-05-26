import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { AuthTextField } from "@/components/AuthTextField";
import { isValidEmail } from "@/lib/validation";
import { colors, spacing, radii } from "@/theme";

type RegisterPhase = "form" | "verifyCode" | "successLink";

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, completeSignUpWithEmailCode } = useAuth();

  const [phase, setPhase] = useState<RegisterPhase>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRegister = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setError("Enter a valid email address (e.g. you@example.com).");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError(null);
    setLoading(true);
    const { error: authError, signedIn, needsEmailCode } = await signUp(
      email.trim().toLowerCase(),
      password
    );
    setLoading(false);

    if (authError) {
      setError(authError);
      return;
    }
    if (signedIn) {
      router.replace("/");
      return;
    }
    if (needsEmailCode) {
      setPhase("verifyCode");
      setVerificationCode("");
      return;
    }
    setSuccess(true);
  };

  const handleVerifyCode = async () => {
    setError(null);
    setLoading(true);
    const { error: verifyError, signedIn } =
      await completeSignUpWithEmailCode(verificationCode);
    setLoading(false);
    if (verifyError) {
      setError(verifyError);
      return;
    }
    if (signedIn) {
      router.replace("/");
    }
  };

  if (phase === "verifyCode") {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity style={styles.backBtn} onPress={() => setPhase("form")}>
              <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.card}>
              <Text style={styles.heading}>Check your email</Text>
              <Text style={styles.subheading}>
                Enter the 6-digit code we sent to{" "}
                <Text style={styles.successEmail}>{email}</Text>
              </Text>
              {error && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle-outline" size={16} color="#F87171" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Verification code</Text>
                <View style={styles.inputWrap}>
                  <AuthTextField
                    variant="otp"
                    style={[styles.input, styles.otpInput]}
                    value={verificationCode}
                    onChangeText={(t) => setVerificationCode(t.replace(/\D/g, "").slice(0, 8))}
                    placeholder="000000"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    maxLength={8}
                    autoFocus
                  />
                </View>
              </View>
              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                onPress={handleVerifyCode}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#0C0F1A" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>Verify and continue</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (success) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={40} color="#0C0F1A" />
          </View>
          <Text style={styles.successTitle}>Check your email</Text>
          <Text style={styles.successBody}>
            We sent a confirmation link to{"\n"}
            <Text style={styles.successEmail}>{email}</Text>
            {"\n\n"}Open it to activate your account, then come back to sign in.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.replace("/(auth)/login")}
          >
            <Text style={styles.primaryBtnText}>Go to sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>

          {/* Logo */}
          <View style={styles.logoArea}>
            <View style={styles.logoIcon}>
              <Ionicons name="leaf" size={28} color="#0C0F1A" />
            </View>
            <Text style={styles.appName}>Elysia</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.heading}>Create your account</Text>
            <Text style={styles.subheading}>
              Start your longevity journey today
            </Text>

            {error && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color="#F87171" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={colors.textTertiary} />
                <AuthTextField
                  variant="emailRegister"
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textTertiary} />
                <AuthTextField
                  variant="passwordNew"
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Min. 6 characters"
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color={colors.textTertiary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textTertiary} />
                <AuthTextField
                  variant="passwordConfirm"
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repeat your password"
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry={!showPassword}
                />
              </View>
            </View>

            {/* Register button */}
            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#0C0F1A" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Create account</Text>
              )}
            </TouchableOpacity>

            {/* Login link */}
            <View style={styles.linkRow}>
              <Text style={styles.linkText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
                <Text style={styles.linkAccent}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  backBtn: {
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    alignSelf: "flex-start",
  },
  logoArea: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  logoIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  appName: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  subheading: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: -spacing.xs,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "rgba(248,113,113,0.1)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.3)",
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  errorText: {
    fontSize: 13,
    color: "#F87171",
    flex: 1,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 50,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
  },
  otpInput: {
    letterSpacing: 6,
    fontSize: 20,
    fontWeight: "600",
  },
  primaryBtn: {
    height: 52,
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0C0F1A",
    letterSpacing: 0.2,
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  linkText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  linkAccent: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.accent,
  },
  // Success screen
  successWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    gap: spacing.lg,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  successTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  successBody: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  successEmail: {
    color: colors.accent,
    fontWeight: "600",
  },
});
