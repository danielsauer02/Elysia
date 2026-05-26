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

type LoginPhase = "form" | "verifyCode";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, completeSignInWithEmailCode, resendSignInEmailCode } = useAuth();

  const [phase, setPhase] = useState<LoginPhase>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendInfo, setResendInfo] = useState<string | null>(null);

  const handleSignIn = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !password) {
      setError("Enter email and password.");
      return;
    }
    if (!isValidEmail(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }

    setError(null);
    setLoading(true);
    const { error: signInError, signedIn, needsEmailCode } = await signIn(
      trimmed,
      password
    );
    setLoading(false);

    if (signInError) {
      setError(signInError);
      return;
    }
    if (signedIn) {
      router.replace("/");
      return;
    }
    if (needsEmailCode) {
      setVerificationCode("");
      setResendInfo(null);
      setPhase("verifyCode");
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length < 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setError(null);
    setResendInfo(null);
    setLoading(true);
    const { error: verifyError, signedIn } = await completeSignInWithEmailCode(
      verificationCode
    );
    setLoading(false);
    if (verifyError) {
      setError(verifyError);
      return;
    }
    if (signedIn) {
      router.replace("/");
    }
  };

  const handleResend = async () => {
    setError(null);
    setResendInfo(null);
    setLoading(true);
    const { error: resendError } = await resendSignInEmailCode();
    setLoading(false);
    if (resendError) {
      setError(resendError);
      return;
    }
    setResendInfo(`Code sent to ${email.trim().toLowerCase()}.`);
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
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => {
                setPhase("form");
                setError(null);
                setResendInfo(null);
              }}
            >
              <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
            </TouchableOpacity>

            <View style={styles.logoArea}>
              <View style={styles.logoIcon}>
                <Ionicons name="leaf" size={28} color="#0C0F1A" />
              </View>
              <Text style={styles.appName}>Elysia</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.heading}>Verify it's you</Text>
              <Text style={styles.subheading}>
                Enter the 6-digit code we sent to{" "}
                <Text style={styles.linkAccent}>{email.trim().toLowerCase()}</Text>
              </Text>

              {error ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle-outline" size={16} color="#F87171" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {resendInfo ? (
                <View style={styles.infoBanner}>
                  <Ionicons name="mail-outline" size={16} color={colors.accent} />
                  <Text style={styles.infoText}>{resendInfo}</Text>
                </View>
              ) : null}

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Verification code</Text>
                <View style={styles.inputWrap}>
                  <AuthTextField
                    variant="otp"
                    style={[styles.input, styles.otpInput]}
                    value={verificationCode}
                    onChangeText={(t) =>
                      setVerificationCode(t.replace(/\D/g, "").slice(0, 8))
                    }
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
                onPress={() => void handleVerifyCode()}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#0C0F1A" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>Verify and sign in</Text>
                )}
              </TouchableOpacity>

              <View style={styles.linkRow}>
                <Text style={styles.linkText}>Didn&apos;t get the code? </Text>
                <TouchableOpacity onPress={() => void handleResend()} disabled={loading}>
                  <Text style={styles.linkAccent}>Resend</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.logoArea}>
            <View style={styles.logoIcon}>
              <Ionicons name="leaf" size={28} color="#0C0F1A" />
            </View>
            <Text style={styles.appName}>Elysia</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>Welcome back</Text>
            <Text style={styles.subheading}>
              Sign in with your account — Convex syncs after you authenticate with Clerk.
            </Text>

            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color="#F87171" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={colors.textTertiary} />
                <AuthTextField
                  variant="emailLogin"
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

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textTertiary} />
                <AuthTextField
                  variant="passwordLogin"
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Your password"
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

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={() => void handleSignIn()}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#0C0F1A" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Sign in</Text>
              )}
            </TouchableOpacity>

            <View style={styles.linkRow}>
              <Text style={styles.linkText}>New here? </Text>
              <TouchableOpacity onPress={() => router.replace("/(auth)/register")}>
                <Text style={styles.linkAccent}>Create account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  backBtn: { marginTop: spacing.sm, marginBottom: spacing.md, alignSelf: "flex-start" },
  logoArea: { alignItems: "center", marginBottom: spacing.xl },
  logoIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    marginTop: spacing.md,
    fontSize: 28,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  heading: { fontSize: 22, fontWeight: "800", color: colors.textPrimary },
  subheading: { fontSize: 13, color: colors.textSecondary, marginTop: -4, lineHeight: 19 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(248,113,113,0.12)",
    borderRadius: radii.md,
    padding: spacing.md,
  },
  errorText: { flex: 1, fontSize: 13, color: "#F87171" },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(94,234,212,0.10)",
    borderRadius: radii.md,
    padding: spacing.md,
  },
  infoText: { flex: 1, fontSize: 13, color: colors.accent },
  fieldGroup: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  input: { flex: 1, paddingVertical: spacing.sm, fontSize: 16, color: colors.textPrimary },
  otpInput: {
    letterSpacing: 6,
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  primaryBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: 16, fontWeight: "800", color: "#0C0F1A" },
  linkRow: { flexDirection: "row", justifyContent: "center", marginTop: spacing.sm },
  linkText: { fontSize: 14, color: colors.textSecondary },
  linkAccent: { fontSize: 14, fontWeight: "700", color: colors.accent },
});
