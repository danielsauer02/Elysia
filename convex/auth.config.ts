import type { AuthConfig } from "convex/server";

/**
 * Clerk JWT validation for Convex.
 * @see https://docs.convex.dev/auth/clerk
 *
 * Set `CLERK_JWT_ISSUER_DOMAIN` in the Convex dashboard (Settings → Environment Variables)
 * to your Clerk Frontend API URL / JWT template Issuer, e.g.
 * https://your-instance.clerk.accounts.dev
 */
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
