# Phase 6 — Post-MVP roadmap

> Status: planning only. Nothing in this document is on the MVP critical path.
> Each work-stream gets its own phased rollout once we have measurable retention
> + revenue from Phases 1–5.

## 1. Training plans

**Goal**: deliver Apple Fitness+ / Whoop-level structured training programs
inside Elysia, tied to recovery + energy balance signals.

- Convex schema additions: `trainingPlans`, `trainingPlanWeeks`,
  `trainingSessions`, `trainingSessionExercises`,
  `trainingPlanAssignments` (user ↔ plan ↔ start date).
- New mutations: `assignPlan`, `completeSession`, `swapSession`.
- Coach service: nightly job adapts the next session to the user's recovery
  proxy + last 7-day load (uses the existing `analytics` data set).
- Mobile screens: Plan picker, weekly calendar, in-session player with
  HealthKit / Health Connect heart-rate streaming.
- Premium gating: any AI-personalised plan stays Pro only.

## 2. Health-clinic diagnostics

**Goal**: lab-result tracking and at-home diagnostics (DNA, blood, microbiome).

- Schema: `healthLabs` (provider, sampleId, takenAt), `labResults`
  (analyte, value, unit, referenceRangeLow/High, flag), `labOrders`
  (Pro-only e-commerce).
- Integrations: Omegaquant, MyHealthBox, 23andMe — start with manual PDF
  uploads via `expo-document-picker` + OpenAI extraction → structured rows.
- AI coach: incorporate the latest 30 days of `labResults` into the assistant
  context (token budget already supports it).
- Privacy: encrypted at rest using `dataPrivacy.encryptToken`.

## 3. Advanced analytics

- New tables: `metricCorrelationsDaily` (precomputed nightly to remove the
  in-memory Pearson scan), `cohortBenchmarks` (anonymised P50/P90 per metric).
- Mobile UI: drill-down screens per metric (intraday timeline, week/month
  comparisons, personal records).
- Cohort comparison cards on the dashboard ("Your HRV is in the 78th percentile
  of users 30–40").
- ML-light: linear regression for projected weight/body-comp trajectories.

## 4. Web companion

- New workspace: `apps/web` (Next.js 15 + same Convex client).
- Read-only at first: dashboard mirror, food-log search, training-plan editor.
- Auth: Clerk shared session via `clerk-nextjs`.
- Auth-aware imports of the existing UI primitives (`packages/ui` if we extract
  them later).

## Sequencing

1. Training plans (largest UX surface, likely to drive retention).
2. Advanced analytics + cohort benchmarks (no new sources required).
3. Web companion (unblocks B2B sales conversations).
4. Health-clinic diagnostics (regulatory load — keep last).

Each track should ship behind a `featureFlags` table column so we can roll
out gradually per cohort.
