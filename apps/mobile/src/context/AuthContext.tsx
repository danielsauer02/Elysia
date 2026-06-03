import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  useAuth as useClerkAuth,
  useSignIn,
  useSignUp,
} from "@clerk/clerk-expo";
import type { SignInFirstFactor, SignInSecondFactor } from "@clerk/types";
import { identify, reset } from "@/lib/analytics";

type EmailCodeFirstFactor = Extract<SignInFirstFactor, { strategy: "email_code" }>;
type EmailCodeSecondFactor = Extract<SignInSecondFactor, { strategy: "email_code" }>;

export type AuthUser = { id: string };

export type SignInResult = {
  error: string | null;
  signedIn: boolean;
  needsEmailCode: boolean;
};

export type AuthContextValue = {
  session: string | null;
  isLoading: boolean;
  user: AuthUser | null;
  signUp: (
    email: string,
    password: string
  ) => Promise<{
    error: string | null;
    signedIn: boolean;
    needsEmailCode: boolean;
  }>;
  completeSignUpWithEmailCode: (
    code: string
  ) => Promise<{ error: string | null; signedIn: boolean }>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  resendSignInEmailCode: () => Promise<{ error: string | null }>;
  completeSignInWithEmailCode: (
    code: string
  ) => Promise<{ error: string | null; signedIn: boolean }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function clerkErrors(e: unknown): string {
  if (e && typeof e === "object" && "errors" in e) {
    const errs = (e as { errors: { message: string }[] }).errors;
    if (Array.isArray(errs) && errs[0]?.message) return errs[0].message;
  }
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isLoaded: clerkLoaded, userId, isSignedIn, getToken } = useClerkAuth();
  const {
    signUp: clerkSignUp,
    setActive: setActiveSignUp,
    isLoaded: signUpLoaded,
  } = useSignUp();
  const {
    signIn: clerkSignIn,
    setActive: setActiveSignIn,
    isLoaded: signInLoaded,
  } = useSignIn();

  // Tracks whether the in-flight sign-in needs first- or second-factor email code,
  // and the email address id Clerk wants us to verify. Cleared once sign-in completes.
  const pendingSignInRef = useRef<{
    kind: "first" | "second";
    emailAddressId: string;
  } | null>(null);

  useEffect(() => {
    if (isSignedIn && userId) {
      identify(userId);
    } else if (clerkLoaded && !isSignedIn) {
      reset();
    }
  }, [isSignedIn, userId, clerkLoaded]);

  // ── Convex JWT template diagnostic ─────────────────────────────────
  // Verifies that Clerk → Convex auth hand-off is set up. The
  // `ConvexProviderWithClerk` calls `getToken({ template: "convex" })`
  // on every Convex request. If the template doesn't exist in the
  // Clerk dashboard (Dashboard → JWT Templates → New template named
  // "convex"), Clerk returns `null` silently and every Convex function
  // throws "Not authenticated". This effect surfaces that case so the
  // root cause is obvious in the dev console instead of buried in
  // server-side stack traces.
  useEffect(() => {
    if (!__DEV__) return;
    if (!clerkLoaded || !isSignedIn) return;
    void (async () => {
      try {
        const token = await getToken({ template: "convex" });
        if (!token) {
          // eslint-disable-next-line no-console
          console.warn(
            "[Convex auth] Clerk returned NO token for template 'convex'. " +
              "Create a JWT template named 'convex' in the Clerk Dashboard " +
              "(JWT Templates → New template → name: convex, audience: convex). " +
              "Without it, every Convex function call throws 'Not authenticated'."
          );
        } else {
          // eslint-disable-next-line no-console
          console.log(
            `[Convex auth] OK — got JWT for template 'convex' (len=${token.length}).`
          );
        }
      } catch (e: unknown) {
        // eslint-disable-next-line no-console
        console.warn(
          "[Convex auth] getToken({ template: 'convex' }) threw:",
          e instanceof Error ? e.message : String(e)
        );
      }
    })();
  }, [clerkLoaded, isSignedIn, getToken]);

  const signUp = useCallback(
    async (email: string, password: string) => {
      if (!clerkSignUp) {
        return { error: "Auth not ready", signedIn: false, needsEmailCode: false };
      }
      try {
        await clerkSignUp.create({
          emailAddress: email,
          password,
        });

        if (clerkSignUp.status === "complete" && clerkSignUp.createdSessionId) {
          await setActiveSignUp?.({ session: clerkSignUp.createdSessionId });
          return { error: null, signedIn: true, needsEmailCode: false };
        }

        await clerkSignUp.prepareEmailAddressVerification({
          strategy: "email_code",
        });
        return { error: null, signedIn: false, needsEmailCode: true };
      } catch (e: unknown) {
        return {
          error: clerkErrors(e),
          signedIn: false,
          needsEmailCode: false,
        };
      }
    },
    [clerkSignUp, setActiveSignUp]
  );

  const completeSignUpWithEmailCode = useCallback(
    async (code: string) => {
      if (!clerkSignUp || !setActiveSignUp) {
        return { error: "Auth not ready", signedIn: false };
      }
      try {
        const res = await clerkSignUp.attemptEmailAddressVerification({
          code,
        });
        if (res.status === "complete" && res.createdSessionId) {
          await setActiveSignUp({ session: res.createdSessionId });
          return { error: null, signedIn: true };
        }
        return { error: "Verification incomplete", signedIn: false };
      } catch (e: unknown) {
        return { error: clerkErrors(e), signedIn: false };
      }
    },
    [clerkSignUp, setActiveSignUp]
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      if (!clerkSignIn || !setActiveSignIn) {
        return { error: "Auth not ready", signedIn: false, needsEmailCode: false };
      }
      try {
        const result = await clerkSignIn.create({
          identifier: email,
          password,
        });

        if (result.status === "complete" && result.createdSessionId) {
          await setActiveSignIn({ session: result.createdSessionId });
          pendingSignInRef.current = null;
          return { error: null, signedIn: true, needsEmailCode: false };
        }

        if (result.status === "needs_first_factor") {
          const emailFactor = (result.supportedFirstFactors ?? []).find(
            (f): f is EmailCodeFirstFactor => f.strategy === "email_code"
          );
          if (emailFactor) {
            await clerkSignIn.prepareFirstFactor({
              strategy: "email_code",
              emailAddressId: emailFactor.emailAddressId,
            });
            pendingSignInRef.current = {
              kind: "first",
              emailAddressId: emailFactor.emailAddressId,
            };
            return { error: null, signedIn: false, needsEmailCode: true };
          }
          return {
            error:
              "Email code verification isn't available for this account. Open Clerk to finish sign-in.",
            signedIn: false,
            needsEmailCode: false,
          };
        }

        if (result.status === "needs_second_factor") {
          const emailFactor = (result.supportedSecondFactors ?? []).find(
            (f): f is EmailCodeSecondFactor => f.strategy === "email_code"
          );
          if (emailFactor) {
            await clerkSignIn.prepareSecondFactor({
              strategy: "email_code",
              emailAddressId: emailFactor.emailAddressId,
            });
            pendingSignInRef.current = {
              kind: "second",
              emailAddressId: emailFactor.emailAddressId,
            };
            return { error: null, signedIn: false, needsEmailCode: true };
          }
          return {
            error:
              "Two-factor verification is required but no email factor is configured.",
            signedIn: false,
            needsEmailCode: false,
          };
        }

        return {
          error: `Sign-in needs additional steps (status: ${result.status}).`,
          signedIn: false,
          needsEmailCode: false,
        };
      } catch (e: unknown) {
        return {
          error: clerkErrors(e),
          signedIn: false,
          needsEmailCode: false,
        };
      }
    },
    [clerkSignIn, setActiveSignIn]
  );

  const resendSignInEmailCode = useCallback(async () => {
    if (!clerkSignIn) return { error: "Auth not ready" };
    const pending = pendingSignInRef.current;
    if (!pending) return { error: "No verification in progress" };
    try {
      if (pending.kind === "first") {
        await clerkSignIn.prepareFirstFactor({
          strategy: "email_code",
          emailAddressId: pending.emailAddressId,
        });
      } else {
        await clerkSignIn.prepareSecondFactor({
          strategy: "email_code",
          emailAddressId: pending.emailAddressId,
        });
      }
      return { error: null };
    } catch (e: unknown) {
      return { error: clerkErrors(e) };
    }
  }, [clerkSignIn]);

  const completeSignInWithEmailCode = useCallback(
    async (code: string) => {
      if (!clerkSignIn || !setActiveSignIn) {
        return { error: "Auth not ready", signedIn: false };
      }
      const pending = pendingSignInRef.current;
      if (!pending) {
        return { error: "No verification in progress", signedIn: false };
      }
      try {
        const res =
          pending.kind === "first"
            ? await clerkSignIn.attemptFirstFactor({ strategy: "email_code", code })
            : await clerkSignIn.attemptSecondFactor({ strategy: "email_code", code });
        if (res.status === "complete" && res.createdSessionId) {
          await setActiveSignIn({ session: res.createdSessionId });
          pendingSignInRef.current = null;
          return { error: null, signedIn: true };
        }
        return { error: `Verification incomplete (status: ${res.status})`, signedIn: false };
      } catch (e: unknown) {
        return { error: clerkErrors(e), signedIn: false };
      }
    },
    [clerkSignIn, setActiveSignIn]
  );

  const value = useMemo(
    (): AuthContextValue => ({
      session: isSignedIn && userId ? userId : null,
      isLoading: !clerkLoaded || !signUpLoaded || !signInLoaded,
      user: isSignedIn && userId ? { id: userId } : null,
      signUp,
      completeSignUpWithEmailCode,
      signIn,
      resendSignInEmailCode,
      completeSignInWithEmailCode,
    }),
    [
      clerkLoaded,
      signUpLoaded,
      signInLoaded,
      isSignedIn,
      userId,
      signUp,
      completeSignUpWithEmailCode,
      signIn,
      resendSignInEmailCode,
      completeSignInWithEmailCode,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
