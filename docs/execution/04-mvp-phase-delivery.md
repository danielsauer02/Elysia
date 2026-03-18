# MVP Phase Delivery Plan

## Sprint Plan (12 Weeks)

### Sprint 1-2: Foundation
- Monorepo setup (`apps/mobile`, `services/api`, `packages/domain`).
- Auth and onboarding contract implementation.
- Base tab navigation and app shell.
- CI baseline and environment configuration.

**Acceptance criteria**
- Mobile app boots with tab shell.
- API health endpoint and core modules registered.
- Shared schema package consumed by both app and API.

### Sprint 3-4: Library and Habit Loop
- Longevity template listing with evidence blocks.
- Add template to habit flow scaffolding.
- Habit management and state transitions.
- Reminder data model and notification hooks.

**Acceptance criteria**
- User can convert a template to an active habit.
- Habit state lifecycle available (`planned`, `active`, `paused`, `abandoned`).
- Reminder schedule fields captured and stored.

### Sprint 5: Dashboard and Placeholder Strategy
- Dashboard card framework with state handling.
- Active card + connect placeholder + coming soon placeholder.
- Integration source status endpoint scaffold.

**Acceptance criteria**
- Dashboard renders mixed card states correctly.
- Future modules visible without backend full implementation.

### Sprint 6: Catalog and Subscription Gating
- Products/services list and category filters.
- Billing receipt verification route scaffold.
- Entitlement route and UI-level gating checks.

**Acceptance criteria**
- Gated template and feature behavior works consistently.
- Entitlement state affects both screen and card visibility/CTAs.

### Sprint 7: Hardening and Beta Readiness
- Analytics event baseline.
- Crash/error instrumentation.
- Privacy and compliance checklist validation.
- App store preparation checklist and beta build.

**Acceptance criteria**
- Critical funnel events captured.
- Core privacy controls documented and testable.
- Beta build approved for internal pilot.

## Instrumentation Goals
- Onboarding completion rate.
- Template view to habit activation conversion.
- Day-1, day-7 retention on habit-active users.
- Paywall exposure and conversion by template category.
- Reminder engagement and completion uplift.

## Release Gates
- Functional QA: onboarding, habit flow, dashboard states, gating.
- Performance QA: startup and critical screen response benchmarks.
- Compliance QA: consent capture and policy references.
- Operational QA: monitoring, logs, alerting, rollback strategy.
