# Technical Decisions and NFRs

## Locked Decisions
- **Mobile:** React Native + Expo with `expo-router`, TypeScript.
- **Backend API:** Node + Fastify, typed validation with `zod`.
- **Shared contracts:** `@elysia/domain` package used by mobile and API.
- **Data stores (target):** PostgreSQL for transactional data, Redis for jobs/cache, object storage for media/content assets.
- **Content operations:** Headless CMS for templates, evidence references, and catalog entries.
- **Subscription architecture:** Native app store billing + backend entitlement resolution.

## Launch Constraints
- Launch as **wellness optimization** product (no diagnosis/treatment claims).
- Region-ready privacy baseline for GDPR/CCPA style controls.
- MVP must ship with placeholder-compatible modular dashboard cards for future diagnostics and integrations.
- Maintain strict domain boundaries in API modules:
  - `auth`, `profile`, `habits`, `library`, `dashboard`, `catalog`, `billing`, `entitlements`, `integrations`.

## Performance and Reliability Targets (MVP)
- App cold start target: under 2.5 seconds on modern devices.
- Critical screen transitions target: under 300 ms perceived response.
- API p95 latency target for non-aggregated endpoints: under 300 ms.
- Crash-free sessions target: greater than 99.5%.
- Notification delivery success monitoring for reminder events.

## Security and Privacy Baseline
- Encrypt all API transport with TLS.
- Store minimal sensitive data on-device; prefer short-lived tokens.
- Maintain consent and policy versioning for onboarding.
- Support account-level data export and deletion workflows.
- Enforce entitlement checks both in mobile UI and API response layer.

## Observability and Analytics Baseline
- Event instrumentation for onboarding funnel, habit activation loop, paywall exposure, and subscription conversion.
- Error monitoring for mobile and API with release tagging.
- Audit log for entitlement changes and profile-sensitive updates.
- Integration sync status metrics for future connectors.
