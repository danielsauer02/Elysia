# Domain Schemas and API Contracts

This file maps the shared schema models in `packages/domain/src/index.ts` to initial API contracts in `services/api/src/modules`.

## Core Domain Entities
- **Identity/Profile:** `userProfileSchema`, `onboardingPayloadSchema`
- **Habits:** `userHabitSchema`, `habitScheduleSchema`, `reminderRuleSchema`, `habitStateSchema`
- **Library:** `protocolTemplateSchema`, `evidenceReferenceSchema`
- **Dashboard:** `dashboardTileSchema`, `metricObservationSchema`, `metricSourceSchema`
- **Catalog:** `catalogItemSchema`
- **Access Control:** `subscriptionTierSchema`, `featureKeySchema`, `entitlementSchema`

## API Contract Surface (MVP)

### Auth
- `POST /auth/login`
  - Body: `{ email, password }`
  - Response: `{ accessToken, refreshToken, expiresInSeconds }`

### Profile and Onboarding
- `POST /profile/onboarding`
  - Body: `onboardingPayloadSchema`
  - Response: onboarding status + next step
- `GET /profile/me`
  - Response: profile placeholder (auth-context dependent)

### Habits
- `GET /habits`
  - Response: list of `UserHabit`
- `POST /habits`
  - Body: create payload derived from `userHabitSchema`
  - Response: created habit payload
- `PATCH /habits/:habitId/state`
  - Body: `{ state: HabitState }`
  - Response: updated state summary

### Library
- `GET /library/templates?category=&tier=`
  - Response: filtered `ProtocolTemplate[]`

### Dashboard
- `GET /dashboard/tiles`
  - Response: modular dashboard card set with status values:
    - `active`
    - `placeholder_connect`
    - `placeholder_coming_soon`

### Catalog
- `GET /catalog/items?category=&offerType=`
  - Response: filtered `CatalogItem[]`

### Billing and Entitlements
- `POST /billing/verify-receipt`
  - Body: app store receipt payload
  - Response: verification and mapped tier
- `GET /entitlements/me`
  - Response: active tier and feature list

### Integrations
- `GET /integrations/sources`
  - Response: available providers and connection status
- `POST /integrations/connect`
  - Body: provider connect payload
  - Response: `pending_sync` status

## Response Envelope Standard
Every route uses a shared response envelope:
- `ok: boolean`
- `data: T`
- `requestId: string`

## Future Contract Evolution (Post-MVP)
- Add pagination and cursor metadata to list endpoints.
- Add webhook endpoints for store billing and partner integrations.
- Add write endpoints for nutrition logs and metric ingestion.
- Add diagnostic result ingestion and provenance metadata.
