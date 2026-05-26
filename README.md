# Elysia Longevity Platform

Monorepo for a mobile-first longevity product: **Expo (React Native) + Convex + Clerk**.

## Workspace layout

| Path | Role |
|------|------|
| `apps/mobile` | Expo app (`expo-router`), Convex React client, Clerk Expo |
| `convex/` | Convex schema, queries, mutations, actions (backend) |
| `packages/domain` | Shared Zod schemas / types (persistence-agnostic) |
| `docs/` | Architecture, product, execution notes |

## Prerequisites

- **Node 20+**
- **Convex** account and project ([dashboard.convex.dev](https://dashboard.convex.dev))
- **Clerk** application with **Email + password** ([clerk.com](https://clerk.com))
- Clerk **Convex** JWT template + **`CLERK_JWT_ISSUER_DOMAIN`** on the Convex deployment ([Convex + Clerk](https://docs.convex.dev/auth/clerk))

## Local setup

1. **Root** — install dependencies:

   ```bash
   npm install
   ```

2. **Convex env** — in the Convex dashboard, set **`CLERK_JWT_ISSUER_DOMAIN`** to your Clerk JWT **Issuer** (same as Frontend API URL / `*.clerk.accounts.dev`).

3. **Mobile env** — either:
   - copy `apps/mobile/.env.example` → `apps/mobile/.env` and fill `EXPO_PUBLIC_CONVEX_URL` + `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, **or**
   - keep a **repo-root** `.env.local` with `CONVEX_URL` / Clerk keys — `apps/mobile/app.config.js` maps them to the `EXPO_PUBLIC_*` names Expo needs.

4. **Run Convex dev** (syncs functions; keep this terminal open):

   ```bash
   npx convex dev
   ```

5. **Run the app** (always targets `apps/mobile`, even from repo root):

   ```bash
   npm run mobile
   ```

   Clear Metro cache: `npm run mobile:clear`.  
   If you use `npx expo start` manually, pass the app dir: `npx expo start apps/mobile` (running from the repo root without that path looks for a missing root `App.js`).  
   **Expo web:** native dev uses a Metro shim for `react-dom` (required by `@clerk/clerk-react`); if you add `--web`, run `npx expo install react-dom` in `apps/mobile` for the real package.

More detail: `docs/CONVEX_AND_EXPO_DEV.md`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run mobile` | Start Expo for `apps/mobile` (`expo-router` entry) |
| `npm run mobile:clear` | Same with `-c` (clear Metro cache) |
| `npm run convex:dev` | `npx convex dev` |
| `npm run convex:deploy` | Deploy Convex to production |
| `npm run typecheck` | Typecheck all workspaces |

## What’s implemented

- Auth: **Clerk** (email/password) + **Convex**-validated sessions
- Data: **Convex** tables for profiles, habits, nutrition, wearable connections
- Wearables: Whoop / Oura flows via Convex actions (optional env: `WHOOP_*` on Convex)
- Shared **domain** schemas for habits, onboarding, templates, etc.

## Clerk testing tips

- **Sign-in identifier:** Use a full **email** (e.g. `you@example.com`). Clerk returns “Identifier is invalid” if the value isn’t a valid email or if **email** isn’t enabled as a sign-in identifier in the Clerk dashboard (**User & Authentication**).
- **Fastest local loop:** In Clerk, turn **off** (or relax) **email verification** for development so sign-up can return a session immediately instead of waiting for mail. If verification stays on, check **spam** and **Clerk → Emails** (delivery logs).
- **Extra fields:** Disable **required** fields beyond email + password until the app collects them—otherwise sign-up will error.
- **Custom SMTP / domain:** If you configured a custom email provider in Clerk, misconfiguration can mean **no mail is sent** even though the app shows “Check your email.”
- **Email verification:** If verification is on, the app asks for a **6-digit email code** when Clerk supports `email_code`. In Clerk, ensure email verification is configured to allow **email code** (not only magic link), or turn verification off for the fastest dev loop.

## Legacy note

Older docs under `docs/architecture` may still mention Fastify/Postgres; the running stack is **Convex + Clerk** as above.
