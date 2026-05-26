# Convex + Expo — run locally (Steps 4–7)

## Step 4 — Link Convex (you must run this once in your own terminal)

The Cursor/agent terminal **cannot** complete Convex login (browser + prompts).

1. Open **PowerShell** or **Command Prompt** (outside Cursor is fine).
2. Run:
   ```bash
   cd C:\Users\dansu\Documents\Elysia
   npx convex dev
   ```
3. Complete **browser login** when Convex opens it.
4. Select your project / deployment (**Elysia** / **robust-orca-336**).
5. Wait until you see **synced** / functions deployed — then **leave this window open**.

This creates `convex.json` / local Convex auth and regenerates `convex/_generated/*`.

---

## Step 5 — EAS builds

`apps/mobile/eas.json` is already filled with your **EXPO_PUBLIC_CONVEX_URL** and **EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY** for all build profiles.

For **Expo Go / local dev**, `apps/mobile/.env` is what matters.

---

## Step 6 — Start the mobile app

With **Step 4** still running in another terminal:

```bash
cd C:\Users\dansu\Documents\Elysia
npm run mobile
```

Use `npm run mobile:clear` if Metro acts stale.  
If you run `npx expo start` yourself, use **`npx expo start apps/mobile`** (from repo root); otherwise Expo looks for a root `App.js` and fails.

**Expo web:** iOS/Android use a Metro shim for `react-dom` (Clerk’s React package imports it for web-only APIs). For `expo start --web`, install the real module: `cd apps/mobile && npx expo install react-dom`.

Scan the QR code with **Expo Go** (Android) or **Camera** (iPhone).

### Clerk auth (sign-in / sign-up)

- Use a real **email** format; the app validates before calling Clerk. **“Identifier is invalid”** usually means the string wasn’t an email or Clerk doesn’t allow email as an identifier (**User & Authentication** in the Clerk dashboard).
- To test **without** waiting for email: in Clerk, disable or relax **email verification** for your dev instance so sign-up gets a session immediately.
- If you keep verification on but **no email arrives**: check **spam**, **Clerk → Emails** (logs), and any **custom SMTP** / domain settings.
- See also **Clerk testing tips** in the repo `README.md`.

---

## Step 7 — Migration test checklist

| Test | What to verify |
|------|----------------|
| **Sign up** | New email + password → no error, session active. |
| **Sign in** | Existing user signs in. |
| **Onboarding** | Finish flow → Convex **Data** → `profiles` has a row. |
| **Habits** | Add / complete / uncomplete / remove → `habits`, `habitCompletions`. |
| **Nutrition** | Goal, food log, weight → `nutritionGoals`, `foodLog`, `weightLog`. |
| **Dashboard** | Counts match active habits + today’s completions. |
| **Settings** | Screen loads; wearable list loads (Whoop needs Convex env vars). |
| **Sign out** | Returns to login. |

Convex dashboard: [dashboard.convex.dev](https://dashboard.convex.dev) → your project → **Data**.

---

## Troubleshooting

- **InvalidAuthConfig / push fails** — `convex/auth.config.ts` requires **`CLERK_JWT_ISSUER_DOMAIN`** (not `CLERK_ISSUER_URL`) and Clerk’s **Convex** JWT template with `applicationID: "convex"`. Set `CLERK_JWT_ISSUER_DOMAIN` in the Convex dashboard to your Clerk **Issuer** URL (same as Frontend API / JWT Issuer). See [Convex + Clerk](https://docs.convex.dev/auth/clerk).
- **“Not authenticated” in app** — Ensure `CLERK_JWT_ISSUER_DOMAIN` is set in **Convex** dashboard and matches Clerk JWT template **Issuer**; activate Clerk’s **Convex** integration if you haven’t.
- **Convex queries never load** — Confirm `npx convex dev` is running and `EXPO_PUBLIC_CONVEX_URL` matches your deployment **Cloud URL**.
