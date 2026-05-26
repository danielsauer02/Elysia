# Technical Decisions and NFRs

## Locked Decisions
- **Mobile:** React Native + Expo with `expo-router`, TypeScript.
- **Backend / data:** **Convex** (queries, mutations, actions, document DB). Auth: **Clerk** with Convex JWT validation (`convex/auth.config.ts`).
- **Shared contracts:** `@elysia/domain` package (Zod) used by mobile; Convex functions may reuse the same shapes.
- **Data stores (current):** Convex cloud. Optional future: Redis / object storage for jobs and media if requirements outgrow Convex-only patterns.
- **Content operations:** Headless CMS for templates, evidence references, and catalog entries.
- **Subscription architecture:** Native app store billing + backend entitlement resolution.

## Launch Constraints
- Launch as **wellness optimization** product (no diagnosis/treatment claims).
- Region-ready privacy baseline for GDPR/CCPA style controls.
- MVP must ship with placeholder-compatible modular dashboard cards for future diagnostics and integrations.
- Maintain strict domain boundaries in **Convex modules** (and mobile contexts):
  - `profiles`, `habits`, `nutrition`, `dashboard`, `catalog`, `entitlements`, `integrations`, etc.

## Performance and Reliability Targets (MVP)
- App cold start target: under 2.5 seconds on modern devices.
- Critical screen transitions target: under 300 ms perceived response.
- API p95 latency target for non-aggregated endpoints: under 300 ms.
- Crash-free sessions target: greater than 99.5%.
- Notification delivery success monitoring for reminder events.

## Security and Privacy Baseline
- Encrypt all client ↔ backend transport with TLS (Convex + Clerk over HTTPS).
- Store minimal sensitive data on-device; prefer short-lived tokens.
- Maintain consent and policy versioning for onboarding.
- Support account-level data export and deletion workflows.
- Enforce entitlement checks both in mobile UI and API response layer.

## Observability and Analytics Baseline
- Event instrumentation for onboarding funnel, habit activation loop, paywall exposure, and subscription conversion.
- Error monitoring for mobile and Convex with release tagging.
- Audit log for entitlement changes and profile-sensitive updates.
- Integration sync status metrics for future connectors.
