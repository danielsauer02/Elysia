# Elysia Longevity Platform

Monorepo scaffold for a mobile-first longevity optimization product.

## Workspace Layout
- `apps/mobile`: React Native + Expo client with tab-based app shell.
- `services/api`: Fastify API with domain-based modules and response envelope.
- `packages/domain`: Shared `zod` contracts for profiles, habits, templates, dashboard, catalog, and entitlements.
- `docs/architecture`: technical decisions and contracts.
- `docs/product`: UX flow specs.
- `docs/execution`: phase delivery and post-MVP roadmap.

## What Is Implemented
- Shared domain schemas with feature gating primitives.
- API module skeleton and route contracts for all MVP domains.
- Mobile tab shell and placeholder feature screens:
  - Dashboard
  - Library
  - Habits
  - Products
  - Settings
- Entitlement-aware UI checks for feature and template gating.
- Execution documentation mapped to the original plan todos.

## Next Build Steps
- Connect persistent storage (PostgreSQL + ORM) to API modules.
- Add authenticated session middleware and real user context.
- Integrate push notification scheduling and delivery pipeline.
- Add CMS integration for template and catalog operations.
- Stand up CI, linting, tests, and release workflows.
